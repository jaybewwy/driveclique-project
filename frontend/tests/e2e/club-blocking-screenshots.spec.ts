import { test, expect } from '@playwright/test';

// User-blocks-club — screenshot verification, kept for re-use per this
// project's `checkin-screenshots.spec.ts` precedent. State seeded via direct
// API calls (same reasoning as uc32-screenshots.spec.ts — resilient to this
// session's own environment slowness); browser used only for the final
// interaction/screenshot steps.

const API = 'http://localhost:5000/api';
const suffix = Date.now();

test('club-blocking screenshots', async ({ request, browser }) => {
  test.setTimeout(60000);

  const user = { username: `cblockshot_${suffix}`, email: `cblockshot_${suffix}@mail.com`, password: 'CBlockShot1!' };
  const leader = { username: `cblockshotldr_${suffix}`, email: `cblockshotldr_${suffix}@mail.com`, password: 'CBlockShot1!' };

  const userRes = await request.post(`${API}/auth/register`, { data: user });
  const userToken = (await userRes.json()).token;
  const leaderRes = await request.post(`${API}/auth/register`, { data: leader });
  const leaderToken = (await leaderRes.json()).token;

  const clubName = `Blockable Club ${suffix}`;
  const clubRes = await request.post(`${API}/clubs`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
    data: { name: clubName, description: 'Screenshot verification club for the block-a-club feature.', isPrivate: false },
  });
  const club = (await clubRes.json()).club;

  const page = await (await browser.newContext()).newPage();

  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder(/username/i).fill(user.username);
  await page.getByPlaceholder(/password/i).fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });

  // --- FindClub card: Block icon next to Report ---
  await page.goto('http://localhost:5173/find-club');
  await page.getByRole('textbox').first().fill(clubName);
  await expect(page.getByText(clubName, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/club-block-findclub-card.png' });

  // --- Block the club from the card, confirm it disappears + success banner ---
  await page.getByTitle('Block club').first().click();
  await expect(page.getByText(/Club blocked/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(clubName, { exact: false })).toHaveCount(0);
  await page.screenshot({ path: 'tests/e2e/screenshots/club-block-findclub-blocked-confirmation.png' });

  // --- Blocked Clubs panel ---
  await page.getByRole('button', { name: /Blocked Clubs/i }).click();
  await expect(page.getByRole('heading', { name: 'Blocked Clubs' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(clubName, { exact: false })).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/club-block-blocked-clubs-panel.png' });

  // Unblock via the panel so we can reach ClubDetail's non-member view next
  await page.getByRole('button', { name: /^Unblock$/ }).click();
  await expect(page.getByText(/haven't blocked any clubs/i)).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  // --- ClubDetail page: "Block this club" for a non-member ---
  await page.goto(`http://localhost:5173/club/${club._id}`);
  await expect(page.getByRole('button', { name: /Join Club/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: /Block this club/i })).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/club-block-clubdetail-block-button.png' });

  await page.getByRole('button', { name: /Block this club/i }).click();
  await expect(page.getByRole('button', { name: /Unblock Club/i })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/club-block-clubdetail-blocked-state.png' });
});
