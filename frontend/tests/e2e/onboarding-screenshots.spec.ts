import { test, expect } from '@playwright/test';
import crypto from 'crypto';

// ─── THROWAWAY SCRIPT — UC-26 New-User Onboarding screenshot capture ───
// Not part of the regular suite. Safe to delete after screenshots are captured.

const FRONTEND = 'http://localhost:5173';

function randomString(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
}

test.describe('UC-26 Onboarding screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('capture welcome tour + checklist lifecycle', async ({ page }) => {
    const suffix = `${Date.now()}_${randomString()}`;
    const user = { username: `onb_${suffix}`, email: `onb_${suffix}@mail.com`, password: 'OnboardPass1!' };

    // ── Register — modal should appear automatically via justRegistered flag ──
    await page.goto(`${FRONTEND}/register`);
    await page.getByPlaceholder('First').fill('Onboard');
    await page.getByPlaceholder('Last').fill('Tester');
    await page.getByPlaceholder('username').fill(user.username);
    await page.getByPlaceholder('Email address').fill(user.email);
    await page.getByPlaceholder(/Password \(min/i).fill(user.password);
    await page.getByRole('button', { name: /Create Account/i }).click();
    await page.waitForURL(`${FRONTEND}/dashboard`, { timeout: 15000 });

    await expect(page.getByRole('heading', { name: 'Find or Create a Club' })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/onboarding-step1-find-club.png' });

    await page.getByRole('button', { name: /^Next$/i }).click();
    await expect(page.getByRole('heading', { name: 'RSVP to a Drive' })).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/onboarding-step2-rsvp.png' });

    await page.getByRole('button', { name: /^Next$/i }).click();
    await expect(page.getByRole('heading', { name: 'Get Notified' })).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/onboarding-step3-notifications.png' });

    await page.getByRole('button', { name: /Get Started/i }).click();
    await expect(page.getByRole('heading', { name: 'Get Notified' })).not.toBeVisible();

    // ── Checklist: 0/3 ──
    await expect(page.getByText('Getting Started')).toBeVisible();
    await expect(page.getByText('0/3 complete')).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/onboarding-checklist-0of3.png' });

    // ── Create a club → "Join a club" auto-checks ──
    await page.goto(`${FRONTEND}/create-club`);
    const clubName = `OnboardClub_${randomString(5)}`;
    await page.getByPlaceholder('e.g. Southern California Mountain Drivers').fill(clubName);
    await page.getByPlaceholder('What makes your club unique?').fill('Onboarding test club description');
    await page.getByPlaceholder(/Search city or region|Search city in/i).fill('Testville, CA');
    await page.getByRole('button', { name: /Create Club/i }).click();
    await expect(page.getByText(/Club created successfully/i)).toBeVisible({ timeout: 10000 });
    await page.waitForURL(/\/club\/[a-f0-9]{24}/, { timeout: 10000 });
    const clubId = page.url().match(/\/club\/([a-f0-9]{24})/)![1];

    // ── Schedule a drive + RSVP going → "RSVP to a drive" auto-checks ──
    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByRole('button', { name: /Schedule a Drive/i }).first().click();
    await expect(page.getByRole('heading', { name: /Schedule a Drive/i })).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('e.g. Mountain Run, Cars and Coffee').fill(`Onboard Drive ${randomString(4)}`);
    const enabledDay = page.locator('button').filter({ hasText: /^\d+$/ }).and(page.locator('button:not([disabled])')).last();
    await enabledDay.click({ force: true });
    await page.getByRole('button', { name: '10:00 AM', exact: true }).click();
    await page.getByPlaceholder(/Search city or region|Search city in/i).fill('Test Meeting Point');
    await page.getByRole('button', { name: /^Schedule Drive$/i }).click();
    await expect(page.getByText(/Next Scheduled Drive|Upcoming Drive/i).first()).toBeVisible({ timeout: 10000 });

    // Open the drive and RSVP going
    await page.getByText(/Onboard Drive/i).first().click();
    await page.getByRole('button', { name: /^Going$/i }).click();
    await expect(page.locator('p.text-green-400', { hasText: '1' })).toBeVisible({ timeout: 10000 });

    await page.goto(`${FRONTEND}/dashboard`);
    await expect(page.getByText('Getting Started')).toBeVisible();
    await expect(page.getByText('2/3 complete')).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/onboarding-checklist-2of3.png' });

    // ── Fill in profile bio → "Set up your profile" auto-checks, checklist disappears ──
    await page.goto(`${FRONTEND}/profile`);
    await page.locator('textarea[name="bio"]').fill('Onboarding test bio — car enthusiast.');
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await expect(page.getByText(/Profile updated successfully/i)).toBeVisible({ timeout: 10000 });

    await page.goto(`${FRONTEND}/dashboard`);
    await expect(page.getByText('Good to see you').or(page.getByPlaceholder(/What's the plan\?/i))).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Getting Started')).not.toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/onboarding-checklist-complete-hidden.png' });
  });
});
