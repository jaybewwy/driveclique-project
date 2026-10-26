import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── API bottlenecks found by the 2026-10-26 audit ──────────────────────────
// - Avatars travel as signed, cacheable URLs (GET /api/images), never as
//   base64 inside JSON, and the Members list shows 30 members at a time.
// - A drive's write routes answer with the drive as the club's list shows it:
//   no images, the club as its id, never the club's invite code.
// - JSON bodies are capped at 100 KB, except on the routes that carry images,
//   and those take a larger body only from a signed-in user.
// - Signed-in requests are rate-limited per user, not per address.
// - A club's drive list carries each drive's RSVP counts for members, so the
//   club page no longer asks for them one drive at a time.

// A real 1×1 PNG, so <img> elements load
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
// A base64 string `chars` long, for bodies near a validation cap
const imageOf = (chars: number) => `data:image/png;base64,${'A'.repeat(chars - 22)}`;

const suffix = Date.now();
const PASSWORD = 'BottleneckPass1!';
const ROLES = ['leader', 'coLeader', 'member', 'outsider'] as const;
type Role = typeof ROLES[number];
const users = {} as Record<Role, { username: string; token: string; id: string }>;
const auth = (role: Role) => ({ Authorization: `Bearer ${users[role].token}` });
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const clubName = `Bottleneck Club ${suffix}`;
const soonDriveName = `Bottleneck Soon ${suffix}`;
let clubId = '';
let inviteCode = '';
let soonDriveId = '';
let laterDriveId = '';

async function register(request: APIRequestContext, role: Role | string) {
  const username = `bneck${role.toLowerCase()}_${suffix}`.slice(0, 30);
  const res = await request.post(`${API}/auth/register`, {
    data: { username, email: `${username}@mail.com`, password: PASSWORD },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { username, token: body.token as string, id: body.user._id as string };
}

async function createDrive(request: APIRequestContext, role: Role, name: string, days: number, extra = {}) {
  const res = await request.post(`${API}/drives`, {
    headers: auth(role),
    data: { clubId, name, date: inDays(days), time: '10:00 AM', location: 'Test Lot', ...extra },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).drive._id as string;
}

async function login(page: Page, role: Role) {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(users[role].username);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

test.describe('API bottlenecks', () => {
  test.describe.configure({ mode: 'default' });

  test.beforeAll(async ({ request }) => {
    for (const role of ROLES) users[role] = await register(request, role);

    for (const role of ['leader', 'member'] as const) {
      const res = await request.put(`${API}/auth/profile`, { headers: auth(role), data: { avatar: PNG } });
      expect(res.status()).toBe(200);
    }

    const club = await request.post(`${API}/clubs`, {
      headers: auth('leader'),
      data: { name: clubName, description: 'Checks what the API reads and sends', isPrivate: false },
    });
    expect(club.status()).toBe(201);
    clubId = (await club.json()).club._id;

    const clubAvatar = await request.put(`${API}/clubs/${clubId}`, { headers: auth('leader'), data: { avatar: PNG } });
    expect(clubAvatar.status()).toBe(200);

    for (const role of ['coLeader', 'member'] as const) {
      const join = await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(role) });
      expect(join.status()).toBe(200);
    }
    const promote = await request.put(`${API}/clubs/${clubId}/promote`, {
      headers: auth('leader'),
      data: { userId: users.coLeader.id },
    });
    expect(promote.status()).toBe(200);

    const read = await request.get(`${API}/clubs/${clubId}`, { headers: auth('leader') });
    inviteCode = (await read.json()).club.inviteCode;
    expect(inviteCode).toBeTruthy();

    soonDriveId = await createDrive(request, 'leader', soonDriveName, 2);
    laterDriveId = await createDrive(request, 'leader', `Bottleneck Later ${suffix}`, 5);
    for (const [role, status] of [['member', 'going'], ['coLeader', 'maybe']] as const) {
      const res = await request.post(`${API}/drives/${soonDriveId}/rsvp`, { headers: auth(role), data: { status } });
      expect(res.status()).toBe(200);
    }
  });

  test.describe('avatars as URLs', () => {
    const IMAGE_URL = /^http:\/\/localhost:5000\/api\/images\/(users|clubs)\/[0-9a-f]{24}\/avatar\?v=[0-9a-z]+&sig=[\w-]{22}$/;
    const PNG_BYTES = Buffer.from(PNG.split(',')[1], 'base64');
    const clubRead = async (request: APIRequestContext, role: Role) =>
      (await (await request.get(`${API}/clubs/${clubId}`, { headers: auth(role) })).json()).club;
    const avatarOf = (club: { members: { _id: string; avatar: string }[] }, role: Role) =>
      club.members.find((m) => m._id === users[role].id)!.avatar;

    test('the club read names its members with avatar URLs, not image data', async ({ request }) => {
      const res = await request.get(`${API}/clubs/${clubId}`, { headers: auth('member') });
      expect(res.status()).toBe(200);
      const text = await res.text();
      expect(text).not.toContain('data:image');

      const { club } = JSON.parse(text);
      expect(club.avatar).toMatch(IMAGE_URL);
      expect(club.leader.avatar).toMatch(IMAGE_URL);
      expect(avatarOf(club, 'member')).toMatch(IMAGE_URL);
      expect(avatarOf(club, 'coLeader')).toBe('');
      for (const person of [club.leader, ...club.members, ...club.coLeaders]) {
        expect(person).not.toHaveProperty('hasAvatar');
        expect(person).not.toHaveProperty('updatedAt');
      }
    });

    test("lists carry avatar URLs: the user's clubs, browse, trending, and user search", async ({ request }) => {
      const mine = await request.get(`${API}/clubs`, { headers: auth('member') });
      const mineText = await mine.text();
      expect(mineText).not.toContain('data:image');
      const listed = JSON.parse(mineText).clubs.find((c: { _id: string }) => c._id === clubId);
      expect(listed.avatar).toMatch(IMAGE_URL);
      // Only the club page shows announcements
      expect(listed).not.toHaveProperty('announcements');

      const browse = await request.get(`${API}/clubs/browse?query=${encodeURIComponent(clubName)}`, { headers: auth('outsider') });
      const found = (await browse.json()).clubs;
      expect(found.map((c: { _id: string }) => c._id)).toEqual([clubId]);
      expect(found[0].avatar).toMatch(IMAGE_URL);

      const trending = await request.get(`${API}/clubs/trending`, { headers: auth('outsider') });
      expect(await trending.text()).not.toContain('data:image');

      const search = await request.get(`${API}/auth/users/search?query=${users.member.username}`, { headers: auth('outsider') });
      const [match] = (await search.json()).users;
      expect(match.username).toBe(users.member.username);
      expect(match.avatar).toMatch(IMAGE_URL);
    });

    test('an avatar URL serves the image with no token, cached for a year, and only as signed', async ({ request }) => {
      const url = (await clubRead(request, 'member')).leader.avatar as string;
      const res = await request.get(url);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('image/png');
      expect(res.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(res.headers()['cross-origin-resource-policy']).toBe('cross-origin');
      expect(Buffer.compare(await res.body(), PNG_BYTES)).toBe(0);

      const tampered = url.replace(/sig=(.)/, (_, c) => `sig=${c === 'A' ? 'B' : 'A'}`);
      expect((await request.get(tampered)).status()).toBe(404);
      expect((await request.get(url.replace('/users/', '/clubs/'))).status()).toBe(404);
      expect((await request.get(url.replace(/&sig=.*/, ''))).status()).toBe(404);
    });

    test('a new avatar gets a new URL, and a URL sent back changes nothing', async ({ request }) => {
      const before = avatarOf(await clubRead(request, 'member'), 'member');
      const clubBefore = (await clubRead(request, 'leader')).avatar;

      // Forms send back what they loaded, URL included
      expect((await request.put(`${API}/auth/profile`, { headers: auth('member'), data: { avatar: before, bio: 'Unchanged avatar' } })).status()).toBe(200);
      expect((await request.put(`${API}/clubs/${clubId}`, { headers: auth('leader'), data: { avatar: clubBefore, name: clubName } })).status()).toBe(200);
      expect(avatarOf(await clubRead(request, 'member'), 'member')).toBe(before);
      expect((await clubRead(request, 'leader')).avatar).toBe(clubBefore);
      expect(Buffer.compare(await (await request.get(before)).body(), PNG_BYTES)).toBe(0);
      expect(Buffer.compare(await (await request.get(clubBefore)).body(), PNG_BYTES)).toBe(0);

      const replacement = imageOf(500);
      expect((await request.put(`${API}/auth/profile`, { headers: auth('member'), data: { avatar: replacement } })).status()).toBe(200);
      const after = avatarOf(await clubRead(request, 'member'), 'member');
      expect(after).toMatch(IMAGE_URL);
      expect(after).not.toBe(before);
      const served = await request.get(after);
      expect(Buffer.compare(await served.body(), Buffer.from(replacement.split(',')[1], 'base64'))).toBe(0);

      // Put the member's avatar back for the other tests
      expect((await request.put(`${API}/auth/profile`, { headers: auth('member'), data: { avatar: PNG } })).status()).toBe(200);
    });

    test('an SVG avatar is stored but never served', async ({ request }) => {
      const person = await register(request, 'svg');
      const svg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
      expect((await request.put(`${API}/auth/profile`, { headers: { Authorization: `Bearer ${person.token}` }, data: { avatar: svg } })).status()).toBe(200);
      const search = await request.get(`${API}/auth/users/search?query=${person.username}`, { headers: auth('outsider') });
      const [match] = (await search.json()).users;
      expect(match.avatar).toMatch(IMAGE_URL);
      expect((await request.get(match.avatar)).status()).toBe(404);
    });

    test('the Members list shows 30 members at a time, and their avatars load', async ({ page }) => {
      const fakes = Array.from({ length: 33 }, (_, i) => ({
        _id: `${'f'.repeat(20)}${String(i).padStart(4, '0')}`,
        username: `pagefake_${i}`,
        name: `Page Fake ${i}`,
        useDisplayName: false,
        avatar: '',
        cars: [],
      }));
      // The real club, with 33 more members than it has
      await page.route(`**/api/clubs/${clubId}`, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.club.members = [...body.club.members, ...fakes];
        await route.fulfill({ response, json: body });
      });

      await login(page, 'member');
      await page.goto(`/club/${clubId}`);
      await page.getByRole('button', { name: 'View All', exact: true }).first().click();
      const dialog = page.getByRole('dialog', { name: /All Members \(36\)/ });
      await expect(dialog).toBeVisible();

      // A real member's avatar comes from the API's origin, so the CSP must allow it
      const avatar = dialog.locator(`img[alt="${users.member.username}"]`);
      await expect(avatar).toHaveAttribute('src', IMAGE_URL);
      await expect.poll(() => avatar.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

      await expect(dialog.getByText('@pagefake_26', { exact: true })).toBeVisible();
      await expect(dialog.getByText('@pagefake_27', { exact: true })).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Show 6 more members' }).click();
      await expect(dialog.getByText('@pagefake_32', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: /more members/ })).toHaveCount(0);
    });
  });

  test.describe('drive write responses', () => {
    test("a drive's update and cancel answer like the drive list, without the club's invite code", async ({ request }) => {
      const driveId = await createDrive(request, 'coLeader', `Bottleneck Edit ${suffix}`, 8, { image: PNG });
      const newImage = imageOf(500);

      const update = await request.put(`${API}/drives/${driveId}`, {
        headers: auth('leader'),
        data: { name: `Bottleneck Edited ${suffix}`, image: newImage },
      });
      expect(update.status()).toBe(200);
      const updateText = await update.text();
      expect(updateText).not.toContain(inviteCode);
      expect(updateText).not.toContain(newImage);
      const updated = JSON.parse(updateText).drive;
      expect(updated.club).toBe(clubId);
      expect(updated.name).toBe(`Bottleneck Edited ${suffix}`);
      expect(updated.createdBy.username).toBe(users.coLeader.username);
      expect(updated).not.toHaveProperty('image');
      expect(updated).not.toHaveProperty('photos');

      // The new route image was saved, though the response leaves it out
      const detail = await (await request.get(`${API}/drives/${driveId}`, { headers: auth('member') })).json();
      expect(detail.drive.image).toBe(newImage);

      // A co-leader may cancel a drive they created, and never sees the invite code
      const cancel = await request.post(`${API}/drives/${driveId}/cancel`, {
        headers: auth('coLeader'),
        data: { cancellationReason: 'Testing the response shape' },
      });
      expect(cancel.status()).toBe(200);
      const cancelText = await cancel.text();
      expect(cancelText).not.toContain(inviteCode);
      const cancelled = JSON.parse(cancelText).drive;
      expect(cancelled.isCancelled).toBe(true);
      expect(cancelled.club).toBe(clubId);
      expect(cancelled.createdBy.username).toBe(users.coLeader.username);
      expect(cancelled).not.toHaveProperty('image');
    });
  });

  test.describe('request bodies', () => {
    test('a body over 100 KB without a valid token is refused before it is read', async ({ request }) => {
      const big = 'x'.repeat(200 * 1024);
      const login = await request.post(`${API}/auth/login`, { data: { username: 'nobody', password: big } });
      expect(login.status()).toBe(413);

      // An image route takes a large body only from a signed-in user
      const profile = await request.put(`${API}/auth/profile`, {
        headers: { Authorization: 'Bearer not-a-real-token' },
        data: { avatar: imageOf(299_000) },
      });
      expect(profile.status()).toBe(413);
    });

    test('a malformed JSON body is a 400, not a server error', async ({ request }) => {
      const res = await request.post(`${API}/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: '{"username": "nobody",',
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).success).toBe(false);
    });

    test('a signed-in user can still save a full garage and a full gallery', async ({ request }) => {
      const photo = imageOf(299_000);
      const cars = Array.from({ length: 5 }, (_, i) => ({
        year: '2020', make: 'Mazda', model: `MX-5 ${i}`, photos: [photo, photo, photo, photo], isPrimary: i === 0,
      }));
      const garage = await request.put(`${API}/auth/profile`, { headers: auth('outsider'), data: { avatar: photo, cars } });
      expect(garage.status()).toBe(200);
      const saved = (await garage.json()).user;
      expect(saved.cars.flatMap((c: { photos: string[] }) => c.photos)).toHaveLength(20);

      const driveId = await createDrive(request, 'leader', `Bottleneck Gallery ${suffix}`, 9);
      const finish = await request.put(`${API}/drives/${driveId}`, { headers: auth('leader'), data: { isCompleted: true } });
      expect(finish.status()).toBe(200);
      const gallery = await request.post(`${API}/drives/${driveId}/photos`, {
        headers: auth('leader'),
        data: { photos: Array.from({ length: 12 }, () => photo) },
      });
      expect(gallery.status()).toBe(200);
      expect((await gallery.json()).photos).toHaveLength(12);
    });

    test('a route image over 300,000 characters is refused', async ({ request }) => {
      const tooBig = imageOf(300_001);
      const create = await request.post(`${API}/drives`, {
        headers: auth('leader'),
        data: { clubId, name: `Bottleneck Huge ${suffix}`, date: inDays(10), time: '10:00 AM', location: 'Test Lot', image: tooBig },
      });
      expect(create.status()).toBe(400);

      const update = await request.put(`${API}/drives/${laterDriveId}`, { headers: auth('leader'), data: { image: tooBig } });
      expect(update.status()).toBe(400);
    });
  });

  test.describe('leader summaries', () => {
    test("the leader dashboard and analytics count a club's RSVPs", async ({ request }) => {
      const dashboard = await (await request.get(`${API}/drives/dashboard`, { headers: auth('leader') })).json();
      const entry = dashboard.dashboard.find((d: { club: { _id: string } }) => d.club._id === clubId);
      const soon = entry.drives.find((d: { _id: string }) => d._id === soonDriveId);
      expect(soon.rsvpStats).toEqual({ going: 1, maybe: 1, notGoing: 0, totalRSVPs: 2, spotsLeft: 99 });
      const later = entry.drives.find((d: { _id: string }) => d._id === laterDriveId);
      expect(later.rsvpStats).toEqual({ going: 0, maybe: 0, notGoing: 0, totalRSVPs: 0, spotsLeft: 100 });
      expect(entry.club.inviteCode).toBe(inviteCode);

      // A co-leader sees the club here too, but the invite code is the leader's alone
      const coLed = await (await request.get(`${API}/drives/dashboard`, { headers: auth('coLeader') })).json();
      const coEntry = coLed.dashboard.find((d: { club: { _id: string } }) => d.club._id === clubId);
      expect(coEntry.drives.map((d: { _id: string }) => d._id)).toContain(soonDriveId);
      expect(coEntry.club).not.toHaveProperty('inviteCode');

      const analytics = await (await request.get(`${API}/drives/analytics`, { headers: auth('leader') })).json();
      const club = analytics.analytics.find((a: { club: { _id: string } }) => a.club._id === clubId);
      expect(club.club.memberCount).toBe(3);
      expect(club.mostActiveMember).toMatchObject({ username: users.member.username, rsvpCount: 1 });
      expect(club.mostPopularDrive.goingCount).toBe(1);
    });
  });

  test.describe('rate limits', () => {
    test('signed-in requests are counted per user, not per address', async ({ request }) => {
      for (const role of ['first', 'second']) {
        const person = await register(request, `rl${role}`);
        const res = await request.get(`${API}/clubs`, { headers: { Authorization: `Bearer ${person.token}` } });
        expect(res.status()).toBe(200);
        const limit = Number(res.headers()['ratelimit-limit']);
        expect(limit).toBeGreaterThan(0);
        // Their first request under their own budget, whatever else this address has sent
        expect(Number(res.headers()['ratelimit-remaining'])).toBe(limit - 1);
      }
    });
  });

  test.describe("RSVP counts with a club's drive list", () => {
    type ListedDrive = { _id: string; rsvpCounts?: Record<string, number> };

    test('members get each drive\'s counts with the list, and visitors get none', async ({ request }) => {
      for (const query of ['', '?page=1&limit=10']) {
        const res = await request.get(`${API}/drives/club/${clubId}${query}`, { headers: auth('member') });
        expect(res.status()).toBe(200);
        const drives: ListedDrive[] = (await res.json()).drives;
        const soon = drives.find((d) => d._id === soonDriveId)!;
        const later = drives.find((d) => d._id === laterDriveId)!;
        expect(soon.rsvpCounts).toEqual({ going: 1, maybe: 1, notGoing: 0, waitlisted: 0 });
        expect(later.rsvpCounts).toEqual({ going: 0, maybe: 0, notGoing: 0, waitlisted: 0 });
      }

      const visitor = await request.get(`${API}/drives/club/${clubId}`, { headers: auth('outsider') });
      expect(visitor.status()).toBe(200);
      for (const drive of (await visitor.json()).drives as ListedDrive[]) {
        expect(drive).not.toHaveProperty('rsvpCounts');
      }
    });

    test('the club page shows the going count without asking drive by drive', async ({ page }) => {
      const perDrive: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/rsvp-status')) perDrive.push(req.url());
      });

      await login(page, 'member');
      await page.goto(`/club/${clubId}`);
      await expect(page.getByText(soonDriveName).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('1 going')).toBeVisible();
      // Give anything the page fires after rendering the drives time to land
      await page.waitForTimeout(1000);
      expect(perDrive).toEqual([]);
    });
  });
});
