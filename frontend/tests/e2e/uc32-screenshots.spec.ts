import { test, expect } from '@playwright/test';

// UC-32 — screenshot verification, kept for re-use per this project's
// `checkin-screenshots.spec.ts` precedent. State is seeded via direct API
// calls (fast, already proven reliable by the 55 passing API-level tests
// across authorization-negative-paths/member-profile/member-blocking-ban)
// rather than driving the full UI flow, to stay resilient to this session's
// unrelated environment slowness — only the final screenshot steps use the
// browser.

const API = 'http://localhost:5000/api';
const suffix = Date.now();

test('UC-32 screenshots', async ({ request, browser }) => {
  test.setTimeout(60000);

  const leader = { username: `uc32shot_leader_${suffix}`, email: `uc32shot_leader_${suffix}@mail.com`, password: 'Uc32Pass1!' };
  const member = { username: `uc32shot_member_${suffix}`, email: `uc32shot_member_${suffix}@mail.com`, password: 'Uc32Pass1!' };

  const leaderRes = await request.post(`${API}/auth/register`, { data: leader });
  const leaderToken = (await leaderRes.json()).token;
  const memberRes = await request.post(`${API}/auth/register`, { data: member });
  const memberToken = (await memberRes.json()).token;

  const clubRes = await request.post(`${API}/clubs`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
    data: { name: `UC32 Screenshot Club ${suffix}`, description: 'Screenshot verification club for UC-32.', isPrivate: false },
  });
  const club = (await clubRes.json()).club;

  await request.post(`${API}/clubs/${club._id}/join`, { headers: { Authorization: `Bearer ${memberToken}` } });

  const page = await (await browser.newContext()).newPage();

  // Log in the leader via the UI (needed so localStorage has a real token for the SPA)
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder(/username/i).fill(leader.username);
  await page.getByPlaceholder(/password/i).fill(leader.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });

  await page.goto('http://localhost:5173/my-clubs');
  await page.getByRole('button', { name: /View Club/i }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`UC32 Screenshot Club ${suffix}`) })).toBeVisible({ timeout: 15000 });

  // Open the member's profile panel (Block button visible)
  const viewAllBtn = page.getByRole('button', { name: 'View All', exact: true });
  await viewAllBtn.click();
  await expect(page.getByText(member.username, { exact: false }).first()).toBeVisible({ timeout: 15000 });
  await page.getByText(member.username, { exact: false }).first().click();
  await expect(page.getByRole('button', { name: /^Block User$/ })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/uc32-member-profile-block-button.png' });

  // Open the Remove-member confirmation and check "Also ban"
  await page.getByRole('button', { name: 'Remove from Club', exact: true }).click();
  await expect(page.getByText(/Also ban this user/i)).toBeVisible({ timeout: 5000 });
  await page.getByLabel(/Also ban this user/i).check();
  await page.screenshot({ path: 'tests/e2e/screenshots/uc32-remove-member-ban-checkbox.png' });
  await page.getByRole('button', { name: /^Remove$/i }).click();
  await page.waitForTimeout(1000);

  // Banned Members panel
  await page.getByRole('button', { name: /banned members/i }).click();
  await expect(page.getByRole('heading', { name: 'Banned Members' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(member.username, { exact: false }).first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/uc32-banned-members-panel.png' });
});
