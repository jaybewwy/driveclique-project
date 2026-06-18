import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:5000/api';

// ─── Suite 1: UI — Password strength indicator (UC-29) ──────────────────────

test.describe('Register — Password strength indicator', () => {

  test('strength bar is hidden until the password field has input', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await expect(page.getByText(/At least 8 characters/i)).not.toBeVisible();
  });

  test('shows "Weak" for a short password', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await page.locator('input[name="password"]').fill('abc');
    await expect(page.getByText(/Weak —/i)).toBeVisible();
  });

  test('shows "Fair" for a 6-9 char password with no complexity', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await page.locator('input[name="password"]').fill('abcdefg');
    await expect(page.getByText(/Fair —/i)).toBeVisible();
  });

  test('shows "Good" for a password meeting length + complexity', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await page.locator('input[name="password"]').fill('abcdefg1');
    await expect(page.getByText(/Good —/i)).toBeVisible();
  });

  test('shows "Strong" for a long mixed-case + complex password', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await page.locator('input[name="password"]').fill('Abcdefghij1!');
    await expect(page.getByText(/Strong —/i)).toBeVisible();
  });

  test('password field enforces 8-char minimum via HTML attribute', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await expect(page.locator('input[name="password"]')).toHaveAttribute('minlength', '8');
  });
});

// ─── Suite 2: API — Password reuse prevention (last 5) ──────────────────────

test.describe('Password change — reuse prevention', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const user = {
    username: `pwpolicy_${suffix}`,
    email: `pwpolicy_${suffix}@mail.com`,
    password: 'OriginalPass1!',
  };
  let token = '';

  test('register rejects a password shorter than 8 characters', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, {
      data: { username: `shortpw_${suffix}`, email: `shortpw_${suffix}@mail.com`, password: 'short1' },
    });
    expect(res.status()).toBe(400);
  });

  test('register succeeds with an 8+ char password and returns a token', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, { data: user });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    token = body.token;
    expect(token).toBeTruthy();
  });

  test('change password succeeds with a brand-new password', async ({ request }) => {
    const res = await request.put(`${API}/auth/password`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { currentPassword: user.password, newPassword: 'SecondPass2!' },
    });
    expect(res.status()).toBe(200);
  });

  test('changing back to the immediately-previous password is rejected', async ({ request }) => {
    const res = await request.put(`${API}/auth/password`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { currentPassword: 'SecondPass2!', newPassword: user.password },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/last 5 passwords/i);
  });

  test('changing to a never-used password succeeds', async ({ request }) => {
    const res = await request.put(`${API}/auth/password`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { currentPassword: 'SecondPass2!', newPassword: 'ThirdPass3!' },
    });
    expect(res.status()).toBe(200);
  });

  test('reusing the original registration password is still rejected after a second change', async ({ request }) => {
    const res = await request.put(`${API}/auth/password`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { currentPassword: 'ThirdPass3!', newPassword: user.password },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/last 5 passwords/i);
  });
});
