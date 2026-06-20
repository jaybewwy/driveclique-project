import { test, expect } from '@playwright/test';

// ─── THROWAWAY SCRIPT — UC-23 Drive Meeting-Point Map screenshot capture for documentation ───
// Not part of the regular suite. Safe to delete after screenshots are captured.

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

test.describe('UC-23 Drive Map screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('capture pin-picker + member preview screenshots', async ({ page, request }) => {
    const suffix = Date.now();
    const leader = { username: `mapshot_l_${suffix}`, email: `mapshot_l_${suffix}@mail.com`, password: 'LeaderPass1!' };
    const member = { username: `mapshot_m_${suffix}`, email: `mapshot_m_${suffix}@mail.com`, password: 'MemberPass1!' };

    const leaderReg = await request.post(`${API}/auth/register`, { data: leader });
    const leaderToken = (await leaderReg.json()).token;
    const memberReg = await request.post(`${API}/auth/register`, { data: member });
    const memberToken = (await memberReg.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Map Shot Club ${suffix}`, description: 'UC-23 documentation screenshots', isPrivate: false },
    });
    const clubId = (await clubRes.json()).club._id;
    await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${memberToken}` } });

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const driveRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        clubId,
        name: 'Pinned Cars & Coffee',
        date: futureDate,
        time: '9:00 AM',
        location: 'San Francisco, California, United States',
        coordinates: { lat: 37.7749, lng: -122.4194 },
      },
    });
    const driveWithMap = (await driveRes.json()).drive;

    // 1. Log in as leader, open Schedule Drive modal, select a location, screenshot the pin picker
    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(leader.username);
    await page.getByPlaceholder('Password').fill(leader.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByRole('button', { name: /Schedule a Drive/i }).first().click();
    await page.getByPlaceholder(/Search city or region|Search city in/i).fill('San Francisco');
    await expect(page.getByRole('button', { name: /San Francisco/i }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /San Francisco/i }).first().click();
    await expect(page.locator('.leaflet-marker-icon')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/map-leader-pin-picker.png' });
    await page.keyboard.press('Escape').catch(() => {});

    // 2. Log out, log in as member, open the drive modal, screenshot the static preview + directions link
    await page.goto(`${FRONTEND}/dashboard`);
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
    await page.getByText(driveWithMap.name, { exact: false }).first().click();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /Get Directions/i })).toBeVisible();
    await page.screenshot({ path: 'tests/e2e/screenshots/map-member-preview.png' });
  });
});
