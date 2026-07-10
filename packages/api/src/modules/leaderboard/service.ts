/**
 * Leaderboard score recomputation service.
 *
 * On every log event, recomputes and upserts the user's scores for all three
 * leaderboard modes (streak / total / window) in a single transaction.
 */
import { and, eq, isNull, sql, count } from 'drizzle-orm';
import { schema, type Db } from '../../db/client';
import { computeStreak } from './streak';
import { createNotification } from '../notifications/service';

interface RecomputeParams {
  userId: string;
  groupId: string;
  affectedHabitId: string;
}

/**
 * Recompute all three leaderboard mode scores for a user in a group.
 * Called inside the POST /logs transaction after inserting the habit_log.
 */
export async function recomputeScores(
  db: Db,
  params: RecomputeParams,
): Promise<void> {
  const { userId, groupId } = params;

  // 0. Read old streak before recomputing (for milestone detection)
  let previousStreak = 0;
  try {
    const [oldStreak] = await db
      .select({ currentStreak: schema.streaks.currentStreak })
      .from(schema.streaks)
      .where(
        and(
          eq(schema.streaks.userId, userId),
          eq(schema.streaks.groupId, groupId),
          isNull(schema.streaks.habitId),
        ),
      )
      .limit(1);
    previousStreak = oldStreak?.currentStreak ?? 0;
  } catch {
    // Gracefully handle — milestone detection is best-effort
  }

  // 1. Compute group-level streak and upsert into streaks table
  const streakResult = await computeStreak(db, {
    userId,
    groupId,
    habitId: null,
  });

  // Check for streak milestones
  const milestones = [7, 14, 30, 60, 90, 180, 365];
  for (const m of milestones) {
    if (streakResult.current >= m && previousStreak < m) {
      // Insert feed event for milestone
      await db.insert(schema.feedEvents).values({
        groupId,
        actorUserId: userId,
        kind: 'streak_milestone',
        payloadJson: { streak: m },
      });
      // Notify the user
      createNotification(db, {
        userId,
        kind: 'milestone',
        payload: {
          title: 'Streak milestone!',
          body: `You hit a ${m}-day streak!`,
          groupId,
          streak: m,
        },
      }).catch(() => {});
      break; // Only fire for the highest crossed milestone
    }
  }

  await db
    .insert(schema.streaks)
    .values({
      userId,
      groupId,
      habitId: null as unknown as string, // null = group-level
      currentStreak: streakResult.current,
      longestStreak: streakResult.longest,
      lastCompletedDate: streakResult.lastCompletedDate,
    })
    .onConflictDoUpdate({
      target: [schema.streaks.userId, schema.streaks.groupId, schema.streaks.habitId],
      set: {
        currentStreak: streakResult.current,
        longestStreak: streakResult.longest,
        lastCompletedDate: streakResult.lastCompletedDate,
      },
    });

  // 2. Compute total count — non-deleted logs from joined_at onwards
  const totalResult = await db
    .select({ cnt: count() })
    .from(schema.habitLogs)
    .innerJoin(
      schema.groupMemberships,
      and(
        eq(schema.groupMemberships.groupId, schema.habitLogs.groupId),
        eq(schema.groupMemberships.userId, schema.habitLogs.userId),
        isNull(schema.groupMemberships.leftAt),
      ),
    )
    .where(
      and(
        eq(schema.habitLogs.userId, userId),
        eq(schema.habitLogs.groupId, groupId),
        isNull(schema.habitLogs.deletedAt),
        sql`${schema.habitLogs.logDate} >= ${schema.groupMemberships.joinedAt}::date`,
      ),
    );

  const totalCount = Number(totalResult[0]?.cnt ?? 0);

  // 3. Find currently active challenge window
  const [activeWindow] = await db
    .select({
      id: schema.challengeWindows.id,
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

  let windowCount = 0;
  if (activeWindow) {
    const windowResult = await db
      .select({ cnt: count() })
      .from(schema.habitLogs)
      .where(
        and(
          eq(schema.habitLogs.userId, userId),
          eq(schema.habitLogs.groupId, groupId),
          isNull(schema.habitLogs.deletedAt),
          sql`${schema.habitLogs.logDate} >= ${activeWindow.startDate}`,
          sql`${schema.habitLogs.logDate} <= ${activeWindow.endDate}`,
        ),
      );
    windowCount = Number(windowResult[0]?.cnt ?? 0);
  }

  // 4. Upsert leaderboard_scores for all three modes
  const now = new Date();

  // Streak mode
  await db
    .insert(schema.leaderboardScores)
    .values({
      groupId,
      userId,
      mode: 'streak',
      challengeWindowId: null,
      score: streakResult.current,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.leaderboardScores.groupId,
        schema.leaderboardScores.userId,
        schema.leaderboardScores.mode,
        schema.leaderboardScores.challengeWindowId,
      ],
      set: {
        score: streakResult.current,
        updatedAt: now,
      },
    });

  // Total mode
  await db
    .insert(schema.leaderboardScores)
    .values({
      groupId,
      userId,
      mode: 'total',
      challengeWindowId: null,
      score: totalCount,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.leaderboardScores.groupId,
        schema.leaderboardScores.userId,
        schema.leaderboardScores.mode,
        schema.leaderboardScores.challengeWindowId,
      ],
      set: {
        score: totalCount,
        updatedAt: now,
      },
    });

  // Window mode — only if there's an active challenge window
  if (activeWindow) {
    await db
      .insert(schema.leaderboardScores)
      .values({
        groupId,
        userId,
        mode: 'window',
        challengeWindowId: activeWindow.id,
        score: windowCount,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.leaderboardScores.groupId,
          schema.leaderboardScores.userId,
          schema.leaderboardScores.mode,
          schema.leaderboardScores.challengeWindowId,
        ],
        set: {
          score: windowCount,
          updatedAt: now,
        },
      });
  }
}
