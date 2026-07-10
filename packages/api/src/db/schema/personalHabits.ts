import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  smallint,
  date,
  check,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const personalHabits = pgTable(
  'personal_habits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    graceDays: smallint('grace_days').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    graceRange: check(
      'personal_habits_grace_range',
      sql`${t.graceDays} >= 0 AND ${t.graceDays} <= 2`,
    ),
    nameLen: check(
      'personal_habits_name_len',
      sql`char_length(${t.name}) BETWEEN 1 AND 60`,
    ),
    userIdx: index('personal_habits_user_idx').on(t.userId),
  }),
);

export const personalHabitLogs = pgTable(
  'personal_habit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personalHabitId: uuid('personal_habit_id')
      .notNull()
      .references(() => personalHabits.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dailyUnique: uniqueIndex('personal_habit_logs_daily_unique').on(
      t.personalHabitId,
      t.logDate,
    ),
    userDateIdx: index('personal_habit_logs_user_date_idx').on(t.userId, t.logDate),
  }),
);

export type PersonalHabit = typeof personalHabits.$inferSelect;
export type NewPersonalHabit = typeof personalHabits.$inferInsert;
export type PersonalHabitLog = typeof personalHabitLogs.$inferSelect;
export type NewPersonalHabitLog = typeof personalHabitLogs.$inferInsert;
