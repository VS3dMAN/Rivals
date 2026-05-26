import type { FastifyPluginAsync } from 'fastify';
import { and, eq, desc, lt, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';
import { HttpError, requireMember } from '../groups/service';
import { feedQuerySchema, reactBodySchema } from '@rivals/shared/zod/feed';
import type { R2Module } from '../../lib/r2';

interface FeedRouteOptions {
  db: Db;
  r2: R2Module;
}

const groupIdParam = z.object({ id: z.string().uuid() });
const eventIdParam = z.object({ id: z.string().uuid() });

const routes: FastifyPluginAsync<FeedRouteOptions> = async (app, opts) => {
  const { db, r2 } = opts;

  // GET /groups/:id/feed?cursor=<iso>&limit=20
  app.get('/groups/:id/feed', async (req) => {
    const auth = await app.requireAuth(req);
    const { id: groupId } = groupIdParam.parse(req.params);
    const { cursor, limit } = feedQuerySchema.parse(req.query);

    await requireMember(db, groupId, auth.id);

    const conditions = [eq(schema.feedEvents.groupId, groupId)];
    if (cursor) {
      conditions.push(lt(schema.feedEvents.createdAt, new Date(cursor)));
    }

    const rows = await db
      .select({
        id: schema.feedEvents.id,
        kind: schema.feedEvents.kind,
        payloadJson: schema.feedEvents.payloadJson,
        createdAt: schema.feedEvents.createdAt,
        actorUserId: schema.feedEvents.actorUserId,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.feedEvents)
      .innerJoin(schema.users, eq(schema.users.id, schema.feedEvents.actorUserId))
      .where(and(...conditions))
      .orderBy(desc(schema.feedEvents.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Aggregate reactions for events in this page
    const eventIds = page.map((r) => r.id);
    let reactionsMap: Record<string, { emoji: string; count: number; reactedByMe: boolean }[]> = {};

    if (eventIds.length > 0) {
      const reactionRows = await db
        .select({
          feedEventId: schema.feedReactions.feedEventId,
          emoji: schema.feedReactions.emoji,
          count: sql<number>`COUNT(*)::int`,
          reactedByMe: sql<boolean>`bool_or(${schema.feedReactions.userId} = ${auth.id})`,
        })
        .from(schema.feedReactions)
        .where(inArray(schema.feedReactions.feedEventId, eventIds))
        .groupBy(schema.feedReactions.feedEventId, schema.feedReactions.emoji);

      for (const row of reactionRows) {
        if (!reactionsMap[row.feedEventId]) reactionsMap[row.feedEventId] = [];
        reactionsMap[row.feedEventId]!.push({
          emoji: row.emoji,
          count: row.count,
          reactedByMe: row.reactedByMe,
        });
      }
    }

    // Build items, issuing presigned photo URLs for log events
    const items = await Promise.all(
      page.map(async (row) => {
        const payload = row.payloadJson as Record<string, unknown>;

        // Issue a fresh signed GET URL for log proof photos
        if (row.kind === 'log' && payload.objectKey) {
          const presigned = await r2.issuePresignedGet(payload.objectKey as string, 3600);
          payload.photoUrl = presigned.url;
        }

        return {
          id: row.id,
          kind: row.kind,
          actor: {
            userId: row.actorUserId,
            username: row.username,
            displayName: row.displayName,
            avatarUrl: row.avatarUrl,
          },
          payload,
          createdAt: row.createdAt.toISOString(),
          reactions: reactionsMap[row.id] ?? [],
        };
      }),
    );

    return {
      items,
      nextCursor: hasMore ? page[page.length - 1]!.createdAt.toISOString() : null,
    };
  });

  // POST /feed/:id/react — toggle emoji reaction
  app.post('/feed/:id/react', async (req) => {
    const auth = await app.requireAuth(req);
    const { id: eventId } = eventIdParam.parse(req.params);
    const { emoji } = reactBodySchema.parse(req.body);

    // Verify the event exists and user is a member of its group
    const [event] = await db
      .select({ groupId: schema.feedEvents.groupId })
      .from(schema.feedEvents)
      .where(eq(schema.feedEvents.id, eventId))
      .limit(1);

    if (!event) {
      throw new HttpError(404, 'EVENT_NOT_FOUND', 'Feed event not found');
    }

    await requireMember(db, event.groupId, auth.id);

    // Check if user already has a reaction on this event
    const [existing] = await db
      .select({ id: schema.feedReactions.id, emoji: schema.feedReactions.emoji })
      .from(schema.feedReactions)
      .where(
        and(
          eq(schema.feedReactions.feedEventId, eventId),
          eq(schema.feedReactions.userId, auth.id),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji — toggle off (delete)
        await db.delete(schema.feedReactions).where(eq(schema.feedReactions.id, existing.id));
      } else {
        // Different emoji — replace
        await db
          .update(schema.feedReactions)
          .set({ emoji })
          .where(eq(schema.feedReactions.id, existing.id));
      }
    } else {
      // No existing reaction — insert
      await db.insert(schema.feedReactions).values({
        feedEventId: eventId,
        userId: auth.id,
        emoji,
      });
    }

    // Return updated aggregated reactions
    const reactionRows = await db
      .select({
        emoji: schema.feedReactions.emoji,
        count: sql<number>`COUNT(*)::int`,
        reactedByMe: sql<boolean>`bool_or(${schema.feedReactions.userId} = ${auth.id})`,
      })
      .from(schema.feedReactions)
      .where(eq(schema.feedReactions.feedEventId, eventId))
      .groupBy(schema.feedReactions.emoji);

    return {
      reactions: reactionRows.map((r) => ({
        emoji: r.emoji,
        count: r.count,
        reactedByMe: r.reactedByMe,
      })),
    };
  });
};

export default routes;
