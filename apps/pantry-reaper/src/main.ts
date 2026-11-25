// Entry point: the only place that reads the real clock and makes ids.
import { mountApp } from './app';
import { samples } from './data/samples';
import { registerSw } from '@ossuary/core/pwa';

void mountApp(document.body, { clock: () => new Date(), newId: () => crypto.randomUUID(), samples });
registerSw();
