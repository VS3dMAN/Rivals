import type { FastifyPluginAsync } from 'fastify';
import { and, eq, ilike, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';

interface UsersRouteOptions {
  db: Db;
}

const patchMeSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().optional(),
});

const searchQuerySchema = z.object({
  u: z
    .string()
    .min(1)
    .max(24)
    .regex(/^[a-z0-9_]+$/i),
});

const routes: FastifyPluginAsync<UsersRouteOptions> = async (app, opts) => {
  const { db } = opts;

  app.get('/me', async (req) => {
    const auth = await app.requireAuth(req);
    const [row] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
        timezone: schema.users.timezone,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, auth.id))
      .limit(1);

    if (!row) {
      const err = new Error('User not found') as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }
    return row;
  });

  app.patch('/me', async (req) => {
    const auth = await app.requireAuth(req);
    const patch = patchMeSchema.parse(req.body);
    if (Object.keys(patch).length === 0) return { ok: true };

    const [updated] = await db
      .update(schema.users)
      .set(patch)
      .where(eq(schema.users.id, auth.id))
      .returning({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
        timezone: schema.users.timezone,
      });
    return updated;
  });

  // GET /users/search?u=<prefix> — up to 10 matches, excludes current user
  app.get('/users/search', async (req) => {
    const auth = await app.requireAuth(req);
    const { u } = searchQuerySchema.parse(req.query);
    const rows = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.users)
      .where(and(ilike(schema.users.username, `${u}%`), ne(schema.users.id, auth.id)))
      .limit(10);
    return { users: rows };
  });

  void sql;
};

export default routes;
