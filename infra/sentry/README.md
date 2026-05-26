# infra/sentry

Alert-rule definitions for the Rivals Sentry projects (`rivals-api`, `rivals-mobile`).

These rules are not auto-applied. Apply manually via the Sentry dashboard, or use Sentry's API / Terraform provider:

```
sentry-cli issues rules sync alert-rules.yml
```

When you change a rule, bump `Last applied` below and commit.

## Last applied

| Date | By | Notes |
|---|---|---|
| (pending) | (initial) | Awaiting first apply against the live Sentry org |
