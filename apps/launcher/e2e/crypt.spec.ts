// The launcher in the crypt (the default) and in light from the toggle, axe clean in both. Runs at 1280 and 390.
import { fileURLToPath } from 'node:url';
import { checkAxe, settle } from '../../../packages/ossuary-core/src/testing/a11y';
import { type Page, expect, test } from '@playwright/test';

const shots = fileURLToPath(new URL('../../../.backups/shots/crypt/', import.meta.url));
const bodyColour = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('opens in the crypt with lit cards, and the toggle brings light back', async ({ page }) => {
  const width = page.viewportSize()?.width ?? 0;
  await page.goto('/');
  await expect(page.locator('a.card oss-decay')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.dataset.mode)).toBe('crypt');
  expect(await bodyColour(page)).toBe('rgb(13, 15, 20)');
  // The candle on the Pantry card has its halo of light.
  expect(await page.locator('circle.halo').count()).toBeGreaterThan(0);
  await settle(page);
  await checkAxe(page);
  await page.screenshot({ path: `${shots}launcher-crypt-${width}.png` });

  const toggle = page.getByRole('button', { name: 'Light theme' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await bodyColour(page)).toBe('rgb(238, 240, 244)');
  await page.reload();
  expect(await bodyColour(page)).toBe('rgb(238, 240, 244)');
  await settle(page);
  await checkAxe(page);
});
