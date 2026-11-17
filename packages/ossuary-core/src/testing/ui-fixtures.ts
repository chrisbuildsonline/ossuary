// Parsed neutral specs and evaluated entries for UI tests. Test support only.
import { evaluate } from '../engine/evaluate';
import type { Evaluation, Now } from '../engine/evaluate';
import { type BoneSpec, parseBoneSpec } from '../schema/bone-spec';
import type { Item } from '../schema/item';
import { gizmoSpec, widgetSpec } from './fixtures';

export const now: Now = { day: '2026-11-14' };

function parsed(input: unknown): BoneSpec {
  const r = parseBoneSpec(input);
  if (!r.ok) throw new Error(`Fixture spec is invalid: ${JSON.stringify(r.error)}`);
  return r.value;
}

export const widget = parsed(widgetSpec);
export const gizmo = parsed(gizmoSpec);

export interface Entry {
  id: string;
  values: Item;
  evaluation: Evaluation;
}

export function entry(spec: BoneSpec, id: string, values: Item, at: Now = now): Entry {
  const r = evaluate(spec, values, at);
  if (!r.ok) throw new Error(`Fixture item is invalid: ${JSON.stringify(r.error)}`);
  return { id, values, evaluation: r.value };
}

/** Widgets in four tones at 2026-11-14: soon (4 days), urgent (1 day), fresh (6 months) and dead (11 days ago). */
export const widgets = (): Entry[] => [
  entry(widget, 'w1', { name: 'Blue widget', place: 'cold', made: '2026-11-04', opened: 'no' }),
  entry(widget, 'w2', { name: 'Red widget', place: 'cold', made: '2026-11-01' }),
  entry(widget, 'w3', { name: 'Green widget', place: 'shelf', made: '2026-06-01' }),
  entry(widget, 'w4', { name: 'Old widget', place: 'cold', made: '2026-10-20' }),
];

/** A gizmo whose return window (2 days, urgent) is primary and whose cover runs 23 more months. */
export const gizmoEntry = (): Entry => entry(gizmo, 'g1', { name: 'Desk gizmo', maker: 'Acme', bought: '2026-10-17' });
