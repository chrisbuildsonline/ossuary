// Entry point: the only place that reads the real clock and makes ids.
import { registerSw } from '@ossuary/core/pwa';
import { mountApp } from './app';

void mountApp(document.body, { clock: () => new Date(), newId: () => crypto.randomUUID() });
registerSw();
