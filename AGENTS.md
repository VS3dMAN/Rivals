# AGENTS.md — Rivals repo conventions

Short instructions for coding agents and humans working in this repo.

## Structure

- `apps/mobile` — Expo managed workflow (iOS, Android, and **Web** via `react-native-web`).
- `apps/web` — thin wrapper that calls the mobile workspace's web scripts.
- `packages/api` — Fastify HTTP API (modular monolith). Entry: `src/index.ts`.
- `packages/shared` — zod schemas, env parsing, hooks shared between API and apps.
- `packages/ui` — shared RN components (`ResponsiveContainer` etc.).
- `packages/config` — ESLint + Prettier shared config.
- `Vibe Code/` — task sheets + architecture plan (source of truth for what to build).

## Golden rules

1. **Schema is in `Vibe Code/00-architecture-and-timeline.md §2.3`.** If you change a table, update the Drizzle definition *and* add a new migration; don't edit past migrations.
2. **RLS is on for every table** (deny-by-default). The API uses the service-role key to bypass. If you expose a direct-client read path, add a permissive policy here: `packages/api/src/db/migrations/`.
3. **Zod schemas live in `@rivals/shared`** and are imported by both the API (for request validation) and the app (for client-side form validation).
4. **No new files or backends for Task N without reading `Vibe Code/N-task-*.md` first.**
5. **Commits follow the per-task messages in each task sheet.** One task = one commit wherever practical.

## Commands

```bash
pnpm install
pnpm turbo run lint typecheck test

# api
pnpm --filter @rivals/api dev
pnpm --filter @rivals/api check-env
pnpm --filter @rivals/api db:migrate

# mobile/web
pnpm --filter @rivals/mobile start       # dev menu (iOS / Android / Web)
pnpm --filter @rivals/web dev            # shortcut to start the web target
pnpm --filter @rivals/web build          # static web export → apps/mobile/dist
```

## Testing

- API unit tests live next to routes (`routes.test.ts`) and run via vitest.
- For tests that need auth, sign a JWT with `SUPABASE_JWT_SECRET` and pass it as `Authorization: Bearer …`.

## When adding a new API route

1. Put the handler in `packages/api/src/modules/<area>/routes.ts`.
2. Register it in `server.ts`.
3. Validate input with a zod schema — put shared schemas in `packages/shared/src/zod/<area>.ts`.
4. Auth-required routes call `await app.requireAuth(req)` at the top.

## When adding a new table

1. New Drizzle schema file under `packages/api/src/db/schema/<entity>.ts`.
2. Re-export from `packages/api/src/db/schema/index.ts`.
3. New migration under `packages/api/src/db/migrations/000N_<name>.sql` — hand-write or use `drizzle-kit generate`.
4. Enable RLS + add deny-by-default policy *in the same migration*.
5. Update `Vibe Code/00-architecture-and-timeline.md §2.3`.
