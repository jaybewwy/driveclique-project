import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-22 — Member Public Profile View ─────────────────────────────────────
// API-level tests: a safe field subset is returned for any logged-in viewer,
// email/password/tokens are never included, mutual clubs are computed
// correctly (present when shared, absent when not), and the "going" RSVP
// count reflects real participation.

test.describe('Member public profile (UC-22)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `mpleader_${suffix}`, email: `mpleader_${suffix}@mail.com`, password: 'LeaderPass1!' };
  const memberA = { username: `mpmembera_${suffix}`, email: `mpmembera_${suffix}@mail.com`, password: 'MemberPass1!' };
  const memberB = { username: `mpmemberb_${suffix}`, email: `mpmemberb_${suffix}@mail.com`, password: 'MemberPass1!' };
  const outsider = { username: `mpoutsider_${suffix}`, email: `mpoutsider_${suffix}@mail.com`, password: 'OutsidePass1!' };

  let leaderToken = '';
  let memberAToken = '';
  let memberBToken = '';
  let outsiderToken = '';
  let memberAId = '';
  let clubId = '';
  let driveId = '';

  test('register leader, two members, and an outsider with no shared club', async ({ request }) => {
    for (const [user, setToken] of [
      [leader, (t: string) => (leaderToken = t)],
      [memberA, (t: string) => (memberAToken = t)],
      [memberB, (t: string) => (memberBToken = t)],
      [outsider, (t: string) => (outsiderToken = t)],
    ] as const) {
      const res = await request.post(`${API}/auth/register`, { data: user });
      expect(res.status()).toBe(201);
      setToken((await res.json()).token);
    }

    const meRes = await request.get(`${API}/auth/profile`, { headers: { Authorization: `Bearer ${memberAToken}` } });
    memberAId = (await meRes.json()).user._id;
  });

  test('leader creates a public club; member A and member B join, outsider does not', async ({ request }) => {
    const res = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Member Profile Club ${suffix}`, description: 'Testing UC-22 public profile view', isPrivate: false },
    });
    expect(res.status()).toBe(201);
    clubId = (await res.json()).club._id;

    for (const token of [memberAToken, memberBToken]) {
      const joinRes = await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${token}` } });
      expect(joinRes.status()).toBe(200);
    }
  });

  test('member B views member A\'s public profile — safe fields only, no email/password/tokens', async ({ request }) => {
    const res = await request.get(`${API}/auth/users/${memberAId}/public`, {
      headers: { Authorization: `Bearer ${memberBToken}` },
    });
    expect(res.status()).toBe(200);
    const { profile } = await res.json();

    expect(profile.username).toBe(memberA.username);
    expect(profile).toHaveProperty('goingCount');
    expect(profile).toHaveProperty('mutualClubs');
    expect(profile.goingCount).toBe(0);

    // The whole point of a "public" endpoint is that it never leaks these,
    // regardless of what gets added to the User schema later.
    expect(profile.email).toBeUndefined();
    expect(profile.password).toBeUndefined();
    expect(profile.passwordResetToken).toBeUndefined();
    expect(profile.emailVerifyToken).toBeUndefined();
    expect(profile.passwordHistory).toBeUndefined();
    expect(profile.notificationPreferences).toBeUndefined();
  });

  test('the shared club appears in mutualClubs for member B viewing member A', async ({ request }) => {
    const res = await request.get(`${API}/auth/users/${memberAId}/public`, {
      headers: { Authorization: `Bearer ${memberBToken}` },
    });
    const { profile } = await res.json();
    expect(profile.mutualClubs.some((c: { _id: string }) => c._id === clubId)).toBe(true);
  });

  test('the same club does NOT appear for the outsider, who never joined', async ({ request }) => {
    const res = await request.get(`${API}/auth/users/${memberAId}/public`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.status()).toBe(200);
    const { profile } = await res.json();
    expect(profile.mutualClubs.length).toBe(0);
  });

  test('goingCount reflects a real "going" RSVP', async ({ request }) => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const driveRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Member Profile Test Drive', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(driveRes.status()).toBe(201);
    driveId = (await driveRes.json()).drive._id;

    const rsvpRes = await request.post(`${API}/drives/${driveId}/rsvp`, {
      headers: { Authorization: `Bearer ${memberAToken}` },
      data: { status: 'going' },
    });
    expect(rsvpRes.status()).toBe(200);

    const res = await request.get(`${API}/auth/users/${memberAId}/public`, {
      headers: { Authorization: `Bearer ${memberBToken}` },
    });
    const { profile } = await res.json();
    expect(profile.goingCount).toBe(1);
  });

  test('returns 404 for a well-formed but nonexistent user ID', async ({ request }) => {
    const res = await request.get(`${API}/auth/users/000000000000000000000000/public`, {
      headers: { Authorization: `Bearer ${memberBToken}` },
    });
    expect(res.status()).toBe(404);
  });

  test('requires authentication', async ({ request }) => {
    const res = await request.get(`${API}/auth/users/${memberAId}/public`);
    expect(res.status()).toBe(401);
  });
});
