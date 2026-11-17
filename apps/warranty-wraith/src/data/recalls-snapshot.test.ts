import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import bone from '../../bone.json';
import { mapCpscRecalls } from './cpsc';
import recalls from './recalls.json';

const at = (path: string) => new URL(path, import.meta.url);
const raw: unknown = JSON.parse(readFileSync(at('../../data/cpsc-recalls.raw.json'), 'utf8'));
const source = (bone.sources as { id: string; url: string; retrievedOn?: string }[]).find((s) => s.id === 'cpsc_recalls');
const requestUrl = 'https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2026-06-01';

describe('CPSC snapshot and SOURCE.md', () => {
  it('commits a raw snapshot that parses as a list of recalls', () => {
    expect(Array.isArray(raw)).toBe(true);
    expect((raw as unknown[]).length).toBe(264);
  });

  it('names the dataset, the request URL, the day, the licence and the possible-match line', () => {
    const md = readFileSync(at('../../SOURCE.md'), 'utf8');
    expect(md).toContain('CPSC Recalls');
    expect(md).toContain(requestUrl);
    expect(md).toMatch(/public domain/i);
    expect(md).toMatch(/US government work/i);
    expect(md).toMatch(/freely copy and distribute recall notices/i);
    expect(md).toMatch(/possible match/i);
    expect(source?.retrievedOn).toBe('2026-11-17');
    expect(md).toContain(`Retrieved: ${source?.retrievedOn}`);
  });

  it('cites the request URL without its query in bone.json', () => {
    expect(source?.url).toBe(requestUrl.split('?')[0]);
  });
});

describe('recalls.json', () => {
  it('equals mapCpscRecalls applied to the committed snapshot (run `bun run data:wraith` to update)', () => {
    expect(recalls).toEqual(mapCpscRecalls(raw).recalls);
  });

  it('is not empty and is under 1 MB', () => {
    expect(recalls.length).toBeGreaterThan(200);
    expect(statSync(at('./recalls.json')).size).toBeLessThan(1024 * 1024);
  });

  it('only links to www.cpsc.gov notices, and has unique ids', () => {
    for (const r of recalls) expect(r.url).toMatch(/^https:\/\/www\.cpsc\.gov\//);
    expect(new Set(recalls.map((r) => r.id)).size).toBe(recalls.length);
  });
});
