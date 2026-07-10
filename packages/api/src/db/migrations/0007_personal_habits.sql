-- Private personal habits — the per-user habit tracker that lives alongside
-- group tracking (Master PRD §2.1). No proof photos, no leaderboard, no feed:
-- tap-to-complete only, visible to nobody but the owner.

CREATE TABLE "personal_habits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "grace_days" smallint NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "personal_habits_grace_range" CHECK ("grace_days" >= 0 AND "grace_days" <= 2),
  CONSTRAINT "personal_habits_name_len" CHECK (char_length("name") BETWEEN 1 AND 60)
);

CREATE INDEX "personal_habits_user_idx" ON "personal_habits" ("user_id");

CREATE TABLE "personal_habit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "personal_habit_id" uuid NOT NULL REFERENCES "personal_habits"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "log_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "personal_habit_logs_daily_unique"
  ON "personal_habit_logs" ("personal_habit_id", "log_date");
CREATE INDEX "personal_habit_logs_user_date_idx"
  ON "personal_habit_logs" ("user_id", "log_date" DESC);

ALTER TABLE "personal_habits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_habit_logs" ENABLE ROW LEVEL SECURITY;

-- Owner-only reads (same pattern as pending_logs). The API's service role
-- performs all writes.
CREATE POLICY "personal_habits_select_self" ON "personal_habits"
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "personal_habit_logs_select_self" ON "personal_habit_logs"
  FOR SELECT
  USING (user_id = auth.uid());
