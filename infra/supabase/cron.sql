-- Rivals — pg_cron jobs.
-- Run this in Supabase's SQL editor *after* enabling the pg_cron extension
-- (Database → Extensions → pg_cron → Enable). Drizzle migrations don't manage
-- cron schedules; this file is the source of truth.
--
-- To re-apply, simply re-run the file: cron.schedule overwrites a job with
-- the same name.

-- 1) Pending log cleanup
-- pending_logs rows are created by POST /logs/upload-url and deleted on
-- successful POST /logs. Anything older than (expires_at + 1h) means the
-- client never confirmed; reclaim the row. The 1-hour buffer protects
-- against transient clock skew between PG and the API host.
SELECT cron.schedule(
  'rivals-pending-logs-cleanup',
  '*/5 * * * *',
  $$DELETE FROM pending_logs WHERE expires_at < now() - interval '1 hour';$$
);

-- 2) Streak grace expiry reset
-- For each (user, habit, group) streak that's currently > 0, zero it out if
-- the user's most recent log is older than (today_in_user_tz - grace_days - 1).
-- Phase 4's leaderboard module will own full streak transitions; for now we
-- just reset counters so the UI doesn't claim a streak the user actually broke.
SELECT cron.schedule(
  'rivals-streak-grace-reset',
  '0 * * * *',
  $$
  UPDATE streaks AS s
  SET current_streak = 0
  FROM habits AS h, users AS u
  WHERE s.habit_id = h.id
    AND s.user_id = u.id
    AND s.current_streak > 0
    AND s.last_completed_date IS NOT NULL
    AND s.last_completed_date <
        (date_trunc('day', now() AT TIME ZONE u.timezone)::date - (h.grace_days + 1));
  $$
);

-- Inspect scheduled jobs:
--   SELECT jobid, jobname, schedule, command FROM cron.job;
-- Inspect recent runs:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
