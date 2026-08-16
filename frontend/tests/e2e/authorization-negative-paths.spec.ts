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
  // UC-10 — a co-leader account, kept separate from `member` above so promoting
  // it doesn't change the expected outcome of the 12 existing negative-path
  // tests below (which all assert `member` — a true regular member — gets 403).
  const coLeader = { username: `authzcoleader_${suffix}`, email: `authzcoleader_${suffix}@mail.com`, password: 'CoLeaderPass1!' };
  const coLeader2 = { username: `authzcoleader2_${suffix}`, email: `authzcoleader2_${suffix}@mail.com`, password: 'CoLeaderPass2!' };

  let leaderToken = '';
  let memberToken = '';
  let coLeaderToken = '';
  let coLeader2Token = '';
  let coLeaderId = '';
  let coLeader2Id = '';
  let clubId = '';
  let clubInviteCode = '';
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
    const club = (await clubRes.json()).club;
    clubId = club._id;
    clubInviteCode = club.inviteCode;

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

  test('UC-10 setup: register + join two co-leader candidates, leader promotes both', async ({ request }) => {
    const coLeaderRes = await request.post(`${API}/auth/register`, { data: coLeader });
    expect(coLeaderRes.status()).toBe(201);
    coLeaderToken = (await coLeaderRes.json()).token;

    const coLeader2Res = await request.post(`${API}/auth/register`, { data: coLeader2 });
    expect(coLeader2Res.status()).toBe(201);
    coLeader2Token = (await coLeader2Res.json()).token;

    const join1 = await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${coLeaderToken}` } });
    expect(join1.status()).toBe(200);
    const join2 = await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${coLeader2Token}` } });
    expect(join2.status()).toBe(200);

    // Resolve both users' ids via the club's member list (more reliable than
    // trusting the register response's shape, which varies across this app's history)
    const clubRes = await request.get(`${API}/clubs/${clubId}`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    const clubMembers = (await clubRes.json()).club.members;
    coLeaderId = clubMembers.find((m) => m.username === coLeader.username)._id;
    coLeader2Id = clubMembers.find((m) => m.username === coLeader2.username)._id;

    const promote1 = await request.put(`${API}/clubs/${clubId}/promote`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { userId: coLeaderId },
    });
    expect(promote1.status()).toBe(200);

    const promote2 = await request.put(`${API}/clubs/${clubId}/promote`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { userId: coLeader2Id },
    });
    expect(promote2.status()).toBe(200);
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

  // ─── UC-10 — co-leader positive paths (things a co-leader IS allowed to do) ──

  let coLeaderDriveId = '';

  test('co-leader can create a drive', async ({ request }) => {
    const futureDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
      data: { clubId, name: 'Co-Leader Created Drive', date: futureDate, time: '11:00 AM', location: 'Co-Leader Lot' },
    });
    expect(res.status()).toBe(201);
    coLeaderDriveId = (await res.json()).drive._id;
  });

  test('co-leader can cancel a drive they created', async ({ request }) => {
    const res = await request.post(`${API}/drives/${coLeaderDriveId}/cancel`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
      data: { cancellationReason: 'Co-leader cancelling their own drive' },
    });
    expect(res.status()).toBe(200);
  });

  test('co-leader cannot cancel a drive they did not create', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/cancel`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
      data: { cancellationReason: 'Co-leader attempting to cancel the leader\'s drive' },
    });
    expect(res.status()).toBe(403);
  });

  test('co-leader can post and delete an announcement', async ({ request }) => {
    const postRes = await request.post(`${API}/clubs/${clubId}/announcements`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
      data: { body: 'Posted by a co-leader' },
    });
    expect(postRes.status()).toBe(201);
    const announcementId = (await postRes.json()).announcement._id;

    const deleteRes = await request.delete(`${API}/clubs/${clubId}/announcements/${announcementId}`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
    });
    expect(deleteRes.status()).toBe(200);
  });

  test('co-leader can view drive attendees and request check-in', async ({ request }) => {
    const attendeesRes = await request.get(`${API}/drives/${driveId}/attendees`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
    });
    expect(attendeesRes.status()).toBe(200);

    const checkinRes = await request.post(`${API}/drives/${driveId}/request-checkin`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
    });
    expect(checkinRes.status()).toBe(200);
  });

  test('co-leader passes the auth check on handle-request (reaches request-lookup, not blocked at 403)', async ({ request }) => {
    // Same technique the file's own negative-path tests use: a placeholder id
    // that doesn't exist proves the leader-check ran (and passed) before the
    // resource lookup, since a real 403 would short-circuit before ever
    // reaching the "request not found" branch.
    const res = await request.post(`${API}/clubs/${clubId}/handle-request`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
      data: { requestId: PLACEHOLDER_ID, status: 'accepted' },
    });
    expect(res.status()).toBe(404);
  });

  test('co-leader can remove a regular member', async ({ request }) => {
    const removable = { username: `authzremovable_${suffix}`, email: `authzremovable_${suffix}@mail.com`, password: 'RemovablePass1!' };
    const regRes = await request.post(`${API}/auth/register`, { data: removable });
    expect(regRes.status()).toBe(201);
    const removableToken = (await regRes.json()).token;

    const joinRes = await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${removableToken}` } });
    expect(joinRes.status()).toBe(200);

    const clubRes = await request.get(`${API}/clubs/${clubId}`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    const removableId = (await clubRes.json()).club.members.find((m) => m.username === removable.username)._id;

    const removeRes = await request.delete(`${API}/clubs/${clubId}/members/${removableId}`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
    });
    expect(removeRes.status()).toBe(200);
  });

  test('co-leader\'s clubs appear in their own leader dashboard and analytics', async ({ request }) => {
    const dashboardRes = await request.get(`${API}/drives/dashboard`, { headers: { Authorization: `Bearer ${coLeaderToken}` } });
    expect(dashboardRes.status()).toBe(200);
    expect((await dashboardRes.json()).totalClubs).toBeGreaterThanOrEqual(1);

    const analyticsRes = await request.get(`${API}/drives/analytics`, { headers: { Authorization: `Bearer ${coLeaderToken}` } });
    expect(analyticsRes.status()).toBe(200);
    expect((await analyticsRes.json()).analytics.length).toBeGreaterThanOrEqual(1);
  });

  // ─── UC-10 — co-leader negative paths (things a co-leader is still NOT allowed to do) ──

  test('co-leader cannot toggle club privacy, update, delete, or transfer the club', async ({ request }) => {
    const toggleRes = await request.post(`${API}/clubs/${clubId}/toggle-privacy`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` }, data: { isPrivate: true },
    });
    expect(toggleRes.status()).toBe(403);

    const updateRes = await request.put(`${API}/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` }, data: { description: 'Co-leader attempted edit' },
    });
    expect(updateRes.status()).toBe(403);

    const deleteRes = await request.delete(`${API}/clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` }, data: { deletionReason: 'Co-leader attempted deletion', leaderEmail: coLeader.email },
    });
    expect(deleteRes.status()).toBe(403);

    const transferRes = await request.put(`${API}/clubs/${clubId}/transfer`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` }, data: { newLeaderId: PLACEHOLDER_ID },
    });
    expect(transferRes.status()).toBe(403);
  });

  test('co-leader cannot promote or demote anyone', async ({ request }) => {
    const promoteRes = await request.put(`${API}/clubs/${clubId}/promote`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` }, data: { userId: PLACEHOLDER_ID },
    });
    expect(promoteRes.status()).toBe(403);

    const demoteRes = await request.put(`${API}/clubs/${clubId}/demote`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` }, data: { userId: coLeader2Id },
    });
    expect(demoteRes.status()).toBe(403);
  });

  test('co-leader cannot remove the leader or another co-leader', async ({ request }) => {
    const clubRes = await request.get(`${API}/clubs/${clubId}`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    const leaderIdInClub = (await clubRes.json()).club.leader._id;

    // Removing the leader is a pre-existing 400 (state validation, not an
    // authorization boundary) for anyone — leader included — not a 403.
    const removeLeaderRes = await request.delete(`${API}/clubs/${clubId}/members/${leaderIdInClub}`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
    });
    expect(removeLeaderRes.status()).toBe(400);

    const removeCoLeaderRes = await request.delete(`${API}/clubs/${clubId}/members/${coLeader2Id}`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
    });
    expect(removeCoLeaderRes.status()).toBe(403);
  });

  test('co-leader cannot update or delete a drive, even one they did not create', async ({ request }) => {
    const updateRes = await request.put(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` }, data: { name: 'Co-leader attempted rename' },
    });
    expect(updateRes.status()).toBe(403);

    const deleteRes = await request.delete(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
    });
    expect(deleteRes.status()).toBe(403);
  });

  // ─── UC-10 — co-leader cap (MAX_CO_LEADERS = 3) ──────────────────────────

  test('promoting a 3rd co-leader succeeds, a 4th is rejected at the cap', async ({ request }) => {
    const capFiller = { username: `authzcapfiller_${suffix}`, email: `authzcapfiller_${suffix}@mail.com`, password: 'CapFillerPass1!' };
    const capOverflow = { username: `authzcapoverflow_${suffix}`, email: `authzcapoverflow_${suffix}@mail.com`, password: 'CapOverflowPass1!' };

    for (const candidate of [capFiller, capOverflow]) {
      const regRes = await request.post(`${API}/auth/register`, { data: candidate });
      expect(regRes.status()).toBe(201);
      const token = (await regRes.json()).token;
      const joinRes = await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${token}` } });
      expect(joinRes.status()).toBe(200);
    }

    const clubRes = await request.get(`${API}/clubs/${clubId}`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    const clubMembers = (await clubRes.json()).club.members;
    const capFillerId = clubMembers.find((m) => m.username === capFiller.username)._id;
    const capOverflowId = clubMembers.find((m) => m.username === capOverflow.username)._id;

    // coLeader + coLeader2 already promoted = 2; this 3rd promotion hits the cap of 3
    const thirdPromoteRes = await request.put(`${API}/clubs/${clubId}/promote`, {
      headers: { Authorization: `Bearer ${leaderToken}` }, data: { userId: capFillerId },
    });
    expect(thirdPromoteRes.status()).toBe(200);

    const fourthPromoteRes = await request.put(`${API}/clubs/${clubId}/promote`, {
      headers: { Authorization: `Bearer ${leaderToken}` }, data: { userId: capOverflowId },
    });
    expect(fourthPromoteRes.status()).toBe(400);
  });

  // ─── UC-10 — invite code on a private club now creates a pending request ──

  test('a valid invite code on a private club creates a pending join request, not instant membership', async ({ request }) => {
    const privateClubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Authz Private Invite Club ${suffix}`, description: 'Testing the invite-code pending-request fix', isPrivate: true },
    });
    expect(privateClubRes.status()).toBe(201);
    const privateClub = (await privateClubRes.json()).club;

    const inviteJoiner = { username: `authzcodejoin_${suffix}`, email: `authzcodejoin_${suffix}@mail.com`, password: 'InviteJoinerPass1!' };
    const joinerRegRes = await request.post(`${API}/auth/register`, { data: inviteJoiner });
    expect(joinerRegRes.status()).toBe(201);
    const joinerToken = (await joinerRegRes.json()).token;

    const firstAttempt = await request.post(`${API}/clubs/join-by-code/${privateClub.inviteCode}`, {
      headers: { Authorization: `Bearer ${joinerToken}` },
    });
    expect(firstAttempt.status()).toBe(200);
    const firstBody = await firstAttempt.json();
    expect(firstBody.pending).toBe(true);

    // Not a member yet — confirmed by the club's member count being unchanged (just the leader)
    const clubAfterRes = await request.get(`${API}/clubs/${privateClub._id}`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    const clubAfter = (await clubAfterRes.json()).club;
    expect(clubAfter.members.length).toBe(1);
    expect(clubAfter.joinRequests.some((r) => r.status === 'pending')).toBe(true);

    // Duplicate submission is idempotent — same pending request, not a second one
    const secondAttempt = await request.post(`${API}/clubs/join-by-code/${privateClub.inviteCode}`, {
      headers: { Authorization: `Bearer ${joinerToken}` },
    });
    expect(secondAttempt.status()).toBe(400);

    // Leader approves — the request now completes membership
    const requestId = clubAfter.joinRequests.find((r) => r.status === 'pending')._id;
    const approveRes = await request.post(`${API}/clubs/${privateClub._id}/handle-request`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { requestId, status: 'accepted' },
    });
    expect(approveRes.status()).toBe(200);

    const clubFinalRes = await request.get(`${API}/clubs/${privateClub._id}`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    expect((await clubFinalRes.json()).club.members.length).toBe(2);
  });

  test('a valid invite code on a public club still joins instantly (regression check)', async ({ request }) => {
    const publicCodeJoiner = { username: `authzpubcode_${suffix}`, email: `authzpubcode_${suffix}@mail.com`, password: 'PubCodePass1!' };
    const regRes = await request.post(`${API}/auth/register`, { data: publicCodeJoiner });
    expect(regRes.status()).toBe(201);
    const token = (await regRes.json()).token;

    const res = await request.post(`${API}/clubs/join-by-code/${clubInviteCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.pending).toBeFalsy();
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
