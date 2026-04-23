import { pgTable, uuid, text, date, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { groups } from './groups';
import { users } from './users';
import { challengeStatus } from './enums';

export const challengeWindows = pgTable(
  'challenge_windows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: challengeStatus('status').notNull().default('upcoming'),
    winnerUserId: uuid('winner_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    endAfterStart: check(
      'challenge_windows_end_after_start',
      sql`${t.endDate} >= ${t.startDate} + INTERVAL '2 days'`,
    ),
  }),
);

export type ChallengeWindow = typeof challengeWindows.$inferSelect;
export type NewChallengeWindow = typeof challengeWindows.$inferInsert;
