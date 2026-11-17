import { describe, expect, it } from 'vitest';
import { precacheList } from './precache.ts';

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
  const prefix = 'some-app-';

  it('lists every file but the worker and source maps, sorted by name, as ./<name>', () => {
    expect(precacheList(files, { prefix }).urls).toEqual([
      './assets/fraunces-latin-wght-normal-c3.woff2',
      './assets/index-a1.js',
      './assets/index-b2.css',
      './index.html',
      './manifest.webmanifest',
    ]);
  });

  it('names the cache after a hash of the build, which changes when any file changes', () => {
    const { cacheName } = precacheList(files, { prefix });
    expect(cacheName).toMatch(/^some-app-[0-9a-f]{8}$/);
    expect(precacheList([...files].reverse(), { prefix }).cacheName).toBe(cacheName);
    const changed = files.map((f) => (f.name === 'assets/index-b2.css' ? { ...f, content: 'body{color:red}' } : f));
    expect(precacheList(changed, { prefix }).cacheName).not.toBe(cacheName);
    const font = files.map((f) => (f.name.endsWith('.woff2') ? { ...f, content: new Uint8Array([1, 2, 4]) } : f));
    expect(precacheList(font, { prefix }).cacheName).not.toBe(cacheName);
    expect(precacheList(files, { prefix: 'other-' }).cacheName).toBe(`other-${cacheName.slice(prefix.length)}`);
  });
});
