// How large a JSON request body may be. express.json() reads and parses the
// whole body on the event loop before any route, limiter, or `protect` runs,
// so a large one stalls every other request: one unauthenticated 44 MB array
// of small objects held the API for 0.9 s under the old 50 MB limit.
//
// Every body is capped at DEFAULT_LIMIT. The routes that carry base64 images
// take more, and only from a request with a valid access token, so nobody
// can make the API parse megabytes without signing in.

const express = require('express');
const { bearerToken, verifyAccessToken } = require('./authentication');

const DEFAULT_LIMIT = '100kb';

// Each limit is the route's validation caps plus room for the rest of the body
const IMAGE_ROUTES = [
  // An avatar and up to 5 cars × 4 photos, 300,000 characters each (routes/authentication.js)
  { method: 'PUT', path: /^\/api\/auth\/profile\/?$/, limit: '7mb' },
  // Up to 12 gallery photos of 300,000 characters (routes/drives.js)
  { method: 'POST', path: /^\/api\/drives\/[^/]+\/photos\/?$/, limit: '4mb' },
  // A route image of 300,000 characters, when a drive is created or edited
  { method: 'POST', path: /^\/api\/drives\/?$/, limit: '1mb' },
  { method: 'PUT', path: /^\/api\/drives\/[^/]+\/?$/, limit: '1mb' },
  // The club avatar, 100,000 characters (routes/clubs.js)
  { method: 'PUT', path: /^\/api\/clubs\/[^/]+\/?$/, limit: '1mb' },
];

const parsers = new Map(
  [DEFAULT_LIMIT, ...IMAGE_ROUTES.map((route) => route.limit)]
    .map((limit) => [limit, express.json({ limit })])
);

const isSignedIn = (req) => {
  try {
    verifyAccessToken(bearerToken(req));
    return true;
  } catch {
    return false;
  }
};

const jsonBody = (req, res, next) => {
  const route = IMAGE_ROUTES.find((r) => r.method === req.method && r.path.test(req.path));
  const limit = route && isSignedIn(req) ? route.limit : DEFAULT_LIMIT;
  parsers.get(limit)(req, res, next);
};

// No route reads a form body; this keeps one from reaching the old 50 MB too
const formBody = express.urlencoded({ extended: true, limit: DEFAULT_LIMIT });

module.exports = { jsonBody, formBody };
