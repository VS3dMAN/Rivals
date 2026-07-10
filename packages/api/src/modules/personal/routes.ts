import type { FastifyPluginAsync } from 'fastify';
import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';
import {
  createPersonalHabitSchema,
  updatePersonalHabitSchema,
} from '@rivals/shared/zod/personal';
import { HttpError } from '../groups/service';
import { addDays, todayInTz } from '../../lib/tz';
import { computePersonalStreak } from './streak';

interface PersonalRouteOptions {
  db: Db;
}

const MAX_ACTIVE_PERSONAL_HABITS = 50;

const habitIdParam = z.object({ id: z.string().uuid() });

async function userToday(db: Db, userId: string): Promise<string> {
  const [user] = await db
    .select({ timezone: schema.users.timezone })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return todayInTz(user?.timezone ?? 'UTC');
}

async function requireOwnedHabit(db: Db, habitId: string, userId: string) {
  const [habit] = await db
    .select()
    .from(schema.personalHabits)
    .where(
      and(
        eq(schema.personalHabits.id, habitId),
        eq(schema.personalHabits.userId, userId),
      ),
    )
    .limit(1);
  // 404 (not 403) so other users' habit ids don't leak existence
  if (!habit) throw new HttpError(404, 'HABIT_NOT_FOUND', 'Personal habit not found');
  return habit;
}

const routes: FastifyPluginAsync<PersonalRouteOptions> = async (app, opts) => {
  const { db } = opts;

  // GET /me/habits — all personal habits with today status + streaks
  app.get('/me/habits', async (req) => {
    const auth = await app.requireAuth(req);
    const today = await userToday(db, auth.id);

    const habits = await db
      .select()
      .from(schema.personalHabits)
      .where(eq(schema.personalHabits.userId, auth.id))
      .orderBy(schema.personalHabits.createdAt);

    if (habits.length === 0) return { habits: [], today };

    const logs = await db
      .select({
        personalHabitId: schema.personalHabitLogs.personalHabitId,
        logDate: schema.personalHabitLogs.logDate,
      })
      .from(schema.personalHabitLogs)
      .where(eq(schema.personalHabitLogs.userId, auth.id));

    const datesByHabit = new Map<string, string[]>();
    for (const log of logs) {
      const dates = datesByHabit.get(log.personalHabitId) ?? [];
      dates.push(String(log.logDate));
      datesByHabit.set(log.personalHabitId, dates);
    }

    const out = habits.map((h) => {
      const dates = datesByHabit.get(h.id) ?? [];
      const streak = computePersonalStreak(dates, today, h.graceDays);
      const completedToday = dates.includes(today);
      let inGrace = false;
      if (!completedToday && h.graceDays > 0 && streak.lastCompletedDate) {
        const floor = addDays(today, -(h.graceDays + 1));
        inGrace = streak.lastCompletedDate >= floor && streak.lastCompletedDate < today;
      }
      return {
        id: h.id,
        name: h.name,
        description: h.description,
        graceDays: h.graceDays,
        isActive: h.isActive,
        completedToday,
        inGrace,
        currentStreak: streak.current,
        longestStreak: streak.longest,
      };
    });

    return { habits: out, today };
  });

  // POST /me/habits — create a personal habit
  app.post('/me/habits', async (req, reply) => {
    const auth = await app.requireAuth(req);
    const body = createPersonalHabitSchema.parse(req.body);

    const [activeCount] = await db
      .select({ cnt: count() })
      .from(schema.personalHabits)
      .where(
        and(
          eq(schema.personalHabits.userId, auth.id),
          eq(schema.personalHabits.isActive, true),
        ),
      );
    if (Number(activeCount?.cnt ?? 0) >= MAX_ACTIVE_PERSONAL_HABITS) {
      throw new HttpError(
        400,
        'TOO_MANY_HABITS',
        `You can have at most ${MAX_ACTIVE_PERSONAL_HABITS} active personal habits`,
      );
    }

    const [habit] = await db
      .insert(schema.personalHabits)
      .values({
        userId: auth.id,
        name: body.name,
        description: body.description ?? null,
        graceDays: body.graceDays ?? 0,
      })
      .returning();
    return reply.status(201).send(habit);
  });

  // PATCH /me/habits/:id — edit / pause / resume
  app.patch('/me/habits/:id', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = habitIdParam.parse(req.params);
    const patch = updatePersonalHabitSchema.parse(req.body);
    const habit = await requireOwnedHabit(db, id, auth.id);

    if (Object.keys(patch).length === 0) return habit;

    const [updated] = await db
      .update(schema.personalHabits)
      .set(patch)
      .where(eq(schema.personalHabits.id, id))
      .returning();
    return updated;
  });

  // DELETE /me/habits/:id — permanent delete (logs cascade)
  app.delete('/me/habits/:id', async (req, reply) => {
    const auth = await app.requireAuth(req);
    const { id } = habitIdParam.parse(req.params);
    await requireOwnedHabit(db, id, auth.id);

    await db.delete(schema.personalHabits).where(eq(schema.personalHabits.id, id));
    return reply.status(204).send();
  });

  // POST /me/habits/:id/complete — log today (idempotent)
  app.post('/me/habits/:id/complete', async (req, reply) => {
    const auth = await app.requireAuth(req);
    const { id } = habitIdParam.parse(req.params);
    const habit = await requireOwnedHabit(db, id, auth.id);
    if (!habit.isActive) {
      throw new HttpError(400, 'HABIT_PAUSED', 'Resume this habit before logging it');
    }

    const today = await userToday(db, auth.id);
    const inserted = await db
      .insert(schema.personalHabitLogs)
      .values({ personalHabitId: id, userId: auth.id, logDate: today })
      .onConflictDoNothing()
      .returning({ id: schema.personalHabitLogs.id });

    const dates = await habitLogDates(db, id);
    const streak = computePersonalStreak(dates, today, habit.graceDays);
    return reply.status(inserted.length > 0 ? 201 : 200).send({
      completedToday: true,
      logDate: today,
      currentStreak: streak.current,
      longestStreak: streak.longest,
    });
  });

  // DELETE /me/habits/:id/complete — undo today's completion
  app.delete('/me/habits/:id/complete', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = habitIdParam.parse(req.params);
    const habit = await requireOwnedHabit(db, id, auth.id);

    const today = await userToday(db, auth.id);
    await db
      .delete(schema.personalHabitLogs)
      .where(
        and(
          eq(schema.personalHabitLogs.personalHabitId, id),
          eq(schema.personalHabitLogs.logDate, today),
        ),
      );

    const dates = await habitLogDates(db, id);
    const streak = computePersonalStreak(dates, today, habit.graceDays);
    return {
      completedToday: false,
      logDate: today,
      currentStreak: streak.current,
      longestStreak: streak.longest,
    };
  });

  // GET /me/habits/:id/stats — streaks, totals, 180-day calendar
  app.get('/me/habits/:id/stats', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = habitIdParam.parse(req.params);
    const habit = await requireOwnedHabit(db, id, auth.id);

    const today = await userToday(db, auth.id);
    const dates = await habitLogDates(db, id);
    const streak = computePersonalStreak(dates, today, habit.graceDays);

    const dateSet = new Set(dates);
    const thirtyFloor = addDays(today, -29);
    const recentCount = dates.filter((d) => d >= thirtyFloor && d <= today).length;

    const calendar: { date: string; completed: boolean }[] = [];
    for (let i = 179; i >= 0; i--) {
      const date = addDays(today, -i);
      calendar.push({ date, completed: dateSet.has(date) });
    }

    return {
      currentStreak: streak.current,
      longestStreak: streak.longest,
      lastCompletedDate: streak.lastCompletedDate,
      totalLogs: dates.length,
      completionRate30d: Math.min(Math.round((recentCount / 30) * 100), 100),
      calendar,
    };
  });
};

async function habitLogDates(db: Db, habitId: string): Promise<string[]> {
  const rows = await db
    .select({ logDate: schema.personalHabitLogs.logDate })
    .from(schema.personalHabitLogs)
    .where(eq(schema.personalHabitLogs.personalHabitId, habitId));
  return rows.map((r) => String(r.logDate));
}

export default routes;
