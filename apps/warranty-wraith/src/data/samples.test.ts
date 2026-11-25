import { evaluate, validateItem } from '@ossuary/core';
import { describe, expect, it } from 'vitest';
import { boneSpec } from '../spec';
import type { Recall } from './cpsc';
import { matchRecalls } from './match';
import recallsJson from './recalls.json';
import { samples } from './samples';

const recalls = recallsJson as Recall[];
const today = '2026-11-25';

describe('first-visit samples', () => {
  it('fit the spec and open with a closing, a dying, a covered and a lapsed purchase', () => {
    for (const day of [today, '2027-02-28', '2028-02-29']) {
      const tones = samples(day).map((values) => {
        expect(validateItem(boneSpec, values).ok, String(values.name)).toBe(true);
        const r = evaluate(boneSpec, values, { day });
        if (!r.ok) throw new Error(`cannot evaluate ${String(values.name)}`);
        return r.value.lifespans[r.value.primaryIndex]?.stage.tone;
      });
      expect(tones).toContain('urgent');
      expect(tones).toContain('soon');
      expect(tones).toContain('fresh');
      expect(tones).toContain('dead');
    }
  });

  it('include exactly one purchase that matches a recall in the snapshot', () => {
    const hits = samples(today).filter((s) => matchRecalls({ name: String(s.name), model: s.model ? String(s.model) : undefined }, recalls).length > 0);
    expect(hits.map((s) => s.name)).toEqual(['Harkla sensory swing']);
  });
});
