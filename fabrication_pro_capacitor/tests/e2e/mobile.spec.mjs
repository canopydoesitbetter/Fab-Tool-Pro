import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow, expectWithinViewport, openApp, openTool } from './helpers.mjs';

test.describe('@mobile phone-sized Chromium', () => {
  test('launch, Pages navigation, theme, data entry, and drawer interaction remain usable', async ({ page }) => {
    await openApp(page);
    await expectNoHorizontalOverflow(page);
    await expect(page.locator('#pageMenuBtn')).toBeVisible();
    await expect(page.locator('#themeToggle')).toBeVisible();

    const initialTheme = await page.locator('html').getAttribute('data-theme');
    await page.locator('#themeToggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', initialTheme === 'dark' ? 'light' : 'dark');
    await expectNoHorizontalOverflow(page);

    await openTool(page, 'Fastener Spacing', '#tool-fasteners');
    await page.locator('#maxSpacing').fill('24');
    await page.locator('#fastenerLength').fill('100');
    await page.locator('#fastenerCalculateBtn').click();
    await expect(page.locator('#spaceCount')).not.toHaveText('—');
    await expect(page.locator('#spacingFraction')).not.toHaveText('—');
    await expectNoHorizontalOverflow(page);
    await expectWithinViewport(page, '#tool-fasteners');
    await expectWithinViewport(page, '#tool-fasteners .card');

    await openTool(page, 'Basic Calculator', '#tool-calculator');
    await page.locator('#calculatorGuideBtn').click();
    await expect(page.locator('#calculatorGuideDrawer')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#calculatorGuideCloseBtn')).toBeFocused();
    await expectNoHorizontalOverflow(page);
    await page.locator('#calculatorGuideCloseBtn').click();
    await expect(page.locator('#calculatorGuideDrawer')).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('@mobile narrow 360px viewport', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('page, active tools, cards, and primary controls stay inside the usable width', async ({ page }) => {
    await openApp(page);
    await expectNoHorizontalOverflow(page);
    await expectWithinViewport(page, '#tool-tasklog');
    await expectWithinViewport(page, '#pageMenuBtn');
    await expectWithinViewport(page, '#themeToggle');

    await openTool(page, 'Sheet Optimizer', '#tool-optimizer');
    await expectNoHorizontalOverflow(page);
    await expectWithinViewport(page, '#tool-optimizer');
    await expectWithinViewport(page, '#tool-optimizer .card');
    await expectWithinViewport(page, '#optimizerAddBtn');
    await expectWithinViewport(page, '#optimizerRunBtn');

    await openTool(page, 'Saw Optimizer', '#tool-saw');
    await expectNoHorizontalOverflow(page);
    await expectWithinViewport(page, '#tool-saw');
    await expectWithinViewport(page, '#tool-saw .card');
  });
});
