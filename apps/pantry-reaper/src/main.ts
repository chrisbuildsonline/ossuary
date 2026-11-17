// Entry point: the only place that reads the real clock and makes ids.
import { mountApp } from './app';
import { registerSw } from './pwa/register-sw';

void mountApp(document.body, { clock: () => new Date(), newId: () => crypto.randomUUID() });
registerSw();
