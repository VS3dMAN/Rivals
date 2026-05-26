# Rivals — Production Runbook

Audience: whoever is on-call. Read top-to-bottom before touching production.

## Service map

| Layer | Provider | Notes |
|---|---|---|
| API | Railway (Fastify, Node 20) | auto-deploys from `main` via `deploy-api.yml` |
| DB | Supabase Postgres | RLS-enforced, pg_cron jobs scheduled |
| Photo storage | Cloudflare R2 (`rivals-proofs`) | signed-URL PUT, signed-URL GET |
| Avatars | Supabase Storage (`avatars` bucket) | public read, owner-scoped write |
| Mobile distribution | EAS Build → App Store / Play | channels: `production`, `preview` |
| Web | Cloudflare Pages | static export from `apps/mobile/dist` |
| Push (native) | Expo Push | tokens stored in `push_tokens` |
| Push (web) | FCM HTTP v1 | service-account JSON in API env |
| Error monitoring | Sentry | mobile + API projects |
| Analytics | PostHog | mobile + server-side |

## Deploy

1. Merge to `main`.
2. GitHub Actions runs `ci.yml` (lint + typecheck + tests). Block on red.
3. `deploy-api.yml` ships API to Railway.
4. `deploy-web.yml` builds Expo web and uploads to Cloudflare Pages.
5. Mobile: trigger `eas build --profile production --platform all`, then `eas submit`.

Hand-pulled smoke test post-deploy:
```
pnpm --filter @rivals/api exec ts-node src/scripts/smoke-prod.ts
```

## Rollback

API:
1. Railway → Deployments → previous green deploy → "Redeploy".
2. If DB migration shipped with the bad release, prepare a forward-fix migration; do not roll back migrations except as a last resort.

Web:
1. Cloudflare Pages → Deployments → previous deploy → "Rollback".

Mobile:
1. App Store / Play: stop further rollout; users on the bad version persist until forced update via runtime flag.

## On-call escalation

1. **PagerDuty (or Sentry alert recipient) wakes.** Acknowledge.
2. Check Sentry dashboard for the breaking issue group.
3. Tail Railway logs: `railway logs --service api`.
4. If DB is implicated: open Supabase dashboard → Logs → SQL.
5. If R2 is implicated: check Cloudflare R2 metrics + the `proof-upload-failure` Sentry alert.
6. If you can patch in < 30 min, do it. Else roll back.
7. Post a status update internally; if user-facing impact > 15 min, draft a status page entry.

## Health checks

- `GET /health` returns 200 with build SHA and uptime.
- Supabase: `SELECT 1` from SQL editor.
- R2: `aws s3 ls s3://rivals-proofs --endpoint-url ...` (R2 creds).
- Push (native): trigger a test notification from `/admin/push/test` (admin-only).
- Push (web): trigger via dispatcher with a known web token.

## Common incidents

- **Photo upload 5xx burst** → check R2 status page, then Cloudflare API token quota, then API logs for signed-URL generation errors.
- **Leaderboard scores stuck at 0** → cron job `challenge-activate` / `challenge-complete` may be unscheduled. Verify with `SELECT * FROM cron.job;`. Re-run `packages/api/src/jobs/challenge-transitions.sql` if missing.
- **Auth failures spike** → check Supabase Auth status; verify `WEB_ORIGIN` env hasn't drifted.
- **Push silence** → check `push_tokens` is being populated; check FCM service-account JSON validity.

## Backups & recovery

Supabase takes daily backups (7-day retention). To restore: open project → Database → Backups → choose a point. R2 is single-region; the application is the source of truth — there is no separate photo backup. Losing a photo is recoverable from the user re-submitting their proof.

## Secrets rotation

Quarterly: rotate `R2_SECRET_ACCESS_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAILWAY_TOKEN`, `CLOUDFLARE_API_TOKEN`. Update both `.env` and Railway / GitHub Secrets, then redeploy.

## Contacts

- On-call rotation: see PagerDuty schedule "Rivals primary".
- Status page: status.rivals.app.
- Security: security@rivals.app.
- Privacy: privacy@rivals.app.
