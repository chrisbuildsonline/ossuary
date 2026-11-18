import { evaluate } from '@ossuary/core/engine';
import { type Item, parseBoneSpec } from '@ossuary/core/schema';
import { describe, expect, it } from 'vitest';
import bone from '../bone.json';
import { boneSpec, nowFromClock } from './spec';

const DAY = '2026-11-18';

/** One value for every field, so the sample fits any spec. */
function sample(): Item {
  const values: Item = {};
  for (const f of boneSpec.entity.fields) {
    if (f.kind === 'date') values[f.key] = DAY;
    else if (f.kind === 'number') values[f.key] = f.min ?? Math.min(0, f.max ?? 0);
    else if (f.kind === 'enum') values[f.key] = f.options[0]?.value;
    else values[f.key] = 'Sample';
  }
  return values;
}

describe('bone.json', () => {
  it('parses as a bone spec', () => {
    expect(parseBoneSpec(bone).ok).toBe(true);
    expect(boneSpec.id).toBe(bone.id);
  });

  it('evaluates a sample item started today, with one result per lifespan', () => {
    const r = evaluate(boneSpec, sample(), { day: DAY });
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.value.lifespans.map((l) => l.lifespanId)).toEqual(boneSpec.lifespans.map((l) => l.id));
    for (const l of r.value.lifespans) expect(l.remaining.days).toBeGreaterThanOrEqual(0);
  });
});

describe('nowFromClock', () => {
  it('reads the local day and minute of the day', () => {
    expect(nowFromClock(new Date(2026, 10, 18, 9, 30))).toEqual({ day: '2026-11-18', minuteOfDay: 570 });
    expect(nowFromClock(new Date(2026, 0, 1, 0, 0))).toEqual({ day: '2026-01-01', minuteOfDay: 0 });
    expect(nowFromClock(new Date(2026, 11, 31, 23, 59, 59))).toEqual({ day: '2026-12-31', minuteOfDay: 1439 });
  });
});
