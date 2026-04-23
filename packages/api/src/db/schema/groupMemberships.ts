import { pgTable, uuid, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { groups } from './groups';
import { membershipRole } from './enums';

export const groupMemberships = pgTable(
  'group_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (t) => ({
    activeMembershipUnique: uniqueIndex('group_memberships_active_unique')
      .on(t.groupId, t.userId)
      .where(sql`${t.leftAt} IS NULL`),
    userIdx: uniqueIndex('group_memberships_user_group_idx').on(t.userId, t.groupId),
  }),
);

export type GroupMembership = typeof groupMemberships.$inferSelect;
export type NewGroupMembership = typeof groupMemberships.$inferInsert;
