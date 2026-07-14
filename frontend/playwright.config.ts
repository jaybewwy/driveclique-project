import { defineConfig, devices } from '@playwright/test';

// Throwaway/manual-verification-only scripts that were never meant to run
// unattended against a fresh CI database — each is self-documented in its own
// file header as "not part of the regular suite." They still work fine when
// run locally against a long-lived dev DB / manually configured env, so they
// stay in the repo for re-use; only the automated CI run skips them.
const ciOnlyIgnores = [
  // Depends on a specific pre-seeded "gr86" club (hardcoded invite code
  // DH1RTA) that only exists in one long-lived dev database — fabricating
  // that fixture in CI was explicitly rejected in past sessions rather than
  // guessed at (see .claude/rules/activeContext.md).
  '**/move-members.spec.ts',
  // Requires a pre-existing hardcoded admin account plus a manually-set
  // ADMIN_EMAILS env var + backend restart; fails at the login step alone
  // against a fresh CI database.
  '**/admin-authz-denied-screenshot.spec.ts',
  // Hits the live Nominatim geocoding API for a real autocomplete result —
  // flaky under CI network conditions/rate limits (documented as a known,
  // pre-existing source of flakiness).
  '**/map-screenshots.spec.ts',
];

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: process.env.CI ? ciOnlyIgnores : undefined,
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

