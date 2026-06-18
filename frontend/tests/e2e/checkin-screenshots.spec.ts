import { test, expect } from '@playwright/test';

// ─── THROWAWAY SCRIPT — UC-08 Drive Check-In screenshot capture for documentation ───
// Not part of the regular suite. Safe to delete after screenshots are captured.

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

test.describe('UC-08 Check-In screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('capture leader + member check-in screenshots', async ({ page, request }) => {
    const suffix = Date.now();
    const leader = { username: `shotleader_${suffix}`, email: `shotleader_${suffix}@mail.com`, password: 'LeaderPass1!' };
    const member = { username: `shotmember_${suffix}`, email: `shotmember_${suffix}@mail.com`, password: 'MemberPass1!' };

    // 1. Register leader + member via API
    const leaderReg = await request.post(`${API}/auth/register`, { data: leader });
    expect(leaderReg.status()).toBe(201);
    const leaderToken = (await leaderReg.json()).token;

    const memberReg = await request.post(`${API}/auth/register`, { data: member });
    expect(memberReg.status()).toBe(201);
    const memberToken = (await memberReg.json()).token;

    // 2. Leader creates a public club, member joins
    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        name: `Checkin Screenshot Club ${suffix}`,
        description: 'Club created for UC-08 check-in documentation screenshots',
        isPrivate: false,
      },
    });
    expect(clubRes.status()).toBe(201);
    const clubId = (await clubRes.json()).club._id;

    const joinRes = await request.post(`${API}/clubs/${clubId}/join`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.status()).toBe(200);

    // 3. Leader schedules a drive a few days out
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const driveRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        clubId,
        name: 'Checkin Screenshot Drive',
        date: futureDate,
        time: '10:00 AM',
        location: 'Test Lot',
      },
    });
    expect(driveRes.status()).toBe(201);
    const driveId = (await driveRes.json()).drive._id;

    // 4. Member RSVPs going
    const rsvpRes = await request.post(`${API}/drives/${driveId}/rsvp`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { status: 'going' },
    });
    expect(rsvpRes.status()).toBe(200);

    // 5. Log in as leader via the UI
    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(leader.username);
    await page.getByPlaceholder('Password').fill(leader.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    // 6. Navigate to the club page, open the drive modal
    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByText('Checkin Screenshot Drive', { exact: false }).first().click();
    await expect(page.getByText('Drive Check-In', { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Send Check-In Notification/i })).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/checkin-leader-send-notification.png' });

    // 7. Click "Send Check-In Notification", wait for confirmation, screenshot results
    await page.getByRole('button', { name: /Send Check-In Notification/i }).click();
    await expect(page.getByText('Present', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Not Present', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/checkin-leader-results.png' });

    // 8. Close the drive modal, log out (via avatar dropdown), log in as member, open the same drive modal
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: /^[A-Z]{2}$/ }).last().click();
    await page.getByRole('menuitem', { name: /Log out/i }).click().catch(async () => {
      await page.getByText(/Log out/i).click();
    });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await page.getByPlaceholder('Username').fill(member.username);
    await page.getByPlaceholder('Password').fill(member.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByText('Checkin Screenshot Drive', { exact: false }).first().click();
    await expect(page.getByRole('button', { name: /Check In to This Drive/i })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/checkin-member-button.png' });

    // 9. Click "Check In to This Drive" -> navigates to dedicated check-in page
    await page.getByRole('button', { name: /Check In to This Drive/i }).click();
    await expect(page).toHaveURL(new RegExp(`/drive/${driveId}/checkin`));
    await expect(page.getByRole('button', { name: /I'm here/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/I couldn't make it/i)).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/checkin-member-page.png' });

    // 10. Click "I'm here", screenshot confirmation
    await page.getByRole('button', { name: /I'm here/i }).click();
    await expect(page.getByText(/You're checked in!/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/checkin-member-confirmed.png' });
  });
});
