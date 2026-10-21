import { test, expect, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

// ─── What a club read tells each viewer ─────────────────────────────────────
// No club read returns anyone's email address: no screen shows another
// user's address. The invite code goes to the leader alone, who shares it from
// the Invite Members panel. No club read carries the ban list; the leader's
// banned-members panel has its own endpoint. Join requests go to the leader and
// co-leaders who review them, and anyone else sees only their own, which is
// how the club page knows a request is pending.

const suffix = Date.now();
const PASSWORD = 'PrivacyPass1!';
const ROLES = ['leader', 'coLeader', 'member', 'requester', 'outsider', 'banned'] as const;
type Role = typeof ROLES[number];
type Account = { username: string; email: string; token: string; id: string };
const users = {} as Record<Role, Account>;

let privateClubId = '';
let privateClubName = '';
let privateInviteCode = '';
let publicClubName = '';
let publicInviteCode = '';

const auth = (role: Role) => ({ Authorization: `Bearer ${users[role].token}` });

// Fails if the body carries an `email` key anywhere, or the address of any
// account this spec registered (stored lowercased)
function expectNoEmails(body: unknown) {
  const text = JSON.stringify(body).toLowerCase();
  expect(text).not.toMatch(/"email"\s*:/);
  for (const role of ROLES) expect(text).not.toContain(users[role].email.toLowerCase());
}

async function getJson(request: APIRequestContext, path: string, role: Role) {
  const res = await request.get(`${API}${path}`, { headers: auth(role) });
  expect(res.status(), `GET ${path} as ${role}`).toBe(200);
  return res.json();
}

const privateClubAs = async (request: APIRequestContext, role: Role) =>
  (await getJson(request, `/clubs/${privateClubId}`, role)).club;

async function requestAndAccept(request: APIRequestContext, role: Role) {
  const joinRes = await request.post(`${API}/clubs/${privateClubId}/join`, { headers: auth(role) });
  expect(joinRes.status()).toBe(200);
  const club = await privateClubAs(request, 'leader');
  const pending = club.joinRequests.find(
    (r: any) => (r.user?._id || r.user) === users[role].id && r.status === 'pending'
  );
  const acceptRes = await request.post(`${API}/clubs/${privateClubId}/handle-request`, {
    headers: auth('leader'),
    data: { requestId: pending._id, status: 'accepted' },
  });
  expect(acceptRes.status()).toBe(200);
}

test.describe('Club data privacy', () => {
  // In order, in one worker, sharing the setup; each test reads, so one
  // failing does not invalidate the next
  test.describe.configure({ mode: 'default' });

  test.beforeAll(async ({ request }) => {
    for (const role of ROLES) {
      const username = `pv${role}_${suffix}`;
      const email = `${username}@mail.com`;
      const res = await request.post(`${API}/auth/register`, { data: { username, email, password: PASSWORD } });
      expect(res.status(), `register ${role}`).toBe(201);
      const body = await res.json();
      users[role] = { username, email, token: body.token, id: body.user._id };
    }

    privateClubName = `Privacy Private ${suffix}`;
    const privateRes = await request.post(`${API}/clubs`, {
      headers: auth('leader'),
      data: { name: privateClubName, description: 'Club data privacy checks', isPrivate: true },
    });
    expect(privateRes.status()).toBe(201);
    const privateClub = (await privateRes.json()).club;
    privateClubId = privateClub._id;
    privateInviteCode = privateClub.inviteCode;

    publicClubName = `Privacy Public ${suffix}`;
    const publicRes = await request.post(`${API}/clubs`, {
      headers: auth('leader'),
      data: { name: publicClubName, description: 'Club data privacy checks', isPrivate: false },
    });
    expect(publicRes.status()).toBe(201);
    publicInviteCode = (await publicRes.json()).club.inviteCode;

    await requestAndAccept(request, 'member');
    await requestAndAccept(request, 'coLeader');
    const promoteRes = await request.put(`${API}/clubs/${privateClubId}/promote`, {
      headers: auth('leader'),
      data: { userId: users.coLeader.id },
    });
    expect(promoteRes.status()).toBe(200);

    await requestAndAccept(request, 'banned');
    const banRes = await request.delete(`${API}/clubs/${privateClubId}/members/${users.banned.id}`, {
      headers: auth('leader'),
      data: { ban: true },
    });
    expect(banRes.status()).toBe(200);

    const requestRes = await request.post(`${API}/clubs/${privateClubId}/join`, { headers: auth('requester') });
    expect(requestRes.status()).toBe(200);
  });

  test('no club read returns an email address, whoever asks', async ({ request }) => {
    for (const role of ['leader', 'coLeader', 'member', 'requester', 'outsider'] as const) {
      const club = await privateClubAs(request, role);
      expectNoEmails(club);
      // The member list still names people
      expect(club.members.map((m: any) => m.username)).toContain(users.member.username);
    }

    expectNoEmails(await getJson(request, '/clubs', 'leader'));
    expectNoEmails(await getJson(request, '/clubs', 'member'));
    expectNoEmails(await getJson(request, `/clubs/browse?query=${encodeURIComponent(publicClubName)}`, 'outsider'));
    expectNoEmails(await getJson(request, '/clubs/trending', 'outsider'));
    expectNoEmails(await getJson(request, `/clubs/invite/${privateInviteCode}`, 'outsider'));
  });

  test('joining by invite code answers without email addresses or the code', async ({ request }) => {
    const res = await request.post(`${API}/clubs/join-by-code/${publicInviteCode}`, { headers: auth('outsider') });
    expect(res.status()).toBe(200);
    const { club } = await res.json();
    expectNoEmails(club);
    expect(club.inviteCode).toBeUndefined();
  });

  test('the invite code goes to the leader alone', async ({ request }) => {
    expect((await privateClubAs(request, 'leader')).inviteCode).toBe(privateInviteCode);
    const leaderClubs = (await getJson(request, '/clubs', 'leader')).clubs;
    expect(leaderClubs.find((c: any) => c._id === privateClubId).inviteCode).toBe(privateInviteCode);

    for (const role of ['coLeader', 'member', 'requester', 'outsider'] as const) {
      expect((await privateClubAs(request, role)).inviteCode, role).toBeUndefined();
    }
    for (const club of (await getJson(request, '/clubs', 'member')).clubs) {
      expect(club.inviteCode).toBeUndefined();
    }
    const browsed = (await getJson(request, `/clubs/browse?query=${encodeURIComponent(publicClubName)}`, 'member')).clubs;
    expect(browsed.length).toBeGreaterThan(0);
    for (const club of browsed) expect(club.inviteCode).toBeUndefined();
    expect((await getJson(request, `/clubs/invite/${privateInviteCode}`, 'outsider')).club.inviteCode).toBeUndefined();
  });

  test('no club read carries the ban list, and the leader still has the banned-members panel', async ({ request }) => {
    for (const role of ['leader', 'coLeader', 'member', 'requester', 'outsider'] as const) {
      expect((await privateClubAs(request, role)).bannedUsers, role).toBeUndefined();
    }
    // Nor does the banned member's id surface anywhere else in what an outsider sees
    expect(JSON.stringify(await privateClubAs(request, 'outsider'))).not.toContain(users.banned.id);
    expect(JSON.stringify(await getJson(request, `/clubs/invite/${privateInviteCode}`, 'outsider'))).not.toContain(users.banned.id);

    const banned = (await getJson(request, `/clubs/${privateClubId}/banned`, 'leader')).bannedUsers;
    expect(banned.map((u: any) => u._id || u)).toContain(users.banned.id);
  });

  test('join requests go to the reviewers, and anyone else sees only their own', async ({ request }) => {
    const pendingFrom = (club: any) => club.joinRequests
      .filter((r: any) => r.status === 'pending')
      .map((r: any) => r.user?._id || r.user);

    for (const role of ['leader', 'coLeader'] as const) {
      expect(pendingFrom(await privateClubAs(request, role)), role).toContain(users.requester.id);
    }
    // The member joined by request, so their own accepted request is all they see
    const memberRequests = (await privateClubAs(request, 'member')).joinRequests;
    expect(memberRequests.map((r: any) => r.user?._id || r.user)).toEqual([users.member.id]);
    expect((await privateClubAs(request, 'outsider')).joinRequests).toEqual([]);
    const own = (await privateClubAs(request, 'requester')).joinRequests;
    expect(own).toHaveLength(1);
    expect(own[0].status).toBe('pending');
    expect(own[0].user?._id || own[0].user).toBe(users.requester.id);
  });

  test('someone who asked to join sees the request pending when they come back to the club page', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(users.requester.username);
    await page.getByPlaceholder('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/club/${privateClubId}`);
    await expect(page.getByRole('heading', { name: privateClubName })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Join request pending approval')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Club' })).toHaveCount(0);
  });
});
