import { test, expect } from '@playwright/test';
import { acceptNextDialog, captureJsonDownload, openApp, openTool } from './helpers.mjs';

async function openNotes(page) {
  await openApp(page);
  await openTool(page, 'Fabricator Notes', '#tool-notes');
  const details = page.locator('#fabricatorNotesManagementDetails');
  if (!(await details.evaluate(element => element.open))) await details.locator('> summary').click();
  await expect(details).toHaveAttribute('open', '');
}

async function createNote(page, title, content) {
  await page.locator('#fabricatorNotesNewBtn').click();
  await expect(page.locator('#fabricatorNotesTitle')).toHaveValue('New Topic');
  await page.locator('#fabricatorNotesTitle').fill(title);
  await page.locator('#fabricatorNotesContent').fill(content);
  await page.locator('#fabricatorNotesTitle').focus();
  await expect(page.locator('#fabricatorNotesTitle')).toHaveValue(title);
}

async function openChecklist(page) {
  await openApp(page);
  await openTool(page, 'Checklist', '#tool-checklist');
}

async function createChecklist(page, title, items) {
  await page.locator('#checklistNewTopicBtn').click();
  await expect(page.locator('#checklistTitle')).toHaveValue('New Checklist');
  await page.locator('#checklistTitle').fill(title);
  for (const item of items) {
    await page.locator('#checklistNewItem').fill(item);
    await page.locator('#checklistAddItemBtn').click();
  }
}

function checklistCheckbox(page, item, checked = false) {
  return page.getByRole('checkbox', { name: `${checked ? 'Mark incomplete' : 'Mark complete'}: ${item}` });
}

function checklistDragHandle(page, item) {
  return page.getByRole('button', { name: new RegExp(`^Reorder checklist item: ${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`) });
}

function checklistItemInput(page, index) {
  return page.locator('.checklist-item-text').nth(index);
}

async function setChecklistComplete(page, item, complete) {
  const current = checklistCheckbox(page, item, !complete);
  await current.click();
  await expect(checklistCheckbox(page, item, complete)).toBeChecked({ checked: complete });
}

test('Fabricator Notes creates, edits, switches topics, and deletes through visible controls', async ({ page }) => {
  await openNotes(page);
  await createNote(page, 'Door Setup', 'Hinge measurements');
  await createNote(page, 'Weld Notes', 'Tack corners first');

  await page.locator('#fabricatorNotesTopicsBtn').click();
  await expect(page.locator('#fabricatorNotesTopicsDrawer')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#fabricatorNotesTopicList').getByRole('button', { name: /Door Setup/ }).click();
  await expect(page.locator('#fabricatorNotesTopicsDrawer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#fabricatorNotesTitle')).toHaveValue('Door Setup');
  await expect(page.locator('#fabricatorNotesContent')).toContainText('Hinge measurements');

  await page.locator('#fabricatorNotesContent').fill('Updated hinge measurements');
  await page.locator('#fabricatorNotesTitle').focus();
  await expect(page.locator('#fabricatorNotesContent')).toContainText('Updated hinge measurements');

  acceptNextDialog(page, 'Delete the topic');
  await page.locator('#fabricatorNotesDeleteBtn').click();
  await expect(page.locator('#fabricatorNotesTitle')).toHaveValue('Weld Notes');
  await expect(page.locator('#fabricatorNotesCount')).toHaveText('1');
});

test('Fabricator Notes formatting and export/import round trip preserve rich text', async ({ page }) => {
  await openNotes(page);
  await createNote(page, 'Formatted Note', 'Bold italic underline');

  const content = page.locator('#fabricatorNotesContent');
  await content.click();
  await page.keyboard.press('Control+A');
  await page.getByRole('button', { name: 'Bold' }).click();
  await content.click();
  await page.keyboard.press('Control+A');
  await page.getByRole('button', { name: 'Italic' }).click();
  await content.click();
  await page.keyboard.press('Control+A');
  await page.getByRole('button', { name: 'Underline' }).click();
  await page.locator('#fabricatorNotesTitle').focus();

  const html = await content.innerHTML();
  expect(html).toMatch(/<(b|strong)>/i);
  expect(html).toMatch(/<(i|em)>/i);
  expect(html).toMatch(/<u>/i);

  const exported = await captureJsonDownload(page, () => page.locator('#fabricatorNotesExportBtn').click());
  expect(exported.json.fabricatorNotes.topics).toHaveLength(1);

  acceptNextDialog(page, 'Delete the topic');
  await page.locator('#fabricatorNotesDeleteBtn').click();
  await expect(page.locator('#fabricatorNotesCount')).toHaveText('0');

  await page.locator('#fabricatorNotesImportFile').setInputFiles(exported.path);
  await expect(page.locator('#fabricatorNotesTitle')).toHaveValue('Formatted Note');
  await expect(content).toContainText('Bold italic underline');
  const restoredHtml = await content.innerHTML();
  expect(restoredHtml).toMatch(/<(b|strong)>/i);
  expect(restoredHtml).toMatch(/<(i|em)>/i);
  expect(restoredHtml).toMatch(/<u>/i);
});

test('Checklist creates, edits, completes, reorders, persists, and deletes items', async ({ page }) => {
  await openChecklist(page);
  await createChecklist(page, 'Final Inspection', ['First item', 'Second item', 'Third item']);
  await expect(page.locator('#checklistProgressText')).toHaveText('0 of 3 complete');
  await expect(checklistItemInput(page, 0)).toHaveValue('First item');
  await expect(checklistItemInput(page, 1)).toHaveValue('Second item');
  await expect(checklistItemInput(page, 2)).toHaveValue('Third item');

  await setChecklistComplete(page, 'First item', true);
  await expect(page.locator('#checklistProgressText')).toHaveText('1 of 3 complete');
  await setChecklistComplete(page, 'First item', false);
  await expect(page.locator('#checklistProgressText')).toHaveText('0 of 3 complete');

  await checklistDragHandle(page, 'First item').focus();
  await page.keyboard.press('End');
  await expect(checklistItemInput(page, 2)).toHaveValue('First item');

  await page.reload();
  await openTool(page, 'Checklist', '#tool-checklist');
  await expect(page.locator('#checklistTitle')).toHaveValue('Final Inspection');
  await expect(checklistItemInput(page, 0)).toHaveValue('Second item');
  await expect(checklistItemInput(page, 2)).toHaveValue('First item');

  acceptNextDialog(page, 'Delete the checklist');
  await page.locator('#checklistDeleteTopicBtn').click();
  await expect(page.locator('#checklistTitle')).toHaveValue('');
  await expect(page.locator('#checklistProgressText')).toHaveText('0 of 0 complete');
});

test('Checklist export/import round trip restores order and completion state', async ({ page }) => {
  await openChecklist(page);
  await createChecklist(page, 'Portable Checklist', ['Alpha', 'Beta', 'Gamma']);
  await setChecklistComplete(page, 'Beta', true);
  await checklistDragHandle(page, 'Alpha').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#checklistProgressText')).toHaveText('1 of 3 complete');

  const exported = await captureJsonDownload(page, () => page.locator('#checklistExportBtn').click());
  expect(exported.json.fabricationChecklist.topics).toHaveLength(1);

  acceptNextDialog(page, 'Delete the checklist');
  await page.locator('#checklistDeleteTopicBtn').click();
  await page.locator('#checklistImportFile').setInputFiles(exported.path);

  await expect(page.locator('#checklistTitle')).toHaveValue('Portable Checklist');
  await expect(page.locator('#checklistProgressText')).toHaveText('1 of 3 complete');
  await expect(checklistItemInput(page, 0)).toHaveValue('Beta');
  await expect(checklistItemInput(page, 2)).toHaveValue('Alpha');
  await expect(checklistCheckbox(page, 'Beta', true)).toBeChecked();
});
