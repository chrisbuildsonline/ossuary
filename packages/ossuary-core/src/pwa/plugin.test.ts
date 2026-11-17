import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ossuaryPwa } from './plugin.ts';
import { precacheList } from './precache.ts';

type Hook = (this: unknown, ...args: unknown[]) => unknown;
const hook = (h: unknown) => h as Hook;
const here = fileURLToPath(new URL('.', import.meta.url));
const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'oss-pwa-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('ossuaryPwa', () => {
  it('runs at build time only, after the other plugins', () => {
    expect(ossuaryPwa({ prefix: 'some-app-' })).toMatchObject({ apply: 'build', enforce: 'post' });
  });

  it('adds the worker as a second input next to the page, named sw.js', async () => {
    const root = tempDir();
    const config = (await hook(ossuaryPwa({ prefix: 'some-app-' }).config).call({}, { root }, { command: 'build', mode: 'production' })) as {
      build: { rolldownOptions: { input: Record<string, string>; preserveEntrySignatures: boolean; output: { entryFileNames: (c: { name: string }) => string } } };
    };
    const { input, preserveEntrySignatures, output } = config.build.rolldownOptions;
    expect(input).toEqual({ index: join(root, 'index.html'), sw: join(here, 'sw-entry.ts') });
    expect(preserveEntrySignatures).toBe(false);
    expect(output.entryFileNames({ name: 'sw' })).toBe('sw.js');
    expect(output.entryFileNames({ name: 'index' })).toBe('assets/[name]-[hash].js');
  });

  it('replaces __PRECACHE__ in sw.js with the list of the written files', async () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html>');
    writeFileSync(join(dir, 'assets/index-a1.js'), 'console.log(1)');
    writeFileSync(join(dir, 'assets/index-a1.js.map'), '{}');
    writeFileSync(join(dir, 'sw.js'), 'start(self,__PRECACHE__);');
    const files = (readdirSync(dir, { recursive: true }) as string[])
      .filter((f) => f.includes('.'))
      .map((name) => ({ name: name.split('\\').join('/'), content: readFileSync(join(dir, name)) }));
    const expected = precacheList(files, { prefix: 'some-app-' });
    const errors: string[] = [];
    await hook(ossuaryPwa({ prefix: 'some-app-' }).writeBundle).call({ error: (m: string) => errors.push(m) }, { dir }, {});
    expect(errors).toEqual([]);
    expect(readFileSync(join(dir, 'sw.js'), 'utf8')).toBe(`start(self,(${JSON.stringify(expected)}));`);
    expect(expected.urls).toEqual(['./assets/index-a1.js', './index.html']);
    expect(expected.cacheName).toMatch(/^some-app-[0-9a-f]{8}$/);
  });

  it('fails the build when sw.js has no __PRECACHE__ token', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'sw.js'), 'self');
    const errors: string[] = [];
    await hook(ossuaryPwa({ prefix: 'some-app-' }).writeBundle).call({ error: (m: string) => errors.push(m) }, { dir }, {});
    expect(errors).toEqual(['sw.js was not built']);
  });
});

describe('src/pwa modules', () => {
  const sources = readdirSync(here).filter((f) => f.endsWith('.ts'));
  const specifier = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

  it('import local files with their .ts extension, as the native config loader needs', () => {
    const bad = sources.flatMap((file) =>
      [...readFileSync(join(here, file), 'utf8').matchAll(specifier)]
        .map((m) => m[1] ?? '')
        .filter((spec) => spec.startsWith('.') && !spec.endsWith('.ts'))
        .map((spec) => `${file}: ${spec}`),
    );
    expect(sources).toContain('index.ts');
    expect(bad).toEqual([]);
  });

  it('import node: modules only inside functions, never at the top level', () => {
    const top = /^import[^\n]*['"]node:/m;
    expect(sources.filter((f) => !f.endsWith('.test.ts') && top.test(readFileSync(join(here, f), 'utf8')))).toEqual([]);
  });
});
