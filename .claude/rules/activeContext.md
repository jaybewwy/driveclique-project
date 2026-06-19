# Active Context

## Current Focus

Brand logo replaced across both apps (2026-06-18). The user supplied a real logo — a red/black "D" monogram on a light background (`frontend/src/assets/brand-source/DriveClique-Logo-source.jpg`, the original JPG) — to replace the placeholder Car-icon-in-gradient-box mark used everywhere since the original build.

**Scope was explicitly limited to the logo swap only** — the user separately flagged an upcoming light-mode-default + dark-mode-toggle project, but chose (via AskUserQuestion) to defer that and do only the logo swap this session.

**Processing pipeline (no image-editing tool existed in this environment — `sharp` was installed into a scratch npm project to do it):**
1. Chroma-keyed the off-white (~`rgb(242,242,242)`) JPG background to transparency (threshold + linear-interpolated edge alpha for anti-aliasing), then auto-cropped to the mark's bounding box.
2. From that transparent master, generated: a tightly-cropped transparent mark (`logo-mark.png`, for inline UI use), an opaque white-background app-icon master at two safe-zone scales (76% standard, 62% for maskable/adaptive icons — W3C maskable icons and Android adaptive icons both need content within a smaller safe circle), a black-silhouette monochrome version (for Android 13+ themed icons), and a pre-composited "white rounded chip + mark on transparent" splash variant.
3. Resized the masters down into every exact filename/size the two apps already reference (`frontend/public/icons/*`, `frontend/public/favicon*.png`, `mobile/assets/*.png`).

**Critical finding — the black ring nearly disappears on the app's dark (`zinc-950`) backgrounds.** Verified by compositing the bare transparent mark onto a dark backdrop and visually inspecting it. This is *why* the user's own answer to "how should the logo handle dark surfaces" (white chip, asked via AskUserQuestion) was correct, not just a style preference — the mark is genuinely illegible without it.

**Key files:**
- `frontend/src/components/ui/Logo.jsx`, `mobile/src/components/ui/Logo.jsx` — new shared `<Logo size={n} />` components; both render a white rounded square containing the transparent mark PNG at ~68% scale. Every brand-logo spot in both apps now renders through this component instead of inline `bg-gradient-to-br ... <Car />` markup.
- Replaced in 6 frontend spots — `NavBar.jsx`, `login-form.jsx` (×2: desktop panel + mobile header), `register-form.jsx` (×2), `NotFound.jsx` — and 2 mobile screens — `app/(auth)/login.jsx`, `app/(auth)/register.jsx`. The `Car` lucide import was removed from each file only after confirming (via grep) it had no other use in that file.
- `frontend/index.html` — favicon switched from `favicon.svg` (old car-themed vector) to `favicon-32.png` + `favicon.png` (no vector source exists for the new mark).
- `mobile/app.json` — `adaptiveIcon.backgroundColor` changed `#09090b` → `#ffffff` (matches the new white `android-icon-background.png`); added an explicit `expo-splash-screen` plugin config pointing at `splash-icon.png` (was previously just the bare plugin name with Expo defaults).
- **`frontend/package.json`** — removed `node scripts/generate-icons.js &&` from `build:capacitor`, and deleted the standalone `generate-icons` script entirely. That script *regenerates placeholder red-square icons*, which would have silently overwritten the new real icons on the next Capacitor build. `scripts/generate-icons.js` itself is kept only for history, with a loud warning comment added at the top — it is no longer wired into anything.
- **Both `.gitignore` files (root and `frontend/`)** had a blanket `*.png` rule (to keep ~17MB of Playwright screenshots out of git) that was *also silently excluding the real brand assets*. Added explicit `!`-negated carve-outs for `public/logo-mark.png`, `public/favicon*.png`, `public/icons/*.png`, `src/assets/logo-mark.png`, `src/assets/brand-source/*.jpg`, and (root-level) `mobile/assets/*.png` + `mobile/src/assets/logo-mark.png`. Verified with `git status --ignored` before and after — this would otherwise have meant a fresh clone of the repo ships with zero logo anywhere.

**Verification:** Both dev servers restarted (frontend Vite + Expo web preview) and screenshotted via Playwright at `/login`, `/register`, and the 404 page on web, and `/login`/`/register` on the mobile Expo web preview — confirmed the white chip renders correctly on dark backgrounds in both apps, zero console/page errors.

---

## Previous Focus

True React Native (Expo) mobile app started (2026-06-18) — new `mobile/` project at the repo root, separate codebase from the existing Capacitor wrapper (`frontend/android/`, `frontend/ios/`), built to the plan in `REACT_NATIVE_PLAN.md`.

**This is a from-scratch rewrite, not a port of the Capacitor build.** Capacitor wraps the Vite/React **web** bundle in a native WebView; `mobile/` instead uses real React Native components (Expo Router, NativeWind, no WebView) talking to the same Express backend over the same REST API — zero backend changes except a planned (not yet built) push-token endpoint for Phase 6.

**Stack decisions:** Expo (managed) + Expo Router (file-based nav, mirrors web's route mental model) + NativeWind (Tailwind-syntax styling, reuses `DESIGN_SYSTEM.md` tokens) + JavaScript (matches `frontend/`'s JS-only convention) + `expo-secure-store` for JWT/refresh-token storage (never AsyncStorage for tokens) + axios (same library as web, works unmodified in RN).

**Phase 1 + start of Phase 2 built and smoke-tested this session:**
- `mobile/src/services/api.js` — `frontend/src/services/api.js` ported near-1:1 (same `authAPI`/`clubsAPI`/`drivesAPI`/`reportsAPI` namespaces, same endpoints/payloads). Only change: token reads are `async` (secure-store), and `window.location` redirects became a `setSessionExpiredHandler` callback the root layout wires to `useAuth`.
- `mobile/src/services/storage.js` — secure-store wrapper. **Web fallback:** `expo-secure-store` has no real implementation in Expo SDK 56 for the web platform (`ExpoSecureStore.web.js` exports `{}`), so `storage.js` switches to `AsyncStorage` (browser `localStorage`) when `Platform.OS === 'web'`. This is dev-convenience only — Android/iOS builds always use the real encrypted SecureStore.
- `mobile/src/hooks/useAuth.js`, `useClubs.js` — ported from the web hooks of the same name, same shape (`isAuthenticated`, `login()`, `logout()`, `updateUser()`).
- Auth screens: `mobile/app/(auth)/{login,register,forgot-password,reset-password,verify-email}.jsx`.
- Tab screens: `mobile/app/(tabs)/{dashboard,my-clubs,find-club,settings}.jsx`.
- Stack screens: `mobile/app/club/[clubId].jsx` (drives + RSVP + join), `mobile/app/club/create.jsx`, `mobile/app/drive/[driveId]/checkin.jsx` (UC-08 equivalent), `mobile/app/+not-found.jsx`.
- `mobile/tailwind.config.js` — `darkMode: "class"` is **required**, not cosmetic: NativeWind's web color-scheme module throws `"Cannot manually set color scheme, as dark mode is type 'media'"` as an uncaught error (full-screen LogBox overlay, blocks all touch input) the moment anything touches color scheme with the default `media` mode. Since this app is dark-only with no `dark:` variants, `class` mode sidesteps the throw entirely.

**Verified end-to-end against the live backend** (Expo web preview + Playwright, since this dev box has no Android/iOS emulator): register → auto-login → dashboard → My Clubs tab → Create Club → club detail page → logout → login with the same credentials → club persisted. Zero console/page errors after fixes below.

**Backend change (additive, dev-only):** `backend/server.js` dev CORS allowlist gained `http://localhost:8081` (Expo's default web dev port) alongside the existing `localhost:5173`/`localhost:3000`/Capacitor origins — needed only for browser-based testing of the Expo web preview; native iOS/Android requests are never subject to CORS.

**Known issue carried forward, not yet fixed:** `expo-status-bar`'s `style="light"` combined with NativeWind's web color-scheme listener is what *triggers* the color-scheme throw above (root-caused but the trigger itself wasn't removed, only the `darkMode: "class"` workaround was applied) — revisit if any future NativeWind/Expo upgrade reintroduces the overlay on web.

**Next up (per `REACT_NATIVE_PLAN.md` §7):** Phase 3 (RSVP polish, waitlist UI, date-picker-based drive scheduling), Phase 4 (announcements, reports, check-in send/resend on the leader side), Phase 5 (Settings screen: username change, password change/reuse policy, club analytics), Phase 6 (Expo push notifications + the `POST /api/auth/push-token` backend addition + EAS Build).

---

## Previous Focus

UC-08 Drive Check-In (Actual Attendance) implemented (2026-06-18) — a notification-and-self-checkin flow, not the meet-up-code design originally sketched in `USE_CASES.md`.

**Design departs from the original UC-08 spec** (per explicit user direction this session): instead of a shared meet-up code shouted at the event, the leader sends an SSE push notification to every "going" member linking to a dedicated `/drive/:driveId/checkin` page where each member self-marks "I'm here" / "I couldn't make it." No email is sent (SSE/bell only, per user request — email was deliberately dropped from the original plan). Check-in is **optional always**, with a UI nudge ("Recommended for large groups") once `going >= 40`. It has no fixed time window — the leader can send/resend the notification any number of times, and members can self-check-in at any time (covers missed pushes / bad connectivity) — the only close condition is the leader marking the drive `isCompleted: true` (the existing Mark Complete action), at which point both the notification button and the member's check-in page close.

**Key files:**
- `backend/models/rsvp.js` — `checkedIn: 'pending' | 'present' | 'not-present'` (default `'pending'`), `checkedInAt: Date`.
- `backend/models/drive.js` — `checkInRequestedAt: Date`, re-set on every leader (re)send; doubles as the "has check-in ever been used" flag for analytics.
- `backend/controllers/driveController.js` — `requestCheckin` (leader-only, blocked once `isCompleted`), `getCheckinStatus` / `submitCheckin` (any member with a `going` RSVP, blocked once `isCompleted`); `getDriveRSVPStatus` extended with a `checkin: {present, notPresent, pending}` breakdown; `getClubAnalytics` extended with `avgAttendanceRate` (present ÷ going, averaged only over drives where `checkInRequestedAt` is set — `null` if check-in was never used for that club).
- `backend/routes/drives.js` — `POST /:driveId/request-checkin`, `GET /:driveId/checkin-status`, `POST /:driveId/checkin`.
- `frontend/src/pages/DriveCheckIn.jsx` — new standalone page at `/drive/:driveId/checkin`; loading/closed/already-answered/choice states, "Change my answer" link.
- `frontend/src/pages/ClubDetail.jsx` — drive modal gets a "Drive Check-In" section: leader sees Send/Resend + present/not-present/pending count tiles; non-leader "going" members see a "Check In to This Drive" button. Gated only by `!selectedDrive.isCompleted` (deliberately **not** gated by drive date, since check-in is meant to be used on/after drive day even if the leader marks completion later).
- `frontend/src/pages/UserSettings.jsx` (ClubAnalytics view) — 4th `DetailCard` "Attendance Rate" with a new `AttendanceBar`, rendered only when `avgAttendanceRate !== null` for that club (grid expands from 3 to 4 columns).
- `frontend/src/components/ui/notification-panel.jsx` — new `DRIVE_CHECKIN_REQUEST` type (sky `MapPin` icon); clicking this specific notification type navigates to the check-in page (the only notification type with click-to-navigate behavior so far — all others just mark-as-read).

**Verification:** `frontend/tests/e2e/drive-checkin.spec.ts` — 15 API-level Playwright tests (serial), all passing: permission checks (leader-only send, going-RSVP-only self-checkin), resend-without-limit, re-answer, analytics `avgAttendanceRate` computation, and the completed-drive close behavior on both endpoints. Screenshots in `frontend/tests/e2e/screenshots/checkin-*.png` (leader send/results, member button/page/confirmed states).

---

## Previous Focus

UC-27 docs reconciliation + UC-29 Password Strength Indicator + Password Reuse Prevention implemented (2026-06-17).

**UC-27 (404 page) was already implemented in a prior session (commit `26de41d`)** — this session only updated `USE_CASES.md` to move it from the pending Index into the Implemented table, and re-verified it manually via Playwright (both logged-out and logged-in CTA states render correctly; screenshots in `frontend/tests/e2e/screenshots/verify-404-logged-out.png` / `verify-404-logged-in.png`).

**UC-29 — Password Strength Indicator (newly implemented):**
- `frontend/src/components/ui/register-form.jsx` — `getPasswordStrength()` helper computes 0–4 strength; renders a 4-segment color bar (Weak/Fair/Good/Strong) below the password field once it has input.
- Password minimum bumped from 6 → 8 characters across `register`, `reset-password`, and `change-password` (`backend/routes/authentication.js`), with matching frontend updates in `ResetPassword.jsx` and `UserSettings.jsx`.

**Password Reuse Prevention (added alongside UC-29, per explicit user request — not in the original USE_CASES.md spec):**
- `backend/models/user.js` — new `passwordHistory: [String]` field (capped at 4 entries).
- `backend/controllers/authController.js` — new `isPasswordReused()` helper (bcrypt-compares a candidate password against the current password + history); wired into both `changePassword` (UC-17) and `resetPassword` (UC-01) so the policy can't be bypassed via the forgot-password flow. New account registration is exempt (no prior history to check).
- On a successful password change, the *old* password hash is pushed onto `passwordHistory` before being overwritten — current + 4 history entries = last 5 passwords guarded against reuse.

**Verification:** `frontend/tests/e2e/password-policy.spec.ts` — 12 new Playwright tests, all passing (UI strength-bar states + API-level reuse rejection across multiple password changes).

---

## Previous Focus

UX Audit + Bug Fixes completed (2026-06-12). Full new-user simulation (16 Playwright tests, 30 screenshots — desktop and mobile). Four bugs fixed; four new use cases documented.

**Bugs fixed this session:**
- `frontend/src/pages/FindClub.jsx` — "1 members" → "1 member" grammar (singular/plural)
- `frontend/src/pages/CreateClub.jsx` — Added Public/Private card-picker (was hardcoded `isPrivate: false` with no UI)
- `frontend/src/pages/Dashboard.jsx` — Restored email verification banner (stripped during prior refactor); renders amber banner when `user.emailVerified === false` with Resend button
- `frontend/src/App.jsx` — Added `/analytics` → `/settings` redirect (stale nav links caused a catch-all bounce to `/dashboard`)

**New use cases added (UC-26 through UC-29):**
- UC-26 — New-User Onboarding / Welcome Tour
- UC-27 — Dedicated 404 / Error Page
- UC-28 — Email Address Change Flow
- UC-29 — Password Strength Indicator at Registration

**Screenshots:** `frontend/tests/e2e/screenshots/ux-audit/` (30 PNG files)

**Audit test suite:** `frontend/tests/e2e/ux-audit.spec.ts` (16 tests, all passing)

---

## Previous Focus

UC-04 Drive Reminder Notifications implemented (2026-06-11). Hourly background scheduler sends SSE + email reminders to members RSVPed "going" or "maybe" within 24 hours of a drive.

**Key files added/changed:**
- `backend/models/rsvp.js` — Added `reminderSent: Boolean` (default `false`) to prevent duplicate reminders.
- `backend/services/emailService.js` — Added `driveReminder` email template.
- `backend/services/scheduler.js` — **New** `node-cron` hourly job (`0 * * * *`); exports `startScheduler()` and `sendReminders()` (the latter is also callable manually for testing).
- `backend/server.js` — `require('./services/scheduler').startScheduler()` called after `connectDB()`.
- `backend/package.json` — `node-cron` added as a dependency.

**Scheduler logic:**
1. Finds drives where `date` is between `now` and `now + 24h` and `isCancelled: false`.
2. For each drive, finds RSVPs with `status: 'going' | 'maybe'` and `reminderSent: false`.
3. Fetches member emails (filtering `emailVerified !== false` per existing convention).
4. Fires `notify(uid, { type: 'DRIVE_REMINDER', ... })` SSE + fire-and-forget `sendEmail`.
5. Bulk-marks all targeted RSVPs as `reminderSent: true`.

**To test manually:**
```bash
# From backend/
node -e "require('dotenv').config(); require('./db')(); setTimeout(() => require('./services/scheduler').sendReminders().then(() => process.exit()), 1000)"
```

---

## Previous Focus

DevOps and SecOps hardening completed (2026-06-10). CI/CD pipeline, Docker support, Railway config, and critical secret rotation all applied.

**Key files added/changed:**
- `.github/workflows/ci.yml` — GitHub Actions: 3 jobs (lint+build, npm audit, E2E Playwright with MongoDB service container) trigger on push/PR to main.
- `backend/Dockerfile` — node:20-alpine production image with healthcheck.
- `backend/.dockerignore` — keeps `.env` and `node_modules` out of Docker build context.
- `frontend/Dockerfile` — multi-stage (Vite build → nginx:alpine); SPA routing via `nginx.conf`.
- `frontend/nginx.conf` — gzip, 1-year immutable cache for hashed assets, no-store for `index.html`.
- `frontend/.dockerignore` — excludes `android/`, `ios/`, `dist/` from build context.
- `docker-compose.yml` (repo root) — full local stack: MongoDB + backend + frontend with health-checked startup order.
- `backend/railway.toml` — explicit Railway deploy config (`node server.js`, healthcheck on `/`, on-failure restart).
- `frontend/package.json` / `backend/package.json` — added `"test"` npm scripts.
- `.gitignore` — removed `*.spec.ts`/`*.spec.js` patterns that were blocking E2E test files from being committed.
- `backend/.env` — **deleted from git** (`git rm --cached`); JWT_SECRET rotated to a 512-bit random value.
- `frontend/tests/e2e/*.spec.ts` — now tracked in git (required for CI to run tests).

**SecOps actions taken:**
- `backend/.env` was committed with a weak `JWT_SECRET=driveclique-jwt-secret-key-2024` — it has been removed from git tracking and the secret rotated. The old value remains in git history; for production, generate a fresh secret on Railway.
- New strong secret generated: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.

**DevOps workflow going forward:**
```bash
# Local dev (unchanged):
cd backend && npm run dev
cd frontend && npm run dev

# Full-stack with Docker:
docker-compose up --build

# Run tests locally (both servers must be running):
cd frontend && npm test

# CI runs automatically on every push to main via GitHub Actions.
```

**Known remaining production gaps (unchanged):**
- SSE notifications break under horizontal scaling — needs Redis Pub/Sub.
- Base64 avatar storage in MongoDB — needs object storage (S3/R2) before large images cause issues.
- In-memory rate limiting — needs `rate-limit-redis` before horizontal scaling.

---

## Previous Focus

Load time optimisation pass completed (2026-06-10). DB indexes, backend payload reduction, parallel RSVP fetching, and frontend code splitting all implemented.

**Key files added/changed:**
- `backend/utils/logger.js` — Winston logger; pretty console in dev, JSON in prod. Import and use instead of `console.*` everywhere in the backend.
- `backend/server.js` — Added `helmet` (security headers), `morgan` (HTTP request logging via winston stream), and per-request UUID middleware (`req.id`). Removed old inline `console.log` request logger.
- `backend/middleware/errorHandler.js` — Error handler now uses `logger.error` with `reqId`, method, path, status, and optional stack.
- `backend/services/emailService.js` / `emailVerifier.js` — `console.error`/`warn` replaced with logger.
- `backend/db.js` — MongoDB connection uses logger; URI credentials redacted from log output.
- `backend/controllers/authController.js` — Registration, forgot-password, and resend-verification `sendEmail` calls are now fire-and-forget (no `await`). Responses return immediately; SMTP runs in the background.
- `backend/controllers/reportController.js` — Report leader notification email is now fire-and-forget.
- `backend/controllers/clubController.js` — Club deletion audit log now uses `logger.info` with structured fields.

**Why these changes matter for production:**
- `helmet` sets 11 security response headers (XSS protection, clickjacking, MIME sniffing) in one call.
- `morgan` + winston means every HTTP request is logged with method, path, status, and response time — visible in Railway logs.
- `req.id` (UUID) lets you grep all logs for a single failed request across middleware and controllers.
- Non-blocking emails: registration was previously blocked by SMTP latency (can be 300ms–2s). Now the user gets their JWT immediately.

**Known remaining production gaps (future work):**
- SSE notifications break under horizontal scaling — needs Redis Pub/Sub to replace the in-process EventEmitter.
- Base64 avatar storage in MongoDB will hit the 16MB document limit for large images — needs object storage (S3/R2).
- In-memory rate limiting resets on restart and doesn't work across multiple instances — needs `rate-limit-redis`.

---

## Previous Focus

Capacitor mobile app scaffolding completed (2026-06-09). DriveClique can now be built as a native Android APK / iOS IPA for app store distribution.

**Key files added/changed:**
- `frontend/capacitor.config.ts` — app ID `com.driveclique.app`, SplashScreen + StatusBar plugin config
- `frontend/vite.config.js` — VitePWA plugin added; API calls are `NetworkOnly`, Inter font is `CacheFirst`
- `frontend/index.html` — `viewport-fit=cover`, Apple PWA meta tags, apple-touch-icon links
- `frontend/android/` — Android native project (open in Android Studio to build APK)
- `frontend/ios/` — iOS native project (open in Xcode on Mac to build IPA)
- `frontend/public/icons/` — placeholder red-600 PNG icons (replace before store submission)
- `frontend/scripts/generate-icons.js` — regenerates placeholder icons; runs automatically via `build:capacitor`
- `frontend/src/hooks/useNotifications.js` — Capacitor App listener reconnects SSE on foreground
- `backend/server.js` — CORS now allows `capacitor://localhost` (iOS) and `http://localhost` (Android)
- `frontend/.env` / `.env.capacitor` / `.env.production` — environment strategy

**Build commands:**
```bash
# Rebuild and sync after any code change:
npm run build:capacitor && npx cap sync

# Open in Android Studio (Windows OK):
npx cap open android

# Open in Xcode (Mac only):
npx cap open ios
```

**Before first real device test:** deploy the backend to Railway + set `VITE_API_URL` in `.env.capacitor`.

---

## Previous Focus

LocationSearch upgraded (2026-06-02) to auto-detect the user's country via IP geolocation (`ipapi.co`, session-cached) and restrict all Nominatim results to that country using the `countrycodes` parameter. Placeholder updates dynamically ("Search city in Canada…"). Falls back to global search if detection fails.

---

## Previous Focus

README.md written and UC-14 (Report Inappropriate Content) implemented (2026-06-02). Report `Flag` icon appears on member cards and the upcoming drive card in ClubDetail, and on every club card in FindClub. Modal has reason picker, optional details, disclaimer, and success state.

---

## Previous Focus

Full visual redesign ("Carbon & Chrome") completed (2026-06-01). Inter font, glass-card pattern, section-label typography, animation keyframes, refined NavBar, and redesigned auth/dashboard/club pages throughout.

---

## Architecture Gotchas

### Calendar end-of-month trap
`isDateDisabled` in `ClubDetail.jsx` uses strict `< today`, so today is selectable in the UI. The backend rejects `date <= new Date()`. Tests must navigate to **next month** before selecting a day.

### SSE blocks `waitForLoadState('networkidle')`
`/club/:clubId` holds an SSE connection open permanently. Use element-based waits (`expect(locator).toBeVisible`) instead of `networkidle` on club pages.

### Email verifier blocks test domains
`rapid-email-verifier.fly.dev` rejects `@journey.test`, `@test.com`, etc. Use `@mail.com` in all Playwright test emails.

### Club deletion — stale React context
After `DELETE /api/clubs/:clubId`, `ClubsContext` may cache the deleted club briefly. Use API-level assertions (`→ 404`) for post-deletion verification, not UI `not.toBeVisible`.

### Notification bell toggle — excludeRef pattern
`NotificationPanel` uses a `mousedown` outside-click listener. The bell button is passed via `excludeRef` so a second bell click is handled entirely by the toggle in NavBar, not by the outside-click handler. Any new popover wired to a trigger button should follow this same pattern.

### LocationSearch country detection — sessionStorage cache
`detectCountry()` in `location-search.jsx` is a module-level singleton that fires at most one `ipapi.co` request per browser session. Result stored as `dc_country` in sessionStorage. All six `LocationSearch` usages benefit automatically; no prop changes required at call sites.

### ClubAnalytics.jsx renamed to UserSettings.jsx
The analytics/settings hub page lives at `/settings` (route) and `UserSettings.jsx` (file). References in older docs to `ClubAnalytics.jsx` or `/analytics` are stale — the route is now `/settings`.

---

## Next Up (from USE_CASES.md)

- UC-07 — Club Categories and Tags (Medium, Low effort)
- UC-22 — Member Public Profile View (Medium, Low effort)
- UC-04 — Drive Reminder Notifications (Medium, Low effort — needs `node-cron`)
- UC-12 — Drive Discussion / Comments (Medium, Medium effort)
- UC-23 — Drive Route / Meeting Point Map (Medium, Medium effort)
- UC-24 — Club Event Calendar View (Medium, Medium effort)
