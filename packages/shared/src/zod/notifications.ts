import { z } from 'zod';

export const notificationPrefsSchema = z.object({
  logSubmissions: z.boolean().optional(),
  streakAtRisk: z.boolean().optional(),
  streakMilestones: z.boolean().optional(),
  challengeEvents: z.boolean().optional(),
  groupInvites: z.boolean().optional(),
  adminTransfers: z.boolean().optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  mutedGroupIds: z.array(z.string().uuid()).optional(),
});

export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const defaultNotificationPrefs: Required<NotificationPrefs> = {
  logSubmissions: true,
  streakAtRisk: true,
  streakMilestones: true,
  challengeEvents: true,
  groupInvites: true,
  adminTransfers: true,
  reminderTime: '08:00',
  mutedGroupIds: [],
};
