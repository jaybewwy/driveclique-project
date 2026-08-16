import { test, expect } from '@playwright/test';

// ─── THROWAWAY SCRIPT — screenshot capture for the new "Top Denied Endpoints"
// admin analytics section (AUTHZ_DENIED events). Not part of the regular
// suite. Companion to admin-analytics-screenshots.spec.ts, which only covers
// the default-denied path — like that file, exercising the allowed path here
// requires manually adding this account's email to backend/.env's
// ADMIN_EMAILS and restarting the backend first.

const FRONTEND = 'http://localhost:5173';

test('capture admin analytics with top denied endpoints', async ({ page }) => {
  await page.goto(`${FRONTEND}/login`);
  await page.getByPlaceholder('Username').fill('admincheck1783968942');
  await page.getByPlaceholder('Password').fill('AdminPass1!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

  await page.goto(`${FRONTEND}/admin/analytics`);
  await expect(page.getByText('Top Denied Endpoints', { exact: false })).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/admin-analytics-authz-denied.png', fullPage: true });
});
