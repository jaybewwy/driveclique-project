import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Regression tests for bugs found in the 2026-09-28 codebase audit. Each
// describe block pins one fix; see FIXES_APPLIED.md for root causes.

const API = 'http://localhost:5000/api';
const DAY_MS = 24 * 60 * 60 * 1000;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// "YYYY-MM-DD" for the UTC calendar day `days` from now
const utcDay = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

let seq = 0;
const newUser = (prefix: string) => {
  const id = `${Date.now()}${seq++}`;
  return { username: `${prefix}_${id}`, email: `${prefix}_${id}@mail.com`, password: 'AuditPass1!' };
};

async function register(request: APIRequestContext, user: { username: string; email: string; password: string }) {
  const res = await request.post(`${API}/auth/register`, { data: user });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { token: body.token as string, id: body.user._id as string };
}

async function createClub(request: APIRequestContext, token: string, name: string) {
  const res = await request.post(`${API}/clubs`, {
    headers: auth(token),
    data: { name, description: 'Audit regression test club', isPrivate: false },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).club._id as string;
}

async function createDrive(request: APIRequestContext, token: string, clubId: string, name: string, days: number) {
  const res = await request.post(`${API}/drives`, {
    headers: auth(token),
    data: { clubId, name, date: utcDay(days), time: '10:00 AM', timeZone: 'UTC', location: 'Audit Lot' },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).drive._id as string;
}

async function login(page: Page, user: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

test.describe('Club sidebar drive lists', () => {
  test('every upcoming drive is reachable: "View All" shows once there are more than the two listed', async ({ page, request }) => {
    const leader = newUser('auditlists');
    const { token } = await register(request, leader);
    const clubName = `Audit Three Drives ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);
    for (const [i, days] of [5, 6, 7].entries()) {
      await createDrive(request, token, clubId, `Audit Drive ${i + 1}`, days);
    }

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();

    // Only two fit in the sidebar, so the third must be reachable via View All
    await page.getByRole('button', { name: 'View All (3)' }).click();
    const dialog = page.getByRole('dialog', { name: 'All Drives & Events' });
    await expect(dialog.getByText('Audit Drive 3')).toBeVisible();
  });

  test('a club whose only drive is finished still shows Past Events', async ({ page, request }) => {
    const leader = newUser('auditpast');
    const { token } = await register(request, leader);
    const clubName = `Audit Past Only ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);
    const driveId = await createDrive(request, token, clubId, 'Audit Finished Drive', 3);
    const done = await request.put(`${API}/drives/${driveId}`, { headers: auth(token), data: { isCompleted: true } });
    expect(done.status()).toBe(200);

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await expect(page.getByText('No drives scheduled yet')).toBeVisible();

    await page.getByRole('button', { name: 'Past Events (1)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Past Events' });
    await expect(dialog.getByText('Audit Finished Drive')).toBeVisible();
    await expect(dialog.getByText('Completed')).toBeVisible();
  });
});

test.describe('Delete Club reason is optional, as labelled', () => {
  test('a leader can delete a club from the UI without giving a reason', async ({ page, request }) => {
    const leader = newUser('auditdel');
    const { token } = await register(request, leader);
    const clubName = `Audit Delete Me ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await page.getByRole('button', { name: 'Manage Club' }).click();
    await page.getByRole('button', { name: 'Delete Club' }).click();

    await page.getByLabel(/Confirm Leader Email/).fill(leader.email);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();

    await expect(page).toHaveURL(/\/my-clubs$/);
    const gone = await request.get(`${API}/clubs/${clubId}`, { headers: auth(token) });
    expect(gone.status()).toBe(404);
  });

  test('the API accepts a deletion with no deletionReason', async ({ request }) => {
    const leader = newUser('auditdelapi');
    const { token } = await register(request, leader);
    const clubId = await createClub(request, token, `Audit Delete API ${Date.now()}`);

    const res = await request.delete(`${API}/clubs/${clubId}`, {
      headers: auth(token),
      data: { leaderEmail: leader.email },
    });
    expect(res.status()).toBe(200);
  });
});

test.describe('Account deletion leaves nothing behind', () => {
  test('a deleted co-leader frees their co-leader slot', async ({ request }) => {
    const leader = newUser('auditcolead');
    const { token: leaderToken } = await register(request, leader);
    const clubId = await createClub(request, leaderToken, `Audit Co-Leader ${Date.now()}`);

    const joinAndPromote = async (prefix: string) => {
      const user = newUser(prefix);
      const { token, id } = await register(request, user);
      expect((await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(token) })).status()).toBe(200);
      const promote = await request.put(`${API}/clubs/${clubId}/promote`, { headers: auth(leaderToken), data: { userId: id } });
      return { user, token, promoteStatus: promote.status() };
    };

    const departing = await joinAndPromote('auditcoleadgone');
    expect(departing.promoteStatus).toBe(200);
    const del = await request.delete(`${API}/auth/account`, { headers: auth(departing.token), data: { password: departing.user.password } });
    expect(del.status()).toBe(200);

    // A club allows 3 co-leaders. The API hides a deleted user's id (populate
    // drops it), but before the fix it stayed in coLeaders and used a slot,
    // so the third promotion below was refused.
    for (const prefix of ['auditcoleada', 'auditcoleadb', 'auditcoleadc']) {
      expect((await joinAndPromote(prefix)).promoteStatus).toBe(200);
    }
  });

  test('a deleted member\'s drive rating is removed, and the ratings list still loads', async ({ request }) => {
    const leader = newUser('auditrate');
    const rater = newUser('auditrater');
    const { token: leaderToken } = await register(request, leader);
    const { token: raterToken } = await register(request, rater);
    const clubId = await createClub(request, leaderToken, `Audit Ratings ${Date.now()}`);
    expect((await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(raterToken) })).status()).toBe(200);
    const driveId = await createDrive(request, leaderToken, clubId, 'Audit Rated Drive', 2);
    expect((await request.post(`${API}/drives/${driveId}/rsvp`, { headers: auth(raterToken), data: { status: 'going' } })).status()).toBe(200);
    expect((await request.put(`${API}/drives/${driveId}`, { headers: auth(leaderToken), data: { isCompleted: true } })).status()).toBe(200);
    expect((await request.post(`${API}/drives/${driveId}/ratings`, { headers: auth(raterToken), data: { stars: 5 } })).status()).toBe(200);

    const del = await request.delete(`${API}/auth/account`, { headers: auth(raterToken), data: { password: rater.password } });
    expect(del.status()).toBe(200);

    // Before the fix the orphaned rating populated to user: null and this 500ed for everyone
    const res = await request.get(`${API}/drives/${driveId}/ratings`, { headers: auth(leaderToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.average).toBeNull();
  });
});

async function openProfileSettings(page: Page) {
  await page.goto('/settings');
  await page.getByRole('navigation', { name: 'Settings navigation' }).getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile Settings' })).toBeVisible();
}

test.describe('Notification preferences', () => {
  test('photo-gallery notifications (UC-5) can be muted like every other type', async ({ page, request }) => {
    const user = newUser('auditphotos');
    const { token } = await register(request, user);

    await login(page, user);
    await openProfileSettings(page);

    const toggle = page.getByRole('switch', { name: 'New photos are added to a drive you went on' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await expect.poll(async () => {
      const res = await request.get(`${API}/notifications/preferences`, { headers: auth(token) });
      return (await res.json()).data.notificationPreferences.DRIVE_PHOTOS_ADDED;
    }).toBe(false);
  });

  test('a toggle made while saved preferences are still loading is not overwritten', async ({ page, request }) => {
    const user = newUser('auditprefrace');
    const { token } = await register(request, user);
    await login(page, user);

    // The server answers the initial fetch right away (before any toggle),
    // but the answer reaches the page late, as on a slow network
    await page.route('**/api/notifications/preferences', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({ response });
    });
    const initialFetch = page.waitForResponse((res) =>
      res.url().includes('/api/notifications/preferences') && res.request().method() === 'GET');

    await openProfileSettings(page);
    const toggle = page.getByRole('switch', { name: 'A club posts a new announcement' });
    await toggle.click();
    await initialFetch;

    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    const saved = await request.get(`${API}/notifications/preferences`, { headers: auth(token) });
    expect((await saved.json()).data.notificationPreferences.NEW_ANNOUNCEMENT).toBe(false);
  });
});
