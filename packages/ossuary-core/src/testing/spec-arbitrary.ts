// fast-check arbitrary of valid bone specs with one to four lifespans. Test support only: not exported from the package.
import fc from 'fast-check';
import type { BoneSpec } from '../schema/bone-spec';
import { units } from '../schema/rules';

const unit = fc.constantFrom(...units);
// Plain objects, as JSON.parse would make them.
const plain = { noNullPrototype: true } as const;
const duration = (min: number, max: number) => fc.record({ amount: fc.integer({ min, max }), unit }, plain);
const days = (amount: number) => ({ amount, unit: 'day' });

const themes = [
  { accent: '#3657c9', accentInk: '#3657c9', accentTint: '#e8edfa', canvas: '#eef0f4', display: 'inter', motif: 'hourglass', emptyArt: 'hourglass-side', wordmark: 'Core' },
  { accent: '#b8460e', accentInk: '#9a3a0b', accentTint: '#fbe9dc', canvas: '#f2efea', display: 'fraunces', motif: 'candle', emptyArt: 'candle-jar-moon', wordmark: 'Warm' },
  { accent: '#5a4bd1', accentInk: '#5a4bd1', accentTint: '#ebe9fb', canvas: '#edeff6', display: 'space-grotesk', motif: 'ghost', emptyArt: 'ghost-parcel', wordmark: 'Cool' },
];

function lifespanArbitrary(values: string[]) {
  const when = fc.constantFrom(...values).map((equals) => ({ field: 'place', equals }));
  const shift = (kind: 'extend' | 'shorten') =>
    fc.record({ kind: fc.constant(kind), by: duration(1, 60), when }, { ...plain, requiredKeys: ['kind', 'by'] });
  const clamp = fc
    .tuple(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 400 }), fc.constantFrom('min', 'max', 'both'))
    .map(([a, b, which]) => {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      return {
        kind: 'clamp',
        ...(which !== 'max' && { min: days(lo) }),
        ...(which !== 'min' && { max: days(hi) }),
      };
    });
  const lookup = fc
    .tuple(fc.array(duration(0, 120), { minLength: values.length, maxLength: values.length }), fc.boolean(), duration(0, 120))
    .map(([durations, partial, fallback]) => {
      const covered = partial ? values.slice(1) : values;
      return {
        kind: 'lookup',
        field: 'place',
        table: Object.fromEntries(covered.map((v, i) => [v, durations[i]])),
        ...(partial && { default: fallback }),
      };
    });
  const rule = fc.oneof(shift('extend'), shift('shorten'), clamp, lookup);

  const tone = fc.constantFrom('fresh', 'steady', 'soon', 'urgent');
  const stages = fc
    .tuple(fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { maxLength: 6 }), fc.array(tone, { minLength: 7, maxLength: 7 }))
    .map(([thresholds, tones]) => [
      { id: 's0', label: 'Stage 0', tone: tones[0] },
      ...thresholds
        .sort((a, b) => b - a)
        .map((enterAtDays, i) => ({ id: `s${i + 1}`, label: `Stage ${i + 1}`, tone: tones[i + 1], enterAtDays })),
      { id: 'end', label: 'Ended', tone: 'dead' },
    ]);

  const base = fc.oneof(
    duration(0, 400).map((d) => ({ type: 'duration', ...d })),
    fc.constant({ type: 'field', field: 'ends' }),
  );

  return fc.record(
    {
      base,
      rules: fc.array(rule, { maxLength: 5 }).map((rules) => rules.map((r, i) => ({ id: `r${i}`, ...r }))),
      stages,
    },
    plain,
  );
}

/** Valid bone specs: fields name, start, ends, place (enum), count; one to four lifespans. */
export const specArbitrary: fc.Arbitrary<BoneSpec> = fc
  .uniqueArray(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 4 })
  .chain((values) =>
    fc.record(
      {
        lifespans: fc.array(lifespanArbitrary(values), { minLength: 1, maxLength: 4 }),
        theme: fc.constantFrom(...themes),
      },
      { ...plain, requiredKeys: ['lifespans'] },
    ).map(({ lifespans, theme }) => ({
      id: 'generated',
      name: 'Generated',
      version: 1,
      entity: {
        titleField: 'name',
        fields: [
          { key: 'name', kind: 'text', label: 'Name', required: true },
          { key: 'start', kind: 'date', label: 'Start', required: true },
          { key: 'ends', kind: 'date', label: 'Ends', required: true },
          { key: 'place', kind: 'enum', label: 'Place', options: values.map((value) => ({ value, label: value.toUpperCase() })) },
          { key: 'count', kind: 'number', label: 'Count', min: 0 },
        ],
      },
      lifespans: lifespans.map((l, i) => ({ id: `l${i}`, label: `Lifespan ${i}`, startField: 'start', ...l })),
      ...(theme && { theme }),
    })),
  ) as unknown as fc.Arbitrary<BoneSpec>;
