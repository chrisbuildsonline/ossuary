// The real server process over stdio, driven by the SDK client.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { item, oneSpec, twoSpec } from './fixtures';
import { connect } from './test-client';
import { tmpRoot } from './test-tmp';

const repo = fileURLToPath(new URL('../../..', import.meta.url));

describe('bone-forge over stdio', () => {
  let client: Client;
  beforeAll(async () => {
    client = new Client({ name: 'integration', version: '0.0.0' });
    await client.connect(new StdioClientTransport({ command: 'bun', args: ['tools/bone-forge/src/main.ts'], cwd: repo, stderr: 'pipe' }));
  }, 20_000);
  afterAll(async () => {
    await client.close();
  });

  it('lists exactly the three tools, with input and output schemas', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['preview_countdown', 'scaffold_app', 'validate_spec']);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema?.type).toBe('object');
    }
  });

  it('validates a spec', async () => {
    const r = await client.callTool({ name: 'validate_spec', arguments: { spec: oneSpec } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({ valid: true, issues: [] });
  });

  it('previews a countdown', async () => {
    const r = await client.callTool({ name: 'preview_countdown', arguments: { spec: twoSpec, item, now: { day: '2026-11-18' } } });
    expect(r.isError).toBeFalsy();
    expect(r.content).toEqual([
      { type: 'text', text: 'Cover ends 2026-12-01, 13 days left, Steady (primary)\nService ends 2027-11-01, 348 days left, Fresh' },
    ]);
  });

  it('answers an invalid validate_spec call as a normal result', async () => {
    const r = await client.callTool({ name: 'validate_spec', arguments: { spec: { id: 'x' } } });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { valid: boolean }).valid).toBe(false);
  });

  it('answers an invalid preview_countdown call with isError', async () => {
    const r = await client.callTool({ name: 'preview_countdown', arguments: { spec: oneSpec, item: {}, now: { day: '2026-11-18' } } });
    expect(r.isError).toBe(true);
    expect((r.content as { text: string }[])[0]?.text).toBe('name: This is required.\nstarted: This is required.');
  });

  it('answers an invalid scaffold_app call with isError and writes nothing', async () => {
    const before = readdirSync(join(repo, 'apps')).sort();
    const r = await client.callTool({ name: 'scaffold_app', arguments: { spec: { ...oneSpec, version: 0 } } });
    expect(r.isError).toBe(true);
    expect((r.content as { text: string }[])[0]?.text).toBe('version: Must be at least 1.');
    expect(readdirSync(join(repo, 'apps')).sort()).toEqual(before);
  });
});

describe('scaffold_app in memory', () => {
  it('scaffolds into a temporary root through createServer({ root })', async () => {
    const root = tmpRoot();
    const client = await connect(root);
    const r = await client.callTool({ name: 'scaffold_app', arguments: { spec: twoSpec } });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { dir: string }).dir).toBe('apps/test-two');
    expect(readdirSync(join(root, 'apps', 'test-two')).sort()).toEqual(['bone.json', 'index.html', 'package.json', 'public', 'src', 'tsconfig.json', 'vite.config.ts']);
    await client.close();
  });
});
