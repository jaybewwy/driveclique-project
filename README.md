# DriveClique

A social platform where car enthusiasts form clubs, schedule drives, and keep track of who is coming. Built as a master's degree capstone project.

The repository holds three applications that share one API:

| Folder | What it is |
| --- | --- |
| [`backend/`](backend/) | Express and MongoDB REST API, with a Server-Sent Events stream for notifications |
| [`frontend/`](frontend/) | React web app. Installable as a PWA, and packaged for Android and iOS with Capacitor |
| [`mobile/`](mobile/) | Expo (React Native) client covering the core screens |

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Testing](#testing)
- [Branches, CI, and deployment](#branches-ci-and-deployment)
- [Architecture decisions](#architecture-decisions)
- [API overview](#api-overview)
- [Use cases](#use-cases)
- [Project structure](#project-structure)
- [License](#license)

---

## What it does

DriveClique fills the gap between general-purpose social media (Facebook groups, Discord) and purpose-built event management. It gives a car club its own space for members, drives, and announcements.

### Clubs

- Public or private clubs. Private clubs are hidden from search and joined by approval or with an invite code.
- A leader and up to three co-leaders, with ownership transfer.
- Tags, announcements, member removal and banning.
- A Club Settings page with one section per concern: general details, privacy, reports, ownership, and deletion.

### Drives

- Scheduling with a calendar picker, a meeting point on a map, and a time zone. Viewers in another zone also see the start in their own time.
- Recurring series: weekly, every two weeks, or monthly, up to 12 occurrences.
- RSVP as going, maybe, or not going. A full drive keeps a waitlist and promotes the next person when a spot opens.
- Check-in on the day, star ratings afterward, and a photo gallery curated by the club's leaders.
- A month calendar of every drive in your clubs, with `.ics` export for one drive or your whole schedule.

### Discovery

- Search clubs by name, location, and tag.
- Search by distance: clubs within a radius of your location or a chosen city, nearest first, plus upcoming drives nearby.

### Notifications

- A live in-app feed over Server-Sent Events, with history and a mute switch per notification type.
- Email for the events that matter (new drives, cancellations, reminders, join requests). Optional: with no SMTP settings the app runs without it.
- Push notifications in the mobile app.
- A reminder about a day before any drive you answered "going" or "maybe" to.

### Accounts

- Registration with email verification, sign-in with short-lived access tokens, and password reset by email.
- Password, username, and email changes. A new password cannot repeat any of the last five.
- A profile with a garage of cars and photos, and a public profile other members can open.
- Blocking of users and clubs, and account deletion that cleans up everything the account owned.
- Light and dark themes, saved to the account.

### Moderation and insight

- Members can report a club, a drive, or another member. Reports on a club's drives and members go to a review queue that only that club's leader and co-leaders can open.
- Leaders get club analytics: member counts, drive completion rate, average RSVP rate, most popular drive, most active member.
- A self-hosted product analytics dashboard for administrators.

### Quality

- WCAG AA accessibility, checked by axe in the end-to-end tests and by `jsx-a11y` lint rules.
- Rate limiting on every router, validated input on every route, and security headers from Helmet and nginx.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Web app | React 19, React Router 7, Vite 8, Tailwind CSS 3, Radix UI, Leaflet, Axios |
| Web app packaging | `vite-plugin-pwa` (installable PWA), Capacitor 8 (Android and iOS shells) |
| Mobile app | Expo SDK 56, React Native 0.85, Expo Router, NativeWind |
| API | Node.js 20+, Express 5, Mongoose 9 on MongoDB |
| Auth | JWT access token (15 minutes) and a refresh token (7 days) stored in MongoDB |
| Real time | Server-Sent Events through a Node `EventEmitter` |
| Email and push | Nodemailer over SMTP, Expo Push API |
| Scheduled jobs | `node-cron` (hourly drive reminders) |
| Tests | Playwright with axe-core (end to end), Node's built-in test runner (backend units) |
| CI and hosting | GitHub Actions, Railway, MongoDB Atlas |

> **Module systems.** The backend is CommonJS (`require` / `module.exports`). The web and mobile apps are ES modules (`import` / `export`). Keep each as it is.

---

## Getting started

### Prerequisites

- Node.js 20.19 or newer (Mongoose 9 requires it)
- MongoDB, running locally or reachable through a connection string

### 1. API

```bash
cd backend
cp .env.example .env     # set MONGO_URI and JWT_SECRET at minimum
npm install
npm run dev              # nodemon, http://localhost:5000
```

### 2. Web app

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev              # Vite, http://localhost:5173
```

The `--legacy-peer-deps` flag is required: one lint plugin has not yet declared support for the installed ESLint version. In development the web app calls `http://localhost:5000/api` unless `VITE_API_URL` says otherwise.

### 3. Mobile app (optional)

```bash
cd mobile
npm install
npx expo start
```

The app calls `EXPO_PUBLIC_API_URL`, which defaults to `http://10.0.2.2:5000/api`: the address an Android emulator uses to reach the host machine. Set it to your machine's LAN address to test on a real phone.

### Native builds of the web app (optional)

The Capacitor projects are generated, not committed. To create them:

```bash
cd frontend
npm run build:capacitor
npx cap add android && npx cap add ios
npx cap sync
```

Keep `@capacitor/android`, `@capacitor/ios`, `@capacitor/core`, and `@capacitor/cli` on the same version. Run `npx cap sync` after any change to them.

### Everything in Docker (optional)

`docker-compose.yml` runs MongoDB, the API, and the nginx-served web build together. The MongoDB service requires credentials and refuses to start without them:

```bash
cp .env.example .env                    # repo root: MONGO_ROOT_USERNAME / MONGO_ROOT_PASSWORD
cp backend/.env.example backend/.env
docker-compose up --build               # web on http://localhost, API on http://localhost:5000
```

---

## Configuration

### API (`backend/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGO_URI` | Yes | | MongoDB connection string |
| `JWT_SECRET` | Yes | | Secret for signing access tokens |
| `PORT` | No | `5000` | Port the API listens on |
| `NODE_ENV` | No | `development` | `production` tightens rate limits and restricts CORS to `ALLOWED_ORIGIN_WEB` |
| `FRONTEND_URL` | No | | Base URL for the links in emails (verification, password reset) |
| `ALLOWED_ORIGIN_WEB` | In production | | Origin of the deployed web app, for CORS. The Capacitor origins are always allowed |
| `EMAIL_VERIFIER_URL` | No | Public instance | Address-checking service called at registration |
| `DEFAULT_TIME_ZONE` | No | `America/Los_Angeles` | IANA zone for a drive created without one |
| `ADMIN_EMAILS` | No | | Comma-separated emails allowed to open the admin analytics. Unset means nobody |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | No | Port `587` | SMTP server. With none set, email is skipped and everything else works |
| `EMAIL_FROM` | No | `DriveClique <noreply@driveclique.app>` | Sender shown on outgoing email |

### Web app (`frontend/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | In production builds | Base URL of the API, ending in `/api`. The Docker image takes it as a build argument |
| `VITE_IS_NATIVE` | No | `true` in the Capacitor build (`.env.capacitor`), which turns on native-only behavior such as the status bar |

### Mobile app

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | No | Base URL of the API, ending in `/api` |

---

## Testing

| Suite | Where | Command | Size |
| --- | --- | --- | --- |
| End to end | `frontend/tests/e2e/` | `npm test` in `frontend/` | About 440 tests in 54 spec files |
| Backend units | `backend/utils/*.test.js` | `npm test` in `backend/` | 18 tests |
| Lint | `frontend/` | `npm run lint` | ESLint with `jsx-a11y` |

Playwright does not start the servers itself. Run the API and the web app first, then:

```bash
cd frontend
npm test                                           # whole suite, headless
npm test -- tests/e2e/full-user-journey.spec.ts    # one file
npm test -- --headed                               # watch it in a browser
npm test -- --workers=4                            # a steadier local run of the whole suite
```

Things to know when writing or running end-to-end tests:

- **Email addresses.** Registration checks each address with an external verifier, which rejects made-up domains such as `@test.com`. Use `@mail.com`, or start the API with `EMAIL_VERIFIER_URL=http://127.0.0.1:9` to switch the check off, as CI does.
- **Drive dates.** The API rejects a drive that starts in the past. A test that needs a safe future date should move the picker to next month first.
- **Waiting for a page.** The club page keeps a notification stream open, so `waitForLoadState('networkidle')` never resolves there. Wait for an element instead.
- **Live services.** A few specs call the real OpenStreetMap geocoder and can fail when it rate-limits. Three specs depend on a hand-prepared database or that live service, and CI skips them (see `playwright.config.ts`).

---

## Branches, CI, and deployment

Work lands on `staging` first and reaches `main` by pull request once it has been verified.

1. Branch from `staging`: `git checkout -b feature/x staging`.
2. Open a pull request into `staging`.
3. After the change is verified on the staging deployment, open a pull request from `staging` into `main`.

### Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request to either branch:

| Job | What it checks |
| --- | --- |
| Lint & Build | `eslint .` and a production `vite build` of the web app |
| npm audit | No high or critical advisories in the API's dependencies or the web app's production dependencies |
| E2E Tests | The Playwright suite against a fresh MongoDB 7, one worker |

### Hosting

The project deploys to Railway from this repository, with MongoDB Atlas for data. Railway waits for the CI checks to pass before it deploys a commit.

- **API.** Configured by [`backend/railway.toml`](backend/railway.toml): a Nixpacks build, `node server.js`, and a health check on `/`.
- **Web app.** [`frontend/Dockerfile`](frontend/Dockerfile) builds the app and serves it from nginx. [`frontend/nginx.conf`](frontend/nginx.conf) sets the security headers and the caching rules.
- **Data.** Each environment gets its own Atlas database. Staging must never point at production data.

### Setting up a new environment

On Railway:

1. Add an API service and a web service that point at this repository and at the environment's branch (Settings → Source).
2. Set the API service's variables from the [configuration table](#api-backendenv), with values of its own:
   - `MONGO_URI`: this environment's Atlas connection string.
   - `JWT_SECRET`: a secret not shared with any other environment. Generate one with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.
   - `FRONTEND_URL` and `ALLOWED_ORIGIN_WEB`: the URL of this environment's web service.
   - `NODE_ENV=production`, so rate limits and CORS behave as they will in production.
3. Set the web service's `VITE_API_URL` build argument to the API service's URL plus `/api`. It is read at build time, not from an `.env` file.

On MongoDB Atlas:

1. Create a cluster for this environment alone. A free M0 cluster is enough for staging.
2. Create a database user scoped to that cluster.
3. Under Network Access, allow Railway's outbound addresses. `0.0.0.0/0` is the practical choice for a staging cluster with no real user data.
4. Put the connection string in the API service's `MONGO_URI`.

### Data migrations

Two scripts in `backend/scripts/` bring older data up to date. Both print the database they are connected to, change nothing unless given `--apply`, and are safe to run twice.

| Script | What it does |
| --- | --- |
| `migrate-drive-start-times.js` | Gives drives created before time zones a real start instant and a zone |
| `backfill-club-coordinates.js` | Geocodes the location of clubs created before distance search |

```bash
cd backend
node scripts/migrate-drive-start-times.js                                       # dry run against backend/.env
node --env-file=<other-env-file> scripts/migrate-drive-start-times.js --apply   # write to another database
```

---

## Architecture decisions

**Two-token auth.** Sign-in issues a 15-minute JWT and a 7-day refresh token kept in the `RefreshToken` collection. The web app's Axios interceptor catches a 401, calls `POST /api/auth/refresh`, and replays the original request, so access tokens stay short-lived without anyone being signed out mid-session.

**SSE instead of WebSockets.** Notifications only flow from server to client, and Server-Sent Events cover that with plain HTTP and no extra library. `notify(userId, payload)` emits on a Node `EventEmitter`, and any open stream for that user writes it out. Because `EventSource` cannot send headers, the stream authenticates with a `?token=` query parameter that the request log redacts.

**Waitlist position is not stored.** A waitlisted member's place in line is the count of waitlisted RSVPs created before theirs. Nothing needs renumbering when someone leaves, and two people joining at once cannot be handed the same position.

**A drive stores its exact start and its zone.** Each drive keeps `startsAt` (the instant it begins) and `timeZone` (an IANA name) beside its calendar day. Reminders, "upcoming" filters, and calendar exports use the instant. Screens show the drive's own local time and add the viewer's when it differs. Recurring series step by calendar day, so a 10 AM drive stays at 10 AM across a daylight-saving change.

**Distance search uses the database for clubs and arithmetic for drives.** Clubs carry a GeoJSON point with a `2dsphere` index and are searched with `$geoNear`. Drives keep the plain latitude and longitude pair their map pin already had, so nearby drives use a bounding-box query followed by an exact haversine check, with no migration.

**Analytics without a query per club.** The leader analytics fetch clubs, drives, RSVPs, ratings, and users in a handful of batch queries and aggregate them in memory with `Map`s. The number of queries does not grow with the number of clubs.

**Themes are CSS variables, not class rewrites.** Tailwind's `zinc`, `white`, and `black` colors point at CSS variables with a dark set and a light set of values. Existing classes follow the theme, and the dark theme compiles to the same colors it had before the light one existed.

**Clients ask only for what they may see.** RSVP data and a private club's drive list are for members only. The clients decide from the viewer's role whether to request them, so a visitor's page load never produces a refused request or a denied-access log entry.

**Registration checks the email address and fails open.** A verifier service rejects disposable addresses and domains with no mail server. If the service is slow or down, registration goes ahead.

**Controllers throw; one handler answers.** Every controller is wrapped in `asyncHandler` and throws `AppError(message, statusCode)`. The global error handler turns that into the response, so controllers carry no `try`/`catch`.

---

## API overview

Every route is under `/api` and expects `Authorization: Bearer <access token>`, except the ones marked *public*. Request bodies and query strings are validated on every route.

### Auth and accounts: `/api/auth`

```text
POST   /register                    public   Create an account
POST   /login                       public   Sign in
POST   /refresh                     public   Exchange a refresh token for a new access token
POST   /logout                      public   Revoke a refresh token
POST   /forgot-password             public   Email a reset link
POST   /reset-password              public   Set a new password with the emailed token
GET    /verify-email                public   Confirm an email address
POST   /resend-verification                  Send the verification email again
GET    /profile                              The signed-in user's profile
PUT    /profile                              Update profile, garage, and theme
PUT    /password                             Change password
PUT    /username                             Change username (60-day cooldown)
POST   /email-change                         Request an email change
GET    /email-change/confirm        public   Confirm it from the emailed link
DELETE /account                              Delete the account and what it owns
GET    /users/search                         Find users by username
GET    /users/:userId/public                 A member's public profile
POST   /users/:userId/block                  Block a user
DELETE /users/:userId/block                  Unblock a user
POST   /push-token                           Register a device for push notifications
DELETE /push-token                           Remove a device
```

### Clubs: `/api/clubs`

```text
GET    /                                     Clubs the user belongs to
POST   /                                     Create a club
GET    /browse                               Search by text, tags, or distance (lat, lng, radius)
GET    /trending                             The most active club
GET    /blocked                              Clubs the user has blocked
GET    /invite/:inviteCode                   Preview a club from its invite code
POST   /join-by-code/:inviteCode             Join with an invite code
GET    /:clubId                              Club details
PUT    /:clubId                              Update details (accepts a partial body)
DELETE /:clubId                              Delete the club, its drives, RSVPs, and reports
POST   /:clubId/join                         Join, or ask to join
POST   /:clubId/handle-request               Approve or deny a join request
POST   /:clubId/toggle-privacy               Switch between public and private
PUT    /:clubId/leave                        Leave the club
PUT    /:clubId/transfer                     Hand ownership to another member
PUT    /:clubId/promote                      Make a member a co-leader
PUT    /:clubId/demote                       Return a co-leader to member
DELETE /:clubId/members/:memberId            Remove a member, optionally banning them
GET    /:clubId/banned                       Banned members
DELETE /:clubId/banned/:userId               Lift a ban
POST   /:clubId/block                        Block the club
DELETE /:clubId/block                        Unblock the club
POST   /:clubId/announcements                Post an announcement
DELETE /:clubId/announcements/:announcementId  Delete an announcement
```

### Drives: `/api/drives`

```text
POST   /                                     Schedule a drive or a recurring series
GET    /club/:clubId                         A club's drives (members only for a private club)
GET    /calendar                             Drives in a given month
GET    /nearby                               Upcoming drives within a radius
GET    /dashboard                            Leader dashboard
GET    /analytics                            Club analytics for leaders
GET    /my-rsvps                             The user's RSVP history
GET    /my-rsvps/export.ics                  The user's schedule as a calendar file
PUT    /:driveId                             Edit a drive
DELETE /:driveId                             Delete a drive
POST   /:driveId/cancel                      Cancel a drive, with a reason
POST   /series/:groupId/cancel               Cancel the rest of a series
POST   /:driveId/rsvp                        RSVP: going, maybe, or not going
GET    /:driveId/rsvp-status                 RSVP counts and the user's own answer
GET    /:driveId/attendees                   Attendee list
GET    /:driveId/export.ics                  One drive as a calendar file
POST   /:driveId/request-checkin             Ask attendees to check in
GET    /:driveId/checkin-status              Check-in progress
POST   /:driveId/checkin                     Check in
POST   /:driveId/ratings                     Rate a completed drive
GET    /:driveId/ratings                     A drive's ratings
POST   /:driveId/photos                      Add photos to a completed drive
DELETE /:driveId/photos/:index               Remove a photo
```

### Notifications, reports, and analytics

```text
GET    /api/notifications/stream             Live stream (SSE, authenticated with ?token=)
GET    /api/notifications                    Notification history
PUT    /api/notifications/read-all           Mark all as read
PUT    /api/notifications/:notificationId/read  Mark one as read
GET    /api/notifications/preferences        Which types are muted
PUT    /api/notifications/preferences        Mute or unmute types

POST   /api/reports                          Report a club, drive, or user
GET    /api/reports/club/:clubId             A club's review queue (leader and co-leaders)
PUT    /api/reports/:reportId                Resolve, dismiss, or reopen a report

POST   /api/events                           Record a product analytics event
GET    /api/events/my-summary                The user's own activity summary
GET    /api/events/admin-summary             Site-wide summary (ADMIN_EMAILS only)
```

---

## Use cases

The project is organized around numbered use cases. These are the ones that have shipped. Numbers missing from the sequence were never assigned or were dropped.

| Use case | Description |
| --- | --- |
| UC-01 | Forgot password and reset by email |
| UC-02 | Email verification on registration |
| UC-03 | Drive waitlist with automatic promotion |
| UC-04 | Drive reminders, and a public or private choice when creating a club |
| UC-05 | Photo gallery for completed drives |
| UC-06 | Club announcements |
| UC-08 | Drive check-in |
| UC-09 | My Garage: cars and photos on the profile |
| UC-10 | Co-leader role |
| UC-11 | Recurring drives |
| UC-14 | Report inappropriate content |
| UC-15 | Unified club and location search |
| UC-17 | Change password while signed in |
| UC-18 | Account deletion with cascade |
| UC-19 | Member RSVP history |
| UC-20 | Club analytics for leaders |
| UC-21 | Username change with a 60-day cooldown |
| UC-22 | Public member profile |
| UC-23 | Drive meeting point on a map |
| UC-24 | Month calendar of drives |
| UC-25 | Drive rating and feedback |
| UC-26 | Onboarding checklist for new users |
| UC-27 | Branded 404 page |
| UC-28 | Email address change |
| UC-29 | Password strength indicator and policy |
| UC-30 | Notification history and per-type preferences |
| UC-32 | Member blocking and club ban list |
| UC-33 | Calendar export (`.ics`) |
| UC-34 | Mobile push notifications |
| UC-40 | Accessibility (WCAG AA) with automated regression checks |
| UC-41 | Product analytics with an admin dashboard |
| UC-42 | Report review queue for club leaders |
| UC-46 | Distance search for clubs and drives |
| UC-49 | Light and dark themes |

---

## Project structure

```text
capstone/
├── backend/
│   ├── controllers/     One per concern: auth, user, club, clubMembership, drive, rsvp, report, ...
│   ├── middleware/      authentication, validation, rateLimiters, requireAdmin, errorHandler
│   ├── models/          User, Club, Drive, RSVP, DriveRating, Report, Notification, Event, RefreshToken
│   ├── routes/          auth, clubs, drives, notifications, reports, events
│   ├── services/        email, push, notification stream, reminder scheduler, cascading deletes
│   ├── utils/           drive time zones, geo math, .ics export, permissions (unit tests alongside)
│   ├── scripts/         One-off data migrations
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── pages/       One file per route
│   │   ├── components/  Shared UI, grouped by page: club/, club-settings/, find-club/, settings/, ui/
│   │   ├── hooks/       useAuth, useClubs, useNotifications, ...
│   │   ├── lib/         Dates and time zones, theme, club roles, display names
│   │   ├── services/    api.js: the single Axios instance every request goes through
│   │   └── theme.css    Color variables for the dark and light themes
│   ├── tests/e2e/       Playwright specs
│   ├── nginx.conf       Production web server: security headers and caching
│   └── capacitor.config.ts
├── mobile/
│   ├── app/             Expo Router screens: sign-in, dashboard, clubs, drive check-in, settings
│   └── src/             Hooks, API client, push notifications, theme tokens
├── .github/workflows/   CI
└── docker-compose.yml
```

---

## License

This project is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). You are welcome to read, run, and learn from the code for any noncommercial purpose: study, personal projects, coursework. Commercial use requires permission from the author.
