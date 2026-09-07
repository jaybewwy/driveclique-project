import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── User-blocks-club ────────────────────────────────────────────────────
// The reciprocal of UC-32's leader-blocks-member (club ban): any user —
// member or not — can block a club outright. Blocking hides the club from
// browse/search and blocks future joins (direct join, join request, invite
// code) for that user only, until unblocked. Only offered on clubs the user
// isn't currently a member of (leave first).

test.describe('User blocks a club', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const blocker = { username: `cblock_a_${suffix}`, email: `cblock_a_${suffix}@mail.com`, password: 'CBlockPass1!' };
  const leader = { username: `cblock_b_${suffix}`, email: `cblock_b_${suffix}@mail.com`, password: 'CBlockPass1!' };
  const outsider = { username: `cblock_c_${suffix}`, email: `cblock_c_${suffix}@mail.com`, password: 'CBlockPass1!' };

  let blockerToken = '';
  let leaderToken = '';
  let outsiderToken = '';
  let publicClubId = '';
  let publicClubName = '';
  let privateClubId = '';
  let privateInviteCode = '';

  test('setup: register three users, leader creates a public and a private club', async ({ request }) => {
    const a = await request.post(`${API}/auth/register`, { data: blocker });
    expect(a.status()).toBe(201);
    blockerToken = (await a.json()).token;

    const b = await request.post(`${API}/auth/register`, { data: leader });
    expect(b.status()).toBe(201);
    leaderToken = (await b.json()).token;

    const c = await request.post(`${API}/auth/register`, { data: outsider });
    expect(c.status()).toBe(201);
    outsiderToken = (await c.json()).token;

    publicClubName = `Blockable Public Club ${suffix}`;
    const publicRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: publicClubName, description: 'Testing user-blocks-club on a public club', isPrivate: false },
    });
    expect(publicRes.status()).toBe(201);
    publicClubId = (await publicRes.json()).club._id;

    const privateRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Blockable Private Club ${suffix}`, description: 'Testing user-blocks-club on a private club', isPrivate: true },
    });
    expect(privateRes.status()).toBe(201);
    const privateClub = (await privateRes.json()).club;
    privateClubId = privateClub._id;
    privateInviteCode = privateClub.inviteCode;
  });

  test('blocking requires authentication', async ({ request }) => {
    const res = await request.post(`${API}/clubs/${publicClubId}/block`);
    expect(res.status()).toBe(401);
  });

  test('a non-member can block a club', async ({ request }) => {
    const res = await request.post(`${API}/clubs/${publicClubId}/block`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    expect(res.status()).toBe(200);
  });

  test('the blocked club is excluded from browse/search for the blocker', async ({ request }) => {
    const res = await request.get(`${API}/clubs/browse?query=${encodeURIComponent(publicClubName)}`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.clubs.length).toBe(0);
  });

  test('the same search still finds the club for a user who has not blocked it', async ({ request }) => {
    const res = await request.get(`${API}/clubs/browse?query=${encodeURIComponent(publicClubName)}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.clubs.length).toBe(1);
  });

  test('a direct join attempt on a blocked club is rejected with 403', async ({ request }) => {
    const res = await request.post(`${API}/clubs/${publicClubId}/join`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('GET /clubs/:clubId reports isBlockedByViewer: true for the blocker', async ({ request }) => {
    const res = await request.get(`${API}/clubs/${publicClubId}`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isBlockedByViewer).toBe(true);
  });

  test('the same club reports isBlockedByViewer: false for a different user', async ({ request }) => {
    const res = await request.get(`${API}/clubs/${publicClubId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isBlockedByViewer).toBe(false);
  });

  test('GET /clubs/blocked lists the blocked club for the blocker', async ({ request }) => {
    const res = await request.get(`${API}/clubs/blocked`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.blockedClubs.some((c) => c._id === publicClubId)).toBe(true);
  });

  test('blocking a club the user is already a member of is rejected with 400', async ({ request }) => {
    // outsider actually joins first
    const joinRes = await request.post(`${API}/clubs/${publicClubId}/join`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(joinRes.status()).toBe(200);

    const blockRes = await request.post(`${API}/clubs/${publicClubId}/block`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(blockRes.status()).toBe(400);
  });

  test('leaving, then blocking, succeeds', async ({ request }) => {
    const leaveRes = await request.put(`${API}/clubs/${publicClubId}/leave`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(leaveRes.status()).toBe(200);

    const blockRes = await request.post(`${API}/clubs/${publicClubId}/block`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(blockRes.status()).toBe(200);
  });

  test('unblocking requires authentication', async ({ request }) => {
    const res = await request.delete(`${API}/clubs/${publicClubId}/block`);
    expect(res.status()).toBe(401);
  });

  test('unblocking removes the club from the blocked list and restores search visibility', async ({ request }) => {
    const unblockRes = await request.delete(`${API}/clubs/${publicClubId}/block`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    expect(unblockRes.status()).toBe(200);

    const listRes = await request.get(`${API}/clubs/blocked`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    const listBody = await listRes.json();
    expect(listBody.blockedClubs.some((c) => c._id === publicClubId)).toBe(false);

    const searchRes = await request.get(`${API}/clubs/browse?query=${encodeURIComponent(publicClubName)}`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    const searchBody = await searchRes.json();
    expect(searchBody.clubs.length).toBe(1);

    const joinRes = await request.post(`${API}/clubs/${publicClubId}/join`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    expect(joinRes.status()).toBe(200);
  });

  test('blocking a private club also blocks its invite-code join path', async ({ request }) => {
    const blockRes = await request.post(`${API}/clubs/${privateClubId}/block`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(blockRes.status()).toBe(200);

    const joinByCodeRes = await request.post(`${API}/clubs/join-by-code/${privateInviteCode}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(joinByCodeRes.status()).toBe(403);
  });

  test('blocking a nonexistent club returns 404', async ({ request }) => {
    const res = await request.post(`${API}/clubs/000000000000000000000000/block`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    expect(res.status()).toBe(404);
  });

  test('unblocking a club that was never blocked is a harmless no-op', async ({ request }) => {
    const res = await request.delete(`${API}/clubs/${privateClubId}/block`, {
      headers: { Authorization: `Bearer ${blockerToken}` },
    });
    expect(res.status()).toBe(200);
  });
});
