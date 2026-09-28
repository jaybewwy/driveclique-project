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
