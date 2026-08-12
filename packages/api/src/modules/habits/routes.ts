import type { FastifyPluginAsync } from 'fastify';
import { and, eq, gte, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';
import {
  createHabitSchema,
  updateHabitSchema,
} from '@rivals/shared/zod/habits';
import { HttpError, requireAdmin, requireMember } from '../groups/service';
import { addDays, todayInTz } from '../../lib/tz';

interface HabitsRouteOptions {
  db: Db;
}

const groupIdParam = z.object({ id: z.string().uuid() });
const habitIdParam = z.object({ id: z.string().uuid() });

const routes: FastifyPluginAsync<HabitsRouteOptions> = async (app, opts) => {
  const { db } = opts;

  // POST /groups/:id/habits (admin)
  app.post('/groups/:id/habits', async (req, reply) => {
    const auth = await app.requireAuth(req);
    const { id: groupId } = groupIdParam.parse(req.params);
    const body = createHabitSchema.parse(req.body);
    await requireAdmin(db, groupId, auth.id);

    const [habit] = await db
      .insert(schema.habits)
      .values({
        groupId,
        name: body.name,
        description: body.description ?? null,
        graceDays: body.graceDays ?? 0,
      })
      .returning();
    return reply.status(201).send(habit);
  });

  // PATCH /habits/:id (admin)
  app.patch('/habits/:id', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = habitIdParam.parse(req.params);
    const patch = updateHabitSchema.parse(req.body);

    const [habit] = await db
      .select({ id: schema.habits.id, groupId: schema.habits.groupId })
      .from(schema.habits)
      .where(eq(schema.habits.id, id))
      .limit(1);
    if (!habit) throw new HttpError(404, 'HABIT_NOT_FOUND', 'Habit not found');

    await requireAdmin(db, habit.groupId, auth.id);

    if (Object.keys(patch).length === 0) {
      const [row] = await db
        .select()
        .from(schema.habits)
        .where(eq(schema.habits.id, id))
        .limit(1);
      return row;
    }

    const [updated] = await db
      .update(schema.habits)
      .set(patch)
      .where(eq(schema.habits.id, id))
      .returning();
    return updated;
  });

  // GET /groups/:id/habits/today — today's habit cards for the current user
  app.get('/groups/:id/habits/today', async (req) => {
    const auth = await app.requireAuth(req);
    const { id: groupId } = groupIdParam.parse(req.params);
    await requireMember(db, groupId, auth.id);

    // Fetch user's timezone (fallback to group's reference_tz).
    const [user] = await db
      .select({ timezone: schema.users.timezone })
      .from(schema.users)
      .where(eq(schema.users.id, auth.id))
      .limit(1);
    const [group] = await db
      .select({ referenceTz: schema.groups.referenceTz })
      .from(schema.groups)
      .where(eq(schema.groups.id, groupId))
      .limit(1);

    const tz = user?.timezone || group?.referenceTz || 'UTC';
    const today = todayInTz(tz);

    // Active habits in this group.
    const habits = await db
      .select()
      .from(schema.habits)
      .where(and(eq(schema.habits.groupId, groupId), eq(schema.habits.isActive, true)));

    if (habits.length === 0) return { habits: [], today };

    const habitIds = habits.map((h) => h.id);

    // Today's logs for this user
    const todayLogs = await db
      .select({
        id: schema.habitLogs.id,
        habitId: schema.habitLogs.habitId,
      })
      .from(schema.habitLogs)
      .where(
        and(
          eq(schema.habitLogs.userId, auth.id),
          eq(schema.habitLogs.logDate, today),
          isNull(schema.habitLogs.deletedAt),
          inArray(schema.habitLogs.habitId, habitIds),
        ),
      );
    const todayLogIdByHabit = new Map<string, string>();
    for (const r of todayLogs) todayLogIdByHabit.set(r.habitId, r.id);
    const completedIds = new Set(todayLogs.map((r) => r.habitId));

    // For grace: find latest completion per habit in the last (graceDays+1) days
    // (covers up to 2 days). We just need the max graceDays across habits.
    const maxGrace = Math.max(...habits.map((h) => h.graceDays));
    const graceFloor = addDays(today, -(maxGrace + 1));
    const recentLogs = await db
      .select({
        habitId: schema.habitLogs.habitId,
        logDate: schema.habitLogs.logDate,
      })
      .from(schema.habitLogs)
      .where(
        and(
          eq(schema.habitLogs.userId, auth.id),
          isNull(schema.habitLogs.deletedAt),
          gte(schema.habitLogs.logDate, graceFloor),
          inArray(schema.habitLogs.habitId, habitIds),
        ),
      );
    const lastByHabit = new Map<string, string>();
    for (const r of recentLogs) {
      const prev = lastByHabit.get(r.habitId);
      if (!prev || r.logDate > prev) lastByHabit.set(r.habitId, r.logDate as string);
    }

    const out = habits.map((h) => {
      const completedToday = completedIds.has(h.id);
      let inGrace = false;
      if (!completedToday && h.graceDays > 0) {
        const last = lastByHabit.get(h.id);
        if (last) {
          const floor = addDays(today, -(h.graceDays + 1));
          inGrace = last >= floor && last < today;
        }
      }
      return {
        id: h.id,
        name: h.name,
        description: h.description,
        graceDays: h.graceDays,
        completedToday,
        inGrace,
        todayLogId: todayLogIdByHabit.get(h.id) ?? null,
      };
    });

    return { habits: out, today };
  });
};

export default routes;
