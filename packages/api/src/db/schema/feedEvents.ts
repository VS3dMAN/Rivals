import { pgTable, uuid, timestamp, jsonb, index, uniqueIndex, text, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { groups } from './groups';
import { feedEventKind } from './enums';

export const feedEvents = pgTable(
  'feed_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: feedEventKind('kind').notNull(),
    payloadJson: jsonb('payload_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    groupCreatedDesc: index('feed_events_group_created_idx').on(t.groupId, t.createdAt),
  }),
);

export type FeedEvent = typeof feedEvents.$inferSelect;
export type NewFeedEvent = typeof feedEvents.$inferInsert;

export const feedReactions = pgTable(
  'feed_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    feedEventId: uuid('feed_event_id')
      .notNull()
      .references(() => feedEvents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    oneReactionPerUser: uniqueIndex('feed_reactions_one_per_user').on(t.feedEventId, t.userId),
    emojiLen: check('feed_reactions_emoji_len', sql`char_length(${t.emoji}) BETWEEN 1 AND 8`),
  }),
);

export type FeedReaction = typeof feedReactions.$inferSelect;
export type NewFeedReaction = typeof feedReactions.$inferInsert;
