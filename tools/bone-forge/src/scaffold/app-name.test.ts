import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDir, tmpRoot } from '../test-tmp';
import { appNameRule, parseAppName } from './app-name';
import { resolveAppDir } from './safe-path';

describe('parseAppName', () => {
  it('accepts lowercase names of a to z, digits and -, starting with a letter, up to 40 characters', () => {
    for (const name of ['a', 'my-app', 'app2', 'x-1-y', 'a'.repeat(40)]) expect(parseAppName(name)).toEqual({ ok: true, value: name });
  });

  it('refuses anything else, naming the rule', () => {
    for (const name of ['Bad', 'a/b', '..', '.', '1x', '-x', '', 'a'.repeat(41), 'my_app', 'a b', 'a.b', 'é', 'a\\b', 'apps/../x']) {
      expect(parseAppName(name), name).toEqual({ ok: false, error: appNameRule });
    }
    expect(appNameRule).toMatch(/a to z, digits and -, starting with a letter, at most 40 characters/);
  });
});

describe('resolveAppDir', () => {
  it('resolves a direct child of <root>/apps', () => {
    const root = tmpRoot();
    expect(resolveAppDir(root, 'my-app')).toEqual({ ok: true, value: join(root, 'apps', 'my-app') });
  });

  it('refuses ../x, an absolute path and a nested path', () => {
    const root = tmpRoot();
    for (const name of ['../x', '/tmp/x', join(root, 'apps', 'x'), 'a/b', '..', '.', '']) {
      const r = resolveAppDir(root, name);
      expect(r.ok, name).toBe(false);
    }
  });

  it('refuses apps when it is a link to another folder', () => {
    const root = tmpDir();
    const elsewhere = tmpDir();
    symlinkSync(elsewhere, join(root, 'apps'));
    expect(resolveAppDir(root, 'my-app')).toEqual({ ok: false, error: 'apps/ must be a real folder in the repo, not a link.' });
  });

  it('refuses a root without an apps folder', () => {
    const root = tmpDir();
    expect(resolveAppDir(root, 'my-app')).toEqual({ ok: false, error: 'There is no apps/ folder in the repo.' });
  });
});
