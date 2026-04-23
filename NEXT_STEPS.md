# Next Steps — Foundation handoff

Task Sheet 01 (`Vibe Code/01-task-foundation.md`) is implemented in code. A few
pieces need your hands — they require credentials or hardware I don't have.

## 1. Install and sanity-check

```bash
pnpm install
pnpm turbo run typecheck
```

Expect typecheck to pass after install; if Drizzle or React Native types
complain on first run, re-running `pnpm install` usually resolves workspace
linking.

## 2. Provision Supabase (staging)

1. Create a project `rivals-staging` at https://supabase.com.
2. Auth → Providers: enable **Email** and **Google**.
3. Storage → create a bucket `avatars` (public read, authenticated write).
4. Project Settings → API: copy `URL`, `anon key`, `service_role key`.
5. Project Settings → API → JWT: copy `JWT Secret` → set as `SUPABASE_JWT_SECRET`.
6. Project Settings → Database → Connection string (Direct): set as `DATABASE_URL`.

Create a `.env` at the repo root from `.env.example` and fill those in. Then:

```bash
pnpm --filter @rivals/api check-env     # should print "env ok"
pnpm --filter @rivals/api db:migrate    # applies 0001_init + 0002_rls
```

Verify in Supabase SQL editor:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
```

Every table should have `rowsecurity = t`.

## 3. Run the API locally

```bash
pnpm --filter @rivals/api dev
curl localhost:3000/health      # → {"status":"ok",...}
```

## 4. Run the app locally

```bash
pnpm --filter @rivals/mobile start
# press i (iOS sim) / a (Android emulator) / w (web)
```

Sign up → verify that the user row appears in `public.users`. Log out from
all devices → attempting the refresh flow with the old refresh token
should 401.

## 5. Google OAuth (optional for this phase)

In Supabase → Auth → Providers → Google:
- Create a Google Cloud OAuth client (Web + iOS + Android as needed).
- Set the redirect URL Supabase shows you in Google Cloud Console.
- Test by pressing "Continue with Google" on the Login screen.

First-time Google users will get a 409 `USERNAME_REQUIRED` — the client
flow to collect a username on first OAuth login lands as part of Task Sheet 02.

## 6. CI / deploy

The workflows in `.github/workflows/` assume these GitHub Action secrets:

- `RAILWAY_TOKEN` — Railway project token for the API.
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — web deploy.
- `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN` — baked into the static web bundle.

CI runs lint/typecheck/test on every PR. Deploys trigger on push to `main`.

## 7. Sentry (optional)

Add `SENTRY_DSN` (for API) and `EXPO_PUBLIC_SENTRY_DSN` (for mobile/web) to
your env — both inits are no-ops if unset.

## What's NOT done (by design — belongs to future task sheets)

- Groups, habits, photo upload, leaderboard, feed, notifications, badges.
- Permissive RLS policies (we're deny-by-default; service-role-key on the API
  is what makes reads work for now).
- Camera flow, R2 presigned uploads.
- App Store / Play Store listings.

See `Vibe Code/02-task-groups-and-habits.md` next.
