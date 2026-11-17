import { describe, expect, it } from 'vitest';
import { parseWith } from './issues';
import { lifespansSchema } from './lifespans';

const issuesOf = (input: unknown) => {
  const r = parseWith(lifespansSchema, input);
  return r.ok ? [] : r.error;
};

const stages = [
  { id: 'ok', label: 'Fine', tone: 'fresh' },
  { id: 'soon', label: 'Soon', tone: 'soon', enterAtDays: 7 },
  { id: 'gone', label: 'Gone', tone: 'dead' },
];

const lifespan = (id: string) => ({
  id,
  label: `Ends ${id}`,
  startField: 'made',
  base: { type: 'duration', amount: 30, unit: 'day', label: 'Base' },
  rules: [
    { id: 'r1', kind: 'extend', by: { amount: 1, unit: 'week' } },
    { id: 'r2', kind: 'clamp', max: { amount: 1, unit: 'year' } },
  ],
  stages,
});

describe('lifespansSchema', () => {
  it('accepts one lifespan', () => {
    expect(parseWith(lifespansSchema, [lifespan('main')])).toEqual({ ok: true, value: [lifespan('main')] });
  });

  it('accepts four lifespans and keeps their declared order', () => {
    const four = ['d', 'a', 'c', 'b'].map(lifespan);
    const r = parseWith(lifespansSchema, four);
    expect(r.ok && r.value.map((l) => l.id)).toEqual(['d', 'a', 'c', 'b']);
  });

  it('rejects five lifespans', () => {
    expect(issuesOf(['a', 'b', 'c', 'd', 'e'].map(lifespan))).toEqual([{ path: '', message: 'Must have at most 4 items.' }]);
  });

  it('rejects an empty array and a non-array', () => {
    expect(issuesOf([])).toEqual([{ path: '', message: 'Must have at least 1 item.' }]);
    expect(issuesOf({ main: lifespan('main') })).toEqual([{ path: '', message: 'Expected a list.' }]);
  });

  it('rejects a duplicate lifespan id', () => {
    expect(issuesOf([lifespan('main'), lifespan('main')])).toEqual([
      { path: '[1].id', message: 'Duplicate lifespan id "main".' },
    ]);
  });

  it('accepts a lifespan without rules', () => {
    const { rules: _rules, ...bare } = lifespan('main');
    expect(issuesOf([bare])).toEqual([]);
  });

  it('accepts a date field as the base', () => {
    expect(issuesOf([{ ...lifespan('main'), base: { type: 'field', field: 'ends', sourceId: 'ref1' } }])).toEqual([]);
  });

  it('rejects an unknown base type and a base with both shapes', () => {
    expect(issuesOf([{ ...lifespan('main'), base: { type: 'forever' } }])).toEqual([
      { path: '[0].base.type', message: 'Expected one of: duration, field.' },
    ]);
    expect(issuesOf([{ ...lifespan('main'), base: { type: 'field', field: 'ends', amount: 3, unit: 'day' } }])).toEqual([
      { path: '[0].base.amount', message: 'Unknown key "amount".' },
      { path: '[0].base.unit', message: 'Unknown key "unit".' },
    ]);
  });

  it('accepts amountField on a duration base and rejects it on a field base', () => {
    expect(issuesOf([{ ...lifespan('main'), base: { type: 'duration', amount: 30, unit: 'day', amountField: 'count' } }])).toEqual([]);
    expect(issuesOf([{ ...lifespan('main'), base: { type: 'field', field: 'ends', amountField: 'count' } }])).toEqual([
      { path: '[0].base.amountField', message: 'Unknown key "amountField".' },
    ]);
  });

  it('allows a zero-length duration base but not a negative one', () => {
    expect(issuesOf([{ ...lifespan('main'), base: { type: 'duration', amount: 0, unit: 'day' } }])).toEqual([]);
    expect(issuesOf([{ ...lifespan('main'), base: { type: 'duration', amount: -1, unit: 'day' } }])[0]?.path).toBe(
      '[0].base.amount',
    );
  });

  it('needs a startField, a label and stages', () => {
    const { startField: _s, label: _l, stages: _st, ...rest } = lifespan('main');
    expect(issuesOf([rest]).map((i) => i.path)).toEqual(['[0].label', '[0].startField', '[0].stages']);
  });

  it('needs unique rule ids within a lifespan, but not across lifespans', () => {
    const rules = [
      { id: 'r1', kind: 'extend', by: { amount: 1, unit: 'week' } },
      { id: 'r1', kind: 'shorten', by: { amount: 1, unit: 'day' } },
    ];
    expect(issuesOf([lifespan('a'), { ...lifespan('b'), rules }])).toEqual([
      { path: '[1].rules[1].id', message: 'Duplicate rule id "r1".' },
    ]);
  });

  it('reports a stage problem with the lifespan index in the path', () => {
    const bad = [stages[0], { ...stages[1], enterAtDays: undefined }, stages[2]];
    expect(issuesOf([lifespan('a'), { ...lifespan('b'), stages: bad }])).toEqual([
      { path: '[1].stages[1].enterAtDays', message: 'This stage needs enterAtDays, the days left when it starts.' },
    ]);
  });
});
