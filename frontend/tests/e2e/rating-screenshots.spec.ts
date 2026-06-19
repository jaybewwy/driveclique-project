import { test, expect } from '@playwright/test';

// ─── THROWAWAY SCRIPT — UC-25 Drive Rating screenshot capture for documentation ───
// Not part of the regular suite. Safe to delete after screenshots are captured.

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

test.describe('UC-25 Drive Rating screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('capture before/after rating + analytics screenshots', async ({ page, request }) => {
    const suffix = Date.now();
    const leader = { username: `rateshot_l_${suffix}`, email: `rateshot_l_${suffix}@mail.com`, password: 'LeaderPass1!' };
    const member = { username: `rateshot_m_${suffix}`, email: `rateshot_m_${suffix}@mail.com`, password: 'MemberPass1!' };

    const leaderReg = await request.post(`${API}/auth/register`, { data: leader });
    expect(leaderReg.status()).toBe(201);
    const leaderToken = (await leaderReg.json()).token;

    const memberReg = await request.post(`${API}/auth/register`, { data: member });
    expect(memberReg.status()).toBe(201);
    const memberToken = (await memberReg.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        name: `Rating Screenshot Club ${suffix}`,
        description: 'Club created for UC-25 rating documentation screenshots',
        isPrivate: false,
      },
    });
    expect(clubRes.status()).toBe(201);
    const clubId = (await clubRes.json()).club._id;

    const joinRes = await request.post(`${API}/clubs/${clubId}/join`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.status()).toBe(200);

    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const driveRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Rating Screenshot Drive', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(driveRes.status()).toBe(201);
    const driveId = (await driveRes.json()).drive._id;

    const rsvpRes = await request.post(`${API}/drives/${driveId}/rsvp`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { status: 'going' },
    });
    expect(rsvpRes.status()).toBe(200);

    // A second, still-upcoming drive so the sidebar's "Past Events" button renders
    // (it's hidden whenever there are zero non-completed upcoming drives).
    const otherFutureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const otherDriveRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Next Upcoming Drive', date: otherFutureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(otherDriveRes.status()).toBe(201);

    // Mark the first drive completed so the rating section becomes visible
    const completeRes = await request.put(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { isCompleted: true },
    });
    expect(completeRes.status()).toBe(200);

    // Log in as the member via the UI
    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(member.username);
    await page.getByPlaceholder('Password').fill(member.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    // Open the drive modal via "Past Events" — "before" screenshot: no rating submitted yet
    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByRole('button', { name: /Past Events/i }).click();
    await page.getByText('Rating Screenshot Drive', { exact: false }).first().click();
    await expect(page.getByText('Rate this Drive', { exact: false })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/rating-before-member-form.png' });

    // Click the 4th star, add a comment, submit
    const stars = page.locator('button:has(svg)').filter({ has: page.locator('svg') });
    // Use a more specific locator: the 5 star buttons are siblings right above the textarea
    const starButtons = page.locator('div.flex.items-center.gap-1 > button');
    await starButtons.nth(3).click(); // 4th star (index 3) = 4 stars
    await page.getByPlaceholder(/Add an optional comment/i).fill('Great drive, loved the route!');
    await page.getByRole('button', { name: /Submit Rating/i }).click();
    await expect(page.getByText(/Thanks for rating this drive!/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/rating-after-member-submitted.png' });

    // Log out, log in as leader, check the analytics card
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: /^[A-Z]{2}$/ }).last().click();
    await page.getByRole('menuitem', { name: /Log out/i }).click().catch(async () => {
      await page.getByText(/Log out/i).click();
    });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await page.getByPlaceholder('Username').fill(leader.username);
    await page.getByPlaceholder('Password').fill(leader.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/settings`);
    await page.getByText('Avg Drive Rating', { exact: false }).scrollIntoViewIfNeeded({ timeout: 15_000 });
    await expect(page.getByText('Avg Drive Rating', { exact: false })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/rating-leader-analytics-card.png' });
  });
});
