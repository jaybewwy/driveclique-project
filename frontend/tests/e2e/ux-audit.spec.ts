import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const DESKTOP = { width: 1440, height: 900 };
const MOBILE  = { width: 375,  height: 812 };

const TS = Date.now();
const U = {
  firstName: 'Alex',
  lastName:  'Newbie',
  username:  `uxaudit${TS}`,
  email:     `uxaudit${TS}@mail.com`,
  password:  'Password123!',
};

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `tests/e2e/screenshots/ux-audit/${name}.png`, fullPage: true });
  console.log(`  📸 ${name}`);
}

async function login(page: Page) {
  await page.goto(BASE + '/login');
  await page.locator('input[placeholder*="sername"], input[name="username"]').first().fill(U.username);
  await page.locator('input[type="password"]').first().fill(U.password);
  await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
  await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

// ══════════════════════════════════════════
// 01 — LOGIN PAGE
// ══════════════════════════════════════════
test('01 login-page desktop', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const consolErrs: string[] = [];
  page.on('console', m => { if (m.type() === 'error') consolErrs.push(m.text()); });

  await page.goto(BASE + '/login');
  await page.waitForLoadState('domcontentloaded');
  await shot(page, '01a-login-desktop');

  // Key elements
  const logo = page.locator('text=DriveClique').first();
  const signInBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
  const forgotLink = page.locator('a:has-text("Forgot"), text=/forgot/i').first();
  const registerLink = page.locator('a:has-text("Register"), a:has-text("Create"), a:has-text("Sign up")').first();

  console.log(`  Logo visible: ${await logo.isVisible().catch(() => false)}`);
  console.log(`  Sign In button: ${await signInBtn.isVisible().catch(() => false)}`);
  console.log(`  Forgot password link: ${await forgotLink.isVisible().catch(() => false)}`);
  console.log(`  Register link: ${await registerLink.isVisible().catch(() => false)}`);

  // Empty submit
  await signInBtn.click().catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, '01b-login-empty-submit');

  console.log(`  Console errors: ${consolErrs.length}`);
  if (consolErrs.length) consolErrs.slice(0, 3).forEach(e => console.log(`    ⚠️  ${e}`));
});

test('01m login-page mobile', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto(BASE + '/login');
  await page.waitForLoadState('domcontentloaded');
  await shot(page, '01m-login-mobile');

  const overflowX = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
  if (overflowX > 5) console.log(`  ⚠️  Horizontal overflow: ${overflowX}px`);
  else console.log(`  No horizontal overflow`);
});

// ══════════════════════════════════════════
// 02 — REGISTRATION
// ══════════════════════════════════════════
test('02 register-flow desktop', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const errs: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(BASE + '/register');
  await page.waitForLoadState('domcontentloaded');
  await shot(page, '02a-register-empty');

  // Field count check
  const inputs = await page.locator('input:visible').count();
  console.log(`  Visible inputs on register: ${inputs}`);

  await page.locator('input[name="firstName"], input[placeholder*="First"]').first().fill(U.firstName);
  await page.locator('input[name="lastName"],  input[placeholder*="Last"]').first().fill(U.lastName);
  await page.locator('input[name="username"],  input[placeholder*="sername"]').first().fill(U.username);
  await page.locator('input[name="email"],     input[type="email"]').first().fill(U.email);
  await page.locator('input[name="password"],  input[type="password"]').first().fill(U.password);
  await shot(page, '02b-register-filled');

  // Location autocomplete
  const locInput = page.locator('input[placeholder*="ity"], input[placeholder*="earch city"]').first();
  if (await locInput.count() > 0) {
    await locInput.fill('Toronto');
    await page.waitForTimeout(1500);
    await shot(page, '02c-register-location-open');
    const results = page.locator('ul li, [role="option"], [class*="result"]');
    const count = await results.count();
    console.log(`  Location dropdown results: ${count}`);
    if (count > 0) {
      await results.first().click();
      console.log('  Location selected ✓');
    }
  }

  await shot(page, '02d-register-ready');

  const submitBtn = page.locator('button[type="submit"], button:has-text("Create Account"), button:has-text("Register")').first();
  await submitBtn.click();
  await page.waitForTimeout(5000);
  await shot(page, '02e-register-result');

  console.log(`  After register URL: ${page.url()}`);
  console.log(`  Console errors: ${errs.length}`);
  errs.slice(0, 5).forEach(e => console.log(`    ⚠️  ${e}`));
});

test('02m register mobile', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto(BASE + '/register');
  await page.waitForLoadState('domcontentloaded');
  await shot(page, '02m-register-mobile');

  const overflowX = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
  console.log(`  Horizontal overflow: ${overflowX}px`);
});

// ══════════════════════════════════════════
// 03 — DASHBOARD
// ══════════════════════════════════════════
test('03 dashboard desktop', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const errs: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await login(page);
  await shot(page, '03a-dashboard-desktop');

  console.log(`  URL: ${page.url()}`);
  const emailBanner = page.locator('text=/verify your email/i').first();
  const hasBanner = await emailBanner.isVisible().catch(() => false);
  console.log(`  Email verify banner: ${hasBanner}`);

  const sidebar = page.locator('aside, [class*="sidebar"]').first();
  console.log(`  Sidebar: ${await sidebar.isVisible().catch(() => false)}`);

  // Check for "Your Clubs" empty state
  const emptyClubs = page.locator('text=/no clubs/i, text=/join a club/i, text=/create.*club/i').first();
  console.log(`  Empty clubs CTA: ${await emptyClubs.isVisible().catch(() => false)}`);

  console.log(`  Console errors: ${errs.length}`);
  errs.slice(0, 5).forEach(e => console.log(`    ⚠️  ${e}`));
});

test('03m dashboard mobile', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await login(page);
  await shot(page, '03m-dashboard-mobile');

  const overflowX = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
  console.log(`  Horizontal overflow: ${overflowX}px`);

  // Check that mobile menu works
  const hamburger = page.locator('button[aria-label*="menu"], [class*="hamburger"], button:has([class*="Menu"])').first();
  if (await hamburger.isVisible().catch(() => false)) {
    await hamburger.click();
    await page.waitForTimeout(400);
    await shot(page, '03m-dashboard-mobile-menu-open');
    console.log('  Mobile menu opens ✓');
  } else {
    console.log('  ⚠️  No hamburger menu found on mobile dashboard');
  }
});

// ══════════════════════════════════════════
// 04 — FIND CLUB
// ══════════════════════════════════════════
test('04 find-club desktop', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await login(page);
  await page.goto(BASE + '/find-club');
  await page.waitForTimeout(1500);
  await shot(page, '04a-find-club-empty-search');

  // Search
  const searchInput = page.locator('input[placeholder*="Search"], input[type="search"], input[placeholder*="club"]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('car');
    await page.waitForTimeout(800);
    await shot(page, '04b-find-club-search-results');
    console.log('  Search field works ✓');
  }

  // Clear and check empty state
  await searchInput.clear().catch(() => {});
  await page.waitForTimeout(600);

  const cards = await page.locator('[class*="club-card"], [class*="card"]').count();
  console.log(`  Club cards on page: ${cards}`);

  const joinCodeBtn = page.locator('button:has-text("Join with Code"), button:has-text("code"), button:has-text("Invite")').first();
  console.log(`  Join-with-code button: ${await joinCodeBtn.isVisible().catch(() => false)}`);

  // Report flag on a club card
  const flagBtn = page.locator('button:has([class*="Flag"]), button[aria-label*="report"]').first();
  console.log(`  Report flag button: ${await flagBtn.isVisible().catch(() => false)}`);
});

test('04m find-club mobile', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await login(page);
  await page.goto(BASE + '/find-club');
  await page.waitForTimeout(1500);
  await shot(page, '04m-find-club-mobile');
});

// ══════════════════════════════════════════
// 05 — CREATE CLUB
// ══════════════════════════════════════════
test('05 create-club flow', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await login(page);
  await page.goto(BASE + '/create-club');
  await page.waitForLoadState('domcontentloaded');
  await shot(page, '05a-create-club-empty');

  await page.locator('input[name="name"], input[placeholder*="Club Name"], input[placeholder*="name"]').first().fill(`UX Audit Club ${TS}`);

  const desc = page.locator('textarea[name="description"], textarea').first();
  if (await desc.isVisible().catch(() => false)) {
    await desc.fill('Created during UX audit to test the full club creation flow.');
  }

  // Privacy toggle check
  const privateToggle = page.locator('input[type="checkbox"], [role="switch"], input[name="isPrivate"]').first();
  console.log(`  Privacy toggle: ${await privateToggle.isVisible().catch(() => false)}`);

  // Location
  const locInput = page.locator('input[placeholder*="ity"], input[placeholder*="earch"], input[placeholder*="ocation"]').first();
  if (await locInput.isVisible().catch(() => false)) {
    await locInput.fill('Vancouver');
    await page.waitForTimeout(1200);
    const firstResult = page.locator('ul li, [role="option"]').first();
    if (await firstResult.isVisible().catch(() => false)) {
      await firstResult.click();
    }
  }

  await shot(page, '05b-create-club-filled');

  await page.locator('button[type="submit"], button:has-text("Create Club"), button:has-text("Create")').first().click();
  await page.waitForTimeout(3000);
  await shot(page, '05c-create-club-result');
  console.log(`  After create URL: ${page.url()}`);
});

// ══════════════════════════════════════════
// 06 — SCHEDULE DRIVE
// ══════════════════════════════════════════
test('06 schedule-drive flow', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await login(page);
  await page.goto(BASE + '/my-clubs');
  await page.waitForTimeout(1500);
  await shot(page, '06a-my-clubs-with-club');

  const clubLink = page.locator('a[href*="/club/"]').first();
  if (!await clubLink.isVisible().catch(() => false)) {
    console.log('  ⚠️  No club found — skipping drive test');
    return;
  }
  await clubLink.click();
  await page.waitForTimeout(2000);
  await shot(page, '06b-club-detail-before-drive');

  const schedBtn = page.locator('button:has-text("Schedule"), button:has-text("Schedule a Drive")').first();
  if (!await schedBtn.isVisible().catch(() => false)) {
    console.log('  ⚠️  No Schedule Drive button found');
    await shot(page, '06-no-schedule-button');
    return;
  }
  await schedBtn.click();
  await page.waitForTimeout(800);
  await shot(page, '06c-drive-scheduler-open');

  // Navigate to next month
  const nextBtn = page.locator('button[aria-label*="next"], button:has-text(">"), button:has-text("›"), button:has-text("→")').first();
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(300);
  }

  // Pick day 15
  const day15 = page.locator('button:has-text("15"):not([disabled])').first();
  if (await day15.isVisible().catch(() => false)) {
    await day15.click();
    await page.waitForTimeout(300);
    console.log('  Calendar day 15 selected ✓');
  }
  await shot(page, '06d-calendar-day-picked');

  // Drive form fields
  const titleInput = page.locator('input[name="title"], input[placeholder*="rive name"], input[placeholder*="Drive"]').first();
  if (await titleInput.isVisible().catch(() => false)) {
    await titleInput.fill('UX Audit Test Drive');
  }
  const timeInput = page.locator('input[type="time"], input[name="time"], input[placeholder*="time"]').first();
  if (await timeInput.isVisible().catch(() => false)) {
    await timeInput.fill('10:00');
  }
  const maxInput = page.locator('input[name="maxAttendees"], input[placeholder*="attendees"], input[placeholder*="max"]').first();
  if (await maxInput.isVisible().catch(() => false)) {
    await maxInput.fill('10');
    console.log('  Max attendees field found ✓');
  } else {
    console.log('  ⚠️  No maxAttendees field visible');
  }

  await shot(page, '06e-drive-form-filled');

  const submitDrive = page.locator('button[type="submit"], button:has-text("Schedule Drive"), button:has-text("Create Drive")').first();
  if (await submitDrive.isVisible().catch(() => false)) {
    await submitDrive.click();
    await page.waitForTimeout(2500);
    await shot(page, '06f-drive-scheduled-success');
    console.log(`  After schedule URL: ${page.url()}`);
  }
});

// ══════════════════════════════════════════
// 07 — NOTIFICATIONS
// ══════════════════════════════════════════
test('07 notifications panel', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await login(page);
  await shot(page, '07a-dashboard-before-bell');

  // Find bell icon button (it's in the nav)
  const allNavBtns = await page.locator('header button, nav button').all();
  let bellFound = false;
  for (const btn of allNavBtns) {
    const html = await btn.innerHTML().catch(() => '');
    if (html.toLowerCase().includes('bell') || html.includes('Bell')) {
      await btn.click();
      bellFound = true;
      break;
    }
  }

  if (!bellFound) {
    // Try clicking by class or aria
    await page.locator('[aria-label*="notification"], [aria-label*="bell"]').first().click().catch(() => {});
  }

  await page.waitForTimeout(800);
  await shot(page, '07b-notification-panel-open');

  const panel = page.locator('[class*="notification"], [class*="NotificationPanel"]').first();
  console.log(`  Bell clicked: ${bellFound}, Panel visible: ${await panel.isVisible().catch(() => false)}`);

  const tabs = await page.locator('button:has-text("All"), button:has-text("Unread")').count();
  console.log(`  Notification tabs (All/Unread): ${tabs}`);
});

// ══════════════════════════════════════════
// 08 — PROFILE
// ══════════════════════════════════════════
test('08 profile page desktop', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const errs: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await login(page);
  await page.goto(BASE + '/profile');
  await page.waitForTimeout(2000);
  await shot(page, '08a-profile-desktop');

  const avatarUpload = page.locator('input[type="file"]').first();
  console.log(`  Avatar file input: ${await avatarUpload.isVisible().catch(() => false)}`);

  const carSection = page.locator('text=/car/i, text=/vehicle/i').first();
  console.log(`  Car section: ${await carSection.isVisible().catch(() => false)}`);

  console.log(`  Console errors: ${errs.length}`);
  errs.slice(0, 3).forEach(e => console.log(`    ⚠️  ${e}`));
});

test('08 analytics settings page', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await login(page);
  await page.goto(BASE + '/analytics');
  await page.waitForTimeout(2000);
  await shot(page, '08b-analytics-desktop');

  const profileNav = page.locator('button:has-text("Profile"), li:has-text("Profile")').first();
  if (await profileNav.isVisible().catch(() => false)) {
    await profileNav.click();
    await page.waitForTimeout(800);
    await shot(page, '08c-analytics-profile-view');
  }

  console.log(`  Analytics URL: ${page.url()}`);
});

test('08m profile mobile', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await login(page);
  await page.goto(BASE + '/profile');
  await page.waitForTimeout(2000);
  await shot(page, '08m-profile-mobile');

  const overflowX = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
  console.log(`  Horizontal overflow: ${overflowX}px`);
});

// ══════════════════════════════════════════
// 09 — ONBOARDING / EMPTY STATES
// ══════════════════════════════════════════
test('09 empty-state fresh user', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const freshTS2 = Date.now() + 7;
  const fresh = { username: `fresh${freshTS2}`, email: `fresh${freshTS2}@mail.com`, password: 'TestPass123!' };

  await page.goto(BASE + '/register');
  await page.locator('input[name="firstName"], input[placeholder*="First"]').first().fill('Brand');
  await page.locator('input[name="lastName"],  input[placeholder*="Last"]').first().fill('New');
  await page.locator('input[name="username"],  input[placeholder*="sername"]').first().fill(fresh.username);
  await page.locator('input[name="email"],     input[type="email"]').first().fill(fresh.email);
  await page.locator('input[name="password"],  input[type="password"]').first().fill(fresh.password);
  await page.locator('button[type="submit"], button:has-text("Create Account")').first().click();
  await page.waitForTimeout(5000);

  if (!page.url().includes('dashboard')) {
    console.log(`  ⚠️  Registration may have failed — URL: ${page.url()}`);
    await shot(page, '09-registration-failed');
    return;
  }

  await shot(page, '09a-fresh-user-dashboard');

  // What does a brand new user see?
  const noClubText = page.locator('text=/no clubs/i, text=/join.*club/i, text=/get started/i').first();
  console.log(`  No-clubs guidance: ${await noClubText.isVisible().catch(() => false)}`);

  const findClubCTA = page.locator('a:has-text("Find Club"), a:has-text("Find a Club"), button:has-text("Find Club")').first();
  const createClubCTA = page.locator('a:has-text("Create Club"), button:has-text("Create Club")').first();
  console.log(`  Find Club CTA: ${await findClubCTA.isVisible().catch(() => false)}`);
  console.log(`  Create Club CTA: ${await createClubCTA.isVisible().catch(() => false)}`);

  await page.goto(BASE + '/find-club');
  await page.waitForTimeout(1200);
  await shot(page, '09b-fresh-user-find-club');

  await page.goto(BASE + '/my-clubs');
  await page.waitForTimeout(1200);
  await shot(page, '09c-fresh-user-my-clubs-empty');
});

// ══════════════════════════════════════════
// 10 — ERROR / EDGE CASES
// ══════════════════════════════════════════
test('10 error-handling and edge cases', async ({ page }) => {
  await page.setViewportSize(DESKTOP);

  // 404 route
  await page.goto(BASE + '/this-route-does-not-exist-xyz');
  await page.waitForTimeout(800);
  await shot(page, '10a-unknown-route');
  const is404 = await page.locator('text=/404|not found|doesn.*exist/i').first().isVisible().catch(() => false);
  console.log(`  Unknown route — 404 page shown: ${is404}`);
  console.log(`  Unknown route URL: ${page.url()}`);

  // Wrong password
  await page.goto(BASE + '/login');
  await page.locator('input[placeholder*="sername"], input[name="username"]').first().fill(U.username);
  await page.locator('input[type="password"]').first().fill('definitelywrong!!');
  await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
  await page.waitForTimeout(2000);
  await shot(page, '10b-wrong-password');
  const errMsg = page.locator('[class*="error"], [role="alert"], text=/invalid|incorrect|wrong/i').first();
  console.log(`  Wrong password error shown: ${await errMsg.isVisible().catch(() => false)}`);

  // Authenticated — invalid club ID
  await login(page);
  await page.goto(BASE + '/club/000000000000000000000000');
  await page.waitForTimeout(2500);
  await shot(page, '10c-invalid-club-id');
  const errVisible = await page.locator('text=/not found|error|couldn.*find/i').first().isVisible().catch(() => false);
  console.log(`  Invalid club ID — error state: ${errVisible}`);
  console.log(`  Invalid club URL: ${page.url()}`);
});
