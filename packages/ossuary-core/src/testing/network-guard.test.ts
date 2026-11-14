import { describe, expect, it } from 'vitest';
import { guardNetwork, isLocalUrl } from './network-guard';

describe('isLocalUrl', () => {
  it.each([
    'http://localhost:5173/gallery/index.html',
    'http://127.0.0.1:4173/x.js',
    'http://[::1]:3000/',
    'ws://localhost:5173/',
    'data:image/svg+xml,<svg/>',
    'blob:http://localhost:5173/0b6a',
    'about:blank',
  ])('allows %s', (url) => {
    expect(isLocalUrl(url)).toBe(true);
  });

  it.each(['https://fonts.googleapis.com/css2', 'https://example.org/', 'http://localhost.example.com/', 'not a url'])(
    'blocks %s',
    (url) => {
      expect(isLocalUrl(url)).toBe(false);
    },
  );
});

describe('guardNetwork', () => {
  it('records every non-local request a page makes', () => {
    const listeners: ((request: { url(): string }) => void)[] = [];
    const page = { on: (_event: 'request', listener: (request: { url(): string }) => void) => listeners.push(listener) };
    const blocked = guardNetwork(page);
    for (const url of ['http://localhost:5173/a.js', 'https://cdn.example.net/x.js', 'data:,x']) {
      for (const listener of listeners) listener({ url: () => url });
    }
    expect(blocked()).toEqual(['https://cdn.example.net/x.js']);
  });
});
