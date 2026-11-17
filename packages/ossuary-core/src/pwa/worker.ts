// The service worker: precache the build on install, drop older builds on activate, serve same-origin GETs cache first.
import type { Precache } from './precache.ts';

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
  // The cache name is the prefix plus an 8-digit hash; caches with the same prefix belong to older builds.
  const prefix = precache.cacheName.replace(/[0-9a-f]{8}$/, '');
  scope.addEventListener('install', (e) => {
    e.waitUntil(scope.caches.open(precache.cacheName).then((c) => c.addAll(precache.urls)).then(() => scope.skipWaiting()));
  });
  scope.addEventListener('activate', (e) => {
    e.waitUntil(
      scope.caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith(prefix) && k !== precache.cacheName).map((k) => scope.caches.delete(k))))
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
  // Static files only: a Vary header (the preview server sends Vary: Origin) must not turn a hit into a miss.
  // A navigation always gets the app shell, so a reload never waits on the network.
  const hit = await cache.match(request.mode === 'navigate' ? './index.html' : request, { ignoreVary: true });
  return hit ?? scope.fetch(request);
}
