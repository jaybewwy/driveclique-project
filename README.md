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


## License

This project is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). You're welcome to read, run, and learn from the code for any noncommercial purpose (study, personal projects, coursework, etc.) — commercial use requires permission from the author.
