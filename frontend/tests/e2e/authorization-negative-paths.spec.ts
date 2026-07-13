import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── Authorization negative-path coverage ───────────────────────────────────
// Every leader-only endpoint in the API is supposed to reject a non-leader
// with 403. Before this suite, only 2 of the 14 leader-only endpoints
// (getDriveAttendees, requestCheckin) had a test proving that rejection
// actually happens — the other 12 only had positive-path ("leader succeeds")
// coverage, meaning a regression that accidentally dropped or weakened a
// leader check would ship silently. This suite closes that gap: one test per
// leader-only endpoint, run as a non-leader member, asserting exactly 403.
//
// getDriveAttendees and requestCheckin are intentionally NOT duplicated here
// — see drive-attendee-list.spec.ts and drive-checkin.spec.ts.
//
// Two endpoints are deliberately NOT covered here because they are not
// hard-403 boundaries by design: GET /api/drives/dashboard and
// GET /api/drives/analytics both self-scope to `Club.find({ leader: userId })`
// and correctly return an empty list for a non-leader rather than rejecting —
// that's a legitimate "zero", not a masked failure, so a 403 test there would
// be asserting the wrong contract.

test.describe('Authorization negative paths (leader-only endpoints)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `authzleader_${suffix}`, email: `authzleader_${suffix}@mail.com`, password: 'LeaderPass1!' };
  const member = { username: `authzmember_${suffix}`, email: `authzmember_${suffix}@mail.com`, password: 'MemberPass1!' };

  let leaderToken = '';
  let memberToken = '';
  let clubId = '';
  let driveId = '';

  const PLACEHOLDER_ID = '000000000000000000000000'; // syntactically valid ObjectId, doesn't need to exist

  test('register leader and member, leader creates a club, member joins, leader schedules a drive', async ({ request }) => {
    const leaderRes = await request.post(`${API}/auth/register`, { data: leader });
    expect(leaderRes.status()).toBe(201);
    leaderToken = (await leaderRes.json()).token;

    const memberRes = await request.post(`${API}/auth/register`, { data: member });
    expect(memberRes.status()).toBe(201);
    memberToken = (await memberRes.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Authz Negative Path Club ${suffix}`, description: 'Testing leader-only endpoint rejection', isPrivate: false },
    });
    expect(clubRes.status()).toBe(201);
    clubId = (await clubRes.json()).club._id;

    const joinRes = await request.post(`${API}/clubs/${clubId}/join`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.status()).toBe(200);

    const futureDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
    const driveRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Authz Negative Path Drive', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(driveRes.status()).toBe(201);
    driveId = (await driveRes.json()).drive._id;
  });

  test('POST /clubs/:clubId/handle-request rejects a non-leader with 403', async ({ request }) => {
    const res = await request.post(`${API}/clubs/${clubId}/handle-request`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { requestId: PLACEHOLDER_ID, status: 'accepted' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST /clubs/:clubId/toggle-privacy rejects a non-leader with 403', async ({ request }) => {
    const res = await request.post(`${API}/clubs/${clubId}/toggle-privacy`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { isPrivate: true },
    });
    expect(res.status()).toBe(403);
  });

  test('PUT /clubs/:clubId rejects a non-leader with 403', async ({ request }) => {
    const res = await request.put(`${API}/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { description: 'Attempted takeover edit from a non-leader account' },
    });
    expect(res.status()).toBe(403);
  });

  test('DELETE /clubs/:clubId rejects a non-leader with 403', async ({ request }) => {
    const res = await request.delete(`${API}/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { deletionReason: 'Attempted non-leader deletion', leaderEmail: member.email },
    });
    expect(res.status()).toBe(403);
  });

  test('PUT /clubs/:clubId/transfer rejects a non-leader with 403', async ({ request }) => {
    const res = await request.put(`${API}/clubs/${clubId}/transfer`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { newLeaderId: PLACEHOLDER_ID },
    });
    expect(res.status()).toBe(403);
  });

  test('DELETE /clubs/:clubId/members/:memberId rejects a non-leader with 403', async ({ request }) => {
    const res = await request.delete(`${API}/clubs/${clubId}/members/${PLACEHOLDER_ID}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('POST /clubs/:clubId/announcements rejects a non-leader with 403', async ({ request }) => {
    const res = await request.post(`${API}/clubs/${clubId}/announcements`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { body: 'A non-leader should not be able to post this' },
    });
    expect(res.status()).toBe(403);
  });

  test('DELETE /clubs/:clubId/announcements/:announcementId rejects a non-leader with 403', async ({ request }) => {
    const res = await request.delete(`${API}/clubs/${clubId}/announcements/${PLACEHOLDER_ID}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('POST /drives rejects a non-leader with 403', async ({ request }) => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { clubId, name: 'Should Not Be Created', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST /drives/:driveId/cancel rejects a non-leader with 403', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/cancel`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { cancellationReason: 'Attempted non-leader cancellation' },
    });
    expect(res.status()).toBe(403);
  });

  test('PUT /drives/:driveId rejects a non-leader with 403', async ({ request }) => {
    const res = await request.put(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { name: 'Should Not Be Renamed' },
    });
    expect(res.status()).toBe(403);
  });

  test('DELETE /drives/:driveId rejects a non-leader with 403', async ({ request }) => {
    const res = await request.delete(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('the drive and club survived every rejected non-leader attempt above', async ({ request }) => {
    const driveRes = await request.get(`${API}/drives/${driveId}/rsvp-status`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(driveRes.status()).toBe(200);

    const clubRes = await request.get(`${API}/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(clubRes.status()).toBe(200);
    const club = (await clubRes.json()).club;
    expect(club.name).toBe(`Authz Negative Path Club ${suffix}`);
    expect(club.isPrivate).toBe(false);
  });
});
