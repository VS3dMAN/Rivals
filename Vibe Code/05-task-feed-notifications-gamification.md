# Task Sheet 05: Feed, Notifications & Gamification

> **Phase Goal:** The social loop closes: group members see each other's proof photos in a live feed, react with emojis, receive push notifications for the events that matter, and earn badges and streak milestones.
> **Prerequisites:** 01, 02, 03, 04
> **Estimated Effort:** 4–6 days

---

## Tasks

### Task 05.1 — Feed endpoint with pagination

**What:** `GET /groups/:id/feed` returns paginated activity events for a group, newest first.

**Subtasks:**
- [ ] Cursor pagination: `?cursor=<created_at_iso>&limit=20`
- [ ] Response entries include `{ id, kind, actor: { userId, username, displayName, avatarUrl }, payload, createdAt, reactions: [{ emoji, count, reactedByMe }] }`
- [ ] `payload.photoUrl` for `kind === 'log'` is a freshly-issued signed GET URL (1-hour TTL)
- [ ] Hide events for users who have left the group? No — keep history; the PRD treats the feed as the group's permanent record.

**Acceptance Criteria:**
- Submitting a log produces a new feed event visible to all members within 3 seconds (same transaction as `POST /logs`).
- Cursor pagination works backwards through history.

**AI Prompt:**
> Implement `GET /groups/:id/feed?cursor=<iso>&limit=20` in `packages/api/src/modules/feed/routes.ts`. Query: `SELECT * FROM feed_events WHERE group_id = $1 AND ($cursor IS NULL OR created_at < $cursor::timestamptz) ORDER BY created_at DESC LIMIT $limit`. Join `users` for actor data. For each row of `kind='log'`, replace `payload.photoUrl` with a freshly-issued R2 presigned GET URL using the stored object key. Aggregate `feed_reactions` for each event into `[{ emoji, count, reactedByMe }]`. Add zod response type in `packages/shared/src/zod/feed.ts`. Members-only access enforced by RLS + membership check.

**After completing:** `git add -A && git commit -m "feat(feed): paginated feed endpoint with signed photo URLs"`

---

### Task 05.2 — Feed UI with full-screen proof viewer

**What:** `FeedScreen` renders event cards inside each group; tapping a proof thumbnail opens a full-screen viewer.

**Subtasks:**
- [ ] `FeedScreen` under Group tab stack; React Query infinite query with 60-s poll
- [ ] Card variants by `kind`: log (photo + habit name), streak milestone, join, leave, window_start, window_end, badge_awarded
- [ ] `FullScreenProofViewer` with swipe-to-dismiss
- [ ] Pull-to-refresh + "Load more" at bottom

**Acceptance Criteria:**
- Feed loads 20 items per page; scrolling to bottom loads the next 20.
- Tapping a log card opens full-screen viewer.
- A new log appears at top of feed within one poll cycle.

**AI Prompt:**
> Build `apps/mobile/src/screens/groups/FeedScreen.tsx` using `useInfiniteQuery` against `GET /groups/:id/feed`, `refetchInterval: 60_000`. Render a `FeedCard` per event dispatching by `kind`: `LogCard` (big photo thumbnail, habit name, "@username completed at HH:MM", reaction row), `MilestoneCard` ("🔥 @username hit a 7-day streak!"), `JoinCard`, `LeaveCard`, `WindowStartCard`, `WindowEndCard` ("🏆 @username won 'October Grind' with 28 completions"), `BadgeCard`. Tapping a photo opens `FullScreenProofViewer` (modal with pinch-zoom and swipe-down to dismiss). Infinite scroll via `FlatList` `onEndReached`. Pull-to-refresh via `RefreshControl`.

**After completing:** `git add -A && git commit -m "feat(feed): UI with proof viewer + infinite scroll"`

---

### Task 05.3 — Emoji reactions (one per user per event)

**What:** Members can react to feed events with a single emoji; tapping again toggles off, tapping a different one replaces.

**Subtasks:**
- [ ] `POST /feed/:id/react` — body `{ emoji }`; upserts on `(feed_event_id, user_id)` per the unique index; empty string deletes
- [ ] UI: reaction picker with 6 defaults (🔥, 💪, 👏, 👑, 🥵, 🎯) + custom emoji button
- [ ] Card shows aggregated reactions as `[emoji] [count]` chips; the user's own reaction is highlighted

**Acceptance Criteria:**
- Tapping 🔥 on a card increments the count; tapping again decrements; tapping 💪 replaces.
- Reactions persist across sessions and appear in every member's feed.

**AI Prompt:**
> Implement `POST /feed/:id/react` in `packages/api/src/modules/feed/routes.ts` accepting `{ emoji }`. Empty string deletes the reaction. Otherwise, upsert on conflict `(feed_event_id, user_id)` DO UPDATE SET emoji. Return the updated aggregated reactions array for the event. Validate emoji length 1-8 chars. In `FeedCard`, render `ReactionRow`: a row of chips `[emoji count]` plus a "+" button opening a `ReactionPicker` with 6 defaults and a "More" button that opens the system emoji keyboard. Use an optimistic update in React Query.

**After completing:** `git add -A && git commit -m "feat(feed): emoji reactions with optimistic UI"`

---

### Task 05.4 — Push notification infrastructure (FCM + APNs)

**What:** Wire native push token registration and an API-side dispatcher used by all event producers.

**Subtasks:**
- [ ] Mobile: `expo-notifications` token registration; `POST /push/register` with `{ platform, token }`
- [ ] Web: FCM Web SDK token registration (same endpoint)
- [ ] `packages/api/src/modules/notifications/dispatcher.ts` — `sendPush({ userIds, kind, title, body, data })` that fans out via FCM (Android + Web) and APNs (iOS)
- [ ] Idempotent: store sent notification id to dedup if caller retries

**Acceptance Criteria:**
- A real iOS device + Android device receive a test push when the dispatcher is called.
- Web browser tab that has granted permission receives the same notification.

**AI Prompt:**
> Install `expo-notifications` in `apps/mobile` and request permission at login on real devices; on success, call `Notifications.getExpoPushTokenAsync()` → POST `/push/register` with `{ platform: Platform.OS, token }`. For web, use the FCM Web SDK: register the service worker `firebase-messaging-sw.js` in `apps/web/public/`, get the token via `getToken(messaging, { vapidKey })`, and POST to the same endpoint. Backend: `packages/api/src/modules/push/routes.ts` stores tokens in `push_tokens` with UNIQUE(user_id, token). Add `packages/api/src/modules/notifications/dispatcher.ts` with `sendPush({ userIds, kind, title, body, data })` that selects all tokens for those users and dispatches via FCM HTTP v1 for android + web and APNs (via `node-apn` or FCM's APNs proxy) for ios. Add basic dedup by hashing `(userId, kind, data.entityId)` into a short-lived `sent_pushes` table.

**After completing:** `git add -A && git commit -m "feat(push): token registration + fanout dispatcher"`

---

### Task 05.5 — Event-driven notifications per PRD EPIC 7

**What:** Wire the dispatcher to every event producer so each notification type in PRD EPIC 7 fires.

**Subtasks:**
- [ ] `log_submitted` → push to all other group members (opt-in per group): "@username completed Morning Gym"
- [ ] `streak_at_risk` → 2 h before grace deadline at user's local tz (via pg_cron + dispatcher); only if not completed today
- [ ] `streak_milestone` → 7, 14, 30, 60, 90, 180, 365 days
- [ ] `challenge_window_start` → all group members
- [ ] `challenge_window_ending_soon` → 24 h before end
- [ ] `challenge_window_ended` → winner + all members
- [ ] `group_invite` → invitee
- [ ] `admin_transferred` → new admin

**Acceptance Criteria:**
- Submitting a log fires a push to every other member with notifications enabled for that group.
- Setting clock to just before `reminder_time - 2h` for an incomplete day triggers `streak_at_risk`.

**AI Prompt:**
> In each module that produces a relevant event, call `dispatcher.sendPush(...)` after the DB commit: (1) `POST /logs` → fan out `log_submitted` to group members excluding the actor; (2) `challenges` transitions → fan out `window_start`, `window_ending_soon` (24h cron), `window_ended`; (3) streak milestone detection in `recomputeScores` → if a user's `current_streak` crossed a threshold in {7,14,30,60,90,180,365}, emit `streak_milestone` to that user and insert a feed event; (4) `POST /groups/:id/invite` → `group_invite` push to invitee; (5) `POST /groups/:id/transfer` → `admin_transferred` push to new admin. Add `packages/api/src/jobs/reminders.sql` pg_cron running every 15 min that finds users where `now()_at_user_tz = reminder_time - 2h` and any active habit in their groups is not yet completed today, then dispatches `streak_at_risk`. Respect per-group and per-type toggles from `users.notification_prefs` (next task).

**After completing:** `git add -A && git commit -m "feat(notifications): event-driven push for all EPIC 7 types"`

---

### Task 05.6 — Notification preferences UI

**What:** Per-type and per-group toggles for notifications; daily reminder time picker.

**Subtasks:**
- [ ] Add `notification_prefs jsonb` column to `users` (default values)
- [ ] `PATCH /me/notifications` updates the prefs
- [ ] Screen with toggles: log submissions, streak at risk, streak milestones, challenge events, group invites, admin transfers
- [ ] Daily reminder time picker (local tz)
- [ ] Per-group overrides: mute a group entirely

**Acceptance Criteria:**
- Disabling "log submissions" stops receiving pushes from other members' logs across all groups.
- Muting a single group hides all notifications from that group only.

**AI Prompt:**
> Add a Drizzle migration adding `notification_prefs jsonb DEFAULT '{"logSubmissions": true, "streakAtRisk": true, "streakMilestones": true, "challengeEvents": true, "groupInvites": true, "adminTransfers": true, "reminderTime": "08:00", "mutedGroupIds": []}'` to `users`. Add `PATCH /me/notifications` accepting a partial. Build `NotificationsPreferencesScreen` with switches for each type and a time picker for the reminder; also render a list of the user's groups with a "Mute" toggle per row. Before calling `dispatcher.sendPush`, filter recipients by their prefs and muted groups.

**After completing:** `git add -A && git commit -m "feat(notifications): per-type + per-group preferences"`

---

### Task 05.7 — Streak milestones + badge system

**What:** A catalog of launch badges, evaluation logic, and a badges screen on the user profile.

**Subtasks:**
- [ ] Seed `badges` table with launch set: `streak_7`, `streak_30`, `streak_90`, `total_100`, `total_500`, `window_winner`, `early_bird` (first completion before 7am), `comeback` (rebuild streak after a break)
- [ ] `evaluateBadges(db, { userId, groupId, event })` called after `recomputeScores`; awards new badges by inserting `user_badges`
- [ ] Each new badge → feed event `kind='badge'` + push `streak_milestone` or `badge_earned`
- [ ] `BadgesScreen` on profile showing earned + not-yet-earned (grayed out) with progress hint

**Acceptance Criteria:**
- Hitting a 7-day streak awards `streak_7`, posts a feed card, and pushes a notification.
- Badges screen reflects state immediately.

**AI Prompt:**
> Add a seed file `packages/api/src/db/seed/badges.ts` inserting the launch badge set with codes and copy. Implement `packages/api/src/modules/gamification/service.ts` with `evaluateBadges(db, { userId, groupId, event })`: after each `recomputeScores` call, check thresholds — current_streak crossing 7/30/90 (scoped per group), total_completions crossing 100/500, `event === 'window_end' && winner === userId` → `window_winner`, first completion today before 07:00 local tz → `early_bird`, current_streak reaching 7 after a ≥3-day break → `comeback`. Insert `user_badges` on new awards (UNIQUE constraint prevents duplicates); insert a `feed_events` row kind='badge' with payload `{ badgeCode }`; dispatch a push. Build `BadgesScreen` in the Profile tab showing earned (full color) and unearned (grayscale + progress hint).

**After completing:** `git add -A && git commit -m "feat(gamification): launch badges + streak milestones"`

---

### Task 05.8 — Personal stats view

**What:** Per-habit completion rate, streak history, and a calendar heatmap on the user's profile.

**Subtasks:**
- [ ] `GET /me/stats?groupId=<id>` returns per-habit `{ habitName, completionRate30d, currentStreak, longestStreak, calendar: [{ date, completed: bool }] }` for the last 180 days
- [ ] `PersonalStatsScreen` rendering compact cards per habit + a month-based heatmap per habit

**Acceptance Criteria:**
- A user with 30 logs over 30 days shows 100% completion rate and a filled heatmap.

**AI Prompt:**
> Implement `GET /me/stats?groupId=<id>` in `packages/api/src/modules/users/routes.ts`. For each active habit in the group, compute: `completionRate30d = logsInLast30 / 30`; `currentStreak` and `longestStreak` from `streaks`; `calendar: Array<{ date, completed }>` for the last 180 days (generate the date series via `generate_series`, LEFT JOIN to `habit_logs`). Build `PersonalStatsScreen` with a group picker at the top and, per active habit, a `HabitStatsCard` containing the three numbers and a `CalendarHeatmap` colored amber for completed days.

**After completing:** `git add -A && git commit -m "feat(stats): per-habit completion rate + heatmap"`

---

## Phase Checkpoint

Before moving to Task Sheet 06, verify:

- [ ] Submitting a log produces a `LogCard` in the group feed within 3 seconds.
- [ ] Tapping 🔥 on a card updates the count and persists; tapping another emoji replaces the reaction.
- [ ] Real iOS + Android device + a Chrome tab all receive a push when another member logs in their group.
- [ ] Turning off "log submissions" in preferences stops those pushes.
- [ ] Crossing a 7-day streak: `streak_7` badge awarded, milestone card in feed, push delivered.
- [ ] Personal stats page renders a correct 180-day heatmap.
- [ ] All notification types in PRD EPIC 7 fire at least once in testing.
- [ ] All changes committed; staging auto-deploy succeeds.
