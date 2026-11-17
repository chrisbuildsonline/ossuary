import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { precacheList } from './precache';

const pub = new URL('../../public/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', pub), 'utf8')) as {
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
} & Record<string, unknown>;

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): [number, number] {
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('the built service worker', () => {
  const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
  const repo = fileURLToPath(new URL('../../../../', import.meta.url));
  let precache: { cacheName: string; urls: string[] };
  let built: string[];

  beforeAll(() => {
    execFileSync('bun', ['run', 'build:pantry'], { cwd: repo, stdio: 'pipe' });
    const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
    const found = /\((\{"cacheName":"[^"]+","urls":\[[^\]]*\]\})\)/.exec(sw);
    expect(found, 'sw.js carries its precache list').not.toBeNull();
    precache = JSON.parse(found?.[1] ?? '{}');
    built = (readdirSync(dist, { recursive: true }) as string[]).filter((f) => statSync(join(dist, f)).isFile()).map((f) => f.split(sep).join('/'));
  }, 60_000);

  it('precaches only files that exist in dist, and every built file but the worker and source maps', () => {
    for (const url of precache.urls) expect(existsSync(join(dist, url)), url).toBe(true);
    const expected = built.filter((f) => f !== 'sw.js' && !f.endsWith('.map')).map((f) => `./${f}`);
    expect([...precache.urls].sort()).toEqual(expected.sort());
  });

  it('includes the index, JS, CSS, the Fraunces and Inter fonts, the manifest and the icons', () => {
    const urls = precache.urls;
    expect(urls).toContain('./index.html');
    expect(urls).toContain('./manifest.webmanifest');
    for (const icon of manifest.icons) expect(urls).toContain(`./${icon.src.replace(/^\.\//, '')}`);
    expect(urls.some((u) => /^\.\/assets\/index-.+\.js$/.test(u))).toBe(true);
    expect(urls.some((u) => u.endsWith('.css'))).toBe(true);
    expect(urls.some((u) => /fraunces-latin-.+\.woff2$/.test(u))).toBe(true);
    expect(urls.some((u) => /inter-latin-.+\.woff2$/.test(u))).toBe(true);
  });

  it('carries the food data inside a precached script, so search works offline', () => {
    const scripts = precache.urls.filter((u) => u.endsWith('.js')).map((u) => readFileSync(join(dist, u), 'utf8'));
    expect(scripts.some((s) => s.includes('Yogurt'))).toBe(true);
  });

  it('names the cache after the files it lists', () => {
    const files = built.map((name) => ({ name, content: readFileSync(join(dist, name)) }));
    expect(precache.cacheName).toBe(precacheList(files).cacheName);
  });
});

describe('precacheList', () => {
  const files = [
    { name: 'index.html', content: '<!doctype html>' },
    { name: 'assets/index-a1.js', content: 'console.log(1)' },
    { name: 'assets/index-b2.css', content: 'body{}' },
    { name: 'assets/fraunces-latin-wght-normal-c3.woff2', content: new Uint8Array([1, 2, 3]) },
    { name: 'assets/index-a1.js.map', content: '{}' },
    { name: 'manifest.webmanifest', content: '{}' },
    { name: 'sw.js', content: 'self' },
  ];

  it('names the cache after a hash of the build, which changes when any file changes', () => {
    const { cacheName } = precacheList(files);
    expect(cacheName).toMatch(/^pantry-reaper-[0-9a-f]{8}$/);
    expect(precacheList([...files].reverse()).cacheName).toBe(cacheName);
    const changed = files.map((f) => (f.name === 'assets/index-b2.css' ? { ...f, content: 'body{color:red}' } : f));
    expect(precacheList(changed).cacheName).not.toBe(cacheName);
    const font = files.map((f) => (f.name.endsWith('.woff2') ? { ...f, content: new Uint8Array([1, 2, 4]) } : f));
    expect(precacheList(font).cacheName).not.toBe(cacheName);
  });
});

describe('web app manifest', () => {
  it('declares the installable app in the warm theme', () => {
    expect(manifest).toMatchObject({
      name: 'Pantry Reaper',
      short_name: 'Pantry Reaper',
      start_url: './',
      scope: './',
      display: 'standalone',
      theme_color: '#b8460e',
      background_color: '#f2efea',
    });
  });

  it('has 192 and 512 px PNG icons, one maskable, at the sizes it declares', () => {
    expect(manifest.icons.map((i) => [i.sizes, i.purpose ?? 'any'])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      const [w, h] = pngSize(readFileSync(new URL(icon.src, pub)));
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });

  it('is linked from index.html with the theme colour and an icon', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest"');
    expect(html).toContain('<meta name="theme-color" content="#b8460e"');
    expect(html).toMatch(/<link rel="(icon|apple-touch-icon)" href="\.\/icon-192\.png"/);
  });
});
