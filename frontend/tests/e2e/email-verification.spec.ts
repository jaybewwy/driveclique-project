import { test, expect } from '@playwright/test';
import crypto from 'crypto';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:5000/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerUser(page: any, suffix = Date.now()) {
  const user = {
    username: `evtest_${suffix}`,
    email:    `evtest_${suffix}@mail.com`,
    password: 'TestPass123!',
  };
  await page.goto(`${BASE}/register`);
  await page.getByPlaceholder('First').fill('Test');
  await page.getByPlaceholder('Last').fill('User');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Email address').fill(user.email);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 30000 });
  return user;
}

// ─── Suite 1: Registration response ──────────────────────────────────────────
//
// authController.js's registerUser currently hardcodes emailVerified: true at
// registration ("skipped for now; a different strategy will be used later").
// These assertions match that deliberate current behavior, not the original
// UC-02 spec of new accounts starting unverified — revisit if that decision changes.

test.describe('Email verification — registration state', () => {

  test('New user has emailVerified: true in registration response', async ({ request }) => {
    const suffix = Date.now();
    const res = await request.post(`${API}/auth/register`, {
      data: {
        username: `evapi_${suffix}`,
        email: `evapi_${suffix}@mail.com`,
        password: 'TestPass123!',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.emailVerified).toBe(true);
  });

  test('New user has emailVerified: true in login response', async ({ request }) => {
    const suffix = Date.now();
    // Register first
    await request.post(`${API}/auth/register`, {
      data: {
        username: `evlogin_${suffix}`,
        email: `evlogin_${suffix}@mail.com`,
        password: 'TestPass123!',
      },
    });
    // Login
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { username: `evlogin_${suffix}`, password: 'TestPass123!' },
    });
    const body = await loginRes.json();
    expect(body.user.emailVerified).toBe(true);
  });
});

// ─── Suite 2: Dashboard banner UI ────────────────────────────────────────────

test.describe('Email verification — dashboard banner', () => {

  test('Banner is visible when emailVerified is false', async ({ page }) => {
    // Mock clubs to avoid 401 cascade and set user state with emailVerified: false
    await page.route('**/api/clubs**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, clubs: [] }) })
    );
    await page.route('**/api/clubs/trending', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, club: null }) })
    );
    // UC-26's onboarding checklist fetches this unconditionally on Dashboard mount;
    // left unmocked, the fake token 401s and the api.js interceptor redirects to /login.
    await page.route('**/api/drives/my-rsvps', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, rsvps: [] }) })
    );
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('driveclique_user', JSON.stringify({
        _id: '1', username: 'testuser', role: 'user', useDisplayName: false, emailVerified: false
      }));
    });
    await page.goto(`${BASE}/dashboard`);
    await expect(page.getByText(/Please verify your email/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /Resend email/i })).toBeVisible();
  });

  test('Banner is NOT visible when emailVerified is true', async ({ page }) => {
    await page.route('**/api/clubs**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, clubs: [] }) })
    );
    await page.route('**/api/clubs/trending', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, club: null }) })
    );
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('driveclique_user', JSON.stringify({
        _id: '1', username: 'testuser', role: 'user', useDisplayName: false, emailVerified: true
      }));
    });
    await page.goto(`${BASE}/dashboard`);
    // Give page time to settle, then confirm banner is absent
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Please verify your email/i)).not.toBeVisible();
  });

  test('"Resend email" button shows "Sent!" feedback when API succeeds', async ({ page }) => {
    await page.route('**/api/clubs**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, clubs: [] }) })
    );
    await page.route('**/api/clubs/trending', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, club: null }) })
    );
    await page.route('**/api/auth/resend-verification', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Verification email sent!' }) })
    );
    // Same unmocked-401-redirect hazard as the test above.
    await page.route('**/api/drives/my-rsvps', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, rsvps: [] }) })
    );
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('driveclique_user', JSON.stringify({
        _id: '1', username: 'testuser', role: 'user', useDisplayName: false, emailVerified: false
      }));
    });
    await page.goto(`${BASE}/dashboard`);
    await page.getByRole('button', { name: /Resend email/i }).click();
    await expect(page.getByText(/Sent!/i)).toBeVisible({ timeout: 5000 });
  });
});

// ─── Suite 3: /verify-email page UI ──────────────────────────────────────────

test.describe('Email verification — /verify-email page', () => {

  test('/verify-email with no token shows error state', async ({ page }) => {
    await page.goto(`${BASE}/verify-email`);
    await expect(page.getByText(/Verification failed/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/invalid or missing/i)).toBeVisible();
  });

  test('/verify-email shows "Verifying…" spinner on load with token', async ({ page }) => {
    // Delay the API response to catch the loading state
    await page.route('**/api/auth/verify-email**', async route => {
      await new Promise(r => setTimeout(r, 600));
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Invalid token' }) });
    });
    await page.goto(`${BASE}/verify-email?token=${'a'.repeat(80)}`);
    await expect(page.getByText(/Verifying your email/i)).toBeVisible({ timeout: 3000 });
  });

  test('/verify-email with expired/invalid token shows error card', async ({ page }) => {
    await page.goto(`${BASE}/verify-email?token=${'a'.repeat(80)}`);
    await expect(page.getByText(/Verification failed/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });

  test('/verify-email success card shown when API returns 200', async ({ page }) => {
    await page.route('**/api/auth/verify-email**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Email verified successfully!' }) })
    );
    await page.goto(`${BASE}/verify-email?token=${'b'.repeat(80)}`);
    await expect(page.getByText(/Email verified!/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('/verify-email success shows "Go to Dashboard" when logged in', async ({ page }) => {
    await page.route('**/api/auth/verify-email**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    await page.route('**/api/auth/profile**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user: { _id: '1', username: 'u', emailVerified: true } }) })
    );
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('driveclique_user', JSON.stringify({ _id: '1', username: 'u', emailVerified: false }));
    });
    await page.goto(`${BASE}/verify-email?token=${'c'.repeat(80)}`);
    await expect(page.getByText(/Email verified!/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /Go to Dashboard/i })).toBeVisible();
  });

  test('/verify-email is accessible without authentication', async ({ page }) => {
    // No localStorage set — unauthenticated visit
    await page.route('**/api/auth/verify-email**', route =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Invalid' }) })
    );
    await page.goto(`${BASE}/verify-email?token=${'d'.repeat(80)}`);
    // Should show error page, NOT be redirected to /login
    await expect(page).not.toHaveURL(`${BASE}/login`);
    await expect(page.getByText(/Verification failed/i)).toBeVisible({ timeout: 8000 });
  });
});

// ─── Suite 4: API security — serial to avoid rate-limit interference ──────────

test.describe('Email verification — API security', () => {
  test.describe.configure({ mode: 'serial' });

  test('GET /auth/verify-email rejects missing token (400)', async ({ request }) => {
    const res = await request.get(`${API}/auth/verify-email`);
    expect(res.status()).toBe(400);
  });

  test('GET /auth/verify-email rejects token shorter than 80 chars (400)', async ({ request }) => {
    const res = await request.get(`${API}/auth/verify-email?token=short`);
    expect(res.status()).toBe(400);
  });

  test('GET /auth/verify-email rejects token longer than 80 chars (400)', async ({ request }) => {
    const res = await request.get(`${API}/auth/verify-email?token=${'a'.repeat(81)}`);
    expect(res.status()).toBe(400);
  });

  test('GET /auth/verify-email rejects valid-length but non-existent token (400)', async ({ request }) => {
    const res = await request.get(`${API}/auth/verify-email?token=${'a'.repeat(80)}`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/invalid or has expired/i);
  });

  test('POST /auth/resend-verification rejects unauthenticated request (401)', async ({ request }) => {
    const res = await request.post(`${API}/auth/resend-verification`);
    expect(res.status()).toBe(401);
  });

  test('POST /auth/resend-verification returns 200 for authenticated unverified user', async ({ request }) => {
    // Register a fresh user to get a valid token
    const suffix = Date.now();
    const regRes = await request.post(`${API}/auth/register`, {
      data: { username: `rsnd_${suffix}`, email: `rsnd_${suffix}@mail.com`, password: 'TestPass123!' },
    });
    const { token } = (await regRes.json());
    const res = await request.post(`${API}/auth/resend-verification`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('Brute-force: 10 verify attempts with random tokens all return 400', async ({ request }) => {
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const token = crypto.randomBytes(40).toString('hex'); // 80 hex chars
      const res = await request.get(`${API}/auth/verify-email?token=${token}`);
      results.push(res.status());
    }
    expect(results.every(s => s === 400)).toBe(true);
  });
});

// ─── Suite 5: Full verification flow ─────────────────────────────────────────

test.describe('Email verification — full flow', () => {

  test('Register → emailVerified true → resend is a no-op → profile still shows emailVerified true', async ({ request }) => {
    const suffix = Date.now();
    // Step 1: Register — emailVerified is true immediately (see Suite 1's note)
    const regRes = await request.post(`${API}/auth/register`, {
      data: { username: `fullev_${suffix}`, email: `fullev_${suffix}@mail.com`, password: 'TestPass123!' },
    });
    expect(regRes.status()).toBe(201);
    const { user: regUser, token } = await regRes.json();
    expect(regUser.emailVerified).toBe(true);

    // Step 2: Profile endpoint includes emailVerified
    const profileRes = await request.get(`${API}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { user: profileUser } = await profileRes.json();
    expect(profileUser.emailVerified).toBe(true);

    // Step 3: Resend short-circuits with "already verified" but still returns 200
    const resendRes = await request.post(`${API}/auth/resend-verification`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resendRes.status()).toBe(200);

    // Step 4: Wrong verify token is correctly rejected (no token exists to match)
    const badVerify = await request.get(`${API}/auth/verify-email?token=${'f'.repeat(80)}`);
    expect(badVerify.status()).toBe(400);

    // Step 5: emailVerified remains true after the failed verify attempt
    const profileRes2 = await request.get(`${API}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { user: profileUser2 } = await profileRes2.json();
    expect(profileUser2.emailVerified).toBe(true);
  });
});
