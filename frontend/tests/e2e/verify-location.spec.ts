import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:5000';

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

  // ── TEST 1: Create Club page has LocationSearch ───────────────────────────
  test('Create Club: LocationSearch renders and autocompletes', async ({ page }) => {
    await loginUI(page);
    await page.goto(`${BASE}/create-club`);

    // The LocationSearch input placeholder is "Search city or region..."
    const locInput = page.getByPlaceholder(/search city/i);
    await expect(locInput).toBeVisible();

    // Type and wait for Nominatim
    await locInput.fill('Toronto');
    const suggestion = page.locator('ul li button').first();
    await expect(suggestion).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: '/tmp/loc1-dropdown.png' });

    await suggestion.click();
    const val = await locInput.inputValue();
    expect(val.toLowerCase()).toContain('toronto');

    await page.screenshot({ path: '/tmp/loc1-selected.png' });
  });

  // ── TEST 2: Create club with autocomplete value — verify DB storage ───────
  test('Create Club: location from autocomplete is saved to DB', async ({ page }) => {
    await loginUI(page);
    await page.goto(`${BASE}/create-club`);

    await page.getByPlaceholder(/Southern California|club name/i).fill(`LocTest_${SUFFIX}`);
    await page.getByPlaceholder(/makes your club unique/i)
              .fill('Verifying location autocomplete saves correctly to DB');

    const locInput = page.getByPlaceholder(/search city/i);
    await locInput.fill('Vancouver');
    const suggestion = page.locator('ul li button').first();
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    const suggestionText = (await suggestion.textContent()) || '';
    await suggestion.click();

    await page.getByRole('button', { name: /create club/i }).click();
    await page.waitForURL(/\/club\//, { timeout: 15000 });
    clubId = page.url().split('/club/')[1];

    // Location is visible on club detail page
    await expect(page.getByText(/vancouver/i)).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: '/tmp/loc2-club-page.png' });

    // Confirm via API
    const apiRes = await page.request.get(`${API}/api/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await apiRes.json();
    expect(body.success).toBe(true);
    expect(body.club.location.toLowerCase()).toContain('vancouver');
  });

  // ── TEST 3: Club Detail edit panel has LocationSearch, saves new value ────
  test('Club Detail edit: LocationSearch pre-fills and saves new location to DB', async ({ page }) => {
    await loginUI(page);
    await page.goto(`${BASE}/club/${clubId}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for club page content to load (heading is unique)
    await expect(page.getByRole('heading', { name: /LocTest_/ })).toBeVisible({ timeout: 10000 });

    // Open the Manage Club / edit panel
    const manageBtn = page.getByRole('button', { name: /manage club/i });
    await expect(manageBtn).toBeVisible({ timeout: 8000 });
    await manageBtn.click();

    // LocationSearch input should be in the edit form, pre-filled with 'Vancouver'
    const locInput = page.getByPlaceholder(/search city/i).first();
    await expect(locInput).toBeVisible({ timeout: 6000 });
    const prefilled = await locInput.inputValue();
    expect(prefilled.toLowerCase()).toContain('vancouver');

    await page.screenshot({ path: '/tmp/loc3-edit-prefilled.png' });

    // Change to Montreal via autocomplete
    await locInput.clear();
    await locInput.fill('Montreal');
    const suggestion = page.locator('ul li button').first();
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await suggestion.click();
    const newLoc = await locInput.inputValue();
    expect(newLoc.toLowerCase()).toContain('montreal');

    await page.screenshot({ path: '/tmp/loc3-edit-new-val.png' });

    // Save
    const saveBtn = page.getByRole('button', { name: /save changes/i });
    await saveBtn.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: '/tmp/loc3-after-save.png' });

    // Confirm via API
    const apiRes = await page.request.get(`${API}/api/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await apiRes.json();
    expect(body.club.location.toLowerCase()).toContain('montreal');
  });
});
