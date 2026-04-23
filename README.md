# Rivals

> Cross-platform group habit tracker where every completion is verified by a live, timestamped proof photo and displayed on a real-time leaderboard.

## Stack

- **Mobile/Web:** React Native (Expo) + React Native Web
- **API:** Node.js 20 + Fastify
- **DB/Auth/Storage:** Supabase (Postgres + Auth) + Cloudflare R2 (photos)
- **ORM:** Drizzle
- **State:** Zustand + TanStack React Query
- **Monorepo:** pnpm workspaces + Turborepo

## Layout

```
rivals/
├── apps/
│   ├── mobile/          # Expo (iOS + Android)
│   └── web/             # Expo for Web
├── packages/
│   ├── api/             # Fastify API
│   ├── shared/          # Types, zod schemas, hooks, env
│   ├── ui/              # Shared RN components
│   └── config/          # ESLint + Prettier + tsconfig
└── Vibe Code/           # Planning docs
```

## Getting Started

```bash
pnpm install
cp .env.example .env    # fill in real values
pnpm turbo run lint typecheck
```

Then see `Vibe Code/01-task-foundation.md` for per-task next steps.
