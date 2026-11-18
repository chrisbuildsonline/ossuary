// Warranty Wraith accessibility and motion (a11y-motion spec): axe and Tab-through on the list, the detail with a
// recall banner and the open add sheet at 1280 and 390, reduced motion, silent countdowns and the trace layout.
import { fileURLToPath } from 'node:url';
import { WIDTHS, checkAxe, runningMotion, settle, tabThrough } from '@ossuary/core/testing/a11y';
import { type Page, expect, test } from '@playwright/test';
import { guard } from './guard';
import { addPurchase, day, recallPurchase } from './purchases';

const shots = fileURLToPath(new URL('../../../.backups/shots/a11y/', import.meta.url));
const sheet = (page: Page) => page.locator('oss-sheet dialog');
const recalled = recallPurchase();

/** A purchase that matches a recall (so detail has a banner), with a lapsed return window and a live warranty. */
async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await addPurchase(page, { name: recalled.name, bought: day(-40), model: 'EC-685 long model number' });
  await page.evaluate(() => (document.querySelector('oss-toast') as unknown as { hide(): void }).hide());
}
const openDetail = async (page: Page) => {
  await page.locator('oss-item', { hasText: recalled.name }).click();
  await expect(page.locator('.ww-detail oss-banner')).toHaveCount(1);
};
const back = (page: Page) => page.locator('.ww-detail').getByRole('button', { name: '← All purchases' }).click();
const openAdd = async (page: Page) => {
  await page.getByRole('button', { name: 'Add purchase' }).filter({ visible: true }).first().click();
  await expect(sheet(page)).toBeVisible();
};
const deep = (page: Page) =>
  page.evaluate(() => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    let inDialog = false;
    for (let n: Node | null | undefined = a; n; n = n instanceof ShadowRoot ? n.host : n.parentNode) if (n instanceof HTMLDialogElement) inDialog = true;
    const host = (a?.getRootNode() as ShadowRoot | Document) instanceof ShadowRoot ? (a?.getRootNode() as ShadowRoot).host : null;
    return { inDialog, host: host?.textContent?.trim() };
  });

for (const width of WIDTHS) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 900 ? 844 : 800 } });

    test(`axe: list, detail with a recall banner and add sheet at ${width}`, async ({ page }) => {
      const g = guard(page);
      await seed(page);
      await settle(page);
      await checkAxe(page);
      await page.screenshot({ path: `${shots}wraith-list-${width}.png`, fullPage: true });
      await openDetail(page);
      await settle(page);
      await checkAxe(page);
      await page.screenshot({ path: `${shots}wraith-detail-${width}.png`, fullPage: true });
      await back(page);
      await openAdd(page);
      await settle(page);
      await checkAxe(page);
      g.check();
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
      expect((await deep(page)).host).toBe('Add purchase');
    });
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing moves on the list, the detail with its banner and trace, or the add sheet', async ({ page }) => {
    await seed(page);
    expect(await runningMotion(page)).toEqual([]);
    await openDetail(page);
    expect(await runningMotion(page)).toEqual([]);
    await page.locator('.ww-detail oss-banner').getByRole('button', { name: 'Not my model' }).click();
    await expect(page.locator('oss-toast .toast')).toContainText('Recall notice hidden');
    expect(await runningMotion(page)).toEqual([]);
    await back(page);
    await openAdd(page);
    expect(await runningMotion(page)).toEqual([]);
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

test('the trace keeps every line whole and inside columns 9-12 from 900 to 1200 px', async ({ page }) => {
  await seed(page);
  await openDetail(page);
  for (const width of [900, 960, 1024, 1100, 1200]) {
    await page.setViewportSize({ width, height: 800 });
    await settle(page);
    const m = await page.evaluate(() => {
      const trace = document.querySelector('.ww-detail oss-trace');
      const root = trace?.shadowRoot;
      const box = trace?.getBoundingClientRect();
      const grid = document.querySelector('.ww-grid')?.getBoundingClientRect();
      const cards = [...document.querySelectorAll('.ww-detail oss-lifespan')].map((c) => c.getBoundingClientRect());
      const problems: string[] = [];
      for (const li of root?.querySelectorAll('li') ?? []) {
        const text = li.querySelector('.text');
        const delta = li.querySelector('.delta');
        if (!text || !delta) continue;
        const t = text.getBoundingClientRect();
        const d = delta.getBoundingClientRect();
        const words = text.textContent ?? '';
        if (text.scrollWidth > text.clientWidth + 1 || delta.scrollWidth > delta.clientWidth + 1) problems.push(`clipped: ${words}`);
        if (t.right > d.left + 1 && t.bottom > d.top + 1 && d.bottom > t.top + 1) problems.push(`overlaps its delta: ${words}`);
        for (const e of [text, delta]) if (parseFloat(getComputedStyle(e).fontSize) < 13) problems.push(`under 13px: ${e.textContent}`);
      }
      return {
        problems,
        lines: root?.querySelectorAll('li').length ?? 0,
        inside: !!box && !!grid && box.right <= grid.right + 1 && cards.every((c) => box.left >= c.right),
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(m.lines, `${width}`).toBeGreaterThan(1);
    expect(m.problems, `${width}`).toEqual([]);
    expect(m.inside, `${width}: trace inside columns 9-12`).toBe(true);
    expect(m.scroll, `${width}: horizontal scroll`).toBeLessThanOrEqual(0);
  }
});
