import { lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseBoneSpec } from '@ossuary/core/schema';
import { describe, expect, it } from 'vitest';
import { oneSpec, twoSpec } from '../fixtures';
import { appNameRule } from '../scaffold/app-name';
import { connect } from '../test-client';
import { tmpDir, tmpRoot } from '../test-tmp';
import { scaffoldApp } from './scaffold-app';

const appFiles = [
  'bone.json',
  'index.html',
  'package.json',
  'public/icon.svg',
  'public/manifest.webmanifest',
  'src/app.ts',
  'src/main.ts',
  'src/spec.test.ts',
  'src/spec.ts',
  'tsconfig.json',
  'vite.config.ts',
];

/** Every file under `dir`, relative to `base`, sorted. */
function walk(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), base) : [relative(base, join(dir, e.name))]))
    .sort();
}

/** A temp root with its own package.json and tsconfig.json, to prove they are never edited. */
function repoLike(): string {
  const root = tmpRoot();
  writeFileSync(join(root, 'package.json'), '{ "name": "root" }\n');
  writeFileSync(join(root, 'tsconfig.json'), '{ "references": [] }\n');
  return root;
}

describe('scaffoldApp', () => {
  it('writes the eleven files into apps/<spec id> and returns them', () => {
    const root = repoLike();
    const r = scaffoldApp(root, { spec: twoSpec });
    expect(r).toEqual({ ok: true, value: { dir: 'apps/test-two', files: appFiles.map((f) => `apps/test-two/${f}`) } });
    expect(walk(join(root, 'apps', 'test-two'))).toEqual(appFiles);
    expect(walk(root)).toEqual([...appFiles.map((f) => `apps/test-two/${f}`), 'package.json', 'tsconfig.json']);
  });

  it('writes a bone.json that parses back to the parsed spec', () => {
    const root = repoLike();
    scaffoldApp(root, { spec: JSON.stringify(oneSpec), name: 'other-name' });
    const written = JSON.parse(readFileSync(join(root, 'apps', 'other-name', 'bone.json'), 'utf8'));
    expect(parseBoneSpec(written)).toEqual(parseBoneSpec(oneSpec));
  });

  it('never edits a root file', () => {
    const root = repoLike();
    scaffoldApp(root, { spec: oneSpec });
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe('{ "name": "root" }\n');
    expect(readFileSync(join(root, 'tsconfig.json'), 'utf8')).toBe('{ "references": [] }\n');
  });

  it('refuses an existing folder, file or link and leaves it untouched', () => {
    const root = repoLike();
    mkdirSync(join(root, 'apps', 'test-bone'));
    writeFileSync(join(root, 'apps', 'test-bone', 'keep.txt'), 'mine');
    expect(scaffoldApp(root, { spec: oneSpec })).toEqual({ ok: false, error: 'apps/test-bone already exists. Pick another name.' });
    expect(walk(join(root, 'apps', 'test-bone'))).toEqual(['keep.txt']);

    writeFileSync(join(root, 'apps', 'a-file'), 'mine');
    expect(scaffoldApp(root, { spec: oneSpec, name: 'a-file' })).toMatchObject({ ok: false });
    expect(readFileSync(join(root, 'apps', 'a-file'), 'utf8')).toBe('mine');

    const elsewhere = tmpDir();
    symlinkSync(elsewhere, join(root, 'apps', 'a-link'));
    expect(scaffoldApp(root, { spec: oneSpec, name: 'a-link' })).toMatchObject({ ok: false });
    expect(lstatSync(join(root, 'apps', 'a-link')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(root, 'apps', 'a-link'))).toBe(elsewhere);
    expect(readdirSync(elsewhere)).toEqual([]);

    // A dangling link counts as existing too.
    symlinkSync(join(root, 'nowhere'), join(root, 'apps', 'dangling'));
    expect(scaffoldApp(root, { spec: oneSpec, name: 'dangling' })).toMatchObject({ ok: false });
  });

  it('refuses an invalid spec and writes nothing', () => {
    const root = repoLike();
    const r = scaffoldApp(root, { spec: { ...oneSpec, version: 0 } });
    expect(r).toEqual({ ok: false, error: 'version: Must be at least 1.' });
    expect(scaffoldApp(root, { spec: '{oops' })).toEqual({ ok: false, error: '(spec): The spec is not valid JSON.' });
    expect(readdirSync(join(root, 'apps'))).toEqual([]);
  });

  it('refuses a bad name, and a spec id that is not an app name, writing nothing', () => {
    const root = repoLike();
    for (const name of ['Bad', 'a/b', '..', '../x', '/tmp/x', '1x', '-x', '', 'a'.repeat(41)]) {
      expect(scaffoldApp(root, { spec: oneSpec, name }), name).toEqual({ ok: false, error: appNameRule });
    }
    // Spec ids follow the same rule, so a spec id with "_" fails as a spec before the name is checked.
    expect(scaffoldApp(root, { spec: { ...oneSpec, id: 'my_app' } })).toMatchObject({ ok: false, error: expect.stringMatching(/^id: /) });
    expect(readdirSync(join(root, 'apps'))).toEqual([]);
  });

  it('refuses an apps folder that is a link, writing nothing there', () => {
    const root = tmpDir();
    const elsewhere = tmpDir();
    symlinkSync(elsewhere, join(root, 'apps'));
    expect(scaffoldApp(root, { spec: oneSpec })).toEqual({ ok: false, error: 'apps/ must be a real folder in the repo, not a link.' });
    expect(readdirSync(elsewhere)).toEqual([]);
  });
});

describe('scaffold_app tool', () => {
  it('returns { dir, files } and the next steps', async () => {
    const root = repoLike();
    const client = await connect(root);
    const r = await client.callTool({ name: 'scaffold_app', arguments: { spec: oneSpec, name: 'fresh-app' } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({ dir: 'apps/fresh-app', files: appFiles.map((f) => `apps/fresh-app/${f}`) });
    expect(r.content).toEqual([
      {
        type: 'text',
        text: [
          'Created apps/fresh-app (11 files). Next:',
          '1. Add { "path": "apps/fresh-app" } to "references" in tsconfig.json.',
          '2. Add "dev:fresh-app" and "build:fresh-app" scripts to package.json (vite apps/fresh-app).',
          '3. Run pnpm install.',
        ].join('\n'),
      },
    ]);
    await client.close();
  });

  it('returns a tool error for an invalid spec', async () => {
    const root = repoLike();
    const client = await connect(root);
    const r = await client.callTool({ name: 'scaffold_app', arguments: { spec: { id: 'x' } } });
    expect(r.isError).toBe(true);
    expect(readdirSync(join(root, 'apps'))).toEqual([]);
    await client.close();
  });
});
