import { test, expect, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

// ─── The Dashboard's upcoming drives come in one request ────────────────────
// The Dashboard used to ask for each club's drives, then for each upcoming
// drive's RSVP counts, and the sidebar asked for every club's drives again:
// up to 20 requests for one screen. GET /api/drives/my-upcoming returns the
// viewer's upcoming drives across their clubs, soonest first, each with its
// club and "going" count, plus the total the sidebar badge shows.

const suffix = Date.now();
const PASSWORD = 'DashPass1!';
const ROLES = ['viewer', 'host', 'rider'] as const;
type Role = typeof ROLES[number];
const users = {} as Record<Role, { username: string; token: string; id: string }>;
const auth = (role: Role) => ({ Authorization: `Bearer ${users[role].token}` });
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const names = {
  publicClub: `Dash Public ${suffix}`,
  privateClub: `Dash Private ${suffix}`,
  ownClub: `Dash Own ${suffix}`,
  otherClub: `Dash Other ${suffix}`,
  soonest: `Dash Soonest ${suffix}`,
  middle: `Dash Middle ${suffix}`,
  latest: `Dash Latest ${suffix}`,
  cancelled: `Dash Cancelled ${suffix}`,
  notMine: `Dash Not Mine ${suffix}`,
};

async function createClub(request: APIRequestContext, owner: Role, name: string, isPrivate: boolean) {
  const res = await request.post(`${API}/clubs`, {
    headers: auth(owner),
    data: { name, description: 'Dashboard request checks', isPrivate },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).club._id as string;
}

async function createDrive(request: APIRequestContext, owner: Role, clubId: string, name: string, days: number) {
  const res = await request.post(`${API}/drives`, {
    headers: auth(owner),
    data: { clubId, name, date: inDays(days), time: '10:00 AM', location: 'Test Lot' },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).drive._id as string;
}

async function rsvp(request: APIRequestContext, role: Role, driveId: string, status: string) {
  const res = await request.post(`${API}/drives/${driveId}/rsvp`, { headers: auth(role), data: { status } });
  expect(res.status()).toBe(200);
}

test.describe('Dashboard upcoming drives', () => {
  test.describe.configure({ mode: 'default' });

  test.beforeAll(async ({ request }) => {
    for (const role of ROLES) {
      const username = `dash${role}_${suffix}`;
      const res = await request.post(`${API}/auth/register`, {
        data: { username, email: `${username}@mail.com`, password: PASSWORD },
      });
      expect(res.status(), `register ${role}`).toBe(201);
      const body = await res.json();
      users[role] = { username, token: body.token, id: body.user._id };
    }

    // The viewer: a member of a public and a private club, leader of a third,
    // and not in a fourth
    const publicClub = await createClub(request, 'host', names.publicClub, false);
    const privateClub = await createClub(request, 'host', names.privateClub, true);
    const ownClub = await createClub(request, 'viewer', names.ownClub, false);
    const otherClub = await createClub(request, 'host', names.otherClub, false);

    for (const role of ['viewer', 'rider'] as const) {
      expect((await request.post(`${API}/clubs/${publicClub}/join`, { headers: auth(role) })).status()).toBe(200);
    }
    expect((await request.post(`${API}/clubs/${ownClub}/join`, { headers: auth('rider') })).status()).toBe(200);
    expect((await request.post(`${API}/clubs/${privateClub}/join`, { headers: auth('viewer') })).status()).toBe(200);
    const club = (await (await request.get(`${API}/clubs/${privateClub}`, { headers: auth('host') })).json()).club;
    const pending = club.joinRequests.find((r: any) => r.status === 'pending');
    const accept = await request.post(`${API}/clubs/${privateClub}/handle-request`, {
      headers: auth('host'),
      data: { requestId: pending._id, status: 'accepted' },
    });
    expect(accept.status()).toBe(200);

    await createDrive(request, 'host', privateClub, names.soonest, 1);
    const middle = await createDrive(request, 'host', publicClub, names.middle, 3);
    const latest = await createDrive(request, 'viewer', ownClub, names.latest, 5);
    const cancelled = await createDrive(request, 'host', publicClub, names.cancelled, 2);
    await createDrive(request, 'host', otherClub, names.notMine, 2);

    const cancel = await request.post(`${API}/drives/${cancelled}/cancel`, {
      headers: auth('host'),
      data: { cancellationReason: 'Rain forecast for the whole route' },
    });
    expect(cancel.status()).toBe(200);

    // Going counts: middle 2, latest 1 (a "maybe" does not count), soonest 0
    await rsvp(request, 'viewer', middle, 'going');
    await rsvp(request, 'rider', middle, 'going');
    await rsvp(request, 'viewer', latest, 'going');
    await rsvp(request, 'rider', latest, 'maybe');
  });

  test("GET /drives/my-upcoming lists the viewer's upcoming drives, soonest first, with going counts", async ({ request }) => {
    const res = await request.get(`${API}/drives/my-upcoming`, { headers: auth('viewer') });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.drives.map((d: any) => d.name)).toEqual([names.soonest, names.middle, names.latest]);
    expect(body.total).toBe(3);
    expect(body.drives.map((d: any) => d.club?.name)).toEqual([names.privateClub, names.publicClub, names.ownClub]);
    expect(body.drives.map((d: any) => d.goingCount)).toEqual([0, 2, 1]);
    for (const drive of body.drives) {
      expect(drive.image).toBeUndefined();
      expect(drive.photos).toBeUndefined();
    }
  });

  test('the limit trims the list but not the total', async ({ request }) => {
    const body = await (await request.get(`${API}/drives/my-upcoming?limit=1`, { headers: auth('viewer') })).json();
    expect(body.drives.map((d: any) => d.name)).toEqual([names.soonest]);
    expect(body.total).toBe(3);
  });

  test('the Dashboard and sidebar draw from it, with no request per club or per drive', async ({ page }) => {
    const driveRequests: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.port === '5000' && url.pathname.startsWith('/api/drives')) driveRequests.push(url.pathname);
    });

    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(users.viewer.username);
    await page.getByPlaceholder('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    const card = (name: string) => page.getByRole('button').filter({ hasText: name });
    await expect(card(names.middle)).toContainText('2 going');
    await expect(card(names.latest)).toContainText('1 going');
    await expect(card(names.soonest)).toContainText('0 going');
    await expect(card(names.cancelled)).toHaveCount(0);
    await expect(card(names.notMine)).toHaveCount(0);
    const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(sidebar.getByRole('button', { name: /^Home\s*3$/ })).toBeVisible();
    // Signing in does not reload the page; the shared clubs list must still
    // be this user's, not the one that failed before they signed in
    await expect(sidebar.getByText(names.ownClub)).toBeVisible();

    const onDashboard = [...driveRequests];
    expect(onDashboard.filter((p) => p.startsWith('/api/drives/club/'))).toEqual([]);
    expect(onDashboard.filter((p) => p.endsWith('/rsvp-status'))).toEqual([]);
    // One from the Dashboard and one from the sidebar, each doubled in
    // development by React's StrictMode
    const upcomingCalls = onDashboard.filter((p) => p === '/api/drives/my-upcoming').length;
    expect(upcomingCalls).toBeGreaterThanOrEqual(1);
    expect(upcomingCalls).toBeLessThanOrEqual(4);

    // Clicking a drive still opens its club
    await card(names.middle).click();
    await expect(page.getByRole('heading', { name: names.publicClub })).toBeVisible({ timeout: 10_000 });
  });
});
