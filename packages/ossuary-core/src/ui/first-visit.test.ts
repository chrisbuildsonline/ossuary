import { describe, expect, it } from 'vitest';
import { openStore } from '../store/repo';
import { aWidget, must, testDeps, widget } from '../testing/store-harness';
import { firstVisitKey, seedFirstVisit } from './first-visit';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};
const samples = [aWidget, { ...aWidget, name: 'Red widget', made: '2026-10-01' }];
const fresh = async () => must(await openStore(widget, testDeps()));

describe('seedFirstVisit', () => {
  it('adds the samples once, on the first visit to an empty store', async () => {
    const store = await fresh();
    const storage = memory();
    const ids = await seedFirstVisit({ specId: widget.id, store, samples, storage });
    expect(ids).toHaveLength(2);
    expect(must(await store.list()).map((i) => i.values.name).sort()).toEqual(['Blue widget', 'Red widget']);
    expect(storage.data.get(firstVisitKey(widget.id))).toBe('1');
    expect(await seedFirstVisit({ specId: widget.id, store, samples, storage })).toEqual([]);
    expect(must(await store.list())).toHaveLength(2);
  });

  it('never adds samples to a store that already has items, and remembers the visit', async () => {
    const store = await fresh();
    must(await store.create(aWidget));
    const storage = memory();
    expect(await seedFirstVisit({ specId: widget.id, store, samples, storage })).toEqual([]);
    expect(must(await store.list())).toHaveLength(1);
    expect(storage.data.get(firstVisitKey(widget.id))).toBe('1');
  });

  it('does not re-seed a store the user emptied', async () => {
    const store = await fresh();
    const storage = memory();
    const ids = await seedFirstVisit({ specId: widget.id, store, samples, storage });
    for (const id of ids) must(await store.remove(id));
    expect(await seedFirstVisit({ specId: widget.id, store, samples, storage })).toEqual([]);
    expect(must(await store.list())).toEqual([]);
  });

  it('does nothing without samples, and leaves the visit unmarked', async () => {
    const store = await fresh();
    const storage = memory();
    expect(await seedFirstVisit({ specId: widget.id, store, samples: [], storage })).toEqual([]);
    expect(storage.data.size).toBe(0);
  });

  it('skips a sample that does not fit the spec and keeps the rest', async () => {
    const store = await fresh();
    const ids = await seedFirstVisit({ specId: widget.id, store, samples: [{ name: '' }, aWidget], storage: memory() });
    expect(ids).toHaveLength(1);
  });

  it('adds nothing when storage is unavailable, so samples never repeat', async () => {
    const store = await fresh();
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(await seedFirstVisit({ specId: widget.id, store, samples, storage: broken })).toEqual([]);
    expect(must(await store.list())).toEqual([]);
  });
});
