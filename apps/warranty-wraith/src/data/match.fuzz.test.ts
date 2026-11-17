import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Recall } from './cpsc';
import { matchRecalls } from './match';
import recallsJson from './recalls.json';

const real = recallsJson as Recall[];
const words = (s: string) => s.split(/[^A-Za-z0-9]+/).filter(Boolean);

// A word no stop list holds: "x" and 4 to 7 letters.
const word = fc.stringMatching(/^[a-z]{4,7}$/).map((w) => `x${w}`);
const modelText = fc.tuple(fc.stringMatching(/^[A-Z]{1,3}$/), fc.integer({ min: 100, max: 99999 })).map(([a, n]) => `${a}-${n}`);

/** Recalls with distinct made-up brands, names and models, plus the real ones so the generic set is real. */
const syntheticRecalls = fc
  .uniqueArray(fc.tuple(word, word, word, modelText), { minLength: 1, maxLength: 8, selector: ([b]) => b })
  .map((rows) =>
    rows.map(([brand, n1, n2, model], i): Recall => ({
      id: `s-${i}`,
      date: `2026-0${(i % 9) + 1}-01`,
      title: `${brand} recall`,
      hazard: 'Fall',
      url: `https://www.cpsc.gov/Recalls/2026/s-${i}`,
      names: [`${n1} ${n2}`],
      brands: [`${brand} Inc.`],
      models: [model],
    })),
  );

describe('matchRecalls properties (fixed seeds)', () => {
  it('never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), fc.option(fc.string({ unit: 'binary' }), { nil: undefined }), (name, model) => {
        const result = matchRecalls(model === undefined ? { name } : { name, model }, real);
        expect(result.length).toBeLessThanOrEqual(5);
      }),
      { seed: 2301, numRuns: 400 },
    );
  });

  it('matches nothing for an empty name, whatever the model', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), modelText), (model) => {
        expect(matchRecalls({ name: '', model }, real)).toEqual([]);
      }),
      { seed: 2302, numRuns: 200 },
    );
  });

  it('ignores case, accents, punctuation and token order in the item name', () => {
    const marks = ['́', '̀', '̈', ''];
    const seps = [' ', ', ', ' - ', '/', '!  ', ' & '];
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: real.length - 1 }),
        fc.integer({ min: 0, max: 9 }),
        fc.func(fc.boolean()),
        fc.func(fc.constantFrom(...marks)),
        fc.func(fc.constantFrom(...seps)),
        (index, rotate, upper, mark, sep) => {
          const r = real[index]!;
          const plain = words(`${r.brands[0] ?? ''} ${r.names[0] ?? ''}`);
          const turned = [...plain.slice(rotate % Math.max(plain.length, 1)), ...plain.slice(0, rotate % Math.max(plain.length, 1))];
          const messy = turned
            .map((w, i) => {
              const cased = upper(i, w) ? w.toUpperCase() : w.toLowerCase();
              return /^[a-z]/i.test(cased) ? `${cased[0]}${mark(i, w)}${cased.slice(1)}` : cased;
            })
            .reduce((acc, w, i) => (i === 0 ? w : `${acc}${sep(i)}${w}`), '');
          expect(matchRecalls({ name: messy }, real)).toEqual(matchRecalls({ name: plain.join(' ') }, real));
        },
      ),
      { seed: 2303, numRuns: 300 },
    );
  });

  it('returns at most 5 matches, ranked by score, then newer day, then id', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: real.length - 1 }), fc.integer({ min: 0, max: real.length - 1 }), (a, b) => {
        const name = `${real[a]!.names[0]} ${real[b]!.names[0]}`;
        const result = matchRecalls({ name }, real);
        expect(result.length).toBeLessThanOrEqual(5);
        for (let i = 1; i < result.length; i++) {
          const [p, q] = [result[i - 1]!, result[i]!];
          const order = p.score - q.score || p.recall.date.localeCompare(q.recall.date) || q.recall.id.localeCompare(p.recall.id);
          expect(order).toBeGreaterThan(0);
        }
      }),
      { seed: 2304, numRuns: 200 },
    );
  });

  it('finds every recall that has a brand, a model and a product name from those three', () => {
    fc.assert(
      fc.property(syntheticRecalls, (synthetic) => {
        const recalls = [...synthetic, ...real];
        for (const r of recalls.filter((x) => x.brands.length && x.models.length && x.names.length)) {
          const item = { name: `${r.brands[0]} ${r.names[0]}`, model: r.models[0] };
          expect(matchRecalls(item, recalls).map((m) => m.recall.id)).toContain(r.id);
        }
      }),
      { seed: 2305, numRuns: 100 },
    );
  });

  it('finds every real recall from its brand and product name when the brand has a word and the name adds one', () => {
    let checked = 0;
    for (const r of real) {
      const brand = r.brands.find((b) => words(b).some((w) => w.length >= 3));
      const name = r.names[0] ?? '';
      if (!brand || !words(name).some((w) => w.length >= 3 && !words(brand).some((b) => b.toLowerCase() === w.toLowerCase()))) continue;
      checked++;
      expect(matchRecalls({ name: `${brand} ${name}` }, real).map((m) => m.recall.id), `${r.id}: ${brand} ${name}`).toContain(r.id);
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('does not mutate its arguments and gives equal output for equal input', () => {
    fc.assert(
      fc.property(syntheticRecalls, fc.string(), (synthetic, extra) => {
        const recalls = [...synthetic, ...real.slice(0, 50)];
        const first = synthetic[0]!;
        const item = { name: `${first.brands[0]} ${first.names[0]} ${extra}`, model: first.models[0] };
        const before = structuredClone({ item, recalls });
        const a = matchRecalls(item, recalls);
        expect({ item, recalls }).toEqual(before);
        expect(matchRecalls(structuredClone(item), structuredClone(recalls))).toEqual(a);
      }),
      { seed: 2306, numRuns: 100 },
    );
  });
});
