# Task Sheet 02: Groups & Habit Management

> **Phase Goal:** An admin can create a group, invite members by username or invite link, define habits, and every member sees the same daily habit cards on the group dashboard (without camera yet).
> **Prerequisites:** 01 (Foundation)
> **Estimated Effort:** 3–5 days

---

## Tasks

### Task 02.1 — Add RLS policies for groups + memberships + habits

**What:** Replace the deny-by-default policies from Phase 1 with real, tested policies that scope reads and writes to group membership. Admin writes require `groups.admin_user_id = auth.uid()`.

**Subtasks:**
- [ ] Policy: users can SELECT their own `users` row
- [ ] Policy: users can SELECT `groups` where an active `group_memberships` row links them
- [ ] Policy: users can INSERT `groups` (becoming admin) and UPDATE/DELETE only if admin
- [ ] Policy: admins can INSERT/UPDATE `habits` in their groups; members can SELECT
- [ ] Policy: members can SELECT `group_memberships` rows for their own groups; admins can DELETE members
- [ ] Write policy tests using `pg-tap` or SQL assertions in a migration file

**Acceptance Criteria:**
- As User A (non-member), querying Group X's habits returns zero rows.
- As User B (member), the same query returns the habits.
- Non-admin member cannot insert a habit (RLS rejects).

**AI Prompt:**
> Write a Drizzle migration `packages/api/src/db/migrations/0002_rls_policies.sql` that drops the deny-all policies created in 01.3 for `groups`, `group_memberships`, and `habits` and replaces them with: (1) `groups` — SELECT where `id IN (SELECT group_id FROM group_memberships WHERE user_id = auth.uid() AND left_at IS NULL)`; INSERT with check `admin_user_id = auth.uid()`; UPDATE/DELETE where `admin_user_id = auth.uid()`. (2) `group_memberships` — SELECT where `user_id = auth.uid() OR group_id IN (...same memberships...)`; INSERT/DELETE where the actor is the admin of the group. (3) `habits` — SELECT where `group_id IN (...)`; INSERT/UPDATE/DELETE where `(SELECT admin_user_id FROM groups WHERE id = habits.group_id) = auth.uid()`. Add a test file `packages/api/src/db/tests/policies.test.ts` using a Supabase service-role client to seed two users and a group, then assert each of the five expected behaviors.

**After completing:** `git add -A && git commit -m "feat(db): RLS policies for groups/memberships/habits"`

---

### Task 02.2 — Groups Module: create, list, get, update, delete

**What:** Implement the HTTP surface for group lifecycle.

**Subtasks:**
- [ ] `POST /groups` — body `{ name, description?, referenceTz, avatarUrl? }`; creates group + inserts admin membership in a transaction
- [ ] `GET /groups` — lists all active groups for `request.user`
- [ ] `GET /groups/:id` — detail including members, leaderboard mode, admin
- [ ] `PATCH /groups/:id` — admin edits
- [ ] `DELETE /groups/:id` — admin deletes; cascades via FK + background job to enqueue photo deletions

**Acceptance Criteria:**
- Create → Get round-trip succeeds; admin is the creator.
- Non-admin PATCH returns 403.

**AI Prompt:**
> In `packages/api/src/modules/groups/`, add `service.ts` (pure functions taking a db client) and `routes.ts`. Implement `POST /groups` in a single transaction: insert into `groups` with `admin_user_id = request.user.id` and generate an 8-char alphanumeric `invite_code`, then insert a `group_memberships` row `(group_id, user_id, role: 'admin')`. Add `GET /groups`, `GET /groups/:id`, `PATCH /groups/:id`, `DELETE /groups/:id`. Validate with zod schemas in `packages/shared/src/zod/groups.ts`. Add vitest tests for the happy path, non-admin PATCH (403), and non-member GET (404).

**After completing:** `git add -A && git commit -m "feat(groups): CRUD endpoints with transactional admin bootstrap"`

---

### Task 02.3 — Invites: by username + invite link/code

**What:** Let admins search users by username and invite them, and generate shareable invite links.

**Subtasks:**
- [ ] `GET /users/search?u=<prefix>` — returns up to 10 matching usernames (case-insensitive)
- [ ] `POST /groups/:id/invite` — body `{ targetUsername? }`; if username given, creates a pending invite + in-app notification; if not, regenerates `invite_code`
- [ ] `POST /groups/join` — body `{ inviteCode }`; validates, inserts `group_memberships` if not already a member
- [ ] Deep link handling: `rivals://join/:code` on mobile; `/join/:code` on web

**Acceptance Criteria:**
- Admin invites Shreya by `@shreya_m`; she receives an in-app notification.
- Shreya opens invite link in Chrome → lands on join confirmation → accepts → becomes member.

**AI Prompt:**
> Add `GET /users/search` in `packages/api/src/modules/users/routes.ts`, ILIKE-matching `username` by prefix, limited to 10 rows and excluding the current user. Add `POST /groups/:id/invite` (admin only): when `targetUsername` is provided, look the user up and insert a `notifications` row of kind `group_invite` with payload `{ groupId, inviterUserId }`; otherwise regenerate `groups.invite_code` and return the new code. Add `POST /groups/join` that validates `inviteCode`, ensures the user isn't already an active member, and inserts a `group_memberships` row with role `member`. Configure Expo linking for `rivals://join/:code` and `https://rivals.app/join/:code`, then implement `JoinGroupScreen` that reads the code and calls `POST /groups/join`. Test all three flows end-to-end against staging.

**After completing:** `git add -A && git commit -m "feat(groups): invite by username + link/code join flow"`

---

### Task 02.4 — Admin actions: remove member, transfer, leave guard

**What:** Give admins fine-grained group control and prevent orphan groups.

**Subtasks:**
- [ ] `DELETE /groups/:id/members/:userId` — admin removes a member (soft-leave via `left_at`)
- [ ] `POST /groups/:id/transfer` — body `{ targetUserId }`; atomic swap of `admin_user_id` and memberships' roles
- [ ] `POST /groups/:id/leave` — current user leaves; if they are admin, 409 `ADMIN_MUST_TRANSFER`
- [ ] Mobile UI: Group Settings screen with member list + admin action buttons (remove, make admin)

**Acceptance Criteria:**
- Admin transferring to a non-member returns 400.
- Admin trying to leave without transferring returns 409 with a helpful code.

**AI Prompt:**
> Add three endpoints under `packages/api/src/modules/groups/routes.ts`: `DELETE /groups/:id/members/:userId` sets `group_memberships.left_at = now()` if the target is a member and the actor is admin (but the actor may not remove themselves — use 409 `USE_LEAVE_ENDPOINT`); `POST /groups/:id/transfer` in a single transaction updates `groups.admin_user_id` and swaps the two `group_memberships` roles between the outgoing and incoming admin; `POST /groups/:id/leave` sets the actor's `left_at` unless they are admin — in that case return 409 `ADMIN_MUST_TRANSFER`. Build `GroupSettingsScreen` in `apps/mobile` with a FlatList of members; admin rows show a kebab menu with "Remove" and "Make admin"; non-admin users see their own row with a "Leave group" button.

**After completing:** `git add -A && git commit -m "feat(groups): member removal, admin transfer, leave guard"`

---

### Task 02.5 — Habits CRUD and dashboard rendering

**What:** Implement habit creation and render today's cards on the group dashboard (no camera yet — cards show Pending / Completed states wired to a stub).

**Subtasks:**
- [ ] `POST /groups/:id/habits` — admin only; body `{ name, description?, graceDays }`
- [ ] `PATCH /habits/:id` — admin; edit or set `is_active = false`
- [ ] `GET /groups/:id/habits/today` — for current user: list active habits + `completedToday: boolean` + `inGrace: boolean`
- [ ] `GroupDashboardScreen` in `apps/mobile`: renders habit cards with state chips (Pending / Grace / Completed) — the Complete button is a stub that logs "Camera opens in Phase 3"

**Acceptance Criteria:**
- Admin creates two habits; both show up for every member on the dashboard within one polling cycle.
- Non-admin member sees a disabled "Add habit" button with tooltip.

**AI Prompt:**
> Implement `packages/api/src/modules/habits/routes.ts` with `POST /groups/:id/habits` (admin-only), `PATCH /habits/:id` (admin; can set `isActive`), and `GET /groups/:id/habits/today` which returns, for the requesting member, each active habit joined to their `habit_logs` where `log_date = today_in_user_tz` — include computed fields `completedToday` and `inGrace`. Grace computation: if missing today but the user has any active `habit_logs` in the last `graceDays+1` days, `inGrace = true`. Build `GroupDashboardScreen` in `apps/mobile/src/screens/groups` that fetches `/groups/:id/habits/today` via React Query (`refetchInterval: 60_000`) and renders a `HabitCard` with pending/grace/complete visuals. The Complete button fires a toast "Camera integration lands in Phase 3" — do not wire actual completion yet.

**After completing:** `git add -A && git commit -m "feat(habits): admin CRUD + today's dashboard cards"`

---

### Task 02.6 — Groups tab: multi-group list + empty state

**What:** The Groups tab lists all groups the user belongs to with basic stats; shows a rich empty state when they are in none.

**Subtasks:**
- [ ] `GroupsListScreen` fetching `GET /groups`
- [ ] Each row: avatar, name, member count, current user's streak, admin badge
- [ ] Empty state: "You're not in any groups yet — create one or join via invite"
- [ ] "Create group" CTA → `CreateGroupScreen`

**Acceptance Criteria:**
- A user in zero groups sees the empty state with both CTAs.
- A user in multiple groups sees all of them; tapping a row routes to `GroupDashboardScreen`.

**AI Prompt:**
> Build `apps/mobile/src/screens/groups/GroupsListScreen.tsx`: uses `useGroupsQuery()` (React Query, 60-s poll) to fetch `/groups`. Render rows with group avatar (fallback initials), name, member count, admin badge if applicable, and the user's current streak for the group. When the list is empty, render an illustrated empty state with two primary buttons: "Create a group" and "Join via invite link". Tapping a row navigates to `GroupDashboardScreen` with the group id in params. Add `CreateGroupScreen` with fields (name, description, avatar upload) calling `POST /groups`.

**After completing:** `git add -A && git commit -m "feat(groups): multi-group list with empty state"`

---

## Phase Checkpoint

Before moving to Task Sheet 03, verify:

- [ ] Admin creates a group → invites a second user by `@username` → user accepts → both appear in member list.
- [ ] Admin creates two habits → both show up for every member on the dashboard.
- [ ] Admin trying to leave without transferring returns the `ADMIN_MUST_TRANSFER` error.
- [ ] RLS policy tests from 02.1 all pass.
- [ ] Groups tab lists all user groups on mobile and web.
- [ ] All changes committed; staging auto-deploy succeeds.
