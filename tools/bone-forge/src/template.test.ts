import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBoneSpec } from '@ossuary/core/schema';
import { describe, expect, it } from 'vitest';
// The list scripts/check-boundary.ts keeps out of the core.
import { domainWords } from '../../../scripts/domain-words';

const template = fileURLToPath(new URL('../template', import.meta.url));
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const read = (path: string) => readFileSync(join(template, path), 'utf8');
const sources = () => readdirSync(join(template, 'src')).map((name) => `src/${name}`);

describe('template', () => {
  it('has a tsconfig, a placeholder bone.json and the generic source files', () => {
    for (const path of ['tsconfig.json', 'bone.json', 'src/main.ts', 'src/spec.ts', 'src/app.ts', 'src/spec.test.ts']) {
      expect(existsSync(join(template, path)), path).toBe(true);
    }
    expect(parseBoneSpec(JSON.parse(read('bone.json'))).ok).toBe(true);
  });

  it('holds no domain word', () => {
    for (const path of ['tsconfig.json', 'bone.json', ...sources()]) {
      const text = read(path).toLowerCase();
      for (const word of domainWords) expect(text.includes(word), `${path} mentions ${word}`).toBe(false);
    }
  });

  it('reads the clock and makes ids only in main.ts', () => {
    expect(read('src/main.ts')).toMatch(/new Date\(\)/);
    expect(read('src/main.ts')).toMatch(/randomUUID/);
    for (const path of sources().filter((p) => p !== 'src/main.ts')) {
      const text = read(path);
      // Tests may build a fixed Date; nothing else may touch the clock or the random source.
      const clock = path.endsWith('.test.ts') ? /new Date\(\)|Date\.now/ : /new Date\(|Date\.now/;
      expect(clock.test(text), `${path} reads the clock`).toBe(false);
      expect(/randomUUID|Math\.random|getRandomValues/.test(text), `${path} makes ids`).toBe(false);
    }
  });

  it('is typechecked by tsc -b through the root tsconfig', () => {
    const root = JSON.parse(readFileSync(join(repo, 'tsconfig.json'), 'utf8')) as { references: { path: string }[] };
    expect(root.references).toContainEqual({ path: 'tools/bone-forge/template' });
    const own = JSON.parse(read('tsconfig.json')) as { include: string[]; references: { path: string }[] };
    expect(own.include).toEqual(expect.arrayContaining(['src', 'bone.json']));
    expect(own.references).toEqual([{ path: '../../../packages/ossuary-core' }]);
  });
});
