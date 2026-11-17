// Maps the raw USDA FoodKeeper snapshot to foods with whole-day shelf life per storage method.
// Build-time only (scripts/build-foods.ts and tests): the app ships the mapped foods.json, not this module.
import { z } from 'zod';

export type StorageMethod = 'pantry' | 'fridge' | 'freezer';
export interface Food {
  id: string;
  name: string;
  days: Partial<Record<StorageMethod, number>>;
}
export interface MapResult {
  foods: Food[];
  /** `row` is 1-based within the Product sheet; 0 means the snapshot itself. */
  skipped: { row: number; reason: string }[];
}

/** FoodKeeper column prefix per storage method. */
const columns: Record<StorageMethod, string> = { pantry: 'Pantry', fridge: 'Refrigerate', freezer: 'Freeze' };
const methods = Object.keys(columns) as StorageMethod[];

const toDays: Record<string, (n: number) => number> = {
  hours: (n) => n / 24,
  days: (n) => n,
  weeks: (n) => n * 7,
  months: (n) => n * 30,
  years: (n) => n * 365,
};

const amount = z.number().nullish();
const metric = z.string().nullish();
const timeColumns = Object.fromEntries(
  ['', 'DOP_'].flatMap((prefix) =>
    Object.values(columns).flatMap((col) => [
      [`${prefix}${col}_Min`, amount],
      [`${prefix}${col}_Metric`, metric],
    ]),
  ),
);

/** Only the columns the mapper reads. Other columns are ignored. */
const productRow = z.object({ ID: z.number().int(), Name: z.string(), Name_subtitle: z.string().nullish(), ...timeColumns });
type ProductRow = { ID: number; Name: string; Name_subtitle?: string | null } & Record<string, unknown>;

const snapshot = z.object({ sheets: z.array(z.object({ name: z.string(), data: z.array(z.unknown()) })) });

/** A snapshot row is an array of one-key objects; merge it into one record. Plain objects pass through. */
function cellsOf(row: unknown): unknown {
  if (!Array.isArray(row)) return row;
  return Object.fromEntries(row.flatMap((cell) => (cell && typeof cell === 'object' ? Object.entries(cell) : [])));
}

/** Whole days for one column group, or undefined when it has no usable time. Hours round up to a day. */
function daysFor(row: ProductRow, prefix: string): number | undefined {
  const min = row[`${prefix}_Min`];
  const unit = row[`${prefix}_Metric`];
  if (typeof min !== 'number' || !(min > 0) || typeof unit !== 'string') return undefined;
  const key = unit.trim().toLowerCase();
  const days = Object.hasOwn(toDays, key) ? Math.ceil((toDays[key] as (n: number) => number)(min)) : NaN;
  return Number.isSafeInteger(days) ? days : undefined;
}

const describeIssue = (issue: z.core.$ZodIssue | undefined) =>
  issue ? `${issue.path.map(String).join('.') || 'row'}: ${issue.message}` : 'unreadable row';

/** Never throws. One food per usable Product row, in snapshot order; every other row is listed in `skipped`. */
export function mapFoodKeeper(raw: unknown): MapResult {
  const parsed = snapshot.safeParse(raw);
  const product = parsed.success ? parsed.data.sheets.find((s) => s.name === 'Product') : undefined;
  if (!product) return { foods: [], skipped: [{ row: 0, reason: 'No Product sheet in the snapshot.' }] };

  const foods: Food[] = [];
  const skipped: MapResult['skipped'] = [];
  const seen = new Set<string>();
  product.data.forEach((cells, i) => {
    const rowNumber = i + 1;
    const skip = (reason: string) => skipped.push({ row: rowNumber, reason });
    const r = productRow.safeParse(cellsOf(cells));
    if (!r.success) return skip(`Not a product row (${describeIssue(r.error.issues[0])}).`);
    const row = r.data as ProductRow;
    const id = String(row.ID);
    const name = [row.Name.trim(), row.Name_subtitle?.trim()].filter(Boolean).join(', ');
    if (!row.Name.trim()) return skip('Name is empty.');
    if (seen.has(id)) return skip(`Duplicate id "${id}".`);
    const days: Food['days'] = {};
    for (const method of methods) {
      const d = daysFor(row, `DOP_${columns[method]}`) ?? daysFor(row, columns[method]);
      if (d !== undefined) days[method] = d;
    }
    if (Object.keys(days).length === 0) return skip(`No usable storage time for "${name}".`);
    seen.add(id);
    foods.push({ id, name, days });
  });
  return { foods, skipped };
}
