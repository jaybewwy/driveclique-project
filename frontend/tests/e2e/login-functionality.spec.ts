import { test, expect } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const apiBaseUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:5000';

/**
 * Test suite to verify login functionality works correctly
 * This test ensures the backend is running and authentication is working
 */
test.describe('Login Functionality Tests', () => {
  
  /**
   * Test 1: Verify backend API is running
   */
  test('Backend API health check', async ({ page }) => {
    const response = await page.request.get(apiBaseUrl + '/');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('DriveClique API is running');
  });

  /**
   * Test 2: Register a new user and verify login works
   */
  test('Register and Login flow', async ({ page }) => {
    const testUser = {
      username: `testuser_${Date.now()}`,
      email: `testuser_${Date.now()}@mail.com`,
      password: 'TestPass123!',
    };

    // Step 1: Go to register page
    await page.goto(`${baseUrl}/register`);
    await expect(page).toHaveURL(`${baseUrl}/register`);

    // Step 2: Fill in registration form
    await page.getByPlaceholder('First').fill('Test');
    await page.getByPlaceholder('Last').fill('User');
    await page.getByPlaceholder('Username').fill(testUser.username);
    await page.getByPlaceholder('Email address').fill(testUser.email);
    await page.getByPlaceholder('Password').fill(testUser.password);
    
    // Step 3: Submit registration
    await page.getByRole('button', { name: /Create Account/i }).click();

    // Step 4: Wait for redirect to dashboard
    await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 15000 });
    await expect(page).toHaveURL(`${baseUrl}/dashboard`);

    // Step 5: Verify dashboard is visible
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 10000 });

    // Step 6: Logout
    await page.getByRole('button', { name: /^[A-Z]{2}$/ }).last().click();
    await page.getByRole('menuitem', { name: /Log out/i }).click().catch(async () => {
      await page.getByText(/Log out/i).click();
    });
    await page.waitForURL(`${baseUrl}/login`, { timeout: 10000 });
    await expect(page).toHaveURL(`${baseUrl}/login`);

    // Step 7: Login with the same credentials
    await page.getByPlaceholder('Username').fill(testUser.username);
    await page.getByPlaceholder('Password').fill(testUser.password);
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Step 8: Verify login success - should redirect to dashboard
    await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 15000 });
    await expect(page).toHaveURL(`${baseUrl}/dashboard`);
    await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 3: Verify profile data is fetched after login
   */
  test('Profile data loads after login', async ({ page }) => {
    const testUser = {
      username: `profiletest_${Date.now()}`,
      email: `profiletest_${Date.now()}@mail.com`,
      password: 'TestPass123!',
      displayName: 'Test User',
    };

    // Register
    await page.goto(`${baseUrl}/register`);
    await page.getByPlaceholder('First').fill('Test');
    await page.getByPlaceholder('Last').fill('User');
    await page.getByPlaceholder('Username').fill(testUser.username);
    await page.getByPlaceholder('Email address').fill(testUser.email);
    await page.getByPlaceholder('Password').fill(testUser.password);
    await page.getByRole('button', { name: /Create Account/i }).click();
    await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 15000 });

    // Username/Email moved from /profile to the /settings "Profile" view in a later session
    await page.goto(`${baseUrl}/settings`);
    await page.getByText('Profile', { exact: true }).first().click();

    // Verify username is displayed (disabled field)
    await expect(page.getByLabel('Username')).toHaveValue(testUser.username);

    // Verify email is displayed (disabled field)
    await expect(page.getByLabel('Email')).toHaveValue(testUser.email);
  });

  /**
   * Test 4: Verify clubs data loads after login
   */
  test('Clubs data loads after login', async ({ page }) => {
    const testUser = {
      username: `clubtest_${Date.now()}`,
      email: `clubtest_${Date.now()}@mail.com`,
      password: 'TestPass123!',
    };

    // Register
    await page.goto(`${baseUrl}/register`);
    await page.getByPlaceholder('First').fill('Test');
    await page.getByPlaceholder('Last').fill('User');
    await page.getByPlaceholder('Username').fill(testUser.username);
    await page.getByPlaceholder('Email address').fill(testUser.email);
    await page.getByPlaceholder('Password').fill(testUser.password);
    await page.getByRole('button', { name: /Create Account/i }).click();
    await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 15000 });

    // Go to My Clubs page
    await page.goto(`${baseUrl}/my-clubs`);
    await expect(page).toHaveURL(`${baseUrl}/my-clubs`);

    // Wait for clubs to load (should show "No Clubs Yet" for new user)
    await expect(page.getByRole('heading', { name: /My Clubs/i })).toBeVisible({ timeout: 10000 });
    // Use more specific selector to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /No Clubs Yet/i })).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 5: Verify Find Clubs page loads public clubs
   */
  test('Find Clubs page loads', async ({ page }) => {
    const testUser = {
      username: `findtest_${Date.now()}`,
      email: `findtest_${Date.now()}@mail.com`,
      password: 'TestPass123!',
    };

    // Register
    await page.goto(`${baseUrl}/register`);
    await page.getByPlaceholder('First').fill('Test');
    await page.getByPlaceholder('Last').fill('User');
    await page.getByPlaceholder('Username').fill(testUser.username);
    await page.getByPlaceholder('Email address').fill(testUser.email);
    await page.getByPlaceholder('Password').fill(testUser.password);
    await page.getByRole('button', { name: /Create Account/i }).click();
    await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 15000 });

    // Go to Find Clubs page
    await page.goto(`${baseUrl}/find-club`);
    await expect(page).toHaveURL(`${baseUrl}/find-club`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Find Clubs/i })).toBeVisible({ timeout: 10000 });
    
    // Should show either clubs or "No clubs found" message
    // The page should not be stuck in loading state
    await expect(page.getByText(/Loading clubs\.\.\./i)).not.toBeVisible({ timeout: 15000 });
  });

  /**
   * Test 6: Invalid login credentials show error
   */
  test('Invalid login shows error message', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    
    // Try to login with invalid credentials
    await page.getByPlaceholder('Username').fill('nonexistent_user');
    await page.getByPlaceholder('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Should show error message
    await expect(page.getByText(/Invalid username or password/i)).toBeVisible({ timeout: 10000 });
    
    // Should stay on login page
    await expect(page).toHaveURL(`${baseUrl}/login`);
  });
});