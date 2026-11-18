// @vitest-environment happy-dom
// Runs against the placeholder bone.json. Not copied into generated apps.
import 'fake-indexeddb/auto';
import { openStore } from '@ossuary/core/store';
import type { OssField } from '@ossuary/core/ui';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type App, type AppDeps, mountApp } from './app';
import { boneSpec } from './spec';

let app: App | undefined;
afterEach(() => {
  app?.close();
  app = undefined;
  document.body.replaceChildren();
  history.replaceState(null, '', location.pathname);
});

// Wed 18 Nov 2026, 09:30 local time.
const clock = () => new Date(2026, 10, 18, 9, 30);

function deps(indexedDB: IDBFactory = new IDBFactory(), extra: Partial<AppDeps> = {}): AppDeps {
  let ids = 0;
  return { indexedDB, clock, newId: () => `id-${++ids}`, download: vi.fn(), ...extra };
}

type Values = Record<string, string | number>;

async function seeded(...items: Values[]): Promise<IDBFactory> {
  const indexedDB = new IDBFactory();
  let n = 0;
  const opened = await openStore(boneSpec, { newId: () => `seed-${++n}`, nowIso: () => '2026-11-18T08:00:00.000Z', indexedDB });
  if (!opened.ok) throw new Error('store did not open');
  for (const values of items) {
    const r = await opened.value.create(values);
    if (!r.ok) throw new Error(`seed failed: ${JSON.stringify(r.error)}`);
  }
  opened.value.close();
  return indexedDB;
}

const sample: Values = { name: 'Blue box', note: 'Top shelf', started: '2026-11-10' };

const shadow = (el: Element | null | undefined, sel: string) => el?.shadowRoot?.querySelector(sel) ?? null;
const shadowAll = (el: Element | null | undefined, sel: string) => Array.from(el?.shadowRoot?.querySelectorAll(sel) ?? []);
const list = () => document.querySelector('oss-list');
const sheet = () => document.querySelector('oss-sheet');
const detail = () => document.querySelector<HTMLElement>('.bone-detail');
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

async function openItem(name: string): Promise<void> {
  const item = await waitFor(() => shadowAll(list(), 'oss-item').find((i) => shadow(i, '.title')?.textContent === name), name);
  (shadow(item, 'a') as HTMLElement).click();
  await vi.waitFor(() => expect(document.querySelector('.bone-detail:not([hidden]) h1')?.textContent).toBe(name));
}

function type(field: OssField | undefined, value: string): void {
  const input = shadow(field, 'input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

describe('template app: home and add', () => {
  it('shows the shell named from the spec and the empty state, with no shell pill', async () => {
    app = await mountApp(document.body, deps());
    const shell = document.querySelector('oss-shell');
    expect(shadow(shell, '.wordmark')?.textContent).toBe(boneSpec.theme?.wordmark ?? boneSpec.name);
    const empty = await waitFor(() => shadow(list(), 'oss-empty'));
    expect(empty.getAttribute('kind')).toBe('empty');
    expect(document.querySelector('h1')?.textContent).toBe(boneSpec.name);
    expect(primaryPill()).toHaveLength(0);
  });

  it('adds an item through the sheet, with the start day prefilled to today', async () => {
    app = await mountApp(document.body, deps());
    const empty = await waitFor(() => shadow(list(), 'oss-empty'));
    (shadow(empty, 'oss-button[variant="primary"]') as HTMLElement).click();
    expect(sheetFields().map((f) => [f.field?.key, f.value])).toEqual([
      ['name', undefined],
      ['note', undefined],
      ['started', '2026-11-18'],
    ]);
    type(sheetFields()[0], 'Blue box');
    (shadow(sheet(), '.foot oss-button') as HTMLElement).click();
    await waitFor(() => shadow(list(), 'oss-item'));
    expect(list()?.entries.map((e) => e.values)).toEqual([{ name: 'Blue box', started: '2026-11-18' }]);
    expect(toastText()).toBe('Added Blue box');
  });

  it('says how many countdowns end this week', async () => {
    app = await mountApp(document.body, deps(await seeded(sample, { name: 'Late one', started: '2026-10-22' })));
    await waitFor(() => shadowAll(list(), 'oss-item').length === 2 || null);
    expect(document.querySelector('h1')?.textContent).toBe('1 ends this week');
    expect(document.querySelector('.bone-hero p')?.textContent).toBe('Late one: Window ends in 3 days.');
    expect(primaryPill().map((b) => b.textContent)).toEqual(['Add item']);
  });
});

describe('template app: backup', () => {
  it('opens from the shell nav and saves a backup file named from the spec id', async () => {
    const d = deps(await seeded(sample));
    app = await mountApp(document.body, d);
    await waitFor(() => shadow(list(), 'oss-item'));
    document.querySelector('oss-shell')?.dispatchEvent(new CustomEvent('oss-nav', { detail: { target: 'backup' } }));
    expect((document.querySelector('.bone-backup') as HTMLElement).hidden).toBe(false);
    expect((document.querySelector('.bone-home') as HTMLElement).hidden).toBe(true);
    (document.querySelector('[data-action="backup"]') as HTMLElement).click();
    await vi.waitFor(() => expect(d.download).toHaveBeenCalledTimes(1));
    expect(vi.mocked(d.download)?.mock.calls[0]?.[0]).toBe(`${boneSpec.id}-backup.json`);
    expect(toastText()).toBe('Backup file saved');
  });
});

describe('template app: detail', () => {
  it('shows the title, the summary fields, one card per lifespan and the trace', async () => {
    app = await mountApp(document.body, deps(await seeded(sample)));
    await openItem('Blue box');
    expect(detail()?.querySelector('.bone-meta')?.textContent).toBe('Top shelf');
    expect(detail()?.querySelectorAll('oss-lifespan')).toHaveLength(boneSpec.lifespans.length);
    expect(detail()?.querySelector('oss-trace')).not.toBeNull();
    expect(primaryPill().map((b) => b.textContent)).toEqual(['Done']);
  });

  it('exports the item to a calendar file', async () => {
    const d = deps(await seeded(sample));
    app = await mountApp(document.body, d);
    await openItem('Blue box');
    (detail()?.querySelector('[data-action="calendar"]') as HTMLElement).click();
    expect(d.download).toHaveBeenCalledTimes(1);
    expect(vi.mocked(d.download)?.mock.calls[0]?.[0]).toMatch(/\.ics$/);
    expect(vi.mocked(d.download)?.mock.calls[0]?.[1]).toContain('BEGIN:VCALENDAR');
  });

  it('opens the edit sheet with the stored values', async () => {
    app = await mountApp(document.body, deps(await seeded(sample)));
    await openItem('Blue box');
    (detail()?.querySelector('[data-action="edit"]') as HTMLElement).click();
    expect(sheetFields().map((f) => f.value)).toEqual(['Blue box', 'Top shelf', '2026-11-10']);
  });

  it('marks an item done, with undo', async () => {
    app = await mountApp(document.body, deps(await seeded(sample)));
    await openItem('Blue box');
    primaryPill()[0]?.click();
    await vi.waitFor(() => expect(toastText()).toBe('Done with Blue box'));
    expect(list()?.entries).toHaveLength(0);
    expect(detail()?.hidden).toBe(true);
    toastUndo()?.click();
    await vi.waitFor(() => expect(list()?.entries.map((e) => e.values.name)).toEqual(['Blue box']));
  });

  it('removes an item, with undo', async () => {
    app = await mountApp(document.body, deps(await seeded(sample)));
    await openItem('Blue box');
    (detail()?.querySelector('[data-action="remove"]') as HTMLElement).click();
    await vi.waitFor(() => expect(toastText()).toBe('Removed Blue box'));
    expect(list()?.entries).toHaveLength(0);
    toastUndo()?.click();
    await vi.waitFor(() => expect(list()?.entries).toHaveLength(1));
  });
});
