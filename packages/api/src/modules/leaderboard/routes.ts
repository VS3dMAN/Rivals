/**
 * Leaderboard routes.
 *
 * - GET /groups/:id/leaderboard — current leaderboard in active mode
 * - POST /groups/:id/challenges — create challenge window (admin)
 * - GET /groups/:id/challenges — list challenge windows
 */
import type { FastifyPluginAsync } from 'fastify';
import { and, eq, isNull, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';
import { HttpError, requireMember } from '../groups/service';
import {
  createChallenge,
  createChallengeSchema,
  listChallenges,
} from './challenges';

interface LeaderboardRouteOptions {
  db: Db;
}

const idParam = z.object({ id: z.string().uuid() });
const statusQuery = z.object({
  status: z.enum(['upcoming', 'active', 'completed']).optional(),
});

const routes: FastifyPluginAsync<LeaderboardRouteOptions> = async (app, opts) => {
  const { db } = opts;

  // ----------------------------------------------------------------
  // GET /groups/:id/leaderboard
  // ----------------------------------------------------------------
  app.get('/groups/:id/leaderboard', async (req) => {
    const auth = await app.requireAuth(req);
    const { id: groupId } = idParam.parse(req.params);

    await requireMember(db, groupId, auth.id);

    // Read the group's leaderboard mode
    const [group] = await db
      .select({
        leaderboardMode: schema.groups.leaderboardMode,
        referenceTz: schema.groups.referenceTz,
      })
      .from(schema.groups)
      .where(eq(schema.groups.id, groupId))
      .limit(1);

    if (!group) {
      throw new HttpError(404, 'GROUP_NOT_FOUND', 'Group not found');
    }

    const mode = group.leaderboardMode;

    // For window mode, find the active challenge window
    let challengeWindowId: string | null = null;
    let activeWindow: { id: string; name: string; startDate: string; endDate: string } | null = null;

    if (mode === 'window') {
      const [cw] = await db
        .select({
          id: schema.challengeWindows.id,
          name: schema.challengeWindows.name,
          startDate: schema.challengeWindows.startDate,
          endDate: schema.challengeWindows.endDate,
        })
        .from(schema.challengeWindows)
        .where(
          and(
            eq(schema.challengeWindows.groupId, groupId),
            eq(schema.challengeWindows.status, 'active'),
          ),
        )
        .limit(1);

      if (cw) {
        challengeWindowId = cw.id;
        activeWindow = cw;
      }
    }

    // Build the leaderboard query with tie-breaking
    // ORDER BY: score DESC, longest_streak DESC, total_completions DESC, joined_at ASC
    const entries = await db
      .select({
        userId: schema.leaderboardScores.userId,
        score: schema.leaderboardScores.score,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        currentStreak: sql<number>`COALESCE((
          SELECT s.current_streak FROM streaks s
          WHERE s.user_id = ${schema.leaderboardScores.userId}
            AND s.group_id = ${schema.leaderboardScores.groupId}
            AND s.habit_id IS NULL
        ), 0)`.as('current_streak'),
        longestStreak: sql<number>`COALESCE((
          SELECT s.longest_streak FROM streaks s
          WHERE s.user_id = ${schema.leaderboardScores.userId}
            AND s.group_id = ${schema.leaderboardScores.groupId}
            AND s.habit_id IS NULL
        ), 0)`.as('longest_streak'),
        joinedAt: schema.groupMemberships.joinedAt,
      })
      .from(schema.leaderboardScores)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.leaderboardScores.userId),
      )
      .innerJoin(
        schema.groupMemberships,
        and(
          eq(schema.groupMemberships.groupId, schema.leaderboardScores.groupId),
          eq(schema.groupMemberships.userId, schema.leaderboardScores.userId),
          isNull(schema.groupMemberships.leftAt),
        ),
      )
      .where(
        and(
          eq(schema.leaderboardScores.groupId, groupId),
          eq(schema.leaderboardScores.mode, mode),
          mode === 'window' && challengeWindowId
            ? eq(schema.leaderboardScores.challengeWindowId, challengeWindowId)
            : isNull(schema.leaderboardScores.challengeWindowId),
        ),
      )
      .orderBy(
        desc(schema.leaderboardScores.score),
        sql`longest_streak DESC`,
        sql`current_streak DESC`,
        asc(schema.groupMemberships.joinedAt),
      );

    // Add rank numbers
    const rankedEntries = entries.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

    // Get member count
    const [memberCountRow] = await db
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(schema.groupMemberships)
      .where(
        and(
          eq(schema.groupMemberships.groupId, groupId),
          isNull(schema.groupMemberships.leftAt),
        ),
      );

    return {
      mode,
      memberCount: memberCountRow?.cnt ?? 0,
      challengeWindow: activeWindow,
      entries: rankedEntries,
    };
  });

  // ----------------------------------------------------------------
  // POST /groups/:id/challenges
  // ----------------------------------------------------------------
  app.post('/groups/:id/challenges', async (req, reply) => {
    const auth = await app.requireAuth(req);
    const { id: groupId } = idParam.parse(req.params);
    const body = createChallengeSchema.parse(req.body);

    const window = await createChallenge(db, groupId, auth.id, body);
    return reply.status(201).send(window);
  });

  // ----------------------------------------------------------------
  // GET /groups/:id/challenges?status=upcoming|active|completed
  // ----------------------------------------------------------------
  app.get('/groups/:id/challenges', async (req) => {
    const auth = await app.requireAuth(req);
    const { id: groupId } = idParam.parse(req.params);
    const { status } = statusQuery.parse(req.query);

    const windows = await listChallenges(db, groupId, auth.id, status);
    return { challenges: windows };
  });
};

export default routes;
