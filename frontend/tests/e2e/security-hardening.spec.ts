import { test, expect } from '@playwright/test';
import crypto from 'crypto';

// Regression coverage for the 2026-08-15 security-hardening pass (invite-code
// PII/brute-force exposure, refresh-token plaintext storage, sessions
// surviving a password change, and the previously-missing rate limiting on
// clubs/drives/notifications/reports). Serial — later tests build on state
// (tokens, club) created by earlier ones.

const API = 'http://localhost:5000/api';
const suffix = crypto.randomInt(1_000_000, 9_999_999);
const randomAlnum = (len: number) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
};

const leader = {
  username: `sechardleader_${randomAlnum(6)}`,
  email: `sechardleader_${suffix}@mail.com`,
  password: 'SecurePass123!',
  firstName: 'Sec', lastName: 'Leader', location: 'Toronto, Ontario, Canada',
};
const outsider = {
  username: `sechardoutsider_${randomAlnum(6)}`,
  email: `sechardoutsider_${suffix}@mail.com`,
  password: 'SecurePass123!',
  firstName: 'Sec', lastName: 'Outsider', location: 'Toronto, Ontario, Canada',
};

test.describe.configure({ mode: 'serial' });

let leaderToken: string;
let leaderRefreshToken: string;
let outsiderToken: string;
let inviteCode: string;

test.beforeAll(async ({ request }) => {
  const leaderRes = await request.post(`${API}/auth/register`, { data: leader });
  expect(leaderRes.status()).toBe(201);
  const leaderBody = await leaderRes.json();
  leaderToken = leaderBody.token;
  leaderRefreshToken = leaderBody.refreshToken;

  const outsiderRes = await request.post(`${API}/auth/register`, { data: outsider });
  expect(outsiderRes.status()).toBe(201);
  outsiderToken = (await outsiderRes.json()).token;

  const clubRes = await request.post(`${API}/clubs`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
    data: {
      name: `SecHard Private Club ${suffix}`,
      description: 'Private club used to verify invite-code hardening.',
      isPrivate: true,
    },
  });
  expect(clubRes.status()).toBe(201);
  inviteCode = (await clubRes.json()).club.inviteCode;
  expect(typeof inviteCode).toBe('string');
});

test('invite-code lookup no longer returns leader/member email addresses', async ({ request }) => {
  const res = await request.get(`${API}/clubs/invite/${inviteCode}`, {
    headers: { Authorization: `Bearer ${outsiderToken}` },
  });
  expect(res.status()).toBe(200);
  const { club } = await res.json();

  expect(club.leader.email).toBeUndefined();
  expect(club.leader.username).toBeTruthy();
  for (const member of club.members) {
    expect(member.email).toBeUndefined();
  }
});

test('invite-code routes carry a strict rate limiter (not the general one)', async ({ request }) => {
  const res = await request.get(`${API}/clubs/invite/000000`, {
    headers: { Authorization: `Bearer ${outsiderToken}` },
  });
  // Nonexistent code -> 404, but the limiter runs before the lookup either way.
  expect(res.status()).toBe(404);
  const limit = res.headers()['ratelimit-limit'];
  expect(limit).toBeTruthy();
  // Dev-mode strict limiter cap (see backend/middleware/rateLimiters.js) —
  // must be far below the general apiLimiter's dev cap, proving the tighter
  // limiter (not the general one) is the one actually attached here.
  expect(Number(limit)).toBeLessThanOrEqual(500);
});

test('general authenticated routers (clubs/drives/notifications/reports) now carry rate-limit headers', async ({ request }) => {
  const targets = [
    { method: 'get', url: `${API}/clubs` },
    { method: 'get', url: `${API}/drives/dashboard` },
    { method: 'get', url: `${API}/notifications` },
  ];
  for (const t of targets) {
    const res = await request[t.method as 'get'](t.url, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(res.headers()['ratelimit-limit'], `${t.url} should carry a rate-limit header`).toBeTruthy();
  }

  // POST /api/reports has no safe no-op GET; use a deliberately-invalid body
  // (400 from validateInput) — the limiter runs before validation either way.
  const reportRes = await request.post(`${API}/reports`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
    data: {},
  });
  expect(reportRes.status()).toBe(400);
  expect(reportRes.headers()['ratelimit-limit']).toBeTruthy();
});

test('changing password revokes the refresh token issued before the change', async ({ request }) => {
  const changeRes = await request.put(`${API}/auth/password`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
    data: { currentPassword: leader.password, newPassword: 'AnotherSecurePass456!' },
  });
  expect(changeRes.status()).toBe(200);

  // The refresh token captured at registration, before this password change,
  // must no longer work — proving the change revoked outstanding sessions
  // rather than leaving a stolen/old token valid for its full 7-day life.
  const refreshRes = await request.post(`${API}/auth/refresh`, {
    data: { refreshToken: leaderRefreshToken },
  });
  expect(refreshRes.status()).toBe(401);
});

test('a fresh login after the password change gets a working new refresh token', async ({ request }) => {
  const loginRes = await request.post(`${API}/auth/login`, {
    data: { username: leader.username, password: 'AnotherSecurePass456!' },
  });
  expect(loginRes.status()).toBe(200);
  const { refreshToken } = await loginRes.json();
  expect(typeof refreshToken).toBe('string');

  const refreshRes = await request.post(`${API}/auth/refresh`, { data: { refreshToken } });
  expect(refreshRes.status()).toBe(200);
  expect((await refreshRes.json()).token).toBeTruthy();
});

test('a normal authenticated request still succeeds (JWT algorithm pinning has no false-positive rejections)', async ({ request }) => {
  const res = await request.get(`${API}/auth/profile`, {
    headers: { Authorization: `Bearer ${outsiderToken}` },
  });
  expect(res.status()).toBe(200);
});
