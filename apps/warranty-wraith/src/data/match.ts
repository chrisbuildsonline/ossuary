// Possible recall matches for a purchase. Pure: no network, no clock, arguments never mutated.
import type { Recall } from './cpsc';

export interface RecallMatch {
  recall: Recall;
  score: number;
  reasons: ('model' | 'brand' | 'name')[];
}

const MAX_RESULTS = 5;
/** A token in the product names of more than this share of the recalls is generic. */
const GENERIC_SHARE = 0.02;
const MIN_MODEL_LENGTH = 4;
const MIN_TOKEN_LENGTH = 3;
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'over', 'under', 'per', 'via', 'not', 'are', 'its', 'our', 'your',
  'inc', 'llc', 'corp', 'corporation', 'ltd', 'company', 'usa', 'dba',
]);

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const tokens = (s: string) => plain(s).split(/[^a-z0-9]+/).filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(t));
const compact = (s: string) => plain(s).replace(/[^a-z0-9]/g, '');

interface Prepared {
  generic: Set<string>;
  recalls: { recall: Recall; names: Set<string>; brandTokens: Set<string>; brands: string[][]; models: Set<string> }[];
}

const cache = new WeakMap<readonly Recall[], Prepared>();

function prepare(list: readonly Recall[]): Prepared {
  const cached = cache.get(list);
  if (cached) return cached;
  const recalls = list.map((recall) => {
    const brands = recall.brands.map(tokens).filter((b) => b.length > 0);
    return { recall, names: new Set(recall.names.flatMap(tokens)), brandTokens: new Set(brands.flat()), brands, models: new Set(recall.models.map(compact)) };
  });
  const counts = new Map<string, number>();
  for (const r of recalls) for (const t of r.names) counts.set(t, (counts.get(t) ?? 0) + 1);
  const generic = new Set([...counts].filter(([, n]) => n > list.length * GENERIC_SHARE).map(([t]) => t));
  const prepared = { generic, recalls };
  cache.set(list, prepared);
  return prepared;
}

export function matchRecalls(item: { name: string; model?: string }, recalls: readonly Recall[]): RecallMatch[] {
  const words = new Set(tokens(String(item.name ?? '')));
  if (words.size === 0) return [];
  const model = compact(String(item.model ?? ''));
  const modelUsable = model.length >= MIN_MODEL_LENGTH && /[0-9]/.test(model);
  const { generic, recalls: prepared } = prepare(recalls);
  const matches: RecallMatch[] = [];
  for (const r of prepared) {
    const modelHit = modelUsable && r.models.has(model);
    const brandHit = r.brands.some((brand) => brand.every((t) => words.has(t)));
    const nameHits = [...words].filter((t) => !r.brandTokens.has(t) && r.names.has(t));
    const strong = nameHits.filter((t) => !generic.has(t)).length;
    if (!((modelHit && (brandHit || nameHits.length >= 1)) || (brandHit && nameHits.length >= 1) || strong >= 2)) continue;
    const reasons: RecallMatch['reasons'] = [];
    if (modelHit) reasons.push('model');
    if (brandHit) reasons.push('brand');
    if (nameHits.length > 0) reasons.push('name');
    const score = (modelHit ? 3 : 0) + (brandHit ? 2 : 0) + strong + 0.5 * (nameHits.length - strong);
    matches.push({ recall: r.recall, score, reasons });
  }
  return matches
    .sort((a, b) => b.score - a.score || b.recall.date.localeCompare(a.recall.date) || a.recall.id.localeCompare(b.recall.id))
    .slice(0, MAX_RESULTS);
}
