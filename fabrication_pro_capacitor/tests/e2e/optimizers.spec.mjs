import { test, expect } from '@playwright/test';
import { acceptNextDialog, captureJsonDownload, openApp, openTool } from './helpers.mjs';

async function openSheetOptimizer(page) {
  await openApp(page);
  await openTool(page, 'Sheet Optimizer', '#tool-optimizer');
}

async function addSheetPart(page, { label = 'E2E Panel', width = '22', height = '30', qty = '1' } = {}) {
  await page.locator('#optimizerProduct').selectOption('exterior');
  await page.locator('#optimizerLabel').fill(label);
  await page.locator('#optimizerWidth').fill(width);
  await page.locator('#optimizerHeight').fill(height);
  await page.locator('#optimizerQty').fill(qty);
  await page.locator('#optimizerAddBtn').click();
  await page.locator('#optimizerCutListMenuBtn').click();
  await expect(page.locator('#optimizerCutListDrawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#optimizerJobList')).toContainText(label);
  await page.locator('#optimizerCutListCloseBtn').click();
}

async function openSawOptimizer(page) {
  await openApp(page);
  await openTool(page, 'Saw Optimizer', '#tool-saw');
}

async function addSawPart(page, { label = 'E2E Upright', length = '93', qty = '2' } = {}) {
  await page.locator('#sawTubeLength').fill('240');
  await page.locator('#sawPartLabel').fill(label);
  await page.locator('#sawPartLength').fill(length);
  await page.locator('#sawPartQty').fill(qty);
  await page.locator('#sawAddPartBtn').click();
  await page.locator('#sawCutListMenuBtn').click();
  await expect(page.locator('#sawCutListDrawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#sawPartList')).toContainText(label);
  await page.locator('#sawCutListCloseBtn').click();
}

test('Sheet Optimizer adds a real cut-list part and produces an optimized sheet result', async ({ page }) => {
  await openSheetOptimizer(page);
  await addSheetPart(page);

  await page.locator('#optimizerRunBtn').click();
  await expect(page.locator('#optimizerMaterialTotals')).not.toHaveText('');
  await expect(page.locator('#optimizerSheets')).not.toHaveText('');
});

test('Sheet Optimizer export/import round trip restores the job and still optimizes', async ({ page }) => {
  await openSheetOptimizer(page);
  await page.locator('#optimizerJobNumber').fill('E2E-100');
  await addSheetPart(page, { label: 'Portable Panel' });
  await page.locator('#optimizerSaveJobBtn').click();

  const exported = await captureJsonDownload(page, () => page.locator('#optimizerExportJobBtn').click());
  expect(exported.json.fabricationOptimizerJob.jobNumber).toBe('E2E-100');

  acceptNextDialog(page, 'Clear the current optimizer job');
  await page.locator('#optimizerClearBtn').click();
  await expect(page.locator('#optimizerJobNumber')).toHaveValue('');

  acceptNextDialog(page, 'already exists on this device');
  await page.locator('#optimizerImportFile').setInputFiles(exported.path);
  await expect(page.locator('#optimizerJobNumber')).toHaveValue('E2E-100');
  await page.locator('#optimizerCutListMenuBtn').click();
  await expect(page.locator('#optimizerJobList')).toContainText('Portable Panel');
  await page.locator('#optimizerCutListCloseBtn').click();

  await page.locator('#optimizerRunBtn').click();
  await expect(page.locator('#optimizerMaterialTotals')).not.toHaveText('');
  await expect(page.locator('#optimizerSheets')).not.toHaveText('');
});

test('Saw Optimizer adds parts and produces a tube/cut/offcut result', async ({ page }) => {
  await openSawOptimizer(page);
  await addSawPart(page);

  await page.locator('#sawOptimizeBtn').click();
  await expect(page.locator('#sawResults')).toHaveClass(/\bshow\b/);
  await expect(page.locator('#sawSummary')).not.toHaveText('');
  await expect(page.locator('#sawTubeResults')).toContainText('93');
});

test('Saw Optimizer export/import round trip restores stock and parts and reruns optimization', async ({ page }) => {
  await openSawOptimizer(page);
  await addSawPart(page, { label: 'Portable Upright', length: '93', qty: '2' });

  const exported = await captureJsonDownload(page, () => page.locator('#sawExportJobBtn').click());
  expect(exported.json.fabricationSawOptimizerJob.tubeLength).toBe(240);
  expect(exported.json.fabricationSawOptimizerJob.parts).toHaveLength(1);

  acceptNextDialog(page, 'Clear the current saw job');
  await page.locator('#sawClearBtn').click();
  await expect(page.locator('#sawPartList')).not.toContainText('Portable Upright');

  await page.locator('#sawImportFile').setInputFiles(exported.path);
  await expect(page.locator('#sawTubeLength')).toHaveValue('240');
  await page.locator('#sawCutListMenuBtn').click();
  await expect(page.locator('#sawPartList')).toContainText('Portable Upright');
  await page.locator('#sawCutListCloseBtn').click();

  await page.locator('#sawOptimizeBtn').click();
  await expect(page.locator('#sawResults')).toHaveClass(/\bshow\b/);
  await expect(page.locator('#sawSummary')).not.toHaveText('');
  await expect(page.locator('#sawTubeResults')).toContainText('93');
});
