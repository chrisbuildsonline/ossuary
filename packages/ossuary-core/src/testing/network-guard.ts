// Playwright helper for the gallery: the page must make no request beyond the local dev server.

const localHosts = ['localhost', '127.0.0.1', '[::1]'];
const inlineProtocols = ['data:', 'blob:', 'about:'];

export function isLocalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return inlineProtocols.includes(u.protocol) || localHosts.includes(u.hostname);
  } catch {
    return false;
  }
}

/** Structural slice of Playwright's `Page`, so this file needs no Playwright import. */
export interface RequestSource {
  on(event: 'request', listener: (request: { url(): string }) => void): unknown;
}

/** Starts recording non-local requests. Call the returned function to read them, and expect it to be empty. */
export function guardNetwork(page: RequestSource): () => string[] {
  const blocked: string[] = [];
  page.on('request', (request) => {
    if (!isLocalUrl(request.url())) blocked.push(request.url());
  });
  return () => [...blocked];
}
