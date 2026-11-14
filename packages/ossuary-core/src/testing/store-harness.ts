// Test helpers for the store: a fresh in-memory IndexedDB per call, a counting id generator and a ticking clock.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { type BoneSpec, parseBoneSpec } from '../schema/bone-spec';
import { gizmoSpec, widgetSpec } from './fixtures';

export interface TestDeps {
  newId(): string;
  nowIso(): string;
  indexedDB: IDBFactory;
}

/** Ids `id-1`, `id-2`, ... and times one second apart from 2026-11-14T09:00:00.000Z. */
export function testDeps(factory: IDBFactory = new IDBFactory()): TestDeps {
  let ids = 0;
  let ticks = 0;
  const start = Date.UTC(2026, 10, 14, 9, 0, 0);
  return {
    newId: () => `id-${++ids}`,
    nowIso: () => new Date(start + 1000 * ticks++).toISOString(),
    indexedDB: factory,
  };
}

function parsed(input: unknown): BoneSpec {
  const r = parseBoneSpec(input);
  if (!r.ok) throw new Error(`fixture invalid: ${JSON.stringify(r.error)}`);
  return r.value;
}

export const widget = parsed(widgetSpec);
export const gizmo = parsed(gizmoSpec);

export const aWidget = { name: 'Blue widget', place: 'cold', made: '2026-11-09' };
export const aGizmo = { name: 'Gizmo one', bought: '2026-10-01', plan: 'plus' };

/** Unwraps an ok result in a test, failing loudly otherwise. */
export function must<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}
