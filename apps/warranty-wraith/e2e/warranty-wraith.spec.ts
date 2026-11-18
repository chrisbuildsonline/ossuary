// The dev-server flow (warranty-wraith project): every screen at 1280 and 390 px, the recall notice, the calendar
// file, the look, the held toast on short phones, Import and Backup. Every test fails on an external request or a
// console error.
import { readFileSync } from 'node:fs';
import { type Locator, type Page, expect, test } from '@playwright/test';
import ICAL from 'ical.js';
import { guard } from './guard';
import { addPurchase, day, measure, recallPurchase } from './purchases';

const sizes = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/wraith-${name}.png`, fullPage: true });
const detail = (page: Page) => page.locator('.ww-detail');
const cards = (page: Page) => page.locator('.ww-detail oss-lifespan');
const banners = (page: Page) => page.locator('.ww-detail oss-banner');
const homeLine = (page: Page) => page.locator('.ww-home oss-banner[variant="line"]');
const tab = (page: Page, name: string) => page.locator('oss-shell nav[aria-label="Main"]').getByRole('button', { name });
const backToList = (page: Page) => detail(page).getByRole('button', { name: '← All purchases' }).click();

async function expectLayout(page: Page, screen: string): Promise<void> {
  const m = await measure(page);
  expect(m.scroll, `${screen}: horizontal scroll`).toBeLessThanOrEqual(0);
  expect(m.primaries, `${screen}: primary pills`).toBe(1);
  expect(m.small, `${screen}: targets under 44 px`).toEqual([]);
}

for (const size of sizes) {
  test(`at ${size.width} px: empty state, add with defaults, home, detail and the look`, async ({ page }) => {
    await page.setViewportSize(size);
    const g = guard(page);
    const phone = size.width < 900;
    await page.goto('/');

    // 1. Empty state: title, the ghost asleep in a parcel, one primary pill.
    await expect(page.getByRole('heading', { name: 'No ghosts in the drawer yet.' })).toBeVisible();
    await expect(page.locator('oss-empty [data-art="ghost-parcel"]')).toBeVisible();
    await expectLayout(page, 'empty');
    await shot(page, `empty-${size.width}`);

    // 2. The add sheet: defaults from bone.json, a preview with both countdowns, no hidden field, no "Required.".
    await page.getByRole('button', { name: 'Add purchase' }).filter({ visible: true }).first().click();
    const sheet = page.locator('oss-sheet dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel('Bought on')).toHaveValue(day());
    await expect(sheet.getByRole('spinbutton', { name: 'Return window (days)' })).toHaveValue('30');
    await expect(sheet.getByRole('spinbutton', { name: 'Warranty (months)' })).toHaveValue('12');
    await expect(sheet.getByLabel('Dismissed recalls')).toHaveCount(0);
    await expect(page.getByText('Required.', { exact: true })).toHaveCount(0);
    await sheet.getByLabel('Item', { exact: true }).fill('Kitchen scale');
    await sheet.getByLabel('Bought at').fill('Corner shop');
    await expect(sheet.locator('.preview .expires')).toBeVisible();
    await expect(sheet.locator('.preview .others li')).toHaveCount(1);
    await shot(page, `sheet-${size.width}`);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // 3. Home: a purchase 40 days old has a lapsed return window and a live warranty, so it is not grouped as lapsed.
    await addPurchase(page, { name: 'Espresso machine', bought: day(-40), model: 'EC-685' });
    await addPurchase(page, { name: 'Desk lamp', returnDays: 5 });
    await expect(page.locator('.ww-home h1')).toHaveText('1 return window closes this week');
    const old = page.locator('oss-item', { hasText: 'Espresso machine' });
    await expect(old.locator('.other .label')).toHaveText('Return window');
    await expect(old.locator('.other .stage')).toHaveText('Lapsed');
    const group = page.locator('oss-list section', { has: old });
    expect(await group.getAttribute('data-tone')).not.toBe('dead');
    await expectLayout(page, 'home');
    await shot(page, `home-${size.width}`);

    // 4. Detail: two cards side by side with equal widths, the live warranty first, a ghost in each, the trace.
    await old.click();
    await expect(detail(page).getByRole('heading', { level: 1 })).toHaveText('Espresso machine');
    await expect(cards(page)).toHaveCount(2);
    const boxes = await Promise.all([0, 1].map(async (i) => (await cards(page).nth(i).boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }));
    expect(Math.abs((boxes[0]?.width ?? 0) - (boxes[1]?.width ?? 0))).toBeLessThanOrEqual(2);
    expect(boxes[0]?.y).toBe(boxes[1]?.y);
    expect(boxes[1]?.x ?? 0).toBeGreaterThan(boxes[0]?.x ?? 0);
    await expect(cards(page).nth(0).locator('section')).toHaveAttribute('aria-label', /^Warranty: expires in /);
    await expect(cards(page).nth(1).locator('section')).toHaveAttribute('aria-label', /^Return window: expired /);
    for (const i of [0, 1]) {
      await expect(cards(page).nth(i).locator('oss-decay')).toHaveAttribute('motif', 'ghost');
      await expect(cards(page).nth(i).locator('oss-pill')).toHaveCount(1);
    }
    await expect(detail(page)).toContainText('Model EC-685');
    await expectLayout(page, 'detail');
    await shot(page, `detail-${size.width}`);
    const trace = page.locator('.ww-detail oss-trace');
    if (phone) await trace.getByRole('button', { name: 'Why these dates?' }).click();
    const traceCard = trace.locator('section.card');
    await expect(traceCard).toBeVisible();
    await expect(traceCard.locator('h3')).toHaveText([/^Return window/, /^Warranty/]);
    await expect(traceCard).toContainText('Base: Return window 30 days');
    await expect(traceCard).toContainText('Base: Warranty 12 months');
    if (phone) {
      await traceCard.evaluate((el) => Promise.all((el.getRootNode() as ShadowRoot).getAnimations().map((a) => a.finished)));
      await page.screenshot({ path: `test-results/wraith-trace-${size.width}.png` });
      await page.keyboard.press('Escape');
      await expect(traceCard).toBeHidden();
    }

    // 7. The look: the theme values, Space Grotesk on the countdown number, the cool canvas.
    const shell = page.locator('oss-shell');
    expect(await shell.evaluate((el) => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe('#5a4bd1');
    expect(await shell.evaluate((el) => getComputedStyle(el).getPropertyValue('--canvas').trim())).toBe('#edeff6');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(237, 239, 246)');
    expect(await cards(page).first().locator('.value').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Space Grotesk/);
    expect(await page.evaluate(() => document.fonts.check('600 40px "Space Grotesk Variable"'))).toBe(true);

    g.check();
  });
}

test('a recall match: banner, link, dismissal across a reload, Undo, the home line and the calendar file', async ({ page }) => {
  await page.setViewportSize(sizes[0]);
  const g = guard(page);
  const { name, recall } = recallPurchase();
  await page.goto('/');
  await addPurchase(page, { name, bought: day(-3) });

  // The home line counts the match and opens the purchase.
  await expect(homeLine(page).getByRole('button')).toHaveText(`1 possible recall · ${name}`);
  await homeLine(page).getByRole('button').click();
  await expect(detail(page).getByRole('heading', { level: 1 })).toHaveText(name);

  // 5. One banner, a status region with the heading, the notice text and a real link that the app never fetches.
  await expect(banners(page)).toHaveCount(1);
  const status = banners(page).getByRole('status');
  await expect(status).toContainText('Possible recall match');
  await expect(status).toContainText(`CPSC ${recall.id}: ${recall.names[0]}`);
  const link = banners(page).getByRole('link', { name: 'Read notice' });
  await expect(link).toHaveAttribute('href', recall.url);
  expect(recall.url).toMatch(/^https:\/\/www\.cpsc\.gov\//);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await shot(page, 'recall-1280');

  // "Not my model" hides it, Undo brings it back, and a second dismissal survives a reload.
  await banners(page).getByRole('button', { name: 'Not my model' }).click();
  await expect(banners(page)).toHaveCount(0);
  await expect(page.locator('oss-toast .toast')).toContainText('Recall notice hidden');
  await page.locator('oss-toast').getByRole('button', { name: 'Undo' }).click();
  await expect(banners(page)).toHaveCount(1);
  await banners(page).getByRole('button', { name: 'Not my model' }).click();
  await expect(banners(page)).toHaveCount(0);
  await page.reload();
  await expect(detail(page).getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(banners(page)).toHaveCount(0);
  await backToList(page);
  await expect(homeLine(page)).toBeHidden();
  await expect(page.locator('.ww-home')).not.toContainText('0 possible');

  // 6. The calendar file: two events on the two shown days, with the lifespan names.
  await page.locator('oss-item', { hasText: name }).click();
  const shown = await cards(page).locator('time').evaluateAll((els) => els.map((e) => e.getAttribute('datetime')));
  const [download] = await Promise.all([page.waitForEvent('download'), detail(page).getByRole('button', { name: 'Add to calendar' }).click()]);
  const events = new ICAL.Component(ICAL.parse(readFileSync((await download.path()) ?? '', 'utf8'))).getAllSubcomponents('vevent').map((e) => new ICAL.Event(e));
  expect(events.map((e) => e.summary).sort()).toEqual([`${name} - Return window`, `${name} - Warranty`]);
  expect(events.map((e) => e.startDate.toString().slice(0, 10)).sort()).toEqual([...shown].sort());
  await expect(page.locator('oss-toast .toast')).toContainText('Calendar file saved');

  g.check();
});

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const boxOf = async (l: Locator): Promise<Box> => {
  const b = await l.boundingBox();
  expect(b).not.toBeNull();
  return b as Box;
};

for (const height of [664, 844]) {
  test(`8. at 390 by ${height} the held Undo toast sits above the bottom bar and clear of every button and link`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height });
    const g = guard(page);
    const { name } = recallPurchase();
    await page.goto('/');
    await addPurchase(page, { name, bought: day(-3), model: 'A-100' });
    await page.locator('oss-item', { hasText: name }).click();
    await banners(page).getByRole('button', { name: 'Not my model' }).click();
    const toast = page.locator('oss-toast .toast');
    const undo = toast.getByRole('button', { name: 'Undo' });
    await expect(undo).toBeVisible();
    // Focus on Undo pauses the timer, so the toast stays while the page scrolls to its end.
    await undo.focus();
    await toast.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight);

    const t = await boxOf(toast);
    const bar = await boxOf(page.locator('oss-shell nav[aria-label="Tabs"]'));
    expect(t.y + t.height).toBeLessThanOrEqual(bar.y);
    const targets = [
      ...(await detail(page).getByRole('button').all()),
      ...(await detail(page).getByRole('link').all()),
      ...(await page.locator('oss-shell').getByRole('button', { name: 'Done with it' }).all()),
    ];
    let checked = 0;
    for (const target of targets) {
      if (!(await target.isVisible())) continue;
      const label = (await target.getAttribute('aria-label')) ?? (await target.innerText());
      expect(overlaps(t, await boxOf(target)), `toast covers "${label.trim()}"`).toBe(false);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
    await shot(page, `toast-390x${height}`);
    g.check();
  });
}

test('9. Import and Backup: the tabs, the import link, a backup and a restore that bring the dismissal back', async ({ page }) => {
  await page.setViewportSize(sizes[0]);
  const g = guard(page);
  const { name } = recallPurchase();
  await page.goto('/');
  const importer = page.locator('oss-import dialog');

  await tab(page, 'Import').click();
  await expect(importer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(importer).toBeHidden();
  await page.getByRole('button', { name: 'or import a list' }).click();
  await expect(importer).toBeVisible();
  await page.keyboard.press('Escape');

  await addPurchase(page, { name, bought: day(-3) });
  await page.locator('oss-item', { hasText: name }).click();
  await banners(page).getByRole('button', { name: 'Not my model' }).click();
  await expect(banners(page)).toHaveCount(0);

  await tab(page, 'Backup').click();
  await expect(tab(page, 'Backup')).toHaveAttribute('aria-current', 'page');
  await expectLayout(page, 'backup');
  await shot(page, 'backup-1280');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
  const file = (await download.path()) ?? '';
  const backup = JSON.parse(readFileSync(file, 'utf8')) as { items: { values: Record<string, unknown> }[] };
  expect(backup.items).toHaveLength(1);
  expect(backup.items[0]?.values.recalls_dismissed).toBeTruthy();

  // Done with it, then restore it from the file: the purchase and its hidden notice both come back.
  await tab(page, 'Items').click();
  await page.locator('oss-item', { hasText: name }).click();
  await page.locator('oss-shell').getByRole('button', { name: 'Done with it' }).click();
  await expect(page.locator('oss-item')).toHaveCount(0);
  await tab(page, 'Backup').click();
  await page.locator('.ww-backup input[type="file"]').setInputFiles(file);
  await expect(page.locator('oss-toast .toast')).toContainText('Restored 1 purchase');
  await tab(page, 'Items').click();
  await page.locator('oss-item', { hasText: name }).click();
  await expect(detail(page).getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(banners(page)).toHaveCount(0);
  await expect(homeLine(page)).toBeHidden();

  g.check();
});

test('9. at 390 px with purchases stored, the Backup screen opens Import', async ({ page }) => {
  await page.setViewportSize(sizes[1]);
  const g = guard(page);
  await page.goto('/');
  await addPurchase(page, { name: 'Desk lamp' });
  await page.locator('oss-shell nav[aria-label="Tabs"]').getByRole('button', { name: 'Backup' }).click();
  await expectLayout(page, 'backup');
  await shot(page, 'backup-390');
  await page.locator('.ww-backup').getByRole('button', { name: 'Import a list' }).click();
  await expect(page.locator('oss-import dialog')).toBeVisible();
  g.check();
});

test('the add sheet, the edit sheet and Import show no "Required." until an invalid save', async ({ page }) => {
  await page.setViewportSize(sizes[0]);
  const g = guard(page);
  await page.goto('/');
  const sheet = page.locator('oss-sheet dialog');
  const required = page.getByText('Required.', { exact: true });

  await page.getByRole('button', { name: 'Add purchase' }).filter({ visible: true }).first().click();
  await expect(sheet).toBeVisible();
  await expect(required).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Save item' }).click();
  await expect(sheet.getByText('Required.', { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await addPurchase(page, { name: 'Desk lamp' });
  await page.locator('oss-item', { hasText: 'Desk lamp' }).click();
  await detail(page).getByRole('button', { name: 'Edit' }).click();
  await expect(sheet).toBeVisible();
  await expect(required).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await tab(page, 'Import').click();
  await expect(page.locator('oss-import dialog')).toBeVisible();
  await expect(required).toHaveCount(0);
  g.check();
});
