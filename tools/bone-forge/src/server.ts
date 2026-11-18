// createServer({ root }): the three bone-forge tools on an McpServer, with no transport connected.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { previewCountdownInput, previewCountdownOutput, previewCountdownTool } from './tools/preview-countdown';
import { scaffoldAppInput, scaffoldAppOutput, scaffoldAppTool } from './tools/scaffold-app';
import { validateSpecInput, validateSpecOutput, validateSpecTool } from './tools/validate-spec';

export function createServer({ root }: { root: string }): McpServer {
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
      inputSchema: scaffoldAppInput,
      outputSchema: scaffoldAppOutput,
    },
    (input) => scaffoldAppTool(root, input),
  );

  server.registerTool(
    'preview_countdown',
    {
      description: 'Evaluate one example item against a bone spec on a given day and show every lifespan, its stage and its trace.',
      inputSchema: previewCountdownInput,
      outputSchema: previewCountdownOutput,
    },
    previewCountdownTool,
  );

  return server;
}
