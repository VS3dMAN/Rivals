# Rivals — AI Coding Agent Guide

Drop this file at the repo root. Every AI session should read it before editing code.

## Stack

- Mobile: React Native (Expo managed workflow), TypeScript, React Navigation 6
- Web: React Native Web via Expo for Web
- API: Node.js 20 + Fastify, TypeScript strict mode
- DB: Supabase PostgreSQL + Supabase Auth; RLS enabled on every table
- ORM: Drizzle; migrations in `packages/api/src/db/migrations`
- State: Zustand (client) + TanStack React Query (server), 60-s polling, no WebSockets in MVP
- Object store: Cloudflare R2 via AWS SDK v3; presigned URLs only
- Push: FCM + APNs (web via FCM Web SDK + service worker)
- Scheduled jobs: pg_cron inside Supabase (no BullMQ/Redis)
- Monorepo: pnpm workspaces + Turborepo

## Folder rules

- `apps/mobile` — Expo app; platform-specific files use `.ios.tsx` / `.android.tsx` / `.web.tsx`
- `apps/web` — thin shell around the mobile codebase's Expo for Web
- `packages/api` — Fastify modular monolith; one folder per module under `src/modules`
- `packages/shared` — zod schemas, shared types, hooks that run on every platform
- `packages/ui` — RN components shared by mobile + web
- Never introduce circular deps across packages

## Naming

- Files: `kebab-case.ts` (utils, services), `PascalCase.tsx` (React components)
- Types/Interfaces: `PascalCase`
- Variables / functions: `camelCase`
- DB tables: `snake_case_plural`; columns `snake_case`
- React Query keys: `['<domain>', ...params]` e.g. `['leaderboard', groupId]`

## Conventions

- No default exports except for React screens; prefer named exports
- No barrel files (`index.ts` re-exports) — they hurt tree-shaking and confuse Metro
- No dynamic imports at module scope
- Every API endpoint has a zod schema in `packages/shared/src/zod/` that both sides use
- Every new table gets RLS enabled + policies in the same migration as the schema
- Every task producing working code ends with a git commit; commits follow Conventional Commits

## Libraries we prefer

- shadcn-style RN primitives in `packages/ui` (no MUI, no NativeBase)
- `@tanstack/react-query` for server state; do not hand-roll fetch hooks
- `zod` for validation; never `joi`, `yup`, `io-ts`
- `drizzle-orm`; do not introduce Prisma or raw TypeORM
- `expo-camera` for mobile capture; `MediaDevices` for web
- `expo-secure-store` (mobile) / `document.cookie` (web) for session tokens — via `packages/shared/src/session.ts`

## Security rules (non-negotiable)

- Client timestamps are for watermark display only. Server timestamp is authoritative.
- Reject log uploads with `|server - client| > 5 min` clock skew (422 `CLOCK_SKEW`)
- Gallery access is never requested on any platform
- RLS deny-by-default then explicit allow; no service-role key in client code
- Proof photos accessed only via time-limited signed GET URLs (1-hour TTL)
- All env-var schemas validated at startup via `packages/shared/src/env.ts`

## Commands

```
pnpm install                              # bootstrap
pnpm turbo run lint typecheck test        # CI gate
pnpm --filter @rivals/api run dev         # start API
pnpm --filter @rivals/mobile run ios      # run on iOS simulator
pnpm --filter @rivals/mobile run android  # run on Android device
pnpm --filter @rivals/web run dev         # start web
pnpm --filter @rivals/api exec drizzle-kit generate    # new migration
pnpm --filter @rivals/api exec drizzle-kit migrate     # apply
```

## References

- PRD: `Master_PRD_Rivals_Updated.docx` (repo root)
- Architecture + timeline: `Vibe Code/00-architecture-and-timeline.md`
- Task sheets: `Vibe Code/01-task-foundation.md` … `07-task-security-and-launch.md`

Work the task sheets in order. Do not reference work from a later-numbered sheet.
