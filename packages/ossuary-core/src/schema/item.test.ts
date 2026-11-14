import { describe, expect, it } from 'vitest';
import { gizmoSpec, widgetSpec } from '../testing/fixtures';
import { type BoneSpec, parseBoneSpec } from './bone-spec';
import { buildItemSchema, validateItem } from './item';

const specOf = (input: unknown): BoneSpec => {
  const r = parseBoneSpec(input);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const widget = specOf(widgetSpec);
const gizmo = specOf(gizmoSpec);
const item = { name: 'Blue widget', place: 'cold', made: '2026-11-09', opened: 'yes', count: 3 };

const issuesOf = (spec: BoneSpec, input: unknown) => {
  const r = validateItem(spec, input);
  return r.ok ? [] : r.error;
};

describe('validateItem', () => {
  it('accepts a valid item and returns its values', () => {
    expect(validateItem(widget, item)).toEqual({ ok: true, value: item });
  });

  it('accepts an item without its optional fields', () => {
    expect(validateItem(gizmo, { name: 'Gizmo', bought: '2026-01-31' })).toEqual({
      ok: true,
      value: { name: 'Gizmo', bought: '2026-01-31' },
    });
  });

  it('reports each missing required field', () => {
    expect(issuesOf(widget, { place: 'cold' })).toEqual([
      { path: 'name', message: 'This is required.' },
      { path: 'made', message: 'This is required.' },
    ]);
  });

  it('treats empty text in a required field as missing', () => {
    expect(issuesOf(widget, { ...item, name: '' })).toEqual([{ path: 'name', message: 'This is required.' }]);
  });

  it('rejects values of the wrong kind', () => {
    expect(issuesOf(widget, { ...item, name: 5, count: '3' })).toEqual([
      { path: 'name', message: 'Expected text.' },
      { path: 'count', message: 'Expected a number.' },
    ]);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-2-3', '26-02-03', '2026-02-03T00:00', '1900-02-29'])('rejects the day %s', (day) => {
    expect(issuesOf(widget, { ...item, made: day })).toEqual([
      { path: 'made', message: 'Use a real calendar day as YYYY-MM-DD.' },
    ]);
  });

  it('accepts leap days', () => {
    expect(issuesOf(widget, { ...item, made: '2024-02-29' })).toEqual([]);
    expect(issuesOf(widget, { ...item, made: '2000-02-29' })).toEqual([]);
  });

  it('rejects an enum value that is not an option', () => {
    expect(issuesOf(widget, { ...item, place: 'Cold' })).toEqual([
      { path: 'place', message: 'Expected one of: cold, deep_cold, shelf.' },
    ]);
  });

  it('applies number min and max', () => {
    expect(issuesOf(widget, { ...item, count: -1 })).toEqual([{ path: 'count', message: 'Must be at least 0.' }]);
    expect(issuesOf(gizmo, { name: 'G', bought: '2026-01-01', price: Number.NaN })).toEqual([
      { path: 'price', message: 'Expected a number.' },
    ]);
  });

  it('drops keys that are not fields', () => {
    expect(validateItem(widget, { ...item, colour: 'red' })).toEqual({ ok: true, value: item });
  });

  it('never throws', () => {
    expect(issuesOf(widget, null)).toEqual([{ path: '', message: 'Expected an object.' }]);
    const hostile = new Proxy({}, { get: () => { throw new Error('boom'); } });
    expect(issuesOf(widget, hostile)).toEqual([{ path: '', message: 'Could not read this item.' }]);
  });
});

describe('buildItemSchema', () => {
  it('returns a zod schema for the spec fields', () => {
    expect(buildItemSchema(widget).safeParse(item).success).toBe(true);
    expect(buildItemSchema(widget).safeParse({}).success).toBe(false);
  });
});
