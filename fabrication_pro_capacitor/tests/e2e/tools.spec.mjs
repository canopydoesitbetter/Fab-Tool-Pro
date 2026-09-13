import { test, expect } from '@playwright/test';
import { openApp, openTool } from './helpers.mjs';

async function openCalculator(page) {
  await openApp(page);
  await openTool(page, 'Basic Calculator', '#tool-calculator');
}

async function clickCalc(page, action, value) {
  const selector = value === undefined
    ? `[data-calc-action="${action}"]`
    : `[data-calc-action="${action}"][data-calc-value="${value}"]`;
  await page.locator('#tool-calculator').locator(selector).click();
}

test('Basic Calculator handles button arithmetic, square root, keyboard input, and its guide drawer', async ({ page }) => {
  await openCalculator(page);

  await clickCalc(page, 'digit', '7');
  await clickCalc(page, 'operator', '+');
  await clickCalc(page, 'digit', '5');
  await clickCalc(page, 'equals');
  await expect(page.locator('#calculatorDisplay')).toHaveText('12');

  await page.locator('#calculatorClearBtn').click();
  await clickCalc(page, 'digit', '9');
  await clickCalc(page, 'sqrt');
  await expect(page.locator('#calculatorDisplay')).toHaveText('3');

  await page.locator('#calculatorClearBtn').click();
  await page.keyboard.press('8');
  await page.keyboard.press('*');
  await page.keyboard.press('4');
  await page.keyboard.press('Enter');
  await expect(page.locator('#calculatorDisplay')).toHaveText('32');

  await page.locator('#calculatorGuideBtn').click();
  await expect(page.locator('#calculatorGuideDrawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#calculatorGuideBtn')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#calculatorGuideCloseBtn').click();
  await expect(page.locator('#calculatorGuideDrawer')).toHaveAttribute('aria-hidden', 'true');
});

test('Quick Reference changes tables, highlights a gauge value, and persists decimal display mode', async ({ page }) => {
  await openApp(page);
  await openTool(page, 'Quick Reference', '#tool-reference');

  await page.locator('#quickReferenceSelect').selectOption('gauge-thickness');
  await expect(page.locator('#quickReferenceTitle')).toHaveText('Gauge → Decimal Thickness');
  await expect(page.locator('#quickReferenceBadge')).toHaveText('Nominal inches');

  const gaugeCell = page.locator('#quickReferenceTable td[data-gauge][data-gauge-material]').first();
  await gaugeCell.click();
  await expect(gaugeCell).toHaveClass(/\bis-selected\b/);

  await page.locator('#quickReferenceSelect').selectOption('fraction-addition');
  await expect(page.locator('.quick-ref-display-mode')).toBeVisible();
  const mode = page.locator('#quickReferenceDecimalMode');
  if (!(await mode.isChecked())) await page.locator('label[for="quickReferenceDecimalMode"]').click();
  await expect(mode).toBeChecked();
  await expect(page.locator('#quickReferenceDecimalLabel')).toHaveClass(/\bactive\b/);

  await page.reload();
  await openTool(page, 'Quick Reference', '#tool-reference');
  await expect(page.locator('#quickReferenceSelect')).toHaveValue('fraction-addition');
  await expect(page.locator('#quickReferenceDecimalMode')).toBeChecked();
  await expect(page.locator('#quickReferenceDecimalLabel')).toHaveClass(/\bactive\b/);
});

test('Fastener Spacing applies corner tolerance, tracks completion, and restores the workspace', async ({ page }) => {
  await openApp(page);
  await openTool(page, 'Fastener Spacing', '#tool-fasteners');

  await expect(page.locator('#cornerTolerance')).toHaveValue('0');
  await page.locator('#maxSpacing').fill('24');
  await page.locator('#fastenerLength').fill('100');
  await page.locator('#fastenerCalculateBtn').click();

  await expect(page.locator('#spaceCount')).toHaveText('5');
  await expect(page.locator('#fastenerCount')).toHaveText('6');
  await expect(page.locator('#spacingFraction')).toContainText('20');
  await expect(page.locator('#spacingDecimal')).toContainText('20');
  await expect(page.locator('[data-fastener-index="0"] .pos')).toHaveText('0"');
  await expect(page.locator('[data-fastener-index="5"] .pos')).toHaveText('100"');

  await page.locator('#cornerTolerance').fill('2');
  await page.locator('#fastenerCalculateBtn').click();
  await expect(page.locator('#spaceCount')).toHaveText('4');
  await expect(page.locator('#fastenerCount')).toHaveText('5');
  await expect(page.locator('#spacingFraction')).toContainText('24');
  await expect(page.locator('[data-fastener-index="0"] .pos')).toHaveText('2"');
  await expect(page.locator('[data-fastener-index="4"] .pos')).toHaveText('98"');

  const thirdFastener=page.locator('[data-fastener-index="2"]');
  await thirdFastener.click();
  await expect(thirdFastener).toHaveAttribute('aria-pressed','true');
  await expect(thirdFastener).toHaveClass(/\bfastener-complete\b/);

  await page.reload();
  await openTool(page, 'Fastener Spacing', '#tool-fasteners');
  await expect(page.locator('#maxSpacing')).toHaveValue('24');
  await expect(page.locator('#fastenerLength')).toHaveValue('100');
  await expect(page.locator('#cornerTolerance')).toHaveValue('2');
  await expect(page.locator('#fastenerResults')).toHaveClass(/\bshow\b/);
  await expect(page.locator('[data-fastener-index="0"] .pos')).toHaveText('2"');
  await expect(page.locator('[data-fastener-index="4"] .pos')).toHaveText('98"');
  await expect(page.locator('[data-fastener-index="2"]')).toHaveAttribute('aria-pressed','true');

  await page.locator('#cornerTolerance').fill('3');
  await page.locator('#fastenerCalculateBtn').click();
  await expect(page.locator('[data-fastener-index="2"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-fastener-index="0"] .pos')).toHaveText('3"');
  await expect(page.locator('[data-fastener-index="4"] .pos')).toHaveText('97"');

  await page.locator('#fastenerClearBtn').click();
  await expect(page.locator('#maxSpacing')).toHaveValue('');
  await expect(page.locator('#fastenerLength')).toHaveValue('');
  await expect(page.locator('#cornerTolerance')).toHaveValue('0');
  await expect(page.locator('#fastenerResults')).not.toHaveClass(/\bshow\b/);

  await page.reload();
  await openTool(page, 'Fastener Spacing', '#tool-fasteners');
  await expect(page.locator('#maxSpacing')).toHaveValue('');
  await expect(page.locator('#fastenerLength')).toHaveValue('');
  await expect(page.locator('#cornerTolerance')).toHaveValue('0');
  await expect(page.locator('#fastenerResults')).not.toHaveClass(/\bshow\b/);
});

test('Aluminum Overhang returns deterministic one-piece cuts for 100 by 84', async ({ page }) => {
  await openApp(page);
  await openTool(page, 'Aluminum Overhang', '#tool-overhang');

  await page.locator('#longSide').fill('100');
  await page.locator('#shortSide').fill('84');
  await page.locator('#overhangCalculateBtn').click();

  await expect(page.locator('#longResult')).toContainText('Cut 102"');
  await expect(page.locator('#shortResult')).toContainText('Cut 84"');
});
