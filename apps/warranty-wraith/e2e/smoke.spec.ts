import { expect, test } from '@playwright/test';

const local = (url: string) => /^(data|blob):/.test(url) || ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);

test('loads the themed shell, adds a purchase and shows its two countdowns and recall notice', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.context().on('request', (r) => {
    if (!local(r.url())) external.push(r.url());
  });

  await page.goto('/');

  await expect(page).toHaveTitle('Warranty Wraith');
  await expect(page.locator('oss-shell .wordmark')).toHaveText('Warranty Wraith');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What did you buy?');
  await expect(page.getByRole('heading', { name: 'No ghosts in the drawer yet.' })).toBeVisible();
  await expect(page.locator('oss-empty [data-art="ghost-parcel"]')).toBeVisible();

  // A purchase that matches a real recall in the bundled CPSC snapshot (27054, DREO DR-HSH015 space heaters).
  await page.locator('oss-empty').getByRole('button', { name: 'Add purchase' }).click();
  const sheet = page.locator('oss-sheet dialog');
  await sheet.getByLabel('Item', { exact: true }).fill('DREO space heater');
  await sheet.getByLabel('Bought at').fill('Target');
  await sheet.getByLabel('Model').fill('DR-HSH015');
  await expect(sheet.locator('.preview .others li')).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Save item' }).click();

  const line = page.locator('.ww-home oss-banner[variant="line"]');
  await expect(line.getByRole('button')).toHaveText('1 possible recall · DREO space heater');
  await line.getByRole('button').click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DREO space heater');
  await expect(page.locator('.ww-detail oss-lifespan')).toHaveCount(2);
  const notice = page.getByRole('link', { name: 'Read notice' });
  await expect(notice).toHaveAttribute('href', /^https:\/\/www\.cpsc\.gov\/Recalls\//);
  await expect(notice).toHaveAttribute('target', '_blank');
  await expect(notice).toHaveAttribute('rel', 'noopener noreferrer');

  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
