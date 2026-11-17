import { expect, test } from '@playwright/test';
import { watchPage } from './guard';

test('the network guard fails on a request that leaves the machine', async ({ page }) => {
  const guard = watchPage(page);
  await page.goto('/');
  expect(() => guard.check()).not.toThrow();
  await page.evaluate(() => fetch('https://example.invalid/leak').catch(() => undefined));
  expect(() => guard.check()).toThrow(/example\.invalid\/leak/);
});
