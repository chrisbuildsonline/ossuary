import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapFoodKeeper } from './foodkeeper';
import foods from './foods.json';
import { searchFoods } from './search';

const raw: unknown = JSON.parse(readFileSync(new URL('../../data/foodkeeper.raw.json', import.meta.url), 'utf8'));

describe('foods.json', () => {
  it('equals mapFoodKeeper applied to the committed snapshot (run `bun run data:pantry` to update)', () => {
    expect(foods).toEqual(mapFoodKeeper(raw).foods);
  });

  it('gives every food a name and at least one storage method in whole days', () => {
    expect(foods.length).toBeGreaterThan(500);
    for (const food of foods) {
      expect(food.name).not.toBe('');
      const days = Object.values(food.days);
      expect(days.length).toBeGreaterThan(0);
      for (const d of days) expect(Number.isInteger(d) && d > 0).toBe(true);
    }
  });

  it('has unique ids', () => {
    expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length);
  });

  it.each(['yogurt', 'chicken', 'spinach', 'bread'])('finds real foods for "%s" by search', (word) => {
    const hits = searchFoods(foods, word);
    expect(hits.length).toBeGreaterThan(0);
    for (const f of hits) expect(f.name.toLowerCase()).toContain(word);
  });

  it('keeps plain yogurt in the fridge and the freezer', () => {
    expect(foods.find((f) => f.name === 'Yogurt')?.days).toEqual({ fridge: 7, freezer: 30 });
  });
});
