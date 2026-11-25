// Runs against the built dist (bun run build && bun run preview), so the apps run from their sub-paths with their workers.
import { fileURLToPath } from 'node:url';
import { type Page, expect, test } from '@playwright/test';
import { guardNetwork } from '../../../packages/ossuary-core/src/testing/network-guard';

const apps = [
  { name: 'Pantry Reaper', path: '/pantry-reaper/' },
  { name: 'Warranty Wraith', path: '/warranty-wraith/' },
];
const remix = /^https:\/\/github\.com\/[\w.-]+\/ossuary\/blob\/main\/docs\/REMIX\.md$/;

let errors: string[] = [];
let external: () => string[] = () => [];
test.beforeEach(({ page }) => {
  errors = [];
  // The context sees the workers' requests too.
  external = guardNetwork(page.context());
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => {
  expect(errors).toEqual([]);
  expect(external()).toEqual([]);
});

const shots = fileURLToPath(new URL('../../../.backups/shots/', import.meta.url));
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 900;
const cardFor = (page: Page, name: string) => page.getByRole('link', { name, exact: true });

/** Each card's rotation in whole degrees. */
const tilts = (page: Page) =>
  page.locator('a.card').evaluateAll((cards) =>
    cards.map((c) => {
      const t = getComputedStyle(c).transform;
      const m = t === 'none' ? new DOMMatrix() : new DOMMatrix(t);
      return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
    }),
  );

async function open(page: Page): Promise<void> {
  await page.goto('/');
  // Fonts settle the layout before anything is measured.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator('a.card oss-decay')).toHaveCount(2);
}

test('one headline, one line, two large app cards and one primary pill', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle('Ossuary');
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText('Everything expires. Know when.');
  await expect(page.locator('.lede')).toBeVisible();

  const boxes = [];
  for (const app of apps) {
    const card = cardFor(page, app.name);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', `.${app.path}`);
    const box = await card.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(280);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(160);
    if (box) boxes.push(box);
  }
  const [a, b] = boxes;
  const pill = page.getByRole('link', { name: 'Make your own' });
  await expect(pill).toHaveAttribute('href', remix);
  await expect(pill).toBeInViewport();
  expect(await page.locator('a.pill').count()).toBe(1);

  const head = await h1.boundingBox();
  const p = await pill.boundingBox();
  const viewport = page.viewportSize();
  if (isPhone(page)) {
    // Stacked under the headline, and the pill waits at the bottom of the screen.
    expect(a && head && a.y > head.y + head.height).toBe(true);
    expect(a && b && b.y >= a.y + a.height - 8).toBe(true);
    await expect(cardFor(page, apps[0]?.name ?? '')).toBeInViewport();
    expect(p && viewport && p.y + p.height > viewport.height - 48 && p.y + p.height <= viewport.height).toBe(true);
  } else {
    // Side by side, right of the headline, both on the first screen.
    expect(a && b && b.x > a.x + a.width / 2).toBe(true);
    expect(a && head && a.x > head.x + head.width / 2).toBe(true);
    for (const app of apps) await expect(cardFor(page, app.name)).toBeInViewport();
    expect(p && head && p.y > head.y + head.height).toBe(true);
  }
  // Tilted -3 and +2 degrees on desktop, straight on a phone.
  expect(await tilts(page)).toEqual(isPhone(page) ? [0, 0] : [-3, 2]);
  await page.screenshot({ path: `${shots}launcher-${page.viewportSize()?.width}.png` });
});

test('on a short phone screen the pill never covers a card, at any scroll', async ({ page }) => {
  test.skip(!isPhone(page), 'phone layout only');
  await page.setViewportSize({ width: 390, height: 664 });
  await open(page);
  const pill = page.getByRole('link', { name: 'Make your own' });
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= max + 40; y += 40) {
    await page.evaluate((top) => scrollTo(0, top), Math.min(y, max));
    const p = await pill.boundingBox();
    for (const card of await page.locator('a.card').all()) {
      const c = await card.boundingBox();
      const overlap = p && c && p.y < c.y + c.height && c.y < p.y + p.height;
      expect(overlap, `pill over a card at scroll ${y}`).toBeFalsy();
    }
  }
  await expect(pill).toBeInViewport();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the cards stand straight and no motif moves on hover', async ({ page }) => {
    await open(page);
    expect(await tilts(page)).toEqual([0, 0]);
    await cardFor(page, apps[0]?.name ?? '').hover();
    const running = await page.evaluate(() =>
      [...document.querySelectorAll('oss-decay')].flatMap((d) => d.shadowRoot?.getAnimations() ?? []).filter((a) => a.playState === 'running').length,
    );
    expect(running).toBe(0);
  });
});

test('no sideways scroll, 44px targets and a visible focus ring in reading order', async ({ page }) => {
  await open(page);
  const m = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('a[href], button')]
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(({ e, r }) => `${e.textContent?.trim()} ${r.width}x${r.height}`),
  }));
  expect(m.scroll).toBeLessThanOrEqual(0);
  expect(m.small).toEqual([]);

  const stops = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    stops.push(
      await page.evaluate(() => {
        // The theme toggle's button lives in its shadow root, so follow focus all the way in.
        let a = document.activeElement as HTMLElement;
        while (a.shadowRoot?.activeElement) a = a.shadowRoot.activeElement as HTMLElement;
        const s = getComputedStyle(a);
        return { href: a.getAttribute('href') ?? a.getAttribute('aria-label'), ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 };
      }),
    );
  }
  expect(stops.map((s) => s.href)).toEqual([
    'Light theme',
    expect.stringMatching(/^https:\/\/github\.com\//),
    expect.stringMatching(remix),
    './pantry-reaper/',
    './warranty-wraith/',
  ]);
  expect(stops.every((s) => s.ring)).toBe(true);
});

for (const app of apps) {
  test(`${app.name}: its card opens it, and its worker serves only its folder, offline too`, async ({ page, context, baseURL }) => {
    await open(page);
    await cardFor(page, app.name).click();
    await expect(page).toHaveURL(`${baseURL}${app.path}`);
    await expect(page).toHaveTitle(app.name);
    await expect(page.locator('oss-shell')).toBeVisible();

    expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(`${baseURL}${app.path}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.reload();
    await expect(page).toHaveTitle(app.name);
    await expect(page.locator('oss-shell')).toBeVisible();
    await context.setOffline(false);

    // Back on the launcher: the app's worker is registered for its folder only and controls nothing here.
    await page.goto('/');
    expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope))).toEqual([`${baseURL}${app.path}`]);
    const other = apps.find((a) => a !== app)?.path ?? '';
    expect(await page.evaluate(async (path) => (await navigator.serviceWorker.getRegistration(path)) === undefined, other)).toBe(true);
  });
}
