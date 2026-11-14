import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { must, testDeps } from '../testing/store-harness';
import { DB_VERSION, dbName, openDb } from './db';

afterEach(() => {
  vi.unstubAllGlobals();
});

function rawOpen(factory: IDBFactory, name: string, version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function rawGet<T>(db: IDBDatabase, store: string, key: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

describe('openDb', () => {
  it('names the database ossuary:<appId>', () => {
    expect(dbName('widget-tracker')).toBe('ossuary:widget-tracker');
    expect(DB_VERSION).toBe(1);
  });

  it('creates version 1 with an items store keyed by id and a meta store', async () => {
    const deps = testDeps();
    const db = must(await openDb('widget-tracker', deps));
    db.close();

    expect(await deps.indexedDB.databases()).toEqual([{ name: 'ossuary:widget-tracker', version: 1 }]);
    const raw = await rawOpen(deps.indexedDB, 'ossuary:widget-tracker');
    expect([...raw.objectStoreNames].sort()).toEqual(['items', 'meta']);
    expect(raw.transaction('items').objectStore('items').keyPath).toBe('id');
    expect(await rawGet(raw, 'meta', 'schema')).toEqual({ appId: 'widget-tracker', createdAt: '2026-11-14T09:00:00.000Z' });
    raw.close();
  });

  it('writes meta only once, on creation', async () => {
    const deps = testDeps();
    must(await openDb('widget-tracker', deps)).close();
    must(await openDb('widget-tracker', deps)).close();
    const raw = await rawOpen(deps.indexedDB, 'ossuary:widget-tracker');
    expect(await rawGet(raw, 'meta', 'schema')).toEqual({ appId: 'widget-tracker', createdAt: '2026-11-14T09:00:00.000Z' });
    raw.close();
  });

  it('returns unavailable when there is no IndexedDB at all', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const { indexedDB: _, ...deps } = testDeps();
    const r = await openDb('widget-tracker', deps);
    expect(r).toEqual({ ok: false, error: { code: 'unavailable', message: expect.any(String) } });
  });

  it('returns unavailable when opening throws a SecurityError', async () => {
    const factory = {
      open: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as IDBFactory;
    const r = await openDb('widget-tracker', testDeps(factory));
    expect(r.ok === false && r.error.code).toBe('unavailable');
  });

  it('returns blocked when the open request is blocked', async () => {
    const request = new EventTarget();
    const factory = {
      open: () => {
        queueMicrotask(() => request.dispatchEvent(new Event('blocked')));
        return request;
      },
    } as unknown as IDBFactory;
    const r = await openDb('widget-tracker', testDeps(factory));
    expect(r).toEqual({ ok: false, error: { code: 'blocked', message: expect.stringMatching(/other tab/i) } });
  });

  it('returns unavailable when the saved data is from a newer version', async () => {
    const deps = testDeps();
    (await rawOpen(deps.indexedDB, 'ossuary:widget-tracker', 5)).close();
    const r = await openDb('widget-tracker', deps);
    expect(r).toEqual({ ok: false, error: { code: 'unavailable', message: expect.stringMatching(/newer version/) } });
  });

  it('closes itself when another connection upgrades, so it never blocks it', async () => {
    const deps = testDeps();
    const db = must(await openDb('widget-tracker', deps));
    const newer = await rawOpen(deps.indexedDB, 'ossuary:widget-tracker', 2);
    expect(newer.version).toBe(2);
    newer.close();
    db.close();
  });
});
