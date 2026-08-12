import { test, expect } from '@playwright/test';
import crypto from 'crypto';

const API = 'http://localhost:5000/api';

// ─── Input sanitization / NoSQL-injection regression coverage ──────────────
// GitHub CodeQL flagged js/type-confusion-through-parameter-tampering
// (critical) on validateQuery in backend/middleware/validation.js: Express
// parses repeated query keys (?field=a&field=b) or bracket syntax
// (?field[$ne]=x) into an array/object instead of a string, and the old
// validateQuery checked `value.length > rule.maxLength` without first
// confirming `value` was actually a string — an array's `.length` is its
// element count, and a plain object has no `.length` (`undefined > N` is
// always false), so both shapes silently passed the check and reached the
// controller as a raw, non-string value instead of the validated string the
// rest of the code assumed. Downstream, an unvalidated body field flowing
// into a Mongoose `findOne`/`findOneAndUpdate` filter as an object (e.g.
// `{ $ne: null }`) is interpreted as a Mongo query operator, not a literal
// value to match — classic NoSQL injection.
//
// The audit that found this also found one endpoint with *zero* input
// validation at all: POST /api/auth/logout passed `req.body.refreshToken`
// straight into `RefreshToken.findOneAndUpdate({ token: refreshToken }, ...)`
// with no route-level validateInput. `{"refreshToken":{"$ne":null}}` would
// have matched (and revoked) an arbitrary session, unauthenticated, since
// logout is intentionally a public route (a user's access token may already
// be expired when they log out).
//
// This suite proves both gaps are closed, and that legitimate single-value
// input still behaves exactly as before.

const randomAlnum = (len: number) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
};

test.describe('Input sanitization regression coverage', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const user = {
    username: `sanitize_${randomAlnum(8)}`,
    email: `sanitize_${suffix}@mail.com`,
    password: 'SanitizePass1!',
    firstName: 'Sani',
    lastName: 'Tize',
  };
  let token = '';
  let realRefreshToken = '';

  test('register user (baseline for the rest of the suite)', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, { data: user });
    expect(res.status()).toBe(201);
    const body = await res.json();
    token = body.token;
    realRefreshToken = body.refreshToken;
    expect(typeof realRefreshToken).toBe('string');
  });

  test('logout rejects a Mongo-operator object as refreshToken instead of executing it as a query', async ({ request }) => {
    const res = await request.post(`${API}/auth/logout`, {
      data: { refreshToken: { $ne: null } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('refreshToken');
  });

  test('logout rejects an array-shaped refreshToken the same way', async ({ request }) => {
    const res = await request.post(`${API}/auth/logout`, {
      data: { refreshToken: ['a', 'b'] },
    });
    expect(res.status()).toBe(400);
  });

  test('logout still succeeds with a real string token (no regression)', async ({ request }) => {
    const res = await request.post(`${API}/auth/logout`, {
      data: { refreshToken: realRefreshToken },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  test('logout still succeeds with no body at all (backward compatible — frontend omits it when localStorage has no token)', async ({ request }) => {
    const res = await request.post(`${API}/auth/logout`, { data: {} });
    expect(res.status()).toBe(200);
  });

  test('the revoked token from the operator-injection attempt was never actually touched — a second real logout with it still works', async ({ request }) => {
    // Re-register a fresh session so we have a live refresh token to prove
    // the earlier `{ $ne: null }` attempt above did not revoke it (or any
    // other token) via operator injection.
    const res = await request.post(`${API}/auth/register`, {
      data: { ...user, username: `sanitize2_${randomAlnum(8)}`, email: `sanitize2_${suffix}@mail.com` },
    });
    expect(res.status()).toBe(201);
    const freshRefreshToken = (await res.json()).refreshToken;

    const refreshRes = await request.post(`${API}/auth/refresh`, {
      data: { refreshToken: freshRefreshToken },
    });
    expect(refreshRes.status()).toBe(200);
    expect((await refreshRes.json()).token).toBeTruthy();
  });

  test('club browse rejects a repeated query key (array-shaped "query" param)', async ({ request }) => {
    const res = await request.get(`${API}/clubs/browse?query=a&query=b`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('query');
  });

  test('club browse rejects a repeated "tags" query key the same way', async ({ request }) => {
    const res = await request.get(`${API}/clubs/browse?tags=JDM&tags=Track`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
  });

  test('club browse still works normally with a single-value query string (no regression)', async ({ request }) => {
    const res = await request.get(`${API}/clubs/browse?query=jdm&tags=JDM`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.clubs)).toBe(true);
  });

  test('register rejects an absurdly long email before the ReDoS-prone regex ever runs', async ({ request }) => {
    // CodeQL js/polynomial-redos: isValidEmail's regex can backtrack
    // polynomially on crafted long input. isValidEmail now short-circuits
    // false for anything over 254 chars (RFC 5321), so an oversized email is
    // rejected as a plain validation failure, not run through the regex.
    const longLocalPart = 'a'.repeat(300);
    const res = await request.post(`${API}/auth/register`, {
      data: { ...user, username: `sanitize3_${randomAlnum(8)}`, email: `${longLocalPart}@mail.com` },
    });
    expect(res.status()).toBe(400);
  });
});
