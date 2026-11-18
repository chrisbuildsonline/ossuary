import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { checkSpecs, findSpecs } from './check-specs';

const root = fileURLToPath(new URL('..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'specs-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

const real = JSON.parse(readFileSync(join(root, 'apps/pantry-reaper/bone.json'), 'utf8')) as Record<string, unknown>;
const broken = join(temp, 'broken.json');
writeFileSync(broken, JSON.stringify({ ...real, id: 'Not An Id', name: undefined }));
const garbled = join(temp, 'garbled.json');
writeFileSync(garbled, '{ "id": ');

describe('findSpecs', () => {
  it('finds the bone spec of every app', () => {
    expect(findSpecs(root)).toEqual([
      join(root, 'apps/pantry-reaper/bone.json'),
      join(root, 'apps/warranty-wraith/bone.json'),
    ]);
  });
});

describe('checkSpecs', () => {
  it('passes every real bone spec', () => {
    expect(checkSpecs(findSpecs(root))).toEqual([]);
  });

  it('reports each schema issue of a broken spec with its path', () => {
    expect(checkSpecs([broken])).toEqual([
      `${broken}: id: Use a lowercase id: a to z, digits and -, starting with a letter.`,
      `${broken}: name: This is required.`,
    ]);
  });

  it('reports a file that is not JSON', () => {
    const problems = checkSpecs([garbled]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(new RegExp(`^${garbled}: not valid JSON`));
  });
});

describe('hook:spec', () => {
  it('exits 0 on the repo', () => {
    const run = spawnSync('bun', ['run', 'hook:spec'], { cwd: root, encoding: 'utf8' });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toContain('ok apps/pantry-reaper/bone.json');
    expect(run.stdout).toContain('ok apps/warranty-wraith/bone.json');
  });

  it('exits 1 for a broken spec passed as an argument', () => {
    const run = spawnSync('bun', ['scripts/check-specs.ts', broken], { cwd: root, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('id: Use a lowercase id');
  });
});
