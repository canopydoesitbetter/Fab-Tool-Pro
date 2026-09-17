import { test, expect } from '@playwright/test';
import { acceptNextDialog, captureJsonDownload, openApp, openTool } from './helpers.mjs';

async function openSettings(page) {
  await page.locator('#pageMenuBtn').click();
  await page.locator('#settingsPageBtn').click();
  await expect(page.locator('#tool-settings')).toHaveClass(/\bactive\b/);
}

test('full backup restores Fastener Spacing workspace and completion progress', async ({ page }) => {
  await openApp(page);
  await openTool(page,'Fastener Spacing','#tool-fasteners');

  await page.locator('#maxSpacing').fill('24');
  await page.locator('#fastenerLength').fill('100');
  await page.locator('#cornerTolerance').fill('2');
  await page.locator('#fastenerCalculateBtn').click();
  await page.locator('[data-fastener-index="2"]').click();
  await expect(page.locator('[data-fastener-index="2"]')).toHaveAttribute('aria-pressed','true');

  await openSettings(page);
  const exported=await captureJsonDownload(page,()=>page.locator('#settingsBackupBtn').click());
  expect(exported.json.sections.fastenerSpacing).toBeTruthy();
  expect(exported.json.sections.fastenerSpacing.maxSpacing).toBe('24');
  expect(exported.json.sections.fastenerSpacing.length).toBe('100');
  expect(exported.json.sections.fastenerSpacing.cornerTolerance).toBe('2');
  expect(exported.json.sections.fastenerSpacing.completedFasteners).toEqual([2]);

  await page.evaluate(()=>localStorage.removeItem('fabricationFastenerSpacingV1'));
  await page.reload();
  await openTool(page,'Fastener Spacing','#tool-fasteners');
  await expect(page.locator('#maxSpacing')).toHaveValue('');

  await openSettings(page);
  acceptNextDialog(page,'replace all Fabri-Cadabra data');
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('#settingsRestoreBtn').click();
  const chooser=await chooserPromise;
  await chooser.setFiles(exported.path);

  await openTool(page,'Fastener Spacing','#tool-fasteners');
  await expect(page.locator('#maxSpacing')).toHaveValue('24');
  await expect(page.locator('#fastenerLength')).toHaveValue('100');
  await expect(page.locator('#cornerTolerance')).toHaveValue('2');
  await expect(page.locator('[data-fastener-index="2"]')).toHaveAttribute('aria-pressed','true');
});
