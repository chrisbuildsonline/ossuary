import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
// The one word list, shared with hook:boundary. Read, not imported: it sits outside this package.
const banned: string[] = JSON.parse(readFileSync(new URL('../../../scripts/domain-words.json', import.meta.url), 'utf8'));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules') return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('core boundaries', () => {
  it('contains no domain words', () => {
    expect(banned.length).toBeGreaterThan(0);
    const hits = walk(root)
      .flatMap((file) => {
        const text = readFileSync(file, 'utf8').toLowerCase();
        return banned.filter((word) => text.includes(word)).map((word) => `${relative(root, file)}: ${word}`);
      });
    expect(hits).toEqual([]);
  });

  it('never reads the clock in engine, schema or ics', () => {
    const clock = /Date\.now\s*\(|new\s+Date\s*\(\s*\)/;
    const hits = ['engine', 'schema', 'ics']
      .flatMap((dir) => walk(join(root, 'src', dir)))
      .filter((file) => clock.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file));
    expect(hits).toEqual([]);
  });

  it('imports nothing from apps or tools', () => {
    const specifier = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
    const hits = walk(join(root, 'src'))
      .filter((file) => file.endsWith('.ts'))
      .flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(specifier)]
          .map((m) => m[1] ?? '')
          .filter((spec) => /(^|\/)(apps|tools)\//.test(spec) || spec.startsWith('@ossuary/'))
          .map((spec) => `${relative(root, file)}: ${spec}`),
      );
    expect(hits).toEqual([]);
  });

  it('has only allowed runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    const allowed = (name: string) => ['zod', 'idb'].includes(name) || name.startsWith('@fontsource-variable/');
    expect(Object.keys(pkg.dependencies ?? {}).filter((name) => !allowed(name))).toEqual([]);
  });
});
