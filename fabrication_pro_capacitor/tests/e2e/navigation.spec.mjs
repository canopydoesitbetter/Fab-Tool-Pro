import { test, expect } from '@playwright/test';
import { appPackageVersion, openApp, openTool } from './helpers.mjs';

const tools = [
  ['Task Logging', '#tool-tasklog'],
  ['Fabricator Notes', '#tool-notes'],
  ['Checklist', '#tool-checklist'],
  ['Basic Calculator', '#tool-calculator'],
  ['Quick Reference', '#tool-reference'],
  ['Fastener Spacing', '#tool-fasteners'],
  ['Sheet Optimizer', '#tool-optimizer'],
  ['Saw Optimizer', '#tool-saw'],
  ['Aluminum Overhang', '#tool-overhang'],
];

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('Fabri-Cadabra launches into Task Logging', async ({ page }) => {
  await expect(page.locator('#tool-tasklog')).toHaveClass(/\bactive\b/);
  await expect(page.getByRole('heading', { name: 'Task Logging' })).toBeVisible();
});

test('Pages drawer reaches every fabrication tool and closes after selection', async ({ page }) => {
  for (const [label, panelId] of tools) {
    await openTool(page, label, panelId);
  }
});

test('Settings remains reachable and reports the package version', async ({ page }) => {
  const expectedVersion = await appPackageVersion();
  await page.locator('#pageMenuBtn').click();
  await page.locator('#pageMenuDrawer').locator('.fab-settings-link').click();
  await expect(page.locator('#tool-settings')).toHaveClass(/\bactive\b/);
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('#settingsVersionValue')).toHaveText(expectedVersion);
  await expect(page.locator('#pageMenuDrawer')).toHaveAttribute('aria-hidden', 'true');
});

test('Theme toggle changes theme and persists after reload', async ({ page }) => {
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  expect(['light', 'dark']).toContain(initialTheme);
  const initialLabel = await page.locator('#themeToggle').getAttribute('aria-label');

  await page.locator('#themeToggle').click();
  const changedTheme = await page.locator('html').getAttribute('data-theme');
  expect(changedTheme).toBe(initialTheme === 'dark' ? 'light' : 'dark');
  await expect(page.locator('#themeToggle')).not.toHaveAttribute('aria-label', initialLabel);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', changedTheme);
});

test('Pages drawer exposes correct aria state, traps focus, closes by keyboard, close button, and backdrop', async ({ page }) => {
  const trigger = page.locator('#pageMenuBtn');
  const drawer = page.locator('#pageMenuDrawer');
  const close = page.locator('#pageMenuCloseBtn');
  const settings = drawer.locator('.fab-settings-link');

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await expect(close).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(settings).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(trigger).toBeFocused();

  await trigger.click();
  await close.click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.locator('#pageMenuBackdrop').click({ position: { x: 10, y: 10 } });
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(trigger).toBeFocused();
});

test('Calculator Guide drawer uses shared focus and Escape behavior', async ({ page }) => {
  await openTool(page, 'Basic Calculator', '#tool-calculator');
  const trigger = page.locator('#calculatorGuideBtn');
  const drawer = page.locator('#calculatorGuideDrawer');
  const close = page.locator('#calculatorGuideCloseBtn');

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(trigger).toBeFocused();
});
