import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import ICAL from 'ical.js';
import { watchPage } from './guard';

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);

/** Searches, picks the first match with the keyboard and saves the prefilled sheet. */
async function addFood(page: Page, query: string): Promise<void> {
  const search = page.getByRole('combobox', { name: 'Search foods' });
  await search.fill(query);
  await expect(page.getByRole('option').first()).toBeVisible();
  await search.press('ArrowDown');
  await search.press('Enter');
  const sheet = page.locator('oss-sheet dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('FoodKeeper entry')).toHaveCount(0);
  await expect(sheet.getByRole('radio', { name: 'Fridge' })).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('button', { name: 'Save item' }).click();
  await expect(sheet).toBeHidden();
}

const detailDate = (page: Page) => page.locator('.pr-detail .pr-when time').getAttribute('datetime');

/** Switches the open item to the freezer and checks the jump, the toast and the trace. */
async function switchToFreezer(page: Page): Promise<number> {
  const before = await detailDate(page);
  await page.locator('pr-storage-switch').getByRole('radio', { name: 'Freezer' }).click();
  await expect(page.locator('pr-storage-switch').getByRole('radio', { name: 'Freezer' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => detailDate(page)).not.toBe(before);
  const after = await detailDate(page);
  const jump = dayNumber(after ?? '') - dayNumber(before ?? '');
  expect(jump).toBeGreaterThan(0);
  await expect(page.locator('oss-toast .toast')).toContainText(`Moved to freezer: +${jump} days`);
  await expect(page.locator('oss-toast').getByRole('button', { name: 'Undo' })).toBeVisible();
  return jump;
}

test('adds yogurt, moves it to the freezer and exports its date', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const guard = watchPage(page);
  await page.goto('/');

  // Empty state with the candle art.
  await expect(page.getByRole('heading', { name: "Nothing's dying yet." })).toBeVisible();
  await expect(page.locator('oss-empty svg[data-art^="candle"]')).toBeVisible();

  await addFood(page, 'yogurt');
  const item = page.locator('oss-item').first();
  await expect(item).toBeVisible();
  await expect(item).toContainText(/Yogurt/);
  await expect(item.locator('oss-pill')).toBeVisible();
  await expect(item).toContainText(/\d+\s*(day|days|week|weeks)/);

  await item.click();
  await expect(page.locator('.pr-detail h1')).toContainText('Yogurt');
  await switchToFreezer(page);
  const trace = page.locator('oss-trace');
  await expect(trace).toContainText('Storage');
  await expect(trace).toContainText('Freezer');
  await expect(trace).toContainText('USDA FoodKeeper');

  // Calendar file: one event on the shown date.
  const shown = await detailDate(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Add to calendar' }).click()]);
  const ics = readFileSync((await download.path()) ?? '', 'utf8');
  const events = new ICAL.Component(ICAL.parse(ics)).getAllSubcomponents('vevent');
  expect(events).toHaveLength(1);
  expect(new ICAL.Event(events[0]).startDate.toString().slice(0, 10)).toBe(shown?.slice(0, 10));

  // Edit sheet: no raw id, and saving keeps the food.
  await page.getByRole('button', { name: 'Edit' }).click();
  const sheet = page.locator('oss-sheet dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('FoodKeeper entry')).toHaveCount(0);
  for (const input of await sheet.locator('input').all()) expect(await input.inputValue()).not.toMatch(/^\d+$/);
  await sheet.getByRole('button', { name: 'Save item' }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(() => detailDate(page)).toBe(shown);
  await expect(trace).toContainText('USDA FoodKeeper');

  // Theme: the warm accent and the Fraunces display face.
  const shell = page.locator('oss-shell');
  expect(await shell.evaluate((el) => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe('#b8460e');
  expect(await page.locator('.pr-detail h1').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Fraunces/);
  expect(await page.evaluate(() => document.fonts.check('600 32px Fraunces'))).toBe(true);

  guard.check();
  expect(guard.errors).toEqual([]);
});

test('adds and switches storage on a 390 px phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const guard = watchPage(page);
  await page.goto('/');
  await addFood(page, 'yogurt');
  await page.locator('oss-item').first().click();
  await switchToFreezer(page);
  guard.check();
  expect(guard.errors).toEqual([]);
});
