import { z } from 'zod';

export const leaderboardModeSchema = z.enum(['streak', 'total', 'window']);

export const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  referenceTz: z.string().min(1).max(64),
  avatarUrl: z.string().url().nullable().optional(),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  referenceTz: z.string().min(1).max(64).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  leaderboardMode: leaderboardModeSchema.optional(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const inviteBodySchema = z.object({
  targetUsername: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/i)
    .optional(),
});
export type InviteBody = z.infer<typeof inviteBodySchema>;

export const joinBodySchema = z.object({
  inviteCode: z
    .string()
    .min(8)
    .max(8)
    .regex(/^[A-Z0-9]{8}$/),
});
export type JoinBody = z.infer<typeof joinBodySchema>;

export const transferBodySchema = z.object({
  targetUserId: z.string().uuid(),
});
export type TransferBody = z.infer<typeof transferBodySchema>;

export const groupSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  adminUserId: z.string().uuid(),
  referenceTz: z.string(),
  leaderboardMode: leaderboardModeSchema,
  inviteCode: z.string(),
  memberCount: z.number().int().nonnegative(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
});
export type GroupSummary = z.infer<typeof groupSummarySchema>;
