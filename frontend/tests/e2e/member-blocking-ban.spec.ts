import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-32 — Member Blocking & Club Ban List ────────────────────────────────
// API-level tests. Two independent halves:
//  1. Club ban list — removing a member with `ban: true` prevents rejoining
//     (public instant-join and private/invite-code request) until unbanned.
//     Leader and co-leader can both manage it; a plain removal (no ban) still
//     allows rejoining exactly as before (regression check).
//  2. User blocking — one-directional: viewing a profile that has blocked you
//     404s (indistinguishable from a nonexistent user); the blocker can still
//     view the blocked user's profile; blocking never suppresses reporting.

test.describe('Club ban list (UC-32)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `banleader_${suffix}`, email: `banleader_${suffix}@mail.com`, password: 'BanPass1!' };
  const coLeader = { username: `bancoleader_${suffix}`, email: `bancoleader_${suffix}@mail.com`, password: 'BanPass1!' };
  const memberA = { username: `banmembera_${suffix}`, email: `banmembera_${suffix}@mail.com`, password: 'BanPass1!' };
  const memberB = { username: `banmemberb_${suffix}`, email: `banmemberb_${suffix}@mail.com`, password: 'BanPass1!' };
  const outsider = { username: `banoutsider_${suffix}`, email: `banoutsider_${suffix}@mail.com`, password: 'BanPass1!' };

  let leaderToken = '', coLeaderToken = '', memberAToken = '', memberBToken = '', outsiderToken = '';
  let leaderId = '', memberAId = '', memberBId = '';
  let publicClubId = '';
  let privateClubId = '';

  test('setup: register users, create a public and a private club, join both, promote a co-leader', async ({ request }) => {
    for (const [user, setToken, setId] of [
      [leader, (t: string) => (leaderToken = t), (id: string) => (leaderId = id)],
      [coLeader, (t: string) => (coLeaderToken = t), null],
      [memberA, (t: string) => (memberAToken = t), (id: string) => (memberAId = id)],
      [memberB, (t: string) => (memberBToken = t), (id: string) => (memberBId = id)],
      [outsider, (t: string) => (outsiderToken = t), null],
    ] as const) {
      const res = await request.post(`${API}/auth/register`, { data: user });
      expect(res.status()).toBe(201);
      const body = await res.json();
      setToken(body.token);
      setId?.(body.user._id);
    }

    const publicClubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Ban Test Public Club ${suffix}`, description: 'UC-32 verification', isPrivate: false },
    });
    expect(publicClubRes.status()).toBe(201);
    publicClubId = (await publicClubRes.json()).club._id;

    const privateClubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Ban Test Private Club ${suffix}`, description: 'UC-32 verification', isPrivate: true },
    });
    expect(privateClubRes.status()).toBe(201);
    privateClubId = (await privateClubRes.json()).club._id;

    // Both memberA and memberB and coLeader join the public club; coLeader gets promoted.
    for (const token of [coLeaderToken, memberAToken, memberBToken]) {
      const res = await request.post(`${API}/clubs/${publicClubId}/join`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status()).toBe(200);
    }
    const coLeaderProfile = await request.post(`${API}/auth/login`, { data: { username: coLeader.username, password: coLeader.password } });
    const coLeaderId = (await coLeaderProfile.json()).user._id;
    const promoteRes = await request.put(`${API}/clubs/${publicClubId}/promote`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { userId: coLeaderId },
    });
    expect(promoteRes.status()).toBe(200);
  });

  test('plain removal (no ban) still allows the member to rejoin immediately — regression check', async ({ request }) => {
    const removeRes = await request.delete(`${API}/clubs/${publicClubId}/members/${memberAId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { ban: false },
    });
    expect(removeRes.status()).toBe(200);

    const rejoinRes = await request.post(`${API}/clubs/${publicClubId}/join`, { headers: { Authorization: `Bearer ${memberAToken}` } });
    expect(rejoinRes.status()).toBe(200);
  });

  test('removal with ban: true prevents the member from instantly rejoining a public club', async ({ request }) => {
    const removeRes = await request.delete(`${API}/clubs/${publicClubId}/members/${memberAId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { ban: true },
    });
    expect(removeRes.status()).toBe(200);

    const rejoinRes = await request.post(`${API}/clubs/${publicClubId}/join`, { headers: { Authorization: `Bearer ${memberAToken}` } });
    expect(rejoinRes.status()).toBe(403);
    const body = await rejoinRes.json();
    expect(body.message).toMatch(/removed.*cannot rejoin/i);
  });

  test('a banned user also cannot join the same club via a valid invite code', async ({ request }) => {
    const clubRes = await request.get(`${API}/clubs/${publicClubId}`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    const inviteCode = (await clubRes.json()).club.inviteCode;

    const res = await request.post(`${API}/clubs/join-by-code/${inviteCode}`, { headers: { Authorization: `Bearer ${memberAToken}` } });
    expect(res.status()).toBe(403);
  });

  test('a banned user cannot submit a join request on a PRIVATE club via invite code either', async ({ request }) => {
    // Ban memberB from the private club directly (no prior membership needed
    // for this check — ban applies at the join-request stage too).
    // First they must be a member to be removable, so join then remove+ban.
    const joinRes = await request.post(`${API}/clubs/${privateClubId}/join`, { headers: { Authorization: `Bearer ${memberBToken}` } });
    expect(joinRes.status()).toBe(200); // private club -> pending request, not instant join
    expect((await joinRes.json()).message).toMatch(/awaiting leader approval/i);

    // Accept memberB's request so they become a real member we can then remove+ban.
    const clubRes = await request.get(`${API}/clubs/${privateClubId}`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    const pendingRequest = (await clubRes.json()).club.joinRequests.find((r: any) => r.status === 'pending');
    const acceptRes = await request.post(`${API}/clubs/${privateClubId}/handle-request`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { requestId: pendingRequest._id, status: 'accepted' },
    });
    expect(acceptRes.status()).toBe(200);

    const removeRes = await request.delete(`${API}/clubs/${privateClubId}/members/${memberBId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { ban: true },
    });
    expect(removeRes.status()).toBe(200);

    const codeRes = await request.get(`${API}/clubs/${privateClubId}`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    const inviteCode = (await codeRes.json()).club.inviteCode;
    const rejoinRes = await request.post(`${API}/clubs/join-by-code/${inviteCode}`, { headers: { Authorization: `Bearer ${memberBToken}` } });
    expect(rejoinRes.status()).toBe(403);
  });

  test('GET banned members list requires leader/co-leader privileges and returns the banned user', async ({ request }) => {
    const outsiderRes = await request.get(`${API}/clubs/${publicClubId}/banned`, { headers: { Authorization: `Bearer ${outsiderToken}` } });
    expect(outsiderRes.status()).toBe(403);

    const leaderRes = await request.get(`${API}/clubs/${publicClubId}/banned`, { headers: { Authorization: `Bearer ${leaderToken}` } });
    expect(leaderRes.status()).toBe(200);
    const { bannedUsers } = await leaderRes.json();
    expect(bannedUsers.some((u: any) => u._id === memberAId)).toBe(true);

    // Co-leader can also view the list (UC-10-style shared moderation privilege).
    const coLeaderRes = await request.get(`${API}/clubs/${publicClubId}/banned`, { headers: { Authorization: `Bearer ${coLeaderToken}` } });
    expect(coLeaderRes.status()).toBe(200);
  });

  test('co-leader can unban a user, after which they can rejoin again', async ({ request }) => {
    const unbanRes = await request.delete(`${API}/clubs/${publicClubId}/banned/${memberAId}`, {
      headers: { Authorization: `Bearer ${coLeaderToken}` },
    });
    expect(unbanRes.status()).toBe(200);

    const rejoinRes = await request.post(`${API}/clubs/${publicClubId}/join`, { headers: { Authorization: `Bearer ${memberAToken}` } });
    expect(rejoinRes.status()).toBe(200);
  });

  test('unbanning a user who is not banned is rejected', async ({ request }) => {
    const res = await request.delete(`${API}/clubs/${publicClubId}/banned/${leaderId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('User blocking (UC-32)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now() + 1;
  const userA = { username: `blocka_${suffix}`, email: `blocka_${suffix}@mail.com`, password: 'BlockPass1!' };
  const userB = { username: `blockb_${suffix}`, email: `blockb_${suffix}@mail.com`, password: 'BlockPass1!' };

  let tokenA = '', tokenB = '';
  let idA = '', idB = '';

  test('setup: register two users', async ({ request }) => {
    const resA = await request.post(`${API}/auth/register`, { data: userA });
    const bodyA = await resA.json();
    tokenA = bodyA.token; idA = bodyA.user._id;

    const resB = await request.post(`${API}/auth/register`, { data: userB });
    const bodyB = await resB.json();
    tokenB = bodyB.token; idB = bodyB.user._id;
  });

  test('before blocking, both users can view each other\'s profile normally', async ({ request }) => {
    const aViewsB = await request.get(`${API}/auth/users/${idB}/public`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect(aViewsB.status()).toBe(200);
    expect((await aViewsB.json()).profile.isBlockedByViewer).toBe(false);

    const bViewsA = await request.get(`${API}/auth/users/${idA}/public`, { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(bViewsA.status()).toBe(200);
  });

  test('a user cannot block themselves', async ({ request }) => {
    const res = await request.post(`${API}/auth/users/${idA}/block`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect(res.status()).toBe(400);
  });

  test('A blocks B: B can no longer view A\'s profile (404, indistinguishable from nonexistent)', async ({ request }) => {
    const blockRes = await request.post(`${API}/auth/users/${idB}/block`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect(blockRes.status()).toBe(200);

    const bViewsA = await request.get(`${API}/auth/users/${idA}/public`, { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(bViewsA.status()).toBe(404);
  });

  test('blocking is one-directional: A can still view B\'s profile fine', async ({ request }) => {
    const aViewsB = await request.get(`${API}/auth/users/${idB}/public`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect(aViewsB.status()).toBe(200);
    expect((await aViewsB.json()).profile.isBlockedByViewer).toBe(true);
  });

  test('blocking does NOT prevent the blocked user from reporting the blocker', async ({ request }) => {
    const res = await request.post(`${API}/reports`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { targetType: 'user', targetId: idA, reason: 'harassment', details: 'UC-32 blocking-does-not-suppress-reports check' },
    });
    expect(res.status()).toBe(201);
  });

  test('A unblocks B: B can view A\'s profile again', async ({ request }) => {
    const unblockRes = await request.delete(`${API}/auth/users/${idB}/block`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect(unblockRes.status()).toBe(200);

    const bViewsA = await request.get(`${API}/auth/users/${idA}/public`, { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(bViewsA.status()).toBe(200);
  });

  test('blockedUsers is never exposed on the public profile response', async ({ request }) => {
    const res = await request.get(`${API}/auth/users/${idB}/public`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const { profile } = await res.json();
    expect(profile.blockedUsers).toBeUndefined();
  });

  test('block/unblock require authentication', async ({ request }) => {
    const blockRes = await request.post(`${API}/auth/users/${idB}/block`);
    expect(blockRes.status()).toBe(401);
    const unblockRes = await request.delete(`${API}/auth/users/${idB}/block`);
    expect(unblockRes.status()).toBe(401);
  });
});
