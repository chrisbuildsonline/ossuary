// CSV rows to items: suggest a column mapping, preview each row as valid or skipped, then commit in one transaction.
import type { BoneSpec } from '../schema/bone-spec';
import type { Field } from '../schema/fields';
import { type Item, validateItem } from '../schema/item';
import type { ImportSummary } from './backup';
import type { StoreResult } from './errors';
import type { Store } from './repo';

/** Column index to field key, or `null` to ignore the column. */
export type Mapping = Record<number, string | null>;

export interface CsvPreview {
  valid: { row: number; values: Item }[];
  skipped: { row: number; reason: string }[];
}

const normalise = (s: string) =>
  s
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Proposes a field for each header by comparing normalised header text with field keys and labels. */
export function suggestMapping(spec: BoneSpec, headers: string[]): Mapping {
  const used = new Set<string>();
  const mapping: Mapping = {};
  headers.forEach((header, column) => {
    const h = normalise(header);
    const field = h ? spec.entity.fields.find((f) => !used.has(f.key) && (normalise(f.key) === h || normalise(f.label) === h)) : undefined;
    if (field) used.add(field.key);
    mapping[column] = field?.key ?? null;
  });
  return mapping;
}

const isoDayShape = /^\d{4}-\d{2}-\d{2}$/;
const decimal = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

type Converted = { ok: true; value: string | number } | { ok: false; reason: string };

function convert(field: Field, cell: string): Converted {
  switch (field.kind) {
    case 'text':
      return { ok: true, value: cell };
    case 'date':
      return isoDayShape.test(cell) ? { ok: true, value: cell } : { ok: false, reason: `Use YYYY-MM-DD for ${field.label}` };
    case 'number':
      return decimal.test(cell) ? { ok: true, value: Number(cell) } : { ok: false, reason: `${field.label} must be a number` };
    case 'enum': {
      const key = cell.toLowerCase();
      const option = field.options.find((o) => o.value.toLowerCase() === key || o.label.toLowerCase() === key);
      return option
        ? { ok: true, value: option.value }
        : { ok: false, reason: `${field.label} must be one of: ${field.options.map((o) => o.label).join(', ')}` };
    }
  }
}

function previewRow(spec: BoneSpec, cells: string[], mapping: Mapping): { ok: true; values: Item } | { ok: false; reason: string } {
  const raw = new Map<string, string>();
  cells.forEach((cell, column) => {
    const key = mapping[column];
    const value = cell.trim();
    if (key && value && !raw.has(key)) raw.set(key, value);
  });

  const values: Item = {};
  const problems = new Map<string, string>();
  for (const field of spec.entity.fields) {
    const cell = raw.get(field.key);
    if (cell === undefined) {
      if (field.required) problems.set(field.key, `No ${field.kind === 'date' ? 'date' : 'value'} for ${field.label}`);
      continue;
    }
    const c = convert(field, cell);
    if (c.ok) values[field.key] = c.value;
    else problems.set(field.key, c.reason);
  }

  const checked = validateItem(spec, values);
  if (!checked.ok) {
    for (const issue of checked.error) {
      const field = spec.entity.fields.find((f) => f.key === issue.path);
      if (field && !problems.has(field.key)) problems.set(field.key, `${field.label}: ${issue.message}`);
    }
  }
  if (problems.size > 0) {
    const reasons = spec.entity.fields.flatMap((f) => problems.get(f.key) ?? []);
    return { ok: false, reason: reasons.join('; ') };
  }
  return { ok: true, values };
}

/**
 * Converts parsed CSV rows (the first row is the header) into item values. Row numbers count the header as row 1.
 * Dates must be `YYYY-MM-DD`; enum cells match an option's value or label, ignoring case. Blank rows are ignored.
 */
export function previewCsvImport(spec: BoneSpec, rows: string[][], mapping: Mapping): CsvPreview {
  const preview: CsvPreview = { valid: [], skipped: [] };
  rows.forEach((cells, index) => {
    if (index === 0 || cells.every((c) => c.trim() === '')) return;
    const row = index + 1;
    const r = previewRow(spec, cells, mapping);
    if (r.ok) preview.valid.push({ row, values: r.values });
    else preview.skipped.push({ row, reason: r.reason });
  });
  return preview;
}

/** Writes every valid preview row as a new item, all in one transaction. Never throws. */
export async function commitCsvImport(store: Store, preview: CsvPreview): Promise<StoreResult<ImportSummary>> {
  const r = await store.createMany(preview.valid.map((v) => v.values));
  if (r.ok || r.error.code !== 'invalid') return r;
  const issues = r.error.issues.map((issue) => ({
    ...issue,
    path: issue.path.replace(/^items\[(\d+)\]/, (whole, i: string) => {
      const row = preview.valid[Number(i)]?.row;
      return row === undefined ? whole : `row ${row}`;
    }),
  }));
  return { ok: false, error: { code: 'invalid', issues } };
}
