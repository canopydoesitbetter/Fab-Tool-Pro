import { test, expect } from '@playwright/test';
import { openApp } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('wizard hat Pages control docks above theme and floats at the right edge on scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 360 });

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
  await expect.poll(async () => page.evaluate(() => {
    const rect = document.getElementById('pageMenuBtn').getBoundingClientRect();
    return window.innerWidth - rect.right;
  })).toBeLessThanOrEqual(28);

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

test('phone header keeps clock lower-left with hat centered above lower-right theme control', async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 800 });

  const geometry = await page.evaluate(() => {
    const topbar = document.querySelector('.topbar').getBoundingClientRect();
    const copy = document.querySelector('.brand-copy').getBoundingClientRect();
    const clock = document.getElementById('shiftClockControl').getBoundingClientRect();
    const hat = document.getElementById('pageMenuBtn').getBoundingClientRect();
    const theme = document.getElementById('themeToggle').getBoundingClientRect();
    return {
      topbarLeft: topbar.left,
      topbarRight: topbar.right,
      copyLeft: copy.left,
      copyRight: copy.right,
      copyBottom: copy.bottom,
      copyWidth: copy.width,
      clockLeft: clock.left,
      clockTop: clock.top,
      clockBottom: clock.bottom,
      clockWidth: clock.width,
      hatLeft: hat.left,
      hatRight: hat.right,
      hatBottom: hat.bottom,
      themeLeft: theme.left,
      themeRight: theme.right,
      themeTop: theme.top,
      themeBottom: theme.bottom,
    };
  });

  const hatCenter = (geometry.hatLeft + geometry.hatRight) / 2;
  const themeCenter = (geometry.themeLeft + geometry.themeRight) / 2;

  expect(geometry.copyLeft - geometry.topbarLeft).toBeLessThanOrEqual(24);
  expect(geometry.copyWidth).toBeGreaterThan(260);
  expect(geometry.clockWidth).toBeGreaterThan(260);
  expect(geometry.clockLeft).toBeLessThan(geometry.themeLeft);
  expect(geometry.clockTop).toBeGreaterThanOrEqual(geometry.copyBottom + 6);
  expect(Math.abs(geometry.clockBottom - geometry.themeBottom)).toBeLessThanOrEqual(6);
  expect(Math.abs(hatCenter - themeCenter)).toBeLessThanOrEqual(2);
  expect(geometry.hatBottom).toBeLessThanOrEqual(geometry.themeTop - 6);
  expect(geometry.themeRight).toBeLessThanOrEqual(geometry.topbarRight - 12);
  expect(geometry.copyRight).toBeLessThanOrEqual(geometry.hatLeft - 6);
});
