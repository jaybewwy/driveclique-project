import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-51 — Leaving a club ends your place on its drives ───────────────────
// Leaving a club, being removed from it, and deleting your account each
// delete your RSVPs to the club's drives that haven't started, and hand any
// confirmed place you held to the next person on that drive's waitlist.
// Finished drives keep their RSVPs, so check-ins, ratings, and your own RSVP
// history stay. A co-leader who leaves also stops being a co-leader.

test.describe('Leaving a club ends your place on its drives (UC-51)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const makeUser = (role: string) => ({
    username: `uc51${role}_${suffix}`,
    email: `uc51${role}_${suffix}@mail.com`,
    password: 'Uc51Pass1!',
  });
  const leader = makeUser('lead');
  const leaver = makeUser('leaver');
  const removed = makeUser('removed');
  const deleter = makeUser('deleter');
  const waiter = makeUser('waiter');
  const coLeader = makeUser('colead');
  const uiLeaver = makeUser('uileave');
  const everyone = [leader, leaver, removed, deleter, waiter, coLeader, uiLeaver];

  const tokens = new Map<string, string>();
  const ids = new Map<string, string>();
  const tokenOf = (user: { username: string }) => tokens.get(user.username)!;
  const idOf = (user: { username: string }) => ids.get(user.username)!;

  let clubId = '';
  // Each full drive (one place) has its subject going and `waiter` waitlisted
  let leaveDriveId = '';
  let removeDriveId = '';
  let deleteDriveId = '';
  let sharedDriveId = '';
  let finishedDriveId = '';
  let uiDriveId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  async function createDrive(request: APIRequestContext, name: string, days: number, maxAttendees?: number) {
    const res = await request.post(`${API}/drives`, {
      headers: auth(tokenOf(leader)),
      data: { clubId, name: `${name} ${suffix}`, date: inDays(days), time: '10:00 AM', location: 'Test Lot', maxAttendees },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).drive._id as string;
  }

  async function rsvp(request: APIRequestContext, user: { username: string }, driveId: string, status: string) {
    const res = await request.post(`${API}/drives/${driveId}/rsvp`, { headers: auth(tokenOf(user)), data: { status } });
    expect(res.status()).toBe(200);
    return res.json();
  }

  // The viewer's own status on a drive, from the members-only rsvp-status
  async function statusOf(request: APIRequestContext, user: { username: string }, driveId: string) {
    const res = await request.get(`${API}/drives/${driveId}/rsvp-status`, { headers: auth(tokenOf(user)) });
    expect(res.status()).toBe(200);
    return (await res.json()).userStatus as string | null;
  }

  // The drives in a user's own RSVP history (UC-19), which needs no membership
  async function myRsvpDriveIds(request: APIRequestContext, user: { username: string }) {
    const res = await request.get(`${API}/drives/my-rsvps`, { headers: auth(tokenOf(user)) });
    expect(res.status()).toBe(200);
    return ((await res.json()).rsvps as { drive: { _id: string } }[]).map((r) => r.drive._id).sort();
  }

  async function login(page: Page, user: { username: string; password: string }) {
    await page.goto('/login');
    await page.getByPlaceholder('Username').fill(user.username);
    await page.getByPlaceholder('Password').fill(user.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
  }

  test('setup: a club whose members hold places, with a waitlist behind each', async ({ request }) => {
    for (const user of everyone) {
      const res = await request.post(`${API}/auth/register`, { data: user });
      expect(res.status()).toBe(201);
      const body = await res.json();
      tokens.set(user.username, body.token);
      ids.set(user.username, body.user._id);
    }

    const club = await request.post(`${API}/clubs`, {
      headers: auth(tokenOf(leader)),
      data: { name: `UC51 Club ${suffix}`, description: 'Testing what leaving a club does to RSVPs', isPrivate: false },
    });
    expect(club.status()).toBe(201);
    clubId = (await club.json()).club._id;

    for (const user of everyone.filter((u) => u !== leader)) {
      const join = await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(tokenOf(user)) });
      expect(join.status()).toBe(200);
    }

    leaveDriveId = await createDrive(request, 'Leave Run', 3, 1);
    removeDriveId = await createDrive(request, 'Remove Run', 4, 1);
    deleteDriveId = await createDrive(request, 'Delete Run', 5, 1);
    sharedDriveId = await createDrive(request, 'Shared Run', 6);
    finishedDriveId = await createDrive(request, 'Finished Run', 7);
    uiDriveId = await createDrive(request, 'UI Run', 8);

    for (const [subject, driveId] of [[leaver, leaveDriveId], [removed, removeDriveId], [deleter, deleteDriveId]] as const) {
      await rsvp(request, subject, driveId, 'going');
      expect((await rsvp(request, waiter, driveId, 'going')).waitlisted).toBe(true);
    }
    await rsvp(request, leaver, sharedDriveId, 'maybe');
    await rsvp(request, removed, sharedDriveId, 'going');
    await rsvp(request, waiter, sharedDriveId, 'going');
    await rsvp(request, leaver, finishedDriveId, 'going');
    await rsvp(request, uiLeaver, uiDriveId, 'going');

    const finish = await request.put(`${API}/drives/${finishedDriveId}`, {
      headers: auth(tokenOf(leader)),
      data: { isCompleted: true },
    });
    expect(finish.status()).toBe(200);
  });

  test('leaving deletes your RSVPs to upcoming drives, keeps the finished one, and moves the waitlist up', async ({ request }) => {
    const leave = await request.put(`${API}/clubs/${clubId}/leave`, { headers: auth(tokenOf(leaver)) });
    expect(leave.status()).toBe(200);

    expect(await myRsvpDriveIds(request, leaver)).toEqual([finishedDriveId]);
    expect(await statusOf(request, waiter, leaveDriveId)).toBe('going');

    const attendees = await request.get(`${API}/drives/${leaveDriveId}/attendees`, { headers: auth(tokenOf(leader)) });
    const usernames = ((await attendees.json()).rsvps as { user: { username: string } }[]).map((r) => r.user.username);
    expect(usernames).toEqual([waiter.username]);
  });

  test('removal, with a ban, does the same', async ({ request }) => {
    const remove = await request.delete(`${API}/clubs/${clubId}/members/${idOf(removed)}`, {
      headers: auth(tokenOf(leader)),
      data: { ban: true },
    });
    expect(remove.status()).toBe(200);

    expect(await myRsvpDriveIds(request, removed)).toEqual([]);
    expect(await statusOf(request, waiter, removeDriveId)).toBe('going');

    // The leaver's "maybe" and the removed member's "going" are both gone;
    // the waiter's own RSVP on the same drive is untouched
    const shared = await request.get(`${API}/drives/${sharedDriveId}/rsvp-status`, { headers: auth(tokenOf(waiter)) });
    const body = await shared.json();
    expect(body.counts).toMatchObject({ going: 1, maybe: 0 });
    expect(body.userStatus).toBe('going');
  });

  test('deleting your account frees your places too', async ({ request }) => {
    const del = await request.delete(`${API}/auth/account`, {
      headers: auth(tokenOf(deleter)),
      data: { password: deleter.password },
    });
    expect(del.status()).toBe(200);

    expect(await statusOf(request, waiter, deleteDriveId)).toBe('going');
  });

  test('a co-leader who leaves is no longer a co-leader', async ({ request }) => {
    const promote = await request.put(`${API}/clubs/${clubId}/promote`, {
      headers: auth(tokenOf(leader)),
      data: { userId: idOf(coLeader) },
    });
    expect(promote.status()).toBe(200);

    const leave = await request.put(`${API}/clubs/${clubId}/leave`, { headers: auth(tokenOf(coLeader)) });
    expect(leave.status()).toBe(200);

    const club = await request.get(`${API}/clubs/${clubId}`, { headers: auth(tokenOf(leader)) });
    const coLeaderIds = ((await club.json()).club.coLeaders as { _id: string }[]).map((c) => c._id);
    expect(coLeaderIds).not.toContain(idOf(coLeader));

    // Co-leaders may schedule drives; someone outside the club may not
    const drive = await request.post(`${API}/drives`, {
      headers: auth(tokenOf(coLeader)),
      data: { clubId, name: `Ex Co-Leader Run ${suffix}`, date: inDays(9), time: '10:00 AM', location: 'Test Lot' },
    });
    expect(drive.status()).toBe(403);
  });

  test('club page: the leave dialog says your RSVPs go, and they do', async ({ page, request }) => {
    await login(page, uiLeaver);
    await page.goto(`/club/${clubId}`);
    await page.getByRole('button', { name: 'Leave Club' }).click();

    const dialog = page.getByRole('dialog', { name: 'Leave Club' });
    await expect(dialog.getByText("You'll be taken off its upcoming drives.")).toBeVisible();
    await dialog.getByRole('button', { name: 'Yes' }).click();
    await page.waitForURL('**/my-clubs');

    expect(await myRsvpDriveIds(request, uiLeaver)).toEqual([]);
  });
});
