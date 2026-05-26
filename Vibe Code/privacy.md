# Privacy Policy — Rivals

_Last updated: 2026-05-26_

Rivals ("we", "us") operates the Rivals mobile and web application (the "Service"). This page explains what data we collect, why, and the rights you have over it.

## 1. Data we collect

**Account data** — email address, username, display name, optional avatar URL, and the hashed password (or OAuth provider id) used to sign you in.

**Group and habit data** — the groups you create or join, the habits in those groups, your daily log entries, streak counters, and leaderboard scores.

**Proof photos** — photos you submit as proof of completing a habit. Stored encrypted at rest in Cloudflare R2. Visible only to members of the group the proof was submitted to.

**Device data** — push notification token, platform (iOS / Android / web), app version, and OS version. Used to deliver notifications and triage crashes.

**Telemetry** — anonymised event data (screen views, taps, errors) sent to PostHog and Sentry. No proof photos or habit text leave our infrastructure as part of telemetry.

## 2. Why we collect it

- To operate the Service: showing your groups, logs, leaderboard.
- To send notifications you have opted into.
- To detect bugs and abusive behaviour (Sentry, rate limits, RLS audit).
- To measure aggregate product usage (PostHog).

We do **not** sell personal data, and we do not share it with advertisers.

## 3. Where it lives

- Database (Supabase Postgres) — EU region.
- Photos (Cloudflare R2) — auto-region.
- Telemetry (PostHog Cloud, Sentry) — region per their respective policies.

## 4. Your rights (GDPR / CCPA)

- **Access / portability** — request a JSON export of all your data via Profile → Privacy → Export.
- **Deletion** — request account deletion via Profile → Privacy → Delete. Logs are anonymised; proof photos purged from R2 within 30 days; refresh tokens revoked.
- **Correction** — edit your username, display name, and avatar at any time.
- **Opt-out** — disable analytics in Profile → Notifications & Privacy.

## 5. Retention

We keep account data while your account is active. After deletion we purge as above. Backups roll off within 30 days.

## 6. Children

The Service is not intended for users under 13. If we learn we hold data on a child under 13 we will delete it.

## 7. Contact

privacy@rivals.app
