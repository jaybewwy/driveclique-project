import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

// ─── UC-23 — Drive Route / Meeting Point Map ────────────────────────────────
// API-level tests: coordinates are saved/validated/optional on create + update.
// UI-level tests: pin picker renders on selection, member preview + directions
// link render when coordinates exist, legacy drives without coordinates fall
// back to text-only location with no map/button.

test.describe('Drive meeting-point map (UC-23) — API', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `mapleader_${suffix}`, email: `mapleader_${suffix}@mail.com`, password: 'LeaderPass1!' };

  let leaderToken = '';
  let clubId = '';
  let driveId = '';

  test('register leader and create a public club', async ({ request }) => {
    const reg = await request.post(`${API}/auth/register`, { data: leader });
    expect(reg.status()).toBe(201);
    leaderToken = (await reg.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Map Club ${suffix}`, description: 'Testing UC-23 drive map', isPrivate: false },
    });
    expect(clubRes.status()).toBe(201);
    clubId = (await clubRes.json()).club._id;
  });

  test('create drive with valid coordinates → saved', async ({ request }) => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        clubId,
        name: 'Map Test Drive',
        date: futureDate,
        time: '10:00 AM',
        location: 'Test Lot',
        coordinates: { lat: 37.422, lng: -122.084 },
      },
    });
    expect(res.status()).toBe(201);
    const drive = (await res.json()).drive;
    driveId = drive._id;
    expect(drive.coordinates.lat).toBe(37.422);
    expect(drive.coordinates.lng).toBe(-122.084);
  });

  test('create drive with out-of-range latitude → 400', async ({ request }) => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        clubId,
        name: 'Invalid Coords Drive',
        date: futureDate,
        time: '10:00 AM',
        location: 'Test Lot',
        coordinates: { lat: 200, lng: -122.084 },
      },
    });
    expect(res.status()).toBe(400);
  });

  test('create drive without coordinates → legacy path, no coordinates saved', async ({ request }) => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Legacy Drive', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(res.status()).toBe(201);
    const drive = (await res.json()).drive;
    expect(drive.coordinates).toBeFalsy();
  });

  test('update drive with new coordinates → coordinates updated', async ({ request }) => {
    const res = await request.put(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { coordinates: { lat: 40.7128, lng: -74.006 } },
    });
    expect(res.status()).toBe(200);
    const drive = (await res.json()).drive;
    expect(drive.coordinates.lat).toBe(40.7128);
    expect(drive.coordinates.lng).toBe(-74.006);
  });

  test('update drive with out-of-range longitude → 400', async ({ request }) => {
    const res = await request.put(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { coordinates: { lat: 40.7128, lng: -200 } },
    });
    expect(res.status()).toBe(400);
  });

  test('update drive clearing coordinates with null → coordinates removed', async ({ request }) => {
    const res = await request.put(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { coordinates: null },
    });
    expect(res.status()).toBe(200);
    const drive = (await res.json()).drive;
    expect(drive.coordinates).toBeFalsy();
  });
});

test.describe('Drive meeting-point map (UC-23) — UI', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('member sees map preview + Get Directions link when a drive has coordinates', async ({ page, request }) => {
    const suffix = Date.now();
    const leader = { username: `mapui_l_${suffix}`, email: `mapui_l_${suffix}@mail.com`, password: 'LeaderPass1!' };
    const member = { username: `mapui_m_${suffix}`, email: `mapui_m_${suffix}@mail.com`, password: 'MemberPass1!' };

    const leaderReg = await request.post(`${API}/auth/register`, { data: leader });
    const leaderToken = (await leaderReg.json()).token;
    const memberReg = await request.post(`${API}/auth/register`, { data: member });
    const memberToken = (await memberReg.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Map UI Club ${suffix}`, description: 'UC-23 UI test', isPrivate: false },
    });
    const clubId = (await clubRes.json()).club._id;
    await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${memberToken}` } });

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const driveRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        clubId,
        name: 'Map Preview Drive',
        date: futureDate,
        time: '10:00 AM',
        location: 'Pinned Lot',
        coordinates: { lat: 37.422, lng: -122.084 },
      },
    });
    const driveWithMap = (await driveRes.json()).drive;

    const legacyRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'No Pin Drive', date: futureDate, time: '11:00 AM', location: 'Unpinned Lot' },
    });
    const legacyDrive = (await legacyRes.json()).drive;

    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(member.username);
    await page.getByPlaceholder('Password').fill(member.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/club/${clubId}`);

    // Drive with coordinates: map preview + working directions link
    await page.getByText(driveWithMap.name, { exact: false }).first().click();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
    const directionsLink = page.getByRole('link', { name: /Get Directions/i });
    await expect(directionsLink).toBeVisible();
    await expect(directionsLink).toHaveAttribute('href', /maps\/dir\/\?api=1&destination=37\.422,-122\.084/);
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // Legacy drive: no map preview, no directions link, plain text location still shown
    await page.getByText(legacyDrive.name, { exact: false }).first().click();
    await expect(page.getByText('Unpinned Lot', { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.leaflet-container')).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Get Directions/i })).not.toBeVisible();
  });

  test('leader sees the draggable pin picker after selecting a location suggestion', async ({ page, request }) => {
    const suffix = Date.now();
    const leader = { username: `mappick_${suffix}`, email: `mappick_${suffix}@mail.com`, password: 'LeaderPass1!' };
    const leaderReg = await request.post(`${API}/auth/register`, { data: leader });
    const leaderToken = (await leaderReg.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Picker Club ${suffix}`, description: 'UC-23 picker UI test', isPrivate: false },
    });
    const clubId = (await clubRes.json()).club._id;

    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(leader.username);
    await page.getByPlaceholder('Password').fill(leader.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByRole('button', { name: /Schedule a Drive/i }).first().click();
    await page.getByPlaceholder(/e.g\.,? .*drive name/i).first().fill('Pin Picker Drive').catch(() => {});

    await page.getByPlaceholder(/Search city or region|Search city in/i).fill('San Francisco');
    await expect(page.getByRole('button', { name: /San Francisco/i }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /San Francisco/i }).first().click();

    await expect(page.getByText(/Drag the pin to fine-tune/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.leaflet-marker-icon')).toBeVisible({ timeout: 10_000 });
  });
});
