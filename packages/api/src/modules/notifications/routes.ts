import type { FastifyPluginAsync } from 'fastify';
import { and, eq, isNull, desc, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';

interface NotificationRouteOptions {
  db: Db;
}

const cursorQuery = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const idParam = z.object({ id: z.string().uuid() });

const routes: FastifyPluginAsync<NotificationRouteOptions> = async (app, opts) => {
  const { db } = opts;

  // GET /me/notifications — paginated list
  app.get('/me/notifications', async (req) => {
    const auth = await app.requireAuth(req);
    const { cursor, limit } = cursorQuery.parse(req.query);

    const conditions = [eq(schema.notifications.userId, auth.id)];
    if (cursor) {
      conditions.push(lt(schema.notifications.createdAt, new Date(cursor)));
    }

    const rows = await db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((r) => ({
        id: r.id,
        kind: r.kind,
        payload: r.payloadJson,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1]!.createdAt.toISOString() : null,
    };
  });

  // GET /me/notifications/unread-count
  app.get('/me/notifications/unread-count', async (req) => {
    const auth = await app.requireAuth(req);

    const [result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, auth.id),
          isNull(schema.notifications.readAt),
        ),
      );

    return { count: result?.count ?? 0 };
  });

  // PATCH /me/notifications/:id/read
  app.patch('/me/notifications/:id/read', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = idParam.parse(req.params);

    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.userId, auth.id),
        ),
      );

    return { ok: true };
  });

  // POST /me/notifications/read-all
  app.post('/me/notifications/read-all', async (req) => {
    const auth = await app.requireAuth(req);

    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, auth.id),
          isNull(schema.notifications.readAt),
        ),
      );

    return { ok: true };
  });
};

export default routes;
