import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-33 — Calendar Export (.ics) ─────────────────────────────────────────
// API-level coverage (this project's established convention — see
// drive-rating.spec.ts / drive-checkin.spec.ts). Both new endpoints
// (single-drive export, full-schedule export) plus the route-ordering fix
// that keeps /my-rsvps/export.ics from being swallowed by /:driveId/export.ics.

test.describe('Calendar export (UC-33)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `icsleader_${suffix}`, email: `icsleader_${suffix}@mail.com`, password: 'IcsPass1!' };
  const member = { username: `icsmember_${suffix}`, email: `icsmember_${suffix}@mail.com`, password: 'IcsPass1!' };
  const outsider = { username: `icsoutsider_${suffix}`, email: `icsoutsider_${suffix}@mail.com`, password: 'IcsPass1!' };

  let leaderToken = '';
  let memberToken = '';
  let outsiderToken = '';
  let clubId = '';
  let timedDriveId = '';
  let allDayDriveId = '';
  let notGoingDriveId = '';
  let cancelledDriveId = '';

  test('setup: register three users, leader creates a club, member joins', async ({ request }) => {
    const leaderRes = await request.post(`${API}/auth/register`, { data: leader });
    expect(leaderRes.status()).toBe(201);
    leaderToken = (await leaderRes.json()).token;

    const memberRes = await request.post(`${API}/auth/register`, { data: member });
    expect(memberRes.status()).toBe(201);
    memberToken = (await memberRes.json()).token;

    const outsiderRes = await request.post(`${API}/auth/register`, { data: outsider });
    expect(outsiderRes.status()).toBe(201);
    outsiderToken = (await outsiderRes.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `ICS Export Club ${suffix}`, description: 'Testing UC-33 calendar export', isPrivate: false },
    });
    expect(clubRes.status()).toBe(201);
    clubId = (await clubRes.json()).club._id;

    const joinRes = await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${memberToken}` } });
    expect(joinRes.status()).toBe(200);
  });

  test('setup: leader schedules four drives (timed, unparseable-time, one the member will not-going, one to cancel)', async ({ request }) => {
    const future = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const timedRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Timed Export Drive', date: future(5), time: '2:30 PM', location: 'Test Lot', description: 'Export test.' },
    });
    expect(timedRes.status()).toBe(201);
    timedDriveId = (await timedRes.json()).drive._id;

    // `time` is a free-text string with no pattern validation at the route
    // level (only `required: true, type: 'string'`) — a value that doesn't
    // match "H:MM AM/PM" is a real, reachable state, not a fabricated edge case.
    const allDayRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'All-Day Fallback Drive', date: future(6), time: 'TBD', location: 'Test Lot' },
    });
    expect(allDayRes.status()).toBe(201);
    allDayDriveId = (await allDayRes.json()).drive._id;

    const notGoingRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Not Going Drive', date: future(7), time: '9:00 AM', location: 'Test Lot' },
    });
    expect(notGoingRes.status()).toBe(201);
    notGoingDriveId = (await notGoingRes.json()).drive._id;

    const cancelledRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Cancelled Drive', date: future(8), time: '9:00 AM', location: 'Test Lot' },
    });
    expect(cancelledRes.status()).toBe(201);
    cancelledDriveId = (await cancelledRes.json()).drive._id;
  });

  test('setup: member RSVPs going/not-going, leader cancels the fourth drive', async ({ request }) => {
    for (const id of [timedDriveId, allDayDriveId, cancelledDriveId]) {
      const rsvpRes = await request.post(`${API}/drives/${id}/rsvp`, {
        headers: { Authorization: `Bearer ${memberToken}` },
        data: { status: 'going' },
      });
      expect(rsvpRes.status()).toBe(200);
    }

    const notGoingRsvpRes = await request.post(`${API}/drives/${notGoingDriveId}/rsvp`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { status: 'not-going' },
    });
    expect(notGoingRsvpRes.status()).toBe(200);

    const cancelRes = await request.post(`${API}/drives/${cancelledDriveId}/cancel`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { cancellationReason: 'Testing the cancelled-drive exclusion from schedule export' },
    });
    expect(cancelRes.status()).toBe(200);
  });

  test('GET /drives/:driveId/export.ics returns a valid single-event VCALENDAR', async ({ request }) => {
    const res = await request.get(`${API}/drives/${timedDriveId}/export.ics`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/calendar');
    expect(res.headers()['content-disposition']).toContain('attachment');

    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain(`UID:drive-${timedDriveId}@driveclique.app`);
    expect(body).toMatch(/SUMMARY:Timed Export Drive/);
    expect(body).toMatch(/DTSTART:\d{8}T143000/); // 2:30 PM -> 14:30:00
    expect(body).toMatch(/DTEND:\d{8}T153000/); // +1 hour
    expect(body).toContain('END:VEVENT');
    expect(body).toContain('END:VCALENDAR');
  });

  test('a drive with an unparseable time falls back to an all-day VALUE=DATE event', async ({ request }) => {
    const res = await request.get(`${API}/drives/${allDayDriveId}/export.ics`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
    expect(body).toContain('DURATION:P1D');
    expect(body).not.toMatch(/DTSTART:\d{8}T/); // no timed DTSTART present
  });

  test('a non-member is rejected with 403', async ({ request }) => {
    const res = await request.get(`${API}/drives/${timedDriveId}/export.ics`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('a nonexistent drive returns 404', async ({ request }) => {
    const res = await request.get(`${API}/drives/000000000000000000000000/export.ics`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(404);
  });

  test('single-drive export requires authentication', async ({ request }) => {
    const res = await request.get(`${API}/drives/${timedDriveId}/export.ics`);
    expect(res.status()).toBe(401);
  });

  test('GET /drives/my-rsvps/export.ics is not shadowed by /:driveId/export.ics and returns the member\'s upcoming schedule', async ({ request }) => {
    const res = await request.get(`${API}/drives/my-rsvps/export.ics`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/calendar');

    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    // going + upcoming -> included
    expect(body).toContain(`UID:drive-${timedDriveId}@driveclique.app`);
    expect(body).toContain(`UID:drive-${allDayDriveId}@driveclique.app`);
    // not-going -> excluded
    expect(body).not.toContain(`UID:drive-${notGoingDriveId}@driveclique.app`);
    // going but cancelled -> excluded
    expect(body).not.toContain(`UID:drive-${cancelledDriveId}@driveclique.app`);
  });

  test('my-rsvps schedule export requires authentication', async ({ request }) => {
    const res = await request.get(`${API}/drives/my-rsvps/export.ics`);
    expect(res.status()).toBe(401);
  });

  test('a member with zero going/maybe RSVPs still gets a valid, empty VCALENDAR (not an error)', async ({ request }) => {
    const res = await request.get(`${API}/drives/my-rsvps/export.ics`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
    expect(body).not.toContain('BEGIN:VEVENT');
  });
});
