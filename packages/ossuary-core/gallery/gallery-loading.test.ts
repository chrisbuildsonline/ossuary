// @vitest-environment happy-dom
// Requirement 6.4: the gallery list starts loading and never shows the empty state before the store has answered.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

describe('gallery list loading', () => {
  it('starts in state="loading", shows no empty state while the store opens, then shows the items', async () => {
    const seen: string[] = [];
    await import('./gallery');
    const list = document.querySelector('oss-list[data-list="items"]');
    expect(list?.getAttribute('state')).toBe('loading');
    expect(list?.shadowRoot?.querySelector('oss-empty')).toBeNull();
    expect(list?.shadowRoot?.querySelector('[aria-busy="true"] [role="status"]')?.textContent).toBe('Loading items');
    const watch = new MutationObserver(() => {
      if (list?.shadowRoot?.querySelector('oss-empty')) seen.push('empty');
    });
    if (list?.shadowRoot) watch.observe(list.shadowRoot, { childList: true, subtree: true });
    await vi.waitFor(() => expect(list?.shadowRoot?.querySelectorAll('oss-item').length).toBeGreaterThan(0), { timeout: 5000 });
    watch.disconnect();
    expect(list?.hasAttribute('state')).toBe(false);
    expect(seen).toEqual([]);
  });
});
