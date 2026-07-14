import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURE_PATH = path.resolve(process.cwd(), 'tests/e2e/fixtures-avatar-test.png');

// ─── THROWAWAY SCRIPT — verifying avatar upload propagates to club member list ───
// Not part of the regular suite. Safe to delete after screenshots are captured.

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

test.describe('Avatar propagation to club member list', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('member avatar appears in club Members panel after profile upload', async ({ page, request }) => {
    const suffix = Date.now();
    const member = { username: `avatarshot_${suffix}`, email: `avatarshot_${suffix}@mail.com`, password: 'AvatarPass1!' };

    const reg = await request.post(`${API}/auth/register`, { data: member });
    expect(reg.status()).toBe(201);
    const token = (await reg.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `Avatar Test Club ${suffix}`,
        description: 'Club created to verify avatar propagation',
        isPrivate: false,
      },
    });
    expect(clubRes.status()).toBe(201);
    const clubId = (await clubRes.json()).club._id;

    // Log in via the UI
    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(member.username);
    await page.getByPlaceholder('Password').fill(member.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    // BEFORE — open club, view Members panel, no avatar uploaded yet
    // Note: the Drives "View All (N)" button includes a count in its accessible
    // name, so it never matches this exact-text locator — only the Members
    // panel's "View All" button does, making .first() unambiguous.
    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByRole('button', { name: 'View All', exact: true }).first().click();
    await expect(page.getByText(member.username, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/avatar-before-members-panel.png' });

    // Upload an avatar on the Profile page
    await page.goto(`${FRONTEND}/profile`);
    await expect(page.getByText('My Profile', { exact: false })).toBeVisible({ timeout: 10_000 });
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);
    await page.screenshot({ path: 'tests/e2e/screenshots/avatar-profile-preview.png' });
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await expect(page.getByText(/Profile updated successfully/i)).toBeVisible({ timeout: 10_000 });

    // AFTER — back to the club Members panel, expect the photo (an <img>) to render
    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByRole('button', { name: 'View All', exact: true }).first().click();
    await expect(page.getByText(member.username, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/avatar-after-members-panel.png' });

    // Assert an actual <img> avatar (not the initials fallback) is present in the members list
    const memberAvatarImg = page.locator('img[alt="' + member.username + '"]');
    await expect(memberAvatarImg.first()).toBeVisible({ timeout: 10_000 });
    expect(await memberAvatarImg.count()).toBeGreaterThan(0);

    // Cross-check directly against the API response that avatar is now populated on members
    const clubFetch = await request.get(`${API}/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const clubJson = await clubFetch.json();
    const selfMember = clubJson.club.members.find((m: any) => m.username === member.username);
    expect(selfMember.avatar).toBeTruthy();
  });
});
