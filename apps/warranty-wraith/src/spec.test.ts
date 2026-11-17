import { type Evaluation, evaluate, fromDayNumber, toDayNumber } from '@ossuary/core/engine';
import { parseBoneSpec } from '@ossuary/core/schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import bone from '../bone.json';
import { boneSpec, defaults, nowFromClock } from './spec';

const snake = /^[a-z][a-z0-9_]*$/;
const NOW = '2026-11-17';

const daysBefore = (day: string, n: number): string => fromDayNumber(toDayNumber(day) - n);

function run(values: Record<string, unknown>, day = NOW): Evaluation {
  const r = evaluate(boneSpec, { name: 'Kettle', retailer: 'Shop', ...values }, { day });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

describe('bone.json', () => {
  it('parses with the warranty-wraith id, the copy and two lifespans in order', () => {
    const r = parseBoneSpec(bone);
    expect(r.ok).toBe(true);
    expect(boneSpec.id).toBe('warranty-wraith');
    expect(boneSpec.name).toBe('Warranty Wraith');
    expect(boneSpec.copy).toEqual({ emptyTitle: 'No ghosts in the drawer yet.', addLabel: 'Add purchase' });
    expect(boneSpec.lifespans.map((l) => [l.id, l.label, l.startField, l.rules ?? []])).toEqual([
      ['return_window', 'Return window', 'bought', []],
      ['warranty', 'Warranty', 'bought', []],
    ]);
  });

  it('uses snake_case for every field, lifespan, rule, stage and source id', () => {
    const ids = [
      ...boneSpec.entity.fields.map((f) => f.key),
      ...boneSpec.lifespans.flatMap((l) => [l.id, ...(l.rules ?? []).map((r) => r.id), ...l.stages.map((s) => s.id)]),
      ...(boneSpec.sources ?? []).map((s) => s.id),
    ];
    expect(ids.length).toBeGreaterThan(15);
    for (const id of ids) expect(id).toMatch(snake);
  });

  it('declares the field table in order', () => {
    expect(boneSpec.entity.titleField).toBe('name');
    expect(boneSpec.entity.summaryFields).toEqual(['retailer', 'model']);
    // The raw JSON, so every declared key is checked as written.
    expect(bone.entity.fields).toStrictEqual([
      { key: 'name', kind: 'text', label: 'Item', required: true },
      { key: 'retailer', kind: 'text', label: 'Bought at', required: true },
      { key: 'bought', kind: 'date', label: 'Bought on', required: true },
      { key: 'return_days', kind: 'number', label: 'Return window (days)', min: 0, max: 365, step: 1 },
      { key: 'warranty_months', kind: 'number', label: 'Warranty (months)', min: 0, max: 120, step: 1 },
      { key: 'price', kind: 'number', label: 'Price', min: 0, step: 0.01 },
      { key: 'model', kind: 'text', label: 'Model' },
      { key: 'recalls_dismissed', kind: 'text', label: 'Dismissed recalls', hidden: true },
    ]);
  });

  it('gives each lifespan a duration base read from its number field', () => {
    expect(boneSpec.lifespans.map((l) => l.base)).toEqual([
      { type: 'duration', amount: 30, unit: 'day', amountField: 'return_days', label: 'Return window' },
      { type: 'duration', amount: 12, unit: 'month', amountField: 'warranty_months', label: 'Warranty' },
    ]);
  });

  it('gives the bases human labels, never "Base"', () => {
    for (const l of boneSpec.lifespans) {
      expect(l.base.label).toBeTruthy();
      expect(l.base.label?.trim().toLowerCase()).not.toBe('base');
    }
  });

  it('declares the stages, with one label per tone across both lifespans', () => {
    const stages = (i: number) => boneSpec.lifespans[i]?.stages.map((s) => [s.id, s.label, s.tone, s.enterAtDays]);
    expect(stages(0)).toEqual([
      ['covered', 'Covered', 'fresh', undefined],
      ['closing', 'Closing', 'soon', 7],
      ['last_days', 'Last days', 'urgent', 2],
      ['lapsed', 'Lapsed', 'dead', undefined],
    ]);
    expect(stages(1)).toEqual([
      ['covered', 'Covered', 'fresh', undefined],
      ['ending', 'Ending', 'steady', 90],
      ['closing', 'Closing', 'soon', 30],
      ['last_days', 'Last days', 'urgent', 7],
      ['lapsed', 'Lapsed', 'dead', undefined],
    ]);
    const labelByTone = new Map<string, Set<string>>();
    for (const s of boneSpec.lifespans.flatMap((l) => l.stages)) labelByTone.set(s.tone, (labelByTone.get(s.tone) ?? new Set()).add(s.label));
    for (const labels of labelByTone.values()) expect(labels.size).toBe(1);
  });

  it('uses the cool theme from DESIGN.md section 4, and nothing else', () => {
    expect(bone.theme).toStrictEqual({
      accent: '#5a4bd1',
      accentInk: '#5a4bd1',
      accentTint: '#ebe9fb',
      canvas: '#edeff6',
      display: 'space-grotesk',
      motif: 'ghost',
      emptyArt: 'ghost-parcel',
      wordmark: 'Warranty Wraith',
    });
    expect(boneSpec.theme).toEqual(bone.theme);
  });

  it("differs from Pantry Reaper's literal theme and copy (DESIGN.md) in every value", () => {
    const pantry: Record<string, string> = {
      accent: '#b8460e',
      accentInk: '#9a3a0b',
      accentTint: '#fbe9dc',
      canvas: '#f2efea',
      display: 'fraunces',
      motif: 'candle',
      emptyArt: 'candle-jar-moon',
      wordmark: 'Pantry Reaper',
    };
    for (const [key, value] of Object.entries(bone.theme)) expect([key, value]).not.toEqual([key, pantry[key]]);
    expect(Object.keys(bone.theme).sort()).toEqual(Object.keys(pantry).sort());
    expect(bone.copy.emptyTitle).not.toBe("Nothing's dying yet.");
    expect(bone.copy.addLabel).not.toBe('Add food');
  });

  it('declares the CPSC recalls source as public domain over https, without a query', () => {
    expect(boneSpec.sources).toHaveLength(1);
    const source = boneSpec.sources?.[0];
    expect(source).toMatchObject({ id: 'cpsc_recalls', name: 'CPSC Recalls', url: 'https://www.saferproducts.gov/RestWebServices/Recall' });
    expect(source?.url).not.toContain('?');
    expect(source?.license).toMatch(/public domain/i);
    expect(source?.license).toMatch(/US government work/i);
  });
});

describe('defaults', () => {
  it('equal the base amounts of the two lifespans', () => {
    expect(defaults).toEqual({ returnDays: 30, warrantyMonths: 12 });
    expect(defaults.returnDays).toBe(bone.lifespans[0]?.base.amount);
    expect(defaults.warrantyMonths).toBe(bone.lifespans[1]?.base.amount);
  });
});

describe('primary lifespan', () => {
  it('is the return window for a new purchase, which closes first', () => {
    const e = run({ bought: NOW });
    expect(e.primaryIndex).toBe(0);
    expect(e.lifespans.map((l) => l.expiresAt)).toEqual(['2026-12-17', '2027-11-17']);
    expect(e.lifespans[0]?.stage.id).toBe('covered');
  });

  it('is the live warranty once the return window has lapsed (40 days old, default periods)', () => {
    const e = run({ bought: daysBefore(NOW, 40) });
    expect(e.lifespans[0]?.remaining.days).toBe(-10);
    expect(e.lifespans[0]?.stage.tone).toBe('dead');
    expect(e.primaryIndex).toBe(1);
    expect(e.lifespans[1]?.stage.tone).not.toBe('dead');
    expect(e.lifespans[1]?.stage.id).toBe('covered');
  });

  it('uses the typed periods: 14 days and 24 months', () => {
    const e = run({ bought: NOW, return_days: 14, warranty_months: 24 });
    expect(e.lifespans.map((l) => l.expiresAt)).toEqual(['2026-12-01', '2028-11-17']);
  });

  it('is dead only when both have lapsed', () => {
    const e = run({ bought: daysBefore(NOW, 400) });
    expect(e.lifespans.map((l) => l.stage.tone)).toEqual(['dead', 'dead']);
  });

  it('never makes a dead lifespan primary while either is live (fast-check)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 365 }), fc.integer({ min: 0, max: 120 }), fc.integer({ min: 0, max: 4000 }), (returnDays, months, age) => {
        const e = run({ bought: daysBefore(NOW, age), return_days: returnDays, warranty_months: months });
        const tones = e.lifespans.map((l) => l.stage.tone);
        const primary = e.lifespans[e.primaryIndex];
        if (tones.some((t) => t !== 'dead')) expect(primary?.stage.tone).not.toBe('dead');
        else expect(primary?.stage.tone).toBe('dead');
      }),
      { seed: 20261117, numRuns: 300 },
    );
  });
});

describe('the two lifespans are independent', () => {
  it('changing return_days moves only the return window, and warranty_months only the warranty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 365 }),
        fc.integer({ min: 0, max: 365 }),
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 0, max: 2000 }),
        (d1, d2, m1, m2, age) => {
          const bought = daysBefore(NOW, age);
          const a = run({ bought, return_days: d1, warranty_months: m1 });
          const b = run({ bought, return_days: d2, warranty_months: m1 });
          const c = run({ bought, return_days: d1, warranty_months: m2 });
          expect(b.lifespans[1]).toEqual(a.lifespans[1]);
          expect(c.lifespans[0]).toEqual(a.lifespans[0]);
        },
      ),
      { seed: 20261118, numRuns: 200 },
    );
  });
});

describe('nowFromClock', () => {
  it('reads the local day and minute of the day', () => {
    expect(nowFromClock(new Date(2026, 10, 17, 9, 30))).toEqual({ day: '2026-11-17', minuteOfDay: 570 });
    expect(nowFromClock(new Date(2026, 0, 1, 0, 0))).toEqual({ day: '2026-01-01', minuteOfDay: 0 });
    expect(nowFromClock(new Date(2026, 11, 31, 23, 59, 59))).toEqual({ day: '2026-12-31', minuteOfDay: 1439 });
  });
});
