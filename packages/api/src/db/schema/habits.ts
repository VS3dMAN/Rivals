import { pgTable, uuid, text, timestamp, boolean, smallint, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { groups } from './groups';

export const habits = pgTable(
  'habits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    graceDays: smallint('grace_days').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    graceRange: check(
      'habits_grace_range',
      sql`${t.graceDays} >= 0 AND ${t.graceDays} <= 2`,
    ),
    nameLen: check(
      'habits_name_len',
      sql`char_length(${t.name}) BETWEEN 1 AND 60`,
    ),
  }),
);

export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
