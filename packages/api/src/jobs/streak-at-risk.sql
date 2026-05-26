-- Streak-at-risk notification job
-- Run via pg_cron every 15 minutes:
--   SELECT cron.schedule('streak-at-risk', '*/15 * * * *', $$SELECT notify_streak_at_risk()$$);
--
-- Finds users who have an active streak but haven't completed any habit today
-- and inserts a streak_at_risk notification (max once per day per user).

CREATE OR REPLACE FUNCTION notify_streak_at_risk() RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT s.user_id, s.group_id, s.current_streak, u.timezone
    FROM streaks s
    JOIN users u ON u.id = s.user_id
    JOIN group_memberships gm ON gm.user_id = s.user_id
      AND gm.group_id = s.group_id
      AND gm.left_at IS NULL
    WHERE s.current_streak >= 2
      AND s.habit_id IS NULL  -- group-level streak
      -- No log today in user's timezone
      AND NOT EXISTS (
        SELECT 1 FROM habit_logs hl
        WHERE hl.user_id = s.user_id
          AND hl.group_id = s.group_id
          AND hl.deleted_at IS NULL
          AND hl.log_date = (NOW() AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
      )
      -- Haven't already sent this notification today
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = s.user_id
          AND n.kind = 'streak_at_risk'
          AND n.created_at::date = CURRENT_DATE
      )
  LOOP
    INSERT INTO notifications (user_id, kind, payload_json)
    VALUES (
      r.user_id,
      'streak_at_risk',
      jsonb_build_object(
        'title', 'Streak at risk!',
        'body', format('Your %s-day streak is about to break. Log now!', r.current_streak),
        'groupId', r.group_id,
        'streak', r.current_streak
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;
