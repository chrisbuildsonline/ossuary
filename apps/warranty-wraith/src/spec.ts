// The bone spec, the add-sheet defaults read from it, and the one place the app reads the clock.
import { type Now, formatIsoDay } from '@ossuary/core/engine';
import { type BoneSpec, parseBoneSpec } from '@ossuary/core/schema';
import bone from '../bone.json';

function parse(input: unknown): BoneSpec {
  const r = parseBoneSpec(input);
  if (!r.ok) throw new Error(`bone.json is not a valid bone spec: ${r.error.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  return r.value;
}

/** bone.json, parsed. Throws at module load if it is invalid. */
export const boneSpec: BoneSpec = parse(bone);

function baseAmount(lifespanId: string): number {
  const base = boneSpec.lifespans.find((l) => l.id === lifespanId)?.base;
  if (base?.type !== 'duration') throw new Error(`bone.json has no duration lifespan "${lifespanId}"`);
  return base.amount;
}

/** The add sheet's prefill: each lifespan's base amount, so the numbers live in bone.json only. */
export const defaults: { returnDays: number; warrantyMonths: number } = {
  returnDays: baseAmount('return_window'),
  warrantyMonths: baseAmount('warranty'),
};

/** The local wall clock as the engine's `now`. */
export function nowFromClock(d: Date): Now {
  return {
    day: formatIsoDay({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }),
    minuteOfDay: d.getHours() * 60 + d.getMinutes(),
  };
}
