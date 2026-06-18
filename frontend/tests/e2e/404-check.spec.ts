import { test } from '@playwright/test';

test('404 unauthenticated', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/this-page-does-not-exist');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/e2e/screenshots/ux-audit/404-unauthenticated.png', fullPage: true });
  console.log('URL:', page.url());
  console.log('Has 404 heading:', await page.locator('text=Page not found').isVisible().catch(() => false));
  console.log('Has Sign In btn:', await page.locator('button:has-text("Sign In")').isVisible().catch(() => false));
  console.log('Has Go Back btn:', await page.locator('button:has-text("Go Back")').isVisible().catch(() => false));
});

test('404 invalid club id', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/login');
  await page.locator('input[placeholder*="sername"]').first().fill('fresh1781262727065');
  await page.locator('input[type="password"]').first().fill('TestPass123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 12000 }).catch(() => {});
  await page.goto('http://localhost:5173/club/000000000000000000000000');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tests/e2e/screenshots/ux-audit/404-invalid-club.png', fullPage: true });
  console.log('Club 404 URL:', page.url());
  console.log('Club not found heading:', await page.locator('text=Club not found').isVisible().catch(() => false));
  console.log('My Clubs btn:', await page.locator('button:has-text("My Clubs")').isVisible().catch(() => false));
});

test('404 mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:5173/some-missing-route');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/e2e/screenshots/ux-audit/404-mobile.png', fullPage: true });
});
