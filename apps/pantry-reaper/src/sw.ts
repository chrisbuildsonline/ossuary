// The service worker: precache the build on install, drop older builds on activate, serve same-origin GETs cache first.
// The build step in vite.config.ts replaces __PRECACHE__ with the list for that build.
import { CACHE_PREFIX, type Precache } from './pwa/precache';

interface WaitEvent {
  waitUntil(p: Promise<unknown>): void;
}
interface FetchEvent extends WaitEvent {
  request: Request;
  respondWith(r: Promise<Response>): void;
}

/** The parts of ServiceWorkerGlobalScope the worker uses. */
export interface WorkerScope {
  location: { origin: string };
  caches: CacheStorage;
  clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  fetch(request: Request): Promise<Response>;
  addEventListener(type: 'install' | 'activate', fn: (e: WaitEvent) => void): void;
  addEventListener(type: 'fetch', fn: (e: FetchEvent) => void): void;
}

const handles = (request: Request, origin: string) => request.method === 'GET' && new URL(request.url).origin === origin;

export function startWorker(scope: WorkerScope, precache: Precache): void {
  scope.addEventListener('install', (e) => {
    e.waitUntil(scope.caches.open(precache.cacheName).then((c) => c.addAll(precache.urls)).then(() => scope.skipWaiting()));
  });
  scope.addEventListener('activate', (e) => {
    e.waitUntil(
      scope.caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== precache.cacheName).map((k) => scope.caches.delete(k))))
        .then(() => scope.clients.claim()),
    );
  });
  scope.addEventListener('fetch', (e) => {
    if (!handles(e.request, scope.location.origin)) return;
    e.respondWith(respond(scope, precache, e.request));
  });
}

async function respond(scope: WorkerScope, precache: Precache, request: Request): Promise<Response> {
  const cache = await scope.caches.open(precache.cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    return await scope.fetch(request);
  } catch (err) {
    const index = request.mode === 'navigate' ? await cache.match('./index.html') : undefined;
    if (index) return index;
    throw err;
  }
}

declare const __PRECACHE__: Precache | undefined;
if (typeof __PRECACHE__ !== 'undefined') startWorker(self as unknown as WorkerScope, __PRECACHE__);
