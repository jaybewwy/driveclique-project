import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// UC-49 — light and dark themes. The choice is made in Settings → Appearance
// (not on the Profile page), switches the page at once, and is saved to the
// account so it follows the user to another browser. Dark stays the default.
// The colours themselves are in src/theme.css.

const API = 'http://localhost:5000/api';
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// zinc-950 in each theme: what <body> is painted with
const DARK_PAGE = 'rgb(9, 9, 11)';
const LIGHT_PAGE = 'rgb(244, 244, 245)';
const WHITE = 'rgb(255, 255, 255)';
const LIGHT_THEME_INK = 'rgb(24, 24, 27)';

type Account = { username: string; email: string; password: string; token: string };

let seq = 0;
async function register(request: APIRequestContext, prefix: string): Promise<Account> {
  const id = `${Date.now()}${seq++}`;
  const user = { username: `${prefix}_${id}`, email: `${prefix}_${id}@mail.com`, password: 'ThemePass1!' };
  const res = await request.post(`${API}/auth/register`, { data: user });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.user.theme, 'a new account starts on the dark theme').toBe('dark');
  return { ...user, token: body.token };
}

const saveTheme = (request: APIRequestContext, account: Account, theme: unknown) =>
  request.put(`${API}/auth/profile`, { headers: auth(account.token), data: { theme } });

async function savedTheme(request: APIRequestContext, account: Account) {
  const res = await request.get(`${API}/auth/profile`, { headers: auth(account.token) });
  expect(res.status()).toBe(200);
  return (await res.json()).user.theme;
}

async function login(page: Page, user: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

async function logout(page: Page) {
  await page.locator('nav button[aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: /Log out/i }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
}

async function openAppearance(page: Page) {
  await page.goto('/settings');
  await page.getByRole('navigation', { name: 'Settings navigation' }).getByRole('button', { name: 'Appearance' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible();
}

// The radios are visually hidden; their labels are what a mouse user clicks
const chooseLight = (page: Page) => page.locator('label', { hasText: 'Dark text on a light background' }).click();
const chooseDark = (page: Page) => page.locator('label', { hasText: 'Light text on a dark background' }).click();
const saveStatus = (page: Page) => page.locator('#main-content').getByRole('status');

const expectTheme = async (page: Page, theme: 'dark' | 'light') => {
  // Dark is the absence of the attribute
  if (theme === 'light') await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  else await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(page.locator('body')).toHaveCSS('background-color', theme === 'light' ? LIGHT_PAGE : DARK_PAGE);
};

// Puts a theme in this browser's storage before any page script runs, the
// way a previous visit would have left it
const rememberTheme = (page: Page, theme: string) =>
  page.addInitScript((value) => localStorage.setItem('driveclique_theme', value), theme);

// What a theme can get wrong is contrast, so this runs axe's contrast rule
// alone: every piece of text on the page must reach WCAG AA (4.5:1, or 3:1
// for large text) against what is behind it. accessibility.spec.ts covers the
// structural rules, which don't depend on the theme.
async function expectReadableText(page: Page, where: string) {
  // Entrance animations fade content in; axe would sample the half-faded colours
  await page.waitForTimeout(500);
  const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const failures = violations.flatMap((v) =>
    v.nodes.map((n) => `${n.target.join(' ')} — ${n.any[0]?.message ?? v.help}`));
  expect(failures, `low-contrast text on ${where} (light theme)`).toEqual([]);
}

test.describe('Themes (UC-49): choosing one', () => {
  test('the app is dark until someone chooses otherwise', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expectTheme(page, 'dark');
  });

  test('Settings → Appearance switches the page, saves to the account, and survives a reload', async ({ page, request }) => {
    const user = await register(request, 'thswitch');
    await login(page, user);
    await openAppearance(page);

    await expect(page.getByRole('radio', { name: /^Dark/ })).toBeChecked();
    await expectTheme(page, 'dark');

    await chooseLight(page);
    await expect(page.getByRole('radio', { name: /^Light/ })).toBeChecked();
    await expectTheme(page, 'light');
    await expect(saveStatus(page)).toContainText('Saved');
    expect(await savedTheme(request, user)).toBe('light');

    await page.reload();
    await expectTheme(page, 'light');
    await openAppearance(page);
    await expect(page.getByRole('radio', { name: /^Light/ })).toBeChecked();

    await chooseDark(page);
    await expect(page.getByRole('radio', { name: /^Dark/ })).toBeChecked();
    await expectTheme(page, 'dark');
    await expect(saveStatus(page)).toContainText('Saved');
    expect(await savedTheme(request, user)).toBe('dark');
  });

  test('the theme can be chosen with the keyboard', async ({ page, request }) => {
    const user = await register(request, 'thkeys');
    await login(page, user);
    await openAppearance(page);

    await page.getByRole('radio', { name: /^Dark/ }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: /^Light/ })).toBeChecked();
    await expectTheme(page, 'light');
    await expect(saveStatus(page)).toContainText('Saved');
  });

  test('the setting lives in Settings → Appearance, not on the Profile page or in Profile Settings', async ({ page, request }) => {
    const user = await register(request, 'thwhere');
    await login(page, user);

    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'My Profile' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^(Light|Dark)/ })).toHaveCount(0);

    await page.goto('/settings');
    const nav = page.getByRole('navigation', { name: 'Settings navigation' });
    await nav.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Profile Settings' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^(Light|Dark)/ })).toHaveCount(0);

    await nav.getByRole('button', { name: 'Appearance' }).click();
    await expect(page.getByRole('radio', { name: /^(Light|Dark)/ })).toHaveCount(2);
  });

  test('on a phone, the menu leads to Settings and its Appearance view', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const user = await register(request, 'thphone');
    await login(page, user);

    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);

    // Below the xl breakpoint the Settings sidebar is a drawer. The dashboard
    // has an "Open navigation" button too, so wait for the Settings page's
    // own drawer (the one with Appearance in it) before opening it.
    const appearance = page.getByRole('button', { name: 'Appearance' });
    await expect(appearance).toBeAttached();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await appearance.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible();

    await chooseLight(page);
    await expectTheme(page, 'light');
    await expect(saveStatus(page)).toContainText('Saved');
  });

  test('if the save fails the page still switches, and says the account was not updated', async ({ page, request }) => {
    const user = await register(request, 'thfail');
    await login(page, user);
    await openAppearance(page);

    await page.route('**/api/auth/profile', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 500, json: { success: false, message: 'Database unavailable' } })
        : route.continue());

    await chooseLight(page);
    await expectTheme(page, 'light');
    await expect(saveStatus(page)).toContainText("couldn't be saved to your account");
    await expect(saveStatus(page)).toContainText('Database unavailable');
    expect(await savedTheme(request, user)).toBe('dark');

    // Not left stuck: the other option can still be picked
    await expect(page.getByRole('radio', { name: /^Dark/ })).toBeEnabled();
  });
});

test.describe('Themes (UC-49): where the choice is kept', () => {
  test('the profile API accepts only known themes, and sign-in returns the saved one', async ({ request }) => {
    const user = await register(request, 'thapi');

    for (const bad of ['neon', '', 'LIGHT', 5, { $ne: 'dark' }]) {
      const res = await saveTheme(request, user, bad);
      expect(res.status(), `theme ${JSON.stringify(bad)} must be rejected`).toBe(400);
    }
    expect(await savedTheme(request, user)).toBe('dark');

    const res = await saveTheme(request, user, 'light');
    expect(res.status()).toBe(200);
    expect((await res.json()).user.theme).toBe('light');

    // Saving something else leaves the theme alone
    const other = await request.put(`${API}/auth/profile`, { headers: auth(user.token), data: { bio: 'Weekend driver' } });
    expect(other.status()).toBe(200);
    expect((await other.json()).user.theme).toBe('light');

    const signIn = await request.post(`${API}/auth/login`, { data: { username: user.username, password: user.password } });
    expect(signIn.status()).toBe(200);
    expect((await signIn.json()).user.theme).toBe('light');
  });

  test('the theme follows the account to another browser, and the next account gets its own', async ({ page, request }) => {
    const lightUser = await register(request, 'thlight');
    const darkUser = await register(request, 'thdark');
    expect((await saveTheme(request, lightUser, 'light')).status()).toBe(200);

    // A browser that has never seen this account
    await page.goto('/login');
    await expectTheme(page, 'dark');
    await login(page, lightUser);
    await expectTheme(page, 'light');

    // Signing out leaves the sign-in page as this browser last looked…
    await logout(page);
    await expectTheme(page, 'light');

    // …until someone else signs in
    await login(page, darkUser);
    await expectTheme(page, 'dark');
  });

  test('the saved theme is applied by theme-init.js before the app has loaded', async ({ page }) => {
    await rememberTheme(page, 'light');
    // Let the page and theme-init.js through and nothing else, so React never starts
    await page.route('**/*', (route) => {
      const { pathname } = new URL(route.request().url());
      return pathname === '/login' || pathname === '/theme-init.js' ? route.continue() : route.abort();
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#root')).toBeEmpty();
  });

  test('an unknown saved theme falls back to dark', async ({ page }) => {
    await rememberTheme(page, 'neon');
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expectTheme(page, 'dark');
  });
});

test.describe('Themes (UC-49): the light theme itself', () => {
  test('the sign-in page: dark text on the form, and the photo panel stays dark', async ({ page }) => {
    await rememberTheme(page, 'light');
    await page.goto('/login');
    await expectTheme(page, 'light');

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toHaveCSS('color', LIGHT_THEME_INK);
    // Text over the hero photo, and a solid red button's label, stay white
    await expect(page.getByRole('heading', { name: /Your crew is/ })).toHaveCSS('color', WHITE);
    await expect(page.getByRole('button', { name: /Sign In/i })).toHaveCSS('color', WHITE);
  });

  test('signed in: buttons that set no text colour of their own stay white on red, and scrims stay dark', async ({ page, request }) => {
    const user = await register(request, 'thlook');
    expect((await saveTheme(request, user, 'light')).status()).toBe(200);
    await login(page, user);
    await expectTheme(page, 'light');

    await page.goto('/settings');
    await page.getByRole('navigation', { name: 'Settings navigation' }).getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Profile Settings' })).toHaveCSS('color', LIGHT_THEME_INK);

    // "Save settings" has a red gradient and inherits its text colour
    await expect(page.getByRole('button', { name: 'Save settings' })).toHaveCSS('color', WHITE);
    // A switch's knob is white whether it is on or off
    const toggle = page.getByRole('switch').first();
    await expect(toggle.locator('span')).toHaveCSS('background-color', WHITE);

    // The dialog's backdrop still darkens the page behind it
    await page.getByRole('button', { name: 'Delete Account' }).click();
    const backdrop = page.locator('.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'Delete Account' }) });
    await expect(backdrop).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.6)');
    await expect(backdrop.locator('> div')).toHaveCSS('background-color', WHITE);
  });

  test('text is readable on the signed-out pages', async ({ page }) => {
    await rememberTheme(page, 'light');
    for (const path of ['/login', '/register', '/forgot-password']) {
      await page.goto(path);
      await expectTheme(page, 'light');
      await expectReadableText(page, path);
    }
  });

  test('text is readable on the signed-in pages', async ({ page, request }) => {
    const user = await register(request, 'tha11y');
    expect((await saveTheme(request, user, 'light')).status()).toBe(200);
    const club = await request.post(`${API}/clubs`, {
      headers: auth(user.token),
      data: { name: `Theme Club ${Date.now()}`, description: 'Light theme accessibility check', isPrivate: false, tags: ['Track'] },
    });
    expect(club.status()).toBe(201);
    const clubId = (await club.json()).club._id as string;
    const drive = await request.post(`${API}/drives`, {
      headers: auth(user.token),
      data: {
        clubId, name: 'Theme Test Drive', time: '10:00 AM', timeZone: 'UTC', location: 'Theme Test Lot',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      },
    });
    expect(drive.status()).toBe(201);

    await login(page, user);
    await expectTheme(page, 'light');
    await expectReadableText(page, 'dashboard');

    const pages: [string, () => Promise<void>][] = [
      ['/calendar', () => expect(page.getByRole('heading', { level: 1 })).toBeVisible()],
      ['/my-clubs', () => expect(page.getByRole('heading', { level: 1, name: 'My Clubs' })).toBeVisible()],
      ['/find-club', () => expect(page.getByRole('heading', { level: 1, name: 'Find Clubs' })).toBeVisible()],
      ['/profile', () => expect(page.getByRole('heading', { level: 1, name: 'My Profile' })).toBeVisible()],
      [`/club/${clubId}`, () => expect(page.getByText('Theme Test Drive').first()).toBeVisible()],
      [`/club/${clubId}/settings/general`, () => expect(page.getByRole('heading', { level: 2, name: 'General' })).toBeVisible()],
      [`/club/${clubId}/settings/danger-zone`, () => expect(page.getByRole('heading', { level: 2, name: 'Danger Zone' })).toBeVisible()],
    ];
    for (const [path, ready] of pages) {
      await page.goto(path);
      await ready();
      await expectReadableText(page, path);
    }

    // The three Settings views with content of their own
    await page.goto('/settings');
    const nav = page.getByRole('navigation', { name: 'Settings navigation' });
    await expectReadableText(page, 'settings: club analytics');
    await nav.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Profile Settings' })).toBeVisible();
    await expectReadableText(page, 'settings: profile');
    await nav.getByRole('button', { name: 'Appearance' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible();
    await expectReadableText(page, 'settings: appearance');
  });
});
