import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

function randomString(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function registerUser(page: any, user: { username: string; email: string; password: string }) {
  await page.goto(`${baseUrl}/register`);
  await page.getByPlaceholder('First').fill('Test');
  await page.getByPlaceholder('Last').fill('User');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByPlaceholder('Email address').fill(user.email);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 15000 });
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15000 });
}

// Only fail on violations a real user would hit immediately (critical/serious).
// Moderate/minor are logged for visibility but don't fail the run — keeps the
// gate meaningful without requiring a full WCAG AA certification pass.
function expectNoSeriousViolations(results: { violations: any[] }, pageName: string) {
  const blocking = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
  if (blocking.length > 0) {
    const summary = blocking
      .map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
      .join('\n');
    throw new Error(`Accessibility violations on ${pageName}:\n${summary}`);
  }
}

test.describe('Accessibility (axe-core)', () => {
  test('login page has no critical/serious violations', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    const results = await new AxeBuilder({ page }).analyze();
    expectNoSeriousViolations(results, 'login');
  });

  test('register page has no critical/serious violations', async ({ page }) => {
    await page.goto(`${baseUrl}/register`);
    const results = await new AxeBuilder({ page }).analyze();
    expectNoSeriousViolations(results, 'register');
  });

  test('authenticated pages have no critical/serious violations', async ({ page }) => {
    const user = {
      username: `a11y_${randomString()}`,
      email: `a11y_${randomString()}@mail.com`,
      password: 'AccessibleP@ss1',
    };
    await registerUser(page, user);
    // Let the dashboard's 0.3s entrance fade-in finish — axe samples mid-animation
    // opacity otherwise, producing false-positive contrast failures.
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page }).analyze();
    expectNoSeriousViolations(results, 'dashboard');

    await page.goto(`${baseUrl}/find-club`);
    const findClubResults = await new AxeBuilder({ page }).analyze();
    expectNoSeriousViolations(findClubResults, 'find-club');

    await page.goto(`${baseUrl}/my-clubs`);
    const myClubsResults = await new AxeBuilder({ page }).analyze();
    expectNoSeriousViolations(myClubsResults, 'my-clubs');

    await page.goto(`${baseUrl}/profile`);
    const profileResults = await new AxeBuilder({ page }).analyze();
    expectNoSeriousViolations(profileResults, 'profile');

    await page.goto(`${baseUrl}/settings`);
    const settingsResults = await new AxeBuilder({ page }).analyze();
    expectNoSeriousViolations(settingsResults, 'settings');
  });

  test('club detail page and Schedule Drive modal have no critical/serious violations', async ({ page }) => {
    const user = {
      username: `a11y_${randomString()}`,
      email: `a11y_${randomString()}@mail.com`,
      password: 'AccessibleP@ss1',
    };
    await registerUser(page, user);

    await page.goto(`${baseUrl}/create-club`);
    await page.getByPlaceholder(/Southern California Mountain Drivers/i).fill(`A11y Club ${randomString()}`);
    await page.getByPlaceholder(/What makes your club unique/i).fill('A club for testing accessibility.');
    await page.getByRole('button', { name: /Create Club/i }).click();
    await page.waitForURL(/\/club\//, { timeout: 15000 });

    const clubResults = await new AxeBuilder({ page }).analyze();
    expectNoSeriousViolations(clubResults, 'club detail');

    // Open the Schedule Drive modal and re-scan with it open
    await page.getByRole('button', { name: /Schedule a Drive/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Schedule a Drive/i })).toBeVisible();

    const modalResults = await new AxeBuilder({ page }).analyze();
    expectNoSeriousViolations(modalResults, 'schedule drive modal');
  });
});
