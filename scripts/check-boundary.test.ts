import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBoundary } from './check-boundary';
import { domainWords } from './domain-words';

const root = fileURLToPath(new URL('..', import.meta.url));
const core = join(root, 'packages/ossuary-core');
const temps: string[] = [];

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'boundary-'));
  temps.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('checkBoundary', () => {
  it('passes on the real core', () => {
    expect(checkBoundary(core)).toEqual([]);
  });

  it('flags imports from apps and tools', () => {
    const dir = fixture({
      'src/store/a.ts': "import { x } from '../../../../apps/some-app/src/x';\n",
      'src/ui/b.ts': "export { y } from '../../../../tools/some-tool/src/index';\n",
      'gallery/c.ts': "const z = await import('@ossuary/some-app');\n",
      'src/ui/ok.ts': "import { evaluate } from '../engine';\nimport { z } from 'zod';\n",
    });
    expect(checkBoundary(dir)).toEqual([
      "gallery/c.ts: imports '@ossuary/some-app' (core must not depend on an app or tool)",
      "src/store/a.ts: imports '../../../../apps/some-app/src/x' (core must not depend on an app or tool)",
      "src/ui/b.ts: imports '../../../../tools/some-tool/src/index' (core must not depend on an app or tool)",
    ]);
  });

  it('flags Date in the pure layers but not in tests, comments or the ui', () => {
    const dir = fixture({
      'src/engine/a.ts': '// no Date object here\nexport const now = () => new Date();\n',
      'src/schema/b.ts': '/* Date is fine in a comment */\nexport const t = Date.now();\n',
      'src/ics/c.ts': 'export const d = (ms: number) => new Date(ms);\n',
      'src/engine/a.test.ts': 'const fixed = new Date(0);\n',
      'src/ui/clock.ts': 'export const now = () => new Date();\n',
    });
    expect(checkBoundary(dir)).toEqual([
      'src/engine/a.ts: uses Date (time must come in as an argument)',
      'src/ics/c.ts: uses Date (time must come in as an argument)',
      'src/schema/b.ts: uses Date (time must come in as an argument)',
    ]);
  });

  it('flags DOM use in the pure layers', () => {
    const dir = fixture({
      'src/engine/a.ts': "import { mount } from '../ui/elements/oss-item';\n",
      'src/schema/b.ts': "import { openDB } from 'idb';\n",
      'src/ics/c.ts': 'export const title = () => document.title;\n',
      'src/ui/ok.ts': 'export const title = () => document.title;\n',
    });
    expect(checkBoundary(dir)).toEqual([
      "src/engine/a.ts: imports '../ui/elements/oss-item' (engine, schema and ics stay DOM-free)",
      "src/ics/c.ts: uses document (engine, schema and ics stay DOM-free)",
      "src/schema/b.ts: imports 'idb' (engine, schema and ics stay DOM-free)",
    ]);
  });

  it('flags domain words anywhere in core', () => {
    const dir = fixture({ 'src/ui/a.ts': "export const label = 'Pantry';\n", 'gallery/fixtures/b.json': '{"name":"Kettle"}\n' });
    expect(checkBoundary(dir)).toEqual([
      'gallery/fixtures/b.json: mentions "kettle" (core has no domain words)',
      'src/ui/a.ts: mentions "pantry" (core has no domain words)',
    ]);
  });
});

describe('the domain word list', () => {
  const list = /['"]receipt['"]\s*,\s*['"]kettle['"]/;
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (['node_modules', 'dist', '.git', '.backups', '.omc', 'test-results'].includes(e.name)) return [];
      const path = join(dir, e.name);
      return e.isDirectory() ? sources(path) : /\.(ts|json)$/.test(e.name) ? [path] : [];
    });

  it('lives only in scripts/domain-words.json', () => {
    const holders = ['packages', 'apps', 'tools', 'scripts']
      .flatMap((top) => sources(join(root, top)))
      .filter((file) => list.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file));
    expect(holders).toEqual(['scripts/domain-words.json']);
  });

  it('is what the hook checks', () => {
    expect(domainWords).toEqual(JSON.parse(readFileSync(join(root, 'scripts/domain-words.json'), 'utf8')));
    expect(domainWords).toContain('kettle');
    const dir = fixture(Object.fromEntries(domainWords.map((word, i) => [`src/ui/w${i}.ts`, `// ${word.toUpperCase()}\n`])));
    expect(checkBoundary(dir)).toHaveLength(domainWords.length);
  });
});

describe('hook:boundary', () => {
  it('exits 0 on the repo', () => {
    const run = spawnSync('bun', ['run', 'hook:boundary'], { cwd: root, encoding: 'utf8' });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toContain('Core boundary holds.');
  });

  it('exits 1 and lists violations for a broken core', () => {
    const dir = fixture({ 'src/engine/a.ts': 'export const now = () => Date.now();\n' });
    const run = spawnSync('bun', ['scripts/check-boundary.ts', dir], { cwd: root, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('src/engine/a.ts: uses Date');
  });
});
