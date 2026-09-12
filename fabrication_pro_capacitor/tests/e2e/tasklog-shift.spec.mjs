import { test, expect } from '@playwright/test';
import { acceptNextDialog, captureJsonDownload, openApp } from './helpers.mjs';

async function openTaskLogManagement(page) {
  const details = page.locator('#taskLogManagementDetails');
  if (!(await details.evaluate(element => element.open))) {
    await details.locator('> summary').click();
  }
  await expect(details).toHaveAttribute('open', '');
}

async function createJob(page, title = 'E2E Job') {
  await openTaskLogManagement(page);
  await page.locator('#taskLogNewJobBtn').click();
  await expect(page.locator('#taskLogJobTitle')).toHaveText('Job 1');
  await page.locator('#taskLogJobTitle').click();
  await expect(page.locator('#taskLogRenameDialog')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#taskLogRenameInput').fill(title);
  await page.locator('#taskLogRenameApplyBtn').click();
  await expect(page.locator('#taskLogJobTitle')).toHaveText(title);
}

async function addPreset(page, name) {
  await page.locator('#taskLogPresetMenuBtn').click();
  await expect(page.locator('#taskLogPresetDrawer')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#taskLogPresetName').fill(name);
  await page.locator('#taskLogAddPresetBtn').click();
  await expect(page.locator('#taskLogPresetList')).toContainText(name);
  await page.locator('#taskLogPresetCloseBtn').click();
}

async function assignAllPresets(page) {
  await page.locator('#taskLogPresetMenuBtn').click();
  await page.locator('#taskLogSelectAllPresetsBtn').click();
  await page.locator('#taskLogAddSelectedPresetsBtn').click();
  await page.locator('#taskLogPresetCloseBtn').click();
}

async function createJobWithTasks(page, names = ['Cut', 'Assemble']) {
  await createJob(page);
  for (const name of names) await addPreset(page, name);
  await assignAllPresets(page);
  for (const name of names) await expect(page.locator('.tasklog-task-row', { hasText: name })).toBeVisible();
}

async function setToggle(page, inputSelector, checked) {
  const input = page.locator(inputSelector);
  if ((await input.isChecked()) === checked) return;
  const id = inputSelector.replace(/^#/, '');
  await page.locator(`label[for="${id}"]`).click();
  await expect(input).toBeChecked({ checked });
}

test('Task Logging creates, renames, and deletes a job through the UI', async ({ page }) => {
  await openApp(page);
  await createJob(page, 'Browser Job');
  await expect(page.locator('#taskLogJobList')).toContainText('Browser Job');

  await page.locator('#taskLogDeleteJobBtn').click();
  await acceptNextDialog(page, 'Delete Browser Job');
  await expect(page.locator('#taskLogEmpty')).toBeVisible();
  await expect(page.locator('#taskLogJobList')).not.toContainText('Browser Job');
});

test('Preset drawer assigns multiple tasks and removes an assignment without deleting the preset', async ({ page }) => {
  await openApp(page);
  await createJobWithTasks(page, ['Cut', 'Assemble']);

  await page.locator('#taskLogPresetMenuBtn').click();
  const assignedCut = page.locator('.tasklog-preset-row.assigned', { hasText: 'Cut' });
  await expect(assignedCut).toBeVisible();
  await assignedCut.getByRole('button', { name: 'Remove Cut from this job' }).click();
  await acceptNextDialog(page, 'Remove “Cut” from E2E Job');
  await expect(page.locator('.tasklog-task-row', { hasText: 'Cut' })).toHaveCount(0);
  await expect(page.locator('#taskLogPresetList')).toContainText('Cut');
  await expect(page.locator('#taskLogPresetList')).toContainText('Assemble');
});

test('Task timer advances deterministically and records a stopped session', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-07T08:00:00') });
  await openApp(page);
  await createJobWithTasks(page, ['Cut']);

  const row = page.locator('.tasklog-task-row', { hasText: 'Cut' });
  await row.locator('[data-tasklog-timer-action="start"]').click();
  await expect(page.locator('#taskLogRunningBanner')).toBeVisible();
  await page.clock.fastForward('01:05');
  await expect(row.locator('[data-tasklog-timer]')).toHaveText('00:01:05');
  await expect(page.locator('#taskLogRunningTime')).toHaveText('00:01:05');

  await page.locator('#taskLogStopActiveBtn').click();
  await expect(row.locator('[data-tasklog-timer]')).toHaveText('00:01:05');
  await expect(row.locator('[data-tasklog-timer-action="start"]')).toBeVisible();
  await expect(page.locator('#taskLogRunningBanner')).not.toBeVisible();
  await expect(row).toContainText('00:01:05');
});

test('Running task recovers from persisted absolute start time after reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-07T08:00:00') });
  await openApp(page);
  await createJobWithTasks(page, ['Recovery']);
  const row = page.locator('.tasklog-task-row', { hasText: 'Recovery' });

  await row.locator('[data-tasklog-timer-action="start"]').click();
  await page.clock.fastForward('01:05');
  await expect(row.locator('[data-tasklog-timer]')).toHaveText('00:01:05');

  await page.reload();
  await expect(page.locator('#tool-tasklog')).toHaveClass(/\bactive\b/);
  const restored = page.locator('.tasklog-task-row', { hasText: 'Recovery' });
  await expect(restored.locator('[data-tasklog-timer-action="stop"]')).toBeVisible();
  await page.clock.fastForward('00:35');
  await expect(restored.locator('[data-tasklog-timer]')).toHaveText('00:01:40');
});

test('Starting another task leaves exactly one running task', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-07T08:00:00') });
  await openApp(page);
  await createJobWithTasks(page, ['First', 'Second']);
  const first = page.locator('.tasklog-task-row', { hasText: 'First' });
  const second = page.locator('.tasklog-task-row', { hasText: 'Second' });

  await first.locator('[data-tasklog-timer-action="start"]').click();
  await page.clock.fastForward('00:10');
  await second.locator('[data-tasklog-timer-action="start"]').click();

  await expect(first.locator('[data-tasklog-timer-action="start"]')).toBeVisible();
  await expect(second.locator('[data-tasklog-timer-action="stop"]')).toBeVisible();
  await expect(page.locator('[data-tasklog-timer-action="stop"]')).toHaveCount(1);
  await expect(page.locator('#taskLogRunningLabel')).toContainText('Second');
});

test('Shift Schedule UI enables real clock in and clock out wiring', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-07T08:00:00') });
  await openApp(page);
  await expect(page.locator('#shiftClockBtn')).toBeDisabled();

  await page.locator('#pageMenuBtn').click();
  await page.locator('#pageMenuDrawer .fab-settings-link').click();
  await page.locator('#shiftScheduleDetails > summary').click();
  await page.locator('#shiftStartDay').selectOption('1');
  await page.locator('#shiftEndDay').selectOption('5');
  await page.locator('#shiftClockInTime').fill('8');
  await page.locator('#shiftClockInPeriod').selectOption('AM');
  await page.locator('#shiftClockOutTime').fill('5');
  await page.locator('#shiftClockOutPeriod').selectOption('PM');
  await setToggle(page, '#shiftBreakToggle', false);
  await setToggle(page, '#shiftLunchToggle', false);
  await page.locator('#shiftScheduleSaveBtn').click();

  await page.locator('label[for="shiftScheduleMasterToggle"]').click();
  await expect(page.locator('#appConfirmTitle')).toHaveText('Enable Shift Schedule?');
  await expect(page.locator('#appConfirmConfirmBtn')).toHaveText('Enable Shift Schedule');
  await expect(page.locator('#appConfirmTitle')).not.toHaveText('Clock In?');
  await acceptNextDialog(page, 'Enable Shift Schedule');
  await expect(page.locator('#shiftScheduleMasterToggle')).toBeChecked();
  await expect(page.locator('#shiftScheduleMasterState')).toHaveText('ENABLED');
  await expect(page.locator('#shiftClockBtn')).toBeEnabled();
  await expect(page.locator('#shiftClockBtn')).toHaveText('CLOCK IN');

  await page.locator('#shiftClockBtn').click();
  await acceptNextDialog(page, 'Clock in');
  await expect(page.locator('#shiftClockBtn')).toHaveText('CLOCK OUT');

  await page.locator('#shiftClockBtn').click();
  await acceptNextDialog(page, 'Clock out now');
  await expect(page.locator('#shiftClockBtn')).toHaveText('CLOCK IN');
});

test('Task Logging jobs export and import restore job, task, and elapsed state', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-07T08:00:00') });
  await openApp(page);
  await createJobWithTasks(page, ['Exported Task']);
  const row = page.locator('.tasklog-task-row', { hasText: 'Exported Task' });
  await row.locator('[data-tasklog-timer-action="start"]').click();
  await page.clock.fastForward('00:12');
  await page.locator('#taskLogStopActiveBtn').click();

  const exported = await captureJsonDownload(page, () => page.locator('#taskLogExportJobsBtn').click());
  expect(exported.json.taskLogJobs).toBeTruthy();

  await page.locator('#taskLogDeleteJobBtn').click();
  await acceptNextDialog(page, 'Delete E2E Job');
  await expect(page.locator('#taskLogEmpty')).toBeVisible();

  await page.locator('#taskLogImportJobsFile').setInputFiles(exported.path);
  await expect(page.locator('#taskLogJobTitle')).toHaveText('E2E Job');
  await expect(page.locator('.tasklog-task-row', { hasText: 'Exported Task' })).toContainText('00:00:12');
});

test('Preset export and import restore the preset library independently', async ({ page }) => {
  await openApp(page);
  await createJob(page);
  await addPreset(page, 'Portable Preset');

  await page.locator('#taskLogPresetMenuBtn').click();
  const exported = await captureJsonDownload(page, () => page.locator('#taskLogExportPresetsBtn').click());
  expect(exported.json.taskLogPresets).toBeTruthy();

  await page.locator('#taskLogPresetList').getByRole('button', { name: 'Delete preset Portable Preset' }).click();
  await acceptNextDialog(page, 'Delete preset task');
  await expect(page.locator('#taskLogPresetList')).not.toContainText('Portable Preset');

  await page.locator('#taskLogImportPresetsFile').setInputFiles(exported.path);
  await expect(page.locator('#taskLogPresetList')).toContainText('Portable Preset');
  await expect(page.locator('#taskLogJobTitle')).toHaveText('E2E Job');
});
