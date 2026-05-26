ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
  "logSubmissions": true,
  "streakAtRisk": true,
  "streakMilestones": true,
  "challengeEvents": true,
  "groupInvites": true,
  "adminTransfers": true,
  "reminderTime": "08:00",
  "mutedGroupIds": []
}';
