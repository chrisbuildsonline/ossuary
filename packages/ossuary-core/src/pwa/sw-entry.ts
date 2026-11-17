// The worker script the plugin builds as sw.js. The plugin replaces __PRECACHE__ with the list for that build.
import type { Precache } from './precache.ts';
import { type WorkerScope, startWorker } from './worker.ts';

declare const __PRECACHE__: Precache;
startWorker(self as unknown as WorkerScope, __PRECACHE__);
