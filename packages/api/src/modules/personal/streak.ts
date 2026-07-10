/**
 * Pure streak computation for personal habits.
 *
 * Unlike group streaks (modules/leaderboard/streak.ts) there is no stored
 * `streaks` row for personal habits — history is small (one row per day per
 * habit), so both current and longest are derived from the log dates on read.
 *
 * Semantics match what group members actually see (streaks table + the
 * rivals-streak-grace-reset cron): a streak stays alive while
 * `lastCompleted >= today - (graceDays + 1)` — i.e. today being not-yet-logged
 * is "pending", not "missed". Within a run, up to `graceDays` consecutive
 * missed days are tolerated; missed days never add to the streak length.
 */
import { addDays } from '../../lib/tz';

export interface PersonalStreakResult {
  current: number;
  longest: number;
  lastCompletedDate: string | null;
}

/**
 * @param logDates log dates (YYYY-MM-DD), any order, may be empty
 * @param today    "today" in the user's timezone (YYYY-MM-DD)
 */
export function computePersonalStreak(
  logDates: readonly string[],
  today: string,
  graceDays: number,
): PersonalStreakResult {
  if (logDates.length === 0) {
    return { current: 0, longest: 0, lastCompletedDate: null };
  }

  const dates = new Set(logDates);
  const sorted = [...dates].sort();
  const earliest = sorted[0]!;
  const lastCompletedDate = sorted[sorted.length - 1]!;

  // Longest: forward walk from the earliest log to today. A gap longer than
  // graceDays ends the run; only logged days count toward its length.
  let longest = 0;
  let run = 0;
  let missed = 0;
  for (let day = earliest; day <= today; day = addDays(day, 1)) {
    if (dates.has(day)) {
      run++;
      missed = 0;
    } else {
      missed++;
      if (missed > graceDays) {
        longest = Math.max(longest, run);
        run = 0;
      }
    }
  }
  longest = Math.max(longest, run);

  // Current: dead if the most recent log is already out of reach even after
  // logging today (the cron-reset rule); otherwise count back from that log
  // with the normal in-run grace tolerance.
  const trailingGap =
    lastCompletedDate >= today ? 0 : dateDiffInDays(lastCompletedDate, today);
  if (trailingGap > graceDays + 1) {
    return { current: 0, longest, lastCompletedDate };
  }

  let current = 0;
  missed = 0;
  for (let day = lastCompletedDate; day >= earliest; day = addDays(day, -1)) {
    if (dates.has(day)) {
      current++;
      missed = 0;
    } else {
      missed++;
      if (missed > graceDays) break;
    }
  }

  return { current, longest: Math.max(longest, current), lastCompletedDate };
}

/** Whole days from `a` to `b` (both YYYY-MM-DD, b >= a). */
function dateDiffInDays(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
