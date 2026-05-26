# Rivals — Security Checklist

Last audited: 2026-05-26.

## Transport & headers
- [x] `@fastify/helmet` registered in [server.ts](../packages/api/src/server.ts) with `contentSecurityPolicy: false` for API
- [x] HSTS — `maxAge: 31536000, includeSubDomains: true, preload: true`
- [x] `x-forwarded-proto` → HTTPS redirect when `NODE_ENV !== 'development'`
- [x] CORS allow-list driven by `WEB_ORIGIN` env

## Authentication
- [x] JWT access tokens (Supabase) + refresh-token rotation
- [x] Rate-limited login (10 / 15 min) and signup (5 / hour)
- [x] Username regex + reserved-name blocklist in [packages/shared/src/zod/auth.ts](../packages/shared/src/zod/auth.ts)
- [x] Username is ASCII-only — mixed-script / homoglyph rejection

## Row-Level Security
- [x] All user-data tables have RLS enabled
- [x] Positive + negative policy tests in [packages/api/src/db/tests/policies.test.ts](../packages/api/src/db/tests/policies.test.ts) covering `habit_logs`, `feed_events`, `feed_reactions`, `leaderboard_scores`, `notifications`, `push_tokens`, `user_badges`, `groups`, `group_memberships`, `habits`
- [x] Anon-role audit script: [packages/api/src/scripts/audit-rls.ts](../packages/api/src/scripts/audit-rls.ts) — run `pnpm --filter @rivals/api exec ts-node src/scripts/audit-rls.ts`

## Rate limits

| Route | Limit |
|---|---|
| `POST /auth/signup` | 5 / hour |
| `POST /auth/login` | 10 / 15 min |
| `POST /logs/upload-url` | 30 / min |
| `POST /logs` | 60 / min |
| `POST /groups/:id/invite` | 20 / hour |
| Global default | 100 / min |

## Upload hardening
- [x] `Content-Length` ≤ `MAX_PHOTO_BYTES` (10 MB) enforced in `/logs/upload-url`
- [x] `Content-Type` allow-list: `image/jpeg`, `image/png`, `image/webp`
- [x] R2 bucket has CORS scoped to web origin; signed-URL PUT only
- [x] Avatars bucket uses Supabase RLS — user can only write under their own `auth.uid()` folder

## GDPR / CCPA
- [x] `POST /me/export` — enqueues job, returns id
- [x] `GET /me/export/:id` — status + signed download URL
- [x] `DELETE /me` — soft-deletes user, anonymises logs, enqueues R2 purge, revokes refresh tokens
- [x] `data_export_jobs` and `purge_queue` tables migrated
- [x] Signup consent checkbox + Privacy/TOS links in `SignUpScreen.tsx`
- [x] `PrivacyScreen` linked from Profile with Export and Delete actions

## Telemetry & monitoring
- [x] Sentry SDK wired (mobile + API) — DSN driven by env
- [x] PostHog analytics SDK wired in mobile
- [ ] Sentry alert rules deployed (see `infra/sentry/`)
- [ ] PostHog dashboards configured for KPI events

## Pre-deploy checklist
- [ ] All secrets present in Railway and GitHub Actions
- [ ] Supabase RLS audit script: zero leaks
- [ ] k6 load test: P95 < 90 s, error rate < 2 %
- [ ] Smoke test against staging: [smoke-prod.ts](../packages/api/src/scripts/smoke-prod.ts) passes
- [ ] Sentry release tagged; source maps uploaded
