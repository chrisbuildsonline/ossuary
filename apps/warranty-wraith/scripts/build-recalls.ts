// Maps the committed CPSC snapshot to src/data/recalls.json. Run from the repo root: bun run data:wraith
import { readFileSync, writeFileSync } from 'node:fs';
import { mapCpscRecalls } from '../src/data/cpsc.ts';

const raw: unknown = JSON.parse(readFileSync(new URL('../data/cpsc-recalls.raw.json', import.meta.url), 'utf8'));
const { recalls, skipped } = mapCpscRecalls(raw);

// One recall per line keeps diffs readable.
writeFileSync(new URL('../src/data/recalls.json', import.meta.url), `[\n${recalls.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`);

console.log(`Wrote ${recalls.length} recalls to src/data/recalls.json. Skipped ${skipped.length} rows.`);
for (const s of skipped) console.log(`  row ${s.row}: ${s.reason}`);
