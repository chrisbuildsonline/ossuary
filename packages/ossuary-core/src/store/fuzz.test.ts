// fast-check fuzz of backup text and CSV input, with fixed seeds. Nothing throws, and the store is either
// unchanged or holds exactly the imported result: never a partial write.
import fc from 'fast-check';
import { IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromDayNumber, toDayNumber } from '../engine/iso-day';
import { aWidget, must, testDeps, widget } from '../testing/store-harness';
import { parseBackup } from './backup';
import { parseCsv } from './csv';
import { commitCsvImport, previewCsvImport, suggestMapping } from './csv-import';
import type { StoredItem } from './db';
import { type Store, openStore } from './repo';

afterEach(() => {
  vi.restoreAllMocks();
});

const settings = (seed: number, numRuns = 150) => ({ seed, numRuns });
const byId = (items: StoredItem[]) => [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

async function seededStore(): Promise<Store> {
  const store = must(await openStore(widget, testDeps()));
  must(await store.create(aWidget));
  must(await store.create({ ...aWidget, name: 'Red widget', count: 2 }));
  return store;
}

/** Makes the `n`th call (1-based) to a store write method throw a quota error. */
function failOnCall(method: 'put' | 'add', n: number): void {
  let calls = 0;
  const original = IDBObjectStore.prototype[method];
  vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof original>) {
    if (++calls === n) throw new DOMException('full', 'QuotaExceededError');
    return original.apply(this, args);
  });
}

const mode = fc.constantFrom('merge' as const, 'replace' as const);

describe('backup fuzz', () => {
  it('random strings never throw and never change the store', async () => {
    const store = await seededStore();
    const before = must(await store.list());
    await fc.assert(
      fc.asyncProperty(fc.oneof(fc.string({ unit: 'binary' }), fc.string({ unit: fc.constantFrom('{', '}', '[', ']', '"', ':', ',', 'items', '1') })), mode, async (text, m) => {
        const r = await store.importBackup(text, m);
        expect(r.ok).toBe(false);
        expect(must(await store.list())).toEqual(before);
      }),
      settings(301),
    );
    store.close();
  });

  it('random JSON never throws and never changes the store', async () => {
    const store = await seededStore();
    const before = must(await store.list());
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), mode, async (json, m) => {
        const r = await store.importBackup(JSON.stringify(json) ?? '', m);
        expect(r.ok).toBe(false);
        expect(must(await store.list())).toEqual(before);
      }),
      settings(302),
    );
    store.close();
  });

  const first = toDayNumber('2020-01-01');
  const validItem = fc.record({
    id: fc.oneof(fc.constantFrom('id-1', 'id-2', 'x', 'y'), fc.string({ minLength: 1, maxLength: 8 })),
    values: fc.record(
      {
        name: fc.string({ minLength: 1, maxLength: 12 }),
        place: fc.constantFrom('cold', 'deep_cold', 'shelf'),
        made: fc.integer({ min: first, max: first + 3000 }).map(fromDayNumber),
        opened: fc.constantFrom('no', 'yes'),
        count: fc.nat(50),
      },
      { requiredKeys: ['name', 'place', 'made'], noNullPrototype: true },
    ),
    createdAt: fc.constant('2026-01-01T00:00:00.000Z'),
    updatedAt: fc.constant('2026-01-02T00:00:00.000Z'),
  });
  const brokenItem = fc.oneof(
    fc.jsonValue(),
    validItem.chain((item) =>
      fc.constantFrom<Record<string, unknown>>(
        { ...item, id: '' },
        { ...item, values: { ...item.values, made: '2026-02-30' } },
        { ...item, values: { ...item.values, place: 'attic' } },
        { ...item, values: { ...item.values, count: -1 } },
        { ...item, createdAt: 5 },
      ),
    ),
  );
  const backupDoc = fc.record({
    format: fc.constantFrom('ossuary-backup', 'ossuary-backup', 'other'),
    version: fc.constantFrom(1, 1, 1, 2, '1'),
    appId: fc.constantFrom('widget-tracker', 'widget-tracker', 'gizmo-keeper'),
    exportedAt: fc.constantFrom('2026-11-14T10:00:00.000Z'),
    items: fc.oneof(
      fc.uniqueArray(validItem, { selector: (i) => i.id, maxLength: 6 }),
      fc.array(fc.oneof(validItem, brokenItem), { maxLength: 6 }),
    ),
  });

  it('near-valid backups import fully or not at all, even when a write fails', async () => {
    let imported = 0;
    let rejected = 0;
    await fc.assert(
      fc.asyncProperty(backupDoc, mode, fc.option(fc.integer({ min: 1, max: 6 })), fc.nat(), async (doc, m, failAt, cut) => {
        const store = await seededStore();
        const before = must(await store.list());
        const full = JSON.stringify(doc);
        const text = cut % 5 === 0 ? full.slice(0, cut % (full.length + 1)) : full;
        const parsed = parseBackup(widget, text);
        if (failAt !== null) failOnCall('put', failAt);
        const r = await store.importBackup(text, m);
        vi.restoreAllMocks();
        const after = must(await store.list());
        if (r.ok) {
          imported++;
          if (!parsed.ok) throw new Error('import accepted a backup that does not parse');
          const incoming = parsed.value.items;
          const expected = m === 'replace' ? incoming : [...before.filter((b) => !incoming.some((i) => i.id === b.id)), ...incoming];
          expect(byId(after)).toEqual(byId(expected));
        } else {
          rejected++;
          expect(after).toEqual(before);
        }
        store.close();
      }),
      settings(303, 200),
    );
    expect(imported).toBeGreaterThan(10);
    expect(rejected).toBeGreaterThan(10);
  });
});

type Cell = [text: string, quote: boolean];
const cellText = fc.string({ unit: fc.constantFrom('a', 'Z', '1', ' ', '-', ',', '"', '\n', '\r', '\r\n', 'é', '﻿'), maxLength: 8 });
const grid = fc.array(fc.array(fc.tuple(cellText, fc.boolean()), { minLength: 1, maxLength: 5 }), { maxLength: 15 });

function toCsv(rows: Cell[][], eol: string, bom: boolean, trailing: boolean): string {
  const line = (row: Cell[]) =>
    row
      .map(([text, quote]) => {
        const needed = /[",\r\n]/.test(text) || text.startsWith('﻿') || (row.length === 1 && text === '');
        return quote || needed ? `"${text.replaceAll('"', '""')}"` : text;
      })
      .join(',');
  const body = rows.map(line).join(eol);
  return `${bom ? '﻿' : ''}${body}${trailing && rows.length > 0 ? eol : ''}`;
}

describe('CSV fuzz', () => {
  it('random text never throws', () => {
    const csvish = fc.string({ unit: fc.constantFrom('a', ',', '"', '\n', '\r', ' ', '﻿', 'é'), maxLength: 60 });
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: 'binary' }), csvish), (text) => {
        const r = parseCsv(text);
        expect(r.ok || r.error.code === 'invalid').toBe(true);
      }),
      settings(304, 500),
    );
  });

  it('reads back any grid written with quoting, either line ending and an optional BOM', () => {
    fc.assert(
      fc.property(grid, fc.constantFrom('\n', '\r\n'), fc.boolean(), fc.boolean(), (rows, eol, bom, trailing) => {
        const text = toCsv(rows, eol, bom, trailing);
        expect(parseCsv(text)).toEqual({ ok: true, value: rows.map((row) => row.map(([t]) => t)) });
      }),
      settings(305, 500),
    );
  });

  const header = ['Name', 'Kept in', 'Made', 'Opened', 'Count'];
  // Mostly plausible values per column, with a few bad ones, so both valid and skipped rows are common.
  const columns = [
    ['Blue', 'x,y', 'a "b"', 'two\nlines', ' Tan ', ''],
    ['cold', 'Deep cold', 'SHELF', 'deep_cold', 'attic', ''],
    ['2026-11-09', '2024-02-29', '2027-01-31', '2026-02-30', '09/11/2026', ''],
    ['', 'Yes', 'no', 'maybe'],
    ['', '3', ' 7 ', '0', '-1', 'many'],
    ['', 'extra'],
  ];
  const cell = (values: string[]) => fc.tuple(fc.constantFrom(...values), fc.boolean());
  const dataRow = fc.tuple(...columns.map(cell)).chain((row) => fc.integer({ min: 0, max: row.length }).map((n) => row.slice(0, n)));

  it('previews and commits random rows fully or not at all, even when a write fails', async () => {
    let committed = 0;
    let failed = 0;
    await fc.assert(
      fc.asyncProperty(fc.array(dataRow, { maxLength: 12 }), fc.option(fc.integer({ min: 1, max: 8 })), async (data, failAt) => {
        const rows: Cell[][] = [header.map((h): Cell => [h, false]), ...data.map((r) => (r.length === 0 ? [['', true] as Cell] : r))];
        const parsed = must(parseCsv(toCsv(rows, '\r\n', false, true)));
        const preview = previewCsvImport(widget, parsed, suggestMapping(widget, parsed[0] ?? []));
        const nonBlank = parsed.slice(1).filter((r) => r.some((c) => c.trim() !== '')).length;
        expect(preview.valid.length + preview.skipped.length).toBe(nonBlank);

        const store = await seededStore();
        const before = must(await store.list());
        if (failAt !== null) failOnCall('add', failAt);
        const r = await commitCsvImport(store, preview);
        vi.restoreAllMocks();
        const after = must(await store.list());
        if (r.ok) {
          committed++;
          expect(r.value.added).toBe(preview.valid.length);
          expect(after.slice(0, before.length)).toEqual(before);
          expect(after.slice(before.length).map((i) => i.values)).toEqual(preview.valid.map((v) => v.values));
        } else {
          failed++;
          expect(r.error.code).toBe('quota');
          expect(after).toEqual(before);
        }
        store.close();
      }),
      settings(306, 150),
    );
    expect(committed).toBeGreaterThan(10);
    expect(failed).toBeGreaterThan(5);
  });
});
