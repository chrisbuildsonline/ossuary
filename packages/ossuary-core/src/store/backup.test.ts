import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoneSpec } from '../schema/bone-spec';
import { aGizmo, aWidget, gizmo, must, testDeps, widget } from '../testing/store-harness';
import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup } from './backup';
import type { StoredItem } from './db';
import { type Store, openStore } from './repo';

afterEach(() => {
  vi.restoreAllMocks();
});

const open = async (spec: BoneSpec = widget, factory = new IDBFactory()) => must(await openStore(spec, testDeps(factory)));

async function seeded(spec: BoneSpec = widget, values: unknown[] = [aWidget, { ...aWidget, name: 'Red widget', count: 2 }]) {
  const store = await open(spec);
  for (const v of values) must(await store.create(v));
  return store;
}

const stored = (id: string, values: object = aWidget): StoredItem => ({
  id,
  values: values as StoredItem['values'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
});

const backupText = (items: unknown[], over: object = {}) =>
  JSON.stringify({ format: 'ossuary-backup', version: 1, appId: 'widget-tracker', exportedAt: '2026-11-14T10:00:00.000Z', items, ...over });

async function expectUnchanged(store: Store, run: () => Promise<unknown>) {
  const before = must(await store.list());
  await run();
  expect(must(await store.list())).toEqual(before);
}

describe('exportBackup', () => {
  it('returns the backup document with every item', async () => {
    const store = await seeded();
    const items = must(await store.list());
    expect(await store.exportBackup()).toEqual({
      ok: true,
      value: { format: BACKUP_FORMAT, version: BACKUP_VERSION, appId: 'widget-tracker', exportedAt: '2026-11-14T09:00:03.000Z', items },
    });
    expect(BACKUP_FORMAT).toBe('ossuary-backup');
    expect(BACKUP_VERSION).toBe(1);
    store.close();
  });

  it('exports an empty store', async () => {
    const store = await open();
    const backup = must(await store.exportBackup());
    expect(backup.items).toEqual([]);
    store.close();
  });
});

describe('backup round trip', () => {
  it.each([
    ['one lifespan', widget, [aWidget, { ...aWidget, name: 'Other, "quoted"\nline', opened: 'yes', count: 0 }]],
    ['two lifespans', gizmo, [aGizmo, { name: 'Gizmo two', bought: '2024-02-29', price: 12.5, maker: 'Acme' }]],
  ] as const)('export then import into a clean namespace gives equal items (%s)', async (_, spec, values) => {
    const source = await seeded(spec, [...values]);
    const text = JSON.stringify(must(await source.exportBackup()));
    for (const mode of ['merge', 'replace'] as const) {
      const target = await open(spec);
      expect(await target.importBackup(text, mode)).toEqual({ ok: true, value: { added: values.length, updated: 0, removed: 0 } });
      expect(await target.list()).toEqual(await source.list());
      target.close();
    }
    source.close();
  });
});

describe('importBackup modes', () => {
  it('merge upserts by id and keeps other items', async () => {
    const store = await seeded();
    const [a, b] = must(await store.list());
    const changed = stored(a?.id ?? '', { ...aWidget, name: 'Changed' });
    const fresh = stored('new-1');
    expect(await store.importBackup(backupText([changed, fresh]), 'merge')).toEqual({ ok: true, value: { added: 1, updated: 1, removed: 0 } });
    expect(must(await store.list())).toEqual([changed, b, fresh]);
    store.close();
  });

  it('replace swaps all items for the backup', async () => {
    const store = await seeded();
    const [a] = must(await store.list());
    const kept = stored(a?.id ?? '', { ...aWidget, name: 'Kept' });
    const fresh = stored('new-1');
    expect(await store.importBackup(backupText([kept, fresh]), 'replace')).toEqual({ ok: true, value: { added: 1, updated: 1, removed: 1 } });
    expect(must(await store.list())).toEqual([kept, fresh]);
    store.close();
  });

  it('replace with an empty backup empties the store', async () => {
    const store = await seeded();
    expect(await store.importBackup(backupText([]), 'replace')).toEqual({ ok: true, value: { added: 0, updated: 0, removed: 2 } });
    expect(must(await store.list())).toEqual([]);
    store.close();
  });

  it('drops keys that are not spec fields from imported values', async () => {
    const store = await open();
    must(await store.importBackup(backupText([stored('x', { ...aWidget, stray: 'y' })]), 'merge'));
    expect(must(await store.get('x')).values).toEqual(aWidget);
    store.close();
  });
});

describe('importBackup rejects bad backups and writes nothing', () => {
  const cases: [string, string, { path: string; message: RegExp }[]][] = [
    ['not JSON', '{"format": ', [{ path: '', message: /not valid JSON/ }]],
    ['empty text', '', [{ path: '', message: /not valid JSON/ }]],
    ['a JSON array', '[1,2]', [{ path: '', message: /not an Ossuary backup/ }]],
    ['a JSON number', '7', [{ path: '', message: /not an Ossuary backup/ }]],
    ['another format', backupText([], { format: 'other' }), [{ path: 'format', message: /not an Ossuary backup/ }]],
    ['wrong appId', backupText([], { appId: 'gizmo-keeper' }), [{ path: 'appId', message: /"gizmo-keeper".*"widget-tracker"/ }]],
    ['missing appId', backupText([], { appId: undefined }), [{ path: 'appId', message: /required/ }]],
    ['version 2', backupText([], { version: 2 }), [{ path: 'version', message: /Unsupported backup version 2/ }]],
    ['version "1"', backupText([], { version: '1' }), [{ path: 'version', message: /Unsupported backup version "1"/ }]],
    [
      'one invalid item among valid ones',
      backupText([stored('a'), stored('b', { ...aWidget, made: '2026-02-30' }), stored('c')]),
      [{ path: 'items[1].values.made', message: /YYYY-MM-DD/ }],
    ],
    [
      'an item with a bad enum and a missing field',
      backupText([stored('a', { name: 'x', place: 'attic' })]),
      [
        { path: 'items[0].values.place', message: /cold/ },
        { path: 'items[0].values.made', message: /required/ },
      ],
    ],
    ['duplicate ids', backupText([stored('a'), stored('a')]), [{ path: 'items[1].id', message: /Duplicate item id "a"/ }]],
    ['an item without an id', backupText([{ ...stored('a'), id: undefined }]), [{ path: 'items[0].id', message: /required/ }]],
    ['items not a list', backupText([], { items: {} }), [{ path: 'items', message: /list/ }]],
  ];

  it.each(cases)('%s', async (_, text, issues) => {
    const expected = { ok: false, error: { code: 'invalid', issues: issues.map((i) => ({ path: i.path, message: expect.stringMatching(i.message) })) } };
    expect(parseBackup(widget, text)).toEqual(expected);
    const store = await seeded();
    for (const mode of ['merge', 'replace'] as const) {
      await expectUnchanged(store, async () => expect(await store.importBackup(text, mode)).toEqual(expected));
    }
    store.close();
  });

  it('rejects text that is not a string without throwing', async () => {
    const store = await seeded();
    await expectUnchanged(store, async () => {
      expect((await store.importBackup(undefined as unknown as string, 'merge')).ok).toBe(false);
    });
    store.close();
  });

  it.each(['merge', 'replace'] as const)('keeps everything when a write fails half way (%s)', async (mode) => {
    const store = await seeded();
    let calls = 0;
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (++calls === 2) throw new DOMException('full', 'QuotaExceededError');
      return put.apply(this, args);
    });
    await expectUnchanged(store, async () => {
      const r = await store.importBackup(backupText([stored('n1'), stored('n2'), stored('n3')]), mode);
      expect(r).toEqual({ ok: false, error: { code: 'quota', message: expect.any(String) } });
    });
    expect(calls).toBe(2);
    store.close();
  });
});
