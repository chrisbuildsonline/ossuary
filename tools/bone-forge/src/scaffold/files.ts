// The files of a new app, built in memory. Spec text reaches them only through JSON.stringify or HTML escaping.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type BoneSpec, defaultTheme } from '@ossuary/core/schema';

export interface AppFile {
  path: string;
  content: string;
}

/** Copied from the template as they are; everything spec-specific reaches them through bone.json. */
export const templateFiles = ['src/main.ts', 'src/spec.ts', 'src/app.ts', 'src/spec.test.ts'] as const;
export type Templates = Record<(typeof templateFiles)[number], string>;

const templateDir = fileURLToPath(new URL('../../template/', import.meta.url));

export function readTemplates(): Templates {
  return Object.fromEntries(templateFiles.map((path) => [path, readFileSync(`${templateDir}${path}`, 'utf8')])) as Templates;
}

/** The dev dependencies of apps/warranty-wraith. */
const devDependencies = {
  '@types/node': '^26.6.6',
  'fake-indexeddb': '^6.2.8',
  'fast-check': '^4.10.2',
  'happy-dom': '^21.0.4',
  'ical.js': '^2.2.1',
  zod: '^4.6.7',
};

const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => escapes[c] ?? c);
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const listed = (words: string[]) => (words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);

const tsconfig = {
  extends: '../../tsconfig.base.json',
  compilerOptions: {
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    types: ['vite/client', 'node'],
    resolveJsonModule: true,
    allowImportingTsExtensions: true,
    rootDir: '.',
    outDir: 'node_modules/.tmp/tsc',
  },
  include: ['src', 'bone.json', 'vite.config.ts'],
  references: [{ path: '../../packages/ossuary-core' }],
};

/** A white bone on the accent, so the app has an icon before anyone draws one. */
const icon = (accent: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${accent}"/>
  <g fill="#ffffff" transform="rotate(-45 256 256)">
    <rect x="156" y="226" width="200" height="60"/>
    <circle cx="156" cy="226" r="40"/><circle cx="156" cy="286" r="40"/>
    <circle cx="356" cy="226" r="40"/><circle cx="356" cy="286" r="40"/>
  </g>
</svg>
`;

export function renderFiles(spec: BoneSpec, name: string, templates: Templates): AppFile[] {
  // Hex colours, already checked by the schema.
  const accent = spec.theme?.accent ?? defaultTheme.accentInk;
  const canvas = spec.theme?.canvas ?? defaultTheme.canvas;
  const description = `Watch the ${listed(spec.lifespans.map((l) => l.label.toLowerCase()))} of every item count down.`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="${accent}" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" href="./icon.svg" type="image/svg+xml" />
    <title>${escapeHtml(spec.name)}</title>
  </head>
  <body>
    <noscript>${escapeHtml(spec.name)} needs JavaScript to run.</noscript>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;

  const manifest = {
    name: spec.name,
    short_name: spec.name,
    description,
    start_url: './',
    scope: './',
    display: 'standalone',
    theme_color: accent,
    background_color: canvas,
    icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };

  const pkg = {
    name: `@ossuary/${name}`,
    version: '0.0.0',
    private: true,
    type: 'module',
    license: 'MIT',
    dependencies: { '@ossuary/core': 'workspace:*' },
    devDependencies,
  };

  const vite = `import { ossuaryPwa } from '@ossuary/core/pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [ossuaryPwa({ prefix: '${name}-' })],
});
`;

  const files: AppFile[] = [
    { path: 'bone.json', content: json(spec) },
    { path: 'index.html', content: html },
    { path: 'package.json', content: json(pkg) },
    { path: 'public/icon.svg', content: icon(accent) },
    { path: 'public/manifest.webmanifest', content: json(manifest) },
    { path: 'tsconfig.json', content: json(tsconfig) },
    { path: 'vite.config.ts', content: vite },
    ...templateFiles.map((path) => ({ path, content: templates[path] })),
  ];
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
