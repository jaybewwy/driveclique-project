import { test, expect } from '@playwright/test';

// UC-33 — screenshot + real-download verification, kept for re-use per this
// project's `checkin-screenshots.spec.ts` precedent. State seeded via direct
// API calls (same reasoning as uc32-screenshots.spec.ts — resilient to this
// session's own environment slowness); browser used only for the final
// interaction/screenshot steps.

const API = 'http://localhost:5000/api';
const suffix = Date.now();

test('UC-33 screenshots + real download verification', async ({ request, browser }) => {
  test.setTimeout(60000);

  const user = { username: `uc33shot_${suffix}`, email: `uc33shot_${suffix}@mail.com`, password: 'Uc33Pass1!' };
  const userRes = await request.post(`${API}/auth/register`, { data: user });
  const userToken = (await userRes.json()).token;

  const clubRes = await request.post(`${API}/clubs`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: { name: `UC33 Screenshot Club ${suffix}`, description: 'Screenshot verification club for UC-33.', isPrivate: false },
  });
  const club = (await clubRes.json()).club;

  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const driveRes = await request.post(`${API}/drives`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: { clubId: club._id, name: 'UC33 Export Drive', date: future, time: '10:00 AM', location: 'Test Lot', description: 'For the calendar export screenshot.' },
  });
  const drive = (await driveRes.json()).drive;

  await request.post(`${API}/drives/${drive._id}/rsvp`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: { status: 'going' },
  });

  const page = await (await browser.newContext()).newPage();

  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder(/username/i).fill(user.username);
  await page.getByPlaceholder(/password/i).fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });

  // --- Drive detail modal: "Add to Calendar" ---
  await page.goto('http://localhost:5173/my-clubs');
  await page.getByRole('button', { name: /View Club/i }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`UC33 Screenshot Club ${suffix}`) })).toBeVisible({ timeout: 15000 });
  await page.getByText('UC33 Export Drive', { exact: false }).first().click();
  await expect(page.getByRole('button', { name: /Add to Calendar/i })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/uc33-drive-modal-add-to-calendar.png' });

  const [singleDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.getByRole('button', { name: /Add to Calendar/i }).click(),
  ]);
  expect(singleDownload.suggestedFilename()).toMatch(/\.ics$/);

  await page.keyboard.press('Escape');

  // --- Personal Analytics: "Export My Schedule" ---
  await page.goto('http://localhost:5173/settings');
  await page.getByRole('button', { name: /^Home$/i }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  const personalNav = page.getByRole('button', { name: /Personal Analytics|Personal/i }).first();
  if (await personalNav.isVisible().catch(() => false)) await personalNav.click();
  await expect(page.getByRole('button', { name: /Export My Schedule/i })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/uc33-personal-analytics-export-schedule.png' });

  const [scheduleDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.getByRole('button', { name: /Export My Schedule/i }).click(),
  ]);
  expect(scheduleDownload.suggestedFilename()).toBe('driveclique-schedule.ics');
});
