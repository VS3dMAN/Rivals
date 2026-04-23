import { pgTable, uuid, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { groups } from './groups';
import { leaderboardMode } from './enums';
import { challengeWindows } from './challengeWindows';

export const leaderboardScores = pgTable(
  'leaderboard_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: leaderboardMode('mode').notNull(),
    challengeWindowId: uuid('challenge_window_id').references(() => challengeWindows.id, {
      onDelete: 'cascade',
    }),
    score: integer('score').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('leaderboard_scores_unique').on(
      t.groupId,
      t.userId,
      t.mode,
      t.challengeWindowId,
    ),
    ranking: index('leaderboard_scores_ranking_idx').on(
      t.groupId,
      t.mode,
      t.challengeWindowId,
      t.score,
    ),
  }),
);

export type LeaderboardScore = typeof leaderboardScores.$inferSelect;
export type NewLeaderboardScore = typeof leaderboardScores.$inferInsert;
