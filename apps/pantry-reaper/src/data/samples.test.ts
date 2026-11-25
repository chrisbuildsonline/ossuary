import { evaluate, validateItem } from '@ossuary/core';
import { describe, expect, it } from 'vitest';
import { specForFood } from '../spec';
import { foods } from './foods';
import { samples } from './samples';

const today = '2026-11-25';
const tones = () =>
  samples(today).map((values) => {
    const food = foods.find((f) => f.id === values.food_id);
    if (!food) throw new Error(`no food ${String(values.food_id)}`);
    const spec = specForFood(food);
    expect(validateItem(spec, values).ok, String(values.name)).toBe(true);
    const r = evaluate(spec, values, { day: today });
    if (!r.ok) throw new Error(`cannot evaluate ${String(values.name)}`);
    return r.value.lifespans[r.value.primaryIndex]?.stage.tone;
  });

describe('first-visit samples', () => {
  it('are real FoodKeeper foods that fit the spec', () => {
    expect(tones()).toHaveLength(8);
  });

  it('open the crypt with living, dying and dead food on any day', () => {
    for (const day of [today, '2027-02-28', '2028-02-29']) {
      const t = samples(day).length && tones();
      expect(t).toContain('fresh');
      expect(t).toContain('soon');
      expect(t).toContain('urgent');
      expect(t).toContain('dead');
    }
  });

  it('date every sample relative to today', () => {
    expect(samples('2026-11-25').find((s) => s.name === 'Chicken thighs')?.bought).toBe('2026-11-24');
    expect(samples('2027-01-01').find((s) => s.name === 'Chicken thighs')?.bought).toBe('2026-12-31');
  });
});
