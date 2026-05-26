# Rivals — End-to-End Persona Scripts

Three personas, three platforms each. Run before every release. Tick each step; file any failure with platform + persona prefix.

## Personas

- **Aryan** — first-time user, signs up fresh, joins via invite link
- **Shreya** — admin, creates a group, invites Aryan, runs a challenge window
- **Rohan** — returning user, logs habits, reacts to feed, opens push

## Platforms

iOS (physical device), Android (physical device), Chrome (desktop web).

---

## Script 1 — Aryan (new user, joiner)

Run on: iOS / Android / Chrome.

1. Open the app cold. Confirm onboarding carousel appears.
2. Tap "Sign up". Enter email, username `aryan_test`, password.
3. Tick the consent checkbox. Confirm Privacy/TOS links open in browser.
4. Submit. Verify magic-link or session establishes; lands on Tabs.
5. Open the invite link Shreya provided (deep link `rivals://join/<code>` or web `/join/<code>`).
6. Confirm Join landing screen shows group name + member count.
7. Tap "Join". Verify membership appears; Tabs reload with the new group.
8. Allow notifications when prompted. Verify token registered (server log).
9. Open Profile → Notifications → flip one toggle and confirm it persists.
10. Open Personal Stats; confirm empty-state messaging.

Pass = all 10 steps succeed and Aryan appears in Shreya's group member list.

---

## Script 2 — Shreya (admin, group owner)

Run on: iOS / Android / Chrome.

1. Sign up as `shreya_test`.
2. Create group "QA Crew" with avatar image picker (skip on Chrome if camera blocked).
3. Add habit "Morning workout" with 1 grace day.
4. Open Group Settings → Invite section → confirm tooltip appears once.
5. Copy invite link, share to Aryan's device.
6. Wait for Aryan to join; confirm member list refreshes.
7. Switch leaderboard mode to "Total"; confirm pill updates.
8. Create a Challenge Window starting today, ending in 2 days.
9. Confirm Leaderboard screen shows countdown banner.
10. Go to Profile → trigger "Export my data". Confirm job is queued (job id surfaces).
11. Wait for status to flip to ready; download payload; confirm JSON contains group + habit + logs.

Pass = all 11 steps succeed and export payload is downloadable.

---

## Script 3 — Rohan (active user, log + react + push)

Run on: iOS / Android / Chrome.

1. Sign in as existing `rohan_test`.
2. From Dashboard, tap "Complete" on a habit. Camera opens (native) or file picker (web).
3. Capture / select photo. Confirm watermark overlay with date, username, habit name.
4. Submit. Confirm success toast + haptic (native) and feed entry appears.
5. Open Feed; confirm Rohan's new log at top. Tap photo → full-screen viewer.
6. (When reactions UI ships) tap an emoji; confirm haptic + count increment.
7. Open Leaderboard; pull-to-refresh; confirm Rohan's score updated.
8. Trigger a streak milestone (3-day, 7-day) — confirm badge + push notification arrives.
9. Tap the push from lock screen / browser; confirm app opens to the correct destination and `notification_opened` analytics fires.
10. Open Badges screen; confirm new badge present with awarded date.

Pass = all 10 steps succeed; analytics events fire (verify in PostHog live view).

---

## Sign-off

| Platform | Aryan | Shreya | Rohan |
|---|---|---|---|
| iOS | ☐ | ☐ | ☐ |
| Android | ☐ | ☐ | ☐ |
| Chrome | ☐ | ☐ | ☐ |

Date: __________  Tester: __________  Build: __________
