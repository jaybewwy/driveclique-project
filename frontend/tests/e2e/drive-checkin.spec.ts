import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-08 — Drive Check-In (Actual Attendance) ─────────────────────────────
// API-level tests: leader sends/resends a check-in request to "going" members,
// any "going" member can self check-in (with or without the notification),
// and check-in closes once the leader marks the drive completed.

test.describe('Drive check-in (UC-08)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `chkleader_${suffix}`, email: `chkleader_${suffix}@mail.com`, password: 'LeaderPass1!' };
  const goingMember = { username: `chkgoing_${suffix}`, email: `chkgoing_${suffix}@mail.com`, password: 'MemberPass1!' };
  const maybeMember = { username: `chkmaybe_${suffix}`, email: `chkmaybe_${suffix}@mail.com`, password: 'MemberPass1!' };

  let leaderToken = '';
  let goingToken = '';
  let maybeToken = '';
  let clubId = '';
  let driveId = '';

  test('register leader and two members', async ({ request }) => {
    for (const [user, setToken] of [
      [leader, (t: string) => (leaderToken = t)],
      [goingMember, (t: string) => (goingToken = t)],
      [maybeMember, (t: string) => (maybeToken = t)],
    ] as const) {
      const res = await request.post(`${API}/auth/register`, { data: user });
      expect(res.status()).toBe(201);
      const body = await res.json();
      setToken(body.token);
    }
  });

  test('leader creates a public club and members join', async ({ request }) => {
    const res = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Checkin Club ${suffix}`, description: 'Testing UC-08 drive check-in', isPrivate: false },
    });
    expect(res.status()).toBe(201);
    clubId = (await res.json()).club._id;

    for (const token of [goingToken, maybeToken]) {
      const joinRes = await request.post(`${API}/clubs/${clubId}/join`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(joinRes.status()).toBe(200);
    }
  });

  test('leader schedules a drive', async ({ request }) => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Checkin Test Drive', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(res.status()).toBe(201);
    driveId = (await res.json()).drive._id;
  });

  test('one member RSVPs going, the other RSVPs maybe', async ({ request }) => {
    const goingRes = await request.post(`${API}/drives/${driveId}/rsvp`, {
      headers: { Authorization: `Bearer ${goingToken}` },
      data: { status: 'going' },
    });
    expect(goingRes.status()).toBe(200);

    const maybeRes = await request.post(`${API}/drives/${driveId}/rsvp`, {
      headers: { Authorization: `Bearer ${maybeToken}` },
      data: { status: 'maybe' },
    });
    expect(maybeRes.status()).toBe(200);
  });

  test('"going" member sees a pending check-in status', async ({ request }) => {
    const res = await request.get(`${API}/drives/${driveId}/checkin-status`, {
      headers: { Authorization: `Bearer ${goingToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.checkedIn).toBe('pending');
    expect(body.isCompleted).toBe(false);
  });

  test('"maybe" member cannot check in (no going RSVP)', async ({ request }) => {
    const statusRes = await request.get(`${API}/drives/${driveId}/checkin-status`, {
      headers: { Authorization: `Bearer ${maybeToken}` },
    });
    expect(statusRes.status()).toBe(403);

    const submitRes = await request.post(`${API}/drives/${driveId}/checkin`, {
      headers: { Authorization: `Bearer ${maybeToken}` },
      data: { present: true },
    });
    expect(submitRes.status()).toBe(403);
  });

  test('non-leader cannot send the check-in notification', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/request-checkin`, {
      headers: { Authorization: `Bearer ${goingToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('"going" member can self check-in before any notification is sent', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/checkin`, {
      headers: { Authorization: `Bearer ${goingToken}` },
      data: { present: true },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).checkedIn).toBe('present');
  });

  test('member can change their check-in answer', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/checkin`, {
      headers: { Authorization: `Bearer ${goingToken}` },
      data: { present: false },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).checkedIn).toBe('not-present');
  });

  test('leader sends the check-in notification (resendable, no limit)', async ({ request }) => {
    const first = await request.post(`${API}/drives/${driveId}/request-checkin`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(first.status()).toBe(200);
    expect((await first.json()).checkInRequestedAt).toBeTruthy();

    const resend = await request.post(`${API}/drives/${driveId}/request-checkin`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(resend.status()).toBe(200);
  });

  test('leader sees check-in counts via rsvp-status', async ({ request }) => {
    const res = await request.get(`${API}/drives/${driveId}/rsvp-status`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.checkin.notPresent).toBe(1);
    expect(body.checkin.present).toBe(0);
    expect(body.checkInRequestedAt).toBeTruthy();
  });

  test('club analytics reflects the attendance rate after check-in was used', async ({ request }) => {
    const res = await request.get(`${API}/drives/analytics`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const clubAnalytics = body.analytics.find((a: { club: { _id: string } }) => a.club._id === clubId);
    expect(clubAnalytics.avgAttendanceRate).toBe(0); // 0 present / 1 going
  });

  test('leader marks the drive completed, closing check-in', async ({ request }) => {
    const res = await request.put(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { isCompleted: true },
    });
    expect(res.status()).toBe(200);
  });

  test('check-in is closed after completion — self check-in rejected', async ({ request }) => {
    const submitRes = await request.post(`${API}/drives/${driveId}/checkin`, {
      headers: { Authorization: `Bearer ${goingToken}` },
      data: { present: true },
    });
    expect(submitRes.status()).toBe(400);

    const statusRes = await request.get(`${API}/drives/${driveId}/checkin-status`, {
      headers: { Authorization: `Bearer ${goingToken}` },
    });
    expect(statusRes.status()).toBe(200);
    expect((await statusRes.json()).isCompleted).toBe(true);
  });

  test('check-in is closed after completion — leader resend rejected', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/request-checkin`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(res.status()).toBe(400);
  });
});
