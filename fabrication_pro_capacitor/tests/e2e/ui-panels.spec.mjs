import { test, expect } from '@playwright/test';
import { openApp } from './helpers.mjs';

async function openTool(page, label) {
  await page.locator('#pageMenuBtn').click();
  await page.locator('#pageMenuDrawer .fab-page-link', { hasText: label }).click();
}

test('Task Logging Info opens as a left-side drawer with the intro and timer behavior content', async ({ page }) => {
  await openApp(page);

  await expect(page.locator('#taskLogInfoBtn')).toBeVisible();
  await expect(page.locator('#tool-tasklog > .tool-title p')).toHaveCount(0);
  await expect(page.locator('#tool-tasklog > section.card', { hasText: 'Timer Behavior' })).toHaveCount(0);

  await page.locator('#taskLogInfoBtn').click();
  const drawer = page.locator('#taskLogInfoDrawer');
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await expect(drawer).toContainText('Create jobs, assign reusable preset tasks, and track real fabrication time with persistent start/stop timers.');
  await expect(drawer).toContainText('Timer Behavior');
  await expect(drawer).toContainText('One active task:');
  await expect(drawer).toContainText('Screen lock / page change:');

  const side = await drawer.evaluate(element => ({
    left: getComputedStyle(element).left,
    right: getComputedStyle(element).right,
    transform: getComputedStyle(element).transform
  }));
  expect(side.left).toBe('0px');
  expect(side.right).toBe('auto');

  await page.locator('#taskLogInfoCloseBtn').click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#taskLogInfoBtn')).toBeFocused();
});

test('Checklist, Sheet Optimizer, and Saw Optimizer management panels are collapsed by default and expandable', async ({ page }) => {
  await openApp(page);

  await openTool(page, 'Checklist');
  const checklist = page.locator('#checklistManagementDetails');
  await expect(checklist).not.toHaveAttribute('open', '');
  await checklist.locator('> summary').click();
  await expect(checklist).toHaveAttribute('open', '');
  await expect(page.locator('#checklistNewTopicBtn')).toBeVisible();

  await openTool(page, 'Sheet Optimizer');
  const sheet = page.locator('#optimizerManagementDetails');
  await expect(sheet).not.toHaveAttribute('open', '');
  await sheet.locator('> summary').click();
  await expect(sheet).toHaveAttribute('open', '');
  await expect(page.locator('#optimizerJobNumber')).toBeVisible();

  await openTool(page, 'Saw Optimizer');
  const saw = page.locator('#sawManagementDetails');
  await expect(saw).not.toHaveAttribute('open', '');
  await saw.locator('> summary').click();
  await expect(saw).toHaveAttribute('open', '');
  await expect(page.locator('#sawExportJobBtn')).toBeVisible();
});
