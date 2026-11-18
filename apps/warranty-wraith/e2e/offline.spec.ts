// Runs against the built app on port 4174 (warranty-wraith-offline project), where the core service worker exists.
import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import ICAL from 'ical.js';
import { guard } from './guard';
import { addPurchase, day, recallPurchase } from './purchases';

const shownDays = (page: Page) => page.locator('.ww-detail oss-lifespan time').evaluateAll((els) => els.map((e) => e.getAttribute('datetime')));
const banners = (page: Page) => page.locator('.ww-detail oss-banner');

test('keeps working offline after the first visit: purchases, dates, recall notices, adding, dismissing and the calendar', async ({ page, context }) => {
  const g = guard(page);
  const { name, recall } = recallPurchase();
  await page.goto('/');
  await addPurchase(page, { name, bought: day(-3) });
  await page.locator('oss-item', { hasText: name }).click();
  const days = await shownDays(page);
  expect(days).toHaveLength(2);
  await expect(banners(page)).toHaveCount(1);
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready;
    return navigator.serviceWorker.controller !== null;
  });

  const failedOnline = g.failed.length;
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.ww-detail h1')).toHaveText(name);
  expect(await shownDays(page)).toEqual(days);
  // The recall data is inside a precached script, so matching still works.
  await expect(banners(page).getByRole('status')).toContainText(`CPSC ${recall.id}`);

  // Add, dismiss and export, all offline.
  await page.locator('.ww-detail').getByRole('button', { name: '← All purchases' }).click();
  await addPurchase(page, { name: 'Desk lamp' });
  await expect(page.locator('oss-item', { hasText: 'Desk lamp' })).toBeVisible();
  await page.locator('oss-item', { hasText: name }).click();
  await banners(page).getByRole('button', { name: 'Not my model' }).click();
  await expect(banners(page)).toHaveCount(0);
  await expect(page.locator('oss-toast .toast')).toContainText('Recall notice hidden');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.ww-detail').getByRole('button', { name: 'Add to calendar' }).click()]);
  const events = new ICAL.Component(ICAL.parse(readFileSync((await download.path()) ?? '', 'utf8'))).getAllSubcomponents('vevent');
  expect(events.map((e) => new ICAL.Event(e).startDate.toString().slice(0, 10)).sort()).toEqual([...days].sort());

  expect(g.failed.slice(failedOnline)).toEqual([]);
  g.check();
});
