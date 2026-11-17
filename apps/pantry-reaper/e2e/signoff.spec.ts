import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import { watchPage } from './guard';

async function addFood(page: Page, query: string): Promise<void> {
  const search = page.getByRole('combobox', { name: 'Search foods' });
  await search.fill(query);
  await expect(page.getByRole('option').first()).toBeVisible();
  await search.press('Enter');
  const sheet = page.locator('oss-sheet dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Save item' }).click();
  await expect(sheet).toBeHidden();
}

const tab = (page: Page, name: string) => page.locator('oss-shell nav[aria-label="Main"]').getByRole('button', { name });

test('the Import tab, the import link and the Backup tab all work', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const guard = watchPage(page);
  await page.goto('/');

  await tab(page, 'Import').click();
  await expect(page.locator('oss-import dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('oss-import dialog')).toBeHidden();

  await page.getByRole('button', { name: 'or import a list' }).click();
  await expect(page.locator('oss-import dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await addFood(page, 'yogurt');
  await tab(page, 'Backup').click();
  await expect(tab(page, 'Backup')).toHaveAttribute('aria-current', 'page');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
  const file = (await download.path()) ?? '';
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  expect(JSON.parse(readFileSync(file, 'utf8')).items).toHaveLength(1);

  // Use the item up, then restore it from the file.
  await tab(page, 'Items').click();
  await page.locator('oss-item', { hasText: 'Yogurt' }).click();
  await page.getByRole('button', { name: 'Used it' }).click();
  await expect(page.locator('oss-item')).toHaveCount(0);
  await tab(page, 'Backup').click();
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.locator('oss-toast .toast')).toContainText('Restored 1 item');
  await tab(page, 'Items').click();
  await expect(page.locator('oss-item', { hasText: 'Yogurt' })).toBeVisible();

  guard.check();
  expect(guard.errors).toEqual([]);
});
