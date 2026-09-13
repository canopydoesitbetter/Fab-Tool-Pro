import { test, expect } from '@playwright/test';
import { openApp } from './helpers.mjs';

async function openTool(page, label) {
  await page.locator('#pageMenuBtn').click();
  await page.locator('#pageMenuDrawer .fab-page-link', { hasText: label }).click();
}

async function expectLeftDrawer(page, buttonSelector, drawerSelector, closeSelector) {
  const button = page.locator(buttonSelector);
  const drawer = page.locator(drawerSelector);
  await button.click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await expect(drawer).toHaveClass(/drawer-left/);
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
  await page.locator(closeSelector).click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(button).toBeFocused();
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

  const side = await drawer.evaluate(element => ({ left: getComputedStyle(element).left }));
  const box = await drawer.boundingBox();
  expect(side.left).toBe('0px');
  expect(box).not.toBeNull();
  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);

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

test('Basic Calculator Guide matches the page Info control and opens from the left', async ({ page }) => {
  await openApp(page);
  await openTool(page, 'Basic Calculator');

  const guide = page.locator('#calculatorGuideBtn');
  await expect(page.locator('#tool-calculator > .tool-title p')).toHaveCount(0);
  await expect(guide).toHaveText('Guide');
  await expect(guide).toHaveClass(/page-info-btn/);
  await expect(page.locator('#taskLogInfoBtn')).toHaveClass(/page-info-btn/);

  await guide.click();
  const drawer = page.locator('#calculatorGuideDrawer');
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await expect(drawer).toHaveClass(/drawer-left/);
  await expect(drawer).toContainText('Calculator Guide');
  await expect(drawer).toContainText('Function definitions');
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);

  await page.locator('#calculatorGuideCloseBtn').click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(guide).toBeFocused();
});

test('Sheet, Saw, and Aluminum Overhang guidance lives in matching left-side Info drawers', async ({ page }) => {
  await openApp(page);

  const cases = [
    {
      label: 'Sheet Optimizer', panel: '#tool-optimizer', button: '#optimizerInfoBtn', drawer: '#optimizerInfoDrawer', close: '#optimizerInfoCloseBtn',
      intro: 'Add finished panel sizes and quantities. The optimizer evaluates the entire job together', rules: 'Automatic Product & Material Rules'
    },
    {
      label: 'Saw Optimizer', panel: '#tool-saw', button: '#sawInfoBtn', drawer: '#sawInfoDrawer', close: '#sawInfoCloseBtn',
      intro: 'Enter the stock tube length, add every required part, then optimize the full job', rules: 'Saw Optimization Rule'
    },
    {
      label: 'Aluminum Overhang', panel: '#tool-overhang', button: '#overhangInfoBtn', drawer: '#overhangInfoDrawer', close: '#overhangInfoCloseBtn',
      intro: 'Enter the finished overhang dimensions. The tool will automatically add corner & seam flanges.', rules: 'Fabrication Rules Used'
    }
  ];

  for (const entry of cases) {
    await openTool(page, entry.label);
    await expect(page.locator(`${entry.panel} > .tool-title p`)).toHaveCount(0);
    await expect(page.locator(entry.button)).toHaveText('Info');
    await expect(page.locator(entry.button)).toHaveClass(/page-info-btn/);
    await expect(page.locator(`${entry.panel} > section.card`, { hasText: entry.rules })).toHaveCount(0);

    await page.locator(entry.button).click();
    const drawer = page.locator(entry.drawer);
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(drawer).toHaveClass(/drawer-left/);
    await expect(drawer).toContainText(entry.intro);
    await expect(drawer).toContainText(entry.rules);
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
    await page.locator(entry.close).click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator(entry.button)).toBeFocused();
  }
});

test('Quick Reference fraction charts omit instructional descriptions and the first title names 1/16', async ({ page }) => {
  await openApp(page);
  await openTool(page, 'Quick Reference');

  await expect(page.locator('#quickReferenceTitle')).toHaveText('Fraction Addition Chart — 1/16');
  await expect(page.locator('#quickReferenceDescription')).toBeHidden();
  await expect(page.locator('#tool-reference')).not.toContainText('Add common shop fractions in 1/16" increments. Pick the starting measurement on the left, then move across to the amount being added.');

  await page.locator('#quickReferenceSelect').selectOption('fraction-decimal');
  await expect(page.locator('#quickReferenceTitle')).toHaveText('Fraction Addition Chart — 1/32');
  await expect(page.locator('#quickReferenceDescription')).toBeHidden();
  await expect(page.locator('#tool-reference')).not.toContainText('Add common shop fractions in 1/32" increments. Pick the starting measurement on the left, then move across to the amount being added.');

  await page.locator('#quickReferenceSelect').selectOption('fraction-sixtyfourths');
  await expect(page.locator('#quickReferenceTitle')).toHaveText('Fraction Addition Chart — 1/64');
  await expect(page.locator('#quickReferenceDescription')).toBeHidden();
  await expect(page.locator('#tool-reference')).not.toContainText('Add common shop fractions in 1/64" increments. Pick the starting measurement on the left, then move across to the amount being added.');

  await page.locator('#quickReferenceSelect').selectOption('gauge-thickness');
  await expect(page.locator('#quickReferenceDescription')).toBeVisible();
  await expect(page.locator('#quickReferenceDescription')).toContainText('Nominal decimal-inch thickness by material.');
});

test('Fabricator Notes and Checklist omit the introductory page descriptions', async ({ page }) => {
  await openApp(page);

  await openTool(page, 'Fabricator Notes');
  await expect(page.locator('#tool-notes > .tool-title p')).toHaveCount(0);
  await expect(page.locator('#tool-notes')).not.toContainText('Create shop topics and keep detailed notes inside each topic.');

  await openTool(page, 'Checklist');
  await expect(page.locator('#tool-checklist > .tool-title p')).toHaveCount(0);
  await expect(page.locator('#tool-checklist')).not.toContainText('Create checklist topics for shop tasks, inspections, fabrication steps, or reminders.');
});
