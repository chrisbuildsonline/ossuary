// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { openStore } from '@ossuary/core/store';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type App, type AppDeps, mountApp } from './app';
import { foods } from './data/foods';
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

  it('shows a store error as one line and one action, without throwing', async () => {
    const broken = { open: () => { throw new Error('blocked by the browser'); } } as unknown as IDBFactory;
    app = await mountApp(document.body, deps(broken));
    const empty = shadow(list(), 'oss-empty');
    expect(empty?.getAttribute('kind')).toBe('error');
    expect(empty?.shadowRoot?.textContent).toContain('Storage is not available');
    expect(empty?.shadowRoot?.querySelectorAll('oss-button')).toHaveLength(1);
  });
});
