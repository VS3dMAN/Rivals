-- pending_logs table: short-lived rows tracking presigned PUT URLs that have
-- not yet been confirmed via POST /logs. Cleaned up by a 5-minute pg_cron job
-- (see infra/supabase/cron.sql).

CREATE TABLE "pending_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "habit_id" uuid NOT NULL REFERENCES "habits"("id") ON DELETE CASCADE,
  "object_key" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "pending_logs_user_idx" ON "pending_logs" ("user_id");
CREATE INDEX "pending_logs_expires_idx" ON "pending_logs" ("expires_at");

ALTER TABLE "pending_logs" ENABLE ROW LEVEL SECURITY;

-- Same pattern as the other Phase 2 RLS policies: only the row's owner can
-- read or delete. The API uses the service role to insert.
CREATE POLICY "pending_logs_select_self" ON "pending_logs"
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "pending_logs_delete_self" ON "pending_logs"
  FOR DELETE
  USING (user_id = auth.uid());
