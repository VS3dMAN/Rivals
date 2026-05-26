# Rivals — Technical Progress Report

**Date:** May 1, 2026
**Project Status:** Active Development
**Current Phase:** Transitioning from Phase 4 to Phase 5

---

## 1. Project Vision (Where the App is Supposed to Go)

**Rivals** is a cross-platform group habit tracker designed to eliminate self-reporting loopholes. The core mechanism requires users to submit a live, timestamped, watermarked photo within a narrow validation window. The platform is designed for friends and close groups, bringing high accountability and a competitive edge to habit building.

### Key Technical Pillars:
- **Cross-Platform:** Single codebase covering iOS, Android, and Web using React Native (Expo managed workflow) and Expo for Web.
- **Backend Architecture:** Node.js 20 + Fastify modular monolith for high performance and clean bounds.
- **Database & Auth:** Supabase (PostgreSQL) paired with Drizzle ORM for typed queries and schema migrations. Row-Level Security (RLS) is strictly enforced with a deny-by-default architecture. Auth handles Email and Google OAuth securely via JWTs.
- **Object Storage:** Cloudflare R2 is utilized to handle proof photos cheaply via short-lived presigned URLs, keeping assets secure.
- **Client & Server State:** Zustand for minimal UI state, TanStack React Query for polling, cache, and background refetches.

### Roadmap & Phases
- **Phase 1:** Foundation & Infrastructure [18%]
- **Phase 2:** Groups & Habit Management [14%]
- **Phase 3:** Proof Photo & Habit Logging (Core Loop) [22%]
- **Phase 4:** Leaderboard & Real-Time Engine [14%]
- **Phase 5:** Feed, Notifications & Gamification [14%]
- **Phase 6:** Web Parity & Polish [8%]
- **Phase 7:** Security, Hardening & Pre-Deployment [10%]

---

## 2. Current Progress (Where it Actually Has Reached)

The development is moving smoothly along the phased approach. **As of this report, Phases 1, 2, 3, and 4 are 100% complete, representing roughly 68% of the MVP build.** The core application shell, backend security, administrative capabilities, core logging loop, and real-time leaderboard engine are fully functional.

### ✔️ Phase 1: Foundation & Infrastructure (COMPLETED)
- **Monorepo Setup:** Successfully scaffolded using Turborepo + pnpm workspaces (`apps/mobile`, `apps/web`, `packages/api`, `packages/shared`, `packages/ui`).
- **Database & Auth:** Supabase staging project provisioned. Initial tables migrated via Drizzle. Auth module supports full E2E flow for Email and Google OAuth signup/login/logout.
- **API Shell:** Fastify API server is live with health checks and protected routes wired to Supabase JWT verification.
- **State Management:** Zustand and React Query configured with persistent cache setup.
- **CI/CD Pipeline:** Automated linting, type-checking, and tests via GitHub Actions. Deploys trigger on push to staging branches.

### ✔️ Phase 2: Groups & Habit Management (COMPLETED)
- **Strict Row-Level Security (RLS):** Upgraded from initial permissive roles to fine-grained group-based access control. Policies ensure that reads and writes are strictly scoped to group membership. Admin writes require proper validation (`groups.admin_user_id = auth.uid()`).
- **Group CRUD API:** Full suite of `GET`, `POST`, `PATCH`, and `DELETE` endpoints. Fully wrapped in transactions to handle admin bootstrapping.
- **Invitations System:** Supports deep links (`rivals://join/:code`), shareable web codes, and `@username` lookups.
- **Admin Granular Actions:** Implemented role transfers, member kicking, and an "orphan prevention" leave guard for admins.
- **Habit Definitions:** Admin capabilities to define daily habits (including configuration for "Grace Days"). Group Dashboard is fetching and dynamically displaying pending/complete statuses.
- **Mobile UI Construction:** Built out foundational screens including `CreateGroupScreen`, `GroupDashboardScreen`, `GroupSettingsScreen`, `GroupsListScreen`, and `JoinGroupScreen`.

### ✔️ Phase 3: Proof Photo & Habit Logging (COMPLETED)
- **Cloudflare R2 Integration:** Built service to issue presigned PUT/GET URLs for secure, direct-to-bucket photo uploads.
- **"No-Gallery" Camera Module:** Integrated `expo-camera` for a live-capture-only flow to eliminate the upload of old photos.
- **Client-Side Watermarking:** Implemented `expo-image-manipulator` to dynamically burn dates, times, usernames, and habit names into the photo pixels immediately after capture.
- **Clock Skew Defenses:** Server-side validation enforcing a strict time delta validation between client timestamp and server's "now".
- **Logging Pipeline:** Transactional POST `/logs` endpoint that links the R2 object to the database, ensuring data consistency and idempotency.

### ✔️ Phase 4: Leaderboard & Real-Time Engine (COMPLETED)
- **Leaderboard Modes:** Implemented three distinct leaderboard modes (Streak, Total Count, and Challenge Windows) that can be toggled by group admins.
- **Pure Computation Engine:** Developed isolated, unit-tested functions to calculate consecutive day streaks while accurately honoring per-habit grace periods.
- **Event-Driven Recomputation:** Hooked the `POST /logs` transaction to synchronously recompute and upsert streak/total/window scores, keeping the leaderboard real-time.
- **Challenge Lifecycle:** Built CRUD for time-boxed challenge windows with overlapping protections, integrated with `pg_cron` jobs to automate state transitions (`upcoming` → `active` → `completed`) and declare winners with tie-breaking logic.
- **UI & Navigation:** Integrated a highly-polished leaderboard screen featuring rank badges, a countdown banner for active windows, and an empty state, alongside a "Past Challenges" view.

---

## 3. Immediate Next Steps: Phase 5 (Feed, Notifications & Gamification)

The team is immediately pivoting to **Phase 5: Feed, Notifications & Gamification**, to bring the platform's social elements to life.

### What to Expect Next:
1. **Activity Feed:** Building a unified, chronological feed displaying habit logs, challenge starts/ends, and gamification events.
2. **Badges & Achievements:** Defining and awarding badges (e.g., `window_winner`, first log) automatically via backend triggers.
3. **Push Notifications:** Integrating Expo Push Notifications to alert users about group activity, expiring grace periods, and challenge updates.
4. **Feed UI Elements:** Constructing the feed screen with virtualized lists, inline proof viewers, and engagement actions.

## Summary

The platform's core loop—capturing secure live proofs and updating a real-time leaderboard—is now fully operational. The backend handles complex streak math, cron jobs, and RLS with ease, while the frontend accurately represents live state with optimistic updates. Progress continues linearly, and we are well-positioned to begin gamifying the user experience in the upcoming phase.
