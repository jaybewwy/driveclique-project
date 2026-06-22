import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

function randomString(len: number) {
  return Math.random().toString(36).substring(2, 2 + len);
}

test('verify redesigned ProfileView settings layout', async ({ page }) => {
  const suffix = randomString(6);
  const username = `verifyuser${suffix}`;
  const email = `verifyuser${suffix}@mail.com`;
  const password = 'Password123!';

  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(`${BASE}/register`);
  await page.getByPlaceholder('First').fill('Verify');
  await page.getByPlaceholder('Last').fill('Tester');
  await page.getByPlaceholder('username').fill(username);
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password (min. 8 chars)').fill(password);
  await page.getByRole('button', { name: /Create Account/i }).click();

  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15000 });

  await page.goto(`${BASE}/settings`);
  await page.getByText('Profile', { exact: true }).first().click();
  await expect(page.getByLabel('Username')).toHaveValue(username, { timeout: 10000 });

  // Desktop screenshot
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/e2e/screenshots/verify-profile-redesign-desktop.png', fullPage: true });

  // Narrower viewport screenshot
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/e2e/screenshots/verify-profile-redesign-narrow.png', fullPage: true });

  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
});
