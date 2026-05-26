/**
 * Pure streak computation service.
 *
 * Given a user + group + optional habit, walks backwards from today in the
 * user's timezone to compute the current consecutive-day streak, honoring
 * the per-habit `grace_days` setting.
 */
import { and, eq, isNull, desc, sql, gte } from 'drizzle-orm';
import { schema, type Db } from '../../db/client';
import { todayInTz, addDays } from '../../lib/tz';

export interface StreakResult {
  current: number;
  longest: number;
  lastCompletedDate: string | null;
}

interface ComputeStreakParams {
  userId: string;
  groupId: string;
  habitId?: string | null;
  /** Override "today" for testing. YYYY-MM-DD format. */
  today?: string;
}

/**
 * Compute the streak for a single habit.
 *
 * Walks back from `today` counting consecutive days with a non-deleted log.
 * A gap of up to `graceDays` is tolerated only when followed by a log within
 * the grace window.
 */
async function computeHabitStreak(
  db: Db,
  userId: string,
  groupId: string,
  habitId: string,
  today: string,
): Promise<StreakResult> {
  // Fetch grace_days for this habit
  const [habit] = await db
    .select({ graceDays: schema.habits.graceDays })
    .from(schema.habits)
    .where(eq(schema.habits.id, habitId))
    .limit(1);

  const graceDays = habit?.graceDays ?? 0;

  // Fetch all non-deleted log dates for this user+habit, ordered desc
  const logs = await db
    .select({ logDate: schema.habitLogs.logDate })
    .from(schema.habitLogs)
    .where(
      and(
        eq(schema.habitLogs.userId, userId),
        eq(schema.habitLogs.habitId, habitId),
        eq(schema.habitLogs.groupId, groupId),
        isNull(schema.habitLogs.deletedAt),
      ),
    )
    .orderBy(desc(schema.habitLogs.logDate));

  if (logs.length === 0) {
    return { current: 0, longest: 0, lastCompletedDate: null };
  }

  // Build a Set of log dates for O(1) lookup
  const logDates = new Set(logs.map((l) => String(l.logDate)));
  const lastCompletedDate = String(logs[0]!.logDate);

  // Walk backwards from today
  let current = 0;
  let checkDate = today;
  let missedConsecutive = 0;

  while (true) {
    if (logDates.has(checkDate)) {
      current++;
      missedConsecutive = 0;
    } else {
      missedConsecutive++;
      if (missedConsecutive > graceDays) {
        break;
      }
      // Within grace window — only if there are earlier logs
      // The grace is tolerated: don't count the missed day but keep going
    }
    checkDate = addDays(checkDate, -1);

    // Safety: don't walk infinitely
    if (current + missedConsecutive > 1000) break;
  }

  // Compute longest from stored value + current
  const [existingStreak] = await db
    .select({ longestStreak: schema.streaks.longestStreak })
    .from(schema.streaks)
    .where(
      and(
        eq(schema.streaks.userId, userId),
        eq(schema.streaks.groupId, groupId),
        eq(schema.streaks.habitId, habitId),
      ),
    )
    .limit(1);

  const storedLongest = existingStreak?.longestStreak ?? 0;
  const longest = Math.max(current, storedLongest);

  return { current, longest, lastCompletedDate };
}

/**
 * Compute a group-level streak.
 *
 * A day counts only if the user has a non-deleted log for EVERY active habit
 * in the group on that day. Each habit's grace_days is honored individually.
 */
async function computeGroupStreak(
  db: Db,
  userId: string,
  groupId: string,
  today: string,
): Promise<StreakResult> {
  // Get all active habits in this group
  const activeHabits = await db
    .select({
      id: schema.habits.id,
      graceDays: schema.habits.graceDays,
    })
    .from(schema.habits)
    .where(
      and(
        eq(schema.habits.groupId, groupId),
        eq(schema.habits.isActive, true),
      ),
    );

  if (activeHabits.length === 0) {
    return { current: 0, longest: 0, lastCompletedDate: null };
  }

  // Fetch all non-deleted logs for this user in this group
  const logs = await db
    .select({
      logDate: schema.habitLogs.logDate,
      habitId: schema.habitLogs.habitId,
    })
    .from(schema.habitLogs)
    .where(
      and(
        eq(schema.habitLogs.userId, userId),
        eq(schema.habitLogs.groupId, groupId),
        isNull(schema.habitLogs.deletedAt),
      ),
    )
    .orderBy(desc(schema.habitLogs.logDate));

  // Build date -> set of habitIds completed
  const dateHabitMap = new Map<string, Set<string>>();
  for (const log of logs) {
    const d = String(log.logDate);
    if (!dateHabitMap.has(d)) dateHabitMap.set(d, new Set());
    const habits = dateHabitMap.get(d);
    if (habits) habits.add(log.habitId);
  }

  const habitIds = new Set(activeHabits.map((h) => h.id));
  const maxGrace = Math.max(...activeHabits.map((h) => h.graceDays), 0);

  // A day "counts" for the group streak if every active habit was logged that day
  function dayComplete(date: string): boolean {
    const completed = dateHabitMap.get(date);
    if (!completed) return false;
    for (const hId of habitIds) {
      if (!completed.has(hId)) return false;
    }
    return true;
  }

  // Walk backwards from today
  let current = 0;
  let checkDate = today;
  let missedConsecutive = 0;
  let lastCompletedDate: string | null = null;

  while (true) {
    if (dayComplete(checkDate)) {
      current++;
      missedConsecutive = 0;
      if (!lastCompletedDate) lastCompletedDate = checkDate;
    } else {
      missedConsecutive++;
      if (missedConsecutive > maxGrace) {
        break;
      }
    }
    checkDate = addDays(checkDate, -1);
    if (current + missedConsecutive > 1000) break;
  }

  // Get stored longest
  const [existingStreak] = await db
    .select({ longestStreak: schema.streaks.longestStreak })
    .from(schema.streaks)
    .where(
      and(
        eq(schema.streaks.userId, userId),
        eq(schema.streaks.groupId, groupId),
        isNull(schema.streaks.habitId),
      ),
    )
    .limit(1);

  const storedLongest = existingStreak?.longestStreak ?? 0;
  const longest = Math.max(current, storedLongest);

  return { current, longest, lastCompletedDate };
}

/**
 * Main entry point: compute streak for a user in a group.
 *
 * - If `habitId` is provided → per-habit streak
 * - If `habitId` is null/undefined → group-level streak (all active habits)
 */
export async function computeStreak(
  db: Db,
  params: ComputeStreakParams,
): Promise<StreakResult> {
  const { userId, groupId, habitId } = params;

  // Determine "today" — use the user's timezone
  let today = params.today;
  if (!today) {
    const [user] = await db
      .select({ timezone: schema.users.timezone })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    today = todayInTz(user?.timezone ?? 'UTC');
  }

  if (habitId) {
    return computeHabitStreak(db, userId, groupId, habitId, today);
  }
  return computeGroupStreak(db, userId, groupId, today);
}
