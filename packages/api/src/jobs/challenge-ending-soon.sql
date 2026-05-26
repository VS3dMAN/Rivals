-- challenge_window_ending_soon — fires once per active window when end_date is
-- ~24h away (in the group's reference timezone). Inserts a notification row per
-- member. Push delivery is the API server's job — it dispatches based on these
-- rows on its own schedule, or you can wire a webhook here.
--
-- Idempotency: we tag the payload_json with the window id and SELECT EXISTS to
-- avoid duplicate inserts.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'challenge-window-ending-soon',
  '10 * * * *',  -- every hour, 10 minutes past
  $$
    WITH ending_soon AS (
      SELECT cw.id AS window_id, cw.group_id, cw.name, cw.end_date, g.reference_tz
      FROM challenge_windows cw
      JOIN groups g ON g.id = cw.group_id
      WHERE cw.status = 'active'
        AND cw.end_date - 1 = (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(g.reference_tz, 'UTC'))::date
    ),
    members AS (
      SELECT es.window_id, es.group_id, es.name, es.end_date, gm.user_id
      FROM ending_soon es
      JOIN group_memberships gm ON gm.group_id = es.group_id AND gm.left_at IS NULL
    )
    INSERT INTO notifications (user_id, kind, payload_json)
    SELECT
      m.user_id,
      'challenge_window_ending_soon'::notification_kind,
      jsonb_build_object(
        'challengeWindowId', m.window_id,
        'groupId', m.group_id,
        'name', m.name,
        'endDate', m.end_date,
        'title', 'Challenge ending soon',
        'body', m.name || ' ends in about 24 hours'
      )
    FROM members m
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = m.user_id
        AND n.kind = 'challenge_window_ending_soon'
        AND (n.payload_json->>'challengeWindowId')::text = m.window_id::text
    );
  $$
);
