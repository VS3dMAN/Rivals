# Rivals — Performance Report (template)

This file is the home for the staging-env EXPLAIN ANALYZE results. Populate it by running [explain-leaderboard.ts](../packages/api/src/scripts/explain-leaderboard.ts) against the staging database and pasting outputs into the placeholders below.

## How to run

```
DATABASE_URL=postgres://... \
  pnpm --filter @rivals/api exec ts-node src/scripts/explain-leaderboard.ts
```

## Required indexes (from 00-architecture-and-timeline.md §2.4)

| Table | Columns | Purpose |
|---|---|---|
| habit_logs | (user_id, group_id, log_date) | streak / total queries |
| habit_logs | (group_id, log_date DESC) | leaderboard scans |
| feed_events | (group_id, created_at DESC) | feed pagination |
| feed_reactions | (feed_event_id) | reaction joins |
| leaderboard_scores | (group_id, mode, score DESC) | leaderboard order |
| notifications | (user_id, created_at DESC) | inbox pagination |
| push_tokens | (user_id) | dispatcher fan-out |
| challenge_windows | (group_id, status, start_date, end_date) | cron transitions |

Run `\d+ <table>` in psql against staging to confirm each index exists. Add a migration for any missing entry.

## Query plans (paste here)

### 1. Leaderboard top 50, streak mode
```
-- EXPLAIN ANALYZE output goes here
```
Target: < 30 ms on 50 k logs.

### 2. Feed page (group, limit 20, cursor)
```
-- EXPLAIN ANALYZE output goes here
```
Target: < 50 ms.

### 3. Recompute streak for a single (user, group)
```
-- EXPLAIN ANALYZE output goes here
```
Target: < 20 ms.

### 4. Notifications inbox (user, limit 20)
```
-- EXPLAIN ANALYZE output goes here
```
Target: < 30 ms.

## Load test summary

See [packages/api/loadtest/proof-upload.k6.js](../packages/api/loadtest/proof-upload.k6.js). After running, paste:

| Metric | Value |
|---|---|
| Virtual users | 500 |
| Duration | 5 min |
| P50 | _ |
| P95 | _ |
| P99 | _ |
| Error rate | _ |

Pass criteria: P95 < 90 s end-to-end (upload + log), error rate < 2 %.

## Action items

- [ ] Confirm all 8 indexes above present in production schema
- [ ] Capture EXPLAIN ANALYZE for the 4 critical queries
- [ ] Run k6 against staging and paste numbers
- [ ] File ticket for any query that misses its target
