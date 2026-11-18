// createServer({ root }): the three bone-forge tools on an McpServer, with no transport connected.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolError } from './result';
import { validateSpecInput, validateSpecOutput, validateSpecTool } from './tools/validate-spec';

const specInput = z.union([z.record(z.string(), z.unknown()), z.string()]).describe('A bone spec, as a JSON object or as JSON text.');

export function createServer({ root }: { root: string }): McpServer {
  void root;
  const server = new McpServer({ name: 'bone-forge', version: '0.0.0' });

  server.registerTool(
    'validate_spec',
    {
      description: 'Check a bone spec and list every problem with its path. An invalid spec is a normal result, not an error.',
      inputSchema: validateSpecInput,
      outputSchema: validateSpecOutput,
    },
    validateSpecTool,
  );

  server.registerTool(
    'scaffold_app',
    {
      description: 'Create a new app folder apps/<name> from a valid bone spec. Writes only new files and never edits existing ones.',
      inputSchema: { spec: specInput, name: z.string().optional().describe('Folder name under apps/. Defaults to the spec id.') },
    },
    () => toolError('scaffold_app is not ready.'),
  );

  server.registerTool(
    'preview_countdown',
    {
      description: 'Evaluate one example item against a bone spec on a given day and show every lifespan, its stage and its trace.',
      inputSchema: { spec: specInput },
    },
    () => toolError('preview_countdown is not ready.'),
  );

  return server;
}
