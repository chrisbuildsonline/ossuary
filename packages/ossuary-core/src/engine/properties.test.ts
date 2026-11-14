// fast-check properties of the engine over generated specs (one to four lifespans), with fixed seeds and fixed `now` days.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type BoneSpec, parseBoneSpec } from '../schema/bone-spec';
import type { Item } from '../schema/item';
import type { Rule, Unit } from '../schema/rules';
import { specArbitrary } from '../testing/spec-arbitrary';
import { addDuration } from './duration';
import { type Evaluation, type Now, evaluate } from './evaluate';
import { fromDayNumber, toDayNumber } from './iso-day';

// Fixed now days, sorted, including the 2026 daylight saving changes in New York and Auckland.
const nowDays = [
  '2023-06-01',
  '2024-02-29',
  '2026-03-08',
  '2026-04-05',
  '2026-09-27',
  '2026-11-01',
  '2026-11-14',
  '2027-01-31',
  '2028-12-31',
] as const;

const first = toDayNumber('2023-01-01');
const last = toDayNumber('2027-12-31');

function itemFor(spec: BoneSpec): fc.Arbitrary<Item> {
  const place = spec.entity.fields.find((f) => f.key === 'place');
  const options = place?.kind === 'enum' ? place.options.map((o) => o.value) : ['a'];
  return fc
    .record(
      {
        start: fc.integer({ min: first, max: last }),
        length: fc.integer({ min: -30, max: 800 }),
        place: fc.constantFrom(...options),
        count: fc.nat(100),
      },
      { requiredKeys: ['start', 'length'], noNullPrototype: true },
    )
    .map(({ start, length, place: p, count }) => ({
      name: 'Thing',
      start: fromDayNumber(start),
      ends: fromDayNumber(start + length),
      ...(p !== undefined && { place: p }),
      ...(count !== undefined && { count }),
    }));
}

const specAndItem = specArbitrary.chain((spec) => itemFor(spec).map((item) => ({ spec, item })));
const fixedNow = fc.constantFrom(...nowDays).map((day): Now => ({ day }));

function ok(spec: BoneSpec, item: Item, now: Now): Evaluation {
  const r = evaluate(spec, item, now);
  if (!r.ok) throw new Error(`evaluate failed: ${JSON.stringify(r.error)}`);
  return r.value;
}

/** A copy of the spec with lifespan `index` changed, checked to still be a valid spec. */
function withLifespan(spec: BoneSpec, index: number, change: (rules: Rule[]) => Rule[]): BoneSpec {
  const next = structuredClone(spec);
  const lifespan = next.lifespans[index];
  if (!lifespan) throw new Error('no lifespan');
  lifespan.rules = change(lifespan.rules ?? []);
  const r = parseBoneSpec(next);
  if (!r.ok) throw new Error(`changed spec is invalid: ${JSON.stringify(r.error)}`);
  return r.value;
}

const settings = (seed: number) => ({ seed, numRuns: 200 });

describe('engine properties, per lifespan', () => {
  it('remaining days never increase and the stage index never decreases as now moves on', () => {
    fc.assert(
      fc.property(specAndItem, ({ spec, item }) => {
        const runs = nowDays.map((day) => ok(spec, item, { day }));
        spec.lifespans.forEach((_, i) => {
          for (let k = 1; k < runs.length; k += 1) {
            const before = runs[k - 1]?.lifespans[i];
            const after = runs[k]?.lifespans[i];
            if (!before || !after) throw new Error('missing lifespan');
            expect(after.remaining.days).toBeLessThanOrEqual(before.remaining.days);
            expect(after.stage.index).toBeGreaterThanOrEqual(before.stage.index);
          }
        });
      }),
      settings(101),
    );
  });

  it('adding an extend rule anywhere never moves the expiry earlier', () => {
    const extend = fc.record({
      amount: fc.integer({ min: 1, max: 30 }),
      unit: fc.constantFrom<Unit>('day', 'week', 'month', 'year'),
      at: fc.nat(),
      lifespan: fc.nat(),
    });
    fc.assert(
      fc.property(specAndItem, extend, fixedNow, ({ spec, item }, { amount, unit, at, lifespan }, now) => {
        const index = lifespan % spec.lifespans.length;
        const changed = withLifespan(spec, index, (rules) => {
          const p = at % (rules.length + 1);
          return [...rules.slice(0, p), { id: 'added', kind: 'extend', by: { amount, unit } }, ...rules.slice(p)];
        });
        const before = ok(spec, item, now).lifespans[index];
        const after = ok(changed, item, now).lifespans[index];
        if (!before || !after) throw new Error('missing lifespan');
        expect(toDayNumber(after.expiresAt)).toBeGreaterThanOrEqual(toDayNumber(before.expiresAt));
      }),
      settings(102),
    );
  });

  it('when a clamp is the last applied rule, the expiry lies within its bounds', () => {
    let checked = 0;
    fc.assert(
      fc.property(specAndItem, fixedNow, ({ spec, item }, now) => {
        const r = ok(spec, item, now);
        r.lifespans.forEach((l, i) => {
          const lastLine = l.trace[l.trace.length - 1];
          if (lastLine?.kind !== 'clamp') return;
          const rule = spec.lifespans[i]?.rules?.find((x) => x.id === lastLine.ruleId);
          if (rule?.kind !== 'clamp') throw new Error('clamp rule not found');
          const start = toDayNumber(l.startedAt);
          const expiry = toDayNumber(l.expiresAt);
          if (rule.min) expect(expiry).toBeGreaterThanOrEqual(addDuration(start, rule.min));
          if (rule.max) expect(expiry).toBeLessThanOrEqual(addDuration(start, rule.max));
          checked += 1;
        });
      }),
      settings(103),
    );
    expect(checked).toBeGreaterThan(20);
  });

  it('an appended clamp in any one unit always holds the expiry within its bounds', () => {
    const clamp = fc
      .record({
        a: fc.integer({ min: 0, max: 40 }),
        b: fc.integer({ min: 0, max: 40 }),
        unit: fc.constantFrom<Unit>('day', 'week', 'month', 'year'),
        which: fc.constantFrom('min', 'max', 'both'),
        lifespan: fc.nat(),
      })
      .map(({ a, b, unit, which, lifespan }) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return {
          lifespan,
          rule: {
            id: 'bound',
            kind: 'clamp',
            ...(which !== 'max' && { min: { amount: lo, unit } }),
            ...(which !== 'min' && { max: { amount: hi, unit } }),
          } as Rule,
        };
      });
    fc.assert(
      fc.property(specAndItem, clamp, fixedNow, ({ spec, item }, { lifespan, rule }, now) => {
        if (rule.kind !== 'clamp') throw new Error('not a clamp');
        const index = lifespan % spec.lifespans.length;
        const l = ok(withLifespan(spec, index, (rules) => [...rules, rule]), item, now).lifespans[index];
        if (!l) throw new Error('missing lifespan');
        const start = toDayNumber(l.startedAt);
        const expiry = toDayNumber(l.expiresAt);
        if (rule.min) expect(expiry).toBeGreaterThanOrEqual(addDuration(start, rule.min));
        if (rule.max) expect(expiry).toBeLessThanOrEqual(addDuration(start, rule.max));
        expect(l.trace[l.trace.length - 1]?.ruleId).toBe('bound');
      }),
      settings(104),
    );
  });

  it('stage boundaries are exact at every declared threshold', () => {
    fc.assert(
      fc.property(specAndItem, ({ spec, item }) => {
        const base = ok(spec, item, { day: '2026-11-14' });
        spec.lifespans.forEach((lifespan, i) => {
          const expiry = toDayNumber(base.lifespans[i]?.expiresAt ?? '');
          const at = (left: number) => ok(spec, item, { day: fromDayNumber(expiry - left) }).lifespans[i];
          lifespan.stages.forEach((stage, s) => {
            if (stage.enterAtDays === undefined) return;
            const n = stage.enterAtDays;
            expect(at(n)).toMatchObject({ remaining: { days: n }, stage: { id: stage.id, index: s } });
            expect(at(n + 1)?.stage.index).toBe(s - 1);
          });
          const dead = lifespan.stages.length - 1;
          expect(at(0)?.stage.index).toBeLessThan(dead);
          expect(at(-1)?.stage).toMatchObject({ index: dead, tone: 'dead' });
        });
      }),
      settings(105),
    );
  });

  it('is deterministic and leaves its arguments unchanged', () => {
    const minute = fc.option(fc.integer({ min: 0, max: 1439 }), { nil: undefined });
    fc.assert(
      fc.property(specAndItem, fixedNow, minute, ({ spec, item }, { day }, minuteOfDay) => {
        const now: Now = minuteOfDay === undefined ? { day } : { day, minuteOfDay };
        const copies = structuredClone({ spec, item, now });
        const a = evaluate(spec, item, now);
        const b = evaluate(spec, item, now);
        expect(b).toStrictEqual(a);
        expect({ spec, item, now }).toStrictEqual(copies);
      }),
      settings(106),
    );
  });

  it('changing the rules of one lifespan leaves every other lifespan unchanged', () => {
    const change = fc.constantFrom<(rules: Rule[]) => Rule[]>(
      () => [],
      (rules) => [...rules].reverse(),
      (rules) => [...rules, { id: 'more', kind: 'extend', by: { amount: 2, unit: 'month' } }],
      (rules) => [{ id: 'less', kind: 'shorten', by: { amount: 9, unit: 'day' } }, ...rules],
      (rules) => [...rules, { id: 'look', kind: 'lookup', field: 'place', table: {}, default: { amount: 1, unit: 'year' } }],
      (rules) => [...rules, { id: 'cap', kind: 'clamp', max: { amount: 3, unit: 'day' } }],
    );
    fc.assert(
      fc.property(specAndItem, change, fc.nat(), fixedNow, ({ spec, item }, edit, pick, now) => {
        const index = pick % spec.lifespans.length;
        const before = ok(spec, item, now).lifespans;
        const after = ok(withLifespan(spec, index, edit), item, now).lifespans;
        before.forEach((l, i) => {
          if (i !== index) expect(after[i]).toStrictEqual(l);
        });
      }),
      settings(107),
    );
  });
});

describe('primary lifespan properties', () => {
  it('a one-lifespan spec gives one evaluation and primary index 0', () => {
    fc.assert(
      fc.property(specAndItem, fixedNow, ({ spec, item }, now) => {
        const one = { ...spec, lifespans: [spec.lifespans[0]] } as BoneSpec;
        const r = ok(one, item, now);
        expect(r.lifespans).toHaveLength(1);
        expect(r.primaryIndex).toBe(0);
      }),
      settings(108),
    );
  });

  it('holds length, order, live-first, minimal, last-expired and no-earlier-tie rules', () => {
    const seen = { live: 0, expired: 0, mixed: 0 };
    fc.assert(
      fc.property(specAndItem, fixedNow, ({ spec, item }, now) => {
        const r = ok(spec, item, now);
        expect(r.lifespans.map((l) => l.lifespanId)).toEqual(spec.lifespans.map((l) => l.id));
        expect(Number.isInteger(r.primaryIndex)).toBe(true);
        const primary = r.lifespans[r.primaryIndex];
        if (!primary) throw new Error('primary index out of range');
        const days = r.lifespans.map((l) => l.remaining.days);
        const live = days.some((d) => d >= 0);
        const candidates = days.map((d, i) => ({ d, i })).filter(({ d }) => !live || d >= 0);
        if (live) {
          expect(primary.remaining.days).toBeGreaterThanOrEqual(0);
          for (const { d } of candidates) expect(primary.remaining.days).toBeLessThanOrEqual(d);
          seen[days.some((d) => d < 0) ? 'mixed' : 'live'] += 1;
        } else {
          for (const d of days) expect(primary.remaining.days).toBeGreaterThanOrEqual(d);
          seen.expired += 1;
        }
        for (const { d, i } of candidates) if (i < r.primaryIndex) expect(d).not.toBe(primary.remaining.days);
      }),
      { seed: 109, numRuns: 400 },
    );
    expect(seen.live).toBeGreaterThan(0);
    expect(seen.mixed).toBeGreaterThan(0);
    expect(seen.expired).toBeGreaterThan(0);
  });
});
