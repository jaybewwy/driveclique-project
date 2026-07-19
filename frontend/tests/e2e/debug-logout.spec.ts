import { test, expect, Page } from '@playwright/test';
import * as crypto from 'crypto';

const BASE = 'http://localhost:5173';

function rand(len = 7) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

async function register(page: Page, u: { username: string; email: string; password: string }) {
  await page.goto(`${BASE}/register`);
  await page.getByPlaceholder('First').fill('Test');
  await page.getByPlaceholder('Last').fill('User');
  await page.getByPlaceholder('Username').fill(u.username);
  await page.getByPlaceholder('Password').fill(u.password);
  await page.getByPlaceholder('Email address').fill(u.email);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 20_000 });
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

async function createClub(page: Page, name: string): Promise<string> {
  await page.goto(`${BASE}/create-club`);
  await page.getByPlaceholder('e.g. Southern California Mountain Drivers').fill(name);
  await page.getByPlaceholder('What makes your club unique?').fill('Journey test club');
  await page.getByPlaceholder(/Search city or region|Search city in/i).fill('Journey City, JC');
  await page.getByRole('button', { name: /Create Club/i }).click();
  await expect(page.getByText(/Club created successfully/i)).toBeVisible({ timeout: 10_000 });
  await page.waitForURL(/\/club\/[a-f0-9]{24}/, { timeout: 10_000 });
  const match = page.url().match(/\/club\/([a-f0-9]{24})/);
  if (!match) throw new Error('Could not parse club ID from URL: ' + page.url());
  return match[1];
}

for (let i = 1; i <= 6; i++) {
  test(`debug logout attempt ${i}`, async ({ page }) => {
    const s = `${Date.now()}_${rand(4)}`;
    const leader = { username: `dbgleader_${s}`, email: `dbgleader_${s}@mail.com`, password: 'Journey123!' };

    await register(page, leader);
    await createClub(page, `Debug Club ${s}`);

    console.log(`[attempt ${i}] before logout, url=${page.url()}`);

    const avatarBtn = page.getByRole('button', { name: /^[A-Z]{2}$/ }).last();
    const avatarVisible = await avatarBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[attempt ${i}] avatar button visible: ${avatarVisible}`);
    await avatarBtn.click().catch((e) => console.log(`[attempt ${i}] avatar click failed: ${e.message}`));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/debug-after-click-${i}.png` });
    const ariaExpanded = await avatarBtn.getAttribute('aria-expanded').catch(() => 'ERR');
    console.log(`[attempt ${i}] trigger aria-expanded: ${ariaExpanded}`);
    const anyDialogCount = await page.locator('[role="menu"]').count();
    console.log(`[attempt ${i}] [role=menu] count in DOM: ${anyDialogCount}`);

    const menuItem = page.getByRole('menuitem', { name: /Log out/i });
    const menuVisible = await menuItem.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[attempt ${i}] Log out menuitem visible: ${menuVisible}`);

    if (menuVisible) {
      await menuItem.click().catch((e) => console.log(`[attempt ${i}] menuitem click failed: ${e.message}`));
    } else {
      const textVisible = await page.getByText(/Log out/i).isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`[attempt ${i}] fallback "Log out" text visible: ${textVisible}`);
      await page.getByText(/Log out/i).click().catch((e) => console.log(`[attempt ${i}] fallback click failed: ${e.message}`));
    }

    const reachedLogin = await page.waitForURL(`${BASE}/login`, { timeout: 10_000 }).then(() => true).catch(() => false);
    console.log(`[attempt ${i}] reached /login: ${reachedLogin}, final url=${page.url()}`);
  });
}
