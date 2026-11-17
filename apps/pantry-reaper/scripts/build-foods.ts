// Maps the committed FoodKeeper snapshot to src/data/foods.json. Run from the repo root: bun run data:pantry
import { readFileSync, writeFileSync } from 'node:fs';
import { mapFoodKeeper } from '../src/data/foodkeeper';

const raw: unknown = JSON.parse(readFileSync(new URL('../data/foodkeeper.raw.json', import.meta.url), 'utf8'));
const { foods, skipped } = mapFoodKeeper(raw);

// One food per line keeps diffs readable.
writeFileSync(new URL('../src/data/foods.json', import.meta.url), `[\n${foods.map((f) => JSON.stringify(f)).join(',\n')}\n]\n`);

console.log(`Wrote ${foods.length} foods to src/data/foods.json. Skipped ${skipped.length} rows.`);
for (const s of skipped) console.log(`  row ${s.row}: ${s.reason}`);
