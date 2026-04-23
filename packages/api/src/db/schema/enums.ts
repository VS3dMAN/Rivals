import { pgEnum } from 'drizzle-orm/pg-core';

export const membershipRole = pgEnum('membership_role', ['admin', 'member']);

export const leaderboardMode = pgEnum('leaderboard_mode', ['streak', 'total', 'window']);

export const challengeStatus = pgEnum('challenge_status', [
  'upcoming',
  'active',
  'completed',
]);

export const feedEventKind = pgEnum('feed_event_kind', [
  'log',
  'streak_milestone',
  'badge',
  'join',
  'leave',
  'window_start',
  'window_end',
]);

export const notificationKind = pgEnum('notification_kind', [
  'daily_reminder',
  'streak_at_risk',
  'group_activity',
  'milestone',
  'challenge_start',
  'challenge_end',
  'member_join',
  'admin_transfer',
]);

export const pushPlatform = pgEnum('push_platform', ['ios', 'android', 'web']);
