// Stdio entry. Protocol messages go to stdout; the one log line goes to stderr.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { repoRoot } from './root';
import { createServer } from './server';

await createServer({ root: repoRoot }).connect(new StdioServerTransport());
console.error('bone-forge ready');
