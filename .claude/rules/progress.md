# DriveClique - Progress

## Session: DevOps & SecOps Hardening (2026-06-10)

### What Was Built

CI/CD pipeline, Docker packaging, Railway deployment config, and critical secret management.

| Layer | File | Change |
|-------|------|--------|
| SecOps | `backend/.env` | Deleted from git tracking (`git rm --cached`); `JWT_SECRET` rotated from the weak committed value to a 512-bit random secret |
| SecOps | `.gitignore` | Removed `*.spec.ts`, `*.spec.js`, `*.test.ts`, `*.test.js`, `tests/` patterns — they were blocking E2E test files from being committed, which would have broken CI |
| CI | `.github/workflows/ci.yml` | GitHub Actions pipeline with 3 jobs: (1) lint + Vite build, (2) `npm audit --audit-level=high` on both packages, (3) Playwright E2E against a MongoDB service container |
| Docker | `backend/Dockerfile` | `node:20-alpine`; `npm ci --only=production`; HEALTHCHECK via `wget` |
| Docker | `backend/.dockerignore` | Excludes `.env`, `node_modules` |
| Docker | `frontend/Dockerfile` | Multi-stage: Vite build stage → `nginx:alpine` serve stage; `VITE_API_URL` as build ARG |
| Docker | `frontend/nginx.conf` | Gzip, 1-year `Cache-Control: immutable` for hashed assets, `no-store` for `index.html` |
| Docker | `frontend/.dockerignore` | Excludes `android/`, `ios/`, `dist/`, `.env.*` |
| Docker | `docker-compose.yml` | Local full-stack: MongoDB → backend (healthchecked) → frontend; MongoDB URI overridden in env so backend resolves the compose service |
| Railway | `backend/railway.toml` | `builder = "nixpacks"`, `startCommand = "node server.js"`, healthcheck on `/`, on-failure restart |
| Scripts | `frontend/package.json` | Added `"test": "playwright test"` |
| Scripts | `backend/package.json` | Added `"test": "node --test"` |
| Tests | `frontend/tests/e2e/*.spec.ts` | Now tracked in git; previously excluded by `.gitignore` (8 spec files committed) |

### Design Decisions

- **3-job CI structure** — lint+build catches TypeScript/ESLint errors fast (no DB needed); audit runs independently so a dep vulnerability fails the check even when tests pass; E2E runs last because it's the most expensive and requires external services.
- **MongoDB service container in CI** — GitHub Actions `services:` block spins up `mongo:7` as a sidecar; the backend env var `MONGO_URI` points at `localhost:27017` inside the runner.
- **`NODE_ENV=development` in CI** — rate limiting uses a 1-minute window in dev mode, allowing repeated test runs without hitting 429s.
- **Alpine images** — both Dockerfiles use `*-alpine` variants; backend image is ~150MB vs ~900MB for the full node image.
- **`no-store` for index.html** — ensures browsers always fetch a fresh HTML file after a deploy, which in turn loads the new fingerprinted chunk URLs.
- **`restartPolicyType = "on_failure"` in railway.toml** — Railway restarts the server if it crashes; combined with MongoDB Atlas connection retries this handles transient network errors gracefully.

### Critical Note: Old JWT_SECRET in Git History

The old value `driveclique-jwt-secret-key-2024` is permanently in git history. Anyone who cloned the repo before this commit could have extracted it. For production (Railway):
1. Set `JWT_SECRET` in Railway environment variables to a new 512-bit value.
2. Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` to generate one.
3. All existing sessions will be invalidated — users will need to log in again (expected behavior).

---

## Session: Load Time Optimisation (2026-06-10)

### What Was Built

Performance improvements across DB, backend API payloads, and frontend bundle.

| Area | File | Change |
|------|------|--------|
| DB index | `backend/models/club.js` | Added index on `leader` (queried in analytics, dashboard, ownership checks) and `members` (array `$in` lookups) |
| DB index | `backend/models/rsvp.js` | Added index on `user` (queried in `getMyRSVPs` and waitlist promotion) |
| DB index | `backend/models/drive.js` | Added index on `createdBy` (queried in analytics) |
| Payload | `backend/controllers/clubController.js` | Removed `avatar` from `members` populate in `getClubById`, `getClubByInviteCode`, `transferLeadership` — member avatars are base64 blobs; 50 members × 50KB = 2.5MB saved per club page load |
| Query | `backend/controllers/clubController.js` | Added `.lean()` to `getUserClubs`, `getClubById`, `getClubByInviteCode`, `searchClubs`, `transferLeadership` — skips Mongoose document instantiation on read-only results |
| N+1 fix | `frontend/src/pages/ClubDetail.jsx` | Replaced `upcomingIds.forEach(getRSVPStatus)` with `Promise.all(upcomingIds.map(...))` — 10 upcoming drives previously fired 10 sequential requests; now fires all in parallel, waits for all, applies one state update |
| Code split | `frontend/src/App.jsx` | All 7 authenticated page imports changed to `React.lazy()` wrapped in `<Suspense>`. Auth pages (Login, Register, ForgotPassword, ResetPassword, VerifyEmail) remain eagerly loaded. Result: initial JS bundle only includes auth pages + framework |
| Bundle | `frontend/vite.config.js` | Added `manualChunks` function splitting vendors into 4 cached chunks: `vendor-react` (235KB), `vendor-ui` (72KB Radix), `vendor-motion` (Framer Motion), `vendor-icons` (20KB Lucide). These chunks are versioned separately so a code change doesn't bust the React cache |

### Build Output (after optimisation)
```
vendor-react    235KB gzip:75KB  (cached across deploys — React rarely changes)
vendor-ui        72KB gzip:23KB
ClubDetail       61KB gzip:12KB  (only downloaded when user visits a club)
vendor-icons     20KB gzip:8KB
UserSettings     33KB gzip:7KB   (only downloaded when user visits settings)
Dashboard        12KB gzip:4KB
FindClub         13KB gzip:4KB
MyClubs           9KB gzip:3KB
```

### Design Decisions
- **Avatar excluded from members, kept for leader** — the leader's avatar appears in the club hero header (one user). Member avatars in the member list fall back to initials, which is standard UX and avoids the payload spike.
- **`.lean()` only on read-only queries** — queries where `.save()` is called afterward do not use `.lean()`.
- **Auth pages eagerly loaded** — these are the first pages users see; lazy-loading them would add a flash before the login form appears.
- **`manualChunks` as function (not object)** — Vite 8 uses Rolldown which requires the function form; object form throws at build time.

---

## Session: Production Readiness — Logging, Security, Non-blocking Email (2026-06-10)

### What Was Built

Backend production hardening pass: structured logging, security headers, and non-blocking email sends.

| Layer | File | Change |
|-------|------|--------|
| New util | `backend/utils/logger.js` | Winston logger — colorized pretty output in dev, JSON to stdout in prod; levels: error, warn, info, http, debug |
| Middleware | `backend/server.js` | Added `helmet` (security headers), `morgan` (HTTP log via winston stream), per-request `req.id = crypto.randomUUID()`. Removed old ad-hoc `console.log` request logger |
| Error handler | `backend/middleware/errorHandler.js` | `console.error` → `logger.error` with structured fields: `reqId`, `method`, `path`, `status`, optional `stack` |
| Email service | `backend/services/emailService.js` | `console.error` → `logger.error` |
| Email verifier | `backend/services/emailVerifier.js` | `console.warn` (×2) → `logger.warn` with structured fields |
| DB | `backend/db.js` | `console.log`/`error` → `logger.info`/`error`; MongoDB URI credentials redacted in log output |
| Auth controller | `backend/controllers/authController.js` | Removed `await` from 3 `sendEmail` calls (registration, forgot-password, resend-verify) — now fire-and-forget |
| Report controller | `backend/controllers/reportController.js` | Removed `await` from leader notification email — now fire-and-forget |
| Club controller | `backend/controllers/clubController.js` | `console.log` club deletion → `logger.info` with structured fields |
| Packages | `backend/package.json` | Added `winston`, `morgan`, `helmet` |

### Design Decisions

- **JSON in production, pretty in dev** — Railway and most cloud platforms ingest JSON logs natively; colorized output is noise in prod but valuable locally.
- **`req.id` via `crypto.randomUUID()`** — no extra package needed (built-in Node 14.17+). The ID is set on `req.id` and returned as `X-Request-Id` response header so API clients can include it in bug reports.
- **Fire-and-forget emails** — `sendEmail` already catches all its own errors internally. Dropping `await` means: (1) registration response is instant even when SMTP is slow, (2) a flaky SMTP server can never cause a 500 on a user-facing route.
- **`helmet` with defaults** — sets `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, and 7 other headers in one call. No CSP customization needed yet.
- **No file log transport** — Railway collects stdout/stderr natively. File transports add complexity (rotation, disk space) with no benefit on a PaaS.

### Known Remaining Production Gaps

| Gap | Risk | Fix when |
|-----|------|----------|
| SSE uses in-process EventEmitter | Breaks notifications if app ever runs on 2+ instances | Before horizontal scaling |
| base64 avatars in MongoDB | 16MB doc limit hit by large images | Before launch |
| In-memory rate limiting | Resets on restart, doesn't work across instances | Before horizontal scaling |

---

## Session: Capacitor Mobile App Scaffolding (2026-06-09)

### What Was Built

Full Capacitor integration enabling DriveClique to ship as a native Android and iOS app.

| Layer | File | Change |
|-------|------|--------|
| Config | `frontend/capacitor.config.ts` | App ID `com.driveclique.app`; SplashScreen (zinc-950 bg, red-600 spinner); StatusBar dark style |
| Build | `frontend/vite.config.js` | Added `vite-plugin-pwa` — generates service worker + web manifest; API calls `NetworkOnly`, Inter font `CacheFirst`; `outDir: 'dist'` explicit |
| HTML | `frontend/index.html` | `viewport-fit=cover`, Apple PWA meta tags, apple-touch-icon links |
| Icons | `frontend/public/icons/` + `frontend/scripts/generate-icons.js` | 9 placeholder red-600 PNGs (48–512 px); script runs automatically in `build:capacitor` |
| Android | `frontend/android/` | Native project created; mipmap icons placed; `usesCleartextTraffic="true"` for local dev |
| iOS | `frontend/ios/` | Native Xcode project created; `Info.plist` — white status bar icons on dark bg |
| CORS | `backend/server.js` | Callback-based origin handler allows `capacitor://localhost` (iOS) + `http://localhost` (Android) |
| Env | `backend/.env.example` | Added `ALLOWED_ORIGIN_WEB` |
| Env | `frontend/.env` / `.env.capacitor` / `.env.production` | Three-tier environment strategy; `VITE_IS_NATIVE=true` in capacitor mode |
| API | `frontend/src/services/api.js` | Hardened production fallback; exported `isNative` flag |
| SSE | `frontend/src/hooks/useNotifications.js` | Dynamic import of `@capacitor/app`; closes SSE on background, reconnects on foreground |
| npm | `frontend/package.json` | Added `@capacitor/*` + `vite-plugin-pwa` deps; `build:capacitor`, `build:web`, `generate-icons` scripts |

### Design Decisions

- **Capacitor over React Native** — zero frontend rewrite; existing React/Vite code runs in the native WebView unmodified.
- **PWA layer included** — the same Vite build that Capacitor packages also produces a web-installable PWA; double value for no extra cost.
- **Dynamic import for `@capacitor/app`** — SSE reconnect code only executes when `window.Capacitor?.isNativePlatform()` is true, so the web build is unaffected.
- **Placeholder icons are valid PNGs** — generated by a pure Node.js PNG encoder (zlib + CRC32); no external dependencies needed.
- **`usesCleartextTraffic` commented as dev-only** — large comment in `AndroidManifest.xml` warns to remove before release.

### Build Workflow (after this session)

```bash
# After any code change:
cd frontend
npm run build:capacitor   # generates icons + builds dist/
npx cap sync              # pushes dist/ into android/ and ios/

# Open Android Studio (Windows):
npx cap open android

# Open Xcode (Mac only):
npx cap open ios
```

### Before First Real Device Test

1. Deploy backend to Railway + MongoDB Atlas
2. Set `VITE_API_URL=https://your-railway-url.up.railway.app/api` in `frontend/.env.capacitor`
3. Set `ALLOWED_ORIGIN_WEB` in Railway environment variables
4. Replace placeholder icons with real branded artwork (see [realfavicongenerator.net](https://realfavicongenerator.net))
5. Remove `android:usesCleartextTraffic="true"` from `AndroidManifest.xml` for release builds

---

## Session: LocationSearch Country Filter (2026-06-02)

### What Was Built

- **`frontend/src/components/ui/location-search.jsx`** — Full rewrite of the LocationSearch component adding country-scoped autocomplete:
  - **Module-level singleton `detectCountry()`** — at most one `ipapi.co/json/` call per browser session. Result cached in `sessionStorage` (`dc_country`). Multiple `LocationSearch` instances share one in-flight promise, preventing parallel requests.
  - **4-second timeout** via `Promise.race` — slow or unreachable IP service falls back to unrestricted global search silently.
  - **Nominatim `countrycodes` param** — when a country code is resolved, `&countrycodes=ca` (or whichever) is appended, restricting results to that country natively at the API level.
  - **Dynamic placeholder** — `"Search city in Canada…"` using `Intl.DisplayNames` to convert ISO code → English country name. Native JS, no library, well-supported.
  - **Country badge** — small `CA` chip appears in the empty input so users know the search scope.
  - **Dropdown footer** — `"Showing results in Canada"` appears below results; no-results message names the country.
  - **`countryCode` prop** — optional override for explicit control (e.g. testing, admin, future multi-country forms).
  - **Updated input style** — migrated from old `border-zinc-700` style to new `glass-card`-aligned inputs (`bg-white/[0.06] border-white/[0.10]`) for consistency with the redesign.
- **No call-site changes** — all 6 existing usages (`register-form.jsx`, `Profile.jsx`, `CreateClub.jsx`, `ClubDetail.jsx`, `UserSettings.jsx`) benefit automatically.

### Design Decisions
- **IP detection over browser geolocation** — browser geolocation requires a permission prompt which is jarring on a form field. IP detection is silent and immediate (from sessionStorage after first load).
- **Session cache, not localStorage** — country changes when travelling; session scope gives fresh detection each browser session without being intrusive.
- **Fail-open** — any detection failure (network error, timeout, VPN, unusual IP) silently reverts to global search. The feature degrades gracefully.

---

## Session: Notification Bell Toggle Fix (2026-06-02)

### What Was Built

- **`frontend/src/components/ui/notification-panel.jsx`** — Fixed double-click not closing the panel. Root cause: `mousedown` outside-click handler fired before the bell button's `onClick`, calling `onClose()` (panel closes), then `onClick` fired `!p` (panel reopens). Net: panel stays open on second click.

  **Fix:** Added `excludeRef` prop to `NotificationPanel`. The `mousedown` handler now checks `excludeRef.current.contains(e.target)` — if the click is on the bell button, it skips `onClose()` and lets the bell's toggle handle it exclusively.

- **`frontend/src/components/NavBar.jsx`** — Passed `excludeRef={notifBellRef}` to `<NotificationPanel>`. `notifBellRef` was already attached to the bell button wrapper div.

### Design Decision
The `excludeRef` pattern is the standard fix for trigger-button / outside-click conflicts. Any future popover anchored to a toggle button should follow this same approach rather than using `stopPropagation` (which breaks unrelated event listeners).

---

## Session: README + UC-14 Report Inappropriate Content (2026-06-02)

### What Was Built

#### README.md
- **`README.md`** (repo root) — Full project README: purpose, tech stack table, local setup instructions, environment variables table, architecture decisions (two-token auth, SSE vs WebSockets, waitlist position derivation, N+1-free analytics, email validator fail-open), API overview, feature table, test instructions with known gotchas, project structure.

#### UC-14 — Report Inappropriate Content

| Layer | File | Change |
|-------|------|--------|
| Model | `backend/models/report.js` | New `Report` schema: `reporter`, `targetType` (user/club/drive), `targetId`, `reason` (harassment/spam/dangerous/other), `details` (500 char max), `resolved`. Compound unique index `{ reporter, targetType, targetId }` prevents duplicate reports. |
| Email | `backend/services/emailService.js` | Added `reportNotification` template — sent to the club leader's email when a report is filed for content in their club. |
| Controller | `backend/controllers/reportController.js` | `submitReport`: validates target exists, blocks self-reports, creates Report doc (catches duplicate key → 400), sends leader email best-effort. |
| Route | `backend/routes/reports.js` | `POST /api/reports` (protected, `validateInput` on targetType enum, targetId length, reason enum, details maxLength). |
| Server | `backend/server.js` | Registered `/api/reports` route. |
| API service | `frontend/src/services/api.js` | Added `reportsAPI.submit({ targetType, targetId, reason, details })`. |
| Component | `frontend/src/components/ui/ReportModal.jsx` | New reusable modal: radio-button reason selector, optional details textarea (500 char counter), disclaimer banner, loading spinner, success state with checkmark, error inline. Uses `glass-card` + `btn-primary` patterns. |
| ClubDetail | `frontend/src/pages/ClubDetail.jsx` | Added `reportTarget` state + `Flag` icon import + `ReportModal` import. Flag button on each non-leader, non-self member row; flag button on the upcoming drive card. Modal renders when `reportTarget` is set. |
| FindClub | `frontend/src/pages/FindClub.jsx` | Added `reportTarget` state + `Flag` icon + `ReportModal` import. Flag button on every public club card alongside the Join/View CTA. Modal renders when `reportTarget` is set. |

### Design Decisions
- **Unique index prevents spam** — one report per reporter per target; second attempt returns `"You have already reported this content."` instead of silently succeeding.
- **Leader notification, not admin** — no platform admin yet; the club leader is the closest authority for drive/member reports. User-targeting reports produce no email (no admin inbox configured).
- **Fail-open email** — if the leader's email is unverified or SMTP is unconfigured, the report is still saved; only the notification is skipped.
- **`Flag` icon in orange hover** — visually distinct from the red danger/delete actions, making it clearly a "soft" moderation action.

---

## Session: Full Visual Redesign — "Carbon & Chrome" (2026-06-01)

### What Was Built

A comprehensive UI redesign across the entire frontend. No backend changes. All business logic preserved — CSS/Tailwind classes only.

#### Foundation
- **`frontend/index.html`** — Added Inter font preconnect + Google Fonts link; page `<title>` changed to `DriveClique`.
- **`frontend/src/index.css`** — Full rewrite: Inter font body rule, custom scrollbar, six animation keyframes (`gradient-shift`, `fade-slide-up`, `shimmer`, `float`, `glow-pulse`, `spin-slow`), and `@layer utilities` with `.glass-card`, `.glass-subtle`, `.section-label`, `.gradient-text`, `.btn-primary`, `.btn-ghost`, `.skeleton`, `.animate-fade-slide-up`, `.animate-float`, `.animate-glow`, `.ambient-bg`, `.gradient-border` utility classes.
- **`frontend/tailwind.config.js`** — Extended with `fontFamily.sans` → Inter stack, custom `animation.*` tokens, and `boxShadow` tokens (`glow-red`, `glow-red-lg`, `glass`, `glass-lg`).

#### New Design Patterns
| Pattern | Old | New |
|---------|-----|-----|
| Card surface | `bg-zinc-900/50 backdrop-blur-sm border-zinc-800/50` | `glass-card` → `bg-white/[0.04] backdrop-blur-xl border border-white/[0.07]` |
| Section header | Ad-hoc font sizes | `section-label` → `text-[11px] uppercase tracking-widest text-zinc-500` |
| Primary button | `bg-red-600 hover:bg-red-700` | `btn-primary` → gradient + shadow + hover scale |
| NavBar bg | `bg-black/80 backdrop-blur-xl border-zinc-800/50` | `bg-zinc-950/90 backdrop-blur-2xl border-white/[0.06]` |
| Logo | Single `DriveClique` text | Split `Drive` (white) + `Clique` (red gradient) |

#### Pages Redesigned
- **`NavBar.jsx`** — Slimmer 49px height, refined logo (8×8 badge), pill search bar (`bg-white/[0.06]`), divider between bell and avatar, cleaner mobile menu with user card header.
- **`login-form.jsx`** — Animated tagline section ("Your crew is waiting for you."), "3,200+ members worldwide" pill badge, glass inputs, gradient button with arrow icon, "or" divider.
- **`register-form.jsx`** — Matching two-panel design, "@username" prefix input, tighter vertical spacing.
- **`Dashboard.jsx`** — Section labels ("GOOD TO SEE YOU", "SCHEDULE"), glass quick-action chips with colored backgrounds, glass Create Drive card, glass drive list items with hover lift.
- **`FindClub.jsx`** — Section label header, slim glass search bar, glass club cards with hover lift, compact right sidebar with section labels.
- **`MyClubs.jsx`** — Section label "MY GARAGE", glass club cards with gradient ring hover, glass empty state, glass quick stats chips.
- **`ClubDetail.jsx`** — Glass hero header (replaced 96px circle + flat text), back button polished, drive card updated to glass pattern.
- **`UserSettings.jsx`** — StatChip, DetailCard, progress bars updated to glass pattern; SkeletonAnalyticsCard updated; all `bg-zinc-900/50 border-zinc-800/50` cards replaced with `glass-card`.
- **`user-dropdown.jsx`** — Panel updated to `bg-zinc-950/95 backdrop-blur-2xl border-white/[0.08]`.
- **`notification-panel.jsx`** — Panel updated to `bg-zinc-950/95 backdrop-blur-2xl border-white/[0.08]`.

#### Screenshots
Saved to `frontend/tests/e2e/screenshots/`:
- `redesign-login.png` — Login page with car image + "Your crew is waiting for you." tagline
- `redesign-register.png` — Register page with "Find your tribe. Start your journey."
- `redesign-dashboard.png` — Dashboard with section labels, glass cards, Inter font
- `redesign-findclub.png` — Find Clubs with glass search + club cards
- `redesign-myclubs.png` — My Clubs empty state + glass card

### Design Decisions
- **Dark theme preserved** — automotive feel, glass morphism is most effective on dark.
- **No new color introduced** — red-orange brand gradient kept; glass white-opacity approach adds depth without adding a third hue.
- **Utility classes in `index.css`** — `.glass-card`, `.btn-primary`, `.section-label` allow consistent application without repetition.
- **Inter font** — loaded via Google Fonts with `font-display: swap` equivalent (`display=swap` in URL); adds premium typographic feel at zero runtime cost.
- **Lint errors from our changes** — fixed: `updateUser` unused in Dashboard, `user` → `_user` in `PersonalAnalytics`. Pre-existing errors in `button.jsx`, `user-dropdown.jsx`, `VerifyEmail.jsx` unchanged (pre-existing).

---

## Session: UC-17 Change Password While Logged In (2026-06-01)

### What Was Built

- **`backend/controllers/authController.js`** — Added `changePassword`: fetches user (password field included), `bcrypt.compare` current password → 401 if wrong, sets `user.password = newPassword`, calls `user.save()` (pre-save hook re-hashes on `isModified('password')`). No token invalidation — user stays logged in.
- **`backend/routes/authentication.js`** — Added `PUT /api/auth/password` (protected, `validateInput` on `currentPassword` minLength 1 and `newPassword` minLength 6/maxLength 100).
- **`frontend/src/services/api.js`** — Added `authAPI.changePassword(currentPassword, newPassword)`.
- **`frontend/src/pages/ClubAnalytics.jsx` (ProfileView)** — New "Change Password" card section between the Save button and Danger Zone. Three `type="password"` inputs (Current / New / Confirm). Client-side guards: new ≥ 6 chars, new === confirm. Enter key on Confirm field submits. Button disabled until all three filled. On success: fields cleared, green inline banner. On error: red inline message. `Lock` icon added to lucide imports.

### Design Decision

- **ProfileView location** — feature placed in `/analytics` ProfileView (not `/profile`) for consistency with all other account-management fields (username, email, location, delete account) which were relocated there in a prior session.

---

## Session: Code Review & Bug Fixes (2026-06-01)

### Bugs Fixed

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `frontend/src/pages/ClubAnalytics.jsx` | `applyCooldown()` not called after username change → "Change" button stayed visible immediately after a successful change (should lock for 60 days) | Added `applyCooldown(res.data.user.usernameChangedAt)` and `setNewUsername("")` in `handleChangeUsername` success block |
| 2 | `backend/controllers/driveController.js` | `const User = require('../models/user')` duplicated inside `createDrive`, `rsvpToDrive`, and `cancelDrive` — `User` is already imported at the top of the file | Removed all three redundant inline requires |
| 3 | `backend/controllers/driveController.js` | `notify(drive.createdBy.toString(), ...)` crashes when `createdBy` is null (older drives may not have the field) | Wrapped both `notify` calls for `RSVP_UPDATED` and `RSVP_NEW` with `if (drive.createdBy)` guards |
| 4 | `backend/controllers/authController.js` | `deleteAccount` did not remove the deleted user from `club.joinRequests` arrays on other clubs — left orphaned ObjectIds in the DB | Changed `Club.updateMany` to pull from both `members` and `joinRequests` in a single query |
| 5 | `frontend/src/components/NavBar.jsx` | Mobile menu logout button used `<Car>` icon — semantically wrong | Replaced with `<LogOut>` (added to import) |
| 6 | `frontend/src/components/ui/user-dropdown.jsx` | `Shield` was imported from `lucide-react` but never used | Removed the dead import |
| 7 | `frontend/src/pages/Dashboard.jsx` | `drivesAPI.getAttendees()` is a **leader-only** endpoint; calling it for every upcoming drive caused silent 403s for regular members, showing 0 attendees on all drive cards | Replaced with `drivesAPI.getRSVPStatus()` (accessible to all club members); reads `counts.going` from the response |
| 8 | `frontend/src/components/NavBar.jsx` | `handleDropdownAction("notifications")` navigated to `/profile` (wrong); `handleDropdownAction("settings")` navigated to non-existent `/settings` | Both now navigate to `/settings`, which is the canonical route for `ClubAnalytics` |

---

## Session: UC-21 Username Change + Analytics Profile View-Switch (2026-06-01)

### What Was Built

#### UC-21 — Username Change (60-day cooldown)

- **`backend/models/user.js`** — Added `usernameChangedAt: { type: Date, default: null }`.
- **`backend/controllers/authController.js`** — Added `changeUsername`: computes days elapsed since `usernameChangedAt`; throws 400 with exact days-remaining if < 60; validates format with existing `isValidUsername`; checks uniqueness case-insensitively (excludes current user); saves `username` (lowercased) and `usernameChangedAt = new Date()`.
- **`backend/routes/authentication.js`** — Added `PUT /api/auth/username` (protected, `validateInput` username 3–30 chars).
- **`frontend/src/services/api.js`** — Added `authAPI.changeUsername(username)`.
- **`frontend/src/pages/ClubAnalytics.jsx` (ProfileView)** — Username field replaced with interactive inline edit:
  - Eligible state: **Change** button (pencil icon) appears next to label → clicking opens text input + Confirm / Cancel.
  - Cooldown state: **"Available in X days"** label replaces button; field stays disabled.
  - On confirm: calls `authAPI.changeUsername`, updates displayed username, resets cooldown state, fires `onUpdateUser` to sync NavBar initials, shows success banner.
  - Errors (taken name, cooldown violation) shown inline beneath the input.
  - Footer shows last-changed date when `usernameChangedAt` is set.
  - Cooldown computed in `applyCooldown()` helper called from `useEffect` (avoids React compiler `Date.now()` purity warning in render).

#### Analytics Page Profile View-Switch

- **`frontend/src/pages/ClubAnalytics.jsx` (AnalyticsSidebar)** — "Profile" nav item in the top nav block now calls `onViewChange("profile")` instead of `navigate("/profile")`; shows active highlight (zinc-800/60 background + red dot indicator) when selected. The "Profile" sub-entry previously added inside the Analytics accordion has been removed.
- **`frontend/src/pages/ClubAnalytics.jsx` (ProfileView)** — Inline settings view: First Name + Last Name grid (editable), Username with 60-day inline edit, Email (disabled), Location (LocationSearch autocomplete), Save Changes, Danger Zone / Delete Account modal. Loading skeleton and message banner. Calls `onUpdateUser` on profile save and username change.
- **`frontend/src/pages/ClubAnalytics.jsx` (page shell)** — Accepts `onUpdateUser` prop; renders the three views: `personal`, `clubs`, `profile`.
- **`frontend/src/App.jsx`** — `/analytics` route now passes `onUpdateUser={updateUser}`.

#### Bug Fix — Settings dropdown routing

- **`frontend/src/components/NavBar.jsx`** — `handleDropdownAction("settings")` was navigating to `/settings` (no such route → wildcard → `/login` → auth redirect → `/dashboard`). Fixed to `navigate("/analytics")`.

### Design Decisions

- **Cooldown enforced on both sides** — backend rejects with remaining days in the error message; frontend reads `usernameChangedAt` from the profile fetch and hides the change button client-side before the request is even made.
- **`applyCooldown` helper in effect** — React's strict-mode compiler flags `Date.now()` during render as an impure call. Moving it into a plain function called from `useEffect` (and event handlers) satisfies the rule without needing `useMemo` or a ref.
- **Profile fields relocated** — First Name, Last Name, Username, Email, Location, and Delete Account moved from `/profile` into the `ProfileView` within `/analytics`. `/profile` now covers avatar/bio, display name, and car info only.

---

## Session: UC-20 Club Analytics Dashboard (2026-06-01)

### What Was Built

- **UC-20 — Club Analytics Dashboard for Leaders** — fully implemented across backend + frontend.
  - `backend/controllers/driveController.js` — Added `User` model import. Added `getClubAnalytics`: 4 batch queries + in-memory Map aggregation (no N+1). Computes per club: `totalDrives`, `completedDrives`, `cancelledDrives`, `completionRate`, `avgRSVPRate`, `mostPopularDrive`, `mostActiveMember`.
  - `backend/routes/drives.js` — Added `GET /api/drives/analytics` (protected, placed before `/:driveId` wildcards).
  - `frontend/src/services/api.js` — Added `drivesAPI.getAnalytics()`.
  - `frontend/src/pages/ClubAnalytics.jsx` — New page. NavBar + Sidebar layout. Per-club card with stat chips row (Members, Total Drives, Completed + progress bar) and detail cards row (Most Popular Drive, Most Active Member, Avg RSVP Rate + progress bar). Loading skeleton, empty state with "Create a Club" CTA, and error state.
  - `frontend/src/App.jsx` — Added `/analytics` protected route.
  - `frontend/src/pages/Dashboard.jsx` — Added `useClubs` import and `isLeader` derivation. Added "Club Analytics" CTA button (visible to leaders only) between Quick Actions and Create Drive Card.
  - `frontend/src/components/ui/nested-dashboard-menu.jsx` — Added "Club Analytics" item under the Dashboard menu, navigating to `/analytics`.

### Design Decisions

- **Dedicated page** (`/analytics`) rather than embedding in Dashboard — keeps Dashboard lean and allows the analytics content room to breathe.
- **No new npm packages** — stat cards and completion bars are pure Tailwind CSS (width percentage on a bg-zinc-700 track).
- **Backend filters by leader automatically** — `Club.find({ leader: req.user.id })` ensures leaders only see their own clubs; no frontend role guard needed beyond the standard protected route.
- **avgRSVPRate excludes cancelled drives** — cancelled drives have 0 RSVPs by definition and would skew the average down unfairly.

---

## Session: FindClub NavBar + Bell Placement (2026-06-01)

### FindClub NavBar

- **`frontend/src/pages/FindClub.jsx`** — Replaced hardcoded inline `<nav>` (~60 lines: logo, search bar, Home/Users/Bell icon buttons, avatar div, Logout button) with a single `<NavBar user={user} onLogout={onLogout} showSearch={false} />`. Cleaned up now-unused imports (`Car`, `Home`, `Bell`, `User`) — kept `Car` after discovering it was still used in the page body. Removed dead `searchFocused` state. `NavBar` is now the single source of truth for the top navigation across all authenticated pages.

### Gotcha

- Removing `Car` from imports broke the page (ReferenceError) because `Car` is still used in the empty-state illustration and a club card icon inside the page content — not just the old nav. Fixed by restoring `Car` to the import list.

---

## Session: NavBar Bell Placement + Cleanup (2026-06-01)

### What Changed

- **`frontend/src/components/NavBar.jsx`** — Two follow-up changes after the full redesign:
  1. **Removed** the `NestedDashboardMenu` text nav (Dashboard | Clubs | Drives | Profile) and the standalone bell icon per user request — navbar simplified to Logo → Search → Avatar only.
  2. **Restored** the notification bell to the left of the avatar — final layout is Logo → Search → 🔔 Bell → UserDropdown avatar. `useNotifications`, `NotificationPanel`, `Bell` icon, and `useRef` all brought back; `framer-motion` left out (bell uses plain hover CSS instead of spring animation).

### Final NavBar structure

| Section | Desktop (sm+) | Mobile |
|---|---|---|
| Left | Logo + "DriveClique" wordmark | Logo only |
| Center | Search bar | Search icon button |
| Right | Bell + UserDropdown avatar | Hamburger → slide-down menu |

---

## Session: NavBar Full Redesign — NestedDashboardMenu + UserDropdown (2026-06-01)

### What Was Built

**Phase 1 — NestedDashboardMenu**

- Installed `@radix-ui/react-menubar`.
- Created `frontend/src/components/ui/menubar.jsx` — full Radix Menubar primitives in JSX.
- Created `frontend/src/components/ui/nested-dashboard-menu.jsx` — four-menu horizontal bar (Dashboard, Clubs, Drives, Profile) with nested submenus. Uses `useNavigate` for all navigation. Route corrected: `/find-club` (singular) not `/find-clubs`.
- Updated `NavBar.jsx`: replaced `GooeyDock` import and usage with `<NestedDashboardMenu />` inside `hidden sm:flex` wrapper.

**Phase 2 — UserDropdown**

- Installed `@radix-ui/react-dropdown-menu`, `@radix-ui/react-avatar`.
- Created `frontend/src/components/ui/dropdown-menu.jsx` — Radix DropdownMenu primitives in JSX.
- Created `frontend/src/components/ui/avatar.jsx` — Radix Avatar primitives in JSX.
- Created `frontend/src/components/ui/badge.jsx` — `cva`-based Badge with four variants.
- Created `frontend/src/components/ui/user-dropdown.jsx` — full user card dropdown: avatar trigger (initials + status dot), user header card (name, @username, Online badge), status submenu (Focus/Offline), profile links, drives section, support, and red Log out. Uses `lucide-react` icons only.
- Updated `NavBar.jsx`: replaced `SettingsDropdown` with `<UserDropdown>`. Added `getInitials(user)` helper, `selectedStatus` state for status dot + badge, `handleDropdownAction` switch routing all actions to `navigate()` or `onLogout()`. Mobile menu upgraded with user info header row.

### Gotchas

- The `GooeyDock` in the old NavBar was also navigating to `/find-clubs` (wrong). Fixed in `nested-dashboard-menu.jsx` to `/find-club`.
- `@iconify/react` (solar icons) was in the spec dependencies — replaced entirely with `lucide-react` to stay consistent with the existing design system and avoid a second icon library.

---

## Session: GooeyDock Focus Fix + Welcome Message (2026-06-01)

### GooeyDock Focus Ring Fix

- **`frontend/src/components/ui/gooey-dock.jsx`** — Added `focus-visible:ring-0 focus-visible:ring-offset-0` to each dock button's className. Removes the default browser focus ring that appeared as a visible outline when clicking navigation icons.

### Welcome Message on First Login

- **`frontend/src/pages/Dashboard.jsx`** — "Welcome back, [name]" heading is now wrapped in `{showWelcome && ...}`. A `useEffect` checks `sessionStorage.getItem('justLoggedIn')` on mount, shows the greeting, and immediately removes the key so it only appears once per login session.
- **`frontend/src/components/ui/login-form.jsx`** — Sets `sessionStorage.setItem('justLoggedIn', '1')` after a successful login API call, before `onLogin()` / navigate.
- **`frontend/src/components/ui/register-form.jsx`** — Same key set on successful registration so new users see the welcome on their first Dashboard visit.

---

## Session: NavBar Notification Panel Upgrade (2026-06-01)

### Notification Panel Change

- **`frontend/src/components/ui/notification-panel.jsx`** — New self-contained component. All/Unread tab filter (`useState`), type-to-icon map (lucide-react: Calendar, CheckCircle, Users, UserCheck, UserX, Clock, Megaphone, Bell), relative timestamps (`relativeTime` helper from `id`), per-row click calls `markOneRead`, header "Mark all read" button, empty state per tab, footer "View all notifications" link. Click-outside handled via `onClose` prop + internal `useEffect`.
- **`frontend/src/hooks/useNotifications.js`** — Added `markOneRead(id)` callback that flips `n.read` for a single entry and decrements `unreadCount`. Exported in return value.
- **`frontend/src/components/NavBar.jsx`** — Swapped inline notification `<div>` for `<NotificationPanel>`. Removed `typeIcon()`, `useEffect` click-outside, and `CheckCheck` import (now inside the panel). Unread badge capped at 99+.

---

## Session: NavBar Settings Dropdown (2026-06-01)

### UI Change

- **`frontend/src/components/ui/settings-dropdown.jsx`** — New component. Gear (`Settings`) icon as trigger; dropdown with four items: Profile, Clubs, Settings (all navigate), and Logout (red, calls `onLogout`). Uses `useState` + `useRef` click-outside pattern identical to the existing notification panel. No new packages — lucide-react icons only.
- **`frontend/src/components/NavBar.jsx`** — Replaced the plain "Logout" button with `<SettingsDropdown>`. Mobile menu updated: added a Profile button and a divider before Logout.

---

## Session: ClubDetail Drive Section Cleanup (2026-06-01)

### ClubDetail Drive Section Change

- **`frontend/src/pages/ClubDetail.jsx`** — The "Next Upcoming Drive" section in the main content column is now conditionally rendered with `&&` instead of a ternary. When `upcomingDrives.length === 0` nothing is shown — no empty state card, no "No Upcoming Drives" heading, and no "Schedule a Drive" button. The sidebar's "Schedule a Drive" button (right panel) is unaffected.

---

## Session: UC-18 Account Deletion (2026-06-01)

### What Was Built

- **UC-18 — Account Deletion** — fully implemented across backend + frontend.
  - `backend/controllers/authController.js` — `deleteAccount`: requires password, bcrypt-verifies it, blocks if user leads clubs with other members (returns 400 with names), cascade-deletes leader-only clubs (RSVPs → Drives → Clubs), removes user from all other clubs' member arrays, deletes personal RSVPs + RefreshTokens + User document.
  - `backend/routes/authentication.js` — `DELETE /api/auth/account` (protected, `validateInput` on password field).
  - `frontend/src/services/api.js` — `authAPI.deleteAccount(password)` via `api.delete('/auth/account', { data: { password } })`.
  - `frontend/src/pages/Profile.jsx` — "Danger Zone" section with outlined red button; confirmation modal with bullet-point consequences, "cannot be undone" note, password field, inline error display, Cancel + Delete My Account buttons; on success clears localStorage → `onLogout()` → `navigate('/login')`.
  - New imports in `authController.js`: `Club`, `Drive`, `RSVP` models.

### Gotchas encountered

- `api.delete` with a request body requires `{ data: { password } }` syntax in axios — the `data` key is mandatory for DELETE requests with a body.
- Profile page already has a "Cancel" button in the form action bar, so Playwright's `getByRole('button', { name: 'Cancel' })` is ambiguous when the modal is open — must use `.nth(1)` to target the modal's Cancel button specifically.

---

## Session: UC-06 Club Announcements (2026-06-01)

### UC-06 Changes

- **UC-06 — Club Announcements / Pinned Messages** — fully implemented across backend + frontend.
  - `backend/models/club.js` — `announcements: [{ title, body, createdBy, createdAt }]` subdocument array added; no migration needed (Mongoose returns `[]` for existing clubs).
  - `backend/controllers/clubController.js` — `postAnnouncement`: leader-only, `push` to array (Mongoose-safe), fires SSE `NEW_ANNOUNCEMENT` to all non-leader members; `deleteAnnouncement`: leader-only, uses `pull` by subdocument id.
  - `backend/routes/clubs.js` — `POST /:clubId/announcements` and `DELETE /:clubId/announcements/:announcementId`, both behind `protect` middleware and `validateInput`/`validateParams`.
  - `frontend/src/services/api.js` — `clubsAPI.postAnnouncement(clubId, { title, body })` and `clubsAPI.deleteAnnouncement(clubId, announcementId)`.
  - `frontend/src/pages/ClubDetail.jsx` — Announcements section inserted below the drive card in the main content column. Inline post form (optional title + body with 1000-char counter + validation). Card list newest-first (loaded with `.slice().reverse()`; new posts prepended in state). Trash icon for leader. Visibility: `!club.isPrivate || isMember || isLeader` — public clubs show to any logged-in visitor, private clubs restrict to members/leader.
  - SSE event: `NEW_ANNOUNCEMENT` with `{ clubId, clubName, announcement }` payload.

### UC-06 Gotchas

- `unshift()` on a Mongoose `DocumentArray` does not reliably mark the array as modified — changed to `push()` and reversed order on the frontend.
- Backend was not hot-reloading (old process on port 5000 from a prior session); confirmed with `curl` returning "Route not found" and killed the stale process via PowerShell `Stop-Process`.

---

## Session: Login & Register UI Redesign + User Location (2026-05-31)

### New UI Components

- **`src/components/ui/login-form.jsx`** — Two-panel login page: Unsplash car image left panel with DriveClique branding overlay; right panel has username + password, remember-me checkbox, forgot-password link. All auth logic (token storage, profile fetch, `onLogin`) lives inside the component.
- **`src/components/ui/register-form.jsx`** — Matching two-panel register page with a different car image. Fields: First Name + Last Name (side by side), Username, Email, Password, Location search. All registration logic preserved.
- `src/pages/Login.jsx` and `src/pages/Register.jsx` are now 3-line thin wrappers.

### User Model Expansion

- **`backend/models/user.js`** — Added `firstName: String`, `lastName: String`, `location: String` fields.
- **`backend/controllers/authController.js`**:
  - `registerUser` — accepts and stores `firstName`, `lastName`, `location`; derives `name` as `firstName + ' ' + lastName`; all three returned in registration response.
  - `loginUser` — response now includes `firstName`, `lastName`, `location`.
  - `updateProfile` — accepts, saves, and returns `firstName`, `lastName`, `location` alongside existing fields.

### Location Autocomplete

- **`src/components/ui/location-search.jsx`** — Shared `LocationSearch` component; calls **OpenStreetMap Nominatim** (free, no key) with 350ms debounce; accepts all result classes (no strict `class:'place'` filter that dropped cities like New York/Lagos); formats as `"City, State, Country"`; deduplicates; spinner + "No locations found" empty state; dropdown closes on outside click.
- Imported by both `register-form.jsx` and `Profile.jsx`.
- Stored value (e.g. `"Toronto, Ontario, Canada"`) is saved in `user.location` and will power UC-15 location filtering.

### Profile Page

- **`frontend/src/pages/Profile.jsx`** — Personal Information section now shows editable **First Name**, **Last Name** (side by side), and **Location** (with `LocationSearch` autocomplete) fields.
- `formData` state, `fetchProfile` initialisation, and `handleSubmit` all include `firstName`, `lastName`, `location`.
- Profile Preview (right sidebar) shows full name (`firstName + lastName`, falling back to `name` or `username`) and location with a `MapPin` icon.

---

## Session: UC-03 Drive Waitlist (2026-05-31)

### Implemented

- **UC-03 — Drive Waitlist When at Capacity** — fully implemented across backend + frontend.
  - `backend/models/rsvp.js` — `'waitlisted'` added to status enum; position derived from `createdAt` ordering (no stored field).
  - `backend/controllers/driveController.js` — `rsvpToDrive`: Path A (full drive → waitlist enrollment), Path B (going→not-going → auto-promote next in line); `getDriveRSVPStatus`: returns `counts.waitlisted` and `waitlistPosition`.
  - `backend/services/emailService.js` — `waitlistPromoted` template.
  - `frontend/src/pages/ClubDetail.jsx` — three RSVP button states (waitlisted card, Join Waitlist, normal); Waitlisted count badge in RSVP summary.
  - SSE events: `WAITLIST_JOINED`, `WAITLIST_PROMOTED`.

---

## Session: UC-15 Find Clubs — Combined Name + Location Search (2026-05-31)

### Changes

- **UC-15 — Club and Drive Search by Location Filter** — single search bar matching both fields.
  - `backend/controllers/clubController.js` — `searchClubs` now builds `$or: [{ name: regex }, { location: regex }]` from a single `query` param instead of separate name/location filters.
  - `frontend/src/pages/FindClub.jsx` — Unified to one search input (placeholder: "Search by club name or location…"); `locationFilter` state removed; `clubsAPI.searchPage` kept at 3 params.
  - Root cause of delayed fix: a stale Windows server process (PID 56684) held port 5000 and kept serving old code; bash `pkill` did not terminate it — required `Stop-Process` via PowerShell.

---

## Session: LocationSearch on Club Forms (2026-05-31)

### What Changed

- **`frontend/src/pages/CreateClub.jsx`** — replaced plain location `<input>` with `<LocationSearch>`; removed unused `Users` lucide import.
- **`frontend/src/pages/ClubDetail.jsx`** — replaced plain location `<input>` in the club edit panel with `<LocationSearch>`; added import alongside `DriveSchedulerPicker`.
- `LocationSearch` (Nominatim autocomplete, formats as `"City, State, Country"`) is now used consistently across Register, Profile, CreateClub, and ClubDetail edit panel.

---

## Session: Bug Fixes + E2E Journey Tests + Use Case Docs (2026-05-31)

### Bug Fixes Applied

- **Bug 4 — Orphaned RSVPs on club deletion** (`backend/controllers/clubController.js`)
  - `deleteClub` now deletes RSVPs for every drive in the club before deleting the drives themselves.
  - Cascade order: RSVPs → Drives → Club.
- **Bug 5 — Duplicate members via handleJoinRequest** (`backend/controllers/clubController.js`)
  - `handleJoinRequest` now guards with `alreadyMember` check before pushing to `club.members`.

### New E2E Test Coverage

- `frontend/tests/e2e/full-user-journey.spec.ts` — 15 tests, **15/15 passing** in isolation.
  - Covers registration, club lifecycle, drive scheduling, member join, RSVP, cancellation, deletion, Bug 4 & Bug 5 regression proofs, My Clubs, Profile, Find Clubs.
  - Screenshots: `frontend/tests/e2e/screenshots/` (17 PNG files).

### Documentation

- `USE_CASES.md` — Added UC-19 (Member RSVP History) and UC-20 (Club Analytics Dashboard) to Index table and as full detail sections.

---

## Session: Security & Quality Improvements (2026-05-29)

### Fixed Critical Bugs

- **RSVP import crash** — `require('../models/RSVP')` → `require('../models/rsvp')` (case-sensitive)
- **bannedMembers field** — Removed non-existent field from `getLeaderDashboard` select query
- **`remove-member` endpoint missing** — Added `removeMember` controller + route
- **RSVP count broken for non-leaders** — Added `getDriveRSVPStatus` endpoint (member-accessible); replaced broken dual-path fetch in `ClubDetail.jsx`
- **Drive cancellation notifications missing** — Added SSE + email to all members on cancel
- **Join request email missing** — Added email on accept/reject

### Security Vulnerabilities Fixed

- **ReDoS (×2)** — `searchClubs` and `searchUsers` now use `escapeRegex()`
- **Parameter Tampering** — `handleJoinRequest` reads `clubId` from `req.params`, not `req.body`
- **Weak PRNG** — Invite code uses `crypto.randomBytes(3)` (CSPRNG)
- **Duplicate RSVPs** — MongoDB compound unique index `{ drive: 1, user: 1 }` on RSVP model

### Performance Improvements

- **N+1 Query** — `getTopClub` replaced with single `Drive.aggregate()` pipeline

### UX / Code Quality

- Real API error messages on Login/Register (not generic "failed")
- MyClubs: state update instead of `alert()` + `window.location.reload()`
- FindClub: inline dismissible banners replacing `alert()`
- Removed hardcoded stats, deprecated placeholder URLs, debug `console.log` statements

---

## What Works

### Backend ✅

- Express server, MongoDB/Mongoose, JWT auth
- Full user profile management (avatar base64, car, bio, firstName, lastName, location)
- Club CRUD + privacy toggle + invite code (CSPRNG)
- Drive scheduling, RSVP system (going/maybe/not-going/waitlisted) — UC-03
- Drive Waitlist: auto-promote next in queue when a spot frees up; SSE + email on promotion
- Combined name + location club search via `$or` — UC-15
- Cascade delete: club → drives → RSVPs (Bug 4 fixed)
- No duplicate member insertion (Bug 5 fixed)
- Membership check on RSVP endpoints
- Drive cancellation notifications (SSE + email)
- Join request email notifications
- Leader dashboard (optimized aggregation)
- ReDoS-safe search, parameter-tamper-safe requests
- Rate limiting on auth endpoints
- Input validation middleware
- Global error handling (`asyncHandler` + `AppError`)
- Email service: verification, password reset, drive scheduled/cancelled, join request accept/reject, waitlist promoted

### Frontend ✅

- React SPA with React Router v7
- Protected route pattern, auth guard
- Two-panel Login / Register pages (`login-form.jsx`, `register-form.jsx`) with car imagery
- Dashboard (trending club, upcoming drives, email verification banner)
- My Clubs page, Club Detail page (drives, members, RSVP, waitlist states)
- Create Club page, Find Club page (unified name + location search)
- Profile page (avatar upload, car info, bio, first name, last name, location)
- LocationSearch autocomplete (`location-search.jsx`) — Nominatim, used on Register, Profile, CreateClub, ClubDetail edit panel
- GooeyDock navigation bar (Framer Motion liquid-blob effect) with focus ring suppressed
- NavBar notification panel (`notification-panel.jsx`) — tabbed All/Unread, type icons, relative timestamps, per-row mark-as-read, mark-all-read
- NavBar settings dropdown (`settings-dropdown.jsx`) — gear trigger, Profile/Clubs/Settings/Logout items, click-outside close
- Welcome message on first login only (sessionStorage `justLoggedIn` flag, cleared on Dashboard mount)
- Centralized API service layer (`services/api.js`)
- Auto token injection, centralized error handling
- Email verification banner + resend flow
- Forgot password / Reset password pages

### Testing ✅

- `forgot-password.spec.ts` — 27 tests (full reset flow)
- `email-verification.spec.ts` — 19 tests (UC-02 coverage)
- `driveclique-20tests.spec.ts` — End-to-end club lifecycle
- `login-functionality.spec.ts` — Auth flow
- `full-user-journey.spec.ts` — 15 tests, full lifecycle + bug regression proofs

---

## What's Left to Build

### High Priority (documented in USE_CASES.md)

- [ ] UC-14 — Report Inappropriate Content
- [ ] UC-17 — Change Password While Logged In
- [ ] UC-19 — Member RSVP History
- [ ] UC-20 — Club Analytics Dashboard for Leaders

### Medium Priority

- [ ] UC-04 — Drive Reminder Notifications (node-cron scheduler)
- [ ] UC-07 — Club Categories and Tags
- [ ] UC-08 — Drive Check-In (Actual Attendance)
- [ ] UC-10 — Club Co-Leader / Moderator Role
- [ ] UC-11 — Recurring / Repeating Drives
- [ ] UC-12 — Drive Discussion / Comments

### Low Priority

- [ ] UC-05 — Post-Drive Photo Gallery
- [ ] UC-09 — Multiple Cars per User Profile
- [ ] UC-13 — Club Member Directory with Car Showcase

### Infrastructure

- [ ] API versioning (`/api/v1/...`)
- [ ] Swagger/OpenAPI documentation
- [ ] Redis caching for frequently accessed data
- [ ] Object storage for avatars (currently base64 in MongoDB)
- [ ] Production CORS (placeholder domain in server.js)
- [ ] httpOnly cookie auth (currently localStorage)
- [ ] Docker Compose for local setup
- [ ] Pagination for drives lists in ClubDetail

---

## Known Issues

### Pre-existing Playwright Failures (not caused by current session)

- `email-verification.spec.ts` — Some API tests hit rate limits when suite is run repeatedly
- `driveclique-20tests.spec.ts` — Drive-scheduling tests use the same end-of-month calendar pattern; fail on the last day of the month (e.g. May 31) because they select "last enabled day" which is today and the backend rejects same-day dates
- `login-functionality.spec.ts` — Tests using `@example.com` may be blocked by the email verifier service
- `profile-picture-upload.spec.ts` — Times out (1 min) in some environments
- `move-members.spec.ts` — `page.waitForLoadState: Test ended` error in some runs

### Minor

- Club deletion: React `ClubsContext` may show deleted club briefly after deletion (stale cache) — API is authoritative
- Profile image upload can be slow for large images (base64 encoding)

---

## Evolution of Project Decisions

| Decision | Original | Current | Reason |
| --- | --- | --- | --- |
| Club model name | `CarClub`/`carclub.js` | `Club`/`club.js` | Renamed; old reference caused "Club not found" bug |
| API calls | Direct axios per-component | Centralized `services/api.js` | Consistency, auto-auth, easier maintenance |
| Date picker | Dropdown selects | Visual box-calendar grid | Better UX |
| Error handling | Try-catch per controller | `asyncHandler` + `AppError` | Cleaner, DRY |
| Profile data | Basic login response | Login + profile fetch | Login only returns basic info |
| Club deletion | Drives only | Drives + RSVPs (Bug 4 fix) | Orphaned RSVPs caused data integrity issues |
| Join request accept | No guard | alreadyMember check (Bug 5 fix) | Double-accept created duplicate members |
| Test date selection | Last enabled calendar day | Navigate to next month first | Last day of month is today; backend rejects today's date |
