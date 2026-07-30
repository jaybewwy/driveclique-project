import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── UC-30 — Notification History & Per-Type Preferences ───────────────────
// API-level tests: notifications are now persisted (not just pushed live),
// history survives being fetched independent of the live SSE stream, read
// state is server-side, and a disabled type is never written in the first
// place (not just hidden client-side).

test.describe('Notification history and preferences (UC-30)', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `notifleader_${suffix}`, email: `notifleader_${suffix}@mail.com`, password: 'LeaderPass1!' };
  const member = { username: `notifmember_${suffix}`, email: `notifmember_${suffix}@mail.com`, password: 'MemberPass1!' };

  let leaderToken = '';
  let memberToken = '';
  let clubId = '';
  let firstAnnouncementNotificationId = '';

  test('register leader and member', async ({ request }) => {
    for (const [user, setToken] of [
      [leader, (t: string) => (leaderToken = t)],
      [member, (t: string) => (memberToken = t)],
    ] as const) {
      const res = await request.post(`${API}/auth/register`, { data: user });
      expect(res.status()).toBe(201);
      setToken((await res.json()).token);
    }
  });

  test('leader creates a public club and member joins', async ({ request }) => {
    const res = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Notif History Club ${suffix}`, description: 'Testing UC-30 notification history', isPrivate: false },
    });
    expect(res.status()).toBe(201);
    clubId = (await res.json()).club._id;

    const joinRes = await request.post(`${API}/clubs/${clubId}/join`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.status()).toBe(200);
  });

  test('member starts with an empty notification history', async ({ request }) => {
    const res = await request.get(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.notifications).toEqual([]);
  });

  test('leader posts an announcement — member gets a persisted, unread notification', async ({ request }) => {
    const postRes = await request.post(`${API}/clubs/${clubId}/announcements`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { title: 'First Announcement', body: 'Testing persisted notification history.' },
    });
    expect(postRes.status()).toBe(201);

    // notify() persists asynchronously and is deliberately not awaited by the
    // announcement endpoint (posting shouldn't block on writing a notification
    // row per member), so poll briefly instead of asserting the instant the
    // POST resolves.
    await expect.poll(async () => {
      const res = await request.get(`${API}/notifications`, { headers: { Authorization: `Bearer ${memberToken}` } });
      return (await res.json()).data.notifications.length;
    }, { timeout: 3000, message: 'expected the NEW_ANNOUNCEMENT notification to be persisted' }).toBe(1);

    const res = await request.get(`${API}/notifications`, { headers: { Authorization: `Bearer ${memberToken}` } });
    const { notifications } = (await res.json()).data;
    expect(notifications[0].type).toBe('NEW_ANNOUNCEMENT');
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].id).toBeTruthy();
    expect(notifications[0].createdAt).toBeTruthy();
    firstAnnouncementNotificationId = notifications[0].id;
  });

  test('marking one notification read persists server-side', async ({ request }) => {
    const markRes = await request.put(`${API}/notifications/${firstAnnouncementNotificationId}/read`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(markRes.status()).toBe(200);

    // Re-fetch as a fresh request, simulating a reload / reconnect rather than
    // trusting client-side state — this is the actual regression this feature
    // exists to fix (a reload used to lose read/unread state entirely).
    const res = await request.get(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const { notifications } = (await res.json()).data;
    expect(notifications.find((n: { id: string }) => n.id === firstAnnouncementNotificationId)?.read).toBe(true);
  });

  test('a user cannot mark another user\'s notification as read', async ({ request }) => {
    const res = await request.put(`${API}/notifications/${firstAnnouncementNotificationId}/read`, {
      headers: { Authorization: `Bearer ${leaderToken}` }, // leader didn't receive this notification
    });
    expect(res.status()).toBe(404);
  });

  test('member disables NEW_ANNOUNCEMENT — the next announcement is never persisted for them', async ({ request }) => {
    const prefRes = await request.put(`${API}/notifications/preferences`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { NEW_ANNOUNCEMENT: false },
    });
    expect(prefRes.status()).toBe(200);
    expect((await prefRes.json()).data.notificationPreferences.NEW_ANNOUNCEMENT).toBe(false);

    const postRes = await request.post(`${API}/clubs/${clubId}/announcements`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { title: 'Second Announcement', body: 'This one should be suppressed for the member.' },
    });
    expect(postRes.status()).toBe(201);

    // Give the async notify() path time to run — and, if the preference
    // check were broken, time to actually write the row — before asserting
    // it did NOT persist. A fixed wait is intentional here: polling for a
    // count that (correctly) never arrives would just burn the full timeout.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const res = await request.get(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const { notifications } = (await res.json()).data;
    // Still just the one from before — preference filtering happens at write
    // time, so the second announcement was never persisted for this user,
    // not merely hidden.
    expect(notifications.length).toBe(1);
  });

  test('re-enabling the type lets future announcements through again', async ({ request }) => {
    const prefRes = await request.put(`${API}/notifications/preferences`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { NEW_ANNOUNCEMENT: true },
    });
    expect(prefRes.status()).toBe(200);

    const postRes = await request.post(`${API}/clubs/${clubId}/announcements`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { title: 'Third Announcement', body: 'This one should come through.' },
    });
    expect(postRes.status()).toBe(201);

    await expect.poll(async () => {
      const res = await request.get(`${API}/notifications`, { headers: { Authorization: `Bearer ${memberToken}` } });
      return (await res.json()).data.notifications.length;
    }, { timeout: 3000, message: 'expected a second NEW_ANNOUNCEMENT notification once re-enabled' }).toBe(2);
  });

  test('mark-all-read clears every remaining unread notification', async ({ request }) => {
    const markAllRes = await request.put(`${API}/notifications/read-all`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(markAllRes.status()).toBe(200);

    const res = await request.get(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const { notifications } = (await res.json()).data;
    expect(notifications.every((n: { read: boolean }) => n.read)).toBe(true);
  });

  test('preferences reject an unknown notification type', async ({ request }) => {
    const res = await request.put(`${API}/notifications/preferences`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { NOT_A_REAL_TYPE: false },
    });
    expect(res.status()).toBe(400);
  });

  test('preferences reject a non-boolean value', async ({ request }) => {
    const res = await request.put(`${API}/notifications/preferences`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { NEW_ANNOUNCEMENT: 'yes' },
    });
    expect(res.status()).toBe(400);
  });

  test('notifications endpoints require authentication', async ({ request }) => {
    const res = await request.get(`${API}/notifications`);
    expect(res.status()).toBe(401);
  });
});
