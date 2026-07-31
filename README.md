# DriveClique

A full-stack social platform for automotive enthusiasts to form clubs, schedule drives, and coordinate events — built as a Master's Degree capstone project.

---

## What It Does

DriveClique fills the gap between general-purpose social media (Facebook groups, Discord) and purpose-built event management. It gives car clubs a dedicated space with:

- **Club management** — create public or private clubs, control membership with invite codes or join-request approval
- **Drive scheduling** — visual calendar picker, RSVP system (going / maybe / not-going), automatic waitlist promotion when spots open
- **Real-time notifications** — Server-Sent Events stream new drives, RSVPs, join requests, and announcements to connected members instantly
- **Club analytics** — leaders see member counts, drive completion rates, avg RSVP rate, most popular drive, and most active member
- **Content moderation** — members can flag inappropriate clubs, drives, or users; leaders receive email notifications for reports in their clubs

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router v7, Vite, Tailwind CSS v3, Axios |
| Backend | Node.js, Express 5, MongoDB / Mongoose 9 |
| Auth | JWT (access token 15 min) + refresh token (7 days, stored in MongoDB) |
| Real-time | Server-Sent Events (SSE) via Node `EventEmitter` |
| Email | Nodemailer (SMTP) — silently no-ops when unconfigured |
| Testing | Playwright E2E (15 tests) |

> **Module system:** Backend uses CommonJS (`require`/`module.exports`). Frontend uses ESM (`import`/`export`). Do not mix them.

---

## Local Setup

### Prerequisites
- Node.js LTS
- MongoDB running locally (or a connection string)

### Backend

```bash
cd backend
cp .env.example .env     # fill in MONGO_URI and JWT_SECRET at minimum
npm install
npm run dev              # nodemon on port 5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # Vite on port 5173
```

### Environment Variables (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `PORT` | No | API port (default 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `SMTP_HOST` | No | SMTP host for emails |
| `SMTP_PORT` | No | SMTP port (default 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `FRONTEND_URL` | No | Used in password-reset email links |
| `EMAIL_VERIFIER_URL` | No | Email validation service URL |

SMTP is optional — all email features silently no-op when unconfigured.

---

## Environments & Deployment

Two long-lived branches, two Railway services, two databases — staging is a full dress rehearsal of production, never a shared environment.

| | `staging` branch | `main` branch |
|---|---|---|
| Railway service | `driveclique-staging` (backend) + its frontend service | `driveclique-production` (backend) + its frontend service |
| Database | Dedicated free-tier MongoDB Atlas cluster | Production MongoDB |
| Purpose | New features land here first via PR; verify against a prod-like deploy | Only receives merges from `staging` once verified |

### Day-to-day flow

1. Branch off `staging` (not `main`) for new feature work: `git checkout -b feature/x staging`.
2. Open a PR into `staging`. CI (`.github/workflows/ci.yml`) runs lint/build/audit/E2E on every push and PR to **both** `main` and `staging`.
3. Merging into `staging` triggers Railway's auto-deploy for the `driveclique-staging` service. Verify the feature there against real (but non-production) data.
4. Once verified, open a PR from `staging` into `main`. Merging deploys to production the same way.

### One-time Railway setup (per service, do this in the Railway dashboard — not scriptable from here)

1. In the existing Railway project, add a **new service** for each of backend and frontend (e.g. `driveclique-backend-staging`, `driveclique-frontend-staging`), pointing at this GitHub repo with **branch = `staging`** (Settings → Source). The production services keep branch = `main`.
2. Backend staging service env vars (Settings → Variables) — same keys as the table above, but staging-specific values:
   - `MONGO_URI` → the staging Atlas cluster's connection string (see below)
   - `JWT_SECRET` → a separate secret from production (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
   - `FRONTEND_URL` → the staging frontend's Railway URL
   - `NODE_ENV=production` (so rate-limit windows match prod behavior, even though the data is throwaway)
3. Frontend staging service: it builds from `frontend/Dockerfile`, which takes `VITE_API_URL` as a **build arg**, not a `.env` file — set it under the service's build settings to the staging backend's Railway URL + `/api`.
4. Update the backend staging service's `ALLOWED_ORIGIN_WEB` (or equivalent CORS allowlist) to the staging frontend's URL once both are deployed once.

### One-time MongoDB Atlas setup (staging database)

1. Create a free-tier (M0) Atlas cluster dedicated to staging — never point staging at the production cluster.
2. Create a database user scoped to that cluster only.
3. Network Access → allow Railway's egress (`0.0.0.0/0` is the pragmatic option for a free-tier staging cluster with no sensitive real-user data; Atlas also supports Railway's static IPs if you want to lock it down further).
4. Copy the connection string into the staging backend service's `MONGO_URI`.

---

## Architecture Decisions

### Two-token auth
Login issues a short-lived JWT (15 min) plus a long-lived refresh token (7 days) stored in the `RefreshToken` collection. The frontend Axios interceptor catches 401s, calls `POST /api/auth/refresh`, and replays the original request transparently. This means access tokens expire quickly (limiting exposure) while sessions stay alive without re-login.

### SSE over WebSockets
The notification stream (`GET /api/notifications/stream`) uses SSE rather than WebSockets. SSE is simpler (no upgrade handshake, works through HTTP/2), sufficient for one-way server-to-client pushes, and needs no extra library — just `res.write('data: ...\n\n')`. The `notify(userId, payload)` helper in `notificationEmitter.js` fires a Node `EventEmitter` event; any open SSE connection for that user picks it up.

### Drive waitlist without stored position
Waitlist position is derived at query time by counting waitlisted RSVPs with an earlier `createdAt`. This avoids race conditions and recomputation when members leave — the `{ timestamps: true }` option on the RSVP schema makes ordering free.

### Club analytics without N+1 queries
`getClubAnalytics` uses 4 batch queries + in-memory `Map` aggregation instead of querying per club. Drives, RSVPs, and members are fetched in bulk; per-club stats are computed in a single pass over the result sets.

### Email validation on registration
`registerUser` calls `rapid-email-verifier.fly.dev` before creating the account, rejecting disposable addresses, invalid domains, and domains without MX records. The check **fails open** — a service timeout never blocks a legitimate signup.

### `asyncHandler` wrapper
Every controller is wrapped in `asyncHandler`, which catches thrown errors and forwards them to the global error handler. Controllers never need try/catch; they just throw `new AppError(message, statusCode)`.

---

## API Overview

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/profile
PUT    /api/auth/profile
PUT    /api/auth/password
PUT    /api/auth/username
DELETE /api/auth/account
GET    /api/auth/verify-email
POST   /api/auth/resend-verification

GET    /api/clubs
POST   /api/clubs
GET    /api/clubs/browse
GET    /api/clubs/:id
PUT    /api/clubs/:id
DELETE /api/clubs/:id
POST   /api/clubs/:id/join
POST   /api/clubs/:id/join-by-code
POST   /api/clubs/join-by-invite-code
PUT    /api/clubs/:id/requests/:userId
POST   /api/clubs/:id/announcements
DELETE /api/clubs/:id/announcements/:announcementId

GET    /api/drives/club/:clubId
GET    /api/drives/:id/rsvp
POST   /api/drives
PUT    /api/drives/:id
DELETE /api/drives/:id
POST   /api/drives/:id/rsvp
GET    /api/drives/analytics
GET    /api/drives/my-rsvps

POST   /api/reports
GET    /api/notifications/stream
```

---

## Features Implemented

| Use Case | Description |
|----------|-------------|
| UC-01 | Forgot password / email reset |
| UC-02 | Email verification on registration |
| UC-03 | Drive waitlist with auto-promotion |
| UC-06 | Club announcements |
| UC-07 | — |
| UC-14 | Report inappropriate content |
| UC-15 | Club + location unified search |
| UC-17 | Change password while logged in |
| UC-18 | Account deletion with cascade |
| UC-19 | Member RSVP history |
| UC-20 | Club analytics dashboard for leaders |
| UC-21 | Username change (60-day cooldown) |
| UC-40 | Accessibility (WCAG AA) pass + axe/jsx-a11y regression tooling |
| UC-41 | Product analytics (self-hosted event tracking + admin dashboard) |

---

## Running Tests

Both servers must be running first.

```bash
cd frontend

# All tests (headless)
npx playwright test

# Single file
npx playwright test tests/e2e/full-user-journey.spec.ts

# Headed (visible browser)
npx playwright test --headed

# HTML report
npx playwright show-report
```

**Known gotchas in tests:**
- Test emails must use real domains (`@mail.com`) — the email verifier rejects `@test.com`, `@example.com`
- Drive scheduling tests must navigate to **next month** before selecting a date — the backend rejects `date <= new Date()`
- Club detail pages hold an SSE connection open, so `waitForLoadState('networkidle')` never resolves — use element-based waits instead

---

## Project Structure

```
capstone/
├── backend/
│   ├── controllers/       # Business logic (authController, clubController, driveController, reportController)
│   ├── middleware/        # authentication, errorHandler, validation
│   ├── models/            # Mongoose schemas (User, Club, Drive, RSVP, RefreshToken, Report)
│   ├── routes/            # Express routers
│   ├── services/          # emailService, notificationEmitter, emailVerifier
│   └── server.js
└── frontend/
    ├── src/
    │   ├── components/    # NavBar, Sidebar, Toast, Modal
    │   │   └── ui/        # login-form, register-form, user-dropdown, notification-panel, ReportModal, ...
    │   ├── hooks/         # useAuth, useClubs, useNotifications
    │   ├── pages/         # Dashboard, ClubDetail, FindClub, MyClubs, Profile, UserSettings, ...
    │   └── services/      # api.js — single Axios instance, all HTTP calls go here
    └── tests/e2e/         # Playwright specs + screenshots
```

---

## License

This project is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). You're welcome to read, run, and learn from the code for any noncommercial purpose (study, personal projects, coursework, etc.) — commercial use requires permission from the author.
