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
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const isDev = process.env.NODE_ENV === 'development';

/**
 * General-purpose limiter for an authenticated feature router (club/drive
 * CRUD, notifications, reports). Generous enough that normal use — including
 * Playwright's fullyParallel test runs — never trips it; still bounds how
 * fast a single client can create/mutate data or spam an endpoint.
 *
 * One instance serves every router, so it is one budget across the API. A
 * signed-in request (on a router that runs `protect` first) counts against
 * its user; anything else against its address. Counted by address alone,
 * everyone behind one campus network or carrier NAT shared 120 a minute.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  // Dev: every Playwright worker shares one IP (localhost). The suite's
  // busiest minute reached 2,656 requests at 4 workers (2026-10-07), so the
  // old cap of 2,000 was refusing requests mid-run. Production is unchanged.
  max: isDev ? 10000 : 120,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
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

/**
 * Limiter for avatar images (GET /api/images). There is no token to count by,
 * so it counts by address, and it is roomier than apiLimiter: one Find Clubs
 * page or Members page is 20 to 30 images at once. Browsers cache each one
 * for a year, so a returning visitor asks for few.
 */
const imageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: isDev ? 10000 : 600,
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, strictLimiter, imageLimiter };
