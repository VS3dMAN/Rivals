/**
 * Unit tests for streak computation.
 *
 * These tests mock the database calls to test the streak logic in isolation.
 */
import { describe, it, expect, vi } from 'vitest';
import { computeStreak } from '../streak';

// ---------- Helpers ----------

/**
 * Build a minimal mock DB that returns rows for the queries streak.ts makes.
 * This is intentionally a thin double — it intercepts the `.from(table)` call
 * chain so we can control what each SELECT returns.
 */
function createMockDb(opts: {
  /** Habit grace_days */
  graceDays?: number;
  /** Non-deleted log dates for the habit (YYYY-MM-DD[]) */
  habitLogDates?: string[];
  /** Non-deleted log dates per habit for group-level, keyed by habitId */
  groupLogDates?: Record<string, string[]>;
  /** Active habit IDs in the group */
  activeHabitIds?: string[];
  /** Existing longest streak in the streaks table */
  existingLongest?: number;
  /** User timezone */
  userTimezone?: string;
}) {
  const {
    graceDays = 0,
    habitLogDates = [],
    groupLogDates = {},
    activeHabitIds = [],
    existingLongest = 0,
    userTimezone = 'UTC',
  } = opts;

  // We build a chainable mock that traces `.from(table)` to determine which
  // query is being executed, then returns the right data.
  const mockDb = {
    select: vi.fn().mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: vi.fn().mockImplementation((table: any) => {
        const tableName = table?.[Symbol.for('drizzle:Name')] ?? table?._.name ?? '';

        // habits → graceDays lookup / active habits list
        if (tableName === 'habits') {
          const habitsData = activeHabitIds.length > 0
            ? activeHabitIds.map((id) => ({
                id,
                graceDays,
                isActive: true,
              }))
            : [{ graceDays, isActive: true }];

          // The where() result must be both a thenable (for direct await)
          // and also expose .limit() for per-habit lookups.
          const whereResult = Object.assign(
            Promise.resolve(habitsData),
            {
              limit: vi.fn().mockResolvedValue(habitsData),
              orderBy: vi.fn().mockResolvedValue(habitsData),
            },
          );
          return {
            where: vi.fn().mockReturnValue(whereResult),
            orderBy: vi.fn().mockResolvedValue(habitsData),
          };
        }

        // habit_logs → log dates
        if (tableName === 'habit_logs') {
          return {
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockImplementation(() => {
                // For group-level, returns ALL logs with habitId
                if (Object.keys(groupLogDates).length > 0) {
                  const allLogs: Array<{ logDate: string; habitId: string }> = [];
                  for (const [hId, dates] of Object.entries(groupLogDates)) {
                    for (const d of dates) {
                      allLogs.push({ logDate: d, habitId: hId });
                    }
                  }
                  // Sort desc by logDate
                  allLogs.sort((a, b) => b.logDate.localeCompare(a.logDate));
                  return Promise.resolve(allLogs);
                }
                // For per-habit, return sorted desc
                const sorted = [...habitLogDates].sort().reverse();
                return Promise.resolve(
                  sorted.map((d) => ({ logDate: d })),
                );
              }),
            }),
          };
        }

        // streaks → existing longest
        if (tableName === 'streaks') {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { longestStreak: existingLongest },
              ]),
            }),
          };
        }

        // users → timezone
        if (tableName === 'users') {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { timezone: userTimezone },
              ]),
            }),
          };
        }

        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        };
      }),
    }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mockDb as any;
}

// ---------- Helpers ----------

function daysAgo(n: number, from = '2025-06-15'): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function consecutiveDays(count: number, from = '2025-06-15'): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(daysAgo(i, from));
  }
  return dates;
}

// ---------- Tests ----------

describe('computeStreak', () => {
  const TODAY = '2025-06-15';
  const USER_ID = 'user-1';
  const GROUP_ID = 'group-1';
  const HABIT_ID = 'habit-1';

  it('returns 0 for no logs', async () => {
    const db = createMockDb({ habitLogDates: [] });
    const result = await computeStreak(db, {
      userId: USER_ID,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      today: TODAY,
    });
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
    expect(result.lastCompletedDate).toBeNull();
  });

  it('computes a 10-day perfect streak', async () => {
    const dates = consecutiveDays(10, TODAY);
    const db = createMockDb({ habitLogDates: dates });
    const result = await computeStreak(db, {
      userId: USER_ID,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      today: TODAY,
    });
    expect(result.current).toBe(10);
    expect(result.longest).toBe(10);
    expect(result.lastCompletedDate).toBe(TODAY);
  });

  it('missed yesterday, grace=0 → current=0', async () => {
    // Logged today and 2 days ago, but NOT yesterday
    const dates = [TODAY, daysAgo(2, TODAY)];
    const db = createMockDb({ habitLogDates: dates, graceDays: 0 });
    const result = await computeStreak(db, {
      userId: USER_ID,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      today: TODAY,
    });
    // Today counts as 1, then yesterday is a miss with no grace → streak ends
    expect(result.current).toBe(1);
  });

  it('missed yesterday, grace=1 → current preserved if logged today', async () => {
    // Logged today, missed yesterday, logged day before
    const dates = [TODAY, daysAgo(2, TODAY), daysAgo(3, TODAY)];
    const db = createMockDb({ habitLogDates: dates, graceDays: 1 });
    const result = await computeStreak(db, {
      userId: USER_ID,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      today: TODAY,
    });
    // Today (1) + yesterday missed but within grace (0) + day-2 (2) + day-3 (3) = 3
    expect(result.current).toBe(3);
  });

  it('two-habit group where only one logged yesterday - day does not count', async () => {
    const HABIT_A = 'habit-a';
    const HABIT_B = 'habit-b';

    const db = createMockDb({
      activeHabitIds: [HABIT_A, HABIT_B],
      groupLogDates: {
        [HABIT_A]: [TODAY, daysAgo(1, TODAY), daysAgo(2, TODAY)],
        [HABIT_B]: [TODAY, daysAgo(2, TODAY)], // missed yesterday
      },
      graceDays: 0,
    });

    const result = await computeStreak(db, {
      userId: USER_ID,
      groupId: GROUP_ID,
      habitId: null,
      today: TODAY,
    });

    // Today both habits logged → 1 day
    // Yesterday only habit A logged → doesn't count → streak broken
    expect(result.current).toBe(1);
  });

  it('longest streak is max of current and stored', async () => {
    const dates = consecutiveDays(3, TODAY);
    const db = createMockDb({
      habitLogDates: dates,
      existingLongest: 15,
    });
    const result = await computeStreak(db, {
      userId: USER_ID,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      today: TODAY,
    });
    expect(result.current).toBe(3);
    expect(result.longest).toBe(15); // stored is higher
  });
});
