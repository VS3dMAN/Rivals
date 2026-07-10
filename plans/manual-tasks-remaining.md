# Rivals — Remaining manual tasks (yours) — 2026-07-11

This list supersedes `manual-tasks-01-to-04.txt` and `manual-tasks-complete-guide.txt`
as the *status* tracker — those files keep the detailed click-by-click steps.
Everything not listed here is done (see "Already handled" at the bottom).

## Tier 1 — blockers (app can't run end-to-end without these)

1. **Reset the Supabase database password** (~2 min) — NEW since the restore.
   The password in `.env` no longer works (`28P01` auth failure; likely lost in
   the pause/restore cycle). Dashboard → `rivals` project → Settings →
   Database → Reset database password. Paste the new one into `DATABASE_URL`
   in the root `.env`. Prefer alphanumeric to avoid URL-encoding issues.

2. **Cloudflare R2** (~15 min) — guide Task A1.
   Create bucket `rivals-proofs` + API token; fill `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` in `.env`.
   Until then proof-photo upload cannot work anywhere.

3. **Deploy the API to Render** (~10 min) — now one click via Blueprint.
   https://dashboard.render.com → New → Blueprint → pick the Rivals repo.
   `render.yaml` configures the service; paste the secret env values when
   prompted (same values as `.env`, with the new DB password). Note the
   service URL and put it in `EXPO_PUBLIC_API_URL`.

## Tier 2 — launch prerequisites

4. **Sentry projects** (~3 min) — your org blocks members (= my connector)
   from creating projects (HTTP 403). Either create two projects in the
   dashboard — `rivals-api` (platform: Node) and `rivals-app` (React Native) —
   and paste the DSNs into `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN`, or flip
   Settings → General → "Let members create projects" and tell Claude to
   finish it (projects, DSNs, alert rules from `infra/sentry/alert-rules.yml`).

5. **Firebase web push** (guide Task A8) — Firebase project, web app config,
   VAPID key → `apps/mobile/public/firebase-config.js` + env.

6. **PostHog** (guide Task A9) — free account, project API key →
   `EXPO_PUBLIC_POSTHOG_API_KEY` (mobile/web) and `POSTHOG_API_KEY` (API).

7. **Uptime Robot** (guide Task A7) — HTTP monitor on the Render `/health`
   URL every 5 min. This now serves double duty: `/health` runs a `SELECT 1`
   on every hit, so the pings keep BOTH the Render instance awake AND the
   Supabase free-tier DB warm (Supabase auto-pauses after ~7 days of no DB
   activity — this is what killed the project before). `/health` still
   returns 200 even if the DB is briefly unreachable; the JSON `db` field
   reports `ok` / `error` / `unconfigured` for real status.

8. **GitHub Actions secrets + variables** (guide Task A6, Railway parts now
   obsolete). Secrets: `EXPO_PUBLIC_*`, `CLOUDFLARE_API_TOKEN`,
   `CLOUDFLARE_ACCOUNT_ID`, optional `RENDER_DEPLOY_HOOK_URL`.
   Repo **variables** (new): set `CLOUDFLARE_CONFIGURED=true` and
   `RENDER_DEPLOY_HOOK_CONFIGURED=true` once the matching secrets exist —
   the deploy workflows deliberately skip until then so CI stays green.

## Tier 3 — when you decide to ship publicly

9. Custom domain `rivals.app` (guide Task A11).
10. Apple Developer ($99/yr) + Play Console ($25) accounts, EAS builds (A12).
11. Google OAuth redirect config (A13, optional until then).

## Verification (mostly Claude's, once Tier 1 is done)

- k6 load test (A14), EXPLAIN ANALYZE capture (A15), GDPR export/delete
  dry-run (A17) — Claude can run these against staging after Tier 1.
- Persona walkthroughs on real devices (A16) and the web-push E2E test (A18)
  need your hands/devices.

## Already handled (2026-07-10/11, by Claude)

- Supabase project restored from pause; **all 7 migrations applied** (0004,
  0006 had never been applied; 0007 is new); drizzle journal synced.
- All **6 pg_cron jobs** installed and active (was 1 of 6): pending-logs
  cleanup, streak grace reset, challenge activate / complete / ending-soon,
  streak-at-risk. Badges seeded, avatars bucket verified.
- Leaderboard backfill (A5): **not needed** — DB has zero rows.
- **Personal habits section built** (PRD §2.1): migration 0007, `/me/habits`
  API, My Habits tab replacing the placeholder Today tab.
- Lint debt zeroed (CI lint gate now passes), Railway → Render migration in
  CI + `render.yaml` blueprint added.
