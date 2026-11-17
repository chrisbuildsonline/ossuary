import { describe, expect, it } from 'vitest';
import { copyOf, widgetSpec } from '../testing/fixtures';
import { parseBoneSpec } from './bone-spec';
import { fieldsSchema } from './fields';
import { parseWith } from './issues';
import { validateItem } from './item';

const parse = (input: unknown) => parseWith(fieldsSchema, input);
const issuesOf = (input: unknown) => {
  const r = parse(input);
  return r.ok ? [] : r.error;
};

const name = { key: 'name', kind: 'text', label: 'Name', required: true };
const made = { key: 'made', kind: 'date', label: 'Made' };
const count = { key: 'count', kind: 'number', label: 'Count', min: 0, max: 10, step: 1 };
const place = { key: 'place', kind: 'enum', label: 'Place', options: [{ value: 'cold', label: 'Cold' }, { value: 'dry', label: 'Dry' }] };

describe('fieldsSchema', () => {
  it('accepts text, date, number and enum fields and keeps their order', () => {
    const r = parse([name, made, count, place]);
    expect(r).toEqual({ ok: true, value: [name, made, count, place] });
  });

  it('rejects an unknown kind', () => {
    const issues = issuesOf([{ key: 'x', kind: 'colour', label: 'X' }]);
    expect(issues).toEqual([{ path: '[0].kind', message: 'Expected one of: text, date, number, enum.' }]);
  });

  it('requires a lowercase identifier key', () => {
    expect(issuesOf([{ ...name, key: 'Name' }])[0]?.path).toBe('[0].key');
    expect(issuesOf([{ ...name, key: '1st' }])[0]?.message).toMatch(/lowercase/);
  });

  it('requires a label', () => {
    expect(issuesOf([{ key: 'x', kind: 'text' }])).toEqual([{ path: '[0].label', message: 'This is required.' }]);
  });

  it('rejects duplicate keys at the later field', () => {
    expect(issuesOf([name, { ...made, key: 'name' }])).toEqual([{ path: '[1].key', message: 'Duplicate field key "name".' }]);
  });

  it('needs at least one enum option', () => {
    expect(issuesOf([{ ...place, options: [] }])).toEqual([{ path: '[0].options', message: 'Must have at least 1 item.' }]);
  });

  it('rejects duplicate enum option values', () => {
    const options = [{ value: 'a', label: 'A' }, { value: 'a', label: 'Again' }];
    expect(issuesOf([{ ...place, options }])).toEqual([{ path: '[0].options[1].value', message: 'Duplicate option "a".' }]);
  });

  it('rejects number min greater than max at that field', () => {
    expect(issuesOf([{ ...count, min: 5, max: 2 }])).toEqual([{ path: '[0].min', message: 'Min (5) is greater than max (2).' }]);
  });

  it('rejects a non-positive step', () => {
    expect(issuesOf([{ ...count, step: 0 }])[0]?.path).toBe('[0].step');
  });

  it('rejects keys that do not belong to the kind', () => {
    expect(issuesOf([{ ...name, options: [] }])).toEqual([{ path: '[0].options', message: 'Unknown key "options".' }]);
    expect(issuesOf([{ ...made, min: 1 }])).toEqual([{ path: '[0].min', message: 'Unknown key "min".' }]);
  });

  it('accepts an optional boolean hidden on any kind', () => {
    const fields = [{ ...name, hidden: true }, { ...made, hidden: false }, { ...count, hidden: true }, { ...place, hidden: true }];
    expect(parse(fields)).toEqual({ ok: true, value: fields });
  });

  it('rejects a non-boolean hidden with the field path', () => {
    expect(issuesOf([name, { ...made, hidden: 'yes' }]).map((i) => i.path)).toEqual(['[1].hidden']);
    expect(issuesOf([{ ...place, hidden: 1 }]).map((i) => i.path)).toEqual(['[0].hidden']);
  });

  it('still validates a hidden required field on items', () => {
    const spec = copyOf(widgetSpec);
    spec.entity.fields.push({ key: 'ref', kind: 'text', label: 'Ref', required: true, hidden: true } as (typeof spec.entity.fields)[number]);
    const parsed = parseBoneSpec(spec);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    const values = { name: 'Blue widget', place: 'cold', made: '2026-11-04' };
    const missing = validateItem(parsed.value, values);
    expect(missing.ok).toBe(false);
    expect(missing.ok ? [] : missing.error.map((i) => i.path)).toEqual(['ref']);
    expect(validateItem(parsed.value, { ...values, ref: '' }).ok).toBe(false);
    expect(validateItem(parsed.value, { ...values, ref: 'r-1' })).toEqual({ ok: true, value: { ...values, ref: 'r-1' } });
  });

  it('needs one to 40 fields', () => {
    expect(issuesOf([])).toEqual([{ path: '', message: 'Must have at least 1 item.' }]);
    const many = Array.from({ length: 41 }, (_, i) => ({ key: `f${i}`, kind: 'text', label: `F${i}` }));
    expect(issuesOf(many)).toEqual([{ path: '', message: 'Must have at most 40 items.' }]);
  });
});
