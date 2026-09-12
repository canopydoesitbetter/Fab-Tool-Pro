import { test, expect } from '@playwright/test';
import { openApp } from './helpers.mjs';

test('Fabri-Cadabra confirmation dialog traps focus, cancels with Escape, and restores prior focus', async ({ page }) => {
  await openApp(page);
  const opener=page.locator('#themeToggle');
  await opener.focus();
  await expect(opener).toBeFocused();

  await page.evaluate(() => {
    window.__confirmationResult='pending';
    window.FabriCadabraApp.confirmAction({
      title:'Delete saved item?',
      message:'This permanently removes the saved item.',
      confirmLabel:'Delete',
      cancelLabel:'Keep Item',
      danger:true
    }).then(result=>{ window.__confirmationResult=result; });
  });

  const dialog=page.locator('#appConfirmDialog');
  const cancel=page.locator('#appConfirmCancelBtn');
  const confirm=page.locator('#appConfirmConfirmBtn');
  await expect(dialog).toHaveAttribute('aria-hidden','false');
  await expect(dialog).toHaveAttribute('aria-modal','true');
  await expect(page.locator('#appConfirmTitle')).toHaveText('Delete saved item?');
  await expect(page.locator('#appConfirmMessage')).toHaveText('This permanently removes the saved item.');
  await expect(cancel).toHaveText('Keep Item');
  await expect(confirm).toHaveText('Delete');
  await expect(confirm).toHaveClass(/\bdanger\b/);
  await expect(cancel).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveAttribute('aria-hidden','true');
  await expect.poll(()=>page.evaluate(()=>window.__confirmationResult)).toBe(false);
  await expect(opener).toBeFocused();
});

test('Fabri-Cadabra confirmation dialog resolves true from its configured confirm action', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__confirmationResult='pending';
    window.FabriCadabraApp.confirmAction({
      title:'Continue?',
      message:'Proceed with this action?',
      confirmLabel:'Continue',
      cancelLabel:'Cancel'
    }).then(result=>{ window.__confirmationResult=result; });
  });

  const confirm=page.locator('#appConfirmConfirmBtn');
  await expect(confirm).toHaveText('Continue');
  await expect(confirm).not.toHaveClass(/\bdanger\b/);
  await expect(confirm).toBeFocused();
  await confirm.click();
  await expect.poll(()=>page.evaluate(()=>window.__confirmationResult)).toBe(true);
  await expect(page.locator('#appConfirmDialog')).toHaveAttribute('aria-hidden','true');
});
