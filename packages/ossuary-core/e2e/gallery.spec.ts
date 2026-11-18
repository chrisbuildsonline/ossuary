import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import ICAL from 'ical.js';
import { guardNetwork } from '../src/testing/network-guard';

const themes = ['core', 'warm', 'cool'] as const;
const tags = ['wcag2a', 'wcag2aa', 'wcag21aa'];

let blocked: () => string[];
test.beforeEach(({ page }) => {
  blocked = guardNetwork(page);
});
test.afterEach(() => {
  expect(blocked()).toEqual([]);
});

async function open(page: Page, query: string) {
  await page.goto(`/?${query}`);
  await page.locator('oss-shell').waitFor();
  await page.waitForFunction(() => {
    const list = document.querySelector('oss-list[data-list="items"]');
    return !!list?.shadowRoot?.querySelector('oss-item, oss-empty, [aria-busy]');
  });
}

async function axe(page: Page) {
  // Let sheet, drawer and line entrances finish so contrast is measured at rest.
  await page.waitForTimeout(450);
  const r = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** Description of the focused element, looking through shadow roots. */
const focused = (page: Page) =>
  page.evaluate(() => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    const host = (a?.getRootNode() as ShadowRoot | Document) instanceof ShadowRoot ? (a?.getRootNode() as ShadowRoot).host : null;
    return { tag: a?.tagName.toLowerCase(), host: host?.tagName.toLowerCase(), text: a?.textContent?.trim(), inDialog: !!a?.closest('dialog') || !!host?.closest('dialog') || deepInDialog(a) };
    function deepInDialog(el: Element | null | undefined): boolean {
      for (let n: Node | null | undefined = el; n; n = n instanceof ShadowRoot ? n.host : n.parentNode) if (n instanceof HTMLDialogElement) return true;
      return false;
    }
  });

const deepSheetOpen = (page: Page, tag: string) =>
  page.evaluate((t) => !!document.querySelector(t)?.shadowRoot?.querySelector('dialog[open]'), tag);

for (const theme of themes) {
  test(`${theme}: axe passes on every state`, async ({ page }, info) => {
    for (const state of ['ready', 'empty', 'error', 'loading']) {
      await open(page, `theme=${theme}&state=${state}`);
      await axe(page);
    }
    await open(page, `theme=${theme}`);
    await page.screenshot({ path: `test-results/gallery-${theme}-${info.project.name}.png`, fullPage: true });
    await page.locator('oss-button[data-action="add"]').click();
    expect(await deepSheetOpen(page, 'oss-sheet')).toBe(true);
    await axe(page);
    await page.keyboard.press('Escape');
    await page.evaluate(() => (document.querySelector('oss-import') as unknown as { show(): void }).show());
    await page.locator('oss-import textarea').fill('name,kept in,made\nBlue widget,cold,2026-11-12\nNo date,cold,\n');
    await axe(page);
    await page.keyboard.press('Escape');
    await page.locator('#primitives oss-trace[mode="drawer"] button.open').click();
    expect(await page.evaluate(() => !!document.querySelector('#primitives oss-trace[mode="drawer"]')?.shadowRoot?.querySelector('dialog[open]'))).toBe(true);
    await axe(page);
  });
}

test('layout: no horizontal scroll, one primary pill, 44px targets', async ({ page }) => {
  for (const theme of themes) {
    await open(page, `theme=${theme}`);
    // The real resting state: items loaded (the empty state while the store opens brings its own pill),
    // no dialog open and no animation running in any shadow root.
    await page.waitForFunction(() => {
      const roots: (Document | ShadowRoot)[] = [document];
      for (let i = 0; i < roots.length; i++) roots[i]?.querySelectorAll('*').forEach((e) => e.shadowRoot && roots.push(e.shadowRoot));
      const list = document.querySelector('oss-list[data-list="items"]')?.shadowRoot;
      return !!list?.querySelector('oss-item') && roots.every((r) => !r.querySelector('dialog[open]') && r.getAnimations().every((a) => a.playState !== 'running'));
    });
    const m = await page.evaluate(() => {
      const all: Element[] = [];
      const walk = (root: Document | ShadowRoot) =>
        root.querySelectorAll('*').forEach((e) => {
          all.push(e);
          if (e.shadowRoot) walk(e.shadowRoot);
        });
      walk(document);
      const visible = (e: Element) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
      };
      const small = all
        .filter((e) => e.matches('button, a[href], input, select, [role="radio"]') && visible(e) && !e.closest('.sr-only'))
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ e, r }) => (r.height < 44 || r.width < 44) && !(e instanceof HTMLInputElement && e.type === 'file'))
        .map(({ e, r }) => `${e.tagName} ${e.textContent?.trim()} ${r.width}x${r.height}`);
      const primaries = all.filter((e) => e.matches('oss-button[variant="primary"]') && visible(e));
      return { scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, primaries: primaries.length, small };
    });
    expect(m.scroll).toBeLessThanOrEqual(0);
    expect(m.primaries).toBe(1);
    expect(m.small).toEqual([]);
  }
});

test('layout: card grid on desktop, row groups on phone', async ({ page }, info) => {
  await open(page, 'theme=core');
  const variant = await page.evaluate(() => document.querySelector('oss-list[data-list="items"]')?.shadowRoot?.querySelector('oss-item')?.getAttribute('variant'));
  expect(variant).toBe(info.project.name === 'gallery-phone' ? 'row' : 'card');
});

test('layout: the list fills the desktop width, phone stays one column', async ({ page }, info) => {
  for (const theme of themes) {
    await open(page, `theme=${theme}`);
    const m = await page.evaluate(() => {
      const items = Array.from(document.querySelector('oss-list[data-list="items"]')?.shadowRoot?.querySelectorAll('oss-item') ?? []);
      const boxes = items.map((i) => i.getBoundingClientRect()).filter((r) => r.width > 0);
      return {
        columns: new Set(boxes.map((r) => Math.round(r.left))).size,
        span: Math.max(...boxes.map((r) => r.right)) - Math.min(...boxes.map((r) => r.left)),
        width: document.documentElement.clientWidth,
      };
    });
    if (info.project.name === 'gallery-phone') expect(m.columns, theme).toBe(1);
    else {
      expect(m.columns, theme).toBeGreaterThanOrEqual(3);
      expect(m.span / m.width, theme).toBeGreaterThan(0.6);
    }
  }
});

test('lifespan cards and banners: every state in every theme, two cards side by side on phone', async ({ page }, info) => {
  const motifs = { core: 'hourglass', warm: 'candle', cool: 'ghost' };
  for (const theme of themes) {
    await open(page, `theme=${theme}`);
    const cards = page.locator('#lifespans oss-lifespan');
    await expect(cards).toHaveCount(4);
    const m = await cards.evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        const root = e.shadowRoot;
        return {
          left: Math.round(r.left),
          top: Math.round(r.top),
          width: r.width,
          tone: root?.querySelector('oss-pill')?.getAttribute('tone'),
          pills: root?.querySelectorAll('oss-pill').length,
          motif: root?.querySelector('oss-decay')?.getAttribute('motif'),
          size: root?.querySelector('oss-decay')?.getAttribute('size'),
          name: root?.querySelector('section')?.getAttribute('aria-label'),
          time: root?.querySelector('time')?.getAttribute('datetime'),
        };
      }),
    );
    expect(m.map((c) => c.tone).sort(), theme).toEqual(['dead', 'soon', 'steady', 'urgent']);
    for (const c of m) {
      expect(c.pills).toBe(1);
      expect(c.motif).toBe(motifs[theme]);
      expect(c.name).toMatch(/^(Trial|Cover): (expires in|expired) .+\.$/);
      expect(c.time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const [a, b] = m;
    expect(a?.top).toBe(b?.top);
    expect(b?.left ?? 0).toBeGreaterThan(a?.left ?? 0);
    if (info.project.name === 'gallery-phone') {
      expect(m.every((c) => c.size === 's' && c.width > 150 && c.width < 200)).toBe(true);
    } else expect(m.every((c) => c.size === 'm')).toBe(true);

    const banners = page.locator('#lifespans oss-banner');
    await expect(banners).toHaveCount(3);
    await expect(page.locator('#lifespans oss-banner:not([variant]) [role="status"]').first()).toContainText('Possible match');
    const line = await page.locator('#lifespans oss-banner[variant="line"] button.line').boundingBox();
    expect(line?.height).toBeGreaterThanOrEqual(44);
    const link = await page.locator('#lifespans oss-banner a[slot="actions"]').boundingBox();
    expect(link?.height).toBeGreaterThanOrEqual(44);
  }
});

/** Each element matched in `root` (looking through shadow roots), with its height in lines and whether its text is cut. */
const lineBoxes = (page: Page, root: string, selector: string) =>
  page.evaluate(
    ([r, sel]) => {
      const found: Element[] = [];
      const walk = (n: Document | ShadowRoot | Element) =>
        n.querySelectorAll('*').forEach((e) => {
          if (e.matches(sel)) found.push(e);
          if (e.shadowRoot) walk(e.shadowRoot);
        });
      const start = document.querySelector(r);
      if (start?.shadowRoot) walk(start.shadowRoot);
      return found
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => {
          const lineHeight = parseFloat(getComputedStyle(e).lineHeight);
          const cut = [e, ...Array.from(e.querySelectorAll('*'))].some((x) => x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflow !== 'visible');
          return { text: e.textContent?.trim() ?? '', lines: Math.round(e.getBoundingClientRect().height / lineHeight), cut };
        });
    },
    [root, selector] as const,
  );

test('layout: a two-lifespan row and its trace keep every line on one line', async ({ page }, info) => {
  const phone = info.project.name === 'gallery-phone';
  for (const theme of themes) {
    await open(page, `theme=${theme}`);
    // The row or card line for the other lifespan: "Rental window 670 days ago · Closed", in full.
    const others = await lineBoxes(page, '#detail oss-list', '.other');
    expect(others.map((o) => o.text), theme).toEqual([expect.stringMatching(/^Rental window\s*670 days ago\s*Closed$/)]);
    for (const o of others) expect(o, `${theme} ${phone ? 'row' : 'card'}`).toMatchObject({ lines: 1, cut: false });

    // The trace: a persistent card in columns 9-12 on desktop, a drawer on phone.
    if (phone) await page.locator('#detail oss-trace button.open').click();
    const lines = await lineBoxes(page, '#detail oss-trace', 'li .text, li .delta, .total > span');
    expect(lines.map((l) => l.text), theme).toEqual(expect.arrayContaining(['Base: Rental window 30 days', 'Base: Cover period 2 years', 'Expires Mon 13 Jan 2025', '= 30 days']));
    for (const l of lines) expect(l, theme).toMatchObject({ lines: 1, cut: false });
    if (phone) await page.keyboard.press('Escape');
  }
});

test('keyboard: the line banner opens with Enter, the banner link and button are reachable', async ({ page }) => {
  await open(page, 'theme=cool');
  await page.locator('#lifespans oss-banner a[slot="actions"]').focus();
  expect((await focused(page)).text).toBe('Read more');
  await page.keyboard.press('Tab');
  expect((await focused(page)).host).toBe('oss-button');
  await page.locator('#lifespans oss-banner[variant="line"] button.line').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('oss-toast [role="status"]')).toContainText('Match opened');
});

test('keyboard: sheet traps and returns focus, arrows change the segmented control', async ({ page }) => {
  await open(page, 'theme=core');
  await page.locator('oss-button[data-action="add"]').focus();
  await page.keyboard.press('Enter');
  expect(await deepSheetOpen(page, 'oss-sheet')).toBe(true);
  expect((await focused(page)).inDialog).toBe(true);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect((await focused(page)).inDialog).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect((await focused(page)).inDialog).toBe(true);
  const preview = () => page.evaluate(() => document.querySelector('oss-sheet')?.shadowRoot?.querySelector('.expires')?.textContent);
  await page.evaluate(() => {
    const field = document.querySelector('oss-sheet')?.shadowRoot?.querySelector('oss-field[data-key="name"]') as HTMLElement;
    field.focus();
  });
  await page.keyboard.type('Key widget');
  await page.evaluate(() => (document.querySelector('oss-sheet')?.shadowRoot?.querySelector('oss-field[data-key="place"]') as HTMLElement).focus());
  const before = await preview();
  await page.keyboard.press('ArrowRight');
  expect((await focused(page)).text).toBe('Deep cold');
  expect(await preview()).not.toBe(before);
  await page.keyboard.press('Escape');
  expect(await deepSheetOpen(page, 'oss-sheet')).toBe(false);
  expect((await focused(page)).host).toBe('oss-button');
  expect((await focused(page)).text).toBe('');
});

test('keyboard: Tab from the top reaches every visible action, each with a focus ring', async ({ page }) => {
  for (const theme of themes) {
    await open(page, `theme=${theme}`);
    // Every visible, enabled, tabbable control on the page, looking inside shadow roots.
    const total = await page.evaluate(() => {
      const found: { el: Element; shadow: string }[] = [];
      const walk = (root: Document | ShadowRoot) =>
        root.querySelectorAll('*').forEach((e) => {
          if (e.shadowRoot) walk(e.shadowRoot);
          if (!e.matches('a[href], button, input, select, textarea, [tabindex]') || e.getAttribute('tabindex') === '-1') return;
          if ((e as HTMLButtonElement).disabled || e.closest('dialog:not([open])') || !e.checkVisibility({ visibilityProperty: true })) return;
          found.push({ el: e, shadow: getComputedStyle(e).boxShadow });
        });
      walk(document);
      (window as unknown as { __tab: typeof found }).__tab = found;
      return found.length;
    });
    expect(total).toBeGreaterThan(10);
    const reached = new Set<number>();
    const noRing: string[] = [];
    for (let i = 0; i < total * 2 + 10 && reached.size < total; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        let a = document.activeElement;
        while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
        const list = (window as unknown as { __tab: { el: Element; shadow: string }[] }).__tab;
        const index = list.findIndex((t) => t.el === a);
        if (!a || index < 0) return { index, ring: true, name: a?.tagName ?? '' };
        const s = getComputedStyle(a);
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow !== 'none' && s.boxShadow !== list[index]?.shadow;
        const host = (a.getRootNode() as ShadowRoot).host?.tagName.toLowerCase() ?? '';
        return { index, ring: outline || shadow, name: `${host} ${a.tagName.toLowerCase()}[type=${a.getAttribute('type')}] ${a.textContent?.trim().slice(0, 30)}` };
      });
      if (r.index >= 0) reached.add(r.index);
      if (!r.ring) noRing.push(`${theme}: ${r.name}`);
    }
    const missed = await page.evaluate(
      (seen) =>
        (window as unknown as { __tab: { el: Element }[] }).__tab
          .filter((_, i) => !seen.includes(i))
          .map(({ el }) => `${(el.getRootNode() as ShadowRoot).host?.tagName.toLowerCase() ?? ''} ${el.tagName.toLowerCase()} ${el.textContent?.trim().slice(0, 30)}`),
      [...reached],
    );
    expect(missed, `${theme}: not reached by Tab`).toEqual([]);
    expect(noRing).toEqual([]);
  }
});

test('keyboard: drawer and import dialog close on Escape and return focus', async ({ page }) => {
  await open(page, 'theme=core');
  const link = page.locator('#primitives oss-trace[mode="drawer"] button.open');
  await link.focus();
  await page.keyboard.press('Enter');
  expect((await focused(page)).inDialog).toBe(true);
  await page.keyboard.press('Escape');
  expect((await focused(page)).text).toMatch(/Why this date/);
  await page.locator('oss-button[data-action="calendar"]').focus();
  await page.evaluate(() => (document.querySelector('oss-import') as unknown as { show(): void }).show());
  expect((await focused(page)).inDialog).toBe(true);
  await page.keyboard.press('Escape');
  expect(await deepSheetOpen(page, 'oss-import')).toBe(false);
});

test.describe('short phone', () => {
  test.use({ viewport: { width: 390, height: 664 } });
  test('the held Undo toast sits above the bottom bar and clear of every visible control at the scroll end', async ({ page }) => {
    await open(page, 'theme=core');
    await page.evaluate(() => (document.querySelector('oss-toast') as unknown as { show(m: string, o: object): void }).show('Moved to another shelf: +58 days', { undoLabel: 'Undo' }));
    const toast = page.locator('oss-toast .toast');
    // Focus on Undo pauses the timer, so the toast stays while the boxes are read.
    await toast.getByRole('button', { name: 'Undo' }).focus();
    await toast.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight);
    await expect(page.locator('oss-button[data-action="top"]')).toBeInViewport();
    const m = await page.evaluate(() => {
      const toastBox = document.querySelector('oss-toast')?.shadowRoot?.querySelector('.toast')?.getBoundingClientRect();
      const bar = document.querySelector('oss-shell')?.shadowRoot?.querySelector('nav.bottom')?.getBoundingClientRect();
      const hits: string[] = [];
      let checked = 0;
      const walk = (root: Document | ShadowRoot) =>
        root.querySelectorAll('*').forEach((e) => {
          if (e.shadowRoot) walk(e.shadowRoot);
          if (!e.matches('button, a[href], input, select, textarea, [role="radio"]')) return;
          const host = (e.getRootNode() as ShadowRoot).host;
          if (host?.matches('oss-toast') || e.closest('dialog:not([open])')) return;
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= innerHeight || !toastBox) return;
          checked++;
          const covered = r.left < toastBox.right && toastBox.left < r.right && r.top < toastBox.bottom && toastBox.top < r.bottom;
          if (covered) hits.push(`${host?.tagName.toLowerCase() ?? ''} ${e.tagName.toLowerCase()} ${(e.textContent?.trim() || host?.textContent?.trim() || '').slice(0, 30)}`);
        });
      walk(document);
      return { toastBottom: toastBox?.bottom ?? Infinity, barTop: bar?.top ?? 0, hits, checked };
    });
    expect(m.toastBottom).toBeLessThanOrEqual(m.barTop);
    expect(m.checked).toBeGreaterThanOrEqual(3);
    expect(m.hits).toEqual([]);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no running animations, the sheet opens without sliding', async ({ page }) => {
    await open(page, 'theme=warm');
    await page.locator('oss-button[data-action="add"]').click();
    const running = await page.evaluate(() => {
      const els: Element[] = [];
      const walk = (root: Document | ShadowRoot) =>
        root.querySelectorAll('*').forEach((e) => {
          els.push(e);
          if (e.shadowRoot) walk(e.shadowRoot);
        });
      walk(document);
      return els.flatMap((e) => e.getAnimations()).filter((a) => a.playState === 'running').length;
    });
    expect(running).toBe(0);
  });
});

test('flow: add, invalid save, import with a skipped row, backup restore and calendar', async ({ page }) => {
  await open(page, 'theme=core');
  const names = () =>
    page.evaluate(() =>
      Array.from(document.querySelector('oss-list[data-list="items"]')?.shadowRoot?.querySelectorAll('oss-item') ?? []).map((i) => (i as unknown as { values: { name: string } }).values.name),
    );
  const sheet = page.locator('oss-sheet');
  await page.locator('oss-button[data-action="add"]').click();
  await sheet.locator('oss-button[variant="primary"]').click();
  expect(await deepSheetOpen(page, 'oss-sheet')).toBe(true);
  await expect(sheet.locator('oss-field[data-key="name"] .help.error')).toHaveText('Required.');
  await sheet.locator('oss-field[data-key="name"] input').fill('New widget');
  await sheet.locator('oss-field[data-key="place"] [role="radio"]', { hasText: 'Cold' }).first().click();
  await expect(sheet.locator('.expires')).toHaveText('Expires in 14 days · Sat 28 Nov');
  await sheet.locator('oss-button[variant="primary"]').click();
  await expect.poll(names).toContain('New widget');
  await expect(page.locator('oss-toast [role="status"]')).toContainText('Saved');

  await page.evaluate(() => (document.querySelector('oss-import') as unknown as { show(): void }).show());
  const imp = page.locator('oss-import');
  await imp.locator('textarea').fill('name,kept in,made\nCSV widget,cold,2026-11-10\nNo date widget,cold,\n');
  await expect(imp.locator('.preview .skipped oss-pill')).toHaveCount(1);
  await expect(imp.locator('.summary')).toHaveText('1 item ready, 1 skipped');
  if ((await page.viewportSize())?.width === 390) {
    await imp.locator('.foot oss-button[variant="primary"]').click();
    await imp.locator('.foot oss-button[variant="primary"]').click();
  }
  await imp.locator('.foot oss-button[variant="primary"]').click();
  await expect.poll(names).toContain('CSV widget');

  const backup = JSON.stringify({
    format: 'ossuary-backup',
    version: 1,
    appId: 'gallery-core',
    exportedAt: '2026-11-14T10:00:00.000Z',
    items: [{ id: 'restored-1', values: { name: 'Restored widget', place: 'shelf', made: '2026-11-01' }, createdAt: 'x', updatedAt: 'x' }],
  });
  await page.evaluate(() => (document.querySelector('oss-import') as unknown as { show(): void }).show());
  await imp.locator('oss-field [role="radio"]', { hasText: 'Restore backup' }).click();
  await imp.locator('textarea').fill(backup);
  await expect(imp.locator('.summary')).toHaveText('1 item in this backup: 1 new, 0 updated');
  if ((await page.viewportSize())?.width === 390) await imp.locator('.foot oss-button[variant="primary"]').click();
  await imp.locator('.foot oss-button[variant="primary"]').click();
  await expect.poll(names).toContain('Restored widget');

  const download = page.waitForEvent('download');
  await page.locator('oss-button[data-action="calendar"]').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('gallery-core.ics');
  const text = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const events = new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent');
  const count = (await names()).length;
  expect(events).toHaveLength(count);
  const blue = events.find((e) => e.getFirstPropertyValue('summary') === 'Blue widget');
  expect(blue?.getAllSubcomponents('valarm').map((a) => String(a.getFirstPropertyValue('trigger')))).toEqual(['-P2DT15H']);
  await expect(page.locator('oss-toast [role="status"]')).toContainText('Calendar file saved');
});

test('flow: a two-lifespan item gives one calendar event per lifespan', async ({ page }) => {
  await open(page, 'theme=cool');
  const download = page.waitForEvent('download');
  await page.locator('oss-button[data-action="calendar-multi"]').click();
  const file = await download;
  const text = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const events = new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent');
  expect(events.map((e) => e.getFirstPropertyValue('summary'))).toEqual(['Desk gizmo - Trial', 'Desk gizmo - Cover', 'Spare gizmo - Trial', 'Spare gizmo - Cover']);
});
