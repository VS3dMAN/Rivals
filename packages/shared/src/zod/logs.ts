import { z } from 'zod';

export const uploadUrlRequestSchema = z.object({
  groupId: z.string().uuid(),
  habitId: z.string().uuid(),
});
export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

export const uploadUrlResponseSchema = z.object({
  logId: z.string().uuid(),
  uploadUrl: z.string().url(),
  headers: z.record(z.string()),
  objectKey: z.string(),
  expiresAt: z.string(),
});
export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;

export const confirmLogSchema = z.object({
  logId: z.string().uuid(),
  clientTimestamp: z.string().datetime(),
});
export type ConfirmLogInput = z.infer<typeof confirmLogSchema>;

export const photoUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string(),
});
export type PhotoUrlResponse = z.infer<typeof photoUrlResponseSchema>;
