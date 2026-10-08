import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Regression tests for bugs found by reading or auditing the code rather than
// by a failing feature: first the 2026-09-28 codebase audit, then (further
// down) what turned up on 2026-10-07 while building the light theme. Each
// describe block pins one fix; see FIXES_APPLIED.md for root causes.

const API = 'http://localhost:5000/api';
const DAY_MS = 24 * 60 * 60 * 1000;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// "YYYY-MM-DD" for the UTC calendar day `days` from now
const utcDay = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

let seq = 0;
const newUser = (prefix: string) => {
  const id = `${Date.now()}${seq++}`;
  return { username: `${prefix}_${id}`, email: `${prefix}_${id}@mail.com`, password: 'AuditPass1!' };
};

async function register(request: APIRequestContext, user: { username: string; email: string; password: string }) {
  const res = await request.post(`${API}/auth/register`, { data: user });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { token: body.token as string, id: body.user._id as string };
}

async function createClub(request: APIRequestContext, token: string, name: string) {
  const res = await request.post(`${API}/clubs`, {
    headers: auth(token),
    data: { name, description: 'Audit regression test club', isPrivate: false },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).club._id as string;
}

async function createDrive(request: APIRequestContext, token: string, clubId: string, name: string, days: number) {
  const res = await request.post(`${API}/drives`, {
    headers: auth(token),
    data: { clubId, name, date: utcDay(days), time: '10:00 AM', timeZone: 'UTC', location: 'Audit Lot' },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).drive._id as string;
}

async function login(page: Page, user: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

test.describe('Club sidebar drive lists', () => {
  test('every upcoming drive is reachable: "View All" shows once there are more than the two listed', async ({ page, request }) => {
    const leader = newUser('auditlists');
    const { token } = await register(request, leader);
    const clubName = `Audit Three Drives ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);
    for (const [i, days] of [5, 6, 7].entries()) {
      await createDrive(request, token, clubId, `Audit Drive ${i + 1}`, days);
    }

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();

    // Only two fit in the sidebar, so the third must be reachable via View All
    await page.getByRole('button', { name: 'View All (3)' }).click();
    const dialog = page.getByRole('dialog', { name: 'All Drives & Events' });
    await expect(dialog.getByText('Audit Drive 3')).toBeVisible();
  });

  test('a club whose only drive is finished still shows Past Events', async ({ page, request }) => {
    const leader = newUser('auditpast');
    const { token } = await register(request, leader);
    const clubName = `Audit Past Only ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);
    const driveId = await createDrive(request, token, clubId, 'Audit Finished Drive', 3);
    const done = await request.put(`${API}/drives/${driveId}`, { headers: auth(token), data: { isCompleted: true } });
    expect(done.status()).toBe(200);

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await expect(page.getByText('No drives scheduled yet')).toBeVisible();

    await page.getByRole('button', { name: 'Past Events (1)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Past Events' });
    await expect(dialog.getByText('Audit Finished Drive')).toBeVisible();
    await expect(dialog.getByText('Completed')).toBeVisible();
  });
});

test.describe('Delete Club reason is optional, as labelled', () => {
  test('a leader can delete a club from the UI without giving a reason', async ({ page, request }) => {
    const leader = newUser('auditdel');
    const { token } = await register(request, leader);
    const clubName = `Audit Delete Me ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await page.getByRole('button', { name: 'Manage Club' }).click();
    await page.getByRole('link', { name: 'Danger Zone' }).click();
    await page.getByRole('button', { name: 'Delete Club' }).click();

    await page.getByLabel(/Confirm Leader Email/).fill(leader.email);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();

    await expect(page).toHaveURL(/\/my-clubs$/);
    const gone = await request.get(`${API}/clubs/${clubId}`, { headers: auth(token) });
    expect(gone.status()).toBe(404);
  });

  test('the API accepts a deletion with no deletionReason', async ({ request }) => {
    const leader = newUser('auditdelapi');
    const { token } = await register(request, leader);
    const clubId = await createClub(request, token, `Audit Delete API ${Date.now()}`);

    const res = await request.delete(`${API}/clubs/${clubId}`, {
      headers: auth(token),
      data: { leaderEmail: leader.email },
    });
    expect(res.status()).toBe(200);
  });
});

test.describe('Account deletion leaves nothing behind', () => {
  test('a deleted co-leader frees their co-leader slot', async ({ request }) => {
    const leader = newUser('auditcolead');
    const { token: leaderToken } = await register(request, leader);
    const clubId = await createClub(request, leaderToken, `Audit Co-Leader ${Date.now()}`);

    const joinAndPromote = async (prefix: string) => {
      const user = newUser(prefix);
      const { token, id } = await register(request, user);
      expect((await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(token) })).status()).toBe(200);
      const promote = await request.put(`${API}/clubs/${clubId}/promote`, { headers: auth(leaderToken), data: { userId: id } });
      return { user, token, promoteStatus: promote.status() };
    };

    const departing = await joinAndPromote('auditcoleadgone');
    expect(departing.promoteStatus).toBe(200);
    const del = await request.delete(`${API}/auth/account`, { headers: auth(departing.token), data: { password: departing.user.password } });
    expect(del.status()).toBe(200);

    // A club allows 3 co-leaders. The API hides a deleted user's id (populate
    // drops it), but before the fix it stayed in coLeaders and used a slot,
    // so the third promotion below was refused.
    for (const prefix of ['auditcoleada', 'auditcoleadb', 'auditcoleadc']) {
      expect((await joinAndPromote(prefix)).promoteStatus).toBe(200);
    }
  });

  test('a deleted member\'s drive rating is removed, and the ratings list still loads', async ({ request }) => {
    const leader = newUser('auditrate');
    const rater = newUser('auditrater');
    const { token: leaderToken } = await register(request, leader);
    const { token: raterToken } = await register(request, rater);
    const clubId = await createClub(request, leaderToken, `Audit Ratings ${Date.now()}`);
    expect((await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(raterToken) })).status()).toBe(200);
    const driveId = await createDrive(request, leaderToken, clubId, 'Audit Rated Drive', 2);
    expect((await request.post(`${API}/drives/${driveId}/rsvp`, { headers: auth(raterToken), data: { status: 'going' } })).status()).toBe(200);
    expect((await request.put(`${API}/drives/${driveId}`, { headers: auth(leaderToken), data: { isCompleted: true } })).status()).toBe(200);
    expect((await request.post(`${API}/drives/${driveId}/ratings`, { headers: auth(raterToken), data: { stars: 5 } })).status()).toBe(200);

    const del = await request.delete(`${API}/auth/account`, { headers: auth(raterToken), data: { password: rater.password } });
    expect(del.status()).toBe(200);

    // Before the fix the orphaned rating populated to user: null and this 500ed for everyone
    const res = await request.get(`${API}/drives/${driveId}/ratings`, { headers: auth(leaderToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.average).toBeNull();
  });
});

async function openProfileSettings(page: Page) {
  await page.goto('/settings');
  await page.getByRole('navigation', { name: 'Settings navigation' }).getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile Settings' })).toBeVisible();
}

test.describe('Notification preferences', () => {
  test('photo-gallery notifications (UC-5) can be muted like every other type', async ({ page, request }) => {
    const user = newUser('auditphotos');
    const { token } = await register(request, user);

    await login(page, user);
    await openProfileSettings(page);

    const toggle = page.getByRole('switch', { name: 'New photos are added to a drive you went on' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await expect.poll(async () => {
      const res = await request.get(`${API}/notifications/preferences`, { headers: auth(token) });
      return (await res.json()).data.notificationPreferences.DRIVE_PHOTOS_ADDED;
    }).toBe(false);
  });

  test('a toggle made while saved preferences are still loading is not overwritten', async ({ page, request }) => {
    const user = newUser('auditprefrace');
    const { token } = await register(request, user);
    await login(page, user);

    // The server answers the initial fetch right away (before any toggle),
    // but the answer reaches the page late, as on a slow network
    await page.route('**/api/notifications/preferences', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({ response });
    });
    const initialFetch = page.waitForResponse((res) =>
      res.url().includes('/api/notifications/preferences') && res.request().method() === 'GET');

    await openProfileSettings(page);
    const toggle = page.getByRole('switch', { name: 'A club posts a new announcement' });
    await toggle.click();
    await initialFetch;

    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    // The switch flips before its save has been answered, so poll for the save
    await expect.poll(async () => {
      const saved = await request.get(`${API}/notifications/preferences`, { headers: auth(token) });
      return (await saved.json()).data.notificationPreferences.NEW_ANNOUNCEMENT;
    }).toBe(false);
  });
});

test.describe('Changing your username keeps you signed in as yourself', () => {
  test('after a username change, a club leader is still recognised as its leader', async ({ page, request }) => {
    const leader = newUser('auditrename');
    const { token } = await register(request, leader);
    const clubName = `Audit Rename ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);

    await login(page, leader);
    await openProfileSettings(page);
    const newUsername = `renamed_${Date.now()}`;
    await page.getByRole('button', { name: 'Change' }).first().click();
    await page.locator('input[type="text"]:focus').fill(newUsername);
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Username updated successfully!')).toBeVisible();

    // Before the fix the stored user became just { username }, losing _id,
    // so the club page no longer recognised its own leader
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage Club' })).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('driveclique_user') || '{}'));
    expect(stored.username).toBe(newUsername);
    expect(stored._id).toBeTruthy();
  });
});

test.describe('Stacked dialogs on the club page', () => {
  test('a confirmation over the Members list gets focus, and Escape closes only the confirmation', async ({ page, request }) => {
    const leader = newUser('auditstack');
    const member = newUser('auditstackm');
    const { token } = await register(request, leader);
    const { token: memberToken } = await register(request, member);
    const clubName = `Audit Stacked ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);
    expect((await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(memberToken) })).status()).toBe(200);

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await page.getByRole('button', { name: 'View All', exact: true }).click();
    const members = page.getByRole('dialog', { name: /All Members/ });
    await expect(members).toBeVisible();

    const removeButton = members.getByTitle('Remove from club');
    await removeButton.click();
    const confirm = page.getByRole('dialog', { name: 'Remove Member' });
    await expect(confirm).toBeVisible();
    // Keyboard focus moves into the confirmation, not the list behind it
    await expect(confirm.getByRole('checkbox')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    await expect(members).toBeVisible();
    // ...and returns to the button that opened it
    await expect(removeButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(members).toBeHidden();
  });
});

// ─── Found 2026-10-07 while building the light theme (UC-49) ────────────────

test.describe("Other people's account details stay private", () => {
  test('user search returns only what a result row shows', async ({ request }) => {
    const target = newUser('auditfind');
    await register(request, target);
    const { token } = await register(request, newUser('auditseek'));

    const res = await request.get(`${API}/auth/users/search`, { headers: auth(token), params: { query: target.username } });
    expect(res.status()).toBe(200);
    const { users } = await res.json();
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe(target.username);

    // Before the fix this was the whole account minus the password: email,
    // push tokens, block lists, old password hashes, reset-token hash
    const allowed = ['_id', 'username', 'name', 'useDisplayName', 'avatar'];
    expect(Object.keys(users[0]).filter((field) => !allowed.includes(field))).toEqual([]);
  });

  test('your own profile comes back without password hashes or token hashes', async ({ request }) => {
    const user = newUser('auditself');
    const { token, id } = await register(request, user);

    const res = await request.get(`${API}/auth/profile`, { headers: auth(token) });
    expect(res.status()).toBe(200);
    const profile = (await res.json()).user;

    // Everything the web and mobile apps read from it is still there
    expect(profile).toMatchObject({ _id: id, username: user.username, email: user.email, theme: 'dark', useDisplayName: false });
    for (const field of ['cars', 'emailVerified', 'usernameChangedAt', 'role']) {
      expect(profile, `profile.${field}`).toHaveProperty(field);
    }

    // The sign-in form keeps this object in localStorage
    // (pushTokens is the user's own device list and stays: push-token-registration.spec.ts reads it here)
    const serverOnly = [
      'password', 'passwordHistory', 'passwordResetToken', 'passwordResetExpires',
      'emailVerifyToken', 'emailVerifyExpiry', 'emailChangeToken', 'emailChangeExpires', '__v',
    ];
    expect(Object.keys(profile).filter((field) => serverOnly.includes(field))).toEqual([]);
  });

  test('a leader can still find people in "Find Users to Invite"', async ({ page, request }) => {
    const target = newUser('auditinvitee');
    await register(request, target);
    const leader = newUser('auditinviter');
    const { token } = await register(request, leader);
    const clubName = `Audit Invite Club ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await page.getByRole('textbox', { name: 'Find users to invite' }).fill(target.username);
    await expect(page.getByText(target.username, { exact: true })).toBeVisible();
  });
});

test.describe('Find Clubs works with a keyboard and a screen reader', () => {
  test('the search box has a name, results open from the keyboard, and the loaded list passes axe', async ({ page, request }) => {
    const { token: ownerToken } = await register(request, newUser('auditfcown'));
    const clubName = `Audit Keyboard Club ${Date.now()}`;
    const clubId = await createClub(request, ownerToken, clubName);
    const visitor = newUser('auditfcvis');
    await register(request, visitor);

    await login(page, visitor);
    await page.goto('/find-club');
    await page.getByRole('textbox', { name: 'Search clubs' }).fill(clubName);

    // The club's name is the control that opens it; Join, Report, and Block
    // are separate controls beside it, not buttons inside a button
    const open = page.getByRole('button', { name: clubName, exact: true });
    await expect(open).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withRules(['label', 'nested-interactive']).analyze();
    expect(violations.map((v) => `${v.id} (${v.nodes.length} node(s))`)).toEqual([]);

    // A button on the card acts on its own and does not open the club
    await page.getByRole('button', { name: 'Report club' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/\/find-club$/);
    // A dialog starts listening for Escape when it takes focus, a few ms after it appears
    await expect(page.getByRole('button', { name: 'Close report dialog' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await open.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}$`));
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();

    // A mouse user can still click anywhere on the card: here, its top-left
    // padding, well away from the name and the buttons
    await page.goto('/find-club');
    await page.getByRole('textbox', { name: 'Search clubs' }).fill(clubName);
    await page.locator('.glass-card').filter({ hasText: clubName }).click({ position: { x: 8, y: 8 } });
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}$`));
  });
});

test.describe('Every control has a name, and no button holds another', () => {
  // The same three rules that Find Clubs failed, on the other screens that
  // failed them: the club page, Profile Settings, and the nav bar on a phone
  test('club page, Profile Settings, and the phone nav bar', async ({ page, request }) => {
    const leader = newUser('auditnames');
    const { token } = await register(request, leader);
    const clubName = `Audit Names Club ${Date.now()}`;
    const clubId = await createClub(request, token, clubName);
    await createDrive(request, token, clubId, 'Named Controls Drive', 7);

    const expectNamedAndFlat = async (where: string) => {
      const { violations } = await new AxeBuilder({ page }).withRules(['label', 'button-name', 'nested-interactive']).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), where).toEqual([]);
    };

    await login(page, leader);

    // The avatar menu holds only menu items and plain text (its name line was a heading)
    await page.locator('nav button[aria-haspopup="menu"]').click();
    await expect(page.getByRole('menu')).toBeVisible();
    const menu = await new AxeBuilder({ page }).include('[role="menu"]').withRules(['aria-required-children']).analyze();
    expect(menu.violations.map((v) => v.nodes.map((n) => n.failureSummary).join(' ')), 'avatar menu').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.goto(`/club/${clubId}`);
    // The featured drive's name is the button that opens it
    const openDrive = page.getByRole('button', { name: 'Named Controls Drive', exact: true });
    await expect(openDrive).toBeVisible();
    await expect(page.getByRole('button', { name: 'Drive options' })).toBeVisible();
    await expectNamedAndFlat('club page');

    // Report sits on the card as a button of its own and does not open the drive
    await page.getByRole('button', { name: 'Report drive' }).first().click();
    await expect(page.getByRole('dialog')).toContainText('Report');
    await expect(page.getByText('Mark your attendance')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Close report dialog' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await openDrive.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Mark your attendance');
    await expect(page.getByRole('button', { name: 'Dismiss drive details panel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await openProfileSettings(page);
    await expect(page.getByRole('switch', { name: 'Show Display Name' })).toBeVisible();
    await expect(page.getByLabel('Current Password')).toBeVisible();
    await expectNamedAndFlat('Profile Settings');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible();
    await expectNamedAndFlat('dashboard at phone width');
  });
});

test.describe('The phone menu covers the page behind it', () => {
  test('the menu has its own background, not just a blur', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const user = newUser('auditmenu');
    await register(request, user);
    await login(page, user);

    await page.getByRole('button', { name: 'Toggle menu' }).click();
    const menu = page.locator('div.fixed').filter({ has: page.getByRole('button', { name: 'Log out' }) });
    // zinc-950 at 98%. `bg-zinc-950/98` generated nothing, leaving it transparent.
    await expect(menu).toHaveCSS('background-color', 'rgba(9, 9, 11, 0.98)');
  });

  test('every opacity modifier in the source is one Tailwind generates', async () => {
    // Tailwind 3 silently drops e.g. `bg-red-500/8`: only the steps of its
    // opacity scale work bare, anything else needs brackets (`/[0.08]`)
    const scale = new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
    const srcDir = fileURLToPath(new URL('../../src/', import.meta.url));
    const dropped: string[] = [];
    for (const file of readdirSync(srcDir, { recursive: true, encoding: 'utf8' })) {
      if (!/\.(jsx?|css)$/.test(file)) continue;
      const text = readFileSync(path.join(srcDir, file), 'utf8');
      const modifiers = /[\w:-]+-(?:[a-z]+-\d{2,3}|white|black|true-white|true-black|background|primary|secondary|destructive)\/(\d+)(?![\w.[])/g;
      for (const [cls, step] of text.matchAll(modifiers)) {
        if (!scale.has(Number(step))) dropped.push(`${file}: ${cls}`);
      }
    }
    expect(dropped).toEqual([]);
  });
});

test.describe('Text on coloured buttons and badges is readable', () => {
  // Contrast only: every piece of text in `scope` must reach WCAG AA
  async function expectReadable(page: Page, scope: string, where: string) {
    const { violations } = await new AxeBuilder({ page }).include(scope).withRules(['color-contrast']).analyze();
    const failures = violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')} — ${n.any[0]?.message ?? v.help}`));
    expect(failures, `low-contrast text in ${where}`).toEqual([]);
  }

  for (const theme of ['dark', 'light']) {
    test(`${theme} theme: the "New" badge, each selected RSVP button, the avatar placeholder, and Transfer`, async ({ page, request }) => {
      const leader = newUser(`auditaa${theme}`);
      const { token } = await register(request, leader);
      const saved = await request.put(`${API}/auth/profile`, { headers: auth(token), data: { theme } });
      expect(saved.status()).toBe(200);
      const clubName = `Audit Contrast Club ${theme} ${Date.now()}`;
      const clubId = await createClub(request, token, clubName);
      await createDrive(request, token, clubId, 'Contrast Check Drive', 7);
      const member = newUser(`aamem${theme}`);
      const { token: memberToken } = await register(request, member);
      const joined = await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(memberToken) });
      expect(joined.status()).toBe(200);

      await login(page, leader);
      await page.locator('nav button[aria-haspopup="menu"]').click();
      await expect(page.getByRole('menu')).toBeVisible();
      await expectReadable(page, '[role="menu"]', 'the avatar menu');
      await page.keyboard.press('Escape');

      await page.goto(`/club/${clubId}`);
      await page.getByText('Contrast Check Drive').first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      for (const [label, colour] of [['Going', 'green'], ['Maybe', 'yellow'], ['Not Going', 'red']]) {
        const option = dialog.getByRole('button', { name: label, exact: true });
        await option.click();
        // Selected: a solid fill, where unselected has only a hover tint
        await expect(option).toHaveClass(new RegExp(`(^| )bg-${colour}-\\d00( |$)`));
        // The buttons fade between colours (150 ms); axe must see the end state
        await page.waitForTimeout(400);
        await expectReadable(page, '[role="dialog"]', `the drive dialog with "${label}" selected`);
      }

      await page.goto(`/club/${clubId}/settings/general`);
      await expect(page.getByText('No Image')).toBeVisible();
      await expectReadable(page, '#main-content', 'Club Settings → General');

      // The amber Transfer button is disabled, and so skipped by axe, until a member is picked
      await page.goto(`/club/${clubId}/settings/ownership`);
      await page.getByRole('button', { name: new RegExp(member.username) }).click();
      await expect(page.getByRole('button', { name: /^Transfer to / })).toBeEnabled();
      await page.waitForTimeout(400);
      await expectReadable(page, '#main-content', 'Club Settings → Ownership');
    });
  }
});

test.describe('Delete Account is a real dialog', () => {
  test('it is announced as a dialog, takes focus, keeps Tab inside, and Escape returns to the button', async ({ page, request }) => {
    const user = newUser('auditdeldlg');
    await register(request, user);
    await login(page, user);
    await openProfileSettings(page);

    const opener = page.getByRole('button', { name: 'Delete Account' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Delete Account' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Password')).toBeFocused();

    // Tab from the last control wraps to the first instead of reaching the page behind
    await dialog.getByLabel('Password').fill('not-my-password');
    await dialog.getByRole('button', { name: 'Delete My Account' }).focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByLabel('Password')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});
