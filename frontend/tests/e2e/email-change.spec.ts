import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-28 — Email Address Change Flow ──────────────────────────────────────
// API-level tests: requesting a change (validation, business rules, auth),
// and everything about the confirm endpoint that's reachable without a real
// emailed token (missing/invalid token, public access). The actual
// token-consumption success path (pendingEmail -> user.email swap) isn't
// practically Playwright-testable here — SMTP isn't configured in this dev
// environment, so there's no way to intercept the real emailed token — and
// was instead verified via a one-off throwaway script that wrote a known
// token hash directly via the User model, matching this project's existing
// approach for resetPassword's session-revocation check (see activeContext.md,
// 2026-08-15 session).

test.describe('Email address change (UC-28)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const user = { username: `emailchange_${suffix}`, email: `emailchange_${suffix}@mail.com`, password: 'EmailPass1!' };
  const otherUser = { username: `emailchangeother_${suffix}`, email: `emailchangeother_${suffix}@mail.com`, password: 'EmailPass1!' };
  const newEmail = `emailchangenew_${suffix}@mail.com`;
  let token = '';
  let userId = '';

  test('register both users', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, { data: user });
    expect(res.status()).toBe(201);
    const body = await res.json();
    token = body.token;
    userId = body.user._id;

    const otherRes = await request.post(`${API}/auth/register`, { data: otherUser });
    expect(otherRes.status()).toBe(201);
  });

  test('requesting a change to the current email is rejected', async ({ request }) => {
    const res = await request.post(`${API}/auth/email-change`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { newEmail: user.email },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/already your current email/i);
  });

  test('requesting a change to an email already registered to another account is rejected', async ({ request }) => {
    const res = await request.post(`${API}/auth/email-change`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { newEmail: otherUser.email },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/already registered/i);
  });

  test('rejects an invalid email format', async ({ request }) => {
    const res = await request.post(`${API}/auth/email-change`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { newEmail: 'not-an-email' },
    });
    expect(res.status()).toBe(400);
  });

  test('requesting a change to a valid, available new email succeeds', async ({ request }) => {
    const res = await request.post(`${API}/auth/email-change`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { newEmail },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.message).toContain(newEmail);
  });

  test('the account email is unchanged until the confirmation link is clicked', async ({ request }) => {
    const res = await request.get(`${API}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
    const { user: profile } = await res.json();
    expect(profile.email).toBe(user.email);
  });

  test('requesting an email change requires authentication', async ({ request }) => {
    const res = await request.post(`${API}/auth/email-change`, { data: { newEmail } });
    expect(res.status()).toBe(401);
  });

  test('confirm rejects a missing token', async ({ request }) => {
    const res = await request.get(`${API}/auth/email-change/confirm`);
    expect(res.status()).toBe(400);
  });

  test('confirm rejects an invalid token without requiring authentication (public route)', async ({ request }) => {
    const res = await request.get(`${API}/auth/email-change/confirm`, {
      params: { token: 'a'.repeat(80) },
    });
    // Not 401 — the route is public and the token itself proves identity, same as verifyEmail/resetPassword
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/invalid or has expired/i);
  });

  test('pendingEmail and emailChangeToken never appear on the public profile endpoint', async ({ request }) => {
    const res = await request.get(`${API}/auth/users/${userId}/public`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const { profile } = await res.json();
    expect(profile.pendingEmail).toBeUndefined();
    expect(profile.emailChangeToken).toBeUndefined();
  });
});
