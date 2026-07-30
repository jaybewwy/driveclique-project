import { test, expect } from '@playwright/test';

// Throwaway-turned-permanent screenshot script for UC-30 (Notification History
// & Per-Type Preferences), kept for re-use per the checkin-screenshots.spec.ts
// precedent. Club/announcement setup goes through the API for speed and
// reliability; the member's session is established through the real login UI
// so the screenshots reflect an actual logged-in browser session, not an
// injected token.

const API = 'http://localhost:5000/api';
const baseUrl = 'http://localhost:5173';

test('UC-30: notification bell shows persisted history; settings shows per-type preferences', async ({ page, request }) => {
  const suffix = Date.now();
  const leader = { username: `notifshotldr_${suffix}`, email: `notifshotldr_${suffix}@mail.com`, password: 'LeaderPass1!' };
  const member = { username: `notifshotmem_${suffix}`, email: `notifshotmem_${suffix}@mail.com`, password: 'MemberPass1!' };

  const leaderRes = await request.post(`${API}/auth/register`, { data: leader });
  const leaderToken = (await leaderRes.json()).token;
  const memberRes = await request.post(`${API}/auth/register`, { data: member });
  const memberToken = (await memberRes.json()).token;

  const clubRes = await request.post(`${API}/clubs`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
    data: { name: `Notification Screenshots Club ${suffix}`, description: 'UC-30 screenshot verification', isPrivate: false },
  });
  const clubId = (await clubRes.json()).club._id;

  await request.post(`${API}/clubs/${clubId}/join`, { headers: { Authorization: `Bearer ${memberToken}` } });
  await request.post(`${API}/clubs/${clubId}/announcements`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
    data: { title: 'Cars & Coffee this Saturday', body: 'Meeting at the usual lot, 8am.' },
  });

  // Log the member in through the real UI so the session is a genuine browser session
  await page.goto(`${baseUrl}/login`);
  await page.getByPlaceholder('Username').fill(member.username);
  await page.getByPlaceholder('Password').fill(member.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page).toHaveURL(new RegExp(`${baseUrl}/dashboard`));

  // Wait for the persisted notification to actually be there (notify() is
  // fire-and-forget on the backend) before opening the bell.
  await expect.poll(async () => {
    const res = await request.get(`${API}/notifications`, { headers: { Authorization: `Bearer ${memberToken}` } });
    return (await res.json()).data.notifications.length;
  }, { timeout: 5000 }).toBe(1);

  await page.reload();

  // Confirm the avatar/nav has rendered before searching it for the bell icon
  await expect(page.getByRole('button', { name: /^[A-Z]{2}$/ }).last()).toBeVisible({ timeout: 10000 });

  const allButtons = page.locator('nav button, header button');
  const count = await allButtons.count();
  let notifBell = null;
  for (let i = 0; i < count; i++) {
    const btn = allButtons.nth(i);
    const hasBellIcon = await btn.locator('svg.lucide-bell').count();
    if (hasBellIcon) { notifBell = btn; break; }
  }
  expect(notifBell, 'Expected to find the notification bell button in the nav').not.toBeNull();

  await notifBell.click();
  await expect(page.getByText('Cars & Coffee this Saturday').or(page.getByText(/posted a new announcement/i))).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/uc30-notification-bell-persisted-history.png' });

  // Settings → Notification Preferences
  await page.goto(`${baseUrl}/settings`);
  await page.getByRole('button', { name: 'Profile' }).first().click().catch(() => {});
  await expect(page.getByText('Notifications', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/uc30-notification-preferences-list.png' });

  // Toggle one off and confirm the visual state changes
  const row = page.locator('div', { hasText: 'A club posts a new announcement' }).last();
  await row.getByRole('switch').click();
  await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await page.screenshot({ path: 'tests/e2e/screenshots/uc30-notification-preference-toggled-off.png' });
});
