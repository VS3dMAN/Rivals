import { z } from 'zod';

// -------- Challenge window schemas --------

export const createChallengeSchema = z.object({
  name: z.string().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const challengeWindowSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['upcoming', 'active', 'completed']),
  winnerUserId: z.string().uuid().nullable(),
});
export type ChallengeWindow = z.infer<typeof challengeWindowSchema>;

// -------- Leaderboard response schemas --------

export const leaderboardEntrySchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  score: z.number().int(),
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
  joinedAt: z.string(),
  rank: z.number().int(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardResponseSchema = z.object({
  mode: z.enum(['streak', 'total', 'window']),
  memberCount: z.number().int(),
  challengeWindow: challengeWindowSchema.pick({
    id: true,
    name: true,
    startDate: true,
    endDate: true,
  }).nullable(),
  entries: z.array(leaderboardEntrySchema),
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;
