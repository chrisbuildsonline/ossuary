import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const app = fileURLToPath(new URL('..', import.meta.url));
const repo = resolve(app, '../..');
const self = fileURLToPath(import.meta.url);

type Pkg = { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string>; exports?: Record<string, string> };
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Pkg;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const code = [...walk(join(app, 'src')), ...walk(join(app, 'scripts')), ...walk(join(app, 'e2e')), join(app, 'vite.config.ts')]
  .filter((file) => file !== self && existsSync(file) && /\.(ts|js|mjs)$/.test(file));

const specifier = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
const imports = code.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(specifier)].map((m) => ({ file, spec: m[1] ?? '' })));
const show = ({ file, spec }: { file: string; spec: string }) => `${relative(app, file)}: ${spec}`;

describe('pantry-reaper boundaries', () => {
  it('scans the app code', () => {
    expect(code.map((f) => relative(app, f))).toContain('src/main.ts');
  });

  it('imports the core only through its exports map', () => {
    const core = readJson(join(repo, 'packages/ossuary-core/package.json'));
    const allowed = Object.keys(core.exports ?? {}).map((key) => (key === '.' ? '@ossuary/core' : `@ossuary/core/${key.slice(2)}`));
    const bad = imports.filter(({ spec }) => (spec.startsWith('@ossuary/') && !allowed.includes(spec)) || spec.includes('ossuary-core'));
    expect(bad.map(show)).toEqual([]);
  });

  it('never imports another app, a tool, or a path outside the app', () => {
    const bad = imports.filter(({ file, spec }) => {
      if (/warranty-wraith|bone-forge|(^|\/)tools\//.test(spec)) return true;
      if (!spec.startsWith('.')) return false;
      return relative(app, resolve(dirname(file), spec)).startsWith('..');
    });
    expect(bad.map(show)).toEqual([]);
  });

  it('has @ossuary/core as its only runtime dependency, no scripts, and ical.js for tests', () => {
    const pkg = readJson(join(app, 'package.json'));
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@ossuary/core']);
    expect(pkg.scripts).toBeUndefined();
    expect(Object.keys(pkg.devDependencies ?? {})).toContain('ical.js');
  });

  it('has no vitest or Playwright config of its own', () => {
    const configs = readdirSync(app).filter((name) => /^(vitest|playwright)\.config\./.test(name));
    expect(configs).toEqual([]);
  });

  it('is run from the root scripts', () => {
    const scripts = readJson(join(repo, 'package.json')).scripts ?? {};
    expect(scripts).toMatchObject({
      'dev:pantry': 'vite apps/pantry-reaper --port 5173 --strictPort',
      'data:pantry': 'bun apps/pantry-reaper/scripts/build-foods.ts',
      'build:pantry': 'vite build apps/pantry-reaper',
      'preview:pantry': 'vite preview apps/pantry-reaper --port 4173 --strictPort',
    });
  });
});
