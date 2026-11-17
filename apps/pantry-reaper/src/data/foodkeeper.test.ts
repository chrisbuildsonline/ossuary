import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mapFoodKeeper } from './foodkeeper';

type Cells = Record<string, string | number | null>;

/** A Product row in the real snapshot shape: an array of one-key objects. */
const row = (cells: Cells) => Object.entries(cells).map(([k, v]) => ({ [k]: v }));
const raw = (...rows: Cells[]) => ({
  fileName: 'fixture.xlsx',
  sheets: [
    { name: 'Category', data: [row({ ID: 1, Category_Name: 'Dairy' })] },
    { name: 'Product', data: rows.map(row) },
  ],
});
const product = (cells: Cells): Cells => ({ ID: 1, Category_ID: 1, Name: 'Thing', Name_subtitle: null, ...cells });
const daysOf = (cells: Cells) => mapFoodKeeper(raw(product(cells))).foods[0]?.days;

describe('mapFoodKeeper', () => {
  it('converts days, weeks, months and years to whole days', () => {
    expect(daysOf({ Pantry_Min: 3, Pantry_Max: 5, Pantry_Metric: 'Days' })).toEqual({ pantry: 3 });
    expect(daysOf({ Refrigerate_Min: 2, Refrigerate_Max: 3, Refrigerate_Metric: 'Weeks' })).toEqual({ fridge: 14 });
    expect(daysOf({ Freeze_Min: 6, Freeze_Max: 9, Freeze_Metric: 'Months' })).toEqual({ freezer: 180 });
    expect(daysOf({ Pantry_Min: 2, Pantry_Max: 3, Pantry_Metric: 'Years' })).toEqual({ pantry: 730 });
  });

  it('maps pantry, refrigerate and freeze to the three storage methods together', () => {
    expect(
      daysOf({
        Pantry_Min: 1, Pantry_Max: 2, Pantry_Metric: 'Days',
        Refrigerate_Min: 1, Refrigerate_Max: 2, Refrigerate_Metric: 'Weeks',
        Freeze_Min: 1, Freeze_Max: 2, Freeze_Metric: 'Months',
      }),
    ).toEqual({ pantry: 1, fridge: 7, freezer: 30 });
  });

  it('rounds hours up to whole days', () => {
    expect(daysOf({ Pantry_Min: 2, Pantry_Max: 2, Pantry_Metric: 'Hours', Refrigerate_Min: 1, Refrigerate_Metric: 'Days' })).toEqual({ pantry: 1, fridge: 1 });
    expect(daysOf({ Pantry_Min: 30, Pantry_Max: 48, Pantry_Metric: 'Hours' })).toEqual({ pantry: 2 });
  });

  it('drops "When Ripe" and other non-time metrics, missing values and zero', () => {
    const fridge = { Refrigerate_Min: 5, Refrigerate_Max: 7, Refrigerate_Metric: 'Days' };
    expect(daysOf({ ...fridge, Pantry_Min: null, Pantry_Max: null, Pantry_Metric: 'When Ripe' })).toEqual({ fridge: 5 });
    expect(daysOf({ ...fridge, Pantry_Min: 3, Pantry_Metric: 'when ripe' })).toEqual({ fridge: 5 });
    expect(daysOf({ ...fridge, Freeze_Min: null, Freeze_Metric: 'Not Recommended' })).toEqual({ fridge: 5 });
    expect(daysOf({ ...fridge, Pantry_Min: null, Pantry_Metric: 'Package use-by date' })).toEqual({ fridge: 5 });
    expect(daysOf({ ...fridge, Freeze_Min: null, Freeze_Metric: 'Indefinitely' })).toEqual({ fridge: 5 });
    expect(daysOf({ ...fridge, Pantry_Min: null, Pantry_Max: 18, Pantry_Metric: 'Months' })).toEqual({ fridge: 5 });
    expect(daysOf({ ...fridge, Pantry_Min: 0, Pantry_Max: 1, Pantry_Metric: 'Days' })).toEqual({ fridge: 5 });
    expect(daysOf({ ...fridge, Pantry_Min: 4, Pantry_Metric: null })).toEqual({ fridge: 5 });
    expect(daysOf({ ...fridge, Pantry_Min: 4, Pantry_Metric: 'constructor' })).toEqual({ fridge: 5 });
  });

  it('uses the minimum of a range', () => {
    expect(daysOf({ Refrigerate_Min: 1, Refrigerate_Max: 2, Refrigerate_Metric: 'Weeks' })).toEqual({ fridge: 7 });
  });

  it('prefers the "from purchase" value, and falls back to the general one when it is not usable', () => {
    expect(
      daysOf({ Refrigerate_Min: 10, Refrigerate_Max: 14, Refrigerate_Metric: 'Days', DOP_Refrigerate_Min: 80, DOP_Refrigerate_Max: 90, DOP_Refrigerate_Metric: 'Days' }),
    ).toEqual({ fridge: 80 });
    expect(daysOf({ DOP_Freeze_Min: 1, DOP_Freeze_Max: 2, DOP_Freeze_Metric: 'Months' })).toEqual({ freezer: 30 });
    expect(
      daysOf({ Refrigerate_Min: 1, Refrigerate_Max: 2, Refrigerate_Metric: 'Months', DOP_Refrigerate_Min: null, DOP_Refrigerate_Metric: 'Package use-by date' }),
    ).toEqual({ fridge: 30 });
  });

  it('builds the name from the name and subtitle, and the id from the dataset id', () => {
    const { foods } = mapFoodKeeper(
      raw(
        product({ ID: 3, Name: 'Cheese', Name_subtitle: 'hard such as cheddar', DOP_Refrigerate_Min: 6, DOP_Refrigerate_Metric: 'Months' }),
        product({ ID: 12, Name: ' Yogurt ', Name_subtitle: '  ', DOP_Refrigerate_Min: 1, DOP_Refrigerate_Metric: 'Weeks' }),
      ),
    );
    expect(foods).toEqual([
      { id: '3', name: 'Cheese, hard such as cheddar', days: { fridge: 180 } },
      { id: '12', name: 'Yogurt', days: { fridge: 7 } },
    ]);
  });

  it('skips rows with a row number and a reason, and keeps the rest in order', () => {
    const usable = { DOP_Refrigerate_Min: 1, DOP_Refrigerate_Metric: 'Weeks' };
    const { foods, skipped } = mapFoodKeeper(
      raw(
        product({ ID: 1, Name: 'Bananas', Pantry_Min: null, Pantry_Metric: 'When Ripe' }),
        product({ ID: 2, Name: 'Milk', ...usable }),
        product({ ID: 3, Name: '', ...usable }),
        product({ ID: 'x', Name: 'Odd', ...usable }),
        product({ ID: 2, Name: 'Milk again', ...usable }),
        product({ ID: 6, Name: 'Eggs', Refrigerate_Min: 'three', Refrigerate_Metric: 'Weeks' }),
      ),
    );
    expect(foods.map((f) => f.name)).toEqual(['Milk']);
    expect(skipped.map((s) => s.row)).toEqual([1, 3, 4, 5, 6]);
    expect(skipped[0]?.reason).toMatch(/no usable storage time/i);
    expect(skipped[1]?.reason).toMatch(/Name/);
    expect(skipped[2]?.reason).toMatch(/ID/);
    expect(skipped[3]?.reason).toMatch(/duplicate id "2"/i);
    expect(skipped[4]?.reason).toMatch(/Refrigerate_Min/);
  });

  it('reports a snapshot without a Product sheet instead of throwing', () => {
    expect(mapFoodKeeper({ sheets: [] })).toEqual({ foods: [], skipped: [{ row: 0, reason: 'No Product sheet in the snapshot.' }] });
    expect(mapFoodKeeper(null).foods).toEqual([]);
    expect(mapFoodKeeper(null).skipped).toHaveLength(1);
  });

  it('never throws, whatever the input', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const r = mapFoodKeeper(input);
        expect(Array.isArray(r.foods)).toBe(true);
      }),
    );
  });

  it('only returns foods with a name and at least one positive whole-day method, for fuzzed rows', () => {
    const cell = fc.oneof(fc.constant(null), fc.integer({ min: -5, max: 50 }), fc.double(), fc.string(), fc.constantFrom('Days', 'Weeks', 'Months', 'Years', 'Hours', 'When Ripe'));
    const keys = ['ID', 'Name', 'Name_subtitle', 'Pantry_Min', 'Pantry_Metric', 'DOP_Refrigerate_Min', 'DOP_Refrigerate_Metric', 'Freeze_Min', 'Freeze_Metric'];
    const fuzzRow = fc.oneof(fc.dictionary(fc.constantFrom(...keys), cell), fc.anything());
    fc.assert(
      fc.property(fc.array(fuzzRow, { maxLength: 20 }), (rows) => {
        const r = mapFoodKeeper({ sheets: [{ name: 'Product', data: rows.map((x) => (x && typeof x === 'object' && !Array.isArray(x) ? row(x as Cells) : x)) }] });
        expect(r.foods.length + r.skipped.length).toBe(rows.length);
        for (const food of r.foods) {
          expect(food.name.length).toBeGreaterThan(0);
          const days = Object.values(food.days);
          expect(days.length).toBeGreaterThan(0);
          for (const d of days) expect(Number.isInteger(d) && d > 0).toBe(true);
        }
      }),
    );
  });
});
