import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapFoodKeeper } from './foodkeeper';
import { foods } from './foods';
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

  it.each(['soy milk', 'almond milk'])('finds "%s" by search with an after-opening fridge time', (word) => {
    const hit = searchFoods(foods, word).find((f) => f.name.toLowerCase() === word);
    expect(hit?.days.fridge).toBe(7);
    expect(hit).toMatchObject({ afterOpening: true });
  });

  it('finds sour cream foods by search', () => {
    // Plain "Sour cream" (row ID 29) has no time at all in the snapshot, not even after opening,
    // so the sour-cream-based dip is what search can offer.
    expect(searchFoods(foods, 'sour cream').map((f) => f.name)).toContain('Dips, sour cream based');
    expect(mapFoodKeeper(raw).skipped.some((s) => s.reason.includes('"Sour cream"'))).toBe(true);
  });

  it('only flags foods whose fridge time came from the after-opening column', () => {
    const flagged = foods.filter((f) => 'afterOpening' in f);
    expect(flagged.length).toBeGreaterThan(5);
    for (const f of flagged) expect(f.days.fridge).toBeGreaterThan(0);
  });
});
