import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-5 — Post-Drive Photo Gallery ─────────────────────────────────────────
// API-level tests: only the leader/co-leader can add or remove photos, photos
// can only be added once the drive is completed, and the gallery is capped at
// 12 photos total per drive.

const photo = (label: string) => `data:image/png;base64,${label}`;

test.describe('Drive photo gallery (UC-5)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `photoleader_${suffix}`, email: `photoleader_${suffix}@mail.com`, password: 'LeaderPass1!' };
  const member = { username: `photomember_${suffix}`, email: `photomember_${suffix}@mail.com`, password: 'MemberPass1!' };

  let leaderToken = '';
  let memberToken = '';
  let clubId = '';
  let driveId = '';

  test('register leader and a member', async ({ request }) => {
    for (const [user, setToken] of [
      [leader, (t: string) => (leaderToken = t)],
      [member, (t: string) => (memberToken = t)],
    ] as const) {
      const res = await request.post(`${API}/auth/register`, { data: user });
      expect(res.status()).toBe(201);
      const body = await res.json();
      setToken(body.token);
    }
  });

  test('leader creates a public club and member joins', async ({ request }) => {
    const res = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Photo Gallery Club ${suffix}`, description: 'Testing UC-5 drive photo gallery', isPrivate: false },
    });
    expect(res.status()).toBe(201);
    clubId = (await res.json()).club._id;

    const joinRes = await request.post(`${API}/clubs/${clubId}/join`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.status()).toBe(200);
  });

  test('leader schedules a drive and the member RSVPs going', async ({ request }) => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Photo Gallery Test Drive', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(res.status()).toBe(201);
    driveId = (await res.json()).drive._id;

    const rsvpRes = await request.post(`${API}/drives/${driveId}/rsvp`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { status: 'going' },
    });
    expect(rsvpRes.status()).toBe(200);
  });

  test('adding photos before the drive is completed is rejected', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/photos`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { photos: [photo('too-soon')] },
    });
    expect(res.status()).toBe(400);
  });

  test('a regular member cannot add photos, even before completion', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/photos`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { photos: [photo('not-a-leader')] },
    });
    expect(res.status()).toBe(403);
  });

  test('leader marks the drive completed', async ({ request }) => {
    const res = await request.put(`${API}/drives/${driveId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { isCompleted: true },
    });
    expect(res.status()).toBe(200);
  });

  test('leader adds photos after completion', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/photos`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { photos: [photo('one'), photo('two')] },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.photos.length).toBe(2);
  });

  test('a regular member still cannot add photos after completion', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/photos`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { photos: [photo('member-attempt')] },
    });
    expect(res.status()).toBe(403);
  });

  test('adding photos beyond the 12-photo cap is rejected', async ({ request }) => {
    // Gallery currently has 2 photos; adding 11 more would total 13.
    const res = await request.post(`${API}/drives/${driveId}/photos`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { photos: Array.from({ length: 11 }, (_, i) => photo(`overflow-${i}`)) },
    });
    expect(res.status()).toBe(400);
  });

  test('filling the gallery up to exactly 12 photos succeeds', async ({ request }) => {
    // 2 existing + 10 more = 12, right at the cap.
    const res = await request.post(`${API}/drives/${driveId}/photos`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { photos: Array.from({ length: 10 }, (_, i) => photo(`fill-${i}`)) },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.photos.length).toBe(12);
  });

  test('adding one more photo once at the cap is rejected', async ({ request }) => {
    const res = await request.post(`${API}/drives/${driveId}/photos`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { photos: [photo('one-too-many')] },
    });
    expect(res.status()).toBe(400);
  });

  test('leader removes a photo successfully', async ({ request }) => {
    const res = await request.delete(`${API}/drives/${driveId}/photos/0`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.photos.length).toBe(11);
  });

  test('a regular member cannot remove a photo', async ({ request }) => {
    const res = await request.delete(`${API}/drives/${driveId}/photos/0`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(403);
  });
});
