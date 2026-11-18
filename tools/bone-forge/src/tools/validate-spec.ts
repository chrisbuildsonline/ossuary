// validate_spec: parseBoneSpec over a spec object or JSON text. An invalid spec is a normal result.
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Issue } from '@ossuary/core/schema';
import { z } from 'zod';
import { readSpec } from '../input';
import { issueLines, ok } from '../result';

export const validateSpecInput = { spec: z.unknown().describe('A bone spec, as a JSON value or as JSON text.') };
export const validateSpecOutput = {
  valid: z.boolean(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })),
};

export interface ValidateOutput {
  valid: boolean;
  issues: Issue[];
}

export function validateSpec(spec: unknown): ValidateOutput {
  const r = readSpec(spec);
  return r.ok ? { valid: true, issues: [] } : { valid: false, issues: r.error };
}

/** Never returns isError: a spec that cannot be read is one issue at path "". */
export function validateSpecTool({ spec }: { spec?: unknown }): CallToolResult {
  try {
    const r = readSpec(spec);
    if (r.ok) return ok({ valid: true, issues: [] }, `ok: ${r.value.id}`);
    return ok({ valid: false, issues: r.error }, issueLines(r.error));
  } catch {
    const issues = [{ path: '', message: 'Could not read this spec.' }];
    return ok({ valid: false, issues }, issueLines(issues));
  }
}
