import type { BoneSpec } from '../schema/bone-spec';
import { type Item, validateItem } from '../schema/item';
import { type Backup, type ImportMode, type ImportSummary, exportBackup, importBackup } from './backup';
import { type Db, type StoreDeps, type StoredItem, compact, inTx, openDb } from './db';
import { type StoreResult, fail, invalid, toStoreError } from './errors';

export interface Store {
  create(values: unknown): Promise<StoreResult<StoredItem>>;
  get(id: string): Promise<StoreResult<StoredItem>>;
  list(): Promise<StoreResult<StoredItem[]>>;
  update(id: string, values: unknown): Promise<StoreResult<StoredItem>>;
  remove(id: string): Promise<StoreResult<void>>;
  exportBackup(): Promise<StoreResult<Backup>>;
  importBackup(text: string, mode: ImportMode): Promise<StoreResult<ImportSummary>>;
  close(): void;
}

const ok = <T>(value: T): StoreResult<T> => ({ ok: true, value });
const notFound = <T>(id: string): StoreResult<T> => fail({ code: 'not_found', id });

/** Validates values against the spec's fields; the stored form keeps spec fields only. */
export function checkValues(spec: BoneSpec, values: unknown): StoreResult<Item> {
  const r = validateItem(spec, values);
  return r.ok ? ok(compact(r.value)) : invalid(r.error);
}

/** Turns any throw from an injected edge or IndexedDB into a returned error. */
const guarded =
  <A extends unknown[], T>(f: (...args: A) => Promise<StoreResult<T>>) =>
  async (...args: A): Promise<StoreResult<T>> => {
    try {
      return await f(...args);
    } catch (e) {
      return fail(toStoreError(e));
    }
  };

function itemStore(spec: BoneSpec, db: Db, deps: StoreDeps): Store {
  return {
    create: guarded(async (values: unknown) => {
      const checked = checkValues(spec, values);
      if (!checked.ok) return checked;
      const now = deps.nowIso();
      const item: StoredItem = { id: deps.newId(), values: checked.value, createdAt: now, updatedAt: now };
      return inTx(db, 'readwrite', async (s) => {
        await s.add(item);
        return ok(item);
      });
    }),
    get: guarded((id: string) =>
      inTx(db, 'readonly', async (s) => {
        const item = await s.get(id);
        return item ? ok(item) : notFound(id);
      }),
    ),
    list: guarded(() => inTx(db, 'readonly', async (s) => ok(await s.getAll()))),
    update: guarded(async (id: string, values: unknown) => {
      const checked = checkValues(spec, values);
      if (!checked.ok) return checked;
      const now = deps.nowIso();
      return inTx(db, 'readwrite', async (s) => {
        const existing = await s.get(id);
        if (!existing) return notFound(id);
        const item: StoredItem = { ...existing, values: checked.value, updatedAt: now };
        await s.put(item);
        return ok(item);
      });
    }),
    remove: guarded((id: string) =>
      inTx(db, 'readwrite', async (s) => {
        if ((await s.count(id)) === 0) return notFound(id);
        await s.delete(id);
        return ok(undefined);
      }),
    ),
    exportBackup: guarded(() => exportBackup(db, spec, deps)),
    importBackup: guarded((text: string, mode: ImportMode) => importBackup(db, spec, text, mode)),
    close: () => {
      try {
        db.close();
      } catch {
        // Closing twice is harmless.
      }
    },
  };
}

/** Opens the store for one app (`ossuary:<spec.id>`). Never throws. */
export async function openStore(spec: BoneSpec, deps: StoreDeps): Promise<StoreResult<Store>> {
  const db = await openDb(spec.id, deps);
  return db.ok ? ok(itemStore(spec, db.value, deps)) : db;
}
