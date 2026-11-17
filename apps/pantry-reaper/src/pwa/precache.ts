// The service worker's precache list: every built file but the worker and source maps, under a cache named for the build.
export interface Precache {
  cacheName: string;
  urls: string[];
}

export const CACHE_PREFIX = 'pantry-reaper-';

const skip = (name: string) => name === 'sw.js' || name.endsWith('.map');
const encoder = new TextEncoder();

/** FNV-1a over every file name and its bytes, in name order. */
function hash(files: { name: string; content: string | Uint8Array }[]): string {
  let h = 0x811c9dc5;
  const eat = (bytes: Uint8Array) => {
    for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  };
  for (const f of files) {
    eat(encoder.encode(`${f.name}\0`));
    eat(typeof f.content === 'string' ? encoder.encode(f.content) : f.content);
  }
  return h.toString(16).padStart(8, '0');
}

export function precacheList(files: { name: string; content: string | Uint8Array }[]): Precache {
  const kept = files.filter((f) => !skip(f.name)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { cacheName: `${CACHE_PREFIX}${hash(kept)}`, urls: kept.map((f) => `./${f.name}`) };
}
