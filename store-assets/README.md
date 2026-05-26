# Rivals — Store Assets

Drop final assets in the platform sub-directories below before submission. This file documents required sizes, copy, and permission justifications.

## Directory layout

```
store-assets/
  ios/
    icon-1024.png
    screenshots-6.7/      # iPhone Pro Max — 1290x2796
    screenshots-6.5/      # iPhone Plus — 1242x2688
    screenshots-5.5/      # legacy — 1242x2208 (only if iOS 13 support needed)
  android/
    icon-512.png
    feature-graphic-1024x500.png
    screenshots-phone/    # min 4, 1080x1920+
    screenshots-tablet-7/
    screenshots-tablet-10/
  copy/
    listing-en.md         # the listing copy below
```

## Listing copy (English)

**App name:** Rivals — Habit Streaks With Friends

**Short description (Play, 80 chars):**
Compete with friends on daily habits. Proof photos, streaks, leaderboards.

**Full description:**
Rivals turns the habits you already want to build into a friendly competition. Start a group with friends, pick the habits you all want to keep, and post a quick proof photo each time you complete one. Streaks tick up, badges unlock, and the leaderboard keeps everyone honest.

Features:
- Photo-proof logging with on-device watermarking
- Three leaderboard modes: streak, total completions, challenge window
- Private groups — your photos are only visible to your group
- Push notifications for streak milestones, reactions, and challenge endings
- Available on iOS, Android, and the web

Rivals is free to use during launch.

## Camera permission justification (iOS)

> Rivals uses the camera to capture proof photos of habits you complete. Photos are visible only to members of the group you log them in.

(This text must match `NSCameraUsageDescription` in `app.config.ts`.)

## Photo library permission justification (iOS)

> Rivals uses the photo library so you can pick an avatar for your profile or group.

(This text must match `NSPhotoLibraryUsageDescription` in `app.config.ts`.)

## Push permission justification

> Rivals sends notifications when friends react to your logs, when your streak is at risk, and when a challenge window is ending.

## Content rating

- iOS: 4+ (no objectionable content; photo upload is user-controlled, gated by community guidelines in Terms).
- Play: Everyone (Teen if reviewers flag UGC).

## Pre-submission checklist

- [ ] App icon present in both platforms
- [ ] 5+ screenshots per device class
- [ ] Listing copy reviewed for typos
- [ ] Privacy URL points to a live `/privacy` page
- [ ] Support URL set
- [ ] Build uploaded via EAS with `channel: production`
- [ ] Content rating questionnaire submitted
