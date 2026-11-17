import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import bone from '../../bone.json';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = bone.sources.find((s) => s.id === 'usda_foodkeeper');

describe('FoodKeeper snapshot and SOURCE.md', () => {
  it('commits a raw snapshot that parses, with the 661-row Product sheet', () => {
    const raw = JSON.parse(read('../../data/foodkeeper.raw.json')) as { sheets: { name: string; data: unknown[] }[] };
    expect(raw.sheets.map((s) => s.name)).toContain('Product');
    expect(raw.sheets.find((s) => s.name === 'Product')?.data).toHaveLength(661);
  });

  it('names the dataset, both URLs, the day, the licence and the guidance line', () => {
    const md = read('../../SOURCE.md');
    expect(md).toContain('USDA FoodKeeper');
    expect(md).toContain('https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json');
    expect(md).toContain('https://web.archive.org/web/20250314020622id_/https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json');
    expect(md).toMatch(/public domain/i);
    expect(md).toMatch(/guidance, not a (food )?safety guarantee/i);
    expect(source?.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(md).toContain(`Retrieved: ${source?.retrievedOn}`);
  });

  it('cites the official FSIS URL in bone.json', () => {
    expect(source?.url).toBe('https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json');
    expect(source?.retrievedOn).toBe('2026-11-17');
  });
});
