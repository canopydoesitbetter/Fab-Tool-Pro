import { test, expect } from '@playwright/test';
import { openApp } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('wizard hat Pages control docks above theme and floats at the right edge on scroll', async ({ page }) => {
  const trigger = page.locator('#pageMenuBtn');
  const logo = trigger.locator('#appHeaderLogo');
  const themeToggle = page.locator('#themeToggle');

  await expect(trigger).toHaveAttribute('aria-label', 'Open Pages');
  await expect(trigger).toHaveClass(/\bis-docked\b/);
  await expect(logo).toHaveAttribute('src', 'app-logo.jpg');
  await expect(trigger).not.toContainText('Pages');
  await expect(page.locator('.brand-copy')).toContainText('wizard hat');

  const docked = await page.evaluate(() => {
    const trigger = document.getElementById('pageMenuBtn');
    const theme = document.getElementById('themeToggle');
    const triggerRect = trigger.getBoundingClientRect();
    const themeRect = theme.getBoundingClientRect();
    const style = getComputedStyle(trigger);
    return {
      triggerBottom: triggerRect.bottom,
      themeTop: themeRect.top,
      borderStyle: style.borderStyle,
      boxShadow: style.boxShadow,
    };
  });
  expect(docked.triggerBottom).toBeLessThanOrEqual(docked.themeTop + 2);
  expect(docked.borderStyle).toBe('solid');
  expect(docked.boxShadow).not.toBe('none');

  await trigger.click();
  await expect(page.locator('#pageMenuDrawer')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#pageMenuCloseBtn').click();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(trigger).toHaveClass(/\bis-floating\b/);

  const floating = await page.evaluate(() => {
    const trigger = document.getElementById('pageMenuBtn');
    const rect = trigger.getBoundingClientRect();
    const style = getComputedStyle(trigger);
    return {
      position: style.position,
      rightGap: window.innerWidth - rect.right,
      top: rect.top,
    };
  });
  expect(floating.position).toBe('fixed');
  expect(floating.rightGap).toBeGreaterThanOrEqual(8);
  expect(floating.rightGap).toBeLessThanOrEqual(28);
  expect(floating.top).toBeGreaterThanOrEqual(60);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(trigger).toHaveClass(/\bis-docked\b/);
  await expect(themeToggle).toBeVisible();
});
