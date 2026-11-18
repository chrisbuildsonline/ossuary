// The bone spec, parsed from bone.json, and the local wall clock as the engine's `now`.
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

/** The local wall clock as the engine's `now`. */
export function nowFromClock(d: Date): Now {
  return {
    day: formatIsoDay({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }),
    minuteOfDay: d.getHours() * 60 + d.getMinutes(),
  };
}
