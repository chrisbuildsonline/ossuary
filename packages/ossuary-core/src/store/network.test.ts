// The store must work fully offline: no request of any kind, at runtime or in its source.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aWidget, must, testDeps, widget } from '../testing/store-harness';
import { commitCsvImport, parseCsv, previewCsvImport, suggestMapping } from './index';
import { openStore } from './repo';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('store network use', () => {
  it('makes no request through any network API during a full session', async () => {
    const spies = {
      fetch: vi.fn(),
      XMLHttpRequest: vi.fn(),
      WebSocket: vi.fn(),
      EventSource: vi.fn(),
      sendBeacon: vi.fn(),
    };
    vi.stubGlobal('fetch', spies.fetch);
    vi.stubGlobal('XMLHttpRequest', spies.XMLHttpRequest);
    vi.stubGlobal('WebSocket', spies.WebSocket);
    vi.stubGlobal('EventSource', spies.EventSource);
    vi.stubGlobal('navigator', { sendBeacon: spies.sendBeacon });

    const s = must(await openStore(widget, testDeps()));
    const a = must(await s.create(aWidget));
    must(await s.update(a.id, { ...aWidget, place: 'shelf' }));
    must(await s.get(a.id));
    const backup = JSON.stringify(must(await s.exportBackup()));
    must(await s.importBackup(backup, 'replace'));
    const grid = must(parseCsv('Name,Kept in,Made\nBlue,cold,2026-11-09\nRed,attic,2026-11-09\n'));
    const preview = previewCsvImport(widget, grid, suggestMapping(widget, grid[0] ?? []));
    must(await commitCsvImport(s, preview));
    must(await s.remove(a.id));
    expect(must(await s.list())).toHaveLength(1);
    s.close();

    for (const [name, spy] of Object.entries(spies)) expect(spy, name).not.toHaveBeenCalled();
  });

  it('has no network API in its source', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url));
    const network = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|https?:\/\//;
    const hits = readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .filter((f) => network.test(readFileSync(join(dir, f), 'utf8')));
    expect(hits).toEqual([]);
  });
});
