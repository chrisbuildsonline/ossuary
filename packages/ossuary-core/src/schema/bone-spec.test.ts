import { describe, expect, it } from 'vitest';
import { copyOf, gizmoSpec, widgetSpec } from '../testing/fixtures';
import { parseBoneSpec } from './bone-spec';

// Tests edit fixtures freely, including into invalid shapes.
type Loose = any;

const issuesOf = (input: unknown) => {
  const r = parseBoneSpec(input);
  return r.ok ? [] : r.error;
};
const edit = (base: object, change: (s: Loose) => void) => {
  const s = copyOf(base);
  change(s);
  return issuesOf(s);
};

describe('parseBoneSpec: valid specs', () => {
  it('accepts a one-lifespan spec with a lookup and keeps it unchanged', () => {
    expect(parseBoneSpec(widgetSpec)).toEqual({ ok: true, value: widgetSpec });
  });

  it('accepts a two-lifespan spec with day and month bases over one start field', () => {
    const r = parseBoneSpec(gizmoSpec);
    expect(r).toEqual({ ok: true, value: gizmoSpec });
    expect(r.ok && r.value.lifespans.map((l) => l.id)).toEqual(['return_window', 'cover']);
  });

  it('does not need theme, copy, sources or summaryFields', () => {
    expect(
      edit(widgetSpec, (s) => {
        delete s.theme;
        delete s.copy;
        delete s.sources;
        delete s.entity.summaryFields;
        delete s.lifespans[0].base.sourceId;
        delete s.lifespans[0].rules[0].sourceId;
      }),
    ).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = copyOf(gizmoSpec);
    parseBoneSpec(input);
    expect(input).toEqual(gizmoSpec);
  });
});

describe('parseBoneSpec: never throws', () => {
  it.each([null, undefined, [], 'spec', 42, true, () => 1, Symbol('x')])('returns a root issue for %s', (input) => {
    const r = parseBoneSpec(input);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error[0]?.path).toBe('');
  });

  it('reports the missing keys of an object of the wrong kind', () => {
    expect(issuesOf(new Map()).map((i) => i.path)).toEqual(['id', 'name', 'version', 'entity', 'lifespans']);
  });

  it('turns an internal error into one generic root issue', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('boom');
        },
      },
    );
    expect(parseBoneSpec(hostile)).toEqual({ ok: false, error: [{ path: '', message: 'Could not read this spec.' }] });
  });
});

describe('parseBoneSpec: lifespans', () => {
  it('needs lifespans to be a non-empty array', () => {
    expect(edit(widgetSpec, (s) => delete s.lifespans)).toEqual([{ path: 'lifespans', message: 'This is required.' }]);
    expect(edit(widgetSpec, (s) => (s.lifespans = []))).toEqual([{ path: 'lifespans', message: 'Must have at least 1 item.' }]);
    expect(edit(widgetSpec, (s) => (s.lifespans = s.lifespans[0]))).toEqual([{ path: 'lifespans', message: 'Expected a list.' }]);
  });

  it('rejects top-level rules or stages', () => {
    expect(edit(widgetSpec, (s) => (s.rules = []))).toEqual([{ path: 'rules', message: 'Unknown key "rules".' }]);
    expect(edit(widgetSpec, (s) => (s.stages = []))).toEqual([{ path: 'stages', message: 'Unknown key "stages".' }]);
  });

  it('reports a bad when field in the second lifespan with its index', () => {
    expect(edit(gizmoSpec, (s) => (s.lifespans[1].rules[0].when.field = 'nope'))).toEqual([
      { path: 'lifespans[1].rules[0].when.field', message: 'No field named "nope".' },
    ]);
  });

  it('reports a stage problem with its lifespan index', () => {
    expect(edit(gizmoSpec, (s) => (s.lifespans[1].stages[1].enterAtDays = undefined))).toEqual([
      { path: 'lifespans[1].stages[1].enterAtDays', message: 'This stage needs enterAtDays, the days left when it starts.' },
    ]);
  });

  it('needs startField to be an existing date field', () => {
    expect(edit(widgetSpec, (s) => (s.lifespans[0].startField = 'gone'))).toEqual([
      { path: 'lifespans[0].startField', message: 'No field named "gone".' },
    ]);
    expect(edit(widgetSpec, (s) => (s.lifespans[0].startField = 'name'))).toEqual([
      { path: 'lifespans[0].startField', message: 'Field "name" is text; it must be a date field.' },
    ]);
  });

  it('needs a field base to reference a date field', () => {
    expect(edit(gizmoSpec, (s) => (s.lifespans[1].base = { type: 'field', field: 'bought' }))).toEqual([]);
    expect(edit(gizmoSpec, (s) => (s.lifespans[1].base = { type: 'field', field: 'price' }))).toEqual([
      { path: 'lifespans[1].base.field', message: 'Field "price" is number; it must be a date field.' },
    ]);
  });

  it('needs a duration amountField to reference a number field', () => {
    const withAmountField = (key: string) => (s: Loose) => (s.lifespans[0].base.amountField = key);
    expect(edit(gizmoSpec, withAmountField('price'))).toEqual([]);
    expect(edit(gizmoSpec, withAmountField('maker'))).toEqual([
      { path: 'lifespans[0].base.amountField', message: 'Field "maker" is text; it must be a number field.' },
    ]);
    expect(edit(gizmoSpec, withAmountField('gone'))).toEqual([
      { path: 'lifespans[0].base.amountField', message: 'No field named "gone".' },
    ]);
  });

  it('needs a lookup on an existing enum or text field', () => {
    expect(edit(widgetSpec, (s) => (s.lifespans[0].rules[0].field = 'count'))).toEqual([
      { path: 'lifespans[0].rules[0].field', message: 'Field "count" is number; it must be an enum or text field.' },
    ]);
    expect(edit(widgetSpec, (s) => (s.lifespans[0].rules[0].field = 'where'))).toEqual([
      { path: 'lifespans[0].rules[0].field', message: 'No field named "where".' },
    ]);
  });

  it('accepts any table keys for a lookup on a text field', () => {
    expect(
      edit(gizmoSpec, (s) =>
        s.lifespans[0].rules.push({ id: 'by_maker', kind: 'lookup', field: 'maker', table: { 'Acme Co': { amount: 60, unit: 'day' } } }),
      ),
    ).toEqual([]);
  });

  it('names an enum option with no table entry and no default', () => {
    expect(edit(widgetSpec, (s) => delete s.lifespans[0].rules[0].table.shelf)).toEqual([
      { path: 'lifespans[0].rules[0].table', message: 'Option "shelf" of field "place" has no table entry and there is no default.' },
    ]);
    expect(
      edit(widgetSpec, (s) => {
        delete s.lifespans[0].rules[0].table.shelf;
        s.lifespans[0].rules[0].default = { amount: 1, unit: 'week' };
      }),
    ).toEqual([]);
  });

  it('names a table key that is not an option', () => {
    expect(edit(widgetSpec, (s) => (s.lifespans[0].rules[0].table.attic = { amount: 1, unit: 'day' }))).toEqual([
      { path: 'lifespans[0].rules[0].table.attic', message: '"attic" is not an option of field "place".' },
    ]);
  });

  it('needs sourceId on a base or rule to match a declared source', () => {
    expect(edit(widgetSpec, (s) => (s.lifespans[0].base.sourceId = 'ref9'))).toEqual([
      { path: 'lifespans[0].base.sourceId', message: 'No source named "ref9".' },
    ]);
    expect(edit(widgetSpec, (s) => delete s.sources)).toEqual([
      { path: 'lifespans[0].base.sourceId', message: 'No source named "ref1".' },
      { path: 'lifespans[0].rules[0].sourceId', message: 'No source named "ref1".' },
    ]);
  });

  it('rejects more than 50 rules in total at the first one over', () => {
    const rules = Array.from({ length: 13 }, (_, i) => ({ id: `r${i}`, kind: 'extend', by: { amount: 1, unit: 'day' } }));
    const issues = edit(gizmoSpec, (s) => {
      s.lifespans = ['a', 'b', 'c', 'd'].map((id) => ({ ...s.lifespans[0], id, rules }));
    });
    expect(issues).toEqual([{ path: 'lifespans[3].rules[11]', message: 'A spec can have at most 50 rules in total.' }]);
  });

  it('rejects more than 8 stages in one lifespan', () => {
    const middle = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, label: `S${i}`, tone: 'soon', enterAtDays: 20 - i }));
    expect(
      edit(gizmoSpec, (s) => (s.lifespans[1].stages = [s.lifespans[1].stages[0], ...middle, s.lifespans[1].stages[2]])),
    ).toEqual([{ path: 'lifespans[1].stages', message: 'Must have at most 8 items.' }]);
  });
});

describe('parseBoneSpec: entity', () => {
  it('rejects more than 40 fields', () => {
    const extra = Array.from({ length: 36 }, (_, i) => ({ key: `extra${i}`, kind: 'text', label: 'X' }));
    expect(edit(widgetSpec, (s) => s.entity.fields.push(...extra))).toEqual([
      { path: 'entity.fields', message: 'Must have at most 40 items.' },
    ]);
  });

  it('needs titleField and summaryFields to reference fields', () => {
    expect(edit(widgetSpec, (s) => (s.entity.titleField = 'title'))).toEqual([
      { path: 'entity.titleField', message: 'No field named "title".' },
    ]);
    expect(edit(widgetSpec, (s) => (s.entity.summaryFields = ['place', 'where']))).toEqual([
      { path: 'entity.summaryFields[1]', message: 'No field named "where".' },
    ]);
    expect(edit(widgetSpec, (s) => delete s.entity.titleField)).toEqual([
      { path: 'entity.titleField', message: 'This is required.' },
    ]);
  });

  it('allows at most three summaryFields', () => {
    expect(edit(widgetSpec, (s) => (s.entity.summaryFields = ['name', 'place', 'opened', 'count']))).toEqual([
      { path: 'entity.summaryFields', message: 'Must have at most 3 items.' },
    ]);
  });

  it('reports a duplicate field key under entity.fields', () => {
    expect(edit(widgetSpec, (s) => (s.entity.fields[4].key = 'made'))).toContainEqual({
      path: 'entity.fields[4].key',
      message: 'Duplicate field key "made".',
    });
  });

  it('reports a number field with min above max at that field', () => {
    expect(edit(widgetSpec, (s) => Object.assign(s.entity.fields[4], { min: 9, max: 1 }))).toEqual([
      { path: 'entity.fields[4].min', message: 'Min (9) is greater than max (1).' },
    ]);
  });
});

describe('parseBoneSpec: sources', () => {
  it('needs unique ids, a name, an https url and a license', () => {
    const source = widgetSpec.sources[0];
    expect(edit(widgetSpec, (s) => s.sources.push({ ...source }))).toEqual([
      { path: 'sources[1].id', message: 'Duplicate source id "ref1".' },
    ]);
    expect(edit(widgetSpec, (s) => (s.sources[0].url = 'http://example.org/data'))).toEqual([
      { path: 'sources[0].url', message: 'Use an https:// address.' },
    ]);
    expect(edit(widgetSpec, (s) => delete s.sources[0].url)).toEqual([{ path: 'sources[0].url', message: 'This is required.' }]);
    expect(edit(widgetSpec, (s) => delete s.sources[0].license)).toEqual([
      { path: 'sources[0].license', message: 'This is required.' },
    ]);
  });

  it('needs retrievedOn to be a real ISO day', () => {
    expect(edit(widgetSpec, (s) => (s.sources[0].retrievedOn = '2026-02-29'))).toEqual([
      { path: 'sources[0].retrievedOn', message: 'Use a real calendar day as YYYY-MM-DD.' },
    ]);
    expect(edit(widgetSpec, (s) => (s.sources[0].retrievedOn = '2024-02-29'))).toEqual([]);
  });
});

describe('parseBoneSpec: theme, copy and root keys', () => {
  it('reports theme problems under theme', () => {
    expect(edit(widgetSpec, (s) => (s.theme.accent = '#999999'))).toContainEqual({
      path: 'theme.accent',
      message: 'Accent contrast on white is 2.84:1; it must be at least 4.5:1.',
    });
    expect(edit(widgetSpec, (s) => (s.theme.radius = 4))).toEqual([{ path: 'theme.radius', message: 'Unknown key "radius".' }]);
  });

  it('accepts only the three copy keys, each up to 80 characters', () => {
    expect(edit(widgetSpec, (s) => (s.copy.footer = 'x'))).toEqual([{ path: 'copy.footer', message: 'Unknown key "footer".' }]);
    expect(edit(widgetSpec, (s) => (s.copy.addLabel = 'x'.repeat(81)))).toEqual([
      { path: 'copy.addLabel', message: 'Must be at most 80 characters.' },
    ]);
  });

  it('rejects unknown keys at any depth except inside a table', () => {
    expect(edit(widgetSpec, (s) => (s.lifespans[0].rules[1].colour = 'red'))).toEqual([
      { path: 'lifespans[0].rules[1].colour', message: 'Unknown key "colour".' },
    ]);
    expect(edit(widgetSpec, (s) => (s.entity.extra = 1))).toEqual([{ path: 'entity.extra', message: 'Unknown key "extra".' }]);
  });

  it('needs an app id, a name and a whole version', () => {
    expect(edit(widgetSpec, (s) => (s.id = 'Widget Tracker'))[0]?.path).toBe('id');
    expect(edit(widgetSpec, (s) => (s.version = 1.5))).toEqual([{ path: 'version', message: 'Expected a whole number.' }]);
    expect(edit(widgetSpec, (s) => delete s.name)).toEqual([{ path: 'name', message: 'This is required.' }]);
  });

  it('returns at most 50 issues', () => {
    const issues = edit(widgetSpec, (s) => {
      for (let i = 0; i < 80; i++) s[`junk${i}`] = i;
    });
    expect(issues).toHaveLength(50);
  });
});
