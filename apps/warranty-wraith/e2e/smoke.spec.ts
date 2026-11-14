import { expect, test } from '@playwright/test';

test('loads with its name and the core import', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Warranty Wraith');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Warranty Wraith');
  await expect(page.getByTestId('core')).toHaveText('ossuary-core');
  expect(errors).toEqual([]);
});
