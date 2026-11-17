// The bone spec, the per-food spec derived from it, and the one place the app reads the clock.
import { type Now, formatIsoDay } from '@ossuary/core/engine';
import { type BoneSpec, parseBoneSpec } from '@ossuary/core/schema';
import bone from '../bone.json';
import type { Food } from './data/foodkeeper';

const STORAGE_FIELD = 'storage';
const STORAGE_RULE = 'storage_life';

function parse(input: unknown, what: string): BoneSpec {
  const r = parseBoneSpec(input);
  if (!r.ok) throw new Error(`${what} is not a valid bone spec: ${r.error.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  return r.value;
}

/** bone.json, parsed. Throws at module load if it is invalid. */
export const boneSpec: BoneSpec = parse(bone, 'bone.json');

const byFood = new Map<string, BoneSpec>();

/**
 * bone.json with the storage lookup table set to this food's shelf life in days and the storage
 * options cut to the methods the food has. Nothing else differs. Cached by food id; never mutate the result.
 * Throws if the derived spec is invalid (a food with no storage method).
 */
export function specForFood(food: Food): BoneSpec {
  const cached = byFood.get(food.id);
  if (cached) return cached;
  const spec = structuredClone(boneSpec);
  const days = new Map(Object.entries(food.days));
  for (const field of spec.entity.fields) {
    if (field.key === STORAGE_FIELD && field.kind === 'enum') field.options = field.options.filter((o) => days.has(o.value));
  }
  for (const rule of spec.lifespans.flatMap((l) => l.rules ?? [])) {
    if (rule.id === STORAGE_RULE && rule.kind === 'lookup') {
      rule.table = Object.fromEntries([...days].map(([method, amount]) => [method, { amount, unit: 'day' as const }]));
    }
  }
  const parsed = parse(spec, `The spec for "${food.name}"`);
  byFood.set(food.id, parsed);
  return parsed;
}

/** The local wall clock as the engine's `now`. */
export function nowFromClock(d: Date): Now {
  return {
    day: formatIsoDay({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }),
    minuteOfDay: d.getHours() * 60 + d.getMinutes(),
  };
}
