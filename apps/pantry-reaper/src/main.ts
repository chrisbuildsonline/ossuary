// Entry point: the only place that reads the real clock and makes ids.
import { mountApp } from './app';

void mountApp(document.body, { clock: () => new Date(), newId: () => crypto.randomUUID() });
