import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aGizmo, aWidget, gizmo, must, testDeps, widget } from '../testing/store-harness';
import { openStore } from './repo';

afterEach(() => {
  vi.restoreAllMocks();
});

const open = async (deps = testDeps(), spec = widget) => must(await openStore(spec, deps));

describe('store CRUD', () => {
  it('creates an item with the injected id and clock', async () => {
    const store = await open();
    const r = await store.create({ ...aWidget, count: 3 });
    expect(r).toEqual({
      ok: true,
      value: {
        id: 'id-1',
        values: { ...aWidget, count: 3 },
        createdAt: '2026-11-14T09:00:01.000Z',
        updatedAt: '2026-11-14T09:00:01.000Z',
      },
    });
    store.close();
  });

  it('stores only spec fields and drops undefined values', async () => {
    const store = await open();
    const item = must(await store.create({ ...aWidget, opened: undefined, extra: 'x' }));
    expect(item.values).toEqual(aWidget);
    expect(Object.keys(item.values).sort()).toEqual(['made', 'name', 'place']);
    store.close();
  });

  it('gets and lists what it created', async () => {
    const store = await open();
    const a = must(await store.create(aWidget));
    const b = must(await store.create({ ...aWidget, name: 'Red widget' }));
    expect(await store.get(a.id)).toEqual({ ok: true, value: a });
    expect(await store.list()).toEqual({ ok: true, value: [a, b] });
    store.close();
  });

  it('updates values, keeps createdAt and moves updatedAt', async () => {
    const store = await open();
    const a = must(await store.create(aWidget));
    const r = must(await store.update(a.id, { ...aWidget, place: 'shelf' }));
    expect(r).toEqual({ id: a.id, values: { ...aWidget, place: 'shelf' }, createdAt: a.createdAt, updatedAt: '2026-11-14T09:00:02.000Z' });
    expect(await store.get(a.id)).toEqual({ ok: true, value: r });
    store.close();
  });

  it('removes an item', async () => {
    const store = await open();
    const a = must(await store.create(aWidget));
    expect(await store.remove(a.id)).toEqual({ ok: true, value: undefined });
    expect(await store.list()).toEqual({ ok: true, value: [] });
    store.close();
  });

  it.each(['get', 'update', 'remove'] as const)('%s on a missing id returns not_found', async (method) => {
    const store = await open();
    must(await store.create(aWidget));
    const r = method === 'update' ? await store.update('nope', aWidget) : await store[method]('nope');
    expect(r).toEqual({ ok: false, error: { code: 'not_found', id: 'nope' } });
    expect(must(await store.list())).toHaveLength(1);
    store.close();
  });

  it('rejects an invalid create with path-level issues and writes nothing', async () => {
    const store = await open();
    const before = must(await store.list());
    const r = await store.create({ name: '', place: 'attic', made: '2026-02-30' });
    expect(r.ok).toBe(false);
    if (r.ok || r.error.code !== 'invalid') throw new Error('expected invalid');
    expect(r.error.issues.map((i) => i.path).sort()).toEqual(['made', 'name', 'place']);
    expect(must(await store.list())).toEqual(before);
    store.close();
  });

  it('rejects an invalid update and leaves the item unchanged', async () => {
    const store = await open();
    const a = must(await store.create(aWidget));
    const r = await store.update(a.id, { ...aWidget, count: -1 });
    expect(r).toEqual({ ok: false, error: { code: 'invalid', issues: [{ path: 'count', message: expect.any(String) }] } });
    expect(await store.get(a.id)).toEqual({ ok: true, value: a });
    store.close();
  });

  it.each([null, 'text', 42, [aWidget]])('rejects a non-object value %j as invalid', async (input) => {
    const store = await open();
    const r = await store.create(input);
    expect(r.ok === false && r.error.code).toBe('invalid');
    store.close();
  });

  it('rejects a duplicate id from the generator as invalid and keeps the first item', async () => {
    const deps = { ...testDeps(), newId: () => 'same' };
    const store = await open(deps);
    const a = must(await store.create(aWidget));
    const r = await store.create({ ...aWidget, name: 'Other' });
    expect(r).toEqual({ ok: false, error: { code: 'invalid', issues: [{ path: 'id', message: expect.any(String) }] } });
    expect(await store.list()).toEqual({ ok: true, value: [a] });
    store.close();
  });

  it('returns quota when the disk is full and keeps the data unchanged', async () => {
    const store = await open();
    const a = must(await store.create(aWidget));
    const full = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(full);
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(full);
    expect(await store.create(aWidget)).toEqual({ ok: false, error: { code: 'quota', message: expect.any(String) } });
    expect(await store.update(a.id, { ...aWidget, name: 'New' })).toEqual({ ok: false, error: { code: 'quota', message: expect.any(String) } });
    vi.restoreAllMocks();
    expect(await store.list()).toEqual({ ok: true, value: [a] });
    store.close();
  });

  it('returns errors instead of throwing after close', async () => {
    const store = await open();
    store.close();
    for (const r of [await store.create(aWidget), await store.get('x'), await store.list(), await store.update('x', aWidget), await store.remove('x')]) {
      expect(r.ok === false && r.error.code).toBe('unavailable');
    }
    expect(() => store.close()).not.toThrow();
  });

  it('returns an error instead of throwing when an injected edge throws', async () => {
    const deps = {
      ...testDeps(),
      newId: () => {
        throw new Error('no ids');
      },
    };
    const store = await open(deps);
    expect((await store.create(aWidget)).ok).toBe(false);
    store.close();
  });

  it('passes on open errors', async () => {
    const factory = {
      open: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as IDBFactory;
    expect(await openStore(widget, testDeps(factory))).toEqual({ ok: false, error: { code: 'unavailable', message: expect.any(String) } });
  });

  // fake-indexeddb reads Date.now internally, so the clock is checked by the source scan below.
  it('never reads the clock, random numbers or random ids itself', async () => {
    const random = vi.spyOn(Math, 'random');
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const store = await open();
    const a = must(await store.create(aWidget));
    must(await store.update(a.id, aWidget));
    must(await store.list());
    must(await store.remove(a.id));
    store.close();
    expect(random).not.toHaveBeenCalled();
    expect(uuid).not.toHaveBeenCalled();

    const dir = fileURLToPath(new URL('.', import.meta.url));
    const edges = /Date\.now\s*\(|new\s+Date\s*\(|Math\.random|randomUUID/;
    const hits = readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .filter((f) => edges.test(readFileSync(join(dir, f), 'utf8')));
    expect(hits).toEqual([]);
  });
});

describe('namespace isolation', () => {
  it('keeps two apps on one origin apart', async () => {
    const factory = new IDBFactory();
    const widgets = await open(testDeps(factory), widget);
    const gizmos = await open(testDeps(factory), gizmo);
    const w = must(await widgets.create(aWidget));
    const g = must(await gizmos.create(aGizmo));
    expect(w.id).toBe(g.id);

    expect(await widgets.list()).toEqual({ ok: true, value: [w] });
    expect(await gizmos.list()).toEqual({ ok: true, value: [g] });
    must(await gizmos.remove(g.id));
    expect(await widgets.get(w.id)).toEqual({ ok: true, value: w });

    const names = (await factory.databases()).map((d) => d.name).sort();
    expect(names).toEqual(['ossuary:gizmo-keeper', 'ossuary:widget-tracker']);
    widgets.close();
    gizmos.close();
  });

  it('validates writes against its own spec', async () => {
    const factory = new IDBFactory();
    const widgets = await open(testDeps(factory), widget);
    expect((await widgets.create(aGizmo)).ok).toBe(false);
    widgets.close();
  });
});
