import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:5000';

// ─── Geocoding is mocked ─────────────────────────────────────────────────────
// LocationSearch asks ipapi.co for the visitor's country, then Nominatim for
// places in it. Against the live services this spec failed CI twice: once
// Nominatim never answered, and once ipapi said "US", so "Montreal" came back
// as a hamlet in Missouri. The fakes answer for three Canadian cities in
// Nominatim's format, so the suggestions, and the coordinates saved with the
// club, are exact.

type Place = { lat: string; lon: string; name: string; address: { city: string; state: string; country: string } };

const place = (city: string, state: string, lat: string, lon: string): Place =>
  ({ lat, lon, name: city, address: { city, state, country: 'Canada' } });

const PLACES: Record<string, Place> = {
  toronto:   place('Toronto',   'Ontario',          '43.6534817', '-79.3839347'),
  vancouver: place('Vancouver', 'British Columbia', '49.2608724', '-123.1139529'),
  montreal:  place('Montreal',  'Quebec',           '45.5031824', '-73.5698065'),
};

// The text LocationSearch shows for a result: city, state, country
const labelOf = (p: Place) => `${p.address.city}, ${p.address.state}, ${p.address.country}`;
// GeoJSON order, as the club's `geo` point stores it
const pointOf = (p: Place) => [Number(p.lon), Number(p.lat)];

// Returns the query string of every Nominatim search the page sends
async function mockGeocoding(page: Page) {
  const searches: URLSearchParams[] = [];
  const cors = { 'Access-Control-Allow-Origin': '*' };
  await page.route('https://ipapi.co/**', (route) => route.fulfill({ headers: cors, json: { country_code: 'CA' } }));
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    searches.push(params);
    const match = PLACES[(params.get('q') || '').trim().toLowerCase()];
    return route.fulfill({ headers: cors, json: match ? [match] : [] });
  });
  return searches;
}

// The dropdown option, never a club card that mentions the same place
const suggestion = (page: Page, p: Place) =>
  page.getByRole('listitem').getByRole('button', { name: labelOf(p), exact: true });

test.describe.serial('LocationSearch on club pages', () => {
  const SUFFIX   = Date.now();
  const USERNAME = `verloctest${SUFFIX}`;
  const EMAIL    = `verloctest${SUFFIX}@mail.com`;
  const PASSWORD = 'Test1234!';
  let token  = '';
  let clubId = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: USERNAME, email: EMAIL, password: PASSWORD },
    });
    const body = await res.json();
    token = body.token;
  });

  async function loginUI(page: any) {
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder(/username/i).fill(USERNAME);
    await page.getByPlaceholder(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });
  }

  async function getClub(page: Page) {
    const apiRes = await page.request.get(`${API}/api/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await apiRes.json();
    expect(body.success).toBe(true);
    return body.club;
  }

  // ── TEST 1: Create Club page has LocationSearch ───────────────────────────
  test('Create Club: LocationSearch renders and autocompletes', async ({ page }) => {
    const searches = await mockGeocoding(page);
    await loginUI(page);
    await page.goto(`${BASE}/create-club`);

    // The placeholder names the country once the country lookup has answered,
    // so the search below is the country-restricted one
    const locInput = page.getByPlaceholder(/search city in canada/i);
    await expect(locInput).toBeVisible();

    await locInput.fill('Toronto');
    await expect(suggestion(page, PLACES.toronto)).toBeVisible();
    expect(searches.at(-1)?.get('q')).toBe('Toronto');
    expect(searches.at(-1)?.get('countrycodes')).toBe('ca');

    await page.screenshot({ path: '/tmp/loc1-dropdown.png' });

    await suggestion(page, PLACES.toronto).click();
    await expect(locInput).toHaveValue(labelOf(PLACES.toronto));

    await page.screenshot({ path: '/tmp/loc1-selected.png' });
  });

  // ── TEST 2: Create club with autocomplete value — verify DB storage ───────
  test('Create Club: location from autocomplete is saved to DB', async ({ page }) => {
    await mockGeocoding(page);
    await loginUI(page);
    await page.goto(`${BASE}/create-club`);

    await page.getByPlaceholder(/Southern California|club name/i).fill(`LocTest_${SUFFIX}`);
    await page.getByPlaceholder(/makes your club unique/i)
              .fill('Verifying location autocomplete saves correctly to DB');

    const locInput = page.getByPlaceholder(/search city in canada/i);
    await locInput.fill('Vancouver');
    await suggestion(page, PLACES.vancouver).click();

    await page.getByRole('button', { name: /create club/i }).click();
    await page.waitForURL(/\/club\//, { timeout: 15000 });
    clubId = page.url().split('/club/')[1];

    // Location is visible on club detail page
    await expect(page.getByText(/vancouver/i)).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: '/tmp/loc2-club-page.png' });

    // Confirm via API: the picked label, and the picked place's coordinates
    const club = await getClub(page);
    expect(club.location).toBe(labelOf(PLACES.vancouver));
    expect(club.geo?.coordinates).toEqual(pointOf(PLACES.vancouver));
  });

  // ── TEST 3: Club Settings (General) has LocationSearch, saves new value ───
  test('Club Settings: LocationSearch pre-fills and saves new location to DB', async ({ page }) => {
    await mockGeocoding(page);
    await loginUI(page);
    await page.goto(`${BASE}/club/${clubId}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for club page content to load (heading is unique)
    await expect(page.getByRole('heading', { name: /LocTest_/ })).toBeVisible({ timeout: 10000 });

    // Manage Club opens the Club Settings page on its General section
    const manageBtn = page.getByRole('button', { name: /manage club/i });
    await expect(manageBtn).toBeVisible({ timeout: 8000 });
    await manageBtn.click();

    // LocationSearch input should be in the General form, pre-filled with Vancouver
    const locInput = page.getByPlaceholder(/search city in canada/i).first();
    await expect(locInput).toHaveValue(labelOf(PLACES.vancouver), { timeout: 6000 });

    await page.screenshot({ path: '/tmp/loc3-edit-prefilled.png' });

    // Change to Montreal via autocomplete
    await locInput.clear();
    await locInput.fill('Montreal');
    await suggestion(page, PLACES.montreal).click();
    await expect(locInput).toHaveValue(labelOf(PLACES.montreal));

    await page.screenshot({ path: '/tmp/loc3-edit-new-val.png' });

    // Save, then poll the API until the save has landed
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect.poll(async () => (await getClub(page)).location).toBe(labelOf(PLACES.montreal));

    await page.screenshot({ path: '/tmp/loc3-after-save.png' });

    // The search point moved with it
    const club = await getClub(page);
    expect(club.geo?.coordinates).toEqual(pointOf(PLACES.montreal));
  });
});
