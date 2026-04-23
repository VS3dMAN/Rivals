import { pgTable, uuid, text, timestamp, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { groups } from './groups';
import { habits } from './habits';

export const habitLogs = pgTable(
  'habit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitId: uuid('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull(),
    clientTimestamp: timestamp('client_timestamp', { withTimezone: true }).notNull(),
    serverTimestamp: timestamp('server_timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
    photoUrl: text('photo_url').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    activeDailyUnique: uniqueIndex('habit_logs_active_daily_unique')
      .on(t.habitId, t.userId, t.logDate)
      .where(sql`${t.deletedAt} IS NULL`),
    userHabitDate: index('habit_logs_user_habit_date_idx').on(t.userId, t.habitId, t.logDate),
    groupDateDesc: index('habit_logs_group_date_idx').on(t.groupId, t.logDate),
  }),
);

export type HabitLog = typeof habitLogs.$inferSelect;
export type NewHabitLog = typeof habitLogs.$inferInsert;
