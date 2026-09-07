import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-24 — Club Event Calendar View ───────────────────────────────────────
// API-level tests for GET /api/drives/calendar: month-range filtering, cancelled
// drives excluded (matching this app's existing upcoming/past-drives convention),
// myRsvpStatus reflecting a real RSVP, cross-club isolation (a non-member sees
// nothing), and input validation.

test.describe('Drive calendar (UC-24)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `calleader_${suffix}`, email: `calleader_${suffix}@mail.com`, password: 'CalPass1!' };
  const member = { username: `calmember_${suffix}`, email: `calmember_${suffix}@mail.com`, password: 'CalPass1!' };
  const outsider = { username: `caloutsider_${suffix}`, email: `caloutsider_${suffix}@mail.com`, password: 'CalPass1!' };

  let leaderToken = '';
  let memberToken = '';
  let outsiderToken = '';
  let clubId = '';
  let driveInMonthId = '';
  let driveOtherMonthId = '';
  let driveCancelledId = '';

  // Two dates guaranteed to fall in different calendar months (a 35-day gap
  // always crosses at least one month boundary, since no month exceeds 31 days).
  const inMonthDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const otherMonthDate = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
  const targetYear = inMonthDate.getFullYear();
  const targetMonth = inMonthDate.getMonth() + 1; // 1-12

  test('register leader, member, and an outsider with no shared club', async ({ request }) => {
    for (const [user, setToken] of [
      [leader, (t: string) => (leaderToken = t)],
      [member, (t: string) => (memberToken = t)],
      [outsider, (t: string) => (outsiderToken = t)],
    ] as const) {
      const res = await request.post(`${API}/auth/register`, { data: user });
      expect(res.status()).toBe(201);
      setToken((await res.json()).token);
    }
  });

  test('leader creates a club and member joins', async ({ request }) => {
    const res = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Calendar Test Club ${suffix}`, description: 'Testing UC-24 calendar view', isPrivate: false },
    });
    expect(res.status()).toBe(201);
    clubId = (await res.json()).club._id;

    const joinRes = await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${memberToken}` } });
    expect(joinRes.status()).toBe(200);
  });

  test('leader schedules three drives: one in the target month, one in a different month, one to be cancelled', async ({ request }) => {
    const driveInMonth = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'In-Month Drive', date: inMonthDate.toISOString(), time: '10:00 AM', location: 'Test Lot A' },
    });
    expect(driveInMonth.status()).toBe(201);
    driveInMonthId = (await driveInMonth.json()).drive._id;

    const driveOtherMonth = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Other-Month Drive', date: otherMonthDate.toISOString(), time: '11:00 AM', location: 'Test Lot B' },
    });
    expect(driveOtherMonth.status()).toBe(201);
    driveOtherMonthId = (await driveOtherMonth.json()).drive._id;

    const driveCancelled = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Cancelled Drive', date: inMonthDate.toISOString(), time: '12:00 PM', location: 'Test Lot C' },
    });
    expect(driveCancelled.status()).toBe(201);
    driveCancelledId = (await driveCancelled.json()).drive._id;

    const cancelRes = await request.post(`${API}/drives/${driveCancelledId}/cancel`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { cancellationReason: 'Testing the calendar exclusion behavior' },
    });
    expect(cancelRes.status()).toBe(200);
  });

  test('calendar for the target month includes the in-month drive, excludes the other-month and cancelled drives', async ({ request }) => {
    const res = await request.get(`${API}/drives/calendar`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      params: { year: targetYear, month: targetMonth },
    });
    expect(res.status()).toBe(200);
    const { drives } = await res.json();

    const ids = drives.map((d: { _id: string }) => d._id);
    expect(ids).toContain(driveInMonthId);
    expect(ids).not.toContain(driveOtherMonthId);
    expect(ids).not.toContain(driveCancelledId);

    const found = drives.find((d: { _id: string }) => d._id === driveInMonthId);
    expect(found.club.name).toBe(`Calendar Test Club ${suffix}`);
    expect(found.myRsvpStatus).toBeNull();
  });

  test('myRsvpStatus reflects a real RSVP after the member RSVPs going', async ({ request }) => {
    const rsvpRes = await request.post(`${API}/drives/${driveInMonthId}/rsvp`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { status: 'going' },
    });
    expect(rsvpRes.status()).toBe(200);

    const res = await request.get(`${API}/drives/calendar`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      params: { year: targetYear, month: targetMonth },
    });
    const { drives } = await res.json();
    const found = drives.find((d: { _id: string }) => d._id === driveInMonthId);
    expect(found.myRsvpStatus).toBe('going');
  });

  test('an outsider with no shared club sees an empty calendar for the same month', async ({ request }) => {
    const res = await request.get(`${API}/drives/calendar`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
      params: { year: targetYear, month: targetMonth },
    });
    expect(res.status()).toBe(200);
    const { drives } = await res.json();
    expect(drives).toEqual([]);
  });

  test('rejects a non-numeric year', async ({ request }) => {
    const res = await request.get(`${API}/drives/calendar`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      params: { year: 'not-a-year', month: targetMonth },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects an out-of-range month', async ({ request }) => {
    const res = await request.get(`${API}/drives/calendar`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      params: { year: targetYear, month: 13 },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects a missing month', async ({ request }) => {
    const res = await request.get(`${API}/drives/calendar`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      params: { year: targetYear },
    });
    expect(res.status()).toBe(400);
  });

  test('requires authentication', async ({ request }) => {
    const res = await request.get(`${API}/drives/calendar`, { params: { year: targetYear, month: targetMonth } });
    expect(res.status()).toBe(401);
  });
});
