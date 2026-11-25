import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const scripts = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;

interface KiroHook {
  enabled: boolean;
  name: string;
  when: { type: string; patterns: string[] };
  then: { type: string; command: string };
}

const hooks = [
  { file: 'engine-tests', script: 'hook:engine', pattern: 'packages/ossuary-core/src/**/*.ts' },
  { file: 'core-boundary', script: 'hook:boundary', pattern: 'packages/ossuary-core/**/*' },
  { file: 'bone-spec', script: 'hook:spec', pattern: 'apps/*/bone.json' },
];

describe('kiro hooks', () => {
  for (const { file, script, pattern } of hooks) {
    it(`${file} runs bun run ${script} when ${pattern} is saved`, () => {
      const hook = JSON.parse(readFileSync(join(root, '.kiro/hooks', `${file}.kiro.hook`), 'utf8')) as KiroHook;
      expect(hook.enabled).toBe(true);
      expect(hook.name).not.toBe('');
      expect(hook.when.type).toBe('fileEdited');
      expect(hook.when.patterns).toContain(pattern);
      expect(hook.then).toMatchObject({ type: 'runCommand', command: `bun run ${script}` });
      expect(scripts[script]).toBeTruthy();
    });
  }
});

describe('hook:engine', () => {
  it('runs the engine and schema tests and passes', () => {
    expect(scripts['hook:engine']).toBe('vitest run packages/ossuary-core/src/engine packages/ossuary-core/src/schema');
    const run = spawnSync('bun', ['run', 'hook:engine'], { cwd: root, encoding: 'utf8' });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    const out = stripVTControlCharacters(run.stdout);
    expect(out).toMatch(/Test Files\s+\d+ passed \(\d+\)/);
    expect(out).not.toMatch(/failed/);
  }, 60_000);
});
