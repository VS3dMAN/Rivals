# Task Sheet 07: Security, Hardening & Pre-Deployment

> **Phase Goal:** The full stack is audited, instrumented, and ready for the App Store, Play Store, and production. All three persona journeys pass on physical devices; no P0/P1 bugs; analytics dashboard live; security checklist signed off.
> **Prerequisites:** 01, 02, 03, 04, 05, 06
> **Estimated Effort:** 4–6 days

---

## Tasks

### Task 07.1 — Transport + at-rest encryption audit

**What:** Confirm TLS is enforced everywhere; secrets are rotated; at-rest encryption is on.

**Subtasks:**
- [ ] API forces `x-forwarded-proto: https` and responds 400 on plain HTTP; HSTS header set with 6-month max-age
- [ ] Supabase DB encryption at rest verified (provider-level)
- [ ] R2 bucket: verify server-side encryption is enabled
- [ ] Rotate any credentials that have been used in commits or CI logs; confirm nothing leaked in git history via `git log -p`
- [ ] Add a `security-checklist.md` under `Vibe Code/` tracking each item

**Acceptance Criteria:**
- `curl http://api.rivals.app/health` is redirected or rejected.
- `security-checklist.md` shows all items checked with timestamps.

**AI Prompt:**
> In `packages/api/src/server.ts`, add a `preHandler` hook that rejects requests where `request.headers['x-forwarded-proto'] !== 'https'` with 400 (only in production env). Add HSTS via `reply.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains; preload')` on every response. Verify Supabase encryption at rest via the dashboard — record evidence (screenshot path) in `Vibe Code/security-checklist.md`. Verify R2 SSE. Run `git log -p -- '**/.env*'` to confirm no secret ever landed; rotate `JWT_SECRET`, `R2_ACCESS_KEY_ID/SECRET`, `SUPABASE_SERVICE_ROLE_KEY` and update production env vars.

**After completing:** `git add -A && git commit -m "chore(security): tls enforcement + hsts + credential rotation"`

---

### Task 07.2 — RLS policy review + integration tests

**What:** Every table's RLS is audited. Integration tests run against a real test Supabase project covering cross-group isolation, admin-only mutations, and soft-delete access.

**Subtasks:**
- [ ] Script `packages/api/scripts/audit-rls.ts` listing every table with its policies
- [ ] Integration test file covering: (1) user in group A cannot read group B's logs, (2) non-admin cannot create habits, (3) a removed member cannot read the group's feed, (4) signed URL for a log is unreachable by non-members
- [ ] Fix any gap discovered

**Acceptance Criteria:**
- Audit script reports every table has at least one policy and no `deny_all` remains.
- All integration tests pass in CI.

**AI Prompt:**
> Add `packages/api/scripts/audit-rls.ts` that connects via service-role key and queries `pg_policies` + `pg_class.relrowsecurity`, printing a table of `(table, policies[], rls_enabled)`. Fail with exit code 1 if any public table has `rowsecurity=false` or policies count 0. Wire it into CI. Add `packages/api/src/__tests__/rls.integration.test.ts`: spin up two test users, create two groups (one per admin), insert logs in each, and assert that reads across boundaries fail. Assert that calling `GET /logs/:id/photo-url` as a non-member returns 404. Assert that removing a member revokes feed read access.

**After completing:** `git add -A && git commit -m "test(security): rls audit + integration tests"`

---

### Task 07.3 — Rate limiting stress test

**What:** Validate rate limits on hot endpoints (signup, login, log-upload-url, logs) and push-token registration.

**Subtasks:**
- [ ] `@fastify/rate-limit` configured per route: auth endpoints 10/min/IP; log endpoints 30/min/user; otherwise 100/min/IP
- [ ] k6 or Artillery script hammering `POST /logs/upload-url` to prove the limit kicks in
- [ ] Alert rule in Sentry for 429 spikes

**Acceptance Criteria:**
- A k6 script running 50 requests/second against `/logs/upload-url` receives 429s within seconds.

**AI Prompt:**
> Configure `@fastify/rate-limit` per-route in `packages/api/src/plugins/rate-limit.ts`: auth routes (`/auth/*`) — 10 req/min per IP; log routes — 30 req/min per user (keyed by `request.user.id`); default — 100/min per IP. Add a k6 script at `scripts/loadtest/rate-limit.js` that fires 50 RPS at `/logs/upload-url` for 30s and prints the 429 rate. Run against staging; record result. Add a Sentry alert for 429 rate > 1% over 5 minutes.

**After completing:** `git add -A && git commit -m "feat(security): per-route rate limits + stress test"`

---

### Task 07.4 — Input validation hardening

**What:** Every endpoint validates body, query, and params via zod; file-size and content-type checks on uploads.

**Subtasks:**
- [ ] Audit every route to confirm a zod schema is attached
- [ ] Photo upload: API confirms R2 object `content-length` ≤ 5 MB and `content-type` starts with `image/jpeg`; reject otherwise
- [ ] Reject usernames with Unicode homoglyphs / mixed scripts

**Acceptance Criteria:**
- Uploading a 10 MB JPEG is rejected at `POST /logs` with 422 `PHOTO_TOO_LARGE`.
- Uploading a `.pdf` as a log is rejected.

**AI Prompt:**
> In `POST /logs`, after the `HEAD` R2 call, inspect `ContentLength` and `ContentType` from the R2 response: if `ContentLength > 5 * 1024 * 1024` return 422 `PHOTO_TOO_LARGE`; if `!ContentType.startsWith('image/jpeg')` return 422 `PHOTO_BAD_TYPE`. Add the limit on the R2 presigned URL as well via `Conditions: [['content-length-range', 0, 5*1024*1024]]` if supported. Audit every route under `packages/api/src/modules/**/routes.ts` and add a zod `schema` option to any missing one. Tighten the username regex to reject mixed-script strings (add a check: all characters must be in `[a-z0-9_]`).

**After completing:** `git add -A && git commit -m "feat(security): input validation hardening"`

---

### Task 07.5 — GDPR/CCPA data export + delete

**What:** Users can export all their data as a JSON archive and fully delete their account with cascading cleanup.

**Subtasks:**
- [ ] `POST /me/export` enqueues a job; user receives email within 7 days with a signed download link to a JSON file in R2
- [ ] The export includes: profile, memberships, habit_logs (as metadata + signed URL to each photo valid 7 days), reactions, notification prefs
- [ ] `DELETE /me` schedules a 90-day purge: immediate soft-delete on `users`, memberships set to `left_at`, `habit_logs` user_id replaced with tombstone after 90 days, photos queued for R2 deletion
- [ ] UI flow in Profile → Privacy section

**Acceptance Criteria:**
- A test user can export and receive a downloadable JSON.
- After `DELETE /me`, the user cannot log in; their past posts in group feeds show as "Deleted user".

**AI Prompt:**
> Add `POST /me/export` creating a `data_export_jobs` row with status=`pending`; a pg_cron worker `packages/api/src/jobs/export-worker.ts` runs every 5 min, picks up pending jobs, builds a JSON archive with the user's profile, memberships, habit_logs metadata, reactions, prefs, writes it to R2 under `exports/{userId}/{jobId}.json` (24-h signed URL), and emails the user via Resend/Supabase. Add `DELETE /me`: immediately soft-delete `users` (`deleted_at`), set all memberships' `left_at`, revoke all tokens, insert rows into `purge_queue` for photos; a daily pg_cron job processes the purge after 90 days (delete photos, replace `user_id` in `habit_logs` with a tombstone uuid). In the UI, add `PrivacyScreen` under Profile with "Download my data" and "Delete my account" (requires typing username to confirm).

**After completing:** `git add -A && git commit -m "feat(privacy): gdpr data export + deletion cascade"`

---

### Task 07.6 — Analytics wiring for §12 KPIs

**What:** Instrument the key events that answer the PRD's success metrics.

**Subtasks:**
- [ ] Select PostHog (or Mixpanel / Amplitude) and add SDK to mobile + web + API server events
- [ ] Event set: `user_signed_up`, `group_created`, `group_joined`, `habit_created`, `log_submitted`, `log_rejected_clock_skew`, `leaderboard_viewed`, `push_received`, `push_opened`, `streak_milestone`, `challenge_window_created`, `challenge_window_completed`, `account_deleted`
- [ ] Each event carries `{ userId, groupId?, platform, appVersion }`
- [ ] Build a dashboard with D1/D7 retention, logs-per-user-per-day, rejection rate, active-groups/user, notification click-through

**Acceptance Criteria:**
- After an hour of staging usage, the dashboard shows the events and a retention curve.

**AI Prompt:**
> Choose PostHog (self-hostable, supports mobile + web + server). Add `posthog-js` to web, `posthog-react-native` to mobile, and `posthog-node` to API. Create `packages/shared/src/analytics.ts` with a thin `track(event, props)` helper; invoke it at each event point listed. On the API side, track server-authoritative events (`log_submitted`, `log_rejected_clock_skew`, `challenge_window_completed`) — these are more trustworthy than client events. Build a PostHog dashboard with: D1/D7 retention of invited members, median logs/user/day, `log_rejected_clock_skew` rate, median group active-member count at week 2, push open-through rate.

**After completing:** `git add -A && git commit -m "feat(analytics): posthog wiring + dashboards"`

---

### Task 07.7 — Performance audit

**What:** Verify every index exists, run EXPLAIN on hot queries, and run a load test on proof-photo submission.

**Subtasks:**
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` on the five highest-frequency queries: leaderboard, feed, habits/today, log insert, signed URL issue
- [ ] Confirm indexes from §2.4 in `00-architecture-and-timeline.md` all exist in production
- [ ] k6 load test: 500 concurrent users each submitting a proof photo within a 30-second window
- [ ] Success criteria: p95 latency for `POST /logs` < 800 ms under load

**Acceptance Criteria:**
- All EXPLAIN plans use index scans for the ORDER BY leaderboard query and `habits/today` check.
- k6 report shows p95 < 800 ms and error rate < 1%.

**AI Prompt:**
> Add `packages/api/scripts/explain-hot-queries.sql` with EXPLAIN (ANALYZE, BUFFERS) for: (1) `/groups/:id/leaderboard` query, (2) `/groups/:id/feed` query, (3) `/groups/:id/habits/today` query, (4) log insert + recomputeScores, (5) `POST /logs/upload-url`. Run against staging with production-shaped data (seed 500 users, 50 groups, 10k logs). Record the plans in `Vibe Code/perf-report.md`. Add missing indexes (§2.4 in the architecture doc) as a migration if any are absent. Write a k6 script at `scripts/loadtest/proof-upload.js` simulating 500 VUs each calling `upload-url` → PUT a small JPEG → `POST /logs` once. Target p95 < 800 ms, error rate < 1%.

**After completing:** `git add -A && git commit -m "perf(api): explain + load-test + missing indexes"`

---

### Task 07.8 — End-to-end persona testing

**What:** Each of the three personas completes a realistic journey on a physical iOS device, physical Android device, and Chrome.

**Subtasks:**
- [ ] Script `Vibe Code/e2e-personas.md` with each persona's journey (Aryan: create group, invite 3, set gym habit, track week; Shreya: accept invite, log 5 days, miss 1 with grace, continue; Rohan: create challenge window, maintain #1)
- [ ] Run each journey manually on iPhone + Android + Chrome
- [ ] Log bugs; fix all P0/P1 before proceeding

**Acceptance Criteria:**
- All three journeys complete end-to-end on all three platforms with zero P0/P1 bugs.

**AI Prompt:**
> Write `Vibe Code/e2e-personas.md` with three explicit test scripts mirroring the personas in the PRD. Each script lists: prerequisite state, step-by-step actions (including "wait 60 s for leaderboard to refresh"), and expected observations. Execute each on: (1) physical iPhone (Expo dev client or TestFlight build), (2) physical Android, (3) Chrome desktop — record results in a status table (`Pass | Fail | Bug-ID`). Fix every discovered P0/P1 bug and re-test.

**After completing:** `git add -A && git commit -m "test(e2e): persona journeys pass on all platforms"`

---

### Task 07.9 — App Store + Play Store + web hosting prep

**What:** All store metadata, icons, screenshots, privacy usage strings, and hosting configuration ready for submission.

**Subtasks:**
- [ ] App icon + splash screen finalized (mobile) per EAS configuration
- [ ] Screenshots captured: 6 per platform at required resolutions
- [ ] App Store: camera usage justification, privacy labels (data collected), age rating (12+), demo account for review
- [ ] Play Store: store listing, data safety form, content rating, signed AAB via EAS Build
- [ ] Web: custom domain `rivals.app` on Cloudflare Pages, SSL via CF, www → apex redirect
- [ ] Legal pages: Privacy Policy, Terms of Service published at `rivals.app/privacy` and `/terms`

**Acceptance Criteria:**
- TestFlight build approved for internal testing.
- Play Internal Testing track live with build.
- `rivals.app` loads over HTTPS with valid certificate.

**AI Prompt:**
> Configure EAS Build (`eas.json`) with production profiles for iOS and Android. Export icons/splash at required resolutions via `expo-app-icon-utils`. Add `app.config.ts` entries for `NSCameraUsageDescription`, `NSPhotoLibraryAddUsageDescription: null` (explicitly none), `android.permissions: ['CAMERA', 'INTERNET']`. Create `Vibe Code/store-assets/` with store copy, 6 screenshots per platform (use Fastlane snapshot or manual capture), data-safety answers. Publish Privacy Policy + TOS as Markdown rendered by the web app at `/privacy` and `/terms`. Add `rivals.app` to Cloudflare Pages and set up DNS.

**After completing:** `git add -A && git commit -m "chore(launch): store + web hosting prep"`

---

### Task 07.10 — Production deploy + smoke test + monitoring alerts

**What:** Deploy to production for the first time, run a smoke test, and configure alerts.

**Subtasks:**
- [ ] Provision production Supabase project; run all migrations; seed badges
- [ ] Provision production R2 bucket + CORS
- [ ] Railway production environment; env vars set; first deploy
- [ ] Sentry project for production; alert rules: any new issue pages on-call; error rate > 1% for 5 min alerts; `POST /logs` p95 > 1.5s alerts
- [ ] Smoke test: create an admin, create a group, invite yourself via second account, log a proof, see leaderboard update
- [ ] Documentation: `README.md` + a `docs/runbook.md` describing rollback, common incidents

**Acceptance Criteria:**
- Production is up with a green `/health`.
- Smoke test passes end-to-end on production.
- Alert rules configured and silent (no false positives over 24 h).

**AI Prompt:**
> Provision production Supabase + R2. Set production env vars in Railway (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_*`, `JWT_SECRET`, `FCM_*`, `APNS_*`, `SENTRY_DSN`, `POSTHOG_KEY`). Deploy the API and web by creating a release tag; confirm GitHub Actions pushes to production targets. Run the db migration + badge seed scripts. Configure Sentry alerts: any new issue, `api.errors > 1% for 5min`, `route.logs p95 > 1500ms`. Execute the smoke test described in the task and record pass/fail in `Vibe Code/production-launch-report.md`. Write `docs/runbook.md` with rollback steps (Railway "rollback to previous deployment"), DB incident procedures, and a paging contact list.

**After completing:** `git tag v1.0.0 && git push --tags`

---

## Phase Checkpoint

Final sign-off before launch:

- [ ] All three persona journeys pass on iOS, Android, Chrome.
- [ ] Zero P0 or P1 bugs open.
- [ ] `security-checklist.md` fully checked and dated.
- [ ] RLS audit script exits clean; integration tests green in CI.
- [ ] k6 load test: p95 < 800ms, error rate < 1%.
- [ ] Analytics dashboard shows correct KPIs on staging traffic.
- [ ] TestFlight + Play Internal tracks have working builds.
- [ ] `rivals.app` loads over HTTPS; Privacy + TOS live.
- [ ] Production smoke test passes.
- [ ] Sentry alerts configured and quiet.
- [ ] Runbook written; rollback procedure tested on staging.

> **Launch:** tag `v1.0.0`, submit iOS to App Store Review, promote Android to Open Testing, announce.
