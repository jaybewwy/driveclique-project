import { test, expect } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const apiBaseUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:5000';

/**
 * Simple test to check if servers are running
 * Run this first before running the full test suite
 */
test.describe('Server Health Check', () => {
  
  test('Backend server is running', async ({ page }) => {
    try {
      const response = await page.request.get(apiBaseUrl + '/');
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      expect(body.success).toBe(true);
      console.log('✅ Backend server is running:', body.message);
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED')) {
        throw new Error(
          '❌ Backend server is not running!\n\n' +
          'Please start the backend server:\n' +
          '  1. Open a terminal\n' +
          '  2. Run: cd backend\n' +
          '  3. Run: npm run dev\n' +
          '  4. Wait for "MongoDB Connected..." message\n' +
          '  5. Then run the tests again'
        );
      }
      throw error;
    }
  });

  test('Frontend server is running', async ({ page }) => {
    try {
      const response = await page.goto(baseUrl);
      expect(response?.ok()).toBeTruthy();
      console.log('✅ Frontend server is running');
    } catch (error: any) {
      if (error.message?.includes('ERR_CONNECTION_REFUSED')) {
        throw new Error(
          '❌ Frontend server is not running!\n\n' +
          'Please start the frontend server:\n' +
          '  1. Open a terminal\n' +
          '  2. Run: cd frontend\n' +
          '  3. Run: npm run dev\n' +
          '  4. Wait for "Local: http://localhost:5173" message\n' +
          '  5. Then run the tests again'
        );
      }
      throw error;
    }
  });
});