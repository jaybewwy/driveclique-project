import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── Drive start times with real time zones ─────────────────────────────────
// Drives store `startsAt` (the exact instant) and `timeZone` (IANA zone the
// drive happens in), computed server-side from the calendar day and
// wall-clock time. API: the instant is right, the default zone applies,
// bad input is rejected, "must be in the future" uses the real start,
// recurring series keep their local time across a DST change, and edits
// re-resolve. UI: one Phoenix drive viewed from four zones shows the same
// day and "10:00 AM MST" everywhere, plus the viewer's own clock when it
// differs, on the club page, dashboard, and calendar.

// One worker, in order: the view and UI tests below use the drives and users
// the API block creates (the config's fullyParallel would otherwise split them)
test.describe.configure({ mode: 'serial' });

const DAY_MS = 24 * 60 * 60 * 1000;
const suffix = Date.now();

// "YYYY-MM-DD" for the UTC calendar day `days` from now
const utcDay = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

// The Saturday eight days before US DST ends (first Sunday of November), in
// the first year where that's still at least two days away. A weekly series
// from there has occurrences on both sides of the change.
function saturdayBeforeDstEnds(): string {
  for (let year = new Date().getUTCFullYear(); ; year++) {
    const nov1 = new Date(Date.UTC(year, 10, 1));
    const firstSunday = new Date(nov1.getTime() + ((7 - nov1.getUTCDay()) % 7) * DAY_MS);
    const saturday = new Date(firstSunday.getTime() - 8 * DAY_MS);
    if (saturday.getTime() > Date.now() + 2 * DAY_MS) return saturday.toISOString().slice(0, 10);
  }
}

async function login(page: Page, user: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

const leader = { username: `tzlead_${suffix}`, email: `tzlead_${suffix}@mail.com`, password: 'TzPass1!' };
const member = { username: `tzmember_${suffix}`, email: `tzmember_${suffix}@mail.com`, password: 'TzPass1!' };
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Shared across both describe blocks; set up by the first one
let leaderToken = '';
let memberToken = '';
let clubId = '';
let viewClubId = '';
const viewDriveDay = utcDay(10);
const viewDriveName = `Four Zones Run ${suffix}`;
const viewDriveStartsAt = `${viewDriveDay}T17:00:00.000Z`; // 10:00 AM MST

test.describe('Drive time zones — API', () => {
  test.describe.configure({ mode: 'serial' });

  test('setup: leader, member, and two clubs (one holds only the four-zones drive)', async ({ request }) => {
    const l = await request.post(`${API}/auth/register`, { data: leader });
    expect(l.status()).toBe(201);
    leaderToken = (await l.json()).token;
    const m = await request.post(`${API}/auth/register`, { data: member });
    expect(m.status()).toBe(201);
    memberToken = (await m.json()).token;

    for (const [name, assign] of [
      [`TZ API Club ${suffix}`, (id: string) => { clubId = id; }],
      [`TZ View Club ${suffix}`, (id: string) => { viewClubId = id; }],
    ] as const) {
      const res = await request.post(`${API}/clubs`, {
        headers: auth(leaderToken),
        data: { name, description: 'Testing drive time zones', isPrivate: false },
      });
      expect(res.status()).toBe(201);
      const id = (await res.json()).club._id;
      assign(id);
      const join = await request.post(`${API}/clubs/${id}/join`, { headers: auth(memberToken) });
      expect(join.status()).toBe(200);
    }
  });

  test('a drive in America/Phoenix stores its real start instant', async ({ request }) => {
    const res = await request.post(`${API}/drives`, {
      headers: auth(leaderToken),
      data: { clubId: viewClubId, name: viewDriveName, date: viewDriveDay, time: '10:00 AM', timeZone: 'America/Phoenix', location: 'Desert Lot' },
    });
    expect(res.status()).toBe(201);
    const { drive } = await res.json();
    expect(drive.startsAt).toBe(viewDriveStartsAt);
    expect(drive.timeZone).toBe('America/Phoenix');
    expect(drive.date).toBe(`${viewDriveDay}T00:00:00.000Z`);
    expect(drive.time).toBe('10:00 AM');
  });

  test('omitting the zone uses the America/Los_Angeles default; times are normalized', async ({ request }) => {
    const day = utcDay(12);
    const res = await request.post(`${API}/drives`, {
      headers: auth(leaderToken),
      data: { clubId, name: 'Default Zone Drive', date: day, time: '09:00 AM', location: 'Coast Lot' },
    });
    expect(res.status()).toBe(201);
    const { drive } = await res.json();
    expect(drive.timeZone).toBe('America/Los_Angeles');
    expect(drive.time).toBe('9:00 AM');
    // 9 AM Pacific is 16:00 UTC in daylight time, 17:00 UTC in standard time
    const pacificIsDaylight = new Date(`${day}T12:00:00Z`)
      .toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' }).endsWith('PDT');
    expect(drive.startsAt).toBe(`${day}T${pacificIsDaylight ? '16' : '17'}:00:00.000Z`);
  });

  test('an unknown zone or unparseable time is rejected', async ({ request }) => {
    const base = { clubId, name: 'Bad Input Drive', date: utcDay(12), location: 'Nowhere' };
    const badZone = await request.post(`${API}/drives`, { headers: auth(leaderToken), data: { ...base, time: '10:00 AM', timeZone: 'Mars/Olympus_Mons' } });
    expect(badZone.status()).toBe(400);
    const badTime = await request.post(`${API}/drives`, { headers: auth(leaderToken), data: { ...base, time: 'sunrise' } });
    expect(badTime.status()).toBe(400);
  });

  test('"must be in the future" uses the real start: later today is fine, earlier today is not', async ({ request }) => {
    // Built in UTC with 24-hour times, which the API also accepts
    const at = (offsetMs: number) => {
      const t = new Date(Date.now() + offsetMs).toISOString();
      return { date: t.slice(0, 10), time: t.slice(11, 16) };
    };
    const base = { clubId, name: 'Same Day Drive', location: 'Nearby Lot', timeZone: 'UTC' };
    const later = await request.post(`${API}/drives`, { headers: auth(leaderToken), data: { ...base, ...at(3 * 60 * 60 * 1000) } });
    expect(later.status()).toBe(201);
    const earlier = await request.post(`${API}/drives`, { headers: auth(leaderToken), data: { ...base, ...at(-60 * 60 * 1000) } });
    expect(earlier.status()).toBe(400);
  });

  test('a weekly series keeps 10:00 AM local on both sides of the DST change', async ({ request }) => {
    const anchor = saturdayBeforeDstEnds();
    const res = await request.post(`${API}/drives`, {
      headers: auth(leaderToken),
      data: {
        clubId, name: 'DST Series', date: anchor, time: '10:00 AM', timeZone: 'America/Los_Angeles',
        location: 'Coast Lot', repeat: { frequency: 'weekly', count: 3 },
      },
    });
    expect(res.status()).toBe(201);
    const drives = [...(await res.json()).drives].sort((a, b) => a.recurrence.index - b.recurrence.index);
    // Two Saturdays in PDT (UTC-7), then one in PST (UTC-8)
    expect(drives.map((d) => d.startsAt.slice(11, 16))).toEqual(['17:00', '17:00', '18:00']);
    for (const d of drives) {
      expect(d.time).toBe('10:00 AM');
      expect(new Date(d.startsAt).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })).toBe('10:00 AM');
    }
    // Calendar days are exactly a week apart
    expect(new Date(drives[2].date).getTime() - new Date(drives[0].date).getTime()).toBe(14 * DAY_MS);
  });

  test('editing the time or zone re-resolves the start; other edits leave it alone', async ({ request }) => {
    const day = utcDay(14);
    const created = await request.post(`${API}/drives`, {
      headers: auth(leaderToken),
      data: { clubId, name: 'Editable Drive', date: day, time: '10:00 AM', timeZone: 'America/Phoenix', location: 'Desert Lot' },
    });
    const driveId = (await created.json()).drive._id;
    const update = async (data: Record<string, unknown>) => {
      const res = await request.put(`${API}/drives/${driveId}`, { headers: auth(leaderToken), data });
      expect(res.status()).toBe(200);
      return (await res.json()).drive;
    };

    expect((await update({ time: '2:00 PM' })).startsAt).toBe(`${day}T21:00:00.000Z`);
    const moved = await update({ timeZone: 'Asia/Tokyo' });
    expect(moved.timeZone).toBe('Asia/Tokyo');
    expect(moved.startsAt).toBe(`${day}T05:00:00.000Z`); // 2:00 PM JST
    expect((await update({ name: 'Renamed Drive' })).startsAt).toBe(`${day}T05:00:00.000Z`);

    const bad = await request.put(`${API}/drives/${driveId}`, { headers: auth(leaderToken), data: { time: 'noonish' } });
    expect(bad.status()).toBe(400);
  });

  test('club drives, calendar, and ICS responses carry startsAt and timeZone', async ({ request }) => {
    const clubDrives = await request.get(`${API}/drives/club/${viewClubId}`, { headers: auth(memberToken) });
    const [drive] = (await clubDrives.json()).drives;
    expect(drive.startsAt).toBe(viewDriveStartsAt);

    const [year, month] = viewDriveDay.split('-').map(Number);
    const calendar = await request.get(`${API}/drives/calendar?year=${year}&month=${month}`, { headers: auth(memberToken) });
    const entry = (await calendar.json()).drives.find((d: { name: string }) => d.name === viewDriveName);
    expect(entry).toMatchObject({ startsAt: viewDriveStartsAt, timeZone: 'America/Phoenix' });

    const ics = await request.get(`${API}/drives/${drive._id}/export.ics`, { headers: auth(memberToken) });
    expect(await ics.text()).toContain(`DTSTART:${viewDriveDay.replace(/-/g, '')}T170000Z`);
  });
});

// The same 10:00 AM MST drive, seen from four zones
const expectedDate = new Date(`${viewDriveDay}T00:00:00Z`)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function expectedTimeLabel(viewerZone: string) {
  const start = new Date(viewDriveStartsAt);
  const clock = (timeZone: string) => start.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  const day = (timeZone: string) => start.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
  if (clock(viewerZone) === clock('America/Phoenix') && day(viewerZone) === day('America/Phoenix')) return '10:00 AM MST';
  const dayPrefix = day(viewerZone) === day('America/Phoenix') ? '' : `${day(viewerZone)}, `;
  return `10:00 AM MST (${dayPrefix}${clock(viewerZone)} your time)`;
}

for (const viewerZone of ['America/Phoenix', 'America/New_York', 'UTC', 'Asia/Tokyo']) {
  test.describe(`Drive time zones — viewed from ${viewerZone}`, () => {
    test.use({ timezoneId: viewerZone });
    const label = expectedTimeLabel(viewerZone);

    test(`club page, dashboard, and calendar show ${expectedDate} · ${label}`, async ({ page }) => {
      await login(page, member);

      // Dashboard (the page login lands on)
      const dashCard = page.getByRole('button', { name: new RegExp(viewDriveName) });
      await expect(dashCard).toContainText(expectedDate);
      await expect(dashCard).toContainText(label);

      // Club page
      await page.goto(`/club/${viewClubId}`);
      await expect(page.getByText(viewDriveName).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(expectedDate, { exact: true }).first()).toBeVisible();
      if (viewerZone === 'America/Phoenix') {
        await expect(page.getByText(/your time/)).toHaveCount(0);
      }

      // Calendar: opens on the viewer's current month; step forward to the drive's
      await page.goto('/calendar');
      const viewerMonth = new Date().toLocaleDateString('en-US', { timeZone: viewerZone, year: 'numeric', month: 'numeric' });
      const [viewerM, viewerY] = viewerMonth.split('/').map(Number);
      const [driveY, driveM] = viewDriveDay.split('-').map(Number);
      for (let i = 0; i < (driveY - viewerY) * 12 + (driveM - viewerM); i++) {
        await page.getByRole('button', { name: 'View next month' }).first().click();
      }
      await expect(page.getByText(viewDriveName).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    });
  });
}

test.describe('Drive time zones — scheduling from the UI', () => {
  test.use({ timezoneId: 'America/New_York' });

  test("the schedule form defaults to the leader's zone and saves it", async ({ page, request }) => {
    // Keep the location autocomplete off the live geocoder
    await page.route('https://nominatim.openstreetmap.org/**', (route) => route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: [] }));
    await page.route('https://ipapi.co/**', (route) => route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: {} }));

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await page.getByRole('button', { name: /Schedule a Drive/i }).first().click();
    await expect(page.getByLabel('Time zone')).toHaveValue('America/New_York');

    const driveName = `UI Zone Drive ${suffix}`;
    await page.getByPlaceholder('e.g. Mountain Run, Cars and Coffee').fill(driveName);
    const monthYearSpan = page.locator('span').filter({ hasText: /^[A-Z][a-z]+ \d{4}$/ }).first();
    await monthYearSpan.locator('..').locator('button').last().click(); // next month, so day 15 is in the future
    await page.locator('button').filter({ hasText: /^15$/ }).and(page.locator('button:not([disabled])')).first().click({ force: true });
    await page.getByRole('button', { name: '10:00 AM', exact: true }).click();
    await page.locator('#schedule-drive-location').fill('Harbor Lot');
    await page.getByRole('button', { name: /^Schedule Drive$/i }).click();
    // This club already has several upcoming drives, so the new one may be
    // past the page's short list; wait for the modal to close, then check the API
    await expect(page.getByRole('heading', { name: /Schedule a Drive/i })).toBeHidden({ timeout: 10_000 });

    const findSaved = async () => {
      const res = await request.get(`${API}/drives/club/${clubId}`, { headers: auth(leaderToken) });
      return (await res.json()).drives.find((d: { name: string }) => d.name === driveName);
    };
    await expect.poll(findSaved, { timeout: 10_000 }).toBeTruthy();
    const saved = await findSaved();
    expect(saved.timeZone).toBe('America/New_York');
    expect(new Date(saved.startsAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })).toBe('10:00 AM');
  });
});
