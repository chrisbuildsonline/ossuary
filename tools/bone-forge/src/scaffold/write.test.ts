import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { oneSpec } from '../fixtures';
import { tmpRoot } from '../test-tmp';
import { scaffoldApp } from '../tools/scaffold-app';
import { type WriteFile, writeAll } from './write';

/** Writes for real until the `n`th file, then fails like a full disk. */
const failAt = (n: number): WriteFile => {
  let calls = 0;
  return (path, content, options) => {
    calls += 1;
    if (calls === n) throw new Error('ENOSPC: no space left on device');
    writeFileSync(path, content, options);
  };
};

const files = [
  { path: 'a.txt', content: 'a' },
  { path: 'src/b.ts', content: 'b' },
  { path: 'src/c.ts', content: 'c' },
  { path: 'public/d.txt', content: 'd' },
];

describe('writeAll', () => {
  it('writes every file into a new folder', () => {
    const dir = join(tmpRoot(), 'apps', 'x');
    expect(writeAll(dir, files)).toEqual({ ok: true, value: null });
    expect(readdirSync(dir).sort()).toEqual(['a.txt', 'public', 'src']);
  });

  it('removes everything it created when a write fails part way', () => {
    const root = tmpRoot();
    for (const n of [1, 2, 3, 4]) {
      const r = writeAll(join(root, 'apps', 'x'), files, failAt(n));
      expect(r).toEqual({ ok: false, error: 'Could not write the app: ENOSPC: no space left on device' });
      expect(readdirSync(join(root, 'apps'))).toEqual([]);
    }
  });
});

describe('scaffoldApp write failure', () => {
  it('returns the error and leaves no partial apps/<name> folder', () => {
    const root = tmpRoot();
    const r = scaffoldApp(root, { spec: oneSpec }, failAt(7));
    expect(r).toEqual({ ok: false, error: 'Could not write the app: ENOSPC: no space left on device' });
    expect(readdirSync(join(root, 'apps'))).toEqual([]);
  });
});
