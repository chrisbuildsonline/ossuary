// Builds the real app and checks the real dist: the precache list the core plugin writes into sw.js, and the manifest.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { precacheList } from '@ossuary/core/pwa';
import recalls from './data/recalls.json';

const app = new URL('../', import.meta.url);
const pub = new URL('public/', app);

type Icon = { src: string; sizes: string; type: string; purpose?: string };
const readManifest = () => JSON.parse(readFileSync(new URL('manifest.webmanifest', pub), 'utf8')) as { icons: Icon[] } & Record<string, unknown>;

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): string {
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('the built app and its service worker', () => {
  const dist = fileURLToPath(new URL('dist/', app));
  const repo = fileURLToPath(new URL('../../', app));
  let precache: { cacheName: string; urls: string[] };
  let built: string[];
  const read = (url: string) => readFileSync(join(dist, url), 'utf8');

  beforeAll(() => {
    // Vitest sets NODE_ENV=test, which would build without import.meta.env.PROD and so without the worker registration.
    execFileSync('bun', ['run', 'build:wraith'], { cwd: repo, stdio: 'pipe', env: { ...process.env, NODE_ENV: 'production' } });
    const found = /\((\{"cacheName":"[^"]+","urls":\[[^\]]*\]\})\)/.exec(read('sw.js'));
    expect(found, 'sw.js carries its precache list').not.toBeNull();
    precache = JSON.parse(found?.[1] ?? '{}');
    built = (readdirSync(dist, { recursive: true }) as string[]).filter((f) => statSync(join(dist, f)).isFile()).map((f) => f.split(sep).join('/'));
  }, 120_000);

  it('lists only files that exist, and every built file except the worker and source maps', () => {
    for (const url of precache.urls) expect(existsSync(join(dist, url)), url).toBe(true);
    const expected = built.filter((f) => f !== 'sw.js' && !f.endsWith('.map')).map((f) => `./${f}`);
    expect([...precache.urls].sort()).toEqual(expected.sort());
  });

  it('lists the page, its script and CSS, the Space Grotesk and Inter fonts, the manifest and every icon', () => {
    const urls = precache.urls;
    expect(urls).toContain('./index.html');
    expect(urls).toContain('./manifest.webmanifest');
    for (const icon of readManifest().icons) expect(urls).toContain(`./${icon.src}`);
    expect(urls.some((u) => /^\.\/assets\/index-.+\.js$/.test(u))).toBe(true);
    expect(urls.some((u) => u.endsWith('.css'))).toBe(true);
    expect(urls.some((u) => /space-grotesk-latin-.+\.woff2$/.test(u))).toBe(true);
    expect(urls.some((u) => /inter-latin-.+\.woff2$/.test(u))).toBe(true);
  });

  it('registers ./sw.js from the page script', () => {
    const entry = /<script type="module"[^>]* src="\.?\/(assets\/index-[^"]+\.js)"/.exec(read('index.html'))?.[1];
    expect(entry, 'index.html loads the built entry').toBeDefined();
    expect(read(entry ?? '')).toMatch(/serviceWorker\.register\(\s*[`'"]\.\/sw\.js[`'"]/);
  });

  it('ships no TypeScript source', () => {
    expect(built.filter((f) => f.endsWith('.ts'))).toEqual([]);
  });

  it('carries the recall data inside a listed script, so matching works offline', () => {
    const recall = recalls[0];
    expect(recall).toBeDefined();
    const scripts = precache.urls.filter((u) => u.endsWith('.js')).map(read);
    expect(scripts.some((s) => s.includes(recall?.id ?? '-') && s.includes(recall?.url ?? '-'))).toBe(true);
    expect(built.some((f) => f.endsWith('.json'))).toBe(false);
  });

  it('names the cache after the files it lists', () => {
    const files = built.map((name) => ({ name, content: readFileSync(join(dist, name)) }));
    expect(precache.cacheName).toMatch(/^warranty-wraith-[0-9a-f]{8}$/);
    expect(precache.cacheName).toBe(precacheList(files, { prefix: 'warranty-wraith-' }).cacheName);
  });

  it('keeps Node modules out of every listed script', () => {
    const leaked = precache.urls.filter((u) => u.endsWith('.js') && /["'`]node:[a-z]/.test(read(u)));
    expect(leaked).toEqual([]);
  });
});

describe('web app manifest', () => {
  it('declares the installable app in the cool theme', () => {
    expect(readManifest()).toMatchObject({
      name: 'Warranty Wraith',
      short_name: 'Wraith',
      start_url: './',
      scope: './',
      display: 'standalone',
      theme_color: '#5a4bd1',
      background_color: '#edeff6',
    });
  });

  it('has 192 and 512 px PNG icons, one maskable, at the sizes it declares', () => {
    const { icons } = readManifest();
    expect(icons.map((i) => [i.sizes, i.purpose ?? 'any'])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(pngSize(readFileSync(new URL(icon.src, pub)))).toBe(icon.sizes);
    }
  });

  it('is linked from index.html with the theme colour and an icon', () => {
    const html = readFileSync(new URL('index.html', app), 'utf8');
    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest"');
    expect(html).toContain('<meta name="theme-color" content="#5a4bd1"');
    expect(html).toContain('<link rel="icon" href="./icon-192.png"');
    expect(html).toContain('<link rel="apple-touch-icon" href="./icon-192.png"');
  });
});
