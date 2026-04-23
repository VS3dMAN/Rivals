# Migrations

- `0001_init.sql` — v1 schema from `Vibe Code/00-architecture-and-timeline.md §2.3`
- `0002_rls_deny_by_default.sql` — enables RLS on every table with a restrictive `deny_all` policy

## Apply

Ensure `DATABASE_URL` is set in the repo-root `.env` (direct Postgres URL from Supabase → Project Settings → Database). Then:

```bash
pnpm --filter @rivals/api db:migrate
```

## Regenerate from Drizzle schema (after future schema changes)

```bash
pnpm --filter @rivals/api db:generate
```

The hand-authored SQL in this folder is the source of truth for the initial schema; subsequent migrations should be generated via `drizzle-kit generate` and checked in.
