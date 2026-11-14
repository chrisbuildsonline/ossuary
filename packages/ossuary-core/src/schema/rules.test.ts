import { describe, expect, it } from 'vitest';
import { parseWith } from './issues';
import { durationSchema, rulesSchema } from './rules';

const issuesOf = (input: unknown) => {
  const r = parseWith(rulesSchema, input);
  return r.ok ? [] : r.error;
};

const extend = { id: 'r1', kind: 'extend', label: 'Sealed', by: { amount: 2, unit: 'week' }, when: { field: 'sealed', equals: 'yes' } };
const shorten = { id: 'r2', kind: 'shorten', by: { amount: 1, unit: 'month' }, when: { field: 'count', equals: 3 }, sourceId: 'ref1' };
const clamp = { id: 'r3', kind: 'clamp', min: { amount: 1, unit: 'day' }, max: { amount: 1, unit: 'year' } };
const lookup = {
  id: 'r4',
  kind: 'lookup',
  field: 'place',
  table: { cold: { amount: 14, unit: 'day' }, 'Dry shelf': { amount: 3, unit: 'month' } },
  default: { amount: 0, unit: 'day' },
};

describe('durationSchema', () => {
  it('accepts a whole amount and one of four units', () => {
    for (const unit of ['day', 'week', 'month', 'year']) {
      expect(parseWith(durationSchema, { amount: 0, unit }).ok).toBe(true);
    }
  });

  it('rejects fractions, negatives and unknown units', () => {
    expect(parseWith(durationSchema, { amount: 1.5, unit: 'day' }).ok).toBe(false);
    expect(parseWith(durationSchema, { amount: -1, unit: 'day' }).ok).toBe(false);
    expect(parseWith(durationSchema, { amount: 1, unit: 'hour' })).toEqual({
      ok: false,
      error: [{ path: 'unit', message: 'Expected one of: day, week, month, year.' }],
    });
  });
});

describe('rulesSchema', () => {
  it('accepts every kind and keeps the declared order', () => {
    const rules = [clamp, lookup, shorten, extend];
    expect(parseWith(rulesSchema, rules)).toEqual({ ok: true, value: rules });
  });

  it('accepts no rules', () => {
    expect(parseWith(rulesSchema, [])).toEqual({ ok: true, value: [] });
  });

  it('rejects an unknown kind', () => {
    expect(issuesOf([{ id: 'r', kind: 'double' }])).toEqual([
      { path: '[0].kind', message: 'Expected one of: extend, shorten, clamp, lookup.' },
    ]);
  });

  it('needs a positive duration for extend and shorten', () => {
    expect(issuesOf([{ ...extend, by: { amount: 0, unit: 'day' } }])).toEqual([
      { path: '[0].by.amount', message: 'Must be at least 1.' },
    ]);
    expect(issuesOf([{ id: 'r', kind: 'shorten' }])).toEqual([{ path: '[0].by', message: 'This is required.' }]);
  });

  it('checks the shape of a when condition', () => {
    expect(issuesOf([{ ...extend, when: { field: 'sealed' } }])).toEqual([
      { path: '[0].when.equals', message: 'This is required.' },
    ]);
    expect(issuesOf([{ ...extend, when: { field: 'sealed', equals: 'yes', not: true } }])).toEqual([
      { path: '[0].when.not', message: 'Unknown key "not".' },
    ]);
  });

  it('needs a clamp to have min or max', () => {
    expect(issuesOf([{ id: 'r', kind: 'clamp' }])).toEqual([{ path: '[0]', message: 'A clamp needs min, max or both.' }]);
    expect(issuesOf([{ id: 'r', kind: 'clamp', max: { amount: 3, unit: 'day' } }])).toEqual([]);
  });

  it('rejects a clamp whose min is longer than its max at the rule', () => {
    const bad = { id: 'r', kind: 'clamp', min: { amount: 2, unit: 'month' }, max: { amount: 30, unit: 'day' } };
    expect(issuesOf([bad])).toEqual([{ path: '[0]', message: 'Min (2 months) is longer than max (30 days).' }]);
    const ok = { id: 'r', kind: 'clamp', min: { amount: 4, unit: 'week' }, max: { amount: 1, unit: 'month' } };
    expect(issuesOf([ok])).toEqual([]);
  });

  it('allows any key inside a lookup table but checks each duration', () => {
    expect(issuesOf([{ ...lookup, table: { cold: { amount: 1, unit: 'day', extra: 1 } } }])).toEqual([
      { path: '[0].table.cold.extra', message: 'Unknown key "extra".' },
    ]);
  });

  it('drops a __proto__ table key from JSON without touching the prototype', () => {
    const table = JSON.parse('{"__proto__": {"amount": 1, "unit": "day"}, "ok": {"amount": 2, "unit": "day"}}');
    const r = parseWith(rulesSchema, [{ ...lookup, table }]);
    const parsed = r.ok && r.value[0]?.kind === 'lookup' ? r.value[0].table : undefined;
    expect(parsed && Object.keys(parsed)).toEqual(['ok']);
    expect(parsed && Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });

  it('needs a field and a table for lookup, and has no when', () => {
    expect(issuesOf([{ id: 'r', kind: 'lookup', table: {} }])).toEqual([{ path: '[0].field', message: 'This is required.' }]);
    expect(issuesOf([{ ...lookup, when: { field: 'a', equals: 'b' } }])).toEqual([
      { path: '[0].when', message: 'Unknown key "when".' },
    ]);
  });

  it('needs a lowercase rule id', () => {
    expect(issuesOf([{ ...extend, id: 'R 1' }])[0]?.path).toBe('[0].id');
  });
});
