import { test, expect } from '@playwright/test';

// Screenshot script for UC-22 (Member Public Profile View), kept for re-use
// per the checkin-screenshots.spec.ts precedent. Setup goes through the API;
// the leader's session is established through the real login UI.

const API = 'http://localhost:5000/api';
const baseUrl = 'http://localhost:5173';

test('UC-22: clicking a member opens their public profile panel with a Remove from Club action', async ({ page, request }) => {
  const suffix = Date.now();
  const leader = { username: `mpshotldr_${suffix}`, email: `mpshotldr_${suffix}@mail.com`, password: 'LeaderPass1!' };
  const member = { username: `mpshotmem_${suffix}`, email: `mpshotmem_${suffix}@mail.com`, password: 'MemberPass1!' };

  const leaderRes = await request.post(`${API}/auth/register`, { data: leader });
  const leaderToken = (await leaderRes.json()).token;
  const memberRes = await request.post(`${API}/auth/register`, { data: member });
  const memberToken = (await memberRes.json()).token;

  await request.put(`${API}/auth/profile`, {
    headers: { Authorization: `Bearer ${memberToken}` },
    data: { bio: 'JDM enthusiast, weekend canyon runs.', location: 'Los Angeles, California, United States' },
  });

  const clubRes = await request.post(`${API}/clubs`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
    data: { name: `UC22 Screenshots Club ${suffix}`, description: 'UC-22 screenshot verification', isPrivate: false },
  });
  const clubId = (await clubRes.json()).club._id;
  await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${memberToken}` } });

  await page.goto(`${baseUrl}/login`);
  await page.getByPlaceholder('Username').fill(leader.username);
  await page.getByPlaceholder('Password').fill(leader.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page).toHaveURL(new RegExp(`${baseUrl}/dashboard`));

  await page.goto(`${baseUrl}/club/${clubId}`);
  await expect(page.getByRole('heading', { name: /UC22 Screenshots Club/ })).toBeVisible({ timeout: 10000 });

  // Open the full Members list, then click the member's name
  await page.getByRole('button', { name: 'View All', exact: true }).click();
  await expect(page.getByRole('heading', { name: /All Members/i })).toBeVisible({ timeout: 5000 });
  await page.getByRole('dialog', { name: /All Members/i }).getByText(`@${member.username}`).click();

  const profileDialog = page.locator('[aria-labelledby="modal-title"]');
  await expect(profileDialog.getByRole('heading', { name: 'Member Profile', exact: true })).toBeVisible({ timeout: 5000 });
  await expect(profileDialog.getByText('JDM enthusiast, weekend canyon runs.')).toBeVisible();
  await expect(profileDialog.getByRole('button', { name: 'Remove from Club', exact: true })).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/screenshots/uc22-member-profile-panel.png' });
});
