import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
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
};

export default routes;
