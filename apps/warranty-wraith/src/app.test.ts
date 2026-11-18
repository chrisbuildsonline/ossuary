// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { openStore } from '@ossuary/core/store';
import type { OssField, OssLifespan, OssTrace } from '@ossuary/core/ui';
import { IDBFactory } from 'fake-indexeddb';
import ICAL from 'ical.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type App, type AppDeps, mountApp } from './app';
import { boneSpec, defaults } from './spec';

let app: App | undefined;
afterEach(() => {
  app?.close();
  app = undefined;
  document.body.replaceChildren();
  history.replaceState(null, '', location.pathname);
});

// Tue 17 Nov 2026, 09:30 local time.
const clock = () => new Date(2026, 10, 17, 9, 30);

function deps(indexedDB: IDBFactory = new IDBFactory(), extra: Partial<AppDeps> = {}): AppDeps {
  let ids = 0;
  return { indexedDB, clock, newId: () => `id-${++ids}`, download: vi.fn(), ...extra };
}

type Values = Record<string, string | number>;

async function seeded(...items: Values[]): Promise<IDBFactory> {
  const indexedDB = new IDBFactory();
  let n = 0;
  const opened = await openStore(boneSpec, { newId: () => `seed-${++n}`, nowIso: () => '2026-11-17T08:00:00.000Z', indexedDB });
  if (!opened.ok) throw new Error('store did not open');
  for (const values of items) {
    const r = await opened.value.create(values);
    if (!r.ok) throw new Error(`seed failed: ${JSON.stringify(r.error)}`);
  }
  opened.value.close();
  return indexedDB;
}

const kettle: Values = { name: 'Acme kettle', retailer: 'Corner Shop', bought: '2026-10-08' };

const shadow = (el: Element | null | undefined, sel: string) => el?.shadowRoot?.querySelector(sel) ?? null;
const shadowAll = (el: Element | null | undefined, sel: string) => Array.from(el?.shadowRoot?.querySelectorAll(sel) ?? []);
const list = () => document.querySelector('oss-list');
const sheet = () => document.querySelector('oss-sheet');
const toastText = () => shadow(document.querySelector('oss-toast'), '.toast span')?.textContent;
const toastUndo = () => shadow(document.querySelector('oss-toast'), '.toast button') as HTMLElement | null;
const primaryPill = () =>
  Array.from(document.querySelectorAll('oss-shell > oss-button[slot="primary"]')).filter((b) => !(b as HTMLElement).hidden) as HTMLElement[];
const sheetFields = () => shadowAll(sheet(), 'oss-field') as OssField[];

async function waitFor<T>(find: () => T | null | undefined, what = 'element'): Promise<T> {
  return vi.waitFor(() => {
    const v = find();
    if (v === null || v === undefined) throw new Error(`no ${what} yet`);
    return v;
  });
}

/** Opens the detail view of the listed item with `name`. */
async function openItem(name: string): Promise<void> {
  const item = await waitFor(() => shadowAll(list(), 'oss-item').find((i) => shadow(i, '.title')?.textContent === name), name);
  (shadow(item, 'a') as HTMLElement).click();
  await vi.waitFor(() => expect(document.querySelector('.ww-detail:not([hidden]) h1')?.textContent).toBe(name));
}

function type(field: OssField | undefined, value: string): void {
  const input = shadow(field, 'input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

describe('warranty wraith app: home, add, edit and done', () => {
  it('shows the themed shell and the empty state with the ghost parcel and the spec title', async () => {
    app = await mountApp(document.body, deps());
    const shell = document.querySelector('oss-shell');
    expect(shell?.style.getPropertyValue('--accent')).toBe('#5a4bd1');
    expect(shadow(shell, '.wordmark')?.textContent).toBe('Warranty Wraith');
    const empty = await waitFor(() => shadow(list(), 'oss-empty'));
    expect(empty.getAttribute('kind')).toBe('empty');
    expect(shadow(empty, 'h2')?.textContent).toBe(boneSpec.copy?.emptyTitle);
    expect(shadow(empty, '.art svg')?.getAttribute('data-art')).toBe('ghost-parcel');
    expect(document.querySelector('h1')?.textContent).toBeTruthy();
    // One primary action on the screen: the empty state's own.
    expect(primaryPill()).toHaveLength(0);
  });

  it('adds a purchase through the sheet with the spec defaults and a two-countdown preview', async () => {
    app = await mountApp(document.body, deps());
    const empty = await waitFor(() => shadow(list(), 'oss-empty'));
    (shadow(empty, 'oss-button[variant="primary"]') as HTMLElement).click();

    expect(sheetFields().map((f) => [f.field?.key, f.value])).toEqual([
      ['name', undefined],
      ['retailer', undefined],
      ['bought', '2026-11-17'],
      ['return_days', defaults.returnDays],
      ['warranty_months', defaults.warrantyMonths],
      ['price', undefined],
      ['model', undefined],
    ]);
    expect([defaults.returnDays, defaults.warrantyMonths]).toEqual([30, 12]);
    expect(sheet()?.shadowRoot?.textContent).not.toContain('Required.');

    const [name, retailer] = sheetFields();
    type(name, 'Acme kettle');
    type(retailer, 'Corner Shop');
    const preview = shadow(sheet(), '.preview');
    expect(preview?.querySelector('.expires')?.textContent).toBe('Return window: expires in 30 days · Thu 17 Dec');
    expect(Array.from(preview?.querySelectorAll('.others li') ?? []).map((l) => l.querySelector('.label')?.textContent)).toEqual(['Warranty']);

    (shadow(sheet(), '.foot oss-button') as HTMLElement).click();
    await waitFor(() => shadow(list(), 'oss-item'));
    expect(list()?.entries.map((e) => e.values)).toEqual([
      { name: 'Acme kettle', retailer: 'Corner Shop', bought: '2026-11-17', return_days: 30, warranty_months: 12 },
    ]);
    expect(toastText()).toBe('Added Acme kettle');
  });

  it('opens the add sheet from the shell pill once purchases exist', async () => {
    app = await mountApp(document.body, deps(await seeded(kettle)));
    await waitFor(() => shadow(list(), 'oss-item'));
    expect(primaryPill().map((b) => b.textContent)).toEqual(['Add purchase']);
    primaryPill()[0]?.click();
    expect(shadow(sheet(), 'h2')?.textContent).toBe('Add purchase');
    expect(sheetFields().find((f) => f.field?.key === 'return_days')?.value).toBe(30);
  });

  it('has no input for the dismissed recalls, and an edit keeps their stored value', async () => {
    app = await mountApp(document.body, deps(await seeded({ ...kettle, recalls_dismissed: '27054' })));
    await openItem('Acme kettle');
    (document.querySelector('[data-action="edit"]') as HTMLElement).click();
    expect(sheetFields().map((f) => f.field?.key)).not.toContain('recalls_dismissed');
    expect(sheet()?.shadowRoot?.textContent).not.toContain('Dismissed recalls');
    expect(sheet()?.shadowRoot?.textContent).not.toContain('Required.');
    type(sheetFields()[0], 'Acme K2 kettle');
    (shadow(sheet(), '.foot oss-button') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.ww-detail h1')?.textContent).toBe('Acme K2 kettle'));
    expect(list()?.entries[0]?.values).toEqual({ ...kettle, name: 'Acme K2 kettle', recalls_dismissed: '27054' });
  });

  it('lists a purchase with a lapsed return window and a live warranty as live, and counts the week in the headline', async () => {
    // Bought 40 days ago: return window 10 days past, warranty live. Bought 26 days ago: return window closes in 4 days.
    const lamp: Values = { name: 'Desk lamp', retailer: 'Lamp Co', bought: '2026-10-22' };
    app = await mountApp(document.body, deps(await seeded(kettle, lamp)));
    await vi.waitFor(() => expect(shadowAll(list(), 'oss-item')).toHaveLength(2));

    const groups = shadowAll(list(), 'section[data-tone]').map((s) => [s.getAttribute('data-tone'), shadowAll(list(), `section[data-tone="${s.getAttribute('data-tone')}"] oss-item`).length]);
    expect(groups).toEqual([
      ['soon', 1],
      ['fresh', 1],
    ]);
    const kettleCard = shadowAll(list(), 'oss-item').find((i) => shadow(i, '.title')?.textContent === 'Acme kettle');
    expect(shadow(kettleCard, 'oss-pill')?.getAttribute('label') ?? shadow(kettleCard, '.lifespan')?.textContent).not.toBe('Lapsed');
    expect(shadow(kettleCard, '.other .label')?.textContent).toBe('Return window');
    expect(shadow(kettleCard, '.other .stage')?.textContent).toBe('Lapsed');

    expect(document.querySelector('h1')?.textContent).toBe('1 return window closes this week');
    expect(document.querySelector('.ww-hero p')?.textContent).toContain('Desk lamp');
  });

  it('words the headline for warranties, for both kinds, and for a quiet week', async () => {
    const endsSoon: Values = { name: 'Phone case', retailer: 'Case Shop', bought: '2025-11-20' };
    const closesSoon: Values = { name: 'Desk lamp', retailer: 'Lamp Co', bought: '2026-10-22' };
    app = await mountApp(document.body, deps(await seeded(endsSoon)));
    await vi.waitFor(() => expect(document.querySelector('h1')?.textContent).toBe('1 warranty ends this week'));
    app.close();
    document.body.replaceChildren();

    app = await mountApp(document.body, deps(await seeded(endsSoon, closesSoon, { ...endsSoon, name: 'Mouse' })));
    await vi.waitFor(() => expect(document.querySelector('h1')?.textContent).toBe('1 return window closes and 2 warranties end this week'));
    app.close();
    document.body.replaceChildren();

    app = await mountApp(document.body, deps(await seeded(kettle)));
    await vi.waitFor(() => expect(document.querySelector('h1')?.textContent).toBe('Nothing closes this week'));
  });

  it('removes a purchase with "Done with it" and brings it back with Undo', async () => {
    app = await mountApp(document.body, deps(await seeded(kettle)));
    await openItem('Acme kettle');
    expect(primaryPill().map((b) => b.textContent)).toEqual(['Done with it']);
    primaryPill()[0]?.click();
    await waitFor(() => shadow(list(), 'oss-empty'));
    expect(document.querySelector('.ww-detail')?.hasAttribute('hidden')).toBe(true);
    expect(toastText()).toBe('Done with Acme kettle');
    toastUndo()?.click();
    await waitFor(() => shadow(list(), 'oss-item'));
    expect(list()?.entries.map((e) => e.values)).toEqual([kettle]);
  });

  it('shows a store error as one line and one action, without throwing', async () => {
    const broken = { open: () => { throw new Error('blocked by the browser'); } } as unknown as IDBFactory;
    app = await mountApp(document.body, deps(broken));
    const empty = shadow(list(), 'oss-empty');
    expect(empty?.getAttribute('kind')).toBe('error');
    expect(empty?.shadowRoot?.textContent).toContain('Storage is not available');
    expect(empty?.shadowRoot?.querySelectorAll('oss-button')).toHaveLength(1);
  });
});

describe('warranty wraith app: detail view and calendar', () => {
  const cards = () => Array.from(document.querySelectorAll<OssLifespan>('.ww-detail oss-lifespan'));

  it('shows one oss-lifespan card per lifespan, the live warranty first and the lapsed return window second', async () => {
    app = await mountApp(document.body, deps(await seeded(kettle)));
    await openItem('Acme kettle');
    expect(cards()).toHaveLength(2);
    expect(cards().map((c) => c.lifespan?.lifespanId)).toEqual(['warranty', 'return_window']);
    expect(cards().map((c) => c.motif)).toEqual(['ghost', 'ghost']);
    expect(cards().map((c) => shadow(c, 'oss-decay')?.getAttribute('motif'))).toEqual(['ghost', 'ghost']);
    expect(cards().map((c) => shadow(c, 'oss-pill')?.getAttribute('label'))).toEqual(['Covered', 'Lapsed']);
    expect(cards().map((c) => shadow(c, 'time')?.getAttribute('datetime'))).toEqual(['2027-10-08', '2026-11-07']);
    expect(shadow(cards()[0], 'section')?.getAttribute('aria-label')).toBe('Warranty: expires in 10 months, Friday 8 October 2027.');
    expect(shadow(cards()[1], 'section')?.getAttribute('aria-label')).toBe('Return window: expired 10 days ago, Saturday 7 November.');
  });

  it('puts the return window first while it is the one that ends first', async () => {
    app = await mountApp(document.body, deps(await seeded({ ...kettle, bought: '2026-11-17' })));
    await openItem('Acme kettle');
    expect(cards().map((c) => c.lifespan?.lifespanId)).toEqual(['return_window', 'warranty']);
  });

  it('explains both dates in the trace', async () => {
    app = await mountApp(document.body, deps(await seeded({ ...kettle, bought: '2026-11-17' })));
    await openItem('Acme kettle');
    const trace = document.querySelector<OssTrace>('.ww-detail oss-trace');
    expect(trace?.evaluation?.lifespans.map((l) => l.lifespanId)).toEqual(['return_window', 'warranty']);
    const text = trace?.shadowRoot?.textContent ?? '';
    expect(text).toContain('Return window');
    expect(text).toContain('Warranty');
    expect(text).toContain('30 days');
    expect(text).toContain('12 months');
  });

  it('shows retailer, bought day, price and model in the meta line, and leaves out what is not set', async () => {
    app = await mountApp(document.body, deps(await seeded({ ...kettle, price: 69.99, model: 'DR-HSH015' }, { name: 'Desk lamp', retailer: 'Lamp Co', bought: '2026-10-22' })));
    await openItem('Acme kettle');
    expect(document.querySelector('.ww-meta')?.textContent).toBe('Corner Shop · bought Thu 8 Oct · $69.99 · Model DR-HSH015');
    (document.querySelector('.ww-back') as HTMLElement).click();
    await openItem('Desk lamp');
    expect(document.querySelector('.ww-meta')?.textContent).toBe('Lamp Co · bought Thu 22 Oct');
  });

  /** Clicks "Add to calendar" once and returns the parsed events of the downloaded file. */
  async function exportCalendar(values: Values) {
    const d = deps(await seeded(values));
    app = await mountApp(document.body, d);
    await openItem(String(values.name));
    const buttons = document.querySelectorAll('.ww-detail [data-action="calendar"]');
    expect(buttons).toHaveLength(1);
    (buttons[0] as HTMLElement).click();
    expect(d.download).toHaveBeenCalledTimes(1);
    const [filename, text, mime] = vi.mocked(d.download as NonNullable<AppDeps['download']>).mock.calls[0] ?? [];
    expect([filename, mime]).toEqual(['warranty-wraith.ics', 'text/calendar']);
    expect(toastText()).toBe('Calendar file saved');
    return new ICAL.Component(ICAL.parse(String(text))).getAllSubcomponents('vevent').map((e) => ({
      summary: String(e.getFirstPropertyValue('summary')),
      day: String(e.getFirstPropertyValue('dtstart')),
      uid: String(e.getFirstPropertyValue('uid')),
      alarms: e.getAllSubcomponents('valarm').map((a) => String(a.getFirstPropertyValue('trigger'))),
    }));
  }

  it('exports the purchase as two events with stable ids and every alarm when all are ahead', async () => {
    const events = await exportCalendar({ ...kettle, bought: '2026-11-17' });
    expect(events).toEqual([
      { summary: 'Acme kettle - Return window', day: '2026-12-17', uid: 'warranty-wraith-seed-1-return_window@ossuary', alarms: ['-P6DT15H', '-P1DT15H'] },
      { summary: 'Acme kettle - Warranty', day: '2027-11-17', uid: 'warranty-wraith-seed-1-warranty@ossuary', alarms: ['-P89DT15H', '-P29DT15H', '-P6DT15H'] },
    ]);
  });

  it('leaves out the alarms that are already past', async () => {
    // The return window closes on Sat 21 Nov, so its 7-day alarm (Sat 14 Nov) is past and the 2-day one remains.
    const events = await exportCalendar({ ...kettle, bought: '2026-10-22' });
    expect(events.map((e) => [e.day, e.alarms])).toEqual([
      ['2026-11-21', ['-P1DT15H']],
      ['2027-10-22', ['-P89DT15H', '-P29DT15H', '-P6DT15H']],
    ]);
  });
});
