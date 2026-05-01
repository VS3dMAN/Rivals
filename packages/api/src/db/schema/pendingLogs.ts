import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { groups } from './groups';
import { habits } from './habits';

export const pendingLogs = pgTable(
  'pending_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    habitId: uuid('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('pending_logs_user_idx').on(t.userId),
    expiresIdx: index('pending_logs_expires_idx').on(t.expiresAt),
  }),
);

export type PendingLog = typeof pendingLogs.$inferSelect;
export type NewPendingLog = typeof pendingLogs.$inferInsert;
