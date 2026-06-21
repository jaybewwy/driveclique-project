import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: 0,
  // The free GitHub-hosted runner has 2 CPU cores; fullyParallel's default
  // worker count overwhelms it (Vite dev server + Express + Mongo all
  // competing with several Chromium instances), producing widespread
  // navigation timeouts that don't reproduce locally. Serialize in CI only.
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    headless: true,
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

