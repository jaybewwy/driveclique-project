import { test, expect } from '@playwright/test';

// ─── THROWAWAY SCRIPT — UC-09 My Garage (multiple cars + photos) screenshot capture ───
// Not part of the regular suite. Safe to delete after screenshots are captured.

const FRONTEND = 'http://localhost:5173';

// 1x1 red PNG, reused from profile-picture-upload.spec.ts's inline-buffer pattern
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x01,
  0x08, 0x02,
  0x00, 0x00, 0x00,
  0x90, 0x77, 0x53, 0xDE,
  0x00, 0x00, 0x00, 0x0C,
  0x49, 0x44, 0x41, 0x54,
  0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0xF0, 0x1F, 0x00, 0x05, 0xFE, 0x03, 0xFE,
  0xDC, 0xCC, 0x59, 0x5F,
  0x00, 0x00, 0x00, 0x00,
  0x49, 0x45, 0x4E, 0x44,
  0xAE, 0x42, 0x60, 0x82
]);

test.describe('UC-09 My Garage screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('capture before/after garage screenshots', async ({ page }) => {
    const suffix = Date.now();
    const user = { username: `garage_${suffix}`, email: `garage_${suffix}@mail.com`, password: 'GaragePass1!' };

    await page.goto(`${FRONTEND}/register`);
    await page.getByPlaceholder('First').fill('Garage');
    await page.getByPlaceholder('Last').fill('Tester');
    await page.getByPlaceholder('username').fill(user.username);
    await page.getByPlaceholder('Email address').fill(user.email);
    await page.getByPlaceholder(/Password \(min/i).fill(user.password);
    await page.getByRole('button', { name: /Create Account/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/profile`);
    await expect(page.getByText('My Garage', { exact: false })).toBeVisible({ timeout: 10_000 });

    // "Before" — empty garage state
    await page.screenshot({ path: 'tests/e2e/screenshots/garage-before-empty.png' });

    // Add the first car
    await page.getByRole('button', { name: /Add Car/i }).click();
    const firstCard = page.locator('.bg-black.rounded-xl').filter({ has: page.getByPlaceholder('2020') }).first();
    await firstCard.getByPlaceholder('2020').fill('2022');
    await firstCard.getByPlaceholder('Toyota').fill('Toyota');
    await firstCard.getByPlaceholder('GR86').fill('GR86');
    await firstCard.getByPlaceholder('Red').fill('Red');
    await firstCard.getByPlaceholder('The Beast').fill('Track Day');

    // Upload a photo into the first car's photo grid
    await firstCard.locator('input[type="file"][accept="image/*"]').setInputFiles({
      name: 'car1.png',
      mimeType: 'image/png',
      buffer: pngBuffer
    });
    await expect(firstCard.locator('img').first()).toBeVisible({ timeout: 5_000 });

    // Add a second car and set it as primary — adding a new car auto-expands it and
    // collapses the previous one (only one car is expanded at a time), so the newly
    // expanded card is the sole match for the "2020" placeholder.
    await page.getByRole('button', { name: /Add Car/i }).click();
    const secondCard = page.locator('.bg-black.rounded-xl').filter({ has: page.getByPlaceholder('2020') }).first();
    await secondCard.getByPlaceholder('2020').fill('2018');
    await secondCard.getByPlaceholder('Toyota').fill('Honda');
    await secondCard.getByPlaceholder('GR86').fill('Civic Type R');
    await secondCard.getByRole('button', { name: /Set as primary car/i }).click();

    await page.screenshot({ path: 'tests/e2e/screenshots/garage-two-cars-expanded.png' });

    // Save
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await expect(page.getByText('Profile updated successfully!')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/garage-after-saved.png' });

    // Reload to confirm persistence
    await page.reload();
    await expect(page.getByText('Toyota GR86', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Honda Civic Type R', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Primary', { exact: false }).first()).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/garage-after-reload-persisted.png' });
  });
});
