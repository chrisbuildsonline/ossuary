import { IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aGizmo, aWidget, gizmo, must, testDeps, widget } from '../testing/store-harness';
import { type CsvPreview, commitCsvImport, previewCsvImport, suggestMapping } from './csv-import';
import { openStore } from './repo';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('suggestMapping', () => {
  it('matches headers to field keys and labels, ignoring case, spaces and punctuation', () => {
    expect(suggestMapping(widget, ['Name', 'Kept in', 'made', 'Notes', ' COUNT ', 'opened?'])).toEqual({
      0: 'name',
      1: 'place',
      2: 'made',
      3: null,
      4: 'count',
      5: 'opened',
    });
  });

  it('uses each field once, for the first matching column', () => {
    expect(suggestMapping(widget, ['name', 'Name', 'place', 'kept_in'])).toEqual({ 0: 'name', 1: null, 2: 'place', 3: null });
  });

  it('leaves empty headers unmapped', () => {
    expect(suggestMapping(widget, ['', '  ', '--'])).toEqual({ 0: null, 1: null, 2: null });
  });

  it('matches labels with more than one word', () => {
    expect(suggestMapping(gizmo, ['Bought on', 'maker', 'PLAN'])).toEqual({ 0: 'bought', 1: 'maker', 2: 'plan' });
  });
});

const header = ['Name', 'Kept in', 'Made', 'Opened', 'Count', 'Notes'];
const grid = (...data: string[][]) => [header, ...data];
const preview = (...data: string[][]) => previewCsvImport(widget, grid(...data), suggestMapping(widget, header));

describe('previewCsvImport', () => {
  it('turns a good row into item values, numbering rows like a spreadsheet', () => {
    expect(preview(['Blue', 'cold', '2026-11-09', '', '3', 'ignored'])).toEqual({
      valid: [{ row: 2, values: { name: 'Blue', place: 'cold', made: '2026-11-09', count: 3 } }],
      skipped: [],
    });
  });

  it('trims cells and matches enums by value or label, ignoring case', () => {
    const r = preview([' Blue ', 'DEEP COLD', '2026-11-09', 'Yes', ' 0 '], ['Red', 'Deep_Cold', '2026-11-09'], ['Tan', 'shelf', '2026-11-09', 'no']);
    expect(r.skipped).toEqual([]);
    expect(r.valid.map((v) => v.values)).toEqual([
      { name: 'Blue', place: 'deep_cold', made: '2026-11-09', opened: 'yes', count: 0 },
      { name: 'Red', place: 'deep_cold', made: '2026-11-09' },
      { name: 'Tan', place: 'shelf', made: '2026-11-09', opened: 'no' },
    ]);
  });

  it.each([
    ['a missing date', ['Blue', 'cold', ''], 'No date for Made'],
    ['a missing text value', ['', 'cold', '2026-11-09'], 'No value for Name'],
    ['a day-month date', ['Blue', 'cold', '09/11/2026'], 'Use YYYY-MM-DD for Made'],
    ['a date with a time', ['Blue', 'cold', '2026-11-09T10:00'], 'Use YYYY-MM-DD for Made'],
    ['a short year', ['Blue', 'cold', '26-11-09'], 'Use YYYY-MM-DD for Made'],
    ['a day that does not exist', ['Blue', 'cold', '2026-02-30'], 'Made: Use a real calendar day as YYYY-MM-DD.'],
    ['an unknown option', ['Blue', 'attic', '2026-11-09'], 'Kept in must be one of: Cold, Deep cold, Shelf'],
    ['text in a number column', ['Blue', 'cold', '2026-11-09', '', 'many'], 'Count must be a number'],
    ['a hex number', ['Blue', 'cold', '2026-11-09', '', '0x10'], 'Count must be a number'],
    ['a number below the minimum', ['Blue', 'cold', '2026-11-09', '', '-1'], 'Count: Must be at least 0.'],
    ['several problems', ['', 'attic', 'soon'], 'No value for Name; Kept in must be one of: Cold, Deep cold, Shelf; Use YYYY-MM-DD for Made'],
  ])('skips a row with %s and gives the reason', (_, row, reason) => {
    expect(preview(row)).toEqual({ valid: [], skipped: [{ row: 2, reason }] });
  });

  it('treats missing cells in a short row as empty', () => {
    expect(preview(['Blue', 'cold'])).toEqual({ valid: [], skipped: [{ row: 2, reason: 'No date for Made' }] });
  });

  it('ignores blank rows without counting them as skipped', () => {
    const r = preview(['Blue', 'cold', '2026-11-09'], [''], ['', '', ' '], ['Red', 'shelf', '2026-11-10']);
    expect(r.skipped).toEqual([]);
    expect(r.valid.map((v) => v.row)).toEqual([2, 5]);
  });

  it('follows the caller mapping, including ignored columns and unknown keys', () => {
    const rows = [['a', 'b', 'c', 'd'], ['Blue', 'cold', '2026-11-09', 'yes']];
    expect(previewCsvImport(widget, rows, { 0: 'name', 1: 'place', 2: 'made', 3: null })).toEqual({
      valid: [{ row: 2, values: { name: 'Blue', place: 'cold', made: '2026-11-09' } }],
      skipped: [],
    });
    expect(previewCsvImport(widget, rows, { 0: 'name', 1: 'place', 2: 'made', 3: 'nope' }).valid).toHaveLength(1);
    expect(previewCsvImport(widget, rows, { 0: 'name', 1: 'place' }).skipped).toEqual([{ row: 2, reason: 'No date for Made' }]);
  });

  it('keeps the first non-empty cell when two columns map to one field', () => {
    const rows = [['n1', 'n2', 'p', 'm'], ['', 'Second', 'cold', '2026-11-09'], ['First', 'Second', 'cold', '2026-11-09']];
    const r = previewCsvImport(widget, rows, { 0: 'name', 1: 'name', 2: 'place', 3: 'made' });
    expect(r.valid.map((v) => v.values.name)).toEqual(['Second', 'First']);
  });

  it('returns nothing for an empty grid or a header alone', () => {
    expect(previewCsvImport(widget, [], {})).toEqual({ valid: [], skipped: [] });
    expect(previewCsvImport(widget, [header], suggestMapping(widget, header))).toEqual({ valid: [], skipped: [] });
  });
});

describe('commitCsvImport', () => {
  it('writes every valid row as a new item', async () => {
    const store = must(await openStore(widget, testDeps()));
    const existing = must(await store.create(aWidget));
    const p = preview(['Blue', 'cold', '2026-11-09'], ['Bad', 'cold', 'x'], ['Red', 'shelf', '2026-11-10', '', '2']);
    expect(await commitCsvImport(store, p)).toEqual({ ok: true, value: { added: 2, updated: 0, removed: 0 } });
    const items = must(await store.list());
    expect(items.map((i) => i.values)).toEqual([
      existing.values,
      { name: 'Blue', place: 'cold', made: '2026-11-09' },
      { name: 'Red', place: 'shelf', made: '2026-11-10', count: 2 },
    ]);
    expect(items.map((i) => i.id)).toEqual(['id-1', 'id-2', 'id-3']);
    store.close();
  });

  it('writes nothing for a preview with no valid rows', async () => {
    const store = must(await openStore(widget, testDeps()));
    expect(await commitCsvImport(store, { valid: [], skipped: [{ row: 2, reason: 'x' }] })).toEqual({ ok: true, value: { added: 0, updated: 0, removed: 0 } });
    expect(must(await store.list())).toEqual([]);
    store.close();
  });

  it('revalidates the preview and writes nothing if a row is invalid', async () => {
    const store = must(await openStore(widget, testDeps()));
    must(await store.create(aWidget));
    const before = must(await store.list());
    const bad: CsvPreview = { valid: [{ row: 2, values: aWidget }, { row: 3, values: { ...aWidget, made: 'soon' } }], skipped: [] };
    expect(await commitCsvImport(store, bad)).toEqual({
      ok: false,
      error: { code: 'invalid', issues: [{ path: 'row 3.made', message: expect.any(String) }] },
    });
    expect(must(await store.list())).toEqual(before);
    store.close();
  });

  it('keeps the store unchanged when a write fails half way', async () => {
    const store = must(await openStore(gizmo, testDeps()));
    must(await store.create(aGizmo));
    const before = must(await store.list());
    let calls = 0;
    const add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (++calls === 3) throw new DOMException('full', 'QuotaExceededError');
      return add.apply(this, args);
    });
    const p: CsvPreview = { valid: [2, 3, 4].map((row) => ({ row, values: { ...aGizmo, name: `G${row}` } })), skipped: [] };
    expect(await commitCsvImport(store, p)).toEqual({ ok: false, error: { code: 'quota', message: expect.any(String) } });
    vi.restoreAllMocks();
    expect(must(await store.list())).toEqual(before);
    store.close();
  });
});
