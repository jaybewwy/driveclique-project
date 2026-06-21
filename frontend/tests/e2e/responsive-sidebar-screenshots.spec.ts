import { test, expect } from '@playwright/test';

test.describe.serial('Responsive sidebar drawers', () => {
  const ts = Date.now();
  const email = `respsidebar${ts}@mail.com`;
  const username = `respsidebar${ts}`;
  const password = 'TestPass123!';

  test('register a user', async ({ page }) => {
    await page.goto('/register');
    await page.getByPlaceholder('First').fill('Resp');
    await page.getByPlaceholder('Last').fill('Tester');
    await page.getByPlaceholder('username').fill(username);
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password (min. 8 chars)').fill(password);
    await page.getByRole('button', { name: /Create Account/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test.describe('after login', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 850 });
      await page.goto('/login');
      await page.getByPlaceholder('Username').fill(username);
      await page.getByPlaceholder('Password').fill(password);
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForURL('**/dashboard', { timeout: 15000 });
    });

    test('narrow viewport: Dashboard shows hamburger instead of sidebar', async ({ page }) => {
      await page.setViewportSize({ width: 480, height: 850 });
      await page.goto('/dashboard');
      await expect(page.getByLabel('Open navigation')).toBeVisible();
      await page.screenshot({ path: 'tests/e2e/screenshots/responsive-dashboard-narrow-before.png' });

      await page.getByLabel('Open navigation').click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'tests/e2e/screenshots/responsive-dashboard-narrow-drawer-open.png' });
      await expect(page.getByText('My Clubs').last()).toBeVisible();
    });

    test('narrow viewport: FindClub shows both nav and popular drawers', async ({ page }) => {
      await page.setViewportSize({ width: 480, height: 850 });
      await page.goto('/find-club');
      await expect(page.getByLabel('Open navigation')).toBeVisible();
      await expect(page.getByLabel('Open popular clubs')).toBeVisible();
      await page.screenshot({ path: 'tests/e2e/screenshots/responsive-findclub-narrow-before.png' });

      await page.getByLabel('Open popular clubs').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'tests/e2e/screenshots/responsive-findclub-narrow-popular-open.png' });
    });

    test('narrow viewport: Settings AnalyticsSidebar drawer', async ({ page }) => {
      await page.setViewportSize({ width: 480, height: 850 });
      await page.goto('/settings');
      await expect(page.getByLabel('Open navigation')).toBeVisible();
      await page.getByLabel('Open navigation').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'tests/e2e/screenshots/responsive-settings-narrow-drawer-open.png' });
    });

    test('wide viewport: sidebars are static, no hamburger', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/dashboard');
      await expect(page.getByText('Find Clubs').first()).toBeVisible();
      await expect(page.getByLabel('Open navigation')).toBeHidden();
      await page.screenshot({ path: 'tests/e2e/screenshots/responsive-dashboard-wide.png' });
    });
  });
});
