import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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

describe('precacheList', () => {
  const files = [
    { name: 'index.html', content: '<!doctype html>' },
    { name: 'assets/index-a1.js', content: 'console.log(1)' },
    { name: 'assets/index-b2.css', content: 'body{}' },
    { name: 'assets/fraunces-latin-wght-normal-c3.woff2', content: new Uint8Array([1, 2, 3]) },
    { name: 'assets/index-a1.js.map', content: '{}' },
    { name: 'manifest.webmanifest', content: '{}' },
    { name: 'icon-192.png', content: new Uint8Array([9]) },
    { name: 'foods.json', content: '[]' },
    { name: 'sw.js', content: 'self' },
  ];

  it('lists the index, JS, CSS, fonts, icons, manifest and foods.json, but not the worker or source maps', () => {
    expect(precacheList(files).urls).toEqual([
      './assets/fraunces-latin-wght-normal-c3.woff2',
      './assets/index-a1.js',
      './assets/index-b2.css',
      './foods.json',
      './icon-192.png',
      './index.html',
      './manifest.webmanifest',
    ]);
  });

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
