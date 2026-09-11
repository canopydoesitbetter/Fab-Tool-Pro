import { test, expect } from '@playwright/test';
import { acceptNextDialog, captureJsonDownload, expectNoHorizontalOverflow, expectWithinViewport, openApp, openTool } from './helpers.mjs';

const APP_KEYS=[
  'fabricationTaskLogJobsV1',
  'fabricationTaskLogPresetsV1',
  'fabricationShiftScheduleV1',
  'fabricationFabricatorNotesV1',
  'fabricationChecklistV1',
  'fabricationOptimizerJobsV1',
  'fabricationTheme',
  'fabricationTool',
  'fabricationQuickReferenceTable',
  'fabricationQuickReferenceDecimalMode'
];

async function openSettings(page) {
  await page.locator('#pageMenuBtn').click();
  await page.locator('#settingsPageBtn').click();
  await expect(page.locator('#tool-settings')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#settingsDataBackupCard')).toBeVisible();
}

async function createTaskFixture(page) {
  const management=page.locator('#taskLogManagementDetails');
  if (!(await management.evaluate(el=>el.open))) await management.locator('> summary').click();
  await page.locator('#taskLogNewJobBtn').click();
  await page.locator('#taskLogJobTitle').click();
  await page.locator('#taskLogRenameInput').fill('Backup Job');
  await page.locator('#taskLogRenameApplyBtn').click();
  await page.locator('#taskLogPresetMenuBtn').click();
  await page.locator('#taskLogPresetName').fill('Backup Task');
  await page.locator('#taskLogAddPresetBtn').click();
  await page.locator('#taskLogSelectAllPresetsBtn').click();
  await page.locator('#taskLogAddSelectedPresetsBtn').click();
  await page.locator('#taskLogPresetCloseBtn').click();
  const row=page.locator('.tasklog-task-row',{hasText:'Backup Task'});
  await row.locator('[data-tasklog-timer-action="start"]').click();
  await page.clock.fastForward('00:12');
  await page.locator('#taskLogStopActiveBtn').click();
  await expect(row.locator('[data-tasklog-timer]')).toHaveText('00:00:12');
}

async function configureAndClockInShift(page) {
  await openSettings(page);
  const details=page.locator('#shiftScheduleDetails');
  if (!(await details.evaluate(el=>el.open))) await details.locator('> summary').click();
  await page.locator('#shiftStartDay').selectOption('1');
  await page.locator('#shiftEndDay').selectOption('5');
  await page.locator('#shiftClockInTime').fill('8');
  await page.locator('#shiftClockInPeriod').selectOption('AM');
  await page.locator('#shiftClockOutTime').fill('5');
  await page.locator('#shiftClockOutPeriod').selectOption('PM');
  for (const selector of ['#shiftBreakToggle','#shiftLunchToggle']) {
    if (await page.locator(selector).isChecked()) await page.locator(`label[for="${selector.slice(1)}"]`).click();
  }
  await page.locator('#shiftScheduleSaveBtn').click();
  acceptNextDialog(page,'Enable Shift Schedule');
  await page.locator('label[for="shiftScheduleMasterToggle"]').click();
  acceptNextDialog(page,'Clock in');
  await page.locator('#shiftClockBtn').click();
  await expect(page.locator('#shiftClockBtn')).toHaveText('CLOCK OUT');
}

async function createNotesFixture(page) {
  await openTool(page,'Fabricator Notes','#tool-notes');
  const details=page.locator('#fabricatorNotesManagementDetails');
  if (!(await details.evaluate(el=>el.open))) await details.locator('> summary').click();
  await page.locator('#fabricatorNotesNewBtn').click();
  await page.locator('#fabricatorNotesTitle').fill('Backup Note');
  const content=page.locator('#fabricatorNotesContent');
  await content.fill('Formatted backup note');
  await content.click();
  await page.keyboard.press('Control+A');
  await page.getByRole('button',{name:'Bold'}).click();
  await page.locator('#fabricatorNotesTitle').focus();
  await expect(content).toContainText('Formatted backup note');
}

async function createChecklistFixture(page) {
  await openTool(page,'Checklist','#tool-checklist');
  await page.locator('#checklistNewTopicBtn').click();
  await page.locator('#checklistTitle').fill('Backup Checklist');
  for (const item of ['Inspect welds','Verify dimensions']) {
    await page.locator('#checklistNewItem').fill(item);
    await page.locator('#checklistAddItemBtn').click();
  }
  await page.getByRole('checkbox',{name:'Mark complete: Inspect welds'}).click();
  await expect(page.locator('#checklistProgressText')).toHaveText('1 of 2 complete');
}

async function createOptimizerFixture(page) {
  await openTool(page,'Sheet Optimizer','#tool-optimizer');
  await page.locator('#optimizerJobNumber').fill('BACKUP-100');
  await page.locator('#optimizerProduct').selectOption('exterior');
  await page.locator('#optimizerLabel').fill('Backup Panel');
  await page.locator('#optimizerWidth').fill('22');
  await page.locator('#optimizerHeight').fill('30');
  await page.locator('#optimizerQty').fill('1');
  await page.locator('#optimizerAddBtn').click();
  await page.locator('#optimizerSaveJobBtn').click();
  await expect(page.locator('#optimizerActiveJobChip')).toContainText('Saved');
}

async function setPreferenceFixtures(page) {
  await openTool(page,'Quick Reference','#tool-reference');
  await page.locator('#quickReferenceSelect').selectOption('fraction-sixtyfourths');
  const mode=page.locator('#quickReferenceDecimalMode');
  if (!(await mode.isChecked())) await page.locator('label[for="quickReferenceDecimalMode"]').click();
  await expect(mode).toBeChecked();
  const themeBefore=await page.locator('html').getAttribute('data-theme');
  await page.locator('#themeToggle').click();
  const themeAfter=await page.locator('html').getAttribute('data-theme');
  expect(themeAfter).not.toBe(themeBefore);
  return themeAfter;
}

async function appStorageSnapshot(page) {
  return page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),APP_KEYS);
}

test('full backup restores all persistent categories and safely finalizes captured live state', async ({ page }) => {
  await page.clock.install({time:new Date('2026-09-10T08:00:00')});
  await openApp(page);
  await createTaskFixture(page);
  await configureAndClockInShift(page);
  await createNotesFixture(page);
  await createChecklistFixture(page);
  await createOptimizerFixture(page);
  const expectedTheme=await setPreferenceFixtures(page);

  await openTool(page,'Task Logging','#tool-tasklog');
  const liveTask=page.locator('.tasklog-task-row',{hasText:'Backup Task'});
  await liveTask.locator('[data-tasklog-timer-action="start"]').click();
  await page.clock.fastForward('00:08');
  await expect(liveTask.locator('[data-tasklog-timer]')).toHaveText('00:00:20');
  await expect(liveTask.locator('[data-tasklog-timer-action="stop"]')).toBeVisible();

  await openSettings(page);
  const exported=await captureJsonDownload(page,()=>page.locator('#settingsBackupBtn').click());
  expect(exported.json.format).toBe('FabriCadabraBackup');
  expect(exported.json.schemaVersion).toBe(1);
  expect(exported.json.appVersion).toBe('1.0.5');
  expect(exported.json.sections.taskLogging.jobs.jobs).toHaveLength(1);
  expect(exported.json.sections.taskLogging.presets.presets).toHaveLength(1);
  const backedUpTask=exported.json.sections.taskLogging.jobs.jobs[0].tasks[0];
  expect(backedUpTask.running).toBe(true);
  expect(backedUpTask.sessions).toHaveLength(1);
  expect(backedUpTask.accumulatedMs).toBeGreaterThanOrEqual(12000);
  expect(backedUpTask.accumulatedMs).toBeLessThan(13000);
  expect(exported.json.sections.fabricatorNotes.topics).toHaveLength(1);
  expect(exported.json.sections.checklists.topics).toHaveLength(1);
  expect(exported.json.sections.optimizer.savedJobs['BACKUP-100']).toBeTruthy();
  expect(exported.json.sections.preferences.quickReferenceTable).toBe('fraction-sixtyfourths');
  expect(exported.json.sections.preferences.quickReferenceDisplayMode).toBe('decimal');
  expect(exported.json.sections.shiftSchedule.clock.clockedIn).toBe(true);

  await page.evaluate(keys=>keys.forEach(key=>localStorage.removeItem(key)),APP_KEYS);
  await page.reload();
  await expect(page.locator('#taskLogEmpty')).toBeVisible();

  await openSettings(page);
  acceptNextDialog(page,'replace all Fabri-Cadabra data');
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('#settingsRestoreBtn').click();
  const chooser=await chooserPromise;
  await chooser.setFiles(exported.path);

  await expect(page.locator('#tool-tasklog')).toHaveClass(/\bactive\b/,{timeout:15000});
  await expect(page.locator('#taskLogJobTitle')).toHaveText('Backup Job');
  const restoredTask=page.locator('.tasklog-task-row',{hasText:'Backup Task'});
  await expect(restoredTask.locator('[data-tasklog-timer]')).toHaveText(/00:00:2[01]/);
  await expect(restoredTask.locator('[data-tasklog-timer-action="start"]')).toBeVisible();
  await expect(page.locator('[data-tasklog-timer-action="stop"]')).toHaveCount(0);
  await expect(restoredTask.locator('.tasklog-session-details')).toContainText('00:00:12');
  await expect(restoredTask.locator('.tasklog-session-details')).toContainText('00:00:08');

  await expect(page.locator('html')).toHaveAttribute('data-theme',expectedTheme);
  await openTool(page,'Quick Reference','#tool-reference');
  await expect(page.locator('#quickReferenceSelect')).toHaveValue('fraction-sixtyfourths');
  await expect(page.locator('#quickReferenceDecimalMode')).toBeChecked();

  await openTool(page,'Fabricator Notes','#tool-notes');
  await expect(page.locator('#fabricatorNotesTitle')).toHaveValue('Backup Note');
  await expect(page.locator('#fabricatorNotesContent')).toContainText('Formatted backup note');
  expect(await page.locator('#fabricatorNotesContent').innerHTML()).toMatch(/<(b|strong)>/i);

  await openTool(page,'Checklist','#tool-checklist');
  await expect(page.locator('#checklistTitle')).toHaveValue('Backup Checklist');
  await expect(page.locator('#checklistProgressText')).toHaveText('1 of 2 complete');

  await openTool(page,'Sheet Optimizer','#tool-optimizer');
  await expect(page.locator('#optimizerSavedJobs')).toContainText('BACKUP-100');
  await page.locator('#optimizerSavedJobs').selectOption('BACKUP-100');
  await page.locator('#optimizerLoadJobBtn').click();
  await expect(page.locator('#optimizerJobNumber')).toHaveValue('BACKUP-100');

  await openSettings(page);
  await expect(page.locator('#shiftScheduleMasterToggle')).toBeChecked();
  await expect(page.locator('#shiftClockBtn')).toHaveText('CLOCK IN');
  await expect(page.locator('#shiftClockStatus')).toContainText('Clocked Out');
});

test('invalid or unsupported full backup changes no app-owned persistent state', async ({ page }) => {
  await openApp(page);
  await page.locator('#themeToggle').click();
  await openSettings(page);
  const before=await appStorageSnapshot(page);
  const invalid={
    name:'unsupported-backup.json',
    mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({format:'FabriCadabraBackup',schemaVersion:99,appVersion:'99.0.0',exportedAt:new Date().toISOString(),sections:{}}))
  };
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('#settingsRestoreBtn').click();
  const chooser=await chooserPromise;
  await chooser.setFiles(invalid);
  await expect(page.locator('#settingsBackupStatus')).toContainText('newer', {timeout:10000});
  const after=await appStorageSnapshot(page);
  expect(after).toEqual(before);
});

test('destructive Notes import creates full recovery snapshot and recovery restore swaps an undo point', async ({ page }) => {
  await openApp(page);
  await createNotesFixture(page);
  const replacement={
    fabricatorNotes:{
      format:'FabricationFabricatorNotes',
      version:2,
      activeTopicId:10,
      nextId:11,
      topics:[{id:10,title:'Replacement Note',contentHtml:'Replacement content',createdAt:'2026-09-10T12:00:00.000Z',updatedAt:'2026-09-10T12:00:00.000Z'}]
    }
  };
  acceptNextDialog(page,'replace the Fabricator Notes');
  await page.locator('#fabricatorNotesImportFile').setInputFiles({name:'replacement-notes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))});
  await expect(page.locator('#fabricatorNotesTitle')).toHaveValue('Replacement Note',{timeout:10000});

  await openSettings(page);
  await expect(page.locator('#settingsRestoreRecoveryBtn')).toBeEnabled();
  await expect(page.locator('#settingsRecoveryMeta')).toHaveAttribute('data-recovery-reason','before-notes-import');
  acceptNextDialog(page,'restore the last recovery snapshot');
  await page.locator('#settingsRestoreRecoveryBtn').click();

  await expect(page.locator('#tool-tasklog')).toHaveClass(/\bactive\b/,{timeout:15000});
  await openTool(page,'Fabricator Notes','#tool-notes');
  await expect(page.locator('#fabricatorNotesTitle')).toHaveValue('Backup Note');
  await expect(page.locator('#fabricatorNotesContent')).toContainText('Formatted backup note');

  await openSettings(page);
  await expect(page.locator('#settingsRecoveryMeta')).toHaveAttribute('data-recovery-reason','before-recovery-restore');
});

test('@mobile Data & Backup controls stay usable without horizontal overflow', async ({ page }) => {
  await openApp(page);
  await openSettings(page);
  await expectNoHorizontalOverflow(page);
  await expectWithinViewport(page,'#settingsDataBackupCard');
  await expectWithinViewport(page,'#settingsBackupBtn');
  await expectWithinViewport(page,'#settingsRestoreBtn');
  await expectWithinViewport(page,'#settingsRestoreRecoveryBtn');
});
