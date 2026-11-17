// Runs against the built app (pantry-reaper-offline project), where the service worker exists.
import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import ICAL from 'ical.js';
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

const detailDate = (page: Page) => page.locator('.pr-detail .pr-when time').getAttribute('datetime');

test('keeps working offline after the first visit', async ({ page, context }) => {
  const guard = watchPage(page);
  await page.goto('/');
  await addFood(page, 'yogurt');
  await page.locator('oss-item', { hasText: 'Yogurt' }).click();
  const date = await detailDate(page);
  expect(date).toBeTruthy();
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready;
    return navigator.serviceWorker.controller !== null;
  });

  const failedOnline = guard.failed.length;
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.pr-detail h1')).toContainText('Yogurt');
  expect(await detailDate(page)).toBe(date);

  // Search, add, switch storage and export, all offline.
  await page.getByRole('button', { name: '← All food' }).click();
  await addFood(page, 'chicken');
  await page.locator('oss-item', { hasText: /chicken/i }).first().click();
  const before = await detailDate(page);
  const switcher = page.locator('pr-storage-switch');
  const freezer = switcher.getByRole('radio', { name: 'Freezer' });
  await freezer.click();
  await expect(freezer).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => detailDate(page)).not.toBe(before);
  await expect(page.locator('oss-toast .toast')).toContainText('Moved to freezer');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Add to calendar' }).click()]);
  const ics = readFileSync((await download.path()) ?? '', 'utf8');
  expect(new ICAL.Component(ICAL.parse(ics)).getAllSubcomponents('vevent')).toHaveLength(1);

  expect(guard.failed.slice(failedOnline)).toEqual([]);
  guard.check();
  expect(guard.errors).toEqual([]);
});
