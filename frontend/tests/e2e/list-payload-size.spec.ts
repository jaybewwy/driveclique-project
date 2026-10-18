import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-53 — Club and drive lists stop downloading every photo ──────────────
// The club page's member lists carry each car's year, make, and model, not
// its photos. Drive lists leave out the route image and the gallery (UC-5),
// which GET /api/drives/:driveId serves when the drive modal opens, under
// the same rule as the list: a private club's drives are members-only. The
// dashboard and sidebar ask for upcoming drives only (?upcoming=true).

// A real 1×1 PNG, so the modal's <img> elements load
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test.describe('Lists leave the photos out (UC-53)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const makeUser = (role: string) => ({
    username: `uc53${role}_${suffix}`,
    email: `uc53${role}_${suffix}@mail.com`,
    password: 'Uc53Pass1!',
  });
  const leader = makeUser('lead');
  const member = makeUser('member');
  const outsider = makeUser('out');
  // Car photos never render in a list, so a marker is enough to search for
  const carPhoto = `data:image/png;base64,UC53CARPHOTO${suffix}`;
  const clubName = `UC53 Club ${suffix}`;
  const upcomingName = `UC53 Upcoming Run ${suffix}`;
  const cancelledName = `UC53 Cancelled Run ${suffix}`;
  const completedName = `UC53 Completed Run ${suffix}`;

  const tokens = new Map<string, string>();
  const tokenOf = (user: { username: string }) => tokens.get(user.username)!;
  let memberId = '';
  let clubId = '';
  let privateClubId = '';
  let upcomingDriveId = '';
  let completedDriveId = '';
  let privateDriveId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  async function createClub(request: APIRequestContext, name: string) {
    const res = await request.post(`${API}/clubs`, {
      headers: auth(tokenOf(leader)),
      data: { name, description: 'Testing what the lists download', isPrivate: false },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).club._id as string;
  }

  async function createDrive(request: APIRequestContext, club: string, name: string, days: number, extra = {}) {
    const res = await request.post(`${API}/drives`, {
      headers: auth(tokenOf(leader)),
      data: { clubId: club, name, date: inDays(days), time: '10:00 AM', location: 'Test Lot', ...extra },
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

  test('setup: a member with a photographed car, and drives with a route image and a gallery', async ({ request }) => {
    for (const user of [leader, member, outsider]) {
      const res = await request.post(`${API}/auth/register`, { data: user });
      expect(res.status()).toBe(201);
      const body = await res.json();
      tokens.set(user.username, body.token);
      if (user === member) memberId = body.user._id;
    }

    const garage = await request.put(`${API}/auth/profile`, {
      headers: auth(tokenOf(member)),
      data: { cars: [{ year: '1999', make: 'Mazda', model: 'Miata', photos: [carPhoto], isPrimary: true }] },
    });
    expect(garage.status()).toBe(200);

    clubId = await createClub(request, clubName);
    const join = await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(tokenOf(member)) });
    expect(join.status()).toBe(200);

    upcomingDriveId = await createDrive(request, clubId, upcomingName, 3, { image: PNG });

    const cancelledDriveId = await createDrive(request, clubId, cancelledName, 4);
    const cancel = await request.post(`${API}/drives/${cancelledDriveId}/cancel`, {
      headers: auth(tokenOf(leader)),
      data: { cancellationReason: 'Testing the upcoming filter' },
    });
    expect(cancel.status()).toBe(200);

    completedDriveId = await createDrive(request, clubId, completedName, 5);
    const finish = await request.put(`${API}/drives/${completedDriveId}`, {
      headers: auth(tokenOf(leader)),
      data: { isCompleted: true },
    });
    expect(finish.status()).toBe(200);
    const photos = await request.post(`${API}/drives/${completedDriveId}/photos`, {
      headers: auth(tokenOf(leader)),
      data: { photos: [PNG, PNG] },
    });
    expect(photos.status()).toBe(200);

    privateClubId = await createClub(request, `UC53 Private ${suffix}`);
    privateDriveId = await createDrive(request, privateClubId, `UC53 Private Run ${suffix}`, 3);
    const makePrivate = await request.post(`${API}/clubs/${privateClubId}/toggle-privacy`, {
      headers: auth(tokenOf(leader)),
      data: { isPrivate: true },
    });
    expect(makePrivate.status()).toBe(200);
  });

  test("the club's member list names each car without its photos", async ({ request }) => {
    const res = await request.get(`${API}/clubs/${clubId}`, { headers: auth(tokenOf(member)) });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(carPhoto);

    const listed = (JSON.parse(text).club.members as { _id: string; cars: Record<string, unknown>[] }[])
      .find((m) => m._id === memberId)!;
    expect(listed.cars).toEqual([{ year: '1999', make: 'Mazda', model: 'Miata', isPrimary: true }]);

    // The photos are still stored, and the owner still gets them
    const profile = await request.get(`${API}/auth/profile`, { headers: auth(tokenOf(member)) });
    expect((await profile.json()).user.cars[0].photos).toEqual([carPhoto]);
  });

  test("a club's drive list leaves out the route image and the gallery", async ({ request }) => {
    for (const query of ['', '?page=1&limit=10']) {
      const res = await request.get(`${API}/drives/club/${clubId}${query}`, { headers: auth(tokenOf(member)) });
      expect(res.status()).toBe(200);
      const text = await res.text();
      expect(text).not.toContain(PNG);

      const drives = JSON.parse(text).drives as Record<string, unknown>[];
      expect(drives.map((d) => d.name).sort()).toEqual([cancelledName, completedName, upcomingName].sort());
      for (const drive of drives) {
        expect(drive).not.toHaveProperty('photos');
        expect(drive).not.toHaveProperty('image');
      }
    }
  });

  test('?upcoming=true lists only drives that have not started and are not cancelled or completed', async ({ request }) => {
    const plain = await request.get(`${API}/drives/club/${clubId}?upcoming=true`, { headers: auth(tokenOf(member)) });
    expect(plain.status()).toBe(200);
    expect((await plain.json()).drives.map((d: { name: string }) => d.name)).toEqual([upcomingName]);

    const paged = await request.get(`${API}/drives/club/${clubId}?upcoming=true&page=1&limit=10`, { headers: auth(tokenOf(member)) });
    expect((await paged.json()).pagination.total).toBe(1);

    const invalid = await request.get(`${API}/drives/club/${clubId}?upcoming=yes`, { headers: auth(tokenOf(member)) });
    expect(invalid.status()).toBe(400);
  });

  test('one drive comes with its image and gallery, to whoever may see the list', async ({ request }) => {
    const completed = await request.get(`${API}/drives/${completedDriveId}`, { headers: auth(tokenOf(member)) });
    expect(completed.status()).toBe(200);
    const drive = (await completed.json()).drive;
    expect(drive.name).toBe(completedName);
    expect(drive.photos).toEqual([PNG, PNG]);

    const upcoming = await request.get(`${API}/drives/${upcomingDriveId}`, { headers: auth(tokenOf(member)) });
    expect((await upcoming.json()).drive.image).toBe(PNG);

    // A public club's drives are open to any signed-in user, a private club's to members
    expect((await request.get(`${API}/drives/${completedDriveId}`, { headers: auth(tokenOf(outsider)) })).status()).toBe(200);
    const denied = await request.get(`${API}/drives/${privateDriveId}`, { headers: auth(tokenOf(outsider)) });
    expect(denied.status()).toBe(403);
    expect(await denied.text()).not.toContain('UC53 Private Run');
    expect((await request.get(`${API}/drives/${privateDriveId}`, { headers: auth(tokenOf(leader)) })).status()).toBe(200);

    expect((await request.get(`${API}/drives/000000000000000000000000`, { headers: auth(tokenOf(member)) })).status()).toBe(404);
    expect((await request.get(`${API}/drives/not-an-id`, { headers: auth(tokenOf(member)) })).status()).toBe(400);
    expect((await request.get(`${API}/drives/${completedDriveId}`)).status()).toBe(401);
  });

  test('club page: the drive modal loads the route image and the gallery when it opens', async ({ page }) => {
    await login(page, member);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: new RegExp(upcomingName) }).first().click();
    const upcomingModal = page.getByRole('dialog', { name: upcomingName });
    await expect(upcomingModal.getByAltText('Drive route')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(upcomingModal).toHaveCount(0);

    await page.getByRole('button', { name: 'Past Events (1)' }).click();
    await page.getByRole('dialog', { name: 'Past Events' }).getByRole('button', { name: new RegExp(completedName) }).click();
    const completedModal = page.getByRole('dialog', { name: completedName });
    await expect(completedModal.getByAltText(`${completedName}, 1 of 2`)).toBeVisible();
    await expect(completedModal.getByAltText(`${completedName}, 2 of 2`)).toBeVisible();
  });

  test('dashboard: it and the sidebar ask for upcoming drives only, and a drive there opens its club', async ({ page }) => {
    const driveListRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/drives/club/')) driveListRequests.push(req.url());
    });

    await login(page, member);
    const card = page.getByRole('button', { name: new RegExp(upcomingName) });
    await expect(card).toBeVisible();
    await expect(page.getByText(cancelledName)).toHaveCount(0);

    expect(driveListRequests.length).toBeGreaterThan(0);
    for (const url of driveListRequests) {
      expect(new URL(url).searchParams.get('upcoming')).toBe('true');
    }

    await card.click();
    await page.waitForURL(`**/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
  });
});
