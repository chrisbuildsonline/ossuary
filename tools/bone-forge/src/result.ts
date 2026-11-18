// Tool result helpers: a normal result carries structured content, a tool error only text.
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Issue } from '@ossuary/core/schema';

export const ok = (structuredContent: Record<string, unknown>, text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
  structuredContent,
});

export const toolError = (text: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text }] });

/** One `path: message` line per issue; the spec root reads as `(spec)`. */
export const issueLines = (issues: readonly Issue[]): string => issues.map((i) => `${i.path || '(spec)'}: ${i.message}`).join('\n');
