import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// The Club Settings page (/club/:clubId/settings/:section), which replaced the
// club page's "Manage Club" modal. One URL per section, all of them the
// leader's; a co-leader gets Reports only (see report-moderation.spec.ts).

const API = 'http://localhost:5000/api';
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

type User = { username: string; email: string; password: string };

let seq = 0;
const newUser = (prefix: string): User => {
  const id = `${Date.now()}${seq++}`;
  return { username: `${prefix}_${id}`, email: `${prefix}_${id}@mail.com`, password: 'SettingsPass1!' };
};

async function register(request: APIRequestContext, user: User) {
  const res = await request.post(`${API}/auth/register`, { data: user });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { token: body.token as string, id: body.user._id as string };
}

async function createClub(request: APIRequestContext, token: string, name: string) {
  const res = await request.post(`${API}/clubs`, {
    headers: auth(token),
    data: { name, description: 'Club settings page test club', isPrivate: false },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).club._id as string;
}

async function getClub(request: APIRequestContext, token: string, clubId: string) {
  const res = await request.get(`${API}/clubs/${clubId}`, { headers: auth(token) });
  expect(res.status()).toBe(200);
  return (await res.json()).club;
}

async function login(page: Page, user: User) {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

// A leader with one public club, signed in
async function leaderWithClub(page: Page, request: APIRequestContext, prefix: string) {
  const leader = newUser(prefix);
  const { token, id } = await register(request, leader);
  const clubName = `Settings Club ${prefix} ${Date.now()}`;
  const clubId = await createClub(request, token, clubName);
  await login(page, leader);
  return { leader, token, leaderId: id, clubName, clubId };
}

const settingsNav = (page: Page) => page.getByRole('navigation', { name: 'Club settings' });
const sectionHeading = (page: Page, name: string) => page.getByRole('heading', { level: 2, name });
// The outcome of the last save, beside the Save Changes button
const saveStatus = (page: Page) => page.locator('#main-content').getByRole('status');

test.describe('Club Settings page', () => {
  test('Manage Club opens the page, and every section has its own URL', async ({ page, request }) => {
    const { clubName, clubId } = await leaderWithClub(page, request, 'csnav');

    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await page.getByRole('button', { name: 'Manage Club' }).click();

    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/general$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Club Settings' })).toBeVisible();
    await expect(sectionHeading(page, 'General')).toBeVisible();
    await expect(settingsNav(page).getByRole('link', { name: 'General' })).toHaveAttribute('aria-current', 'page');
    // It is a page now, not a dialog over the club page
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await settingsNav(page).getByRole('link', { name: 'Privacy' }).click();
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/privacy$`));
    await expect(sectionHeading(page, 'Privacy')).toBeVisible();

    await settingsNav(page).getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/reports$`));
    await expect(page.getByText('No open reports.')).toBeVisible();

    await settingsNav(page).getByRole('link', { name: 'Ownership' }).click();
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/ownership$`));
    await expect(page.getByText('This club has no other members yet.')).toBeVisible();

    await settingsNav(page).getByRole('link', { name: 'Danger Zone' }).click();
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/danger-zone$`));

    // The section is in the URL, so a reload and the Back button both keep their place
    await page.reload();
    await expect(sectionHeading(page, 'Danger Zone')).toBeVisible();
    await page.goBack();
    await expect(sectionHeading(page, 'Ownership')).toBeVisible();

    await page.getByRole('button', { name: 'Back to club' }).click();
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}$`));
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
  });

  test('General: saving stays on the page, and the sidebar and club page show the result', async ({ page, request }) => {
    const { leader, token, clubName, clubId } = await leaderWithClub(page, request, 'csgen');
    const renamed = `${clubName} Renamed`;
    const member = newUser('csgenmem');
    const { token: memberToken } = await register(request, member);
    const joined = await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(memberToken) });
    expect(joined.status()).toBe(200);

    await page.goto(`/club/${clubId}/settings/general`);
    await expect(page.getByLabel('Club Name')).toHaveValue(clubName);
    await page.getByLabel('Club Name').fill(renamed);
    await page.getByLabel('Description').fill('A new description from the settings page');
    await page.getByRole('button', { name: 'Track', exact: true }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(saveStatus(page)).toHaveText('Club details saved.');
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/general$`));
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByText(renamed)).toBeVisible();

    const saved = await getClub(request, token, clubId);
    expect(saved.name).toBe(renamed);
    expect(saved.description).toBe('A new description from the settings page');
    expect(saved.tags).toEqual(['Track']);
    expect(saved.isPrivate).toBe(false);

    // The update response carries no populated leader or members. The old
    // modal put it straight into the club page, which blanked both until a
    // reload; here the other sections and the club page must still have them.
    await settingsNav(page).getByRole('link', { name: 'Ownership' }).click();
    await expect(page.getByRole('button', { name: new RegExp(`@${member.username}`) })).toBeVisible();

    await page.getByRole('button', { name: 'Back to club' }).click();
    await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible();
    const leaderName = page.locator('p', { hasText: /^Leader$/ }).locator('xpath=following-sibling::p[1]');
    await expect(leaderName).toHaveText(leader.username);
    await page.getByRole('button', { name: 'View All', exact: true }).click();
    await expect(page.getByRole('dialog').getByText(`@${leader.username}`)).toBeVisible();
  });

  test('General: a too-short description is refused and nothing is saved', async ({ page, request }) => {
    const { token, clubId } = await leaderWithClub(page, request, 'csdesc');

    await page.goto(`/club/${clubId}/settings/general`);
    await page.getByLabel('Description').fill('Too short');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(saveStatus(page)).toHaveText('Description must be at least 10 characters long');
    expect((await getClub(request, token, clubId)).description).toBe('Club settings page test club');
  });

  test('Privacy: making the club private saves only that, and Save waits for a change', async ({ page, request }) => {
    const { token, clubName, clubId } = await leaderWithClub(page, request, 'cspriv');

    await page.goto(`/club/${clubId}/settings/privacy`);
    const save = page.getByRole('button', { name: 'Save Changes' });
    await expect(page.getByRole('radio', { name: /^Public/ })).toBeChecked();
    await expect(save).toBeDisabled();

    await page.locator('label', { hasText: 'Hidden from search' }).click();
    await expect(page.getByRole('radio', { name: /^Private/ })).toBeChecked();
    await save.click();
    await expect(saveStatus(page)).toHaveText('This club is now private.');
    await expect(save).toBeDisabled();

    const saved = await getClub(request, token, clubId);
    expect(saved.isPrivate).toBe(true);
    expect(saved.name).toBe(clubName);
    expect(saved.description).toBe('Club settings page test club');

    await page.reload();
    await expect(page.getByRole('radio', { name: /^Private/ })).toBeChecked();
  });

  test('Ownership: transferring returns to the club page as a regular member', async ({ page, request }) => {
    const { token, clubName, clubId } = await leaderWithClub(page, request, 'csown');
    const member = newUser('csownmem');
    const { token: memberToken, id: memberId } = await register(request, member);
    const joined = await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(memberToken) });
    expect(joined.status()).toBe(200);

    await page.goto(`/club/${clubId}/settings/ownership`);
    const transfer = page.getByRole('button', { name: /^Transfer to/ });
    await expect(transfer).toBeDisabled();
    await page.getByRole('button', { name: new RegExp(`@${member.username}`) }).click();
    await page.getByRole('button', { name: `Transfer to ${member.username}` }).click();

    await expect(page).toHaveURL(new RegExp(`/club/${clubId}$`));
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave Club' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage Club' })).toHaveCount(0);
    expect((await getClub(request, token, clubId)).leader._id).toBe(memberId);

    // The former leader can no longer open the settings
    await page.goto(`/club/${clubId}/settings/general`);
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}$`));
    await expect(page.getByRole('button', { name: 'Leave Club' })).toBeVisible();
  });

  test('Danger Zone: Escape backs out of the confirmation; confirming deletes the club', async ({ page, request }) => {
    const { leader, token, clubId } = await leaderWithClub(page, request, 'csdel');

    await page.goto(`/club/${clubId}/settings/danger-zone`);
    const deleteButton = page.getByRole('button', { name: 'Delete Club' });
    await deleteButton.click();
    const dialog = page.getByRole('dialog', { name: 'Delete Club' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Dismiss club deletion form' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(deleteButton).toBeFocused();
    expect((await getClub(request, token, clubId))._id).toBe(clubId);

    await deleteButton.click();
    await dialog.getByLabel(/Confirm Leader Email/).fill(leader.email);
    await dialog.getByRole('button', { name: 'Delete Permanently' }).click();

    await expect(page).toHaveURL(/\/my-clubs$/);
    const gone = await request.get(`${API}/clubs/${clubId}`, { headers: auth(token) });
    expect(gone.status()).toBe(404);
  });

  test("a member is sent back to the club page; a co-leader can't open the leader's sections", async ({ page, request }) => {
    const leader = newUser('csgate');
    const { token: leaderToken } = await register(request, leader);
    const clubName = `Settings Club gate ${Date.now()}`;
    const clubId = await createClub(request, leaderToken, clubName);
    const member = newUser('csgatemem');
    const { token: memberToken, id: memberId } = await register(request, member);
    const joined = await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(memberToken) });
    expect(joined.status()).toBe(200);

    await login(page, member);
    await page.goto(`/club/${clubId}/settings/general`);
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}$`));
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage Club' })).toHaveCount(0);

    const promoted = await request.put(`${API}/clubs/${clubId}/promote`, {
      headers: auth(leaderToken),
      data: { userId: memberId },
    });
    expect(promoted.status()).toBe(200);

    // A co-leader lands on Reports, the one section open to them (UC-42)
    await page.goto(`/club/${clubId}/settings/danger-zone`);
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/reports$`));
    await expect(sectionHeading(page, 'Reports')).toBeVisible();
    await expect(settingsNav(page).getByRole('link')).toHaveText(['Reports']);
    await expect(page.getByRole('button', { name: 'Delete Club' })).toHaveCount(0);
  });

  test('a missing or unknown section opens General; an unknown club is "not found"', async ({ page, request }) => {
    const { clubId } = await leaderWithClub(page, request, 'csurl');

    await page.goto(`/club/${clubId}/settings`);
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/general$`));
    await expect(sectionHeading(page, 'General')).toBeVisible();

    await page.goto(`/club/${clubId}/settings/no-such-section`);
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/general$`));
    await expect(sectionHeading(page, 'General')).toBeVisible();

    await page.goto('/club/000000000000000000000000/settings/general');
    await expect(page.getByRole('heading', { name: 'Club not found' })).toBeVisible();
  });
});

test.describe('Club Settings page on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('every section link is on screen above the section and still switches it', async ({ page, request }) => {
    const { clubId } = await leaderWithClub(page, request, 'csphone');

    await page.goto(`/club/${clubId}/settings/general`);
    await expect(sectionHeading(page, 'General')).toBeVisible();

    // The links wrap rather than scroll sideways, so the last one isn't hidden
    for (const name of ['General', 'Privacy', 'Reports', 'Ownership', 'Danger Zone']) {
      await expect(settingsNav(page).getByRole('link', { name })).toBeInViewport({ ratio: 1 });
    }

    await settingsNav(page).getByRole('link', { name: 'Danger Zone' }).click();
    await expect(sectionHeading(page, 'Danger Zone')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Club' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
