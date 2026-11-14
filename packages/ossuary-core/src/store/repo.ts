import type { BoneSpec } from '../schema/bone-spec';
import { type Issue, MAX_ISSUES, type Result } from '../schema/issues';
import { type Item, validateItem } from '../schema/item';
import { type Backup, type ImportMode, type ImportSummary, exportBackup, importBackup } from './backup';
import { type Db, type StoreDeps, type StoredItem, compact, inTx, openDb } from './db';
import { type StoreResult, fail, invalid, toStoreError } from './errors';

export interface Store {
  create(values: unknown): Promise<StoreResult<StoredItem>>;
  /** Creates every item in one transaction, or none if any is invalid. Issue paths start with `items[i]`. */
  createMany(values: unknown[]): Promise<StoreResult<ImportSummary>>;
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
function checkValues(spec: BoneSpec, values: unknown): Result<Item> {
  const r = validateItem(spec, values);
  return r.ok ? { ok: true, value: compact(r.value) } : r;
}

const under = (prefix: string, path: string) => (path === '' ? prefix : path.startsWith('[') ? `${prefix}${path}` : `${prefix}.${path}`);

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
      if (!checked.ok) return invalid(checked.error);
      const now = deps.nowIso();
      const item: StoredItem = { id: deps.newId(), values: checked.value, createdAt: now, updatedAt: now };
      return inTx(db, 'readwrite', async (s) => {
        await s.add(item);
        return ok(item);
      });
    }),
    createMany: guarded(async (list: unknown[]) => {
      if (!Array.isArray(list)) return invalid([{ path: '', message: 'Expected a list of items.' }]);
      const issues: Issue[] = [];
      const values: Item[] = [];
      list.forEach((v, i) => {
        const checked = checkValues(spec, v);
        if (checked.ok) values.push(checked.value);
        else issues.push(...checked.error.map((issue) => ({ ...issue, path: under(`items[${i}]`, issue.path) })));
      });
      if (issues.length > 0) return invalid(issues.slice(0, MAX_ISSUES));
      const now = deps.nowIso();
      const items = values.map((v): StoredItem => ({ id: deps.newId(), values: v, createdAt: now, updatedAt: now }));
      return inTx(db, 'readwrite', async (s) => {
        for (const item of items) await s.add(item);
        return ok({ added: items.length, updated: 0, removed: 0 });
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
      if (!checked.ok) return invalid(checked.error);
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
