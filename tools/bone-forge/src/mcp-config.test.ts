import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { connect } from './test-client';

const path = fileURLToPath(new URL('../../../.kiro/settings/mcp.json', import.meta.url));

describe('.kiro/settings/mcp.json', () => {
  it('is valid JSON registering bone-forge with bun and the stdio entry', () => {
    const config = JSON.parse(readFileSync(path, 'utf8'));
    expect(config.mcpServers['bone-forge']).toMatchObject({ command: 'bun', args: ['tools/bone-forge/src/main.ts'], disabled: false });
  });

  it('auto approves exactly validate_spec and preview_countdown, never scaffold_app', () => {
    const { autoApprove } = JSON.parse(readFileSync(path, 'utf8')).mcpServers['bone-forge'];
    expect(autoApprove).toEqual(['validate_spec', 'preview_countdown']);
    expect(autoApprove).not.toContain('scaffold_app');
  });

  it('auto approves only tools the server lists', async () => {
    const { autoApprove } = JSON.parse(readFileSync(path, 'utf8')).mcpServers['bone-forge'] as { autoApprove: string[] };
    const client = await connect('/nowhere');
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const name of autoApprove) expect(names).toContain(name);
    await client.close();
  });
});
