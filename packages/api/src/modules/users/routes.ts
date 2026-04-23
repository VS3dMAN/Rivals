import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { schema, type Db } from '../../db/client';

interface UsersRouteOptions {
  db: Db;
}

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
};

export default routes;
