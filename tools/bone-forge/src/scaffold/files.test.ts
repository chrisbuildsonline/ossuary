import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type BoneSpec, parseBoneSpec } from '@ossuary/core/schema';
import { describe, expect, it } from 'vitest';
import { oneSpec, twoSpec } from '../fixtures';
import { readTemplates, renderFiles, templateFiles } from './files';

const repoFile = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');

function parsed(input: unknown): BoneSpec {
  const r = parseBoneSpec(input);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

const templates = readTemplates();
const render = (spec: unknown = twoSpec, name = 'my-app') => new Map(renderFiles(parsed(spec), name, templates).map((f) => [f.path, f.content]));
const file = (files: Map<string, string>, path: string) => {
  const content = files.get(path);
  if (content === undefined) throw new Error(`no ${path}`);
  return content;
};

describe('renderFiles', () => {
  it('writes exactly the eleven app files, sorted', () => {
    expect(renderFiles(parsed(twoSpec), 'my-app', templates).map((f) => f.path)).toEqual([
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
    ]);
  });

  it('pretty prints the parsed spec as bone.json, with a final newline', () => {
    const spec = parsed(twoSpec);
    const text = file(render(), 'bone.json');
    expect(text).toBe(`${JSON.stringify(spec, null, 2)}\n`);
    expect(parseBoneSpec(JSON.parse(text))).toEqual({ ok: true, value: spec });
  });

  it('names the package after the app and depends on the core like the existing apps', () => {
    const pkg = JSON.parse(file(render(), 'package.json'));
    const wraith = JSON.parse(repoFile('apps/warranty-wraith/package.json'));
    expect(pkg).toEqual({
      name: '@ossuary/my-app',
      version: '0.0.0',
      private: true,
      type: 'module',
      license: 'MIT',
      dependencies: { '@ossuary/core': 'workspace:*' },
      devDependencies: wraith.devDependencies,
    });
  });

  it('builds the manifest from the spec name and colours, with core defaults', () => {
    const themed = { ...twoSpec, theme: { accent: '#5a4bd1', canvas: '#edeff6' } };
    expect(JSON.parse(file(render(themed), 'public/manifest.webmanifest'))).toMatchObject({
      name: 'Test Two',
      short_name: 'Test Two',
      display: 'standalone',
      start_url: './',
      scope: './',
      theme_color: '#5a4bd1',
      background_color: '#edeff6',
      icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
    });
    expect(JSON.parse(file(render(), 'public/manifest.webmanifest'))).toMatchObject({ theme_color: '#3657c9', background_color: '#eef0f4' });
    expect(file(render(themed), 'public/icon.svg')).toContain('fill="#5a4bd1"');
  });

  it('escapes spec text in index.html and sets the theme colour', () => {
    const spec = { ...oneSpec, name: 'A <b>"bold"</b> & \'odd\' name', lifespans: [{ ...oneSpec.lifespans[0], label: '<i>Cover</i>' }] };
    const html = file(render(spec), 'index.html');
    expect(html).toContain('<title>A &lt;b&gt;&quot;bold&quot;&lt;/b&gt; &amp; &#39;odd&#39; name</title>');
    expect(html).toContain('<meta name="description" content="Watch the &lt;i&gt;cover&lt;/i&gt; of every item count down." />');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).toContain('<meta name="theme-color" content="#3657c9" />');
    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
    expect(html).toContain('<link rel="icon" href="./icon.svg" type="image/svg+xml" />');
    expect(html).toContain('<script type="module" src="/src/main.ts"></script>');
  });

  it('gives vite the app prefix and tsconfig the core reference', () => {
    const files = render();
    expect(file(files, 'vite.config.ts')).toContain("ossuaryPwa({ prefix: 'my-app-' })");
    const tsconfig = JSON.parse(file(files, 'tsconfig.json'));
    expect(tsconfig.extends).toBe('../../tsconfig.base.json');
    expect(tsconfig.references).toEqual([{ path: '../../packages/ossuary-core' }]);
    expect(tsconfig.include).toEqual(['src', 'bone.json', 'vite.config.ts']);
  });

  it('copies the template sources byte for byte', () => {
    const files = render();
    for (const path of templateFiles) {
      expect(file(files, path)).toBe(readFileSync(fileURLToPath(new URL(`../../template/${path}`, import.meta.url)), 'utf8'));
    }
  });

  it('gives the same files for the same spec and name', () => {
    expect(renderFiles(parsed(twoSpec), 'my-app', readTemplates())).toEqual(renderFiles(parsed(structuredClone(twoSpec)), 'my-app', readTemplates()));
  });
});
