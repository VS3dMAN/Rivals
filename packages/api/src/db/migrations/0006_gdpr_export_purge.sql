-- GDPR / CCPA data export + account deletion support tables, plus the
-- challenge_window_ending_soon notification enum value.

ALTER TYPE "notification_kind" ADD VALUE IF NOT EXISTS 'challenge_window_ending_soon';

CREATE TYPE "data_export_status" AS ENUM ('queued', 'processing', 'ready', 'failed', 'expired');

CREATE TABLE IF NOT EXISTS "data_export_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" data_export_status NOT NULL DEFAULT 'queued',
  "object_key" text,
  "signed_url" text,
  "url_expires_at" timestamptz,
  "error" text,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "started_at" timestamptz,
  "completed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "data_export_jobs_user_idx"
  ON "data_export_jobs"("user_id", "requested_at" DESC);
CREATE INDEX IF NOT EXISTS "data_export_jobs_status_idx"
  ON "data_export_jobs"("status") WHERE "status" IN ('queued', 'processing');

CREATE TYPE "purge_status" AS ENUM ('pending', 'processing', 'done', 'failed');

CREATE TABLE IF NOT EXISTS "purge_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "kind" text NOT NULL,            -- 'r2_object' | 'profile_anonymize'
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" purge_status NOT NULL DEFAULT 'pending',
  "attempts" smallint NOT NULL DEFAULT 0,
  "last_error" text,
  "enqueued_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "purge_queue_status_idx"
  ON "purge_queue"("status", "enqueued_at") WHERE "status" IN ('pending', 'processing');

-- RLS: only the owning user may see their own export jobs; purge_queue is service-role only.
ALTER TABLE "data_export_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purge_queue" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_export_jobs_owner_select" ON "data_export_jobs";
CREATE POLICY "data_export_jobs_owner_select"
  ON "data_export_jobs" FOR SELECT
  USING (user_id = auth.uid());
