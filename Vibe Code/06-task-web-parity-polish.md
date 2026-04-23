# Task Sheet 06: Web Parity & Polish

> **Phase Goal:** The web app matches mobile in capability and feels native on desktop, tablet, and mobile-web. Loading, empty, and error states exist everywhere. A new user can onboard fully from a browser without installing anything.
> **Prerequisites:** 01, 02, 03, 04, 05
> **Estimated Effort:** 3–5 days

---

## Tasks

### Task 06.1 — RN Web audit of every screen

**What:** Pass through every screen on the web build to identify and fix mobile-only components, broken layouts, and RN-Web incompatibilities.

**Subtasks:**
- [ ] Create a screen-by-screen audit checklist in `Vibe Code/web-audit.md`
- [ ] Fix any use of `react-native-gesture-handler` components that don't render on web
- [ ] Replace platform-only modules with `Platform.select` or `.web.tsx` extensions
- [ ] Swap `react-native-maps` / other non-web libs with web-safe alternatives or stubs
- [ ] Ensure `FlatList` performance is acceptable; use `FlashList` or virtualization where needed

**Acceptance Criteria:**
- Every screen in the app renders on Chrome without a JS error.
- `web-audit.md` has a checkbox per screen.

**AI Prompt:**
> Create `Vibe Code/web-audit.md` listing every screen in `apps/mobile/src/screens` as a checkbox table (screen name, status, notes). Then for each screen, open `pnpm --filter @rivals/web run dev`, navigate to it, and fix any rendering issues. Common fixes: wrap `PanGestureHandler` in a `Platform.OS === 'web' ? Fragment : GestureHandlerRootView` conditional; for `react-native-view-shot` (used in watermark), ensure only the `.web.tsx` camera file is used on web; avoid native-only libs via Metro config `resolver.platforms`. Check off each screen as it renders cleanly.

**After completing:** `git add -A && git commit -m "chore(web): fix web rendering issues across screens"`

---

### Task 06.2 — Responsive layouts (desktop, tablet, mobile-web)

**What:** Every screen looks right at 375px, 768px, and ≥1280px widths.

**Subtasks:**
- [ ] Add `useBreakpoint()` hook in `packages/ui` returning `'mobile' | 'tablet' | 'desktop'`
- [ ] Dashboard + Feed: single-column on mobile, two-column on tablet, three-column on desktop (with max-width 1280px centered)
- [ ] Leaderboard: full-width on mobile, sidebar on desktop showing current user's stats
- [ ] Camera / proof viewer: remain full-screen overlays on all sizes

**Acceptance Criteria:**
- Resizing the Chrome window live triggers layout switches without layout thrash.
- A 375px viewport doesn't scroll horizontally on any screen.

**AI Prompt:**
> Implement `packages/ui/src/hooks/useBreakpoint.ts` returning `'mobile' | 'tablet' | 'desktop'` based on `Dimensions.get('window').width` with `useWindowDimensions`. Update `GroupDashboardScreen`, `FeedScreen`, and `GroupsListScreen` to adjust their content: single-column under 768, two-column 768-1280, three-column above, centered with `maxWidth: 1280`. `LeaderboardScreen` on desktop: split-pane with the ranked list on the left and a "Your standing" card on the right. Verify at 375/768/1280 viewports.

**After completing:** `git add -A && git commit -m "feat(web): responsive layouts across breakpoints"`

---

### Task 06.3 — Web push via FCM Web SDK / service worker

**What:** Enable web push so browser tabs receive notifications consistent with mobile.

**Subtasks:**
- [ ] Add `apps/web/public/firebase-messaging-sw.js` service worker
- [ ] Initialize FCM with VAPID key; call `getToken` after permission grant
- [ ] POST token to `/push/register` with `platform: 'web'`
- [ ] Handle foreground messages (show a toast) and background (service worker shows system notification)

**Acceptance Criteria:**
- In Chrome with notifications allowed: another member's log fires a system notification even when the tab is in the background.

**AI Prompt:**
> In `apps/web/public/firebase-messaging-sw.js`, initialize Firebase Messaging (with the same project config) and handle `onBackgroundMessage` by calling `self.registration.showNotification(title, { body, icon })`. In `apps/web/src/push.ts`, on successful login, register the service worker, request permission, call `getToken(messaging, { vapidKey })`, and POST to `/push/register`. For foreground messages, subscribe to `onMessage` and show an in-app toast. Only run any of this if `Notification.permission !== 'denied'` and `isSecureContext`.

**After completing:** `git add -A && git commit -m "feat(web): web push via FCM + service worker"`

---

### Task 06.4 — Invite-link deep linking (unauthenticated path)

**What:** A user who clicks `https://rivals.app/join/:code` while logged out lands on a friendly sign-up → join flow.

**Subtasks:**
- [ ] `JoinLandingScreen` renders: group preview (name, member count), "Sign up to join" CTA, "Log in" secondary
- [ ] After auth, auto-redirect to `POST /groups/join` with the stored code
- [ ] Add `GET /groups/:id/preview` returning public-safe metadata `{ name, avatarUrl, memberCount }` (no membership list)
- [ ] Same flow on iOS/Android via Universal Links / App Links

**Acceptance Criteria:**
- Incognito Chrome: paste invite URL → lands on JoinLandingScreen → signs up → auto-joined → dashboard.
- iOS Safari: clicking the same URL opens the app if installed, else lands on web JoinLanding.

**AI Prompt:**
> Add `GET /groups/:id/preview` returning only `{ name, avatarUrl, memberCount }` — no membership list, no habits. This endpoint does NOT require auth. Build `apps/mobile/src/screens/JoinLandingScreen.tsx` that: reads `inviteCode` from route params, calls `GET /groups/:id/preview` via a group id lookup (add `GET /invites/:code` that returns `{ group: { id, name, avatarUrl, memberCount } }`), renders a group preview card with Sign Up / Log In buttons. Store the `inviteCode` in `expo-secure-store`/localStorage pre-auth; after successful auth, auto-call `POST /groups/join` and navigate to `GroupDashboardScreen`. Configure Universal Links (iOS) and App Links (Android) in `app.config.ts` so `https://rivals.app/join/:code` opens the app if installed.

**After completing:** `git add -A && git commit -m "feat(invites): unauthenticated deep-link join flow"`

---

### Task 06.5 — Loading, empty, error, skeleton states

**What:** Every async view shows a skeleton while loading, a helpful empty state when there's nothing, and a user-facing error with retry on failure.

**Subtasks:**
- [ ] `packages/ui/src/states/` with `<LoadingSkeleton />`, `<EmptyState />`, `<ErrorState />`
- [ ] Apply to: `GroupsListScreen`, `GroupDashboardScreen`, `LeaderboardScreen`, `FeedScreen`, `NotificationsScreen`, `PersonalStatsScreen`
- [ ] Add a global `ErrorBoundary` wrapping each tab stack
- [ ] React Query `onError` handler pipes errors to Sentry + user toast

**Acceptance Criteria:**
- Disabling the network during a fetch shows the error state with a retry button that works.
- Fresh account with no groups shows empty state, not a blank screen.

**AI Prompt:**
> Create `packages/ui/src/states/LoadingSkeleton.tsx`, `EmptyState.tsx`, `ErrorState.tsx`. `LoadingSkeleton` accepts a `variant: 'list' | 'card' | 'grid'` and animates a shimmer. `EmptyState` takes `{ icon, title, description, primaryAction?, secondaryAction? }`. `ErrorState` takes `{ title, description, onRetry }`. Update each listed screen: show `LoadingSkeleton` while `isPending`, `ErrorState` on `isError` with a retry button wired to `refetch()`, `EmptyState` when `data.length === 0`. Wrap every tab's root navigator with an `ErrorBoundary` that reports to Sentry and renders an `ErrorState`. Configure React Query's `QueryClient` default `onError` to report to Sentry.

**After completing:** `git add -A && git commit -m "feat(ui): loading/empty/error states across screens"`

---

### Task 06.6 — First-run onboarding + contextual tooltips

**What:** New users get a short walkthrough; key UI elements have dismissable tooltips on first view.

**Subtasks:**
- [ ] `OnboardingCarousel` with 3 slides: proof-first explanation, leaderboard teaser, "create or join a group"
- [ ] Shows on first app open post-signup; "Skip" available
- [ ] Contextual tooltips: first habit card, first leaderboard view, first proof submission success
- [ ] Tooltip dismissal state stored in local AsyncStorage/localStorage

**Acceptance Criteria:**
- A brand-new account sees the carousel; skipping is honored.
- Tooltips appear once and don't re-appear after dismissal.

**AI Prompt:**
> Build `OnboardingCarousel` in `apps/mobile/src/screens/onboarding/` with 3 slides styled as full-bleed images + headline + copy: (1) "Your streak knows if you faked it" — proof-first, (2) "See who's ahead in real time" — leaderboard, (3) "Join your people" — create or join a group. Show on first mount after signup by reading a `hasSeenOnboarding` flag from AsyncStorage/localStorage. Add a lightweight `<Tooltip>` component in `packages/ui` that reads/writes dismissal state keyed by a tooltip id, and wire three tooltips: on the first habit card ("Tap Complete to log proof"), on the first leaderboard view ("Rankings refresh every minute"), after the first successful log ("Nice — friends now see your proof").

**After completing:** `git add -A && git commit -m "feat(onboarding): carousel + contextual tooltips"`

---

### Task 06.7 — Cross-platform UX polish pass

**What:** Final pass for visual and interaction fit-and-finish.

**Subtasks:**
- [ ] Consistent dark-theme tokens (navy + amber) audited across all screens
- [ ] Haptics on mobile for key actions (capture shutter, complete confirm, leaderboard rank change)
- [ ] Web focus rings and keyboard navigation (tab order, Enter submits forms)
- [ ] Mobile animations: shared-element transitions on proof thumbnail → full-screen
- [ ] Screen reader labels on all interactive elements (basic accessibility)

**Acceptance Criteria:**
- Keyboard-only user can navigate sign up, create group, submit proof via web camera.
- VoiceOver / TalkBack reads meaningful labels on every tap target on the dashboard.

**AI Prompt:**
> Extract design tokens into `packages/ui/src/theme/tokens.ts` (colors, spacing, typography, radii). Refactor any hardcoded color values to reference tokens. On mobile: wire `expo-haptics` — light impact on shutter, medium on complete success, notification on leaderboard rank change (diff versus prior React Query data). On web: add visible `:focus-visible` outlines in a global stylesheet, verify Enter submits auth + create-group forms, verify tab order follows visual order. Add `accessibilityLabel` / `aria-label` on every `Pressable` and `Button` in the dashboard, feed, and leaderboard. Add a shared-element-style transition from thumbnail to full-screen viewer using `react-native-reanimated` (no-op on web).

**After completing:** `git add -A && git commit -m "chore(ui): theme tokens, haptics, a11y polish"`

---

## Phase Checkpoint

Before moving to Task Sheet 07, verify:

- [ ] A brand-new user clicks an invite link in desktop Chrome, signs up, joins the group, submits a proof via browser camera, and the leaderboard updates — **without installing the app**.
- [ ] Every screen renders cleanly at 375/768/1280 viewports.
- [ ] Web push is received in a backgrounded tab with permission granted.
- [ ] Every list screen shows an empty state when empty and an error state on network failure with a working retry.
- [ ] Brand-new account sees the onboarding carousel; existing accounts don't.
- [ ] Keyboard-only walkthrough: sign up → create group → submit proof via web camera, all without the mouse.
- [ ] All changes committed; staging auto-deploy succeeds.
