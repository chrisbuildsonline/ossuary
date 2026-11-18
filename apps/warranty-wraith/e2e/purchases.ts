// Shared steps for the end-to-end tests: a purchase that matches a real recall, the add sheet, and page measurements.
import { readFileSync } from 'node:fs';
import { type Page, expect } from '@playwright/test';
import type { Recall } from '../src/data/cpsc';
import { matchRecalls } from '../src/data/match';

const recalls = JSON.parse(readFileSync(new URL('../src/data/recalls.json', import.meta.url), 'utf8')) as Recall[];

/**
 * A purchase built from one recall in the committed data (a brand and its shortest product name) that matches that
 * recall and no other, so the test follows the data when the snapshot changes.
 */
export function recallPurchase(): { name: string; recall: Recall } {
  const found = recalls
    .flatMap((recall) => {
      const product = [...recall.names].sort((a, b) => a.length - b.length)[0];
      // A product name that already starts with the brand is used as it is, so the name never repeats the brand.
      return recall.brands.map((brand) => ({ name: product?.toLowerCase().startsWith(brand.toLowerCase()) ? product : `${brand} ${product}`, recall }));
    })
    .filter(({ name }) => name.length <= 48)
    .sort((a, b) => a.name.length - b.name.length)
    .find(({ name, recall }) => {
      const hits = matchRecalls({ name }, recalls);
      return hits.length === 1 && hits[0]?.recall.id === recall.id;
    });
  if (!found) throw new Error('no recall in recalls.json gives a single match from its brand and product name');
  return found;
}

/** The local day `offset` days from today, as the date input wants it. */
export function day(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface NewPurchase {
  name: string;
  retailer?: string;
  bought?: string;
  model?: string;
  returnDays?: number;
}

/** Opens the add sheet from whichever "Add purchase" button is on screen, fills it and saves. */
export async function addPurchase(page: Page, p: NewPurchase): Promise<void> {
  await page.getByRole('button', { name: 'Add purchase' }).filter({ visible: true }).first().click();
  const sheet = page.locator('oss-sheet dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('Item', { exact: true }).fill(p.name);
  await sheet.getByLabel('Bought at').fill(p.retailer ?? 'Corner shop');
  if (p.bought) await sheet.getByLabel('Bought on').fill(p.bought);
  if (p.model) await sheet.getByLabel('Model').fill(p.model);
  if (p.returnDays !== undefined) await sheet.getByRole('spinbutton', { name: 'Return window (days)' }).fill(String(p.returnDays));
  await sheet.getByRole('button', { name: 'Save item' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('oss-toast .toast')).toContainText(`Added ${p.name}`);
}

/** Horizontal overflow, visible primary pills and targets under 44 px, looking through every shadow root. */
export function measure(page: Page) {
  return page.evaluate(() => {
    const all: Element[] = [];
    const walk = (root: Document | ShadowRoot) =>
      root.querySelectorAll('*').forEach((e) => {
        all.push(e);
        if (e.shadowRoot) walk(e.shadowRoot);
      });
    walk(document);
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && e.checkVisibility({ visibilityProperty: true }) && !e.closest('dialog:not([open])');
    };
    const small = all
      .filter((e) => e.matches('button, a[href], input, select, [role="radio"]') && visible(e) && !e.closest('.sr-only'))
      .filter((e) => !(e instanceof HTMLInputElement && e.type === 'file'))
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ e, r }) => `${e.tagName.toLowerCase()} "${e.textContent?.trim()}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    return {
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      primaries: all.filter((e) => e.matches('oss-button[variant="primary"]') && visible(e)).length,
      small,
    };
  });
}
