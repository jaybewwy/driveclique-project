import { test, expect } from '@playwright/test';

// ─── THROWAWAY SCRIPT — UC-41 admin analytics dashboard screenshot capture ───
// Not part of the regular suite. Safe to delete after screenshots are captured.
//
// Only verifies the default-denied path, which works out of the box (ADMIN_EMAILS
// unset). Verifying the allowed path requires manually adding a test account's
// email to backend/.env's ADMIN_EMAILS and restarting the backend, so it isn't
// automated here — see admin-analytics-allowed.png (captured manually) for that state.

const BASE = 'http://localhost:5173';

test('non-admin user sees the access-denied state on /admin/analytics', async ({ page }) => {
  await page.goto(`${BASE}/register`);
  const suffix = Date.now();
  await page.getByPlaceholder('First').fill('Non');
  await page.getByPlaceholder('Last').fill('Admin');
  await page.getByPlaceholder('Username').fill(`nonadmin_${suffix}`);
  await page.getByPlaceholder('Password').fill('NonAdminPass1!');
  await page.getByPlaceholder('Email address').fill(`nonadmin_${suffix}@mail.com`);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15000 });

  await page.goto(`${BASE}/admin/analytics`);
  await expect(page.getByText(/You don't have access to this page/i)).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/admin-analytics-denied.png' });
});
