// First visit: an app's sample items are added once to an empty store, so the decay shows on first load.
import type { Store } from '../store/repo';

type VisitStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const firstVisitKey = (specId: string): string => `ossuary:${specId}:visited`;

export interface FirstVisit {
  specId: string;
  store: Pick<Store, 'list' | 'create'>;
  samples: readonly unknown[];
  storage?: VisitStorage;
}

/** Returns the ids of the samples it added: none unless this is the first visit and the store is empty. */
export async function seedFirstVisit({ specId, store, samples, storage = globalThis.localStorage }: FirstVisit): Promise<string[]> {
  if (samples.length === 0) return [];
  const key = firstVisitKey(specId);
  try {
    if (storage.getItem(key) !== null) return [];
    storage.setItem(key, '1');
  } catch {
    // Without storage the visit cannot be remembered, so samples would come back every time: add none.
    return [];
  }
  const existing = await store.list();
  if (!existing.ok || existing.value.length > 0) return [];
  const ids: string[] = [];
  for (const values of samples) {
    const r = await store.create(values);
    if (r.ok) ids.push(r.value.id);
  }
  return ids;
}
