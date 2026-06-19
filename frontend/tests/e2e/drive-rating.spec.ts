import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-25 — Post-Drive Rating & Feedback ───────────────────────────────────
// API-level tests: ratings are blocked before completion and for non-"going"
// members, a "going" member can submit and later update their rating, and
// the club analytics endpoint reflects the average once a rating exists.

test.describe('Drive rating (UC-25)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `rateleader_${suffix}`, email: `rateleader_${suffix}@mail.com`, password: 'LeaderPass1!' };
  const goingMember = { username: `rategoing_${suffix}`, email: `rategoing_${suffix}@mail.com`, password: 'MemberPass1!' };
  const maybeMember = { username: `ratemaybe_${suffix}`, email: `ratemaybe_${suffix}@mail.com`, password: 'MemberPass1!' };

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
      data: { name: `Rating Club ${suffix}`, description: 'Testing UC-25 drive rating', isPrivate: false },
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
      data: { clubId, name: 'Rating Test Drive', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
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

  test('rating is rejected before the drive is completed', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/ratings`, {
      headers: { Authorization: `Bearer ${goingToken}` },
      data: { stars: 5, comment: 'Too soon' },
    });
    expect(res.status()).toBe(400);
  });

  test('club analytics shows avgDriveRating as null before any rating', async ({ request }) => {
    const res = await request.get(`${API}/drives/analytics`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const clubAnalytics = body.analytics.find((a: { club: { _id: string } }) => a.club._id === clubId);
    expect(clubAnalytics.avgDriveRating).toBeNull();
  });

  test('leader marks the drive completed', async ({ request }) => {
    const res = await request.put(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { isCompleted: true },
    });
    expect(res.status()).toBe(200);
  });

  test('"maybe" member cannot rate (no going RSVP)', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/ratings`, {
      headers: { Authorization: `Bearer ${maybeToken}` },
      data: { stars: 3 },
    });
    expect(res.status()).toBe(403);
  });

  test('out-of-range stars are rejected', async ({ request }) => {
    const tooLow = await request.post(`${API}/drives/${driveId}/ratings`, {
      headers: { Authorization: `Bearer ${goingToken}` },
      data: { stars: 0 },
    });
    expect(tooLow.status()).toBe(400);

    const tooHigh = await request.post(`${API}/drives/${driveId}/ratings`, {
      headers: { Authorization: `Bearer ${goingToken}` },
      data: { stars: 6 },
    });
    expect(tooHigh.status()).toBe(400);
  });

  test('"going" member submits a rating after completion', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/ratings`, {
      headers: { Authorization: `Bearer ${goingToken}` },
      data: { stars: 4, comment: 'Great drive!' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.rating.stars).toBe(4);
    expect(body.rating.comment).toBe('Great drive!');
  });

  test('GET ratings returns the correct average, count, and myRating', async ({ request }) => {
    const res = await request.get(`${API}/drives/${driveId}/ratings`, {
      headers: { Authorization: `Bearer ${goingToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.average).toBe(4);
    expect(body.myRating.stars).toBe(4);
  });

  test('member can update their rating instead of creating a duplicate', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/ratings`, {
      headers: { Authorization: `Bearer ${goingToken}` },
      data: { stars: 5, comment: 'Actually, even better than I thought' },
    });
    expect(res.status()).toBe(200);

    const getRes = await request.get(`${API}/drives/${driveId}/ratings`, {
      headers: { Authorization: `Bearer ${goingToken}` },
    });
    const body = await getRes.json();
    expect(body.count).toBe(1); // still one rating, not two
    expect(body.average).toBe(5);
  });

  test('an unauthenticated request cannot view ratings', async ({ request }) => {
    const res = await request.get(`${API}/drives/${driveId}/ratings`);
    expect(res.status()).toBe(401);
  });

  test('club analytics reflects avgDriveRating after a rating exists', async ({ request }) => {
    const res = await request.get(`${API}/drives/analytics`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const clubAnalytics = body.analytics.find((a: { club: { _id: string } }) => a.club._id === clubId);
    expect(clubAnalytics.avgDriveRating).toBe(5);
  });
});
