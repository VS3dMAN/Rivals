# Task Sheet 04: Leaderboard & Real-Time Engine

> **Phase Goal:** All three leaderboard modes (Streak, Total Completions, Challenge Window) compute correctly from live logs, update via 60-second polling and pull-to-refresh, and challenge windows close cleanly with a winner.
> **Prerequisites:** 01, 02, 03
> **Estimated Effort:** 4–6 days

---

## Tasks

### Task 04.1 — Streak computation service

**What:** Pure function that, given a user + group + habit (or null for group-level), returns `{ current, longest, lastCompletedDate }` by walking back from today. Called on every log event.

**Subtasks:**
- [ ] `packages/api/src/modules/leaderboard/streak.ts` with `computeStreak(db, { userId, groupId, habitId? })`
- [ ] Group-level streak: requires ALL active habits completed that day (per PRD §8.1)
- [ ] Honors `grace_days`: a streak is protected for N days after a miss
- [ ] Longest streak: max of current vs existing `streaks.longest_streak`

**Acceptance Criteria:**
- Unit tests cover: perfect streak, single miss no-grace, single miss with grace preserved, multi-habit group where user missed one habit.

**AI Prompt:**
> Create `packages/api/src/modules/leaderboard/streak.ts` exporting `computeStreak(db, { userId, groupId, habitId })`. When `habitId` is provided, count consecutive days ending at today_user_tz where the user has a non-deleted `habit_logs` row for that habit, honoring the habit's `grace_days` (a gap of up to `grace_days` days with no log is allowed if followed by a log within the grace window). When `habitId` is null, compute a group-level streak: a day counts only if the user has a non-deleted log for EVERY active habit in the group on that day (grace per habit). Return `{ current, longest, lastCompletedDate }`. Add `packages/api/src/modules/leaderboard/__tests__/streak.test.ts` with fixtures for: (1) 10-day perfect streak, (2) missed yesterday, grace=0 → current=0, (3) missed yesterday, grace=1 → current preserved if logged today, (4) two-habit group where only one logged yesterday → day doesn't count.

**After completing:** `git add -A && git commit -m "feat(leaderboard): pure streak computation with grace"`

---

### Task 04.2 — Score recompute on log events (all three modes)

**What:** On every `POST /logs` success, synchronously recompute and upsert the user's scores for Streak / Total / Window modes in `leaderboard_scores`.

**Subtasks:**
- [ ] `recomputeScores(db, { userId, groupId, affectedHabitId })` updates all three modes in a single transaction
- [ ] Streak mode score = `computeStreak(...).current`
- [ ] Total mode score = `COUNT(*)` of non-deleted logs for memberships from `joined_at` onwards (respecting rejoins per PRD §8.2)
- [ ] Window mode score = count of non-deleted logs where `log_date BETWEEN start_date AND end_date` for the currently active `challenge_window`
- [ ] Update `streaks` table's `current_streak` + `longest_streak`
- [ ] Hook into `POST /logs` AFTER the `habit_logs` insert

**Acceptance Criteria:**
- After a log, `leaderboard_scores` rows for that user in the group exist for all three modes and reflect correct values.
- Test: two users, one logs twice today (re-submit) — totals don't double-count.

**AI Prompt:**
> Implement `packages/api/src/modules/leaderboard/service.ts` with `recomputeScores(db, { userId, groupId, affectedHabitId })`. In a single transaction: (1) call `computeStreak` for the group and upsert `streaks` (user_id, group_id, habit_id=null); (2) compute `totalCount = SELECT COUNT(*) FROM habit_logs JOIN group_memberships USING (group_id, user_id) WHERE deleted_at IS NULL AND log_date >= group_memberships.joined_at::date`; (3) find the currently-active `challenge_window` for the group (status='active') and compute `windowCount`; (4) upsert three `leaderboard_scores` rows `(group_id, user_id, mode, challenge_window_id, score)` for modes `streak`, `total`, `window` (only insert/update `window` if an active window exists). Call `recomputeScores` at the end of the `POST /logs` transaction in 03.2. Do not double count same-day re-submissions: the soft-deleted prior row is excluded by `deleted_at IS NULL`.

**After completing:** `git add -A && git commit -m "feat(leaderboard): recompute all modes on log event"`

---

### Task 04.3 — Challenge windows: create, activate, end, archive

**What:** Admins create a time-boxed challenge window. At `end_date` + 23:59:59 group tz, a scheduler closes the window, declares a winner, and emits feed + badge events.

**Subtasks:**
- [ ] `POST /groups/:id/challenges` (admin) — body `{ name, startDate, endDate }`; validates `endDate >= startDate + 2` days, max 365, no overlap with active/upcoming window
- [ ] On insert: status starts as `upcoming` if `startDate > today`, else `active`
- [ ] pg_cron hourly job: flip `upcoming → active` when start reached; `active → completed` when end passed; on transition to `completed`, pick winner (highest `leaderboard_scores.score` for mode=window, challenge_window_id), tie-break per PRD §8.3
- [ ] On completion: insert `feed_events` of kind `window_end` with `{ winnerUserId, winnerScore }`; award `window_winner` badge
- [ ] `GET /groups/:id/challenges?status=archived` lists past windows

**Acceptance Criteria:**
- Creating a window overlapping an active one → 409 `WINDOW_OVERLAP`.
- Window transitions `upcoming → active → completed` visible within one cron tick.
- Winner declared correctly; feed event posted; badge awarded.

**AI Prompt:**
> Implement `packages/api/src/modules/leaderboard/challenges.ts`. Endpoint `POST /groups/:id/challenges` (admin): validate window length (3-365 days), check no `challenge_windows` row in group with status IN ('upcoming', 'active') overlaps the requested range; insert with status `upcoming` or `active` based on today vs start_date. Add `packages/api/src/jobs/challenge-transitions.sql` as a pg_cron job running hourly that: (1) `UPDATE challenge_windows SET status = 'active' WHERE status = 'upcoming' AND start_date <= current_date_in_tz(group_id)`; (2) for each window just transitioning to `completed` (end_date < current), find the top `leaderboard_scores` row (mode='window') using the tie-break SELECT in PRD §8.3, set `winner_user_id`, insert `feed_events` kind=`window_end`, and upsert `user_badges` with code `window_winner`. Add `GET /groups/:id/challenges?status=upcoming|active|completed`.

**After completing:** `git add -A && git commit -m "feat(leaderboard): challenge windows lifecycle + winner"`

---

### Task 04.4 — GET /groups/:id/leaderboard

**What:** Single endpoint returns the current leaderboard in the group's active mode with correct tie-breaking.

**Subtasks:**
- [ ] Read `groups.leaderboard_mode`
- [ ] SELECT from `leaderboard_scores` filtered by group + mode (+ active challenge window id for window mode) JOIN `users` for display name/avatar
- [ ] ORDER BY score DESC, then per PRD tie-break: `longest_streak DESC`, `total_completions DESC`, `joined_at ASC` (mode-specific)
- [ ] Include current user's rank + delta since previous request (store prior rank in Redis-free way: just recompute; deltas can be client-side via React Query previous data)

**Acceptance Criteria:**
- Two users: A has streak 7, B has streak 7 but longer `longest_streak` → B ranks first.
- Mode switch reflected on next request.

**AI Prompt:**
> Implement `GET /groups/:id/leaderboard` in `packages/api/src/modules/leaderboard/routes.ts`. Read `groups.leaderboard_mode` (and active `challenge_window` when mode='window'). Return `{ mode, entries: [{ userId, username, displayName, avatarUrl, score, currentStreak, longestStreak, joinedAt, rank }] }` sorted per PRD §8. Use a single SQL query with CTEs for clarity. Member-only access enforced by RLS + explicit membership check. Do not compute deltas server-side — clients can diff against React Query's prior cached response.

**After completing:** `git add -A && git commit -m "feat(leaderboard): GET endpoint with tie-break"`

---

### Task 04.5 — Leaderboard UI + mode switcher

**What:** Build the leaderboard screen rendering ranks, scores, and mode-specific context. Admin-only mode switcher.

**Subtasks:**
- [ ] `LeaderboardScreen` in `apps/mobile/src/screens/groups`, React Query `refetchInterval: 60_000`, pull-to-refresh
- [ ] Row: rank badge, avatar, `@username`, display name, mode score, current streak, YOU badge if row.userId == me
- [ ] Mode switcher (admin only) in Group Settings: `streak | total | window` — updates `groups.leaderboard_mode` via `PATCH /groups/:id`
- [ ] Window mode: countdown timer to `end_date`; "Past Challenges" tab listing completed windows
- [ ] Minimum Members Gate: if `memberCount < 2`, show "Waiting for Rivals" empty state with invite CTA instead of an empty leaderboard

**Acceptance Criteria:**
- Two members logging: leaderboard updates on the next 60s poll or on pull-to-refresh.
- Admin switches mode → full list re-renders.
- Countdown visible during an active challenge window.

**AI Prompt:**
> Build `apps/mobile/src/screens/groups/LeaderboardScreen.tsx` using `useLeaderboardQuery(groupId)` (React Query, `refetchInterval: 60_000`, `refetchOnAppStateChange: true`). Row UI: `RankBadge` (gold/silver/bronze for 1-3), avatar, display name, `@username`, big score number, small "streak: N" badge, YOU chip on current user. Pull-to-refresh via `RefreshControl`. Empty state when `entries.length < 2`: "Waiting for Rivals — invite friends to compete" with the invite code + button. When `mode === 'window'`, render a `CountdownBanner` at the top showing `end_date - now()` and the challenge name. Add `ModeSwitcher` inside Group Settings (admin only) that calls `PATCH /groups/:id` with the new `leaderboardMode`. Add `PastChallengesScreen` accessible via a tab when there are any `completed` challenge windows.

**After completing:** `git add -A && git commit -m "feat(leaderboard): UI with mode switcher + countdown"`

---

### Task 04.6 — Backfill streaks + scores migration

**What:** A one-shot migration that recomputes `streaks` and `leaderboard_scores` for all existing logs, so the leaderboard is correct immediately after deploy even for data created before this phase.

**Subtasks:**
- [ ] SQL migration that clears `streaks` and `leaderboard_scores` then loops by (user, group) and calls `recomputeScores`
- [ ] Can be re-run idempotently for safety
- [ ] Document in `Vibe Code/00-architecture-and-timeline.md` Risk Register

**Acceptance Criteria:**
- After running the backfill against staging, opening the leaderboard on a test group shows correct current streak and total for all members.

**AI Prompt:**
> Create `packages/api/src/db/migrations/0005_backfill_leaderboard.ts` as a Drizzle `push` script (not SQL, because `recomputeScores` is TS): iterate over every `(group_id, user_id)` where the user has an active membership, call `recomputeScores(db, ...)`. Make it idempotent by relying on upserts. Add `pnpm --filter @rivals/api run backfill:leaderboard` command. Document in the architecture's Risk Register that this must run once after deploying Phase 4.

**After completing:** `git add -A && git commit -m "feat(leaderboard): backfill script for existing logs"`

---

## Phase Checkpoint

Before moving to Task Sheet 05, verify:

- [ ] Two users in a group, each logs for a habit: the leaderboard updates on the next 60-second poll.
- [ ] Pull-to-refresh on the leaderboard triggers an immediate refetch.
- [ ] Admin switches mode `streak → total → window` → leaderboard re-renders correctly for each.
- [ ] Creating an overlapping challenge window returns `WINDOW_OVERLAP` (409).
- [ ] A challenge window that has ended automatically completes on the next hourly cron tick, declares the top scorer, posts `window_end` to the feed, and awards `window_winner`.
- [ ] Tie-break: two users with the same streak but different `longest_streak` are ordered per PRD §8.
- [ ] Minimum Members Gate: a single-member group sees the empty state, not an empty list.
- [ ] Backfill script runs without error and produces expected scores.
- [ ] All changes committed; staging auto-deploy succeeds.
