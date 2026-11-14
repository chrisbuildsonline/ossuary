import { describe, expect, it } from 'vitest';
import type { Item } from '../schema/item';
import { days, months, specWith, years } from '../testing/lifespan-spec';
import { fromDayNumber, toDayNumber } from './iso-day';
import { runLifespan } from './rules';

const base = (amount: number, unit: 'day' | 'week' | 'month' | 'year' = 'day') => ({ type: 'duration', amount, unit });

function run(lifespan: Record<string, unknown>, item: Item) {
  const spec = specWith(lifespan);
  const l = spec.lifespans[0];
  if (!l) throw new Error('no lifespan');
  const r = runLifespan(l, item);
  return { ...r, startDay: fromDayNumber(r.start), expiryDay: fromDayNumber(r.expiry) };
}

const item = (extra: Item = {}): Item => ({ name: 'Widget', start: '2026-11-14', ...extra });

describe('base', () => {
  it('adds a day duration to the start day', () => {
    const r = run({ base: base(14) }, item());
    expect(r.startDay).toBe('2026-11-14');
    expect(r.expiryDay).toBe('2026-11-28');
    expect(r.steps).toEqual([{ kind: 'base', base: { type: 'duration', amount: 14, unit: 'day' }, before: r.start, after: r.expiry }]);
  });

  it('adds months on the calendar, clamped to the end of the target month', () => {
    expect(run({ base: base(1, 'month') }, item({ start: '2026-01-31' })).expiryDay).toBe('2026-02-28');
    expect(run({ base: base(1, 'month') }, item({ start: '2024-01-31' })).expiryDay).toBe('2024-02-29');
    expect(run({ base: base(1, 'year') }, item({ start: '2024-02-29' })).expiryDay).toBe('2025-02-28');
  });

  it('a zero base expires on the start day', () => {
    expect(run({ base: base(0) }, item()).expiryDay).toBe('2026-11-14');
  });

  it('uses a date field as the expiry day', () => {
    expect(run({ base: { type: 'field', field: 'ends' } }, item({ ends: '2027-03-01' })).expiryDay).toBe('2027-03-01');
  });

  it('uses the lifespan start field', () => {
    const r = run({ startField: 'other', base: base(3) }, item({ other: '2026-01-01' }));
    expect(r.startDay).toBe('2026-01-01');
    expect(r.expiryDay).toBe('2026-01-04');
  });
});

describe('rules', () => {
  it('extend moves the expiry later', () => {
    const r = run({ base: base(10), rules: [{ id: 'more', kind: 'extend', by: days(5) }] }, item());
    expect(r.expiryDay).toBe('2026-11-29');
    expect(r.steps[1]).toMatchObject({ kind: 'extend', before: toDayNumber('2026-11-24'), after: toDayNumber('2026-11-29') });
  });

  it('extend in months uses calendar months from the current expiry', () => {
    const r = run({ base: base(1, 'month'), rules: [{ id: 'more', kind: 'extend', by: months(1) }] }, item({ start: '2026-01-31' }));
    expect(r.expiryDay).toBe('2026-03-28');
  });

  it('shorten moves the expiry earlier', () => {
    const r = run({ base: base(10), rules: [{ id: 'less', kind: 'shorten', by: days(3) }] }, item());
    expect(r.expiryDay).toBe('2026-11-21');
    expect(r.steps[1]).toMatchObject({ kind: 'shorten', floored: false });
  });

  it('shorten stops at the start day', () => {
    const r = run({ base: base(5), rules: [{ id: 'less', kind: 'shorten', by: years(1) }] }, item());
    expect(r.expiryDay).toBe('2026-11-14');
    expect(r.steps[1]).toMatchObject({ kind: 'shorten', floored: true, after: r.start });
  });

  it('clamp raises to the minimum', () => {
    const r = run({ base: base(2), rules: [{ id: 'lim', kind: 'clamp', min: days(10) }] }, item());
    expect(r.expiryDay).toBe('2026-11-24');
    expect(r.steps[1]).toMatchObject({ kind: 'clamp', bound: 'min' });
  });

  it('clamp lowers to the maximum, in calendar months', () => {
    const r = run({ base: base(2, 'year'), rules: [{ id: 'lim', kind: 'clamp', max: months(3) }] }, item({ start: '2026-11-30' }));
    expect(r.expiryDay).toBe('2027-02-28');
    expect(r.steps[1]).toMatchObject({ kind: 'clamp', bound: 'max' });
  });

  it('clamp inside its range changes nothing but still records a step', () => {
    const r = run({ base: base(20), rules: [{ id: 'lim', kind: 'clamp', min: days(10), max: days(30) }] }, item());
    expect(r.expiryDay).toBe('2026-12-04');
    expect(r.steps[1]).toMatchObject({ kind: 'clamp', bound: undefined, before: r.expiry, after: r.expiry });
  });

  it('clamp bounds are measured from the start day, not the current expiry', () => {
    const r = run({ base: base(40), rules: [{ id: 'more', kind: 'extend', by: days(40) }, { id: 'lim', kind: 'clamp', max: days(60) }] }, item());
    expect(r.expiryDay).toBe('2027-01-13');
  });

  it('lookup sets the expiry from the start day using the table', () => {
    const lookup = { id: 'where', kind: 'lookup', field: 'place', table: { a: days(3), b: months(2) } };
    expect(run({ base: base(100), rules: [lookup] }, item({ place: 'a' })).expiryDay).toBe('2026-11-17');
    const r = run({ base: base(100), rules: [lookup] }, item({ place: 'b' }));
    expect(r.expiryDay).toBe('2027-01-14');
    expect(r.steps[1]).toMatchObject({ kind: 'lookup', value: 'b', duration: months(2), fromDefault: false });
  });

  it('lookup falls back to the default for a value with no entry, or no value', () => {
    const lookup = { id: 'where', kind: 'lookup', field: 'place', table: { a: days(3) }, default: days(9) };
    const r = run({ base: base(100), rules: [lookup] }, item({ place: 'b' }));
    expect(r.expiryDay).toBe('2026-11-23');
    expect(r.steps[1]).toMatchObject({ kind: 'lookup', value: 'b', duration: days(9), fromDefault: true });
    expect(run({ base: base(100), rules: [lookup] }, item()).expiryDay).toBe('2026-11-23');
  });

  it('lookup with no entry and no default is skipped', () => {
    const lookup = { id: 'where', kind: 'lookup', field: 'note', table: { long: days(50) } };
    const r = run({ base: base(10), rules: [lookup] }, item({ note: 'short' }));
    expect(r.expiryDay).toBe('2026-11-24');
    expect(r.steps).toHaveLength(1);
  });

  it('lookup ignores inherited keys such as constructor', () => {
    const lookup = { id: 'where', kind: 'lookup', field: 'note', table: { long: days(50) } };
    for (const note of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const r = run({ base: base(10), rules: [lookup] }, item({ note }));
      expect(r.expiryDay).toBe('2026-11-24');
      expect(r.steps).toHaveLength(1);
    }
    const withDefault = { ...lookup, default: days(1) };
    expect(run({ base: base(10), rules: [withDefault] }, item({ note: 'constructor' })).expiryDay).toBe('2026-11-15');
  });

  it('when applies the rule only on an equal value and skips it otherwise', () => {
    const rule = { id: 'more', kind: 'extend', by: days(5), when: { field: 'place', equals: 'a' } };
    expect(run({ base: base(10), rules: [rule] }, item({ place: 'a' })).expiryDay).toBe('2026-11-29');
    const skipped = run({ base: base(10), rules: [rule] }, item({ place: 'b' }));
    expect(skipped.expiryDay).toBe('2026-11-24');
    expect(skipped.steps).toHaveLength(1);
    expect(run({ base: base(10), rules: [rule] }, item()).steps).toHaveLength(1);
  });

  it('when compares numbers strictly', () => {
    const rule = { id: 'more', kind: 'extend', by: days(5), when: { field: 'count', equals: 3 } };
    expect(run({ base: base(10), rules: [rule] }, item({ count: 3 })).expiryDay).toBe('2026-11-29');
    expect(run({ base: base(10), rules: [rule] }, item({ count: 4 })).expiryDay).toBe('2026-11-24');
  });

  it('when on a field named like an Object method reads only own values', () => {
    const rule = { id: 'more', kind: 'shorten', by: days(5), when: { field: 'note', equals: 'x' } };
    expect(run({ base: base(10), rules: [rule] }, item({ note: 'x' })).expiryDay).toBe('2026-11-19');
  });

  it('applies rules in declared order, so clamp before extend differs from after', () => {
    const extend = { id: 'more', kind: 'extend', by: days(30) };
    const clamp = { id: 'lim', kind: 'clamp', max: days(20) };
    expect(run({ base: base(10), rules: [clamp, extend] }, item()).expiryDay).toBe('2026-12-24');
    expect(run({ base: base(10), rules: [extend, clamp] }, item()).expiryDay).toBe('2026-12-04');
  });

  it('does not change the item or the lifespan', () => {
    const spec = specWith({ base: base(10), rules: [{ id: 'where', kind: 'lookup', field: 'place', table: { a: days(3) }, default: days(4) }] });
    const before = structuredClone(spec);
    const it = item({ place: 'a' });
    const itBefore = structuredClone(it);
    const l = spec.lifespans[0];
    if (!l) throw new Error('no lifespan');
    runLifespan(l, it);
    expect(spec).toStrictEqual(before);
    expect(it).toStrictEqual(itBefore);
  });
});
