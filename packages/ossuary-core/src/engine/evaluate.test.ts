import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type BoneSpec, parseBoneSpec } from '../schema/bone-spec';
import { gizmoSpec, widgetSpec } from '../testing/fixtures';
import { days, specWith } from '../testing/lifespan-spec';
import { type Evaluation, evaluate } from './evaluate';

const parsed = (input: unknown): BoneSpec => {
  const r = parseBoneSpec(input);
  if (!r.ok) throw new Error('fixture invalid');
  return r.value;
};
const widget = parsed(widgetSpec);
const gizmo = parsed(gizmoSpec);

function value(r: ReturnType<typeof evaluate>): Evaluation {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

describe('evaluate', () => {
  it('returns one evaluation for a one-lifespan spec, with primary index 0', () => {
    const r = evaluate(widget, { name: 'Widget', place: 'cold', made: '2026-11-14', opened: 'yes' }, { day: '2026-11-20' });
    expect(r).toStrictEqual({
      ok: true,
      value: {
        lifespans: [
          {
            lifespanId: 'main',
            label: 'Use by',
            startedAt: '2026-11-14',
            expiresAt: '2026-11-21',
            remaining: { days: 1 },
            fraction: 1 / 7,
            stage: { id: 'urgent', label: 'Urgent', tone: 'urgent', index: 2 },
            trace: [
              { ruleId: 'base', kind: 'base', text: 'Base: Base 14 days (Example reference)', deltaDays: 14, changed: true, sourceId: 'ref1' },
              { ruleId: 'by_place', kind: 'lookup', text: 'Kept in is Cold: 14 days (Example reference)', deltaDays: 0, changed: false, sourceId: 'ref1' },
              { ruleId: 'opened', kind: 'shorten', text: 'Opened shortens by 7 days', deltaDays: -7, changed: true },
              { ruleId: 'limit', kind: 'clamp', text: 'Limit: no change', deltaDays: 0, changed: false },
            ],
          },
        ],
        primaryIndex: 0,
      },
    });
  });

  it('adds hours on the last day when the minute of day is given', () => {
    const item = { name: 'Widget', place: 'cold', made: '2026-11-14' };
    expect(value(evaluate(widget, item, { day: '2026-11-28', minuteOfDay: 19 * 60 })).lifespans[0]?.remaining).toEqual({ days: 0, hours: 5 });
    expect(value(evaluate(widget, item, { day: '2026-11-27', minuteOfDay: 19 * 60 })).lifespans[0]?.remaining).toEqual({ days: 1 });
  });

  it('is dead the day after the expiry day', () => {
    const r = value(evaluate(widget, { name: 'Widget', place: 'cold', made: '2026-11-14' }, { day: '2026-11-29' }));
    expect(r.lifespans[0]).toMatchObject({ remaining: { days: -1 }, fraction: 0, stage: { id: 'gone', tone: 'dead', index: 3 } });
  });

  it('evaluates every lifespan in declared order, each with its own rules and stages', () => {
    const r = value(evaluate(gizmo, { name: 'Gizmo', bought: '2026-11-14', plan: 'plus' }, { day: '2026-12-26' }));
    expect(r.lifespans.map((l) => [l.lifespanId, l.label, l.startedAt, l.expiresAt, l.remaining.days, l.stage.id])).toEqual([
      ['return_window', 'Return window', '2026-11-14', '2026-12-28', 2, 'last'],
      ['cover', 'Cover', '2026-11-14', '2029-11-14', 1054, 'covered'],
    ]);
    expect(r.lifespans[1]?.trace.map((l) => l.text)).toEqual(['Base: Cover 24 months', 'Plus plan extends by 12 months']);
    expect(r.primaryIndex).toBe(0);
  });

  it('moves the primary to the live lifespan once the other has expired', () => {
    const r = value(evaluate(gizmo, { name: 'Gizmo', bought: '2026-11-14' }, { day: '2027-01-01' }));
    expect(r.lifespans.map((l) => l.stage.tone)).toEqual(['dead', 'steady']);
    expect(r.primaryIndex).toBe(1);
  });

  it('when every lifespan has expired, the primary is the one that expired last', () => {
    const r = value(evaluate(gizmo, { name: 'Gizmo', bought: '2020-01-01' }, { day: '2026-11-14' }));
    expect(r.lifespans.every((l) => l.remaining.days < 0)).toBe(true);
    expect(r.primaryIndex).toBe(1);
  });

  it('returns 0 fraction when the expiry is the start day', () => {
    const spec = specWith({ base: { type: 'duration', amount: 0, unit: 'day' } });
    expect(value(evaluate(spec, { name: 'W', start: '2026-11-14' }, { day: '2026-11-14' })).lifespans[0]?.fraction).toBe(0);
  });

  it('drops item keys that are not fields', () => {
    const r = evaluate(widget, { name: 'Widget', place: 'cold', made: '2026-11-14', extra: 'x' }, { day: '2026-11-14' });
    expect(r.ok).toBe(true);
  });
});

describe('evaluate with a bad item or a bad now', () => {
  const now = { day: '2026-11-14' };

  it.each([
    [{ place: 'cold', made: '2026-11-14' }, 'name'],
    [{ name: 'W', place: 'cold' }, 'made'],
    [{ name: 'W', place: 'cold', made: '2026-02-30' }, 'made'],
    [{ name: 'W', place: 'cold', made: 20261114 }, 'made'],
    [{ name: 'W', place: 'attic', made: '2026-11-14' }, 'place'],
    [{ name: 'W', place: 'cold', made: '2026-11-14', count: 'many' }, 'count'],
  ])('returns issues and no lifespans for %j', (item, path) => {
    const r = evaluate(widget, item, now);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.map((i) => i.path)).toContain(path);
    expect(r).not.toHaveProperty('value');
  });

  it('requires an optional date field when a lifespan starts from it or ends on it', () => {
    const spec = specWith({ startField: 'other', base: { type: 'duration', amount: 3, unit: 'day' } }, { base: { type: 'field', field: 'ends' } }, {
      startField: 'other',
      base: { type: 'field', field: 'ends' },
    });
    const r = evaluate(spec, { name: 'W', start: '2026-11-14' }, now);
    expect(r).toStrictEqual({
      ok: false,
      error: [
        { path: 'other', message: 'This is required.' },
        { path: 'ends', message: 'This is required.' },
      ],
    });
  });

  it('reports a bad optional start day once, from item validation', () => {
    const spec = specWith({ startField: 'other', base: { type: 'duration', amount: 3, unit: 'day' } });
    const r = evaluate(spec, { name: 'W', start: '2026-11-14', other: '2026-13-01' }, now);
    expect(r).toStrictEqual({ ok: false, error: [{ path: 'other', message: 'Use a real calendar day as YYYY-MM-DD.' }] });
  });

  it.each([
    [{ day: '2026-02-30' }, 'now.day'],
    [{ day: '14/11/2026' }, 'now.day'],
    [{ day: '2026-11-14', minuteOfDay: 1440 }, 'now.minuteOfDay'],
    [{ day: '2026-11-14', minuteOfDay: -1 }, 'now.minuteOfDay'],
    [{ day: '2026-11-14', minuteOfDay: 1.5 }, 'now.minuteOfDay'],
    [null, 'now'],
  ])('rejects now %j at %s', (badNow, path) => {
    const r = evaluate(widget, { name: 'W', place: 'cold', made: '2026-11-14' }, badNow as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.map((i) => i.path)).toEqual([path]);
  });

  it('never throws, whatever the item', () => {
    fc.assert(
      fc.property(fc.anything({ withNullPrototype: true, withDate: true, withMap: true }), (item) => {
        const r = evaluate(gizmo, item, now);
        expect(typeof r.ok).toBe('boolean');
      }),
      { seed: 61, numRuns: 500 },
    );
  });

  it('never throws on items shaped like the spec with random values', () => {
    const keys = fc.constantFrom('name', 'bought', 'maker', 'price', 'plan', 'constructor', '__proto__');
    fc.assert(
      fc.property(fc.dictionary(keys, fc.jsonValue({ maxDepth: 1 })), (item) => {
        const r = evaluate(gizmo, item, now);
        expect(typeof r.ok).toBe('boolean');
      }),
      { seed: 62, numRuns: 500 },
    );
  });
});

describe('evaluate purity', () => {
  it('does not change its arguments and returns deeply equal results', () => {
    const spec = parsed(gizmoSpec);
    const item = { name: 'Gizmo', bought: '2026-01-31', plan: 'plus' };
    const now = { day: '2026-11-14', minuteOfDay: 600 };
    const copies = structuredClone({ spec, item, now });
    const first = evaluate(spec, item, now);
    const second = evaluate(spec, item, now);
    expect(second).toStrictEqual(first);
    expect({ spec, item, now }).toStrictEqual(copies);
  });

  it('returns results that share nothing with the spec', () => {
    const spec = specWith({ base: { type: 'duration', amount: 3, unit: 'day' }, rules: [{ id: 'm', kind: 'extend', by: days(1) }] });
    const r = value(evaluate(spec, { name: 'W', start: '2026-11-14' }, { day: '2026-11-14' }));
    const copy = structuredClone(spec);
    const lifespan = r.lifespans[0];
    if (!lifespan) throw new Error('no lifespan');
    lifespan.stage.label = 'changed';
    lifespan.trace.length = 0;
    expect(spec).toStrictEqual(copy);
  });
});
