// Walks the sample app at desktop and phone width and saves a screenshot of each screen to .backups/shots/.
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const shots = fileURLToPath(new URL('../../../.backups/shots/', import.meta.url));

for (const { width, height } of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`sample app at ${width}px`, async ({ page }) => {
    const shot = (name: string) => page.screenshot({ path: `${shots}${width}-${name}.png` });
    page.on('pageerror', (e) => console.log(`page error: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && console.log(`console: ${m.text()}`));
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Test Two');
    await shot('1-empty');

    await page.locator('oss-empty').getByRole('button', { name: 'Add your first item' }).click();
    const sheet = page.locator('oss-sheet dialog');
    await sheet.getByLabel('Name', { exact: true }).fill('Desk lamp');
    await sheet.getByLabel('Place').fill('Hall cupboard');
    // Let the sheet finish sliding in.
    await page.waitForTimeout(600);
    await shot('2-add');
    await sheet.getByRole('button', { name: 'Save item' }).click();
    await expect(sheet).toBeHidden();
    // Off every control, so no hover state shows in the shots.
    await page.mouse.move(0, 0);

    await expect(page.locator('oss-list').getByText('Desk lamp').first()).toBeVisible();
    await page.waitForTimeout(500);
    await shot('3-list');

    await page.locator('oss-list').getByText('Desk lamp').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Desk lamp');
    await expect(page.locator('.bone-detail oss-lifespan')).toHaveCount(2);
    await page.waitForTimeout(500);
    await shot('4-detail');
  });
}
