import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { createServer } from './server';
import { connect } from './test-client';

describe('createServer', () => {
  it('returns an McpServer that is not connected', () => {
    const server = createServer({ root: '/nowhere' });
    expect(server).toBeInstanceOf(McpServer);
    expect(server.isConnected()).toBe(false);
  });

  it('lists exactly the three tools, each with a description and an input schema', async () => {
    const client = await connect('/nowhere');
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['preview_countdown', 'scaffold_app', 'validate_spec']);
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
      expect(Object.keys(tool.inputSchema.properties ?? {})).toContain('spec');
    }
    await client.close();
  });
});
