import { test, expect } from '@playwright/test';
import crypto from 'crypto';

// UC-10 — Club Co-Leader / Moderator Role. Manual UI verification + screenshots,
// following this project's established checkin-screenshots.spec.ts precedent
// (kept for re-use, not deleted after a single run).
//
// Each test() gets a fresh, unauthenticated browser context by default (only
// plain JS state like `clubId` below survives across tests in this serial
// block, not cookies/localStorage) — so every test that needs a session logs
// in explicitly at its own start, matching this project's existing spec files.

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

function randomString(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
}

async function registerUser(page, user) {
  await page.goto(`${baseUrl}/register`);
  await page.getByPlaceholder('First').fill('Test');
  await page.getByPlaceholder('Last').fill('User');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByPlaceholder('Email address').fill(user.email);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 15000 });
}

async function loginUser(page, user) {
  await page.goto(`${baseUrl}/login`);
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page).toHaveURL(new RegExp(`${baseUrl}/dashboard`));
}

test.describe.configure({ mode: 'serial' });

const suffix = randomString(6);
const leader = { username: `coluxlead_${suffix}`, email: `coluxlead_${suffix}@mail.com`, password: 'LeaderPass1!' };
const member = { username: `coluxmem_${suffix}`, email: `coluxmem_${suffix}@mail.com`, password: 'MemberPass1!' };

let clubId = '';

test('leader registers and creates a private club', async ({ page }) => {
  await registerUser(page, leader);
  await page.goto(`${baseUrl}/create-club`);
  await page.getByPlaceholder('e.g. Southern California Mountain Drivers').fill(`Moderator UX Test Club ${suffix}`);
  await page.getByPlaceholder('What makes your club unique?').fill('Verifying the UC-10 co-leader role end to end.');
  await page.getByPlaceholder(/Search city or region|Search city in/i).fill('Testville, CA');
  await page.getByText('Private', { exact: true }).click();
  await page.getByRole('button', { name: /Create Club/i }).click();
  await page.waitForURL(/\/club\/[a-f0-9]{24}/, { timeout: 15000 });
  clubId = page.url().match(/\/club\/([a-f0-9]{24})/)[1];
  expect(clubId).toBeTruthy();
});

test('member registers and requests to join the private club', async ({ page }) => {
  await registerUser(page, member);
  await page.goto(`${baseUrl}/club/${clubId}`);
  await page.getByRole('button', { name: /^Join Club$/i }).click();
  await expect(page.getByText(/Awaiting leader approval/i)).toBeVisible({ timeout: 10000 });
});

test('leader approves the pending request, then promotes the member to co-leader', async ({ page }) => {
  await loginUser(page, leader);
  await page.goto(`${baseUrl}/club/${clubId}`);

  await expect(page.getByText('Pending Join Requests')).toBeVisible({ timeout: 10000 });
  await page.getByTitle('Approve').click();
  await expect(page.getByText('No pending requests')).toBeVisible({ timeout: 10000 });

  // "View All" (members) vs "View All (N)" (drives) — exact match avoids the
  // ambiguity this project's own docs flag between the two buttons.
  await page.getByRole('button', { name: 'View All', exact: true }).click();
  await expect(page.getByRole('heading', { name: /All Members/i })).toBeVisible({ timeout: 5000 });
  await page.getByTitle('Promote to co-leader').click();
  await expect(page.locator('[role="dialog"]').getByText('Co-Leader')).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/uc10-coleader-badge-and-pending-approved.png', fullPage: true });
});

test('leader schedules a drive; the Cancel Drive option appears in its action menu', async ({ page }) => {
  await loginUser(page, leader);
  await page.goto(`${baseUrl}/club/${clubId}`);
  await page.getByRole('button', { name: /Schedule a Drive/i }).first().click();
  await expect(page.getByRole('heading', { name: /Schedule a Drive/i })).toBeVisible({ timeout: 5000 });

  const driveName = `UC10 Cancel Drive Test ${suffix}`;
  await page.getByPlaceholder('e.g. Mountain Run, Cars and Coffee').fill(driveName);
  const enabledDayButton = page.locator('button').filter({ hasText: /^\d+$/ }).and(page.locator('button:not([disabled])')).last();
  await enabledDayButton.click({ force: true });
  await page.getByRole('button', { name: '10:00 AM', exact: true }).click();
  await page.getByPlaceholder(/Search city or region|Search city in/i).fill('Meetup Lot Alpha');
  await page.getByRole('button', { name: /Schedule Drive/i }).click();
  await expect(page.getByText(driveName).first()).toBeVisible({ timeout: 10000 });

  // Open the per-drive action menu (the ⋮ button, lucide's MoreVertical icon —
  // an alias for its internally-registered "ellipsis-vertical" icon)
  await page.locator('button:has(svg.lucide-ellipsis-vertical)').first().click();
  await expect(page.getByRole('button', { name: 'Cancel Drive', exact: true })).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/uc10-cancel-drive-menu-option.png', fullPage: true });
});

test('member (now co-leader) logs in and sees co-leader-level access on the club page', async ({ page }) => {
  await loginUser(page, member);
  await page.goto(`${baseUrl}/club/${clubId}`);
  // Co-leaders get the Schedule a Drive button too
  await expect(page.getByRole('button', { name: /Schedule a Drive/i }).first()).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/uc10-coleader-view-of-club-page.png', fullPage: true });
});
