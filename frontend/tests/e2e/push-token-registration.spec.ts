import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-34 — Mobile Push Notifications (Token Registration) ────────────────
// API-level tests only: this is the mobile (Expo) app's backend contract —
// there is no web UI to exercise (registration/deregistration happens
// automatically on login/logout inside the mobile app, not through any web
// page). Covers registering/refreshing a token, upsert-by-value (not
// duplicate), multiple devices, unregistering, input validation, and that
// the push token array never leaks through the public-profile endpoint.

test.describe('Push token registration (UC-34)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const user = { username: `pushuser_${suffix}`, email: `pushuser_${suffix}@mail.com`, password: 'PushPass1!' };
  let token = '';
  let userId = '';
  const firstExpoToken = `ExponentPushToken[test-${suffix}-a]`;
  const secondExpoToken = `ExponentPushToken[test-${suffix}-b]`;

  test('register user', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, { data: user });
    expect(res.status()).toBe(201);
    const body = await res.json();
    token = body.token;
    userId = body.user._id;
  });

  test('registers a push token', async ({ request }) => {
    const res = await request.post(`${API}/auth/push-token`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { expoPushToken: firstExpoToken, platform: 'android' },
    });
    expect(res.status()).toBe(200);

    const profileRes = await request.get(`${API}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
    const { user: profile } = await profileRes.json();
    expect(profile.pushTokens).toHaveLength(1);
    expect(profile.pushTokens[0].token).toBe(firstExpoToken);
    expect(profile.pushTokens[0].platform).toBe('android');
  });

  test('re-registering the same token upserts rather than duplicating', async ({ request }) => {
    const res = await request.post(`${API}/auth/push-token`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { expoPushToken: firstExpoToken, platform: 'android' },
    });
    expect(res.status()).toBe(200);

    const profileRes = await request.get(`${API}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
    const { user: profile } = await profileRes.json();
    expect(profile.pushTokens).toHaveLength(1);
  });

  test('a second device registers its own token — both are kept', async ({ request }) => {
    const res = await request.post(`${API}/auth/push-token`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { expoPushToken: secondExpoToken, platform: 'ios' },
    });
    expect(res.status()).toBe(200);

    const profileRes = await request.get(`${API}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
    const { user: profile } = await profileRes.json();
    expect(profile.pushTokens).toHaveLength(2);
  });

  test('unregisters one token, leaving the other', async ({ request }) => {
    const res = await request.delete(`${API}/auth/push-token`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { expoPushToken: firstExpoToken },
    });
    expect(res.status()).toBe(200);

    const profileRes = await request.get(`${API}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
    const { user: profile } = await profileRes.json();
    expect(profile.pushTokens).toHaveLength(1);
    expect(profile.pushTokens[0].token).toBe(secondExpoToken);
  });

  test('unregistering an already-absent token is a no-op, not an error', async ({ request }) => {
    const res = await request.delete(`${API}/auth/push-token`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { expoPushToken: firstExpoToken },
    });
    expect(res.status()).toBe(200);
  });

  test('rejects a missing token on register', async ({ request }) => {
    const res = await request.post(`${API}/auth/push-token`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('rejects an invalid platform value', async ({ request }) => {
    const res = await request.post(`${API}/auth/push-token`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { expoPushToken: `ExponentPushToken[test-${suffix}-c]`, platform: 'windows-phone' },
    });
    expect(res.status()).toBe(400);
  });

  test('requires authentication on both routes', async ({ request }) => {
    const postRes = await request.post(`${API}/auth/push-token`, { data: { expoPushToken: firstExpoToken } });
    expect(postRes.status()).toBe(401);
    const deleteRes = await request.delete(`${API}/auth/push-token`, { data: { expoPushToken: firstExpoToken } });
    expect(deleteRes.status()).toBe(401);
  });

  test('pushTokens never appears on the public profile endpoint', async ({ request }) => {
    const res = await request.get(`${API}/auth/users/${userId}/public`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const { profile } = await res.json();
    expect(profile.pushTokens).toBeUndefined();
  });
});
