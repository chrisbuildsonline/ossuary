// Gallery accessibility and motion (a11y-motion spec): reduced motion on every opened surface, motion kept for
// no-preference, and no empty-state flash while the store opens. Axe and Tab-through for all three themes live in
// gallery.spec.ts. Runs in gallery-desktop (1280) and gallery-phone (390).
import { type Page, expect, test } from '@playwright/test';
import { runningMotion, settle } from '../src/testing/a11y';
import { guardNetwork } from '../src/testing/network-guard';

let blocked: () => string[];
test.beforeEach(({ page }) => {
  blocked = guardNetwork(page);
});
test.afterEach(() => {
  expect(blocked()).toEqual([]);
});

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => !!document.querySelector('oss-list[data-list="items"]')?.shadowRoot?.querySelector('oss-item'));
}

const durations = (page: Page) =>
  page.evaluate(() => [1, 2, 3, 4].map((n) => getComputedStyle(document.documentElement).getPropertyValue(`--dur-${n}`).trim()));
const dialogOpen = (page: Page, tag: string) => page.evaluate((t) => !!document.querySelector(t)?.shadowRoot?.querySelector('dialog[open]'), tag);

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing moves on the page, in the sheet, the import dialog, the trace drawer or the toast', async ({ page }) => {
    await open(page, 'theme=warm');
    expect(await durations(page)).toEqual(['0ms', '0ms', '0ms', '0ms']);
    expect(await runningMotion(page)).toEqual([]);

    await page.locator('oss-button[data-action="add"]').click();
    expect(await dialogOpen(page, 'oss-sheet')).toBe(true);
    expect(await runningMotion(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await page.evaluate(() => (document.querySelector('oss-import') as unknown as { show(): void }).show());
    expect(await runningMotion(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await page.locator('#primitives oss-trace[mode="drawer"] button.open').click();
    expect(await runningMotion(page)).toEqual([]);
    await page.keyboard.press('Escape');

    // The change a date jump would animate is still said in words.
    await page.evaluate(() => (document.querySelector('oss-toast') as unknown as { show(m: string): void }).show('Moved to another shelf: +58 days'));
    await expect(page.locator('oss-toast [role="status"]')).toHaveText('Moved to another shelf: +58 days');
    // A motif asked to idle stays still.
    await page.evaluate(() => document.querySelector('#primitives oss-decay[motif="candle"]')?.setAttribute('idle', ''));
    expect(await runningMotion(page)).toEqual([]);
  });
});

test.describe('no motion preference', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('keeps the motion: durations, the sheet entrance and an idling flame', async ({ page }) => {
    await open(page, 'theme=warm');
    expect(await durations(page)).toEqual(['120ms', '200ms', '320ms', '600ms']);
    await page.locator('oss-button[data-action="add"]').click();
    expect((await runningMotion(page)).join('\n')).toMatch(/oss-sheet >> dialog.*animation (side-in|up-in)/);
    await page.keyboard.press('Escape');
    await settle(page);
    await page.evaluate(() => document.querySelector('#primitives oss-decay[motif="candle"]')?.setAttribute('idle', ''));
    expect((await runningMotion(page)).join('\n')).toMatch(/oss-decay >> path.*animation (sway|flicker) running/);
  });
});

test('the item list never shows the empty state before the store answers', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __emptySeen: string[] }).__emptySeen = seen;
    const watch = () => {
      const list = document.querySelector('oss-list[data-list="items"]');
      if (!list?.shadowRoot) return requestAnimationFrame(watch);
      seen.push(`start:${list.getAttribute('state')}`);
      const check = () => list.shadowRoot?.querySelector('oss-empty') && seen.push('empty');
      check();
      new MutationObserver(check).observe(list.shadowRoot, { childList: true, subtree: true });
    };
    watch();
  });
  await open(page, 'theme=core');
  expect(await page.evaluate(() => (window as unknown as { __emptySeen: string[] }).__emptySeen)).toEqual(['start:loading']);
});
