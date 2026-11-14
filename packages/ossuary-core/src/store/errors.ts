import type { Issue, Result } from '../schema/issues';

export type StoreError =
  | { code: 'not_found'; id: string }
  | { code: 'invalid'; issues: Issue[] }
  | { code: 'unavailable' | 'blocked' | 'quota'; message: string }
  | { code: 'too_large'; message: string };

export type StoreResult<T> = Result<T, StoreError>;

export const messages = {
  unavailable: 'Storage is not available in this browser, so items cannot be saved. Try again.',
  newer: 'Your saved items come from a newer version of this app. Reload the page to update it.',
  blocked: 'Another tab is updating your saved items. Close other tabs of this app and try again.',
  quota: 'Storage is full. Export a backup, then remove items you no longer need.',
} as const;

const codes = new Set(['not_found', 'invalid', 'unavailable', 'blocked', 'quota', 'too_large']);

export const fail = <T>(error: StoreError): StoreResult<T> => ({ ok: false, error });
export const invalid = <T>(issues: Issue[]): StoreResult<T> => fail({ code: 'invalid', issues });

function isStoreError(e: unknown): e is StoreError {
  return typeof e === 'object' && e !== null && codes.has(String((e as { code?: unknown }).code));
}

/** Maps anything IndexedDB or idb can throw or reject with to a store error. Never throws. */
export function toStoreError(e: unknown): StoreError {
  if (isStoreError(e)) return e;
  const name = typeof e === 'object' && e !== null ? (e as { name?: unknown }).name : undefined;
  switch (name) {
    case 'QuotaExceededError':
      return { code: 'quota', message: messages.quota };
    case 'ConstraintError':
      return { code: 'invalid', issues: [{ path: 'id', message: 'An item with this id already exists.' }] };
    case 'VersionError':
      return { code: 'unavailable', message: messages.newer };
    default:
      return { code: 'unavailable', message: messages.unavailable };
  }
}
