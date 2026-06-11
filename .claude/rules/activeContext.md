# Active Context

## Current Focus

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
