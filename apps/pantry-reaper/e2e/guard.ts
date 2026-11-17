// Records every request the page's context makes (page and service worker) and every console error.
import type { Page } from '@playwright/test';

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocal(url: string): boolean {
  const u = new URL(url);
  return u.protocol === 'data:' || u.protocol === 'blob:' || localHosts.has(u.hostname);
}

export interface Guard {
  /** Console errors and page errors seen so far. */
  errors: string[];
  /** Requests that failed, as "url (reason)". */
  failed: string[];
  /** Throws if any request left the machine. */
  check(): void;
}

export function watchPage(page: Page): Guard {
  const external: string[] = [];
  const guard: Guard = {
    errors: [],
    failed: [],
    check() {
      if (external.length) throw new Error(`non-local requests: ${external.join(', ')}`);
    },
  };
  page.context().on('request', (r) => {
    if (!isLocal(r.url())) external.push(r.url());
  });
  page.context().on('requestfailed', (r) => guard.failed.push(`${r.url()} (${r.failure()?.errorText ?? 'failed'})`));
  page.on('console', (m) => {
    if (m.type() === 'error') guard.errors.push(m.text());
  });
  page.on('pageerror', (e) => guard.errors.push(e.message));
  return guard;
}
