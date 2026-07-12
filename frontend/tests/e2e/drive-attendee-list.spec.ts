import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';
const FRONTEND = 'http://localhost:5173';

// ─── Drive Attendee List (leader-only) ──────────────────────────────────────
// GET /api/drives/:driveId/attendees already existed on the backend (full RSVP
// list + stats) but was never wired into any UI component. This suite covers
// the new "Attendee List" toggle added to the drive modal's RSVP Summary
// section: leaders can expand it to see who RSVPed and with what status;
// non-leader members never see the toggle at all.

test.describe('Drive attendee list', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = Date.now();
  const leader = { username: `attndleader_${suffix}`, email: `attndleader_${suffix}@mail.com`, password: 'LeaderPass1!' };
  const member = { username: `attndmember_${suffix}`, email: `attndmember_${suffix}@mail.com`, password: 'MemberPass1!' };

  let leaderToken = '';
  let memberToken = '';
  let clubId = '';
  let driveId = '';

  test('register leader and member', async ({ request }) => {
    const leaderRes = await request.post(`${API}/auth/register`, { data: leader });
    expect(leaderRes.status()).toBe(201);
    leaderToken = (await leaderRes.json()).token;

    const memberRes = await request.post(`${API}/auth/register`, { data: member });
    expect(memberRes.status()).toBe(201);
    memberToken = (await memberRes.json()).token;
  });

  test('leader creates a public club and member joins', async ({ request }) => {
    const clubRes = await request.post(`${API}/clubs`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { name: `Attendee List Club ${suffix}`, description: 'Testing the drive attendee list', isPrivate: false },
    });
    expect(clubRes.status()).toBe(201);
    clubId = (await clubRes.json()).club._id;

    const joinRes = await request.post(`${API}/clubs/${clubId}/join`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.status()).toBe(200);
  });

  test('leader schedules a drive and member RSVPs going', async ({ request }) => {
    const futureDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
    const driveRes = await request.post(`${API}/drives`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
      data: { clubId, name: 'Attendee List Test Drive', date: futureDate, time: '10:00 AM', location: 'Test Lot' },
    });
    expect(driveRes.status()).toBe(201);
    driveId = (await driveRes.json()).drive._id;

    const rsvpRes = await request.post(`${API}/drives/${driveId}/rsvp`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { status: 'going' },
    });
    expect(rsvpRes.status()).toBe(200);
  });

  test('non-leader is rejected by the attendees endpoint directly', async ({ request }) => {
    const res = await request.get(`${API}/drives/${driveId}/attendees`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('leader can expand the Attendee List and sees the member with their RSVP status', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(leader.username);
    await page.getByPlaceholder('Password').fill(leader.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByText('Attendee List Test Drive', { exact: false }).first().click();
    await expect(page.getByText('RSVP Summary', { exact: false })).toBeVisible({ timeout: 10_000 });

    const toggle = page.getByRole('button', { name: 'Attendee List', exact: true });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.screenshot({ path: 'tests/e2e/screenshots/attendee-list-collapsed.png' });

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(member.username, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/going/i).last()).toBeVisible();

    await page.screenshot({ path: 'tests/e2e/screenshots/attendee-list-leader-expanded.png' });
  });

  test('non-leader member does not see the Attendee List toggle', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await page.getByPlaceholder('Username').fill(member.username);
    await page.getByPlaceholder('Password').fill(member.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${FRONTEND}/club/${clubId}`);
    await page.getByText('Attendee List Test Drive', { exact: false }).first().click();
    await expect(page.getByText('Current RSVPs', { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Attendee List', exact: true })).not.toBeVisible();
  });
});
