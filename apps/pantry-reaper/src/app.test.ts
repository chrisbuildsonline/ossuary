// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { openStore } from '@ossuary/core/store';
import type { OssField } from '@ossuary/core/ui';
import { IDBFactory } from 'fake-indexeddb';
import ICAL from 'ical.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type App, type AppDeps, mountApp } from './app';
import { foods } from './data/foods';
import { searchFoods } from './data/search';
import { boneSpec } from './spec';

const yogurt = foods.find((f) => f.name === 'Yogurt');
if (!yogurt) throw new Error('Yogurt is missing from foods.json');

let app: App | undefined;
afterEach(() => {
  app?.close();
  app = undefined;
  document.body.replaceChildren();
});

function deps(indexedDB: IDBFactory = new IDBFactory()): AppDeps {
  let ids = 0;
  return {
    indexedDB,
    clock: () => new Date(2026, 10, 17, 9, 30),
    newId: () => `id-${++ids}`,
    download: vi.fn(),
  };
}

const shadow = (el: Element | null | undefined, sel: string) => el?.shadowRoot?.querySelector(sel) ?? null;
const list = () => document.querySelector('oss-list');
const press = (target: Element, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));

/** Opens the detail view of the first listed item. */
async function openFirstItem(): Promise<void> {
  const item = await vi.waitFor(() => {
    const el = shadow(list(), 'oss-item');
    if (!el) throw new Error('no item yet');
    return el;
  });
  (shadow(item, 'a') as HTMLElement).click();
  await vi.waitFor(() => expect(document.querySelector('.pr-detail:not([hidden])')).not.toBeNull());
}

async function seeded(values: Record<string, string>): Promise<IDBFactory> {
  const indexedDB = new IDBFactory();
  const opened = await openStore(boneSpec, { newId: () => 'seed-1', nowIso: () => '2026-11-17T08:00:00.000Z', indexedDB });
  if (!opened.ok) throw new Error('store did not open');
  await opened.value.create(values);
  opened.value.close();
  return indexedDB;
}

describe('pantry reaper app', () => {
  it('renders the themed shell and the empty state', async () => {
    app = await mountApp(document.body, deps());
    const shell = document.querySelector('oss-shell');
    expect(shell?.style.getPropertyValue('--accent')).toBe('#b8460e');
    expect(shadow(shell, '.wordmark')?.textContent).toBe('Pantry Reaper');
    const empty = shadow(list(), 'oss-empty');
    expect(empty?.getAttribute('kind')).toBe('empty');
    expect(shadow(empty, 'h2')?.textContent).toBe("Nothing's dying yet.");
    expect(document.querySelector('h1')?.textContent).toBeTruthy();
  });

  it('shows a stored item with its countdown and stage pill', async () => {
    app = await mountApp(document.body, deps(await seeded({ name: 'Yogurt', food_id: yogurt.id, storage: 'fridge', bought: '2026-11-17' })));
    const item = await vi.waitFor(() => {
      const el = shadow(list(), 'oss-item');
      if (!el) throw new Error('no item yet');
      return el;
    });
    expect(shadow(item, '.value')?.textContent).toBe('7');
    expect(shadow(item, '.unit')?.textContent).toBe('days');
    expect(shadow(item, 'oss-pill')?.getAttribute('label')).toBe('Keeping well');
    expect(shadow(item, '.title')?.textContent).toBe('Yogurt');
    expect(document.querySelector('h1')?.textContent).toBe('1 thing dies this week');
  });

  it('offers to remove an item whose food is no longer in the snapshot', async () => {
    app = await mountApp(document.body, deps(await seeded({ name: 'Old jam', food_id: 'gone', storage: 'pantry', bought: '2026-11-01' })));
    const note = await vi.waitFor(() => {
      const n = document.querySelector('.pr-note');
      if (!n) throw new Error('no note yet');
      return n;
    });
    expect(note.textContent).toContain('Old jam');
    (note.querySelector('oss-button') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.pr-note')).toBeNull());
    expect(shadow(list(), 'oss-empty')).not.toBeNull();
  });

  it('finds a food with the keyboard, opens the sheet prefilled and saves the item', async () => {
    app = await mountApp(document.body, deps());
    const search = document.querySelector('pr-food-search');
    const input = shadow(search, 'input') as HTMLInputElement;
    input.value = 'yogurt';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    const options = Array.from(search?.shadowRoot?.querySelectorAll('[role="option"]') ?? []);
    const expected = searchFoods(foods, 'yogurt');
    expect(options.map((o) => o.querySelector('.name')?.textContent)).toEqual(expected.map((f) => f.name.split(', ')[0]));
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options[0]?.textContent).toContain('Fridge 7 days · Freezer 1 month');

    press(input, 'ArrowDown');
    press(input, 'ArrowDown');
    press(input, 'ArrowUp');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    press(input, 'Enter');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    const sheet = document.querySelector('oss-sheet');
    const fields = Array.from(sheet?.shadowRoot?.querySelectorAll('oss-field') ?? []) as OssField[];
    expect(fields.map((f) => [f.field?.key, f.value])).toEqual([
      ['name', 'Yogurt'],
      ['storage', 'fridge'],
      ['bought', '2026-11-17'],
    ]);
    expect(sheet?.shadowRoot?.textContent).not.toContain('FoodKeeper entry');
    (shadow(sheet, '.foot oss-button') as HTMLElement).click();

    await vi.waitFor(() => expect(shadow(list(), 'oss-item')).not.toBeNull());
    expect(list()?.entries.map((e) => e.values)).toEqual([{ name: 'Yogurt', food_id: yogurt.id, storage: 'fridge', bought: '2026-11-17' }]);
  });

  it('keeps the food when a saved item is edited', async () => {
    app = await mountApp(document.body, deps(await seeded({ name: 'Yogurt', food_id: yogurt.id, storage: 'fridge', bought: '2026-11-17' })));
    await openFirstItem();
    (document.querySelector('[data-action="edit"]') as HTMLElement).click();
    const sheet = document.querySelector('oss-sheet');
    const fields = Array.from(sheet?.shadowRoot?.querySelectorAll('oss-field') ?? []) as OssField[];
    expect(fields.map((f) => f.field?.key)).toEqual(['name', 'storage', 'bought']);
    const name = shadow(fields[0], 'input') as HTMLInputElement;
    name.value = 'Greek yogurt';
    name.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    (shadow(sheet, '.foot oss-button') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.pr-detail h1')?.textContent).toBe('Greek yogurt'));
    expect(list()?.entries[0]?.values).toEqual({ name: 'Greek yogurt', food_id: yogurt.id, storage: 'fridge', bought: '2026-11-17' });
  });

  it('moves an item to the freezer with a date-jump toast, a trace line and Undo', async () => {
    app = await mountApp(document.body, deps(await seeded({ name: 'Yogurt', food_id: yogurt.id, storage: 'fridge', bought: '2026-11-17' })));
    await openFirstItem();
    const expires = () => document.querySelector('.pr-detail time')?.getAttribute('datetime');
    expect(expires()).toBe('2026-11-24');
    const radios = Array.from(document.querySelector('pr-storage-switch')?.shadowRoot?.querySelectorAll('[role="radio"]') ?? []);
    expect(radios.map((r) => r.textContent)).toEqual(['Fridge', 'Freezer']);
    (radios[1] as HTMLElement).click();

    await vi.waitFor(() => expect(expires()).toBe('2026-12-17'));
    const toast = document.querySelector('oss-toast');
    expect(shadow(toast, '.toast span')?.textContent).toBe('Moved to freezer: +23 days');
    expect(document.querySelector('oss-trace')?.shadowRoot?.textContent).toContain('Storage is Freezer: 30 days (USDA FoodKeeper)');
    expect(list()?.entries[0]?.values.storage).toBe('freezer');

    (shadow(toast, '.toast button') as HTMLElement).click();
    await vi.waitFor(() => expect(expires()).toBe('2026-11-24'));
    expect(list()?.entries[0]?.values).toEqual({ name: 'Yogurt', food_id: yogurt.id, storage: 'fridge', bought: '2026-11-17' });
    expect(document.querySelector('oss-trace')?.shadowRoot?.textContent).toContain('Storage is Fridge: 7 days (USDA FoodKeeper)');
  });

  it('exports the selected item as a calendar file with the alarms still ahead', async () => {
    const d = deps(await seeded({ name: 'Yogurt', food_id: yogurt.id, storage: 'fridge', bought: '2026-11-17' }));
    app = await mountApp(document.body, d);
    await openFirstItem();
    (document.querySelector('[data-action="calendar"]') as HTMLElement).click();

    expect(d.download).toHaveBeenCalledTimes(1);
    const [filename, text, mime] = vi.mocked(d.download as NonNullable<AppDeps['download']>).mock.calls[0] ?? [];
    expect([filename, mime]).toEqual(['pantry-reaper.ics', 'text/calendar']);
    const events = new ICAL.Component(ICAL.parse(String(text))).getAllSubcomponents('vevent');
    expect(events).toHaveLength(1);
    const event = events[0] as ICAL.Component;
    expect(String(event.getFirstPropertyValue('summary'))).toBe('Yogurt');
    expect(String(event.getFirstPropertyValue('dtstart'))).toBe('2026-11-24');
    // Expires in 7 days, so the 14-day alarm is already past; the 3-day and same-day ones remain.
    const triggers = event.getAllSubcomponents('valarm').map((a) => String(a.getFirstPropertyValue('trigger')));
    expect(triggers).toEqual(['-P2DT15H', 'PT9H']);
    expect(shadow(document.querySelector('oss-toast'), '.toast span')?.textContent).toBe('Calendar file saved');
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
