import { test, expect } from '@playwright/test';
import { acceptNextDialog, captureJsonDownload, openApp, openTool } from './helpers.mjs';

async function openSettings(page) {
  await page.locator('#pageMenuBtn').click();
  await page.locator('#settingsPageBtn').click();
  await expect(page.locator('#tool-settings')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#settingsDataBackupCard')).toBeVisible();
}

test('full backup preserves and restores the Fastener Spacing workspace', async ({ page }) => {
  await openApp(page);
  await openTool(page,'Fastener Spacing','#tool-fasteners');

  await page.locator('#maxSpacing').fill('24');
  await page.locator('#fastenerLength').fill('100');
  await page.locator('#cornerTolerance').fill('2');
  await page.locator('#fastenerCalculateBtn').click();
  await expect(page.locator('#fastenerCount')).toHaveText('5');
  await page.locator('[data-fastener-index="2"]').click();
  await expect(page.locator('[data-fastener-index="2"]')).toHaveAttribute('aria-pressed','true');

  await openSettings(page);
  const exported=await captureJsonDownload(page,()=>page.locator('#settingsBackupBtn').click());
  expect(exported.json.sections.fastenerSpacing).toMatchObject({
    version:1,
    maxSpacing:'24',
    length:'100',
    cornerTolerance:'2',
    completedFasteners:[2]
  });
  expect(exported.json.sections.fastenerSpacing.layoutSignature).not.toBe('');

  await page.evaluate(()=>localStorage.removeItem('fabricationFastenerSpacingV1'));
  await page.reload();
  await openTool(page,'Fastener Spacing','#tool-fasteners');
  await expect(page.locator('#maxSpacing')).toHaveValue('');
  await expect(page.locator('#fastenerLength')).toHaveValue('');
  await expect(page.locator('#cornerTolerance')).toHaveValue('0');

  await openSettings(page);
  acceptNextDialog(page,'replace all Fabri-Cadabra data');
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('#settingsRestoreBtn').click();
  const chooser=await chooserPromise;
  await chooser.setFiles(exported.path);

  await expect(page.locator('#tool-tasklog')).toHaveClass(/\bactive\b/,{timeout:15000});
  await openTool(page,'Fastener Spacing','#tool-fasteners');
  await expect(page.locator('#maxSpacing')).toHaveValue('24');
  await expect(page.locator('#fastenerLength')).toHaveValue('100');
  await expect(page.locator('#cornerTolerance')).toHaveValue('2');
  await expect(page.locator('#fastenerResults')).toHaveClass(/\bshow\b/);
  await expect(page.locator('[data-fastener-index="2"]')).toHaveAttribute('aria-pressed','true');
});
