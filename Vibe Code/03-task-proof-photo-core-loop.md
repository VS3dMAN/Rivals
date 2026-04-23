# Task Sheet 03: Proof Photo & Habit Logging — Core Loop

> **Phase Goal:** On iOS, Android, and the web, a user can tap "Complete", capture a live photo (no gallery access), see a timestamp watermark, upload to R2, and land a validated `habit_logs` row. Uploads with >5-minute client/server clock skew are rejected. Prior-day logs lock at midnight.
> **Prerequisites:** 01 (Foundation), 02 (Groups & Habits)
> **Estimated Effort:** 5–7 days

---

## Tasks

### Task 03.1 — Configure Cloudflare R2 bucket + presigned URL service

**What:** Provision the R2 bucket, lock down CORS, and add a small service that issues presigned PUT URLs scoped to a single object key.

**Subtasks:**
- [ ] Create R2 bucket `rivals-proofs` with path-style `proofs/{groupId}/{habitId}/{userId}/{logId}.jpg`
- [ ] CORS: allow PUT from the mobile + web origins; 1-hour `MaxAgeSeconds`
- [ ] Add `packages/api/src/lib/r2.ts` wrapping AWS SDK v3 S3 client pointed at R2
- [ ] `issuePresignedPut(key, contentType, expiresInSec=3600)` returns `{ url, headers }`

**Acceptance Criteria:**
- Unit test: the returned URL is valid for 3600s and a curl PUT with the issued headers succeeds against R2 (staging bucket).

**AI Prompt:**
> Create `packages/api/src/lib/r2.ts` that initializes an `S3Client` (aws-sdk v3) with `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto`, forcePathStyle: true. Export `issuePresignedPut(key, contentType, expiresInSec)` using `@aws-sdk/s3-request-presigner` returning `{ url, method: 'PUT', headers: { 'Content-Type': contentType } }`. Add a vitest test that mocks the SDK and verifies the URL contains `X-Amz-Expires=3600`. Then in the R2 dashboard, set CORS allowing `PUT, GET` from `https://staging.rivals.app`, `http://localhost:8081`, and the mobile bundle IDs.

**After completing:** `git add -A && git commit -m "feat(infra): r2 client + presigned PUT helper"`

---

### Task 03.2 — /logs/upload-url and /logs endpoints

**What:** The two-step upload dance: (1) client requests a presigned URL; (2) after client PUTs directly to R2, client calls `POST /logs` to confirm + validate.

**Subtasks:**
- [ ] `POST /logs/upload-url` — body `{ groupId, habitId }`; returns `{ logId, uploadUrl, headers, objectKey, expiresAt }`. Caches `logId → { groupId, habitId, userId }` in a short-lived `pending_logs` table or `expires_at`-stamped row
- [ ] `POST /logs` — body `{ logId, clientTimestamp, photoSha256? }`; validates `|server_now - clientTimestamp| ≤ 5 min`; reads object metadata from R2 to confirm upload exists; inserts `habit_logs` row; soft-deletes any prior same-day log for same (user, habit, date); emits `feed_events` row of kind `log`
- [ ] `DELETE /logs/:id` — same-day soft delete; blocks if `log_date < today_in_user_tz`

**Acceptance Criteria:**
- Client clock skew >5 min → `POST /logs` returns 422 `CLOCK_SKEW`.
- Resubmitting the same day → prior row has `deleted_at` set, new row is current.
- Attempting `DELETE /logs/:id` for yesterday's log → 409 `LOG_LOCKED`.

**AI Prompt:**
> Implement `packages/api/src/modules/logs/routes.ts`. `POST /logs/upload-url` creates a `pending_logs` row (`id, user_id, group_id, habit_id, expires_at = now() + interval '15 min'`), computes `objectKey = proofs/{groupId}/{habitId}/{userId}/{logId}.jpg`, calls `issuePresignedPut(objectKey, 'image/jpeg', 3600)`, and returns `{ logId, uploadUrl, headers, objectKey, expiresAt }`. `POST /logs` takes `{ logId, clientTimestamp }`: (1) load `pending_logs` and verify ownership; (2) reject with 422 `CLOCK_SKEW` if `Math.abs(Date.now() - new Date(clientTimestamp).getTime()) > 5*60*1000`; (3) `HEAD` the object in R2 to confirm it exists (if not, 422 `UPLOAD_NOT_FOUND`); (4) start a transaction that soft-deletes any existing `habit_logs` row for `(habit_id, user_id, log_date = today_user_tz)`, inserts the new row, inserts a `feed_events` row of kind `log` with payload `{ logId, photoUrl, habitName }`, and deletes the `pending_logs` row. `DELETE /logs/:id` soft-deletes only if `log_date = today_user_tz`; otherwise 409 `LOG_LOCKED`. Add vitest coverage for each branch.

**After completing:** `git add -A && git commit -m "feat(logs): upload-url + confirm + same-day resubmit"`

---

### Task 03.3 — Mobile camera flow with `expo-camera`

**What:** Camera-only capture UI with no gallery button. Photo preview → watermark → confirm → upload.

**Subtasks:**
- [ ] Install `expo-camera` and `expo-image-manipulator`
- [ ] On iOS, set `NSCameraUsageDescription` in `app.config.ts`: "Rivals needs your camera to capture live proof photos. Gallery access is never requested."
- [ ] `CameraScreen` component: full-screen camera preview, single shutter button, no gallery icon anywhere
- [ ] After capture: `PreviewScreen` showing the captured image with watermark overlay burned in

**Acceptance Criteria:**
- On device, there is no visible path to the photo library from within the capture flow.
- Denying camera permission renders a full-screen prompt with a "Open Settings" deep link.

**AI Prompt:**
> Create `apps/mobile/src/screens/camera/CameraScreen.tsx` using `expo-camera`. UI: full-screen preview, top-left close button, centered shutter, bottom-right flip-camera toggle — **no gallery button**. On mount, request camera permission; if denied, render `CameraPermissionDenied` with an "Open Settings" button calling `Linking.openSettings()`. On capture, navigate to `PreviewScreen` passing the temporary file URI. Add `NSCameraUsageDescription` and `android.permissions: ['CAMERA']` to `app.config.ts`. Verify on a physical device that no gallery path exists.

**After completing:** `git add -A && git commit -m "feat(camera): mobile live-only capture screen"`

---

### Task 03.4 — Client-side watermark rendering

**What:** Burn the watermark (date, time, `@username`, habit name) directly onto the image pixels before upload. The clean original is never uploaded or retained.

**Subtasks:**
- [ ] `packages/shared/src/watermark.ts` — pure function `applyWatermark(uri, { dateTime, username, habitName })` returning a new URI
- [ ] Mobile: use `expo-image-manipulator` to resize to max 1600px on long edge, then overlay text via a canvas composited in a React Native View captured with `react-native-view-shot` OR a pre-rendered PNG overlay via `manipulateAsync`
- [ ] Performance budget: <1s total on a reference mid-tier Android device
- [ ] Unit test: check that the output file is larger than zero bytes and a known size range

**Acceptance Criteria:**
- The watermark is visible on the preview and on the file saved to R2.
- On a reference Android, the watermark step takes <1s from capture to preview.

**AI Prompt:**
> Implement `packages/shared/src/watermark.ts` exporting `applyWatermark({ fileUri, dateTime, username, habitName })` on React Native. Use `expo-image-manipulator.manipulateAsync` to resize to max 1600px long edge, then composite a watermark PNG generated on-the-fly: render a `<View>` off-screen with the 4 lines of text and capture it via `react-native-view-shot.captureRef` to a PNG, then `manipulateAsync` with `{ resize, overlay: { uri: watermarkUri, x: ..., y: ... } }`. If overlay isn't supported, fall back to composing via Skia (`@shopify/react-native-skia`). Target <1s total. Wire `PreviewScreen` to call this function and show the result.

**After completing:** `git add -A && git commit -m "feat(camera): client-side timestamp watermark"`

---

### Task 03.5 — Upload pipeline and completion wiring

**What:** From `PreviewScreen` "Confirm", call `/logs/upload-url`, PUT the watermarked JPEG directly to R2, then call `/logs` to finalize.

**Subtasks:**
- [ ] `useLogCompletion()` hook wrapping both API calls and R2 PUT
- [ ] Retry policy: exponential backoff on network failure; queue in AsyncStorage if offline
- [ ] Loading UI: "Uploading..." spinner; failure UI: inline retry
- [ ] On success, invalidate `/groups/:id/habits/today` and leaderboard queries

**Acceptance Criteria:**
- Airplane-mode test: photo queues; turning airplane mode off retries and succeeds.
- On success, the habit card flips to "Completed" with the proof thumbnail.

**AI Prompt:**
> Build `apps/mobile/src/hooks/useLogCompletion.ts`: takes `{ groupId, habitId, watermarkedUri }` and runs (1) `POST /logs/upload-url`, (2) `fetch(uploadUrl, { method: 'PUT', headers, body: blobFromUri })`, (3) `POST /logs` with `clientTimestamp = new Date().toISOString()`. Wrap each step with React Query's `useMutation`. On network failure, push an entry to `AsyncStorage['log-queue']` and retry on `NetInfo` reconnect. On success, invalidate queries `['habits-today', groupId]` and `['leaderboard', groupId]`. In `PreviewScreen`, the Confirm button calls this hook and routes back to the dashboard on success with a toast "Proof recorded".

**After completing:** `git add -A && git commit -m "feat(logs): client upload pipeline with offline retry"`

---

### Task 03.6 — Web camera parity via `MediaDevices.getUserMedia`

**What:** On the web, replicate the exact same capture → watermark → upload flow using browser APIs. HTTPS-only.

**Subtasks:**
- [ ] `CameraScreen.web.tsx` using `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`
- [ ] Capture frame to hidden `<canvas>`, then overlay watermark text on the same canvas context
- [ ] Export canvas as JPEG blob at quality 0.85
- [ ] Reuse `useLogCompletion()` from 03.5 — the upload pipeline is platform-agnostic

**Acceptance Criteria:**
- On Chrome desktop + mobile web, tapping Complete opens the in-page camera, captures, and uploads — identical visible watermark.
- HTTP (non-HTTPS) deploy returns an informative error: "Camera requires HTTPS".

**AI Prompt:**
> Create `apps/mobile/src/screens/camera/CameraScreen.web.tsx` (RN Web picks up the `.web.tsx` extension). Use `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })` and render the stream in a `<video autoPlay playsInline>`. On shutter tap, draw the current frame onto a hidden `<canvas>` sized to the video resolution, then draw 4 lines of watermark text (date, time, `@username`, habit name) with a semi-opaque dark rectangle background. Export via `canvas.toBlob('image/jpeg', 0.85)` and pass to the shared `useLogCompletion` hook as a `Blob`. If `window.isSecureContext` is false, render `<HttpsRequiredError />` instead.

**After completing:** `git add -A && git commit -m "feat(camera): web parity via getUserMedia + canvas"`

---

### Task 03.7 — Grace period + midnight lock logic

**What:** Implement streak-protection logic for habits with `grace_days > 0`, and ensure prior-day logs cannot be edited.

**Subtasks:**
- [ ] Update `GET /groups/:id/habits/today` to set `inGrace = true` when the user missed yesterday but is within the grace window
- [ ] Habit card UI: banner "Grace period ends tonight at midnight" when `inGrace`
- [ ] `DELETE /logs/:id` returns 409 `LOG_LOCKED` when `log_date < today_user_tz`
- [ ] pg_cron job at 00:05 user-tz (or daily UTC midnight): detect grace expiries and reset streaks — defer full streak reset to Phase 4 for Leaderboard Module, but mark `is_streak_reset_pending = true`
- [ ] Same-day re-submission flow: if `completedToday`, tapping Complete shows a confirm dialog "Re-submit proof? Your current proof will be replaced."

**Acceptance Criteria:**
- Admin creates a habit with `graceDays=1`. User completes today, misses tomorrow, logs the day after: streak still intact; `inGrace` was shown on the miss-day.
- Editing a yesterday log: blocked with helpful error.

**AI Prompt:**
> Extend `GET /groups/:id/habits/today` to compute `inGrace` per habit: true if there is no non-deleted `habit_logs` row for `(habit, user, today_user_tz)` but the most recent log is within `today - graceDays - 1` days. Add a banner in `HabitCard` shown when `inGrace`: "Grace period ends tonight at midnight. Log now to protect your streak." Implement the same-day re-submission confirm: in `GroupDashboardScreen`, if `completedToday`, tapping Complete opens an `AlertDialog` with Cancel / Re-submit actions before routing to the camera. Add a pg_cron job (in `infra/supabase/cron.sql`) running hourly that scans for users whose last log is outside the grace window per habit and marks their `streaks.current_streak = 0` with `last_completed_date` preserved. Note: the full streak recomputation lives in Phase 4 — for now this job just resets counters.

**After completing:** `git add -A && git commit -m "feat(logs): grace-period + midnight lock + resubmit confirm"`

---

### Task 03.8 — R2 object signed-read URL helper + proof viewer

**What:** Proof photos are private — the API issues short-lived signed GET URLs when a member views the feed or a habit card thumbnail.

**Subtasks:**
- [ ] Extend `packages/api/src/lib/r2.ts` with `issuePresignedGet(key, expiresInSec=3600)`
- [ ] `GET /logs/:id/photo-url` (member of group) returns `{ url, expiresAt }`
- [ ] Client: `useSignedPhotoUrl(logId)` caches the URL in React Query for 50 min
- [ ] `ProofPhotoThumbnail` + `ProofPhotoFullScreen` components in `packages/ui`

**Acceptance Criteria:**
- Non-member hitting `GET /logs/:id/photo-url` → 404 (RLS/authorization rejects).
- Member can view the proof inline on habit card and full-screen from feed (next phase).

**AI Prompt:**
> Add `issuePresignedGet(key, expiresInSec = 3600)` to `packages/api/src/lib/r2.ts`. Implement `GET /logs/:id/photo-url` in `packages/api/src/modules/logs/routes.ts` — only returns a URL if the requesting user is an active member of the log's group; otherwise 404. Add `useSignedPhotoUrl(logId)` in `packages/shared/src/hooks` (React Query, `staleTime: 50 * 60_000`). Create `ProofPhotoThumbnail` and `ProofPhotoFullScreen` in `packages/ui`, both consuming the hook and rendering the signed URL via RN `Image`.

**After completing:** `git add -A && git commit -m "feat(logs): private proof viewer via signed GET URLs"`

---

## Phase Checkpoint

Before moving to Task Sheet 04, verify:

- [ ] On iOS physical device, Android physical device, and Chrome desktop + Chrome on phone: Complete → camera opens → capture → watermark preview → confirm → log persists → card flips to Completed.
- [ ] No gallery path is reachable from the capture flow on any platform.
- [ ] Forcing device clock to skew by +10 minutes: upload is rejected with `CLOCK_SKEW` error.
- [ ] Airplane-mode test: photo queues and uploads successfully when network returns.
- [ ] After midnight local time, the prior day's log cannot be deleted (`LOG_LOCKED`).
- [ ] A habit with `graceDays=1`: user sees `inGrace` banner on a missed day and completing the next day preserves the streak.
- [ ] Non-member receives 404 when requesting any `logs/:id/photo-url`.
- [ ] All changes committed; staging deploy successful.
