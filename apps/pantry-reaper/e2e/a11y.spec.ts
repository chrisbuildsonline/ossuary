// Pantry Reaper accessibility and motion (a11y-motion spec): axe and Tab-through on the list, the detail and the
// open add sheet at 1280 and 390, reduced motion, the idle flame without it, silent countdowns and the page canvas.
import { fileURLToPath } from 'node:url';
import { WIDTHS, checkAxe, runningMotion, settle, tabThrough } from '@ossuary/core/testing/a11y';
import { type Page, expect, test } from '@playwright/test';
import { watchPage } from './guard';

const shots = fileURLToPath(new URL('../../../.backups/shots/a11y/', import.meta.url));
const search = (page: Page) => page.getByRole('combobox', { name: 'Search foods' });
const sheet = (page: Page) => page.locator('oss-sheet dialog');

/** Adds yogurt through the search and the sheet, then waits for the toast to go. */
async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await search(page).fill('yogurt');
  await search(page).press('Enter');
  await sheet(page).getByRole('button', { name: 'Save item' }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator('oss-item', { hasText: 'Yogurt' })).toBeVisible();
  await page.evaluate(() => (document.querySelector('oss-toast') as unknown as { hide(): void }).hide());
}

const openDetail = async (page: Page) => {
  await page.locator('oss-item', { hasText: 'Yogurt' }).click();
  await expect(page.locator('.pr-detail h1')).toHaveText('Yogurt');
};
const openAdd = async (page: Page) => {
  await search(page).fill('milk');
  await search(page).press('Enter');
  await expect(sheet(page)).toBeVisible();
};
const back = (page: Page) => page.locator('.pr-detail').getByRole('button', { name: '← All food' }).click();
const deep = (page: Page) =>
  page.evaluate(() => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    let inDialog = false;
    for (let n: Node | null | undefined = a; n; n = n instanceof ShadowRoot ? n.host : n.parentNode) if (n instanceof HTMLDialogElement) inDialog = true;
    return { role: a?.getAttribute('role'), inDialog };
  });

for (const width of WIDTHS) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 900 ? 844 : 800 } });

    test(`axe: list, detail and add sheet at ${width}`, async ({ page }) => {
      const guard = watchPage(page);
      await seed(page);
      await settle(page);
      await checkAxe(page);
      await page.screenshot({ path: `${shots}pantry-list-${width}.png`, fullPage: true });
      await openDetail(page);
      await settle(page);
      await checkAxe(page);
      await page.screenshot({ path: `${shots}pantry-detail-${width}.png`, fullPage: true });
      await back(page);
      await openAdd(page);
      await settle(page);
      await checkAxe(page);
      guard.check();
    });

    test(`Tab-through: list, detail and add sheet at ${width}, with the sheet trapping and returning focus`, async ({ page }) => {
      test.setTimeout(120_000);
      await seed(page);
      for (const screen of ['list', 'detail']) {
        if (screen === 'detail') await openDetail(page);
        const walk = await tabThrough(page);
        expect(walk.missed, screen).toEqual([]);
        expect(walk.noRing, screen).toEqual([]);
      }
      await back(page);
      await openAdd(page);
      const walk = await tabThrough(page);
      expect(walk.total).toBeGreaterThan(3);
      expect(walk.missed, 'sheet').toEqual([]);
      expect(walk.noRing, 'sheet').toEqual([]);
      expect((await deep(page)).inDialog).toBe(true);
      await page.keyboard.press('Escape');
      await expect(sheet(page)).toBeHidden();
      expect((await deep(page)).role).toBe('combobox');
    });
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing moves on the list, the food search, the detail, the storage switch or the add sheet', async ({ page }) => {
    await seed(page);
    expect(await page.evaluate(() => [1, 2, 3, 4].map((n) => getComputedStyle(document.documentElement).getPropertyValue(`--dur-${n}`).trim()))).toEqual(['0ms', '0ms', '0ms', '0ms']);
    expect(await runningMotion(page)).toEqual([]);
    await search(page).fill('rice');
    await expect(page.getByRole('option').first()).toBeVisible();
    expect(await runningMotion(page)).toEqual([]);
    await search(page).fill('');
    await openDetail(page);
    expect(await runningMotion(page)).toEqual([]);
    await page.locator('pr-storage-switch').getByRole('radio', { name: 'Freezer' }).click();
    // The date jump is said by the toast instead of animated.
    await expect(page.locator('oss-toast .toast')).toContainText(/^Moved to freezer: \+\d+ days/);
    expect(await runningMotion(page)).toEqual([]);
    await back(page);
    await openAdd(page);
    expect(await runningMotion(page)).toEqual([]);
  });
});

test.describe('no motion preference', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the detail candle idles its flame', async ({ page }) => {
    await seed(page);
    await openDetail(page);
    await expect.poll(async () => (await runningMotion(page)).join('\n')).toMatch(/oss-decay >> path.*animation (sway|flicker) running/);
  });
});

test('countdowns refresh silently: an hour on the clock changes no live region', async ({ page }) => {
  await page.clock.install();
  await seed(page);
  for (const screen of ['list', 'detail']) {
    if (screen === 'detail') await openDetail(page);
    await page.evaluate(() => {
      const w = window as unknown as { __live: number };
      w.__live = 0;
      const walk = (root: Document | ShadowRoot) =>
        root.querySelectorAll('*').forEach((e) => {
          if (e.matches('[aria-live], [role="status"], [role="alert"]')) new MutationObserver((m) => (w.__live += m.length)).observe(e, { childList: true, subtree: true, characterData: true });
          if (e.shadowRoot) walk(e.shadowRoot);
        });
      walk(document);
    });
    await page.clock.runFor(61 * 60 * 1000);
    expect(await page.evaluate(() => (window as unknown as { __live: number }).__live), screen).toBe(0);
  }
});

test('the page behind the shell is the Pantry Reaper canvas, also past the end of a short list', async ({ page }) => {
  await seed(page);
  const canvas = () =>
    page.evaluate(() => ({ token: getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim(), body: getComputedStyle(document.body).backgroundColor }));
  expect(await canvas()).toEqual({ token: '#f2efea', body: 'rgb(242, 239, 234)' });
  await page.mouse.wheel(0, 4000);
  expect(await canvas()).toEqual({ token: '#f2efea', body: 'rgb(242, 239, 234)' });
});
