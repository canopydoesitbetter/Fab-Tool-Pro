import { test, expect } from '@playwright/test';

test('Fabri-Cadabra launches into Task Logging', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Fabri-Cadabra');
  await expect(page.locator('#tool-tasklog')).toHaveClass(/active/);
  await expect(page.getByRole('heading', { name: 'Task Logging' })).toBeVisible();
});
