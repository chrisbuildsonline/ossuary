// Time zone safety. `bun run test:tz` runs the engine suite under TZ=UTC, America/New_York and Pacific/Auckland.
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { type BoneSpec, parseBoneSpec } from '../schema/bone-spec';
import { gizmoSpec } from '../testing/fixtures';
import { specWith } from '../testing/lifespan-spec';
import { specArbitrary } from '../testing/spec-arbitrary';
import { type Evaluation, evaluate } from './evaluate';

const zones = ['UTC', 'America/New_York', 'Pacific/Auckland'] as const;
const initialTz = process.env.TZ;

afterEach(() => {
  if (initialTz === undefined) delete process.env.TZ;
  else process.env.TZ = initialTz;
});

/** The local UTC offset, in minutes, of a fixed instant: it differs per zone only if the zone is in effect. */
const offsetInJanuary = () => new Date(Date.UTC(2026, 0, 15, 12)).getTimezoneOffset();

const gizmo = (() => {
  const r = parseBoneSpec(gizmoSpec);
  if (!r.ok) throw new Error('fixture invalid');
  return r.value;
})();

function ok(spec: BoneSpec, item: unknown, day: string, minuteOfDay?: number): Evaluation {
  const r = evaluate(spec, item, minuteOfDay === undefined ? { day } : { day, minuteOfDay });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

describe('time zone in effect', () => {
  it('runs under the TZ it was given', () => {
    const tz = process.env.TZ;
    if (tz) expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz);
    expect(typeof offsetInJanuary()).toBe('number');
  });
});

describe('dates across the 2026 daylight saving changes', () => {
  const short = specWith({ base: { type: 'duration', amount: 2, unit: 'day' } });
  const month = specWith({ base: { type: 'duration', amount: 1, unit: 'month' } });

  it.each([
    // New York springs forward on 2026-03-08 and falls back on 2026-11-01.
    ['2026-03-07', '2026-03-08', '2026-03-09', 1],
    ['2026-10-31', '2026-11-01', '2026-11-02', 1],
    // Auckland falls back on 2026-04-05 and springs forward on 2026-09-27.
    ['2026-04-04', '2026-04-05', '2026-04-06', 1],
    ['2026-09-26', '2026-09-27', '2026-09-28', 1],
  ])('start %s, now %s: expires %s with %i day left', (start, now, expires, left) => {
    for (const minute of [undefined, 0, 90, 150, 1439]) {
      const l = ok(short, { name: 'W', start }, now, minute).lifespans[0];
      expect(l).toMatchObject({ startedAt: start, expiresAt: expires, remaining: { days: left }, fraction: 0.5 });
    }
  });

  it.each([
    ['2026-02-08', '2026-03-08', '2026-03-08', 0],
    ['2026-10-01', '2026-11-01', '2026-11-01', 0],
    ['2026-03-05', '2026-04-05', '2026-04-05', 0],
    ['2026-08-27', '2026-09-27', '2026-09-27', 0],
  ])('start %s + 1 month expires %s; on %s it has %i days left and 24 hours', (start, expires, now, left) => {
    const l = ok(month, { name: 'W', start }, now, 0).lifespans[0];
    expect(l).toMatchObject({ expiresAt: expires, remaining: { days: left, hours: 24 } });
  });

  it('counts whole days across both New York changes in one lifespan', () => {
    const r = ok(gizmo, { name: 'Gizmo', bought: '2026-03-01', plan: 'plus' }, '2026-11-14');
    expect(r.lifespans.map((l) => [l.expiresAt, l.remaining.days])).toEqual([
      ['2026-04-14', -214],
      ['2029-03-01', 838],
    ]);
    expect(r.primaryIndex).toBe(1);
  });
});

describe('results are equal in every zone', () => {
  it('switches zones in this process', () => {
    const offsets = zones.map((tz) => {
      process.env.TZ = tz;
      return offsetInJanuary();
    });
    expect(offsets).toEqual([0, 300, -780]);
  });

  it('evaluates generated specs to deeply equal results under each zone', () => {
    const days = ['2026-03-08', '2026-04-05', '2026-09-27', '2026-11-01'];
    fc.assert(
      fc.property(specArbitrary, fc.constantFrom(...days), fc.integer({ min: 0, max: 1439 }), (spec, day, minute) => {
        const item = { name: 'Thing', start: '2026-02-28', ends: '2026-11-01', place: 'a' };
        const results = zones.map((tz) => {
          process.env.TZ = tz;
          return evaluate(spec, item, { day, minuteOfDay: minute });
        });
        for (const r of results) expect(r).toStrictEqual(results[0]);
      }),
      { seed: 201, numRuns: 150 },
    );
  });
});
