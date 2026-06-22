import { test, expect, Browser } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

function randomString(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function registerUser(page: any, user: { username: string; email: string; password: string }) {
  await page.goto(`${baseUrl}/register`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  
  await page.getByPlaceholder('First').fill('Test');
  await page.getByPlaceholder('Last').fill('User');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByPlaceholder('Email address').fill(user.email);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 20000 });
}

test.describe('Profile Picture Upload', () => {
  test.setTimeout(60000);

  test('should upload a profile picture and save changes', async ({ browser }: { browser: Browser }) => {
    console.log('\n=== Profile Picture Upload Test ===\n');
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Step 1: Create an account
      console.log('Step 1: Creating account...');
      const user = {
        username: `profileuser_${randomString(4)}`,
        email: `profileuser_${Date.now()}@mail.com`,
        password: 'TestPass123!',
      };
      
      await registerUser(page, user);
      console.log(`  Account created: ${user.username}`);
      
      // Step 2: Navigate to profile page
      console.log('\nStep 2: Navigating to profile page...');
      await page.goto(`${baseUrl}/profile`, { waitUntil: 'domcontentloaded' });
      // networkidle never resolves here — NavBar's SSE stream keeps a connection open.
      await page.waitForTimeout(1000);
      
      // Verify we're on the profile page
      await expect(page.getByRole('heading', { name: /My Profile/i })).toBeVisible();
      console.log('  Profile page loaded');
      
      // Step 3: Upload a profile picture
      console.log('\nStep 3: Uploading profile picture...');
      
      // Create a simple 1x1 red PNG image as a Buffer
      // PNG signature + IHDR chunk + IDAT chunk + IEND chunk
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR length
        0x49, 0x48, 0x44, 0x52, // "IHDR"
        0x00, 0x00, 0x00, 0x01, // width = 1
        0x00, 0x00, 0x00, 0x01, // height = 1
        0x08, 0x02,             // bit depth = 8, color type = 2 (RGB)
        0x00, 0x00, 0x00,       // compression, filter, interlace
        0x90, 0x77, 0x53, 0xDE, // CRC
        0x00, 0x00, 0x00, 0x0C, // IDAT length
        0x49, 0x44, 0x41, 0x54, // "IDAT"
        0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0xF0, 0x1F, 0x00, 0x05, 0xFE, 0x03, 0xFE, // compressed data
        0xDC, 0xCC, 0x59, 0x5F, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND length
        0x49, 0x45, 0x4E, 0x44, // "IEND"
        0xAE, 0x42, 0x60, 0x82  // CRC
      ]);
      
      // Find the file input for avatar upload (it's hidden inside the profile picture container)
      // The input is intentionally hidden - user clicks the label overlay to trigger it
      const fileInput = page.locator('input[type="file"][accept="image/*"]');
      await expect(fileInput).toHaveAttribute('type', 'file', { timeout: 5000 });
      
      // Upload the test image using buffer (works even on hidden inputs)
      await fileInput.setInputFiles({
        name: 'test-avatar.png',
        mimeType: 'image/png',
        buffer: pngData
      });
      console.log('  Image file selected');
      
      // Wait for the preview to appear
      await page.waitForTimeout(2000);
      
      // Verify the preview is shown (the image should be visible in the circular container)
      const previewContainer = page.locator('.w-32.h-32.rounded-full').first();
      await expect(previewContainer).toBeVisible();
      console.log('  Preview displayed');
      
      // Fill in the bio field (required)
      console.log('\nStep 4: Filling in bio...');
      await page.getByPlaceholder('Tell us about yourself...').fill('Test bio for profile picture upload test');
      
      // Step 5: Click Save Changes
      console.log('\nStep 5: Clicking Save Changes...');
      const saveButton = page.getByRole('button', { name: /Save Changes/i });
      await expect(saveButton).toBeVisible();
      await saveButton.click();
      
      // Wait for the save to complete
      await page.waitForTimeout(3000);
      
      // Check for success message - look for text containing "success" or "updated"
      const successMessage = page.getByText(/success|updated/i).first();
      await expect(successMessage).toBeVisible({ timeout: 15000 });
      console.log('  Profile saved successfully');
      
      // Verify the avatar is still displayed after save
      const savedAvatar = page.locator('.w-32.h-32.rounded-full').first();
      await expect(savedAvatar).toBeVisible();
      console.log('  Avatar persists after save');
      
      console.log('\n=== Test Passed ===\n');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n  ✗ Test failed: ${errorMsg}\n`);
      
      // Take a screenshot on failure
      await page.screenshot({ path: 'profile-upload-failure.png' });
      console.log('  Screenshot saved to profile-upload-failure.png');
      
      throw error;
    } finally {
      await context.close();
    }
  });
});