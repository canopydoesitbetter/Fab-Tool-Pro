import { test, expect } from '@playwright/test';
import { openApp, expectNoHorizontalOverflow } from './helpers.mjs';

const EXPECTED_PAGE_ORDER = [
  'tasklog',
  'notes',
  'checklist',
  'calculator',
  'reference',
  'fasteners',
  'optimizer',
  'saw',
  'overhang'
];

test('header uses the approved wizard-hat logo as the Pages control without repeating the app name', async ({ page }) => {
  await openApp(page);

  const trigger = page.locator('#pageMenuBtn');
  const logo = trigger.locator('#appHeaderLogo');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', 'app-logo.jpg');
  await expect(logo).toHaveAttribute('alt', 'Fabri-Cadabra');
  await expect(trigger).toHaveAttribute('aria-label', 'Open Pages');
  await expect(page.locator('.topbar .brand h1')).toHaveCount(0);
  await expect(page.locator('.topbar .brand-copy')).toHaveText('Built for efficient shop fabrication. — Tap the wizard hat to open Pages.');
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

test('physical tool panel order matches the Pages drawer order with Settings last', async ({ page }) => {
  await openApp(page);

  const drawerOrder = await page.locator('#pageMenuDrawer .fab-page-link').evaluateAll(buttons =>
    buttons.map(button => button.dataset.tool)
  );
  const panelOrder = await page.locator('main.app > section.tool-panel[id^="tool-"]').evaluateAll(panels =>
    panels.map(panel => panel.id.replace(/^tool-/, ''))
  );

  expect(drawerOrder).toEqual(EXPECTED_PAGE_ORDER);
  expect(panelOrder).toEqual([...EXPECTED_PAGE_ORDER, 'settings']);
});
