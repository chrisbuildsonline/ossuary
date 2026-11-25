// The Pantry Reaper step of the demo script (docs/DEMO.md), on the shipped FoodKeeper data: add buttermilk, move it
// from the fridge to the freezer, the date jumps by the USDA difference, and the trace names the rule.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { watchPage } from './guard';

const script = readFileSync(new URL('../../../docs/DEMO.md', import.meta.url), 'utf8');
const foods = JSON.parse(readFileSync(new URL('../src/data/foods.json', import.meta.url), 'utf8')) as { name: string; days: Record<string, number> }[];
const food = foods.find((f) => f.name === 'Buttermilk');
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);

test('demo: buttermilk from the fridge to the freezer, then the trace', async ({ page }) => {
  // The script names this food, and the shipped data gives it a fridge and a freezer entry.
  expect(script).toMatch(/buttermilk/i);
  const fridge = food?.days.fridge ?? 0;
  const freezer = food?.days.freezer ?? 0;
  expect(fridge).toBeGreaterThan(0);
  expect(freezer).toBeGreaterThan(fridge);

  await page.setViewportSize({ width: 1280, height: 800 });
  const guard = watchPage(page);
  await page.goto('/');

  const search = page.getByRole('combobox', { name: 'Search foods' });
  await search.fill('buttermilk');
  await expect(page.getByRole('option').first()).toHaveText(/Buttermilk/);
  await search.press('ArrowDown');
  await search.press('Enter');
  const sheet = page.locator('oss-sheet dialog');
  await expect(sheet.getByRole('radio', { name: 'Fridge' })).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('button', { name: 'Save item' }).click();
  await expect(sheet).toBeHidden();

  // The first-visit samples hold a spoiled buttermilk; the one just added is fresh.
  await page.locator('oss-item', { hasText: 'Buttermilk' }).filter({ hasNotText: 'Spoiled' }).click();
  await expect(page.locator('.pr-detail h1')).toHaveText('Buttermilk');
  const when = page.locator('.pr-detail .pr-when time');
  const before = (await when.getAttribute('datetime')) ?? '';

  await page.locator('pr-storage-switch').getByRole('radio', { name: 'Freezer' }).click();
  await expect.poll(() => when.getAttribute('datetime')).not.toBe(before);
  const after = (await when.getAttribute('datetime')) ?? '';
  expect(dayNumber(after) - dayNumber(before)).toBe(freezer - fridge);
  await expect(page.locator('oss-toast .toast')).toContainText(`Moved to freezer: +${freezer - fridge} days`);

  const trace = page.locator('oss-trace');
  await expect(trace).toContainText('Freezer');
  await expect(trace).toContainText('USDA FoodKeeper');

  guard.check();
  expect(guard.errors).toEqual([]);
});
