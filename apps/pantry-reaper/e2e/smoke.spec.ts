import { expect, test } from '@playwright/test';

test('loads the themed shell and the empty pantry', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Pantry Reaper');
  await expect(page.locator('oss-shell .wordmark')).toHaveText('Pantry Reaper');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("What's in your kitchen?");
  await expect(page.getByRole('heading', { name: "Nothing's dying yet." })).toBeVisible();
  expect(errors).toEqual([]);
});
