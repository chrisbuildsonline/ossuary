// Maps the raw CPSC Recalls API snapshot to the recalls the app bundles. Used by scripts/build-recalls.ts
// and tests only, so zod stays out of the browser bundle.
import { isRealDay } from '@ossuary/core/engine';
import { z } from 'zod';

export interface Recall {
  id: string; // RecallNumber, e.g. "27054"
  date: string; // ISO day of the recall
  title: string; // cut to 160 characters at a word break, ending in "…"
  hazard: string; // first hazard name, cut like title, "" when none
  url: string; // https://www.cpsc.gov/... only
  names: string[]; // product names
  brands: string[]; // from Manufacturers, Importers and Distributors
  models: string[]; // product model strings
}
export interface MapResult {
  recalls: Recall[];
  skipped: { row: number; reason: string }[];
}

const MAX_TEXT = 160;
const named = z.array(z.object({ Name: z.string().nullish() })).nullish();
const rowSchema = z.object({
  RecallNumber: z.string(),
  RecallDate: z.string(),
  Title: z.string(),
  URL: z.string(),
  Products: z.array(z.object({ Name: z.string().nullish(), Model: z.string().nullish() })),
  Manufacturers: named,
  Importers: named,
  Distributors: named,
  Hazards: named,
});

const unique = (values: Iterable<string>) => [...new Set([...values].map((v) => v.trim()).filter((v) => v !== ''))];
/** Text over 160 characters ends at the last word break that leaves room for "…", trailing punctuation dropped. */
function cut(s: string): string {
  const text = s.trim();
  if (text.length <= MAX_TEXT) return text;
  const head = text.slice(0, MAX_TEXT);
  const space = head.lastIndexOf(' ');
  return `${(space > 0 ? head.slice(0, space) : head.slice(0, MAX_TEXT - 1)).replace(/[\s,;:.-]+$/, '')}…`;
}
const namesOf = (list: z.infer<typeof named>) => (list ?? []).map((x) => x.Name ?? '');

/** "Legal name, dba Brand, of Place" -> ["Legal name", "Brand"]; text in brackets is dropped. */
function brandsOf(company: string): string[] {
  const [first = '', ...rest] = company.split(',');
  const dba = rest.map((p) => p.trim()).flatMap((p) => /^(dba|doing business as)\s+/i.test(p) ? [p.replace(/^(dba|doing business as)\s+/i, '')] : []);
  return [first.replace(/\([^)]*\)/g, ''), ...dba];
}

/** The notice URL on the www.cpsc.gov host, or undefined. A bare cpsc.gov host is the same site. */
function cpscUrl(text: string): string | undefined {
  if (!URL.canParse(text.trim())) return undefined;
  const url = new URL(text.trim());
  if (url.protocol !== 'https:') return undefined;
  if (url.hostname === 'cpsc.gov') url.hostname = 'www.cpsc.gov';
  return url.hostname === 'www.cpsc.gov' ? url.href : undefined;
}

export function mapCpscRecalls(raw: unknown): MapResult {
  if (!Array.isArray(raw)) return { recalls: [], skipped: [{ row: -1, reason: 'Expected an array of recalls.' }] };
  const recalls: Recall[] = [];
  const skipped: MapResult['skipped'] = [];
  const seen = new Set<string>();
  raw.forEach((input: unknown, row) => {
    const skip = (reason: string) => skipped.push({ row, reason });
    const parsed = rowSchema.safeParse(input);
    if (!parsed.success) return skip(`Not a recall row: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'row'} ${i.message}`).join('; ')}`);
    const r = parsed.data;
    const id = r.RecallNumber.trim();
    if (id === '') return skip('No recall number.');
    if (seen.has(id)) return skip(`Duplicate recall number ${id}.`);
    const date = r.RecallDate.slice(0, 10);
    if (!isRealDay(date)) return skip(`Recall ${id}: "${r.RecallDate}" is not a real day.`);
    const title = cut(r.Title);
    if (title === '') return skip(`Recall ${id}: no title.`);
    const url = cpscUrl(r.URL);
    if (!url) return skip(`Recall ${id}: "${r.URL}" is not an https CPSC notice URL.`);
    const names = unique(r.Products.map((p) => p.Name ?? ''));
    if (names.length === 0) return skip(`Recall ${id}: no product name.`);
    seen.add(id);
    recalls.push({
      id,
      date,
      title,
      hazard: cut(namesOf(r.Hazards)[0] ?? ''),
      url,
      names,
      brands: unique([...namesOf(r.Manufacturers), ...namesOf(r.Importers), ...namesOf(r.Distributors)].flatMap(brandsOf)),
      models: unique(r.Products.flatMap((p) => (p.Model ?? '').split(/[,;]|\band\b/))),
    });
  });
  return { recalls, skipped };
}
