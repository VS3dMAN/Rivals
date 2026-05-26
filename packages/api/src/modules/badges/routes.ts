import type { FastifyPluginAsync } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';

interface BadgeRouteOptions {
  db: Db;
}

const routes: FastifyPluginAsync<BadgeRouteOptions> = async (app, opts) => {
  const { db } = opts;

  // GET /me/badges?groupId= — all badges with earned status
  app.get('/me/badges', async (req) => {
    const auth = await app.requireAuth(req);
    const { groupId } = z.object({ groupId: z.string().uuid().optional() }).parse(req.query);

    const allBadges = await db.select().from(schema.badges);

    const earnedConditions = [eq(schema.userBadges.userId, auth.id)];
    if (groupId) {
      earnedConditions.push(eq(schema.userBadges.groupId, groupId));
    }

    const earned = await db
      .select({
        badgeId: schema.userBadges.badgeId,
        groupId: schema.userBadges.groupId,
        awardedAt: schema.userBadges.awardedAt,
      })
      .from(schema.userBadges)
      .where(and(...earnedConditions));

    const earnedMap = new Map(earned.map((e) => [e.badgeId, e]));

    return {
      badges: allBadges.map((b) => {
        const e = earnedMap.get(b.id);
        return {
          id: b.id,
          code: b.code,
          title: b.title,
          description: b.description,
          earned: !!e,
          awardedAt: e?.awardedAt?.toISOString() ?? null,
        };
      }),
    };
  });
};

export default routes;
