import { expect, test } from '@playwright/test';
import { guard } from './guard';

test('the guard fails on a request that leaves the machine', async ({ page }) => {
  const g = guard(page);
  await page.goto('/');
  await expect(page.locator('oss-shell')).toBeVisible();
  expect(() => g.check()).not.toThrow();
  await page.evaluate(() => fetch('https://example.invalid/leak', { mode: 'no-cors' }).catch(() => undefined));
  await expect.poll(() => g.external).toContain('https://example.invalid/leak');
  expect(() => g.check()).toThrow(/example\.invalid\/leak/);
});

test('the guard fails on a console error', async ({ page }) => {
  const g = guard(page);
  await page.goto('/');
  await expect(page.locator('oss-shell')).toBeVisible();
  await page.evaluate(() => console.error('deliberate'));
  await expect.poll(() => g.errors).toContain('deliberate');
  expect(() => g.check()).toThrow(/deliberate/);
});
