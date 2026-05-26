-- Challenge window transition jobs for pg_cron.
--
-- Prerequisites:
--   1. Enable pg_cron extension in Supabase Dashboard → Database → Extensions
--   2. Run this SQL in the Supabase SQL Editor
--
-- This creates two hourly jobs:
--   1. Flip 'upcoming' → 'active' when start_date is reached
--   2. Flip 'active' → 'completed' when end_date has passed, declare winner

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: Activate upcoming windows whose start_date has been reached
SELECT cron.schedule(
  'challenge-activate',
  '0 * * * *',  -- every hour, on the hour
  $$
    UPDATE challenge_windows cw
    SET status = 'active'
    FROM groups g
    WHERE cw.group_id = g.id
      AND cw.status = 'upcoming'
      AND cw.start_date <= (
        CURRENT_TIMESTAMP AT TIME ZONE COALESCE(g.reference_tz, 'UTC')
      )::date;

    -- Post window_start feed events for newly activated windows
    INSERT INTO feed_events (group_id, actor_user_id, kind, payload_json)
    SELECT
      cw.group_id,
      g.admin_user_id,
      'window_start',
      jsonb_build_object(
        'challengeWindowId', cw.id,
        'name', cw.name,
        'startDate', cw.start_date,
        'endDate', cw.end_date
      )
    FROM challenge_windows cw
    JOIN groups g ON g.id = cw.group_id
    WHERE cw.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM feed_events fe
        WHERE fe.group_id = cw.group_id
          AND fe.kind = 'window_start'
          AND (fe.payload_json->>'challengeWindowId')::text = cw.id::text
      );
  $$
);

-- Job 2: Complete active windows whose end_date has passed, declare winner
SELECT cron.schedule(
  'challenge-complete',
  '5 * * * *',  -- every hour, 5 minutes past
  $$
    -- Step 1: Find windows that need to be completed
    WITH windows_to_complete AS (
      SELECT cw.id, cw.group_id, cw.name, cw.start_date, cw.end_date
      FROM challenge_windows cw
      JOIN groups g ON g.id = cw.group_id
      WHERE cw.status = 'active'
        AND cw.end_date < (
          CURRENT_TIMESTAMP AT TIME ZONE COALESCE(g.reference_tz, 'UTC')
        )::date
    ),
    -- Step 2: Find the winner per window using tie-breaking
    -- Tie-break: score DESC, longest_streak DESC, joined_at ASC
    winners AS (
      SELECT DISTINCT ON (wtc.id)
        wtc.id AS window_id,
        wtc.group_id,
        wtc.name,
        wtc.start_date,
        wtc.end_date,
        ls.user_id AS winner_user_id,
        ls.score AS winner_score
      FROM windows_to_complete wtc
      LEFT JOIN leaderboard_scores ls
        ON ls.group_id = wtc.group_id
        AND ls.mode = 'window'
        AND ls.challenge_window_id = wtc.id
      LEFT JOIN streaks s
        ON s.user_id = ls.user_id
        AND s.group_id = ls.group_id
        AND s.habit_id IS NULL
      LEFT JOIN group_memberships gm
        ON gm.group_id = ls.group_id
        AND gm.user_id = ls.user_id
        AND gm.left_at IS NULL
      ORDER BY wtc.id,
        ls.score DESC NULLS LAST,
        s.longest_streak DESC NULLS LAST,
        gm.joined_at ASC NULLS LAST
    ),
    -- Step 3: Update window status and winner
    updated AS (
      UPDATE challenge_windows cw
      SET status = 'completed',
          winner_user_id = w.winner_user_id
      FROM winners w
      WHERE cw.id = w.window_id
      RETURNING cw.id, cw.group_id, w.winner_user_id, w.winner_score, w.name
    ),
    -- Step 4: Post window_end feed events
    feed_insert AS (
      INSERT INTO feed_events (group_id, actor_user_id, kind, payload_json)
      SELECT
        u.group_id,
        COALESCE(u.winner_user_id, (SELECT admin_user_id FROM groups WHERE id = u.group_id)),
        'window_end',
        jsonb_build_object(
          'challengeWindowId', u.id,
          'name', u.name,
          'winnerUserId', u.winner_user_id,
          'winnerScore', u.winner_score
        )
      FROM updated u
      RETURNING id
    )
    -- Step 5: Award window_winner badge
    INSERT INTO user_badges (user_id, badge_id, group_id)
    SELECT
      u.winner_user_id,
      b.id,
      u.group_id
    FROM updated u
    CROSS JOIN badges b
    WHERE b.code = 'window_winner'
      AND u.winner_user_id IS NOT NULL
    ON CONFLICT (user_id, badge_id, group_id) DO NOTHING;
  $$
);
