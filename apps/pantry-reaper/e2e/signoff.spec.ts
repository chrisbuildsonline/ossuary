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

test('the storage switch is a segmented control with one selected segment and no required hint', async ({ page }) => {
  const guard = watchPage(page);
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Search foods' });
  await search.fill('yogurt');
  await search.press('Enter');
  const sheet = page.locator('oss-sheet dialog');
  await expect(sheet.getByRole('radiogroup', { name: 'Storage' }).getByRole('radio', { checked: true })).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Save item' }).click();
  await page.locator('oss-item', { hasText: 'Yogurt' }).click();

  const group = page.locator('pr-storage-switch').getByRole('radiogroup', { name: 'Storage' });
  const checked = group.getByRole('radio', { checked: true });
  await expect(checked).toHaveCount(1);
  await expect(checked).toHaveText('Fridge');
  for (const [name, toast] of [
    ['Freezer', 'Moved to freezer'],
    ['Fridge', 'Moved to fridge'],
  ] as const) {
    await group.getByRole('radio', { name }).click();
    await expect(page.locator('oss-toast .toast')).toContainText(toast);
    await expect(checked).toHaveCount(1);
    await expect(checked).toHaveText(name);
  }
  await expect(page.locator('.pr-detail').getByText('Required.')).toHaveCount(0);
  await expect(page.locator('oss-item').getByText('Required.')).toHaveCount(0);

  guard.check();
  expect(guard.errors).toEqual([]);
});

test('the add sheet, edit sheet and Import screen show no "Required." until an invalid save', async ({ page }) => {
  const guard = watchPage(page);
  await page.goto('/');
  const sheet = page.locator('oss-sheet dialog');
  const required = page.getByText('Required.', { exact: true });

  await page.getByRole('combobox', { name: 'Search foods' }).fill('yogurt');
  await page.getByRole('combobox', { name: 'Search foods' }).press('Enter');
  await expect(sheet).toBeVisible();
  await expect(required).toHaveCount(0);
  await sheet.getByRole('textbox', { name: 'Food' }).fill('');
  await sheet.getByRole('button', { name: 'Save item' }).click();
  await expect(sheet.getByText('Required.', { exact: true })).toHaveCount(1);
  await sheet.getByRole('textbox', { name: 'Food' }).fill('Yogurt');
  await expect(required).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Save item' }).click();
  await expect(sheet).toBeHidden();

  await page.locator('oss-item', { hasText: 'Yogurt' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(sheet).toBeVisible();
  await expect(required).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await page.locator('oss-shell nav[aria-label="Main"]').getByRole('button', { name: 'Import' }).click();
  await expect(page.locator('oss-import dialog')).toBeVisible();
  await expect(required).toHaveCount(0);

  guard.check();
  expect(guard.errors).toEqual([]);
});

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('at 390 px the Undo toast sits above the bottom bar and clear of every button and link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const guard = watchPage(page);
  await page.goto('/');
  await addFood(page, 'yogurt');
  await page.locator('oss-item', { hasText: 'Yogurt' }).click();
  await page.locator('pr-storage-switch').getByRole('radio', { name: 'Freezer' }).click();
  const toast = page.locator('oss-toast .toast');
  await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible();
  // Wait for the enter animation to finish so the box is the resting one.
  await toast.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

  const box = async (l: ReturnType<Page['locator']>) => {
    const b = await l.boundingBox();
    expect(b).not.toBeNull();
    return b as Box;
  };
  const t = await box(toast);
  const bar = await box(page.locator('oss-shell nav[aria-label="Tabs"]'));
  expect(t.y + t.height).toBeLessThanOrEqual(bar.y);

  const detail = page.locator('.pr-detail');
  await expect(detail.getByRole('button', { name: 'Why this date?' })).toBeVisible();
  const targets = [
    ...(await detail.getByRole('button').all()),
    ...(await detail.getByRole('link').all()),
    ...(await page.locator('oss-shell').getByRole('button', { name: 'Used it' }).all()),
  ];
  let checked = 0;
  for (const target of targets) {
    if (!(await target.isVisible())) continue;
    const b = await box(target);
    const name = (await target.getAttribute('aria-label')) ?? (await target.innerText());
    expect(overlaps(t, b), `toast covers "${name.trim()}"`).toBe(false);
    checked++;
  }
  expect(checked).toBeGreaterThanOrEqual(5);

  guard.check();
  expect(guard.errors).toEqual([]);
});

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
