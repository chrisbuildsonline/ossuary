// The crypt (DESIGN.md sections 2 and 5): the first visit opens on sample purchases in the dark theme, with ghosts faded
// to different strengths, a glow on what closes now, lapsed purchases as ghost cards, axe clean, then light.
import { fileURLToPath } from 'node:url';
import { WIDTHS, checkAxe, runningMotion, settle } from '@ossuary/core/testing/a11y';
import { type Page, expect, test } from '@playwright/test';
import { guard as watchPage } from './guard';

const shots = fileURLToPath(new URL('../../../.backups/shots/crypt/', import.meta.url));
const SAMPLES = 6;
// A real first visit: no "visited" mark from the shared storage state.
test.use({ storageState: { cookies: [], origins: [] } });

const items = (page: Page) => page.locator('oss-item');
const bodyColour = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
/** Fill strengths of the ghosts on screen. */
const ghostFills = (page: Page) => page.locator('path.body').evaluateAll((paths) => paths.filter((p) => p.getBoundingClientRect().height > 0).map((p) => Number(p.getAttribute('fill-opacity'))));

async function firstVisit(page: Page): Promise<void> {
  await page.goto('/');
  await expect(items(page)).toHaveCount(SAMPLES);
  await expect(page.locator('oss-toast .toast span')).toHaveText('Sample items added');
}

for (const width of WIDTHS) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 900 ? 844 : 800 } });

    test(`the first visit opens on a decaying crypt, axe clean, at ${width}`, async ({ page }) => {
      const guard = watchPage(page);
      await firstVisit(page);
      expect(await page.evaluate(() => document.documentElement.dataset.mode)).toBe('crypt');
      expect(await bodyColour(page)).toBe('rgb(11, 14, 22)');
      await settle(page);

      // Ghosts fade with the life left: several strengths, and the recall match is named on the list.
      expect(new Set(await ghostFills(page)).size).toBeGreaterThanOrEqual(3);
      await expect(page.getByText(/1 possible recall/)).toBeVisible();
      // What closes now glows ember.
      const urgent = page.locator('a.tone-urgent').first();
      // A card glows ember; a phone row gets the ember bar on its left edge (DESIGN.md section 5).
      const shadow = await urgent.evaluate((a) => getComputedStyle(a).boxShadow);
      if (width < 900) expect(shadow).toContain('rgb(255, 156, 140) 3px 0px 0px 0px inset');
      else expect(shadow).toContain('rgba(255, 112, 82');
      await checkAxe(page);
      await page.screenshot({ path: `${shots}wraith-crypt-${width}.png`, fullPage: true });

      // A lapsed purchase is a ghost: a grey faded motif, and on desktop a card with no slab and a dashed outline.
      await page.getByRole('button', { name: /Lapsed/ }).click();
      const ghost = page.locator('a.ghost').first();
      await expect(ghost).toBeVisible();
      // On a phone the dead item is a row in its group card: a faded grey motif and a muted name.
      expect(await ghost.locator('oss-decay').evaluate((d) => [getComputedStyle(d).opacity, getComputedStyle(d).filter])).toEqual(['0.55', 'grayscale(1)']);
      if (width >= 900) {
        expect(await ghost.evaluate((a) => [getComputedStyle(a).borderTopStyle, getComputedStyle(a).backgroundColor])).toEqual(['dashed', 'rgba(0, 0, 0, 0)']);
      }
      await settle(page);
      await checkAxe(page);

      // A second visit keeps what is there and adds nothing.
      await page.reload();
      await expect(items(page)).toHaveCount(SAMPLES);
      await expect(page.locator('oss-toast .toast')).toHaveCount(0);
      guard.check();
    });
  });
}

test('Clear takes the samples away and leaves the empty crypt', async ({ page }) => {
  await firstVisit(page);
  await page.locator('oss-toast').getByRole('button', { name: 'Clear' }).click();
  await expect(items(page)).toHaveCount(0);
  await expect(page.locator('oss-empty')).toBeVisible();
  await settle(page);
  await checkAxe(page);
});

test('the toggle switches to light, the choice survives a reload, and light is axe clean too', async ({ page }) => {
  await firstVisit(page);
  await page.locator('oss-toast').evaluate((t) => (t as unknown as { hide(): void }).hide());
  const toggle = page.getByRole('button', { name: 'Light theme' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await bodyColour(page)).toBe('rgb(237, 239, 246)');
  await page.reload();
  await expect(items(page)).toHaveCount(SAMPLES);
  expect(await page.evaluate(() => document.documentElement.dataset.mode)).toBe('light');
  expect(await bodyColour(page)).toBe('rgb(237, 239, 246)');
  await settle(page);
  await checkAxe(page);
});

test.describe('motion', () => {
  test('the first load fades the ghosts in from full, and a later render does not', async ({ page }) => {
    await page.goto('/');
    await expect.poll(async () => (await runningMotion(page)).join('\n')).toMatch(/oss-decay >> path: animation haunt/);
    await settle(page);
    // Into a detail and back: the list renders again, static this time.
    await items(page).first().click();
    await page.locator('.ww-detail').getByRole('button', { name: '← All purchases' }).click();
    await expect(items(page)).toHaveCount(SAMPLES);
    expect((await runningMotion(page)).filter((m) => /animation (burn|rise|haunt|arrive|to-ghost)/.test(m))).toEqual([]);
  });

  test.describe('reduced', () => {
    test.use({ reducedMotion: 'reduce' });
    test('nothing moves on first load: ghosts and glows are drawn in their final state', async ({ page }) => {
      await firstVisit(page);
      expect(await runningMotion(page)).toEqual([]);
      // Each ghost shows its own fade straight away.
      const final = await page.locator('path.body').evaluateAll((paths) => paths.map((p) => [Number(p.getAttribute('fill-opacity')), Number(getComputedStyle(p).fillOpacity)]));
      for (const [attr, shown] of final) expect(shown).toBeCloseTo(attr ?? 0, 2);
    });
  });
});
