import { z } from 'zod';

export const feedQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const reactBodySchema = z.object({
  emoji: z.string().min(1).max(8),
});

export const feedActorSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const aggregatedReactionSchema = z.object({
  emoji: z.string(),
  count: z.number(),
  reactedByMe: z.boolean(),
});

export const feedItemSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['log', 'streak_milestone', 'badge', 'join', 'leave', 'window_start', 'window_end']),
  actor: feedActorSchema,
  payload: z.record(z.unknown()),
  createdAt: z.string(),
  reactions: z.array(aggregatedReactionSchema),
});

export const feedResponseSchema = z.object({
  items: z.array(feedItemSchema),
  nextCursor: z.string().nullable(),
});

export type FeedItem = z.infer<typeof feedItemSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;
export type AggregatedReaction = z.infer<typeof aggregatedReactionSchema>;
