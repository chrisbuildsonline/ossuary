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
const importsOf = (file: string) => [...readFileSync(file, 'utf8').matchAll(specifier)].map((m) => m[1] ?? '');
const imports = code.flatMap((file) => importsOf(file).map((spec) => ({ file, spec })));
const show = ({ file, spec }: { file: string; spec: string }) => `${relative(app, file)}: ${spec}`;

/** Imports that survive compilation: `import type` and `export type ... from` are erased, so the browser never loads them. */
const typeOnly = /^\s*(?:import|export)\s+type\s[^;]*;/gm;
const runtimeImportsOf = (file: string) => [...readFileSync(file, 'utf8').replace(typeOnly, '').matchAll(specifier)].map((m) => m[1] ?? '');

/** Every app file the browser bundle loads: main.ts and the local modules it imports, transitively. */
function runtimeFiles(): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    for (const spec of runtimeImportsOf(file)) {
      if (!spec.startsWith('.')) continue;
      const base = resolve(dirname(file), spec);
      const hit = [base, `${base}.ts`, join(base, 'index.ts')].find((p) => existsSync(p) && statSync(p).isFile());
      if (hit && /\.ts$/.test(hit)) visit(hit);
    }
  };
  visit(join(app, 'src/main.ts'));
  return [...seen];
}

describe('warranty-wraith boundaries', () => {
  it('scans the app code', () => {
    expect(code.map((f) => relative(app, f))).toEqual(expect.arrayContaining(['src/main.ts', 'src/spec.ts', 'vite.config.ts']));
  });

  it('imports the core only through its exports map', () => {
    const core = readJson(join(repo, 'packages/ossuary-core/package.json'));
    const allowed = Object.keys(core.exports ?? {}).map((key) => (key === '.' ? '@ossuary/core' : `@ossuary/core/${key.slice(2)}`));
    const bad = imports.filter(({ spec }) => (spec.startsWith('@ossuary/') && !allowed.includes(spec)) || spec.includes('ossuary-core'));
    expect(bad.map(show)).toEqual([]);
  });

  it('never imports Pantry Reaper, a tool, or a path outside the app', () => {
    const bad = imports.filter(({ file, spec }) => {
      if (/pantry-reaper|bone-forge|(^|\/)tools\//.test(spec)) return true;
      if (!spec.startsWith('.')) return false;
      return relative(app, resolve(dirname(file), spec)).startsWith('..');
    });
    expect(bad.map(show)).toEqual([]);
  });

  it('imports local files in vite.config.ts with their extension, as the native config loader needs', () => {
    const bad = imports.filter(({ file, spec }) => file.endsWith('vite.config.ts') && spec.startsWith('.') && !/\.[a-z]+$/.test(spec));
    expect(bad.map(show)).toEqual([]);
  });

  it('has @ossuary/core as its only runtime dependency, no scripts, and the test tools as dev dependencies', () => {
    const pkg = readJson(join(app, 'package.json'));
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@ossuary/core']);
    expect(pkg.scripts).toBeUndefined();
    expect(Object.keys(pkg.devDependencies ?? {}).sort()).toEqual(['@types/node', 'fake-indexeddb', 'fast-check', 'happy-dom', 'ical.js', 'zod']);
  });

  it('has no vitest or Playwright config of its own', () => {
    const configs = readdirSync(app).filter((name) => /^(vitest|playwright)\.config\./.test(name));
    expect(configs).toEqual([]);
  });

  it('is run from the root scripts, on its own ports', () => {
    const scripts = readJson(join(repo, 'package.json')).scripts ?? {};
    expect(scripts).toMatchObject({
      'dev:wraith': 'vite apps/warranty-wraith --port 5174 --strictPort',
      'data:wraith': 'bun apps/warranty-wraith/scripts/build-recalls.ts',
      'icons:wraith': 'bun apps/warranty-wraith/scripts/draw-icons.ts',
      'build:wraith': 'vite build apps/warranty-wraith',
      'preview:wraith': 'vite preview apps/warranty-wraith --port 4174 --strictPort',
    });
  });

  it('keeps zod out of every file the browser loads', () => {
    const runtime = runtimeFiles();
    expect(runtime.map((f) => relative(app, f))).toContain('src/main.ts');
    // The matcher runs in the browser; the zod mapper is only reached through a type import, which is erased.
    expect(runtime.map((f) => relative(app, f))).toContain('src/data/match.ts');
    expect(runtime.map((f) => relative(app, f))).not.toContain('src/data/cpsc.ts');
    const bad = runtime.flatMap((file) => runtimeImportsOf(file).filter((spec) => spec === 'zod' || spec.startsWith('zod/')).map((spec) => ({ file, spec })));
    expect(bad.map(show)).toEqual([]);
  });

  it('has no service worker or registration code of its own', () => {
    expect(existsSync(join(app, 'src/sw.ts'))).toBe(false);
    const bad = code.filter((file) => /self\.addEventListener|serviceWorker\.register|__PRECACHE__|caches\.open/.test(readFileSync(file, 'utf8')));
    expect(bad.map((f) => relative(app, f))).toEqual([]);
    expect(readFileSync(join(app, 'vite.config.ts'), 'utf8')).toContain("ossuaryPwa({ prefix: 'warranty-wraith-' })");
  });
});
