import { test, expect } from '@playwright/test';
import { openApp, expectNoHorizontalOverflow } from './helpers.mjs';

test('header uses the approved app logo without repeating the app name', async ({ page }) => {
  await openApp(page);

  const logo = page.locator('#appHeaderLogo');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', 'app-logo.jpg');
  await expect(logo).toHaveAttribute('alt', 'Fabri-Cadabra');
  await expect(page.locator('.topbar .brand h1')).toHaveCount(0);
  await expect(page.locator('.topbar .brand-copy')).toContainText('The multi-tool built specifically for efficient shop fabrication.');
  await expectNoHorizontalOverflow(page);
});

test('Pages drawer carries the Fabri-Cadabra name above the navigation label', async ({ page }) => {
  await openApp(page);
  await page.locator('#pageMenuBtn').click();

  await expect(page.locator('#pageMenuDrawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#pageMenuBrandName')).toHaveText('Fabri-Cadabra');
  await expect(page.locator('#pageMenuDrawerTitle')).toHaveText('Pages');

  const brandBox = await page.locator('#pageMenuBrandName').boundingBox();
  const pagesBox = await page.locator('#pageMenuDrawerTitle').boundingBox();
  expect(brandBox).not.toBeNull();
  expect(pagesBox).not.toBeNull();
  expect(brandBox.y).toBeLessThan(pagesBox.y);
  await expectNoHorizontalOverflow(page);
});
