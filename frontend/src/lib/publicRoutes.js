// Routes reachable without authentication. Kept in one place because
// frontend/src/services/api.js's 401 interceptor must never redirect a
// visitor away from one of these (a background request that 401s there,
// such as one sent with an expired session, must not bounce them) — and
// frontend/src/App.jsx's route table must match this list exactly, or a new
// public page not added here will silently bounce visitors to /login the
// moment that background call 401s. App.jsx asserts the two stay in sync in
// dev mode (see its own PUBLIC_ROUTES import).
export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/confirm-email-change',
];
