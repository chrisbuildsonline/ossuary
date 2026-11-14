import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Duration } from '../schema/rules';
import { addDuration, negate } from './duration';
import { dayNumberToCivil, fromDayNumber, toDayNumber } from './iso-day';

const add = (day: string, amount: number, unit: Duration['unit']) => fromDayNumber(addDuration(toDayNumber(day), { amount, unit }));

describe('addDuration', () => {
  it.each([
    ['2026-11-14', 0, 'day', '2026-11-14'],
    ['2026-11-14', 1, 'day', '2026-11-15'],
    ['2026-12-31', 1, 'day', '2027-01-01'],
    ['2026-11-14', 2, 'week', '2026-11-28'],
    ['2026-11-14', -3, 'day', '2026-11-11'],
    ['2026-03-08', 1, 'day', '2026-03-09'],
    ['2026-04-05', 1, 'day', '2026-04-06'],
  ] as const)('%s + %i %s = %s', (day, amount, unit, expected) => {
    expect(add(day, amount, unit)).toBe(expected);
  });

  it.each([
    ['2026-01-31', 1, 'month', '2026-02-28'],
    ['2024-01-31', 1, 'month', '2024-02-29'],
    ['2000-01-31', 1, 'month', '2000-02-29'],
    ['1900-01-31', 1, 'month', '1900-02-28'],
    ['2026-03-31', 1, 'month', '2026-04-30'],
    ['2026-03-31', -1, 'month', '2026-02-28'],
    ['2026-01-15', 13, 'month', '2027-02-15'],
    ['2026-11-30', 3, 'month', '2027-02-28'],
    ['2026-01-31', -2, 'month', '2025-11-30'],
    ['2026-05-10', -17, 'month', '2024-12-10'],
    ['2024-02-29', 1, 'year', '2025-02-28'],
    ['2024-02-29', 4, 'year', '2028-02-29'],
    ['1896-02-29', 4, 'year', '1900-02-28'],
    ['1996-02-29', 4, 'year', '2000-02-29'],
    ['2026-11-14', 2, 'year', '2028-11-14'],
    ['2026-11-14', -1, 'year', '2025-11-14'],
  ] as const)('%s + %i %s = %s (calendar months, clamped to month end)', (day, amount, unit, expected) => {
    expect(add(day, amount, unit)).toBe(expected);
  });

  it('a year is twelve months', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3_000_000 }), fc.integer({ min: -50, max: 50 }), (n, years) => {
        expect(addDuration(n, { amount: years, unit: 'year' })).toBe(addDuration(n, { amount: years * 12, unit: 'month' }));
      }),
      { seed: 41, numRuns: 500 },
    );
  });

  it('a positive duration always moves later and never by more than its longest length', () => {
    const longest = { day: 1, week: 7, month: 31, year: 366 } as const;
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3_000_000 }),
        fc.integer({ min: 1, max: 500 }),
        fc.constantFrom('day', 'week', 'month', 'year') as fc.Arbitrary<Duration['unit']>,
        (n, amount, unit) => {
          const later = addDuration(n, { amount, unit });
          expect(later).toBeGreaterThan(n);
          expect(later - n).toBeLessThanOrEqual(amount * longest[unit]);
        },
      ),
      { seed: 42, numRuns: 500 },
    );
  });

  it('keeps the day of month when the target month is long enough', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3_000_000 }), fc.integer({ min: -100, max: 100 }), (n, months) => {
        const fromDay = dayNumberToCivil(n).day;
        const toDay = dayNumberToCivil(addDuration(n, { amount: months, unit: 'month' })).day;
        expect(toDay).toBeLessThanOrEqual(fromDay);
        if (fromDay <= 28) expect(toDay).toBe(fromDay);
      }),
      { seed: 43, numRuns: 500 },
    );
  });

  it('negate flips the amount and keeps the unit', () => {
    expect(negate({ amount: 3, unit: 'month' })).toEqual({ amount: -3, unit: 'month' });
  });
});
