// Docker is not run in the test suite, so this checks the Dockerfile against the repo it builds:
// every `bun run` script exists, the Playwright image matches the installed Playwright, and the
// .dockerignore keeps local installs and builds out while keeping what the tests read.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

describe('Dockerfile', () => {
  const docker = existsSync(join(root, 'Dockerfile')) ? read('Dockerfile') : '';
  // Instructions only, so comments may mention commands freely.
  const body = docker
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

  it('exists', () => {
    expect(docker).not.toBe('');
  });

  it('runs only scripts that package.json has', () => {
    const used = [...body.matchAll(/\bbun run ([\w:-]+)/g)].map((m) => m[1] ?? '');
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((name) => !(name in scripts))).toEqual([]);
  });

  it('runs the whole gate: test, typecheck, both hooks and e2e', () => {
    for (const name of ['test', 'typecheck', 'hook:boundary', 'hook:spec', 'e2e']) expect(body).toMatch(new RegExp(`\\bbun run ${name}\\b`));
  });

  it('installs with the frozen lockfile and the pinned pnpm', () => {
    const pinned = /^pnpm@(\d+\.\d+\.\d+)$/.exec((JSON.parse(read('package.json')) as { packageManager: string }).packageManager)?.[1];
    expect(body).toContain(`pnpm@${pinned} install --frozen-lockfile`);
  });

  it('uses the Playwright image of the installed Playwright version', () => {
    const installed = (JSON.parse(read('node_modules/@playwright/test/package.json')) as { version: string }).version;
    expect(body).toMatch(new RegExp(`^FROM mcr\\.microsoft\\.com/playwright:v${installed.replaceAll('.', '\\.')}-\\w+`, 'm'));
  });
});

describe('.dockerignore', () => {
  const lines = existsSync(join(root, '.dockerignore'))
    ? read('.dockerignore')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [];

  it('keeps local installs, builds and secrets out', () => {
    for (const entry of ['**/node_modules', '**/dist', '.env', '.git']) expect(lines).toContain(entry);
  });

  it('keeps the files the tests read', () => {
    for (const kept of ['.kiro', 'design', 'scripts', 'pnpm-lock.yaml', 'apps', 'packages', 'tools']) {
      expect(lines.filter((l) => l === kept || l === `${kept}/` || l === `/${kept}`)).toEqual([]);
    }
  });
});
