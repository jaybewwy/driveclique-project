import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-46 — Proximity-based club/drive search ───────────────────────────────
// API: radius-filtered, nearest-first club browse with distances; nearby
// upcoming drives restricted to public clubs + the viewer's own; validation;
// the club search point following edits to its location. UI: Find Clubs'
// "Use my location" / city picker, and a club created with a picked location
// becoming findable.
//
// Every run searches around its own random point in the open South Pacific,
// so clubs from earlier runs (or real data) never fall inside the radius and
// the counts below are exact. Nominatim and ipapi.co are mocked, so none of
// this depends on live geocoding (unlike map-screenshots.spec.ts).

const MILES_PER_DEGREE_LAT = 69.09;
const runId = Date.now();
const center = { lat: -40 + Math.random() * 10, lng: -140 + Math.random() * 20 };
const milesNorth = (miles: number) => ({ lat: center.lat + miles / MILES_PER_DEGREE_LAT, lng: center.lng });
// Unique per run: an earlier run's UI-created club is saved with this label as
// its location, and its card would otherwise also match the suggestion locator
const PICKED_CITY = `Testville ${runId}`;
const PICKED_LABEL = `${PICKED_CITY}, Pacific, Oceania`;

async function mockGeocoding(page: Page) {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  await page.route('https://ipapi.co/**', (route) => route.fulfill({ headers: cors, json: { country_code: '' } }));
  await page.route('https://nominatim.openstreetmap.org/**', (route) => route.fulfill({
    headers: cors,
    json: [{
      lat: String(center.lat),
      lon: String(center.lng),
      name: PICKED_CITY,
      address: { city: PICKED_CITY, state: 'Pacific', country: 'Oceania' },
    }],
  }));
}

// The location autocomplete's dropdown option, never a club card that happens to mention the label
const suggestion = (page: Page) => page.getByRole('listitem').getByRole('button', { name: PICKED_LABEL, exact: true });

async function login(page: Page, user: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

test.describe('Proximity search (UC-46)', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ geolocation: { latitude: center.lat, longitude: center.lng }, permissions: ['geolocation'] });

  const suffix = runId;
  const leader = { username: `proxlead_${suffix}`, email: `proxlead_${suffix}@mail.com`, password: 'ProxPass1!' };
  const outsider = { username: `proxout_${suffix}`, email: `proxout_${suffix}@mail.com`, password: 'ProxPass1!' };
  const nearClubName = `Proximity Near Club ${suffix}`;
  const farClubName = `Proximity Far Club ${suffix}`;
  const nearDriveName = `Harbor Run ${suffix}`;
  const privateDriveName = `Members Only Run ${suffix}`;
  const cancelledDriveName = `Called Off Run ${suffix}`;
  const unpinnedDriveName = `No Pin Run ${suffix}`;

  let leaderToken = '';
  let outsiderToken = '';
  let nearClubId = '';
  let farClubId = '';
  let privateClubId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const nearParams = (radius: number) => `lat=${center.lat}&lng=${center.lng}&radius=${radius}`;

  test('setup: two users; near, far, private, and unpinned clubs; drives around the center', async ({ request }) => {
    const l = await request.post(`${API}/auth/register`, { data: leader });
    expect(l.status()).toBe(201);
    leaderToken = (await l.json()).token;
    const o = await request.post(`${API}/auth/register`, { data: outsider });
    expect(o.status()).toBe(201);
    outsiderToken = (await o.json()).token;

    const createClub = async (data: Record<string, unknown>) => {
      const res = await request.post(`${API}/clubs`, { headers: auth(leaderToken), data });
      expect(res.status()).toBe(201);
      return (await res.json()).club;
    };
    const nearClub = await createClub({
      name: nearClubName, description: 'UC-46 club five miles north of center', location: 'Near Harbor',
      coordinates: milesNorth(5), tags: ['Track'],
    });
    nearClubId = nearClub._id;
    expect(nearClub.geo.coordinates).toEqual([milesNorth(5).lng, milesNorth(5).lat]);
    farClubId = (await createClub({
      name: farClubName, description: 'UC-46 club forty miles north of center', location: 'Far Harbor',
      coordinates: milesNorth(40),
    }))._id;
    privateClubId = (await createClub({
      name: `Proximity Private Club ${suffix}`, description: 'UC-46 private club two miles out', location: 'Hidden Cove',
      coordinates: milesNorth(2), isPrivate: true,
    }))._id;
    const unpinned = await createClub({
      name: `Proximity Unpinned Club ${suffix}`, description: 'UC-46 club with coordinates but no place name',
      coordinates: milesNorth(1),
    });
    // A point without a place name to explain it is dropped
    expect(unpinned.geo).toBeUndefined();

    const createDrive = async (data: Record<string, unknown>) => {
      const res = await request.post(`${API}/drives`, {
        headers: auth(leaderToken),
        data: { time: '09:00 AM', location: 'Meet at the pier', ...data },
      });
      expect(res.status()).toBe(201);
      return (await res.json()).drive;
    };
    await createDrive({ clubId: nearClubId, name: nearDriveName, date: inDays(10), coordinates: milesNorth(4) });
    await createDrive({ clubId: privateClubId, name: privateDriveName, date: inDays(5), coordinates: milesNorth(2) });
    await createDrive({ clubId: farClubId, name: `Far Run ${suffix}`, date: inDays(6), coordinates: milesNorth(40) });
    await createDrive({ clubId: nearClubId, name: unpinnedDriveName, date: inDays(7) });
    const cancelled = await createDrive({ clubId: nearClubId, name: cancelledDriveName, date: inDays(8), coordinates: milesNorth(3) });
    const cancelRes = await request.post(`${API}/drives/${cancelled._id}/cancel`, {
      headers: auth(leaderToken),
      data: { cancellationReason: 'Weather looks bad for the UC-46 test' },
    });
    expect(cancelRes.status()).toBe(200);
  });

  test('club browse within 25 mi returns only the near public club, with its distance', async ({ request }) => {
    const res = await request.get(`${API}/clubs/browse?${nearParams(25)}`, { headers: auth(outsiderToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.clubs.map((c: { name: string }) => c.name)).toEqual([nearClubName]);
    expect(body.pagination.total).toBe(1);
    expect(body.clubs[0].distanceMiles).toBeGreaterThan(4.8);
    expect(body.clubs[0].distanceMiles).toBeLessThan(5.2);
    expect(body.clubs[0].leader.username).toBe(leader.username);
  });

  test('a wider radius adds the far club, nearest first', async ({ request }) => {
    const res = await request.get(`${API}/clubs/browse?${nearParams(50)}`, { headers: auth(outsiderToken) });
    const body = await res.json();
    expect(body.clubs.map((c: { name: string }) => c.name)).toEqual([nearClubName, farClubName]);
  });

  test('text and tag filters still apply inside a proximity search', async ({ request }) => {
    const byText = await request.get(`${API}/clubs/browse?${nearParams(50)}&query=${encodeURIComponent('Far Club')}`, { headers: auth(outsiderToken) });
    expect((await byText.json()).clubs.map((c: { name: string }) => c.name)).toEqual([farClubName]);
    const byTag = await request.get(`${API}/clubs/browse?${nearParams(50)}&tags=Track`, { headers: auth(outsiderToken) });
    expect((await byTag.json()).clubs.map((c: { name: string }) => c.name)).toEqual([nearClubName]);
  });

  test('nearby drives: a non-member sees only the public, pinned, upcoming drive in range', async ({ request }) => {
    const res = await request.get(`${API}/drives/nearby?${nearParams(25)}`, { headers: auth(outsiderToken) });
    expect(res.status()).toBe(200);
    const { drives } = await res.json();
    expect(drives.map((d: { name: string }) => d.name)).toEqual([nearDriveName]);
    expect(drives[0].club).toEqual({ _id: nearClubId, name: nearClubName });
    expect(drives[0].distanceMiles).toBeGreaterThan(3.8);
    expect(drives[0].distanceMiles).toBeLessThan(4.2);
  });

  test('nearby drives: a member of the private club also sees its drive, soonest first', async ({ request }) => {
    const res = await request.get(`${API}/drives/nearby?${nearParams(25)}`, { headers: auth(leaderToken) });
    const { drives } = await res.json();
    expect(drives.map((d: { name: string }) => d.name)).toEqual([privateDriveName, nearDriveName]);
  });

  test('nearby drives skip clubs the viewer has blocked', async ({ request }) => {
    const block = await request.post(`${API}/clubs/${nearClubId}/block`, { headers: auth(outsiderToken) });
    expect(block.status()).toBe(200);
    const drivesRes = await request.get(`${API}/drives/nearby?${nearParams(25)}`, { headers: auth(outsiderToken) });
    expect((await drivesRes.json()).drives).toEqual([]);
    const clubsRes = await request.get(`${API}/clubs/browse?${nearParams(25)}`, { headers: auth(outsiderToken) });
    expect((await clubsRes.json()).clubs).toEqual([]);

    const unblock = await request.delete(`${API}/clubs/${nearClubId}/block`, { headers: auth(outsiderToken) });
    expect(unblock.status()).toBe(200);
  });

  test('bad proximity input is rejected', async ({ request }) => {
    const headers = auth(outsiderToken);
    expect((await request.get(`${API}/clubs/browse?lat=${center.lat}`, { headers })).status()).toBe(400);
    expect((await request.get(`${API}/clubs/browse?${nearParams(1000)}`, { headers })).status()).toBe(400);
    expect((await request.get(`${API}/clubs/browse?lat=abc&lng=1`, { headers })).status()).toBe(400);
    expect((await request.get(`${API}/clubs/browse?lat=91&lng=1`, { headers })).status()).toBe(400);
    expect((await request.get(`${API}/drives/nearby?lng=${center.lng}`, { headers })).status()).toBe(400);
    expect((await request.get(`${API}/drives/nearby?lat[$gt]=0&lng=1`, { headers })).status()).toBe(400);

    const badCoords = await request.put(`${API}/clubs/${farClubId}`, {
      headers: auth(leaderToken),
      data: { location: 'Far Harbor', coordinates: { lat: 200, lng: 0 } },
    });
    expect(badCoords.status()).toBe(400);
  });

  test("a club's search point follows edits to its location", async ({ request }) => {
    const findFar = async () => {
      const res = await request.get(`${API}/clubs/browse?${nearParams(50)}&query=${encodeURIComponent(farClubName)}`, { headers: auth(outsiderToken) });
      return (await res.json()).clubs.length;
    };
    const update = (data: Record<string, unknown>) =>
      request.put(`${API}/clubs/${farClubId}`, { headers: auth(leaderToken), data });

    // Retyping the location without new coordinates (e.g. the mobile client) drops the stale point
    expect((await update({ location: 'Somewhere Else' })).status()).toBe(200);
    expect(await findFar()).toBe(0);

    expect((await update({ location: 'Far Harbor', coordinates: milesNorth(40) })).status()).toBe(200);
    expect(await findFar()).toBe(1);

    // Editing another field leaves the point alone
    expect((await update({ description: 'Updated description, same location' })).status()).toBe(200);
    expect(await findFar()).toBe(1);

    // Explicit null clears it
    expect((await update({ location: 'Far Harbor', coordinates: null })).status()).toBe(200);
    expect(await findFar()).toBe(0);

    expect((await update({ location: 'Far Harbor', coordinates: milesNorth(40) })).status()).toBe(200);
  });

  test('Find Clubs: "Use my location" shows nearby clubs with distances, and nearby drives', async ({ page }) => {
    await mockGeocoding(page);
    await login(page, outsider);
    await page.goto('/find-club');

    await page.getByRole('button', { name: /Use my location/i }).click();
    await expect(page.getByText(/Clubs within 25 mi of your location/i)).toBeVisible();

    const nearCard = page.locator('div[role="button"]', { hasText: nearClubName });
    await expect(nearCard).toBeVisible();
    await expect(nearCard.getByText(/\d+(\.\d)? mi away/)).toBeVisible();
    // Scoped to the results column — the Popular sidebar is a separate, unfiltered list
    await expect(page.locator('#main-content').getByText(farClubName)).not.toBeVisible();

    const drives = page.getByRole('region', { name: /Upcoming drives within 25 mi/i });
    await expect(drives.getByText(nearDriveName)).toBeVisible();
    await expect(drives.getByText(privateDriveName)).not.toBeVisible();
    await expect(drives.getByText(cancelledDriveName)).not.toBeVisible();
    await expect(drives.getByText(unpinnedDriveName)).not.toBeVisible();

    await page.getByLabel('Search radius').selectOption('50');
    const cards = page.locator('div[role="button"]', { hasText: new RegExp(`Proximity (Near|Far) Club ${suffix}`) });
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText(nearClubName);
    await expect(cards.nth(1)).toContainText(farClubName);

    await page.getByRole('button', { name: /Clear distance filter/i }).click();
    await expect(page.getByRole('region', { name: /Upcoming drives within/i })).not.toBeVisible();
  });

  test('Find Clubs: picking a city from the suggestions searches around it', async ({ page }) => {
    await mockGeocoding(page);
    await login(page, outsider);
    await page.goto('/find-club');

    await page.locator('#find-club-near').fill('Testv');
    await suggestion(page).click();
    await expect(page.getByText(`Clubs within 25 mi of ${PICKED_LABEL}`)).toBeVisible();
    await expect(page.locator('div[role="button"]', { hasText: nearClubName })).toBeVisible();
  });

  test('Create Club: picking a location suggestion pins the club for nearby search', async ({ page, request }) => {
    await mockGeocoding(page);
    await login(page, leader);
    await page.goto('/create-club');

    const name = `Proximity UI Club ${suffix}`;
    await page.locator('#create-club-name').fill(name);
    await page.locator('#create-club-description').fill('Created through the UI for the UC-46 test');
    await expect(page.getByText(/Pick a suggestion so your club shows up/i)).toBeVisible();
    await page.locator('#create-club-location').fill('Testv');
    await suggestion(page).click();
    await expect(page.getByText(/Pinned\. Your club will show up in nearby searches/i)).toBeVisible();
    await page.getByRole('button', { name: 'Create Club' }).click();
    await expect(page).toHaveURL(/\/club\/[0-9a-f]{24}/, { timeout: 15_000 });

    const res = await request.get(`${API}/clubs/browse?${nearParams(10)}&query=${encodeURIComponent(name)}`, { headers: auth(outsiderToken) });
    const { clubs } = await res.json();
    expect(clubs).toHaveLength(1);
    // The picked label must be what's saved — not the half-typed "Testv"
    expect(clubs[0].location).toBe(PICKED_LABEL);
    expect(clubs[0].distanceMiles).toBeLessThan(0.1);
  });

  test('Edit Drive: picking a location suggestion saves the picked label, not the typed text', async ({ page, request }) => {
    const driveName = `Edit Location Run ${suffix}`;
    const createRes = await request.post(`${API}/drives`, {
      headers: auth(leaderToken),
      data: { clubId: farClubId, name: driveName, date: inDays(12), time: '10:00 AM', location: 'Old Lot' },
    });
    expect(createRes.status()).toBe(201);
    const driveId = (await createRes.json()).drive._id;

    await mockGeocoding(page);
    await login(page, leader);
    await page.goto(`/club/${farClubId}`);
    await expect(page.getByText(driveName).first()).toBeVisible({ timeout: 15_000 });

    // The drive row's ⋮ menu has no accessible name; this row's is the one beside the drive
    const row = page.locator('div', { has: page.getByText(driveName, { exact: true }) })
      .filter({ has: page.locator('button svg[class*="vertical"]') }).last();
    await row.locator('button:has(svg[class*="vertical"])').click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();

    await page.locator('#edit-drive-location').fill('Testv');
    await suggestion(page).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Drive' })).not.toBeVisible();

    const drivesRes = await request.get(`${API}/drives/club/${farClubId}`, { headers: auth(leaderToken) });
    const saved = (await drivesRes.json()).drives.find((d: { _id: string }) => d._id === driveId);
    expect(saved.location).toBe(PICKED_LABEL);
    expect(saved.coordinates.lat).toBeCloseTo(center.lat, 5);
  });
});
