// Launcher accessibility and motion (a11y-motion spec): axe, Tab-through with rings, reduced motion and the motion
// kept for no-preference. Runs in launcher-desktop (1280) and launcher-phone (390).
import { fileURLToPath } from 'node:url';
import { type Page, expect, test } from '@playwright/test';
import { checkAxe, runningMotion, settle, tabThrough } from '../../../packages/ossuary-core/src/testing/a11y';
import { guardNetwork } from '../../../packages/ossuary-core/src/testing/network-guard';

let external: () => string[] = () => [];
test.beforeEach(({ page }) => {
  external = guardNetwork(page.context());
});
test.afterEach(() => {
  expect(external()).toEqual([]);
});

const shots = fileURLToPath(new URL('../../../.backups/shots/a11y/', import.meta.url));
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 900;
const cards = (page: Page) => page.locator('a.card');

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('a.card oss-decay')).toHaveCount(2);
  await settle(page);
}

/** Each card's rotation in whole degrees and its lift in px, "0/0" when it stands still. */
const transforms = (page: Page) =>
  cards(page).evaluateAll((els) =>
    els.map((e) => {
      const t = getComputedStyle(e).transform;
      const m = t === 'none' ? new DOMMatrix() : new DOMMatrix(t);
      return `${Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI)}/${Math.round(-m.f)}`;
    }),
  );

test('axe finds no WCAG 2.1 A or AA violation', async ({ page }) => {
  await open(page);
  await checkAxe(page);
  await page.screenshot({ path: `${shots}launcher-${page.viewportSize()?.width}.png`, fullPage: true });
});

test('Tab and Shift+Tab reach every link, each with a focus ring', async ({ page }) => {
  await open(page);
  const walk = await tabThrough(page);
  expect(walk.total).toBe(4);
  expect(walk.missed).toEqual([]);
  expect(walk.noRing).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('cards stand straight, hover and focus do not lift them, and no motif moves', async ({ page }) => {
    await open(page);
    const still = ['0/0', '0/0'];
    expect(await transforms(page)).toEqual(still);
    expect(await runningMotion(page)).toEqual([]);
    await cards(page).first().hover();
    expect(await transforms(page)).toEqual(still);
    await cards(page).last().focus();
    expect(await transforms(page)).toEqual(still);
    expect(await runningMotion(page)).toEqual([]);
  });
});

test.describe('no motion preference', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('cards keep their tilt on desktop and a hovered card idles its motif', async ({ page }) => {
    await open(page);
    const t = await transforms(page);
    expect(t).toEqual(isPhone(page) ? ['0/0', '0/0'] : ['-3/0', '2/0']);
    await cards(page).first().hover();
    await expect.poll(async () => (await runningMotion(page)).join('\n')).toMatch(/oss-decay >> .*animation (sway|flicker|float) running/);
  });
});
