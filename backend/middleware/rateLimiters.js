/**
 * Shared rate limiters for authenticated, DB-touching routes.
 *
 * `authentication.js` and `events.js` previously had the only rate limiting
 * in the app — every other route file (clubs, drives, notifications, reports)
 * had none at all, leaving any authenticated user free to hammer them at
 * unlimited volume. This module factors out the isDev-aware windowMs pattern
 * already established by those two files so it isn't re-derived per route
 * file, matching this app's existing extract-once-used-twice convention
 * (utils/regex.js, utils/logger.js, utils/clubPermissions.js).
 */
const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV === 'development';

/**
 * General-purpose limiter for an authenticated feature router (club/drive
 * CRUD, notifications, reports). Generous enough that normal use — including
 * Playwright's fullyParallel test runs — never trips it; still bounds how
 * fast a single client can create/mutate data or spam an endpoint.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: isDev ? 2000 : 120,
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Tight limiter for endpoints that guard a brute-forceable secret (club
 * invite codes — a 6-hex-char / ~16.7M-value space, see models/club.js).
 * Even a generous production ceiling here makes iterating that keyspace
 * impractically slow, without needing to touch the code's own entropy.
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: isDev ? 500 : 10,
  message: { success: false, message: 'Too many attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, strictLimiter };
