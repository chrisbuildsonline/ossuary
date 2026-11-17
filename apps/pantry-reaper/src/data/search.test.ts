import { describe, expect, it } from 'vitest';
import type { Food } from './foodkeeper';
import { SEARCH_LIMIT, searchFoods } from './search';

const food = (name: string, i = 0): Food => ({ id: String(i), name, days: { fridge: 1 } });
const names = (foods: Food[], q: string) => searchFoods(foods, q).map((f) => f.name);

const sample = ['Yogurt', 'Frozen yogurt', 'Greek yogurt', 'Crème fraîche', 'Chicken, whole', 'Rotisserie chicken', 'Ground turkey or chicken'].map(food);

describe('searchFoods', () => {
  it('ignores case', () => {
    expect(names(sample, 'YOGURT')).toEqual(names(sample, 'yogurt'));
    expect(names(sample, 'yOgUrT')).toContain('Yogurt');
  });

  it('ignores accents in the name and the query', () => {
    expect(names(sample, 'creme fraiche')).toEqual(['Crème fraîche']);
    expect(names([food('Cafe latte')], 'café')).toEqual(['Cafe latte']);
  });

  it('ranks names that start with the query before names that contain it, then alphabetically', () => {
    expect(names(sample, 'yogurt')).toEqual(['Yogurt', 'Frozen yogurt', 'Greek yogurt']);
    expect(names(sample, 'chicken')).toEqual(['Chicken, whole', 'Ground turkey or chicken', 'Rotisserie chicken']);
  });

  it('returns at most 8 foods', () => {
    const many = Array.from({ length: 20 }, (_, i) => food(`Bread ${String(i).padStart(2, '0')}`, i));
    expect(SEARCH_LIMIT).toBe(8);
    expect(searchFoods(many, 'bread')).toHaveLength(8);
    expect(names(many, 'bread')[0]).toBe('Bread 00');
  });

  it('returns nothing for an empty or blank query, and nothing when nothing matches', () => {
    expect(searchFoods(sample, '')).toEqual([]);
    expect(searchFoods(sample, '   ')).toEqual([]);
    expect(searchFoods(sample, 'zzz')).toEqual([]);
  });

  it('trims the query and does not change the input list', () => {
    const before = [...sample];
    expect(names(sample, '  yogurt ')).toEqual(['Yogurt', 'Frozen yogurt', 'Greek yogurt']);
    expect(sample).toEqual(before);
  });
});
