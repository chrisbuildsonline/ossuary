// IndexedDB layout: one database per app, `ossuary:<appId>` version 1, with an `items` store keyed by `id`
// and a `meta` store holding `{ appId, createdAt }` under the key `schema`.
import { type DBSchema, type IDBPDatabase, type IDBPObjectStore, type IDBPTransaction, wrap } from 'idb';
import type { Item } from '../schema/item';
import { type StoreResult, fail, messages, toStoreError } from './errors';

export const DB_VERSION = 1;

export const dbName = (appId: string): string => `ossuary:${appId}`;

export interface StoredItem {
  id: string;
  values: Item;
  createdAt: string;
  updatedAt: string;
}

/** Edges the store must not read itself: ids, the clock and (optionally) the IndexedDB factory. */
export interface StoreDeps {
  newId(): string;
  nowIso(): string;
  indexedDB?: IDBFactory;
}

export interface OssuaryDb extends DBSchema {
  items: { key: string; value: StoredItem };
  meta: { key: string; value: { appId: string; createdAt: string } };
}

export type Db = IDBPDatabase<OssuaryDb>;
type Mode = 'readonly' | 'readwrite';
export type ItemStore<M extends Mode> = IDBPObjectStore<OssuaryDb, ['items'], 'items', M>;

/** Opens (creating on first use) the app's database. Never throws. */
export function openDb(appId: string, deps: StoreDeps): Promise<StoreResult<Db>> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (r: StoreResult<Db>) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    try {
      const factory = deps.indexedDB ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      if (!factory) return settle(fail({ code: 'unavailable', message: messages.unavailable }));
      const request = factory.open(dbName(appId), DB_VERSION);
      request.addEventListener('upgradeneeded', () => {
        try {
          const raw = request.result;
          if (!raw.objectStoreNames.contains('items')) raw.createObjectStore('items', { keyPath: 'id' });
          if (!raw.objectStoreNames.contains('meta')) {
            raw.createObjectStore('meta').put({ appId, createdAt: deps.nowIso() }, 'schema');
          }
        } catch (e) {
          settle(fail(toStoreError(e)));
          request.transaction?.abort();
        }
      });
      request.addEventListener('success', () => {
        const raw = request.result;
        if (settled) return raw.close();
        // Step aside when another tab upgrades, so this connection never blocks it.
        raw.addEventListener('versionchange', () => raw.close());
        settle({ ok: true, value: wrap(raw) as unknown as Db });
      });
      request.addEventListener('error', (event) => {
        event.preventDefault();
        settle(fail(toStoreError(request.error)));
      });
      request.addEventListener('blocked', () => settle(fail({ code: 'blocked', message: messages.blocked })));
    } catch (e) {
      settle(fail(toStoreError(e)));
    }
  });
}

function abort(tx: IDBPTransaction<OssuaryDb, ['items'], Mode>): void {
  try {
    tx.abort();
  } catch {
    // Already finished or aborting.
  }
}

/**
 * Runs `work` in one transaction on `items`. If `work` returns an error or anything fails,
 * the transaction is aborted, so nothing it wrote is kept. `work` must await only IndexedDB requests.
 */
export async function inTx<T, M extends Mode>(
  db: Db,
  mode: M,
  work: (store: ItemStore<M>) => Promise<StoreResult<T>>,
): Promise<StoreResult<T>> {
  let tx: IDBPTransaction<OssuaryDb, ['items'], M>;
  try {
    tx = db.transaction('items', mode);
  } catch (e) {
    return fail(toStoreError(e));
  }
  const done = tx.done;
  done.catch(() => undefined);
  try {
    const r = await work(tx.store);
    if (!r.ok) {
      abort(tx);
      return r;
    }
    await done;
    return r;
  } catch (e) {
    abort(tx);
    return fail(toStoreError(e));
  }
}
