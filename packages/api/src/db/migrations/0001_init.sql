-- Rivals initial schema migration
-- Mirrors Vibe Code/00-architecture-and-timeline.md §2.3

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Enums
CREATE TYPE "membership_role" AS ENUM ('admin', 'member');
CREATE TYPE "leaderboard_mode" AS ENUM ('streak', 'total', 'window');
CREATE TYPE "challenge_status" AS ENUM ('upcoming', 'active', 'completed');
CREATE TYPE "feed_event_kind" AS ENUM (
  'log', 'streak_milestone', 'badge', 'join', 'leave', 'window_start', 'window_end'
);
CREATE TYPE "notification_kind" AS ENUM (
  'daily_reminder', 'streak_at_risk', 'group_activity', 'milestone',
  'challenge_start', 'challenge_end', 'member_join', 'admin_transfer'
);
CREATE TYPE "push_platform" AS ENUM ('ios', 'android', 'web');

-- Users
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" citext NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "email" citext NOT NULL UNIQUE,
  "avatar_url" text,
  "timezone" text NOT NULL DEFAULT 'UTC',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "users_username_regex" CHECK (username ~ '^[a-z0-9_]{3,24}$')
);

-- Groups
CREATE TABLE "groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "avatar_url" text,
  "admin_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "reference_tz" text NOT NULL,
  "leaderboard_mode" leaderboard_mode NOT NULL DEFAULT 'streak',
  "invite_code" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "groups_name_len" CHECK (char_length(name) BETWEEN 1 AND 80)
);

-- Group memberships
CREATE TABLE "group_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" membership_role NOT NULL DEFAULT 'member',
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "left_at" timestamptz
);
CREATE UNIQUE INDEX "group_memberships_active_unique"
  ON "group_memberships"("group_id", "user_id") WHERE "left_at" IS NULL;
CREATE INDEX "group_memberships_user_group_idx"
  ON "group_memberships"("user_id", "group_id");

-- Habits
CREATE TABLE "habits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "grace_days" smallint NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "habits_grace_range" CHECK (grace_days >= 0 AND grace_days <= 2),
  CONSTRAINT "habits_name_len" CHECK (char_length(name) BETWEEN 1 AND 60)
);

-- Habit logs
CREATE TABLE "habit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "habit_id" uuid NOT NULL REFERENCES "habits"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "log_date" date NOT NULL,
  "client_timestamp" timestamptz NOT NULL,
  "server_timestamp" timestamptz NOT NULL DEFAULT now(),
  "photo_url" text NOT NULL,
  "deleted_at" timestamptz
);
CREATE UNIQUE INDEX "habit_logs_active_daily_unique"
  ON "habit_logs"("habit_id", "user_id", "log_date") WHERE "deleted_at" IS NULL;
CREATE INDEX "habit_logs_user_habit_date_idx"
  ON "habit_logs"("user_id", "habit_id", "log_date");
CREATE INDEX "habit_logs_group_date_idx"
  ON "habit_logs"("group_id", "log_date" DESC);

-- Streaks
CREATE TABLE "streaks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "habit_id" uuid REFERENCES "habits"("id") ON DELETE CASCADE,
  "current_streak" integer NOT NULL DEFAULT 0,
  "longest_streak" integer NOT NULL DEFAULT 0,
  "last_completed_date" date
);
CREATE UNIQUE INDEX "streaks_user_group_habit_unique"
  ON "streaks"("user_id", "group_id", "habit_id");

-- Challenge windows
CREATE TABLE "challenge_windows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" challenge_status NOT NULL DEFAULT 'upcoming',
  "winner_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "challenge_windows_end_after_start"
    CHECK (end_date >= start_date + INTERVAL '2 days')
);

-- Leaderboard scores
CREATE TABLE "leaderboard_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mode" leaderboard_mode NOT NULL,
  "challenge_window_id" uuid REFERENCES "challenge_windows"("id") ON DELETE CASCADE,
  "score" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "leaderboard_scores_unique"
  ON "leaderboard_scores"("group_id", "user_id", "mode", "challenge_window_id");
CREATE INDEX "leaderboard_scores_ranking_idx"
  ON "leaderboard_scores"("group_id", "mode", "challenge_window_id", "score" DESC);

-- Feed events
CREATE TABLE "feed_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "actor_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" feed_event_kind NOT NULL,
  "payload_json" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "feed_events_group_created_idx"
  ON "feed_events"("group_id", "created_at" DESC);

-- Feed reactions
CREATE TABLE "feed_reactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "feed_event_id" uuid NOT NULL REFERENCES "feed_events"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emoji" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "feed_reactions_emoji_len" CHECK (char_length(emoji) BETWEEN 1 AND 8)
);
CREATE UNIQUE INDEX "feed_reactions_one_per_user"
  ON "feed_reactions"("feed_event_id", "user_id");

-- Notifications
CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" notification_kind NOT NULL,
  "payload_json" jsonb NOT NULL,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "notifications_user_unread_idx"
  ON "notifications"("user_id", "read_at");

-- Push tokens
CREATE TABLE "push_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform" push_platform NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "push_tokens_user_token_unique"
  ON "push_tokens"("user_id", "token");

-- Badges + user_badges
CREATE TABLE "badges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "user_badges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "badge_id" uuid NOT NULL REFERENCES "badges"("id") ON DELETE CASCADE,
  "group_id" uuid REFERENCES "groups"("id") ON DELETE CASCADE,
  "awarded_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "user_badges_unique"
  ON "user_badges"("user_id", "badge_id", "group_id");
