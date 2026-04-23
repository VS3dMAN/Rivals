import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { leaderboardMode } from './enums';

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  adminUserId: uuid('admin_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  referenceTz: text('reference_tz').notNull(),
  leaderboardMode: leaderboardMode('leaderboard_mode').notNull().default('streak'),
  inviteCode: text('invite_code').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
