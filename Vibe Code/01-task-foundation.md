# Task Sheet 01: Foundation & Infrastructure

> **Phase Goal:** The empty monorepo is deployable on iOS, Android, and web; a user can sign up, log in, navigate all four tabs, update their profile, and log out from all devices.
> **Prerequisites:** None
> **Estimated Effort:** 4–6 days

---

## Tasks

### Task 01.1 — Scaffold pnpm + Turborepo monorepo

**What:** Create the top-level monorepo with workspaces for mobile, web, API, shared types, and a shared UI package. Initialize git, `.gitignore`, root TypeScript config, and Turborepo pipeline.

**Subtasks:**
- [ ] `pnpm init` in project root; add `pnpm-workspace.yaml` listing `apps/*` and `packages/*`
- [ ] Install Turborepo; add `turbo.json` with `build`, `lint`, `typecheck`, `test`, `dev` pipelines
- [ ] Add root `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] Add root ESLint + Prettier config shared via `packages/config`

**Acceptance Criteria:**
- `pnpm install` succeeds from a clean clone.
- `pnpm turbo run lint` completes even though packages are empty.

**AI Prompt:**
> Scaffold a pnpm + Turborepo monorepo named `rivals` with workspaces `apps/mobile`, `apps/web`, `packages/api`, `packages/shared`, `packages/ui`, `packages/config`. Create `pnpm-workspace.yaml`, `turbo.json` with pipelines `build`, `lint`, `typecheck`, `test`, `dev`, a root `tsconfig.base.json` with `strict: true` and `noUncheckedIndexedAccess: true`, and shared ESLint + Prettier configs exported from `packages/config`. Initialize git with a Node + Expo `.gitignore`. Do not create any app code yet.

**After completing:** `git add -A && git commit -m "chore: scaffold pnpm/turborepo monorepo"`

---

### Task 01.2 — Provision Supabase project and configure env

**What:** Create a Supabase project for staging, enable Auth (email + Google), record connection strings, and add env handling.

**Subtasks:**
- [ ] Create Supabase project `rivals-staging`; enable email + Google providers
- [ ] Create Storage bucket `avatars` (public read, authenticated write)
- [ ] Add `.env.example` at root listing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Add `dotenv` loading in `packages/api` and expose typed env via `packages/shared/src/env.ts`

**Acceptance Criteria:**
- `pnpm --filter @rivals/api exec ts-node scripts/check-env.ts` prints "env ok".

**AI Prompt:**
> In `packages/shared/src/env.ts`, define a zod schema `envSchema` that validates `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, and exports `Env` typed from it. Add a tiny script at `packages/api/scripts/check-env.ts` that loads `.env` via `dotenv` and validates it using the schema, printing "env ok" on success and throwing on any missing/invalid keys. Also create `.env.example` at the repo root with the same keys and placeholder values.

**After completing:** `git add -A && git commit -m "feat(infra): provision supabase + typed env loader"`

---

### Task 01.3 — Define Drizzle schema and run first migration

**What:** Translate every entity in `00-architecture-and-timeline.md §2.3` into Drizzle ORM table definitions and generate + apply the initial migration.

**Subtasks:**
- [ ] Add Drizzle + `postgres`/`pg` drivers to `packages/api`
- [ ] Create `packages/api/src/db/schema/*.ts` — one file per entity (users, groups, memberships, habits, habit_logs, streaks, leaderboard_scores, challenge_windows, feed_events, feed_reactions, notifications, push_tokens, badges, user_badges)
- [ ] Configure `drizzle.config.ts` pointing at Supabase DB URL
- [ ] Run `drizzle-kit generate` → commit the SQL; run `drizzle-kit migrate` against staging
- [ ] Enable RLS on every table; add deny-by-default policy as a SQL migration alongside the schema

**Acceptance Criteria:**
- `SELECT tablename FROM pg_tables WHERE schemaname = 'public'` returns all v1 tables.
- Every table has `rowsecurity = true` in `pg_class`.

**AI Prompt:**
> In `packages/api/src/db/schema`, create Drizzle table definitions matching the data model in `Vibe Code/00-architecture-and-timeline.md §2.3`. Use `uuid` PKs with `defaultRandom()`, `timestamptz` with `defaultNow()`, and citext for `username` + `email`. Configure `drizzle.config.ts` for Supabase. Generate the initial migration to `packages/api/src/db/migrations/0001_init.sql`, then append `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` plus a `CREATE POLICY deny_all ... USING (false) WITH CHECK (false);` for every table. Apply the migration with `drizzle-kit migrate` against the staging Supabase DB.

**After completing:** `git add -A && git commit -m "feat(db): initial schema with RLS deny-by-default"`

---

### Task 01.4 — Bootstrap Fastify API with health + auth middleware

**What:** Stand up the Fastify server, wire a JWT-verification plugin against Supabase, and expose `/health` and `/me`.

**Subtasks:**
- [ ] Create `packages/api/src/server.ts` with Fastify, `fastify-sensible`, `@fastify/cors`, `@fastify/rate-limit`
- [ ] Add `plugins/auth.ts` that verifies Supabase JWT (JWKS or shared secret) and attaches `request.user`
- [ ] Route `/health` (public) returns `{ status: "ok", version, uptimeSeconds }`
- [ ] Route `/me` (protected) returns the `users` row for `request.user.id`
- [ ] Unit test both routes with `tap` or `vitest`

**Acceptance Criteria:**
- `curl localhost:3000/health` → 200 JSON.
- `curl -H 'Authorization: Bearer <invalid>' localhost:3000/me` → 401.

**AI Prompt:**
> In `packages/api`, create `src/server.ts` that exports a `buildServer()` factory returning a configured Fastify instance with `@fastify/cors`, `@fastify/rate-limit` (100 req/min per IP), and `fastify-sensible`. Add `src/plugins/auth.ts` as a Fastify plugin that verifies Supabase-issued JWTs using `SUPABASE_JWT_SECRET` and decorates `request.user` with `{ id, email }`. Add `src/modules/health/routes.ts` (public `GET /health`) and `src/modules/users/routes.ts` (`GET /me`, protected). Entry file `src/index.ts` calls `buildServer().listen({ port: 3000 })`. Add vitest tests for both routes (200 for /health, 401 for /me with bad token, 200 with a test JWT).

**After completing:** `git add -A && git commit -m "feat(api): fastify bootstrap with health + /me"`

---

### Task 01.5 — Implement auth flows (signup, login, Google, logout-all)

**What:** Implement the HTTP surface for auth, leveraging Supabase Auth as the identity provider and storing the per-user `users` row.

**Subtasks:**
- [ ] `POST /auth/signup` — email/password + chosen username; on Supabase success, insert `users` row
- [ ] `POST /auth/login` — delegates to Supabase; returns access + refresh token
- [ ] OAuth Google callback → `users` upsert + JWT return
- [ ] `POST /auth/logout-all` — revoke all refresh tokens for current user
- [ ] Username uniqueness enforced by `citext UNIQUE` + pre-check endpoint `GET /auth/username-available`

**Acceptance Criteria:**
- Creating two users with the same username (different case) fails with 409.
- `logout-all` invalidates prior refresh tokens (next refresh returns 401).

**AI Prompt:**
> Implement `packages/api/src/modules/auth/routes.ts` with: `POST /auth/signup` (body: `{ email, password, username, displayName }`, validates username regex `^[a-z0-9_]{3,24}$`, calls `supabase.auth.signUp`, inserts a `users` row, returns the JWT); `POST /auth/login` (proxies to `supabase.auth.signInWithPassword`); `GET /auth/username-available?u=<name>`; `POST /auth/logout-all` (protected, calls `supabase.auth.admin.signOut(userId, 'global')`). Handle the case where username is taken by returning 409 with `{ code: 'USERNAME_TAKEN' }`. Add zod validation schemas to `packages/shared/src/zod/auth.ts` and reuse them on the API side.

**After completing:** `git add -A && git commit -m "feat(auth): signup/login/google/logout-all"`

---

### Task 01.6 — Scaffold Expo mobile app with React Navigation tabs

**What:** Create the Expo managed workflow app with four-tab bottom navigator and placeholder screens.

**Subtasks:**
- [ ] `pnpm create expo apps/mobile --template blank-typescript`
- [ ] Install React Navigation 6 + bottom-tabs + stack + safe-area-context
- [ ] Create `Dashboard`, `Groups`, `Notifications`, `Profile` placeholder screens
- [ ] Add `ThemeProvider` with dark-as-default (navy + amber)
- [ ] Wire React Query + Zustand providers at app root

**Acceptance Criteria:**
- App runs on `expo start --ios` and `--android`; tapping tabs switches screens.
- React Query dev tools visible in dev builds.

**AI Prompt:**
> Scaffold an Expo managed workflow app at `apps/mobile` using TypeScript. Add React Navigation 6 with a bottom tab navigator containing four tabs: Dashboard, Groups, Notifications, Profile. Each tab is a stack navigator wrapping a placeholder screen with its name. Set up `@tanstack/react-query` with a `QueryClientProvider` at the root and `@react-native-async-storage/async-storage` for persistent cache. Add a Zustand store at `src/stores/session.ts` with placeholder `{ user, setUser }`. Theme default is dark with navy `#0B1220` background and amber `#F59E0B` accent. Do not implement any feature logic yet.

**After completing:** `git add -A && git commit -m "feat(mobile): expo scaffold with nav + providers"`

---

### Task 01.7 — Scaffold web app via Expo for Web

**What:** Enable the web target on the same Expo codebase and verify all four tabs render in Chrome.

**Subtasks:**
- [ ] Enable `web` in `apps/mobile/app.config.ts` OR create `apps/web` that re-exports from mobile
- [ ] Configure `react-native-web` + `@expo/webpack-config`
- [ ] Wire localStorage persister for React Query
- [ ] Add responsive container constraining max width on desktop

**Acceptance Criteria:**
- `pnpm --filter @rivals/web run dev` opens a browser at localhost and all four tabs render.

**AI Prompt:**
> Configure Expo for Web on the existing `apps/mobile` codebase by enabling the `web` platform in `app.config.ts` and adding `react-native-web`. Create a thin `apps/web` package that exports an `index.html` entry and runs `expo start --web`. Swap React Query's AsyncStorage persister for a localStorage persister when `Platform.OS === 'web'`. Constrain the max content width to 960px on desktop via a shared `ResponsiveContainer` in `packages/ui`. Verify all four tabs render in Chrome.

**After completing:** `git add -A && git commit -m "feat(web): expo for web shell with responsive container"`

---

### Task 01.8 — Wire auth UI end-to-end on all platforms

**What:** Build the login + signup + profile screens that call the API from Task 01.5 and persist the session.

**Subtasks:**
- [ ] `SignUpScreen` with fields (email, password, username, display name) + client zod validation
- [ ] `LoginScreen` with email/password + Google button
- [ ] `ProfileScreen` with current user, avatar upload (Supabase Storage), display name edit, "Log out from all devices" button
- [ ] Store session JWT in SecureStore (mobile) / cookie (web)
- [ ] React Query hook `useCurrentUser()` fetching `/me`

**Acceptance Criteria:**
- A brand-new user can sign up on Android, log out, log back in, and see their profile.
- Google OAuth round-trip works on iOS and Chrome.

**AI Prompt:**
> Build sign-up, login, and profile screens in `apps/mobile/src/screens/auth` and `.../profile`. Use the zod schemas from `packages/shared/src/zod/auth.ts`. Session tokens: use `expo-secure-store` on native and `document.cookie` (Secure, SameSite=Lax) on web — abstract behind `packages/shared/src/session.ts`. Add `useCurrentUser` in `packages/shared/src/hooks/useCurrentUser.ts` that fetches `GET /me` via React Query. Wire the "Log out from all devices" button to `POST /auth/logout-all` and clear local session on success. Verify Google OAuth by configuring the Supabase Google provider's redirect URL.

**After completing:** `git add -A && git commit -m "feat(auth): signup/login/profile UI with session persistence"`

---

### Task 01.9 — Set up CI (lint, typecheck, test) and staging deploy

**What:** Add GitHub Actions workflows that run on every PR and deploy `main` to a staging API + web environment.

**Subtasks:**
- [ ] `.github/workflows/ci.yml`: install pnpm → `turbo run lint typecheck test`
- [ ] `.github/workflows/deploy-api.yml`: deploy `packages/api` to Railway on push to `main`
- [ ] `.github/workflows/deploy-web.yml`: build Expo web and deploy to Cloudflare Pages
- [ ] Branch protection on `main` requires CI green
- [ ] Add `SENTRY_DSN` env var; initialize Sentry in API, mobile, and web

**Acceptance Criteria:**
- Opening a PR triggers CI; merging to `main` auto-deploys API + web to staging.
- A thrown error in staging appears in Sentry.

**AI Prompt:**
> Create three GitHub Actions workflows in `.github/workflows/`: (1) `ci.yml` runs on every PR — sets up Node 20 + pnpm, installs deps, runs `pnpm turbo run lint typecheck test`. (2) `deploy-api.yml` on push to `main` uses the Railway CLI (`railway up --service rivals-api`) with `RAILWAY_TOKEN` secret. (3) `deploy-web.yml` on push to `main` runs `pnpm --filter @rivals/web exec expo export --platform web` then deploys `dist/` to Cloudflare Pages via `wrangler pages deploy`. Add Sentry initialization in `packages/api/src/server.ts`, `apps/mobile/src/index.ts`, and the web entry, each using `SENTRY_DSN` from env. Enable branch protection requiring `ci` to pass.

**After completing:** `git add -A && git commit -m "ci: add lint/typecheck/test + staging deploy pipelines"`

---

## Phase Checkpoint

Before moving to Task Sheet 02, verify:

- [ ] `pnpm install` + `pnpm turbo run lint typecheck test` all green.
- [ ] iOS simulator, Android device, and Chrome all show working auth and four tabs.
- [ ] Staging API responds to `/health` (200) and `/me` with a real JWT.
- [ ] A new user can complete signup → email verification → login → profile edit → logout-all.
- [ ] All v1 tables visible in Supabase; RLS enabled on each; deny-by-default policies present.
- [ ] Sentry receives a deliberately thrown test error from staging.
- [ ] All changes committed to `main`; auto-deploy to staging succeeds.
