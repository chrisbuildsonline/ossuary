// Text taken from a spec and an item's values: the title and the short summary line.
import type { Now } from '../engine/evaluate';
import type { BoneSpec } from '../schema/bone-spec';
import type { Item } from '../schema/item';
import { shortDay } from './countdown';

/** The display text of one field value: an enum's option label, a short date, or the value itself. */
export function fieldText(spec: BoneSpec, key: string, value: Item[string], now?: Now): string {
  if (value === undefined || value === '') return '';
  const field = spec.entity.fields.find((f) => f.key === key);
  if (field?.kind === 'enum') return field.options.find((o) => o.value === value)?.label ?? String(value);
  if (field?.kind === 'date' && typeof value === 'string') return shortDay(value, now);
  return String(value);
}

export const titleOf = (spec: BoneSpec, values: Item): string => fieldText(spec, spec.entity.titleField, values[spec.entity.titleField]) || 'Untitled';

/** "Cold · Opened" from the spec's summary fields, skipping empty ones. */
export const shortLine = (spec: BoneSpec, values: Item, now?: Now): string =>
  (spec.entity.summaryFields ?? [])
    .map((key) => fieldText(spec, key, values[key], now))
    .filter(Boolean)
    .join(' · ');
