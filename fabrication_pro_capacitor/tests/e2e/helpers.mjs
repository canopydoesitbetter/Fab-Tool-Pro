import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

export async function openApp(page) {
  await page.goto('/');
  await expect(page).toHaveTitle('Fabri-Cadabra');
  await expect(page.locator('#tool-tasklog')).toHaveClass(/\bactive\b/);
  await expect(page.getByRole('heading', { name: 'Task Logging' })).toBeVisible();
}

export async function openTool(page, label, panelId) {
  await page.locator('#pageMenuBtn').click();
  await expect(page.locator('#pageMenuDrawer')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#pageMenuDrawer').getByRole('button', { name: label, exact: true }).click();
  await expect(page.locator(panelId)).toHaveClass(/\bactive\b/);
  await expect(page.locator(panelId)).toBeVisible();
  await expect(page.locator('#pageMenuDrawer')).toHaveAttribute('aria-hidden', 'true');
}

export function acceptNextDialog(page, expectedText) {
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain(expectedText);
    await dialog.accept();
  });
}

export function dismissNextDialog(page, expectedText) {
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain(expectedText);
    await dialog.dismiss();
  });
}

export async function captureJsonDownload(page, trigger) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    trigger(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const raw = await readFile(path, 'utf8');
  expect(raw.trim().length).toBeGreaterThan(2);
  const json = JSON.parse(raw);
  return { download, path, raw, json };
}

export async function expectNoHorizontalOverflow(page, tolerance = 1) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(tolerance);
}

export async function expectWithinViewport(page, selector, tolerance = 1) {
  const result = await page.locator(selector).evaluate((element, extra) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewport: document.documentElement.clientWidth,
      tolerance: extra,
    };
  }, tolerance);
  expect(result.left).toBeGreaterThanOrEqual(-tolerance);
  expect(result.right).toBeLessThanOrEqual(result.viewport + tolerance);
}

export async function appPackageVersion() {
  const packagePath = new URL('../../package.json', import.meta.url);
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  return pkg.version;
}
