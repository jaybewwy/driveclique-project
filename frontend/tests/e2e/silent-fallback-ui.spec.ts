import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

// ─── Silent fallback UI regression coverage ─────────────────────────────────
// Dashboard.jsx and ClubDetail.jsx both used to swallow a failed RSVP-count
// fetch and render a fake "0 going" indistinguishable from a drive that
// legitimately has zero RSVPs (the exact class of bug flagged in review: a
// backend failure silently rendered as valid-looking data). ClubDetail now
// renders a distinct "— going" state. The Dashboard gets its counts with its
// drive list, and says the list failed rather than "No upcoming drives". This
// suite forces each request to fail via route interception and asserts the
// distinct state appears, not valid-looking data.

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

  // The Dashboard's counts now arrive with its drive list (GET /drives/my-upcoming),
  // so the request that can fail is the list itself
  test('Dashboard says its drives failed to load instead of "No upcoming drives"', async ({ page }) => {
    await page.route('**/api/drives/my-upcoming**', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Simulated failure' }) })
    );

    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(leader.username);
    await page.getByPlaceholder('Password').fill(leader.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Couldn't load upcoming drives")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No upcoming drives')).toHaveCount(0);
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
