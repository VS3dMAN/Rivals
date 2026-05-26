import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  token: z.string().min(1).max(500),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
