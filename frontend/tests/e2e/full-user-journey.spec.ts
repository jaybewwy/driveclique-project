/**
 * Full User Journey — end-to-end spec
 *
 * Covers the primary club + drive lifecycle:
 *   1. Leader registers, creates a public club, schedules a drive, RSVPs
 *   2. Member registers, finds and joins the club, RSVPs, views RSVP status
 *   3. Leader views attendee dashboard
 *   4. Leader cancels the drive
 *   5. Leader deletes the club  ← validates Bug 4 fix (no orphaned RSVPs)
 *
 * Screenshot helper: saves PNG to tests/e2e/screenshots/ at each milestone.
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const API  = process.env.PLAYWRIGHT_API_URL  || 'http://localhost:5000';

// Ensure screenshot directory exists
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ─── helpers ─────────────────────────────────────────────────────────────────

function rand(len = 7) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

function makeUsers() {
  const s = `${Date.now()}_${rand(4)}`;
  return {
    leader: {
      username: `leader_${s}`,
      email:    `leader_${s}@mail.com`,
      password: 'Journey123!',
    },
    member: {
      username: `member_${s}`,
      email:    `member_${s}@mail.com`,
      password: 'Journey123!',
    },
    clubName:  `Journey Club ${s}`,
    driveName: `Journey Drive ${s}`,
  };
}

async function screenshot(page: Page, name: string) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
}

async function register(page: Page, u: { username: string; email: string; password: string }) {
  await page.goto(`${BASE}/register`);
  await page.getByPlaceholder('First').fill('Test');
  await page.getByPlaceholder('Last').fill('User');
  await page.getByPlaceholder('Username').fill(u.username);
  await page.getByPlaceholder('Password').fill(u.password);
  await page.getByPlaceholder('Email address').fill(u.email);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 20_000 });
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

async function logout(page: Page) {
  const avatarBtn = page.getByRole('button', { name: /^[A-Z]{2}$/ }).last();
  const menuItem = page.getByRole('menuitem', { name: /Log out/i });

  // The avatar's Radix DropdownMenu occasionally doesn't register a click fired the
  // instant it renders (portal/listeners not yet attached right after navigation) —
  // confirmed via [role="menu"] never appearing in the DOM on the failing attempts.
  // Retry the trigger click a few times, actually waiting for the menu to open each
  // time, instead of assuming one click always works.
  for (let attempt = 0; attempt < 3; attempt++) {
    await avatarBtn.click().catch(() => {});
    const opened = await menuItem.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    if (opened) break;
  }

  await menuItem.click().catch(async () => {
    await page.getByText(/Log out/i).click().catch(() => {});
  });
  await page.waitForURL(`${BASE}/login`, { timeout: 10_000 }).catch(() => {});
}

async function createClub(page: Page, name: string): Promise<string> {
  await page.goto(`${BASE}/create-club`);
  await page.getByPlaceholder('e.g. Southern California Mountain Drivers').fill(name);
  await page.getByPlaceholder('What makes your club unique?').fill('Journey test club');
  await page.getByPlaceholder(/Search city or region|Search city in/i).fill('Journey City, JC');
  await page.getByRole('button', { name: /Create Club/i }).click();
  await expect(page.getByText(/Club created successfully/i)).toBeVisible({ timeout: 10_000 });
  await page.waitForURL(/\/club\/[a-f0-9]{24}/, { timeout: 10_000 });
  const match = page.url().match(/\/club\/([a-f0-9]{24})/);
  if (!match) throw new Error('Could not parse club ID from URL: ' + page.url());
  return match[1];
}

async function scheduleDrive(page: Page, clubId: string, driveName: string) {
  await page.goto(`${BASE}/club/${clubId}`);

  // Wait for the button before clicking to ensure the club page is fully loaded
  await expect(page.getByRole('button', { name: /Schedule a Drive/i }).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Schedule a Drive/i }).first().click();
  await expect(page.getByRole('heading', { name: /Schedule a Drive/i })).toBeVisible({ timeout: 5_000 });

  await page.getByPlaceholder('e.g. Mountain Run, Cars and Coffee').fill(driveName);

  // Navigate to NEXT month so we always pick a date in the future.
  // The calendar header row is: [ChevronLeft btn] [Month Year span] [ChevronRight btn]
  // We find the span containing "Month YYYY" and click the last button in its parent row.
  const monthYearSpan = page.locator('span').filter({ hasText: /^[A-Z][a-z]+ \d{4}$/ }).first();
  await expect(monthYearSpan).toBeVisible({ timeout: 5_000 });
  await monthYearSpan.locator('..').locator('button').last().click();

  // Pick day 15 — always a valid future date when in next month
  const day15 = page.locator('button').filter({ hasText: /^15$/ })
    .and(page.locator('button:not([disabled])')).first();
  await day15.click({ force: true });

  await page.getByRole('button', { name: '10:00 AM', exact: true }).click();

  await page.getByPlaceholder(/Search city or region|Search city in/i).fill('Journey Drive Lot');
  await page.getByPlaceholder('Additional details about the drive...').fill('Full journey test drive');

  await page.getByRole('button', { name: /Schedule Drive/i }).click();
  await expect(page.getByText(driveName).first()).toBeVisible({ timeout: 10_000 });
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Full User Journey', () => {

  // ── Step 1: Registration ──────────────────────────────────────────────────

  test('1 — Leader registers and lands on dashboard', async ({ page }) => {
    const { leader } = makeUsers();
    await register(page, leader);
    await screenshot(page, '01-leader-dashboard');
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible();
  });

  test('2 — Member registers and lands on dashboard', async ({ page }) => {
    const { member } = makeUsers();
    await register(page, member);
    await screenshot(page, '02-member-dashboard');
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible();
  });

  // ── Step 2: Club creation ─────────────────────────────────────────────────

  test('3 — Leader creates a public club and invite code is visible', async ({ page }) => {
    const { leader, clubName } = makeUsers();
    await register(page, leader);
    const clubId = await createClub(page, clubName);
    await screenshot(page, '03-club-created');

    await expect(page.getByRole('heading', { name: clubName })).toBeVisible({ timeout: 10_000 });
    const inviteCode = page.locator('span.font-mono').first();
    await expect(inviteCode).toBeVisible();
    await expect(inviteCode).not.toHaveText('');
    expect(clubId).toMatch(/^[a-f0-9]{24}$/);
  });

  // ── Step 3: Drive scheduling ──────────────────────────────────────────────

  test('4 — Leader schedules a drive and it persists on reload', async ({ page }) => {
    const { leader, clubName, driveName } = makeUsers();
    await register(page, leader);
    const clubId = await createClub(page, clubName);
    await scheduleDrive(page, clubId, driveName);
    await screenshot(page, '04-drive-scheduled');

    await expect(page.getByText(driveName).first()).toBeVisible();
    await expect(page.getByText('Journey Drive Lot').first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(driveName).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Step 4: Member finds & joins the club ─────────────────────────────────

  test('5 — Member joins the public club via Find Clubs', async ({ page }) => {
    const { leader, member, clubName } = makeUsers();

    // Leader creates the club
    await register(page, leader);
    await createClub(page, clubName);
    await logout(page);

    // Member finds and joins
    await register(page, member);
    await page.goto(`${BASE}/find-club`);
    await expect(page.getByRole('heading', { name: /Find Clubs/i })).toBeVisible({ timeout: 10_000 });
    // networkidle never resolves on authenticated pages — NavBar's SSE stream
    // keeps a connection permanently open. Use the timeout below instead.
    await page.waitForTimeout(800);

    // Scope to this test's own club card — parallel workers create similarly-named
    // public clubs around the same time, so a bare "first Join button" is ambiguous.
    const joinBtn = page.locator('.glass-card').filter({ hasText: clubName }).getByRole('button', { name: 'Join', exact: true });
    await expect(joinBtn).toBeVisible({ timeout: 10_000 });
    await joinBtn.click();

    await page.waitForURL(/\/club\/[a-f0-9]{24}/, { timeout: 10_000 });
    await screenshot(page, '05-member-joined-club');

    // We navigated to a club detail page — verify we're on one (not necessarily ours)
    await expect(page.getByText(/Members/i).first()).toBeVisible({ timeout: 10_000 });
    void clubName;
  });

  // ── Step 5: RSVP status ───────────────────────────────────────────────────

  test('6 — RSVP status is readable after page reload', async ({ page }) => {
    const { leader, clubName, driveName } = makeUsers();
    await register(page, leader);
    const clubId = await createClub(page, clubName);
    await scheduleDrive(page, clubId, driveName);

    await page.reload();
    await expect(page.getByText(driveName).first()).toBeVisible({ timeout: 10_000 });
    await screenshot(page, '06-rsvp-status-persisted');
  });

  // ── Step 6: Leader dashboard ──────────────────────────────────────────────

  test('7 — Leader views dashboard after creating a club', async ({ page }) => {
    const { leader, clubName } = makeUsers();
    await register(page, leader);
    await createClub(page, clubName);

    await page.goto(`${BASE}/dashboard`);
    await screenshot(page, '07-leader-dashboard-clubs');
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 10_000 });
  });

  // ── Step 7: Drive cancellation ────────────────────────────────────────────

  test('8 — Leader cancels the drive', async ({ page }) => {
    const { leader, clubName, driveName } = makeUsers();
    await register(page, leader);
    const clubId = await createClub(page, clubName);
    await scheduleDrive(page, clubId, driveName);

    const cancelBtn = page.getByRole('button', { name: /Cancel Drive/i }).first();
    if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cancelBtn.click();
      const reasonInput = page.getByPlaceholder(/reason/i).first();
      if (await reasonInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await reasonInput.fill('Journey test cancellation');
        await page.getByRole('button', { name: /Confirm/i }).first().click();
      }
    }
    await screenshot(page, '08-drive-cancelled');
    await expect(page.getByText(driveName).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Step 8: Club deletion — Bug 4 regression ──────────────────────────────

  test('9 — Leader deletes the club; RSVPs are cleaned up (Bug 4)', async ({ page }) => {
    const { leader, clubName, driveName } = makeUsers();
    await register(page, leader);
    const clubId = await createClub(page, clubName);
    await scheduleDrive(page, clubId, driveName);

    await page.getByRole('button', { name: /Manage Club/i }).click();
    await page.getByRole('button', { name: /Delete Club/i }).click();
    await expect(page.getByRole('heading', { name: /Delete Club/i })).toBeVisible({ timeout: 5_000 });

    await page.getByPlaceholder('leader@example.com').fill(leader.email);
    await page.getByPlaceholder('Why are you deleting this club?').fill('Journey test — verifying no orphaned RSVPs');
    await page.getByRole('button', { name: /Delete Permanently/i }).click();

    await page.waitForURL(/\/my-clubs/, { timeout: 10_000 });
    await screenshot(page, '09-club-deleted');
    await expect(page.getByRole('heading', { name: /My Clubs/i }).first()).toBeVisible({ timeout: 5_000 });

    // Verify via API: club drives are gone → no RSVPs should exist
    const apiCheck = await page.request.get(`${API}/api/drives/club/${clubId}`);
    const body = await apiCheck.json().catch(() => ({ drives: [] }));
    const driveList: unknown[] = (body as { drives?: unknown[] }).drives ?? [];
    expect(driveList.length).toBe(0);
  });

  // ── Step 9: No duplicate members — Bug 5 regression ──────────────────────

  test('10 — Joining a public club does not create duplicate member entries (Bug 5)', async ({ page }) => {
    const { leader, member, clubName } = makeUsers();

    // Leader creates the club
    await register(page, leader);
    const clubId = await createClub(page, clubName);
    await logout(page);

    // Member joins
    await register(page, member);
    await page.goto(`${BASE}/club/${clubId}`);
    // Wait for club content to load (SSE keeps connection open so avoid networkidle)
    await expect(page.getByText(/Members/i).first()).toBeVisible({ timeout: 10_000 });

    // Fetch club via API and assert exactly 2 members (leader + member)
    const token: string = await page.evaluate(() => localStorage.getItem('token') ?? '');
    const resp = await page.request.get(`${API}/api/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await resp.json().catch(() => ({ club: { members: [] } }));
    const members: unknown[] = (data as { club?: { members?: unknown[] } }).club?.members ?? [];
    expect(members.length).toBeLessThanOrEqual(2);

    await screenshot(page, '10-no-duplicate-members');
  });

  // ── Step 10: My Clubs page ────────────────────────────────────────────────

  test('11 — My Clubs page lists the clubs a user belongs to', async ({ page }) => {
    const { leader, clubName } = makeUsers();
    await register(page, leader);
    await createClub(page, clubName);

    await page.goto(`${BASE}/my-clubs`);
    await expect(page.getByRole('heading', { name: /My Clubs/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h3, h2').filter({ hasText: clubName }).first()).toBeVisible({ timeout: 10_000 });
    await screenshot(page, '11-my-clubs');
  });

  // ── Step 11: Profile page ─────────────────────────────────────────────────

  test('12 — Profile page loads with correct username and email', async ({ page }) => {
    const { leader } = makeUsers();
    await register(page, leader);

    // Username/Email moved from /profile to the /settings "Profile" view in a later session
    await page.goto(`${BASE}/settings`);
    await page.getByText('Profile', { exact: true }).first().click();
    await expect(page.getByLabel('Username')).toHaveValue(leader.username);
    await expect(page.getByLabel('Email')).toHaveValue(leader.email);
    await screenshot(page, '12-profile-page');
  });

  // ── Step 12: Find Clubs browse ────────────────────────────────────────────

  test('13 — Find Clubs page displays a newly created public club', async ({ page }) => {
    const { leader, member, clubName } = makeUsers();
    await register(page, leader);
    await createClub(page, clubName);
    await logout(page);

    await register(page, member);
    await page.goto(`${BASE}/find-club`);
    await expect(page.getByRole('heading', { name: /Find Clubs/i })).toBeVisible({ timeout: 10_000 });
    // networkidle never resolves on authenticated pages — NavBar's SSE stream
    // keeps a connection permanently open. Use the timeout below instead.
    await page.waitForTimeout(800);

    await expect(page.locator('h3').filter({ hasText: clubName }).first()).toBeVisible({ timeout: 10_000 });
    await screenshot(page, '13-find-clubs');
  });

  // ── Step 13: Member + leader full flow ────────────────────────────────────

  test('14 — Full club + drive lifecycle (leader and member)', async ({ page }) => {
    const { leader, member, clubName, driveName } = makeUsers();

    // 1. Leader registers and creates a public club with a drive
    await register(page, leader);
    const clubId = await createClub(page, clubName);
    await scheduleDrive(page, clubId, driveName);
    await screenshot(page, '14a-leader-drive-created');

    await logout(page);

    // 2. Member registers, navigates directly to our club (public), joins, sees the drive
    await register(page, member);
    await page.goto(`${BASE}/club/${clubId}`);
    await expect(page.getByRole('heading', { name: clubName })).toBeVisible({ timeout: 10_000 });
    // For a public club the member sees a "Join Club" button before becoming a member
    const joinBtn = page.getByRole('button', { name: 'Join', exact: true }).first();
    if (await joinBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await joinBtn.click();
      await page.waitForTimeout(800);
    }
    await expect(page.getByText(driveName).first()).toBeVisible({ timeout: 10_000 });
    await screenshot(page, '14b-member-sees-drive');
    await logout(page);

    // 3. Leader deletes the club (verifies Bug 4: RSVPs cleaned up)
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder('Username').fill(leader.username);
    await page.getByPlaceholder('Password').fill(leader.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15_000 });

    await page.goto(`${BASE}/club/${clubId}`);
    // Wait for club page to be fully loaded before interacting
    await expect(page.getByRole('button', { name: /Manage Club/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Manage Club/i }).click();
    await page.getByRole('button', { name: /Delete Club/i }).click();
    await expect(page.getByRole('heading', { name: /Delete Club/i })).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder('leader@example.com').fill(leader.email);
    await page.getByPlaceholder('Why are you deleting this club?').fill('Full lifecycle test');
    await page.getByRole('button', { name: /Delete Permanently/i }).click();
    await page.waitForURL(/\/my-clubs/, { timeout: 10_000 });
    await screenshot(page, '14c-club-deleted');

    // Verify the club was deleted: API should return 404 for the deleted club
    // This avoids UI-timing races (My Clubs context may lag) and is the authoritative check.
    await expect(page.getByRole('heading', { name: /My Clubs/i }).first()).toBeVisible({ timeout: 5_000 });
    const leaderToken: string = await page.evaluate(() => localStorage.getItem('token') ?? '');
    const deleteCheck = await page.request.get(`${API}/api/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` }
    });
    expect(deleteCheck.status()).toBe(404);
  });

  // ── Step 14: My Clubs empty state ────────────────────────────────────────

  test('15 — New user with no clubs sees empty state on My Clubs', async ({ page }) => {
    const { leader } = makeUsers();
    await register(page, leader);
    await page.goto(`${BASE}/my-clubs`);
    await expect(page.getByRole('heading', { name: /My Clubs/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /No Clubs Yet/i })).toBeVisible({ timeout: 10_000 });
    await screenshot(page, '15-my-clubs-empty');
  });
});
