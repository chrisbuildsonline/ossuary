import { describe, expect, it } from 'vitest';
import { parseBoneSpec } from '../schema/bone-spec';
import type { BoneSpec } from '../schema/bone-spec';
import type { Item } from '../schema/item';
import { widgetSpec } from '../testing/fixtures';
import { days, months, specWith, weeks, years } from '../testing/lifespan-spec';
import { runLifespan } from './rules';
import { traceLines } from './trace';

function linesOf(spec: BoneSpec, item: Item, index = 0) {
  const lifespan = spec.lifespans[index];
  if (!lifespan) throw new Error('no lifespan');
  const run = runLifespan(lifespan, item);
  return { run, lines: traceLines(spec, run.steps) };
}

const widget = (() => {
  const r = parseBoneSpec(widgetSpec);
  if (!r.ok) throw new Error('fixture invalid');
  return r.value;
})();

const item = (extra: Item = {}): Item => ({ name: 'Widget', start: '2026-11-14', ...extra });

describe('traceLines', () => {
  it('writes one line for the base and one per applied rule, naming sources', () => {
    const { lines } = linesOf(widget, { name: 'Widget', place: 'shelf', made: '2026-11-14', opened: 'yes' });
    expect(lines).toStrictEqual([
      { ruleId: 'base', kind: 'base', text: 'Base: Base 14 days (Example reference)', deltaDays: 14, changed: true, sourceId: 'ref1' },
      { ruleId: 'by_place', kind: 'lookup', text: 'Kept in is Shelf: 1 year (Example reference)', deltaDays: 351, changed: true, sourceId: 'ref1' },
      { ruleId: 'opened', kind: 'shorten', text: 'Opened shortens by 7 days', deltaDays: -7, changed: true },
      { ruleId: 'limit', kind: 'clamp', text: 'Limit: no change', deltaDays: 0, changed: false },
    ]);
  });

  it('skips rules whose when condition is false', () => {
    const { lines } = linesOf(widget, { name: 'Widget', place: 'cold', made: '2026-11-14', opened: 'no' });
    expect(lines.map((l) => l.ruleId)).toEqual(['base', 'by_place', 'limit']);
    expect(lines[1]).toMatchObject({ text: 'Kept in is Cold: 14 days (Example reference)', deltaDays: 0, changed: false });
  });

  it('deltas add up to the expiry minus the start', () => {
    const { run, lines } = linesOf(widget, { name: 'Widget', place: 'deep_cold', made: '2026-01-31', opened: 'yes' });
    expect(lines.reduce((sum, l) => sum + l.deltaDays, 0)).toBe(run.expiry - run.start);
  });

  it('uses fallback labels when the spec gives none', () => {
    const spec = specWith({
      base: { type: 'duration', amount: 1, unit: 'day' },
      rules: [
        { id: 'more', kind: 'extend', by: days(1) },
        { id: 'less', kind: 'shorten', by: days(1) },
        { id: 'lim', kind: 'clamp', max: days(30) },
      ],
    });
    expect(linesOf(spec, item()).lines.map((l) => l.text)).toEqual([
      'Base: Base lifespan 1 day',
      'more extends by 1 day',
      'less shortens by 1 day',
      'Limit: no change',
    ]);
  });

  it('describes a clamp that bites, in the units of the spec', () => {
    const atMost = specWith({ base: { type: 'duration', amount: 2, unit: 'year' }, rules: [{ id: 'lim', kind: 'clamp', label: 'Cap', max: months(3) }] });
    expect(linesOf(atMost, item()).lines[1]).toMatchObject({ text: 'Cap: at most 3 months', changed: true });
    const atLeast = specWith({ base: { type: 'duration', amount: 2, unit: 'day' }, rules: [{ id: 'lim', kind: 'clamp', min: years(1), sourceId: 'ref' }] });
    expect(linesOf(atLeast, item()).lines[1]).toMatchObject({ text: 'Limit: at least 1 year (Reference Book)', deltaDays: 363, sourceId: 'ref' });
  });

  it('says when a shorten stops at the start day', () => {
    const spec = specWith({ base: { type: 'duration', amount: 3, unit: 'day' }, rules: [{ id: 'less', kind: 'shorten', label: 'Used', by: days(10) }] });
    expect(linesOf(spec, item()).lines[1]).toMatchObject({ text: 'Used shortens by 10 days, stopped at the start day', deltaDays: -3 });
  });

  it('describes lookup defaults and missing values', () => {
    const spec = specWith({
      base: { type: 'duration', amount: 3, unit: 'day' },
      rules: [{ id: 'where', kind: 'lookup', field: 'place', table: { a: days(5) }, default: weeks(2) }],
    });
    expect(linesOf(spec, item({ place: 'a' })).lines[1]?.text).toBe('Place is Shelf A: 5 days');
    expect(linesOf(spec, item({ place: 'b' })).lines[1]?.text).toBe('Place is Shelf B: 2 weeks (default)');
    expect(linesOf(spec, item()).lines[1]?.text).toBe('Place not set: 2 weeks (default)');
  });

  it('quotes free text values in a lookup', () => {
    const spec = specWith({
      base: { type: 'duration', amount: 3, unit: 'day' },
      rules: [{ id: 'where', kind: 'lookup', field: 'note', table: { long: days(50) } }],
    });
    expect(linesOf(spec, item({ note: 'long' })).lines[1]?.text).toBe('Note is "long": 50 days');
  });

  it('names the date field of a field base', () => {
    const spec = specWith({ base: { type: 'field', field: 'ends', sourceId: 'ref' } });
    expect(linesOf(spec, item({ ends: '2026-12-01' })).lines[0]).toStrictEqual({
      ruleId: 'base',
      kind: 'base',
      text: 'Base: Ends 2026-12-01 (Reference Book)',
      deltaDays: 17,
      changed: true,
      sourceId: 'ref',
    });
  });
});
