import { test, expect, Browser } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

// Configuration
const GR86_INVITE_CODE = 'DH1RTA'; // gr86 club invite code
const NUM_USERS = 1;

function randomString(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function registerUser(page: any, user: { username: string; email: string; password: string }) {
  await page.goto(`${baseUrl}/register`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByPlaceholder('Email address').fill(user.email);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 20000 });
}

async function logoutUser(page: any) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Logout/i }).click();
  await page.waitForURL(`${baseUrl}/login`, { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function createClubViaUI(page: any, clubName: string) {
  await page.goto(`${baseUrl}/create-club`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('e.g. Southern California Mountain Drivers').fill(clubName);
  await page.getByPlaceholder('What makes your club unique?').fill('Test club for member migration');
  await page.getByPlaceholder('e.g. Los Angeles, CA').fill('Test City, TC');
  await page.getByRole('button', { name: /Create Club/i }).click();
  await expect(page.getByText(/Club created successfully/i)).toBeVisible({ timeout: 15000 });
  await page.waitForURL(/\/club\/[a-f0-9]{24}/, { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function getInviteCode(page: any): Promise<string> {
  await page.waitForTimeout(1000);
  const selectors = ['span.font-mono.tracking-widest', 'span.font-mono.text-sm', '.font-mono'];
  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      await el.waitFor({ state: 'visible', timeout: 3000 });
      const text = await el.textContent();
      if (text && /^[A-Z0-9]{4,8}$/.test(text.trim())) return text.trim();
    } catch (e) { continue; }
  }
  return '';
}

async function joinClubByCode(page: any, inviteCode: string) {
  await page.goto(`${baseUrl}/find-club`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  
  await page.getByRole('button', { name: /Join with Code/i }).click();
  await page.getByPlaceholder('e.g. HRK707').fill(inviteCode);
  await page.getByRole('button', { name: /Join Club/i }).click();
  
  // Wait for success message or navigation
  await page.waitForTimeout(3000);
}

test.describe('Move Members from TEST CLUB to gr86 club', () => {
  test.setTimeout(900000); // 15 minutes

  test('Move 1 user from TEST CLUB to gr86 club', async ({ browser }: { browser: Browser }) => {
    const testClubName = `TEST CLUB_${randomString(5)}`;
    console.log(`\n=== Moving ${NUM_USERS} user to gr86 club ===\n`);
    
    // Step 1: Create TEST CLUB and get invite code
    console.log('Step 1: Creating TEST CLUB...');
    const leaderContext = await browser.newContext();
    const leaderPage = await leaderContext.newPage();
    
    await registerUser(leaderPage, {
      username: `leader_${randomString(4)}`,
      email: `leader_${Date.now()}@mail.com`,
      password: 'TestPass123!',
    });
    
    await createClubViaUI(leaderPage, testClubName);
    const testClubInviteCode = await getInviteCode(leaderPage);
    console.log(`  TEST CLUB invite: ${testClubInviteCode}`);
    await leaderContext.close();
    
    // Step 2: Process users - each in a fresh context
    const movedUsers: string[] = [];
    const failedUsers: { username: string; error: string }[] = [];
    
    console.log(`\nStep 2: Processing ${NUM_USERS} user...\n`);
    
    for (let i = 1; i <= NUM_USERS; i++) {
      const userNum = i.toString().padStart(2, '0');
      const user = {
        username: `moveuser${userNum}_${randomString(4)}`,
        email: `moveuser${userNum}_${Date.now()}@mail.com`,
        password: 'TestPass123!',
      };
      
      console.log(`  [${i}/${NUM_USERS}] ${user.username}`);
      
      // Create fresh context for each user
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        // Register
        await registerUser(page, user);
        await page.waitForTimeout(500);
        
        // Join TEST CLUB
        await joinClubByCode(page, testClubInviteCode);
        await page.waitForTimeout(500);
        
        // Go to My Clubs
        await page.goto(`${baseUrl}/my-clubs`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        
        // Access TEST CLUB
        const clubCard = page.locator('.bg-zinc-900.rounded-3xl').filter({ has: page.getByRole('heading', { name: testClubName }) }).first();
        await clubCard.getByRole('button', { name: /View Club/i }).click();
        await page.waitForURL(/\/club\/[a-f0-9]{24}/, { timeout: 15000 });
        await page.waitForTimeout(500);
        
        // Set up dialog handler BEFORE any action that might trigger alert
        page.once('dialog', async dialog => {
          console.log(`    Dialog: ${dialog.message()}`);
          await dialog.accept();
        });
        
        // Leave Club - click Leave button
        await page.getByRole('button', { name: /Leave Club/i }).click();
        
        // Wait for and click Yes in confirmation modal
        await page.waitForSelector('button:has-text("Yes")', { timeout: 10000 });
        await page.getByRole('button', { name: 'Yes' }).click();
        
        // Wait for navigation (happens after alert is auto-accepted and dismissed)
        await page.waitForURL(/\/my-clubs/, { timeout: 30000 });
        await page.waitForTimeout(500);
        
        // Go to Find Clubs and join gr86
        await joinClubByCode(page, GR86_INVITE_CODE);
        
        // Wait for any navigation that might happen after joining
        await page.waitForTimeout(2000);
        
        // Navigate to My Clubs and wait for it to load
        await page.goto(`${baseUrl}/my-clubs`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        // Verify in My Clubs - look for gr86 club (case-insensitive, partial match)
        const gr86Heading = page.locator('h3').filter({ hasText: /gr86/i }).first();
        await expect(gr86Heading).toBeVisible({ timeout: 15000 });
        
        movedUsers.push(user.username);
        console.log('    ✓ Moved');
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`    ✗ Failed: ${errorMsg}`);
        failedUsers.push({ username: user.username, error: errorMsg });
      } finally {
        await context.close();
      }
    }
    
    console.log(`\n=== Result: ${movedUsers.length}/${NUM_USERS} moved ===`);
    if (failedUsers.length > 0) {
      console.log('Failed users:');
      failedUsers.forEach(f => console.log(`  - ${f.username}: ${f.error}`));
    }
    
    expect(movedUsers.length).toBeGreaterThanOrEqual(1);
  });
});