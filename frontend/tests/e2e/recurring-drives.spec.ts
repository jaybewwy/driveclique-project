import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-11 — Recurring / Repeating Drives ────────────────────────────────────
// API-level tests: creating a drive with `repeat` materializes N real Drive
// documents sharing one recurrence.groupId, out-of-range counts/frequencies
// are rejected, a normal single-drive create is completely unaffected, and
// cancelling a series only cancels the still-upcoming, not-already-cancelled
// occurrences.

test.describe('Recurring drives (UC-11)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `recurleader_${suffix}`, email: `recurleader_${suffix}@mail.com`, password: 'LeaderPass1!' };

  let leaderToken = '';
  let clubId = '';

  test('register leader and create a public club', async ({ request }) => {
    const registerRes = await request.post(`${API}/auth/register`, { data: leader });
    expect(registerRes.status()).toBe(201);
    leaderToken = (await registerRes.json()).token;

    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Recurring Drives Club ${suffix}`, description: 'Testing UC-11 recurring drives', isPrivate: false },
    });
    expect(clubRes.status()).toBe(201);
    clubId = (await clubRes.json()).club._id;
  });

  test('creating a drive with repeat materializes N drives sharing one groupId', async ({ request }) => {
    const anchorDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        clubId,
        name: 'Weekly Cars & Coffee',
        date: anchorDate.toISOString(),
        time: '09:00 AM',
        location: 'Test Lot',
        repeat: { frequency: 'weekly', count: 4 },
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.drives.length).toBe(4);

    const groupId = body.drives[0].recurrence.groupId;
    expect(groupId).toBeTruthy();

    const sorted = [...body.drives].sort((a, b) => a.recurrence.index - b.recurrence.index);
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i].recurrence.groupId).toBe(groupId);
      expect(sorted[i].recurrence.total).toBe(4);
      expect(sorted[i].recurrence.index).toBe(i + 1);
    }

    // Each occurrence should be exactly 7 days after the previous one.
    for (let i = 1; i < sorted.length; i++) {
      const diffDays = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBe(7);
    }
  });

  test('a repeat count above 12 is rejected', async ({ request }) => {
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        clubId,
        name: 'Too Many Occurrences',
        date: futureDate,
        time: '09:00 AM',
        location: 'Test Lot',
        repeat: { frequency: 'weekly', count: 15 },
      },
    });
    expect(res.status()).toBe(400);
  });

  test('an invalid repeat frequency is rejected', async ({ request }) => {
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        clubId,
        name: 'Bad Frequency',
        date: futureDate,
        time: '09:00 AM',
        location: 'Test Lot',
        repeat: { frequency: 'daily', count: 3 },
      },
    });
    expect(res.status()).toBe(400);
  });

  test('a normal single-drive create with no repeat is unaffected', async ({ request }) => {
    const futureDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'One-Off Drive', date: futureDate, time: '09:00 AM', location: 'Test Lot' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.drives.length).toBe(1);
    expect(body.drive.recurrence?.groupId).toBeFalsy();
  });

  test('cancelling a series only cancels still-upcoming, not-already-cancelled occurrences', async ({ request }) => {
    const anchorDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
    const createRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: {
        clubId,
        name: 'Series To Cancel',
        date: anchorDate.toISOString(),
        time: '09:00 AM',
        location: 'Test Lot',
        repeat: { frequency: 'weekly', count: 3 },
      },
    });
    expect(createRes.status()).toBe(201);
    const drives = (await createRes.json()).drives.sort((a: { recurrence: { index: number } }, b: { recurrence: { index: number } }) => a.recurrence.index - b.recurrence.index);
    const groupId = drives[0].recurrence.groupId;

    // Cancel the middle occurrence individually first.
    const singleCancelRes = await request.post(`${API}/drives/${drives[1]._id}/cancel`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { cancellationReason: 'Testing individual cancel before series cancel' },
    });
    expect(singleCancelRes.status()).toBe(200);

    // Cancelling the series should only affect the two still-uncancelled occurrences.
    const seriesCancelRes = await request.post(`${API}/drives/series/${groupId}/cancel`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { cancellationReason: 'Cancelling the rest of the series' },
    });
    expect(seriesCancelRes.status()).toBe(200);
    const seriesCancelBody = await seriesCancelRes.json();
    expect(seriesCancelBody.cancelledCount).toBe(2);

    const clubDrivesRes = await request.get(`${API}/drives/club/${clubId}`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    const clubDrives = (await clubDrivesRes.json()).drives;
    const seriesDrives = clubDrives.filter((d: { recurrence?: { groupId: string } }) => d.recurrence?.groupId === groupId);
    expect(seriesDrives.every((d: { isCancelled: boolean }) => d.isCancelled)).toBe(true);
  });
});
