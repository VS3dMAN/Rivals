import type { FastifyPluginAsync } from 'fastify';
import { and, eq, isNull, sql, gte, count } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';
import { requireMember } from '../groups/service';

interface StatsRouteOptions {
  db: Db;
}

const statsQuery = z.object({
  groupId: z.string().uuid(),
});

const routes: FastifyPluginAsync<StatsRouteOptions> = async (app, opts) => {
  const { db } = opts;

  // GET /me/stats?groupId=<id>
  app.get('/me/stats', async (req) => {
    const auth = await app.requireAuth(req);
    const { groupId } = statsQuery.parse(req.query);

    await requireMember(db, groupId, auth.id);

    // Get streak data
    const [streak] = await db
      .select({
        currentStreak: schema.streaks.currentStreak,
        longestStreak: schema.streaks.longestStreak,
      })
      .from(schema.streaks)
      .where(
        and(
          eq(schema.streaks.userId, auth.id),
          eq(schema.streaks.groupId, groupId),
          isNull(schema.streaks.habitId),
        ),
      )
      .limit(1);

    // Total logs in this group
    const [totalResult] = await db
      .select({ cnt: count() })
      .from(schema.habitLogs)
      .where(
        and(
          eq(schema.habitLogs.userId, auth.id),
          eq(schema.habitLogs.groupId, groupId),
          isNull(schema.habitLogs.deletedAt),
        ),
      );

    // Logs in last 30 days for completion rate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentResult] = await db
      .select({ cnt: count() })
      .from(schema.habitLogs)
      .where(
        and(
          eq(schema.habitLogs.userId, auth.id),
          eq(schema.habitLogs.groupId, groupId),
          isNull(schema.habitLogs.deletedAt),
          gte(schema.habitLogs.logDate, thirtyDaysAgo.toISOString().slice(0, 10)),
        ),
      );

    // Calendar data: per-day completion for last 180 days
    const oneeightyDaysAgo = new Date();
    oneeightyDaysAgo.setDate(oneeightyDaysAgo.getDate() - 180);

    const dailyLogs = await db
      .select({
        date: schema.habitLogs.logDate,
        cnt: count(),
      })
      .from(schema.habitLogs)
      .where(
        and(
          eq(schema.habitLogs.userId, auth.id),
          eq(schema.habitLogs.groupId, groupId),
          isNull(schema.habitLogs.deletedAt),
          gte(schema.habitLogs.logDate, oneeightyDaysAgo.toISOString().slice(0, 10)),
        ),
      )
      .groupBy(schema.habitLogs.logDate);

    const completedDates = new Set(dailyLogs.map((d) => d.date));

    // Generate 180-day calendar array
    const calendar: { date: string; completed: boolean }[] = [];
    for (let i = 179; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      calendar.push({ date: dateStr, completed: completedDates.has(dateStr) });
    }

    // Active habits count for completion rate denominator
    const [habitsResult] = await db
      .select({ cnt: count() })
      .from(schema.habits)
      .where(
        and(
          eq(schema.habits.groupId, groupId),
          eq(schema.habits.isActive, true),
        ),
      );
    const activeHabits = Number(habitsResult?.cnt ?? 1);
    const completionRate30d = Math.round((Number(recentResult?.cnt ?? 0) / (30 * activeHabits)) * 100);

    return {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      totalLogs: Number(totalResult?.cnt ?? 0),
      completionRate30d: Math.min(completionRate30d, 100),
      calendar,
    };
  });
};

export default routes;
