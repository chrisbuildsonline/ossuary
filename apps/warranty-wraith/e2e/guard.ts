// Watches a page's whole context (page and service worker): requests that leave the machine, failed requests,
// console errors and uncaught page errors. `check()` fails the test on any external request or error.
import type { Page } from '@playwright/test';

const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

/** True for data: and blob: URLs and for anything served from this machine. */
export function isLocal(url: string): boolean {
  const u = new URL(url);
  return u.protocol === 'data:' || u.protocol === 'blob:' || loopback.has(u.hostname);
}

export interface Guard {
  /** Requests that left the machine. */
  external: string[];
  /** Console errors and uncaught page errors. */
  errors: string[];
  /** Requests that failed, as "url (reason)". */
  failed: string[];
  /** Throws if a request left the machine or the page logged an error. */
  check(): void;
}

export function guard(page: Page): Guard {
  const g: Guard = {
    external: [],
    errors: [],
    failed: [],
    check() {
      if (g.external.length) throw new Error(`requests left the machine: ${g.external.join(', ')}`);
      if (g.errors.length) throw new Error(`console errors: ${g.errors.join(' | ')}`);
    },
  };
  page.context().on('request', (r) => {
    if (!isLocal(r.url())) g.external.push(r.url());
  });
  page.context().on('requestfailed', (r) => g.failed.push(`${r.url()} (${r.failure()?.errorText ?? 'failed'})`));
  page.on('console', (m) => {
    if (m.type() === 'error') g.errors.push(m.text());
  });
  page.on('pageerror', (e) => g.errors.push(e.message));
  return g;
}
