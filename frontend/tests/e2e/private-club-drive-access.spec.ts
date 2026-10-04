import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── A private club's drive list is members-only ────────────────────────────
// GET /api/drives/club/:clubId used to return any club's drives to any
// signed-in user. Now a private club's list needs membership (403
// otherwise), checked live, while a public club's list stays open so
// visitors can see what a club does before joining. The club page loads
// the club first and skips the drive request when the viewer can't see
// them, so an ordinary visit never triggers (or logs) a denial.

test.describe('Private club drive access', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `pcdlead_${suffix}`, email: `pcdlead_${suffix}@mail.com`, password: 'PcdPass1!' };
  const member = { username: `pcdmember_${suffix}`, email: `pcdmember_${suffix}@mail.com`, password: 'PcdPass1!' };
  const outsider = { username: `pcdout_${suffix}`, email: `pcdout_${suffix}@mail.com`, password: 'PcdPass1!' };
  const privateClubName = `Private Garage ${suffix}`;
  const publicClubName = `Open Garage ${suffix}`;
  const privateDriveName = `Members Canyon Run ${suffix}`;
  const publicDriveName = `Open Coast Run ${suffix}`;

  let leaderToken = '';
  let memberToken = '';
  let outsiderToken = '';
  let privateClubId = '';
  let publicClubId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  async function login(page: Page, user: { username: string; password: string }) {
    await page.goto('/login');
    await page.getByPlaceholder('Username').fill(user.username);
    await page.getByPlaceholder('Password').fill(user.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
  }

  test('setup: a private club with one member and a drive, and a public club with a drive', async ({ request }) => {
    for (const [user, assign] of [
      [leader, (t: string) => { leaderToken = t; }],
      [member, (t: string) => { memberToken = t; }],
      [outsider, (t: string) => { outsiderToken = t; }],
    ] as const) {
      const res = await request.post(`${API}/auth/register`, { data: user });
      expect(res.status()).toBe(201);
      assign((await res.json()).token);
    }

    const createClub = async (name: string) => {
      const res = await request.post(`${API}/clubs`, {
        headers: auth(leaderToken),
        data: { name, description: 'Testing members-only drive lists', isPrivate: false },
      });
      expect(res.status()).toBe(201);
      return (await res.json()).club._id as string;
    };
    privateClubId = await createClub(privateClubName);
    publicClubId = await createClub(publicClubName);

    // The member joins while the club is still open, then the leader makes it private
    const join = await request.post(`${API}/clubs/${privateClubId}/join`, { headers: auth(memberToken) });
    expect(join.status()).toBe(200);
    const makePrivate = await request.post(`${API}/clubs/${privateClubId}/toggle-privacy`, {
      headers: auth(leaderToken),
      data: { isPrivate: true },
    });
    expect(makePrivate.status()).toBe(200);

    for (const [clubId, name] of [[privateClubId, privateDriveName], [publicClubId, publicDriveName]]) {
      const res = await request.post(`${API}/drives`, {
        headers: auth(leaderToken),
        data: { clubId, name, date: inDays(7), time: '10:00 AM', location: 'Test Lot' },
      });
      expect(res.status()).toBe(201);
    }
  });

  test("a non-member cannot list a private club's drives, plain or paginated", async ({ request }) => {
    const plain = await request.get(`${API}/drives/club/${privateClubId}`, { headers: auth(outsiderToken) });
    expect(plain.status()).toBe(403);
    expect(JSON.stringify(await plain.json())).not.toContain(privateDriveName);

    const paged = await request.get(`${API}/drives/club/${privateClubId}?page=1&limit=5`, { headers: auth(outsiderToken) });
    expect(paged.status()).toBe(403);
  });

  test('the leader and a member still get the private list', async ({ request }) => {
    for (const token of [leaderToken, memberToken]) {
      const res = await request.get(`${API}/drives/club/${privateClubId}`, { headers: auth(token) });
      expect(res.status()).toBe(200);
      expect((await res.json()).drives.map((d: { name: string }) => d.name)).toEqual([privateDriveName]);
    }
  });

  test("a public club's drives stay visible to a non-member", async ({ request }) => {
    const res = await request.get(`${API}/drives/club/${publicClubId}`, { headers: auth(outsiderToken) });
    expect(res.status()).toBe(200);
    expect((await res.json()).drives.map((d: { name: string }) => d.name)).toEqual([publicDriveName]);
  });

  test('the list still needs a login, and an unknown club is an empty list rather than an error', async ({ request }) => {
    expect((await request.get(`${API}/drives/club/${privateClubId}`)).status()).toBe(401);
    // The dashboard fetches every club in one batch; a just-deleted club must not fail it
    const unknown = await request.get(`${API}/drives/club/000000000000000000000000`, { headers: auth(outsiderToken) });
    expect(unknown.status()).toBe(200);
    expect((await unknown.json()).drives).toEqual([]);
  });

  test('club page: a non-member of a private club is told the drives are members-only, with no denied request', async ({ page }) => {
    const driveListRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/drives/club/')) driveListRequests.push(req.url());
    });

    await login(page, outsider);
    await page.goto(`/club/${privateClubId}`);
    await expect(page.getByRole('heading', { name: privateClubName })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Only members can see this club's drives")).toBeVisible();
    await expect(page.getByText(privateDriveName)).toHaveCount(0);
    // The page knew not to ask, so nothing was denied (or logged as denied)
    expect(driveListRequests.filter((url) => url.includes(privateClubId))).toEqual([]);
  });

  test('club page: a member of the private club sees its drives', async ({ page }) => {
    await login(page, member);
    await page.goto(`/club/${privateClubId}`);
    await expect(page.getByText(privateDriveName).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Only members can see this club's drives")).toHaveCount(0);
  });

  test('club page: a non-member still sees a public club and its drives', async ({ page }) => {
    await login(page, outsider);
    await page.goto(`/club/${publicClubId}`);
    await expect(page.getByRole('heading', { name: publicClubName })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(publicDriveName).first()).toBeVisible();
  });

  test('access follows membership and privacy as they change', async ({ request }) => {
    // A member who leaves loses the list
    const leave = await request.put(`${API}/clubs/${privateClubId}/leave`, { headers: auth(memberToken) });
    expect(leave.status()).toBe(200);
    expect((await request.get(`${API}/drives/club/${privateClubId}`, { headers: auth(memberToken) })).status()).toBe(403);

    // Making the club public opens it up again
    const makePublic = await request.post(`${API}/clubs/${privateClubId}/toggle-privacy`, {
      headers: auth(leaderToken),
      data: { isPrivate: false },
    });
    expect(makePublic.status()).toBe(200);
    expect((await request.get(`${API}/drives/club/${privateClubId}`, { headers: auth(outsiderToken) })).status()).toBe(200);
  });
});
