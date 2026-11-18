import { expect, test } from '@playwright/test';

test('loads the themed shell and the empty drawer', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Warranty Wraith');
  await expect(page.locator('oss-shell .wordmark')).toHaveText('Warranty Wraith');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What did you buy?');
  await expect(page.getByRole('heading', { name: 'No ghosts in the drawer yet.' })).toBeVisible();
  await expect(page.locator('oss-empty [data-art="ghost-parcel"]')).toBeVisible();
  expect(errors).toEqual([]);
});
