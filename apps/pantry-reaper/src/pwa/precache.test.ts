import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pub = new URL('../../public/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', pub), 'utf8')) as {
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
} & Record<string, unknown>;

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): [number, number] {
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

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
