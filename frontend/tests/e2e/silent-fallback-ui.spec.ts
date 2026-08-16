import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

// ─── Silent fallback UI regression coverage ─────────────────────────────────
// Dashboard.jsx and ClubDetail.jsx both used to swallow a failed RSVP-count
// fetch and render a fake "0 going" indistinguishable from a drive that
// legitimately has zero RSVPs (the exact class of bug flagged in review: a
// backend failure silently rendered as valid-looking data). Both now render
// a distinct "— going" state instead. This suite forces the RSVP-status
// request to fail via route interception and asserts the distinct state
// appears, not a fake zero.

test.describe('Silent fallback UI regression', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `fallbackldr_${suffix}`, email: `fallbackldr_${suffix}@mail.com`, password: 'LeaderPass1!' };

  let clubId = '';
  let driveId = '';

  test('register leader, create club, schedule a drive', async ({ request }) => {
    const leaderRes = await request.post(`${API}/auth/register`, { data: leader });
    expect(leaderRes.status()).toBe(201);
    const leaderToken = (await leaderRes.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Fallback UI Club ${suffix}`, description: 'Testing the failed-to-load RSVP state', isPrivate: false },
    });
    expect(clubRes.status()).toBe(201);
    clubId = (await clubRes.json()).club._id;

    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const driveRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Fallback UI Test Drive', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(driveRes.status()).toBe(201);
    driveId = (await driveRes.json()).drive._id;
  });

  test('Dashboard shows "— going" instead of a fake "0 going" when the RSVP count fetch fails', async ({ page }) => {
    await page.route(`**/api/drives/${driveId}/rsvp-status`, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Simulated failure' }) })
    );

    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(leader.username);
    await page.getByPlaceholder('Password').fill(leader.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    const driveCard = page.getByText('Fallback UI Test Drive', { exact: false }).locator('..').locator('..');
    await expect(driveCard.getByTitle("Couldn't load attendee count")).toBeVisible({ timeout: 10_000 });
    await expect(driveCard.getByText('— going')).toBeVisible();
    await expect(driveCard.getByText('0 going')).not.toBeVisible();
  });

  test('ClubDetail shows "— going" instead of a fake "0 going" when the RSVP count fetch fails', async ({ page }) => {
    await page.route(`**/api/drives/${driveId}/rsvp-status`, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Simulated failure' }) })
    );

    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(leader.username);
    await page.getByPlaceholder('Password').fill(leader.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/club/${clubId}`);
    await expect(page.getByTitle("Couldn't load attendee count")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('— going')).toBeVisible();
    await expect(page.getByText('0 going')).not.toBeVisible();
  });
});
