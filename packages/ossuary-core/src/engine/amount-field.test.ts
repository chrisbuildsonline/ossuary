// A duration base whose amount comes from a number field of the item (`amountField`).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Item } from '../schema/item';
import { units } from '../schema/rules';
import { days, specWith, weeks } from '../testing/lifespan-spec';
import { type Evaluation, evaluate } from './evaluate';

const now = { day: '2026-11-14' };
const fromCount = (unit = 'day', rules: unknown[] = []) =>
  specWith({ base: { type: 'duration', amount: 30, unit, amountField: 'count' }, rules });
const item = (extra: Item = {}): Item => ({ name: 'Widget', start: '2026-11-14', ...extra });

function value(r: ReturnType<typeof evaluate>): Evaluation {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}
const first = (r: ReturnType<typeof evaluate>) => value(r).lifespans[0];

describe('evaluate with amountField', () => {
  it('uses the item value in place of amount', () => {
    expect(first(evaluate(fromCount(), item({ count: 40 }), now))?.expiresAt).toBe('2026-12-24');
  });

  it('uses amount when the item has no value', () => {
    expect(first(evaluate(fromCount(), item(), now))?.expiresAt).toBe('2026-12-14');
  });

  it('accepts 0 and 9999', () => {
    expect(first(evaluate(fromCount(), item({ count: 0 }), now))?.expiresAt).toBe('2026-11-14');
    expect(first(evaluate(fromCount(), item({ count: 9999 }), now))?.expiresAt).toBe('2054-03-31');
  });

  it.each([-1, 1.5, 10000])('returns an issue at the field path for %s and does not throw', (count) => {
    expect(evaluate(fromCount(), item({ count }), now)).toEqual({
      ok: false,
      error: [{ path: 'count', message: 'Use a whole number from 0 to 9999.' }],
    });
  });

  it('runs the rules on the result in declared order', () => {
    const spec = fromCount('day', [
      { id: 'more', kind: 'extend', by: weeks(1) },
      { id: 'cap', kind: 'clamp', max: days(50) },
    ]);
    expect(first(evaluate(spec, item({ count: 10 }), now))?.expiresAt).toBe('2026-12-01');
    expect(first(evaluate(spec, item({ count: 60 }), now))?.expiresAt).toBe('2027-01-03');
  });

  it('writes the amount used into the trace line', () => {
    expect(first(evaluate(fromCount(), item({ count: 40 }), now))?.trace[0]?.text).toBe('Base: Base lifespan 40 days');
    expect(first(evaluate(fromCount(), item(), now))?.trace[0]?.text).toBe('Base: Base lifespan 30 days');
    expect(first(evaluate(fromCount('week'), item({ count: 1 }), now))?.trace[0]?.text).toBe('Base: Base lifespan 1 week');
  });

  it('equals the same spec with a fixed amount, and leaves the rules and a second lifespan alone', () => {
    const nowDays = ['2023-06-01', '2026-03-08', '2026-11-14', '2028-12-31'];
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.constantFrom(...units),
        fc.integer({ min: 1, max: 30 }),
        fc.constantFrom(...nowDays),
        (n, unit, by, day) => {
          const rules = [{ id: 'more', kind: 'extend', by: days(by) }];
          const other = { base: { type: 'duration', amount: 6, unit: 'month' }, rules };
          const withField = specWith({ base: { type: 'duration', amount: 30, unit, amountField: 'count' }, rules }, other);
          const fixed = specWith({ base: { type: 'duration', amount: n, unit }, rules }, other);
          const at = { day };
          const got = value(evaluate(withField, item({ count: n }), at));
          expect(got).toStrictEqual(value(evaluate(fixed, item({ count: n }), at)));
          const unset = value(evaluate(withField, item(), at));
          expect(got.lifespans[1]).toStrictEqual(unset.lifespans[1]);
        },
      ),
      { seed: 20261114, numRuns: 150 },
    );
  });
});
