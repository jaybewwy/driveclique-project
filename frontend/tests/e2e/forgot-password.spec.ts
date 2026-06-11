import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:5000/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerUser(page: any, suffix = Date.now()) {
  const user = {
    username: `fptest_${suffix}`,
    email:    `fptest_${suffix}@example.com`,
    password: 'TestPass123!',
  };
  await page.goto(`${BASE}/register`);
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Email address').fill(user.email);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 30000 });
  return user;
}

// ─── Suite 1: UI flow ────────────────────────────────────────────────────────

test.describe('Forgot Password — UI flow', () => {

  test('Login page has "Forgot password?" link', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole('button', { name: /Forgot password\?/i })).toBeVisible();
  });

  test('"Forgot password?" link navigates to /forgot-password', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Forgot password\?/i }).click();
    await expect(page).toHaveURL(`${BASE}/forgot-password`);
  });

  test('/forgot-password renders form with email input and submit button', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);
    await expect(page.getByPlaceholder('Email address')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Send Reset Link/i })).toBeVisible();
  });

  test('Submitting empty email shows browser validation (required)', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);
    await page.getByRole('button', { name: /Send Reset Link/i }).click();
    // HTML5 required prevents submission — URL should not change
    await expect(page).toHaveURL(`${BASE}/forgot-password`);
  });

  test('Submitting invalid email format shows browser validation', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);
    await page.getByPlaceholder('Email address').fill('notanemail');
    await page.getByRole('button', { name: /Send Reset Link/i }).click();
    await expect(page).toHaveURL(`${BASE}/forgot-password`);
  });

  test('Submitting email shows generic success confirmation card', async ({ page }) => {
    // Mock the API so this UI test is independent of rate limits
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'If that email is registered, a reset link has been sent.' }) })
    );
    await page.goto(`${BASE}/forgot-password`);
    await page.getByPlaceholder('Email address').fill('nobody_ui_test@nowhere.com');
    await page.getByRole('button', { name: /Send Reset Link/i }).click();
    await expect(page.getByText(/Check your email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/reset link/i)).toBeVisible();
  });

  test('Success card does not reveal whether the email account exists', async ({ page }) => {
    // Mock the API — this test only verifies UI text, not API behaviour
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'If that email is registered, a reset link has been sent.' }) })
    );
    await page.goto(`${BASE}/forgot-password`);
    await page.getByPlaceholder('Email address').fill('known_user@example.com');
    await page.getByRole('button', { name: /Send Reset Link/i }).click();
    await expect(page.getByText(/Check your email/i)).toBeVisible({ timeout: 10000 });

    // Success message must NOT reveal whether the account exists
    await expect(page.getByText(/does not exist/i)).not.toBeVisible();
    await expect(page.getByText(/not registered/i)).not.toBeVisible();
    await expect(page.getByText(/no account/i)).not.toBeVisible();
  });

  test('Confirmation card has "Back to Sign In" link pointing to /login', async ({ page }) => {
    // Mock the API — this test only verifies the navigation button on the confirmation card
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'If that email is registered, a reset link has been sent.' }) })
    );
    await page.goto(`${BASE}/forgot-password`);
    await page.getByPlaceholder('Email address').fill('backlink_test@example.com');
    await page.getByRole('button', { name: /Send Reset Link/i }).click();
    await expect(page.getByText(/Check your email/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Back to Sign In/i }).click();
    await expect(page).toHaveURL(`${BASE}/login`);
  });

  test('Authenticated user visiting /forgot-password is redirected to /dashboard', async ({ page }) => {
    // Mock clubs endpoint so the fake token does not cause a 401 redirect away from /dashboard
    await page.route('**/api/clubs**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, clubs: [] }) })
    );
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('driveclique_user', JSON.stringify({ _id: '1', username: 'authtest', role: 'user', useDisplayName: false }));
    });
    await page.goto(`${BASE}/forgot-password`);
    await expect(page).toHaveURL(`${BASE}/dashboard`);
  });
});

// ─── Suite 2: Reset Password UI ─────────────────────────────────────────────

test.describe('Reset Password — UI flow', () => {

  test('/reset-password with no token shows invalid-link error', async ({ page }) => {
    await page.goto(`${BASE}/reset-password`);
    await expect(page.getByText(/invalid or missing/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Request a new link/i })).toBeVisible();
  });

  test('"Request a new link" button navigates to /forgot-password', async ({ page }) => {
    await page.goto(`${BASE}/reset-password`);
    await page.getByRole('button', { name: /Request a new link/i }).click();
    await expect(page).toHaveURL(`${BASE}/forgot-password`);
  });

  test('/reset-password with garbage token shows the password form', async ({ page }) => {
    const fakeToken = 'a'.repeat(80);
    await page.goto(`${BASE}/reset-password?token=${fakeToken}`);
    await expect(page.getByPlaceholder('New password', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Confirm new password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Reset Password/i })).toBeVisible();
  });

  test('Client-side: passwords that do not match show error without API call', async ({ page }) => {
    const fakeToken = 'b'.repeat(80);
    await page.goto(`${BASE}/reset-password?token=${fakeToken}`);

    let apiCalled = false;
    page.on('request', req => {
      if (req.url().includes('/auth/reset-password')) apiCalled = true;
    });

    // Use exact: true to avoid strict-mode violation (both inputs contain "password")
    await page.getByPlaceholder('New password', { exact: true }).fill('password123');
    await page.getByPlaceholder('Confirm new password').fill('different456');
    await page.getByRole('button', { name: /Reset Password/i }).click();

    await expect(page.getByText(/Passwords do not match/i)).toBeVisible({ timeout: 5000 });
    expect(apiCalled).toBe(false);
  });

  test('Client-side: password shorter than 6 chars shows error without API call', async ({ page }) => {
    const fakeToken = 'c'.repeat(80);
    await page.goto(`${BASE}/reset-password?token=${fakeToken}`);

    let apiCalled = false;
    page.on('request', req => {
      if (req.url().includes('/auth/reset-password')) apiCalled = true;
    });

    await page.getByPlaceholder('New password', { exact: true }).fill('abc');
    await page.getByPlaceholder('Confirm new password').fill('abc');
    await page.getByRole('button', { name: /Reset Password/i }).click();

    await expect(page.getByText(/at least 6 characters/i)).toBeVisible({ timeout: 5000 });
    expect(apiCalled).toBe(false);
  });

  test('Submitting with an expired/invalid token shows an error message', async ({ page }) => {
    const fakeToken = 'd'.repeat(80);
    await page.goto(`${BASE}/reset-password?token=${fakeToken}`);
    await page.getByPlaceholder('New password', { exact: true }).fill('newpassword1');
    await page.getByPlaceholder('Confirm new password').fill('newpassword1');
    await page.getByRole('button', { name: /Reset Password/i }).click();
    await expect(page.getByText(/invalid or has expired|Reset failed/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(new RegExp('/reset-password'));
  });

  test('Authenticated user visiting /reset-password is redirected to /dashboard', async ({ page }) => {
    // Mock clubs endpoint so the fake token does not cause a 401 redirect away from /dashboard
    await page.route('**/api/clubs**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, clubs: [] }) })
    );
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('driveclique_user', JSON.stringify({ _id: '1', username: 'authtest', role: 'user', useDisplayName: false }));
    });
    await page.goto(`${BASE}/reset-password?token=${'e'.repeat(80)}`);
    await expect(page).toHaveURL(`${BASE}/dashboard`);
  });
});

// ─── Suite 3: API security — run serially to avoid rate-limit interference ──

test.describe('Forgot Password — API security & brute-force', () => {
  // Serial mode ensures rate-limit test doesn't starve other tests
  test.describe.configure({ mode: 'serial' });

  test('POST /auth/forgot-password rejects missing email', async ({ request }) => {
    const res = await request.post(`${API}/auth/forgot-password`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test('POST /auth/forgot-password rejects invalid email format', async ({ request }) => {
    const res = await request.post(`${API}/auth/forgot-password`, {
      data: { email: 'notanemail' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /auth/forgot-password returns 200 for unknown emails (anti-enumeration)', async ({ request }) => {
    const res = await request.post(`${API}/auth/forgot-password`, {
      data: { email: 'nobody_api_test@nonexistent.com' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/reset link has been sent/i);
  });

  test('POST /auth/reset-password rejects missing token', async ({ request }) => {
    const res = await request.post(`${API}/auth/reset-password`, {
      data: { password: 'newpassword1' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /auth/reset-password rejects token shorter than 80 chars', async ({ request }) => {
    const res = await request.post(`${API}/auth/reset-password`, {
      data: { token: 'short', password: 'newpassword1' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /auth/reset-password rejects token longer than 80 chars', async ({ request }) => {
    const res = await request.post(`${API}/auth/reset-password`, {
      data: { token: 'a'.repeat(81), password: 'newpassword1' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /auth/reset-password rejects password shorter than 6 chars', async ({ request }) => {
    const res = await request.post(`${API}/auth/reset-password`, {
      data: { token: 'a'.repeat(80), password: 'abc' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /auth/reset-password rejects a well-formed but non-existent token', async ({ request }) => {
    const res = await request.post(`${API}/auth/reset-password`, {
      data: { token: 'a'.repeat(80), password: 'validpassword1' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('Brute-force: 10 sequential reset attempts with random tokens all return 400', async ({ request }) => {
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const token = Array.from({ length: 80 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      const res = await request.post(`${API}/auth/reset-password`, {
        data: { token, password: 'hackpassword1' },
      });
      results.push(res.status());
    }
    expect(results.every(s => s === 400)).toBe(true);
  });

  // Rate-limit test runs LAST in this serial block.
  // Dev mode uses a higher limit (50) so tests don't interfere with each other.
  // This test verifies the limiter is wired up by checking response headers,
  // and triggers 429 if enough requests have been made this hour.
  test('Rate limiter: forgot-password endpoint is protected', async ({ request }) => {
    // Verify the rate-limit headers are present (proves the limiter is active)
    const probe = await request.post(`${API}/auth/forgot-password`, {
      data: { email: 'ratelimit_probe@example.com' },
    });
    const headers = probe.headers();
    const limitHeader = headers['ratelimit-limit'] || headers['x-ratelimit-limit'];
    expect(limitHeader).toBeTruthy();
    const maxAllowed = parseInt(limitHeader ?? '0', 10);
    expect(maxAllowed).toBeGreaterThan(0);

    // Fire enough requests to exhaust whatever the current limit is,
    // then confirm a 429 is returned with the correct body.
    const results: number[] = [];
    for (let i = 0; i < maxAllowed + 5; i++) {
      const res = await request.post(`${API}/auth/forgot-password`, {
        data: { email: `ratelimit_${i}@example.com` },
      });
      results.push(res.status());
      if (res.status() === 429) break;
    }

    expect(results).toContain(429);
    const body = await (await request.post(`${API}/auth/forgot-password`, {
      data: { email: 'ratelimit_verify@example.com' },
    })).json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/too many/i);
  });
});

// ─── Suite 4: Full reset flow ────────────────────────────────────────────────

test.describe('Full reset flow (DB-level token verification)', () => {

  test('Register → trigger reset → wrong token is rejected → old password still works', async ({ page, request }) => {
    const suffix = Date.now();
    const user = {
      username:    `fullflow_${suffix}`,
      email:       `fullflow_${suffix}@example.com`,
      password:    'OldPass123!',
      newPassword: 'NewPass456!',
    };

    // Step 1: Register
    await page.goto(`${BASE}/register`);
    await page.getByPlaceholder('Username').fill(user.username);
    await page.getByPlaceholder('Email address').fill(user.email);
    await page.getByPlaceholder('Password').fill(user.password);
    await page.getByRole('button', { name: /Create Account/i }).click();
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    // Step 2: Trigger forgot-password (writes hashed token to DB)
    const forgotRes = await request.post(`${API}/auth/forgot-password`, {
      data: { email: user.email },
    });
    // Accept 200 (success) or 429 (rate-limited in dev when rate-limit test ran first)
    expect([200, 429]).toContain(forgotRes.status());

    // Step 3: Wrong token is correctly rejected
    const badReset = await request.post(`${API}/auth/reset-password`, {
      data: { token: 'f'.repeat(80), password: user.newPassword },
    });
    expect(badReset.status()).toBe(400);

    // Step 4: Old password still works (reset didn't go through)
    await page.goto(`${BASE}/login`);
    try { await page.getByRole('button', { name: /Logout/i }).click(); } catch {}
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder('Username').fill(user.username);
    await page.getByPlaceholder('Password').fill(user.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });
    await expect(page).toHaveURL(`${BASE}/dashboard`);
  });
});
