import { describe, expect, it, vi } from 'vitest';
import { type WorkerScope, startWorker } from './worker.ts';

type Listener = (event: unknown) => void;
const origin = 'https://app.test';

/** A stand-in for the service worker global: listeners, Cache Storage in memory and a network stub. */
function fakeSelf(cached: Record<string, string> = {}, oldCaches: string[] = []) {
  const listeners = new Map<string, Listener>();
  const stores = new Map<string, Map<string, Response>>([...oldCaches.map((n) => [n, new Map()] as const)]);
  const network = vi.fn(async (req: Request) => new Response(`network ${req.url}`));
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      addAll: async (urls: string[]) => {
        for (const u of urls) store.set(new URL(u, `${origin}/`).href, new Response(cached[u] ?? u));
      },
      match: async (req: Request | string) => store.get(new URL(typeof req === 'string' ? req : req.url, `${origin}/`).href)?.clone(),
    };
  };
  const scope = {
    location: { origin },
    caches: { open, keys: async () => [...stores.keys()], delete: async (n: string) => stores.delete(n) },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(async () => undefined),
    fetch: network,
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
  } as unknown as WorkerScope;
  const run = async (type: string, extra: Record<string, unknown> = {}) => {
    let waited: Promise<unknown> | undefined;
    let responded: Promise<Response> | undefined;
    listeners.get(type)?.({ ...extra, waitUntil: (p: Promise<unknown>) => (waited = p), respondWith: (p: Promise<Response>) => (responded = p) });
    await waited;
    return responded;
  };
  return { scope, stores, network, run };
}

const prefix = 'some-app-';
const precache = { cacheName: `${prefix}0badc0de`, urls: ['./index.html', './assets/app.js'] };
const get = (url: string, mode = 'no-cors') => ({ url, method: 'GET', mode, clone() { return this; } }) as unknown as Request;

describe('startWorker', () => {
  it('precaches the build on install and drops caches of older builds with the same prefix on activate', async () => {
    const f = fakeSelf({}, [`${prefix}1234abcd`, 'someone-else', 'other-app-1234abcd']);
    startWorker(f.scope, precache);
    await f.run('install');
    expect([...(f.stores.get(precache.cacheName)?.keys() ?? [])]).toEqual([`${origin}/index.html`, `${origin}/assets/app.js`]);
    await f.run('activate');
    expect([...f.stores.keys()].sort()).toEqual(['other-app-1234abcd', precache.cacheName, 'someone-else']);
  });

  it('serves same-origin GET requests from the cache, then the network', async () => {
    const f = fakeSelf({ './assets/app.js': 'cached app' });
    startWorker(f.scope, precache);
    await f.run('install');
    const hit = await f.run('fetch', { request: get(`${origin}/assets/app.js`) });
    expect(await hit?.text()).toBe('cached app');
    const miss = await f.run('fetch', { request: get(`${origin}/other.txt`) });
    expect(await miss?.text()).toBe(`network ${origin}/other.txt`);
  });

  it('serves navigations from the cached index.html, so an offline reload makes no failed request', async () => {
    const f = fakeSelf({ './index.html': '<html>app</html>' });
    startWorker(f.scope, precache);
    await f.run('install');
    const page = await f.run('fetch', { request: get(`${origin}/`, 'navigate') });
    expect(await page?.text()).toBe('<html>app</html>');
    expect(f.network).not.toHaveBeenCalled();
  });

  it('leaves other origins and non-GET requests to the browser', async () => {
    const f = fakeSelf();
    startWorker(f.scope, precache);
    expect(await f.run('fetch', { request: get('https://cdn.example.com/x.js') })).toBeUndefined();
    expect(await f.run('fetch', { request: { ...get(`${origin}/save`), method: 'POST' } })).toBeUndefined();
    expect(f.network).not.toHaveBeenCalled();
  });
});
