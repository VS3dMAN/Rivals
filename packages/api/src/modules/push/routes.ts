import type { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { schema, type Db } from '../../db/client';
import { registerPushTokenSchema } from '@rivals/shared/zod/push';

interface PushRouteOptions {
  db: Db;
}

const routes: FastifyPluginAsync<PushRouteOptions> = async (app, opts) => {
  const { db } = opts;

  // POST /push/register — store or update a push token
  app.post('/push/register', async (req, reply) => {
    const auth = await app.requireAuth(req);
    const { platform, token } = registerPushTokenSchema.parse(req.body);

    // Upsert: if this user+token already exists, just update platform
    const [existing] = await db
      .select({ id: schema.pushTokens.id })
      .from(schema.pushTokens)
      .where(
        and(
          eq(schema.pushTokens.userId, auth.id),
          eq(schema.pushTokens.token, token),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(schema.pushTokens)
        .set({ platform })
        .where(eq(schema.pushTokens.id, existing.id));
    } else {
      await db.insert(schema.pushTokens).values({
        userId: auth.id,
        platform,
        token,
      });
    }

    return reply.status(200).send({ ok: true });
  });

  // DELETE /push/unregister — remove a push token (e.g. on logout)
  app.delete('/push/unregister', async (req) => {
    const auth = await app.requireAuth(req);
    const { token } = registerPushTokenSchema.pick({ token: true }).parse(req.body);

    await db
      .delete(schema.pushTokens)
      .where(
        and(
          eq(schema.pushTokens.userId, auth.id),
          eq(schema.pushTokens.token, token),
        ),
      );

    return { ok: true };
  });
};

export default routes;
