import { pgTable, uuid, integer, date, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { groups } from './groups';
import { habits } from './habits';

export const streaks = pgTable(
  'streaks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    habitId: uuid('habit_id').references(() => habits.id, { onDelete: 'cascade' }),
    currentStreak: integer('current_streak').notNull().default(0),
    longestStreak: integer('longest_streak').notNull().default(0),
    lastCompletedDate: date('last_completed_date'),
  },
  (t) => ({
    userGroupHabitUnique: uniqueIndex('streaks_user_group_habit_unique').on(
      t.userId,
      t.groupId,
      t.habitId,
    ),
  }),
);

export type Streak = typeof streaks.$inferSelect;
export type NewStreak = typeof streaks.$inferInsert;
