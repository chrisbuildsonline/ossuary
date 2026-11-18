// scaffold_app: a new apps/<name> folder from a valid spec. Every check runs before the first write.
import { lstatSync } from 'node:fs';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Result } from '@ossuary/core/schema';
import { z } from 'zod';
import { readSpec } from '../input';
import { issueLines, ok, toolError } from '../result';
import { parseAppName } from '../scaffold/app-name';
import { readTemplates, renderFiles } from '../scaffold/files';
import { resolveAppDir } from '../scaffold/safe-path';
import { type WriteFile, writeAll } from '../scaffold/write';

export const scaffoldAppInput = {
  spec: z.union([z.record(z.string(), z.unknown()), z.string()]).describe('A bone spec, as a JSON object or as JSON text.'),
  name: z.string().optional().describe('Folder name under apps/: a to z, digits and -, starting with a letter. Defaults to the spec id.'),
};
export const scaffoldAppOutput = { dir: z.string(), files: z.array(z.string()) };

export interface ScaffoldOutput {
  dir: string;
  files: string[];
}

const exists = (path: string) => {
  try {
    lstatSync(path);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code !== 'ENOENT';
  }
};

/** The error is the tool error text. `writeFile` is replaceable only so tests can force a failure. */
export function scaffoldApp(root: string, input: { spec: unknown; name?: string }, writeFile?: WriteFile): Result<ScaffoldOutput, string> {
  const spec = readSpec(input.spec);
  if (!spec.ok) return { ok: false, error: issueLines(spec.error) };
  const name = parseAppName(input.name ?? spec.value.id);
  if (!name.ok) return name;
  const target = resolveAppDir(root, name.value);
  if (!target.ok) return target;
  const dir = `apps/${name.value}`;
  if (exists(target.value)) return { ok: false, error: `${dir} already exists. Pick another name.` };

  const files = renderFiles(spec.value, name.value, readTemplates());
  const written = writeAll(target.value, files, writeFile);
  if (!written.ok) return written;
  return { ok: true, value: { dir, files: files.map((f) => `${dir}/${f.path}`) } };
}

export function scaffoldAppTool(root: string, input: { spec: unknown; name?: string }): CallToolResult {
  try {
    const r = scaffoldApp(root, input);
    if (!r.ok) return toolError(r.error);
    const { dir, files } = r.value;
    const name = dir.slice('apps/'.length);
    const text = [
      `Created ${dir} (${files.length} files). Next:`,
      `1. Add { "path": "${dir}" } to "references" in tsconfig.json.`,
      `2. Add "dev:${name}" and "build:${name}" scripts to package.json (vite ${dir}).`,
      '3. Run pnpm install.',
    ].join('\n');
    return ok({ dir, files }, text);
  } catch (e) {
    return toolError(`Could not scaffold the app: ${e instanceof Error ? e.message : String(e)}`);
  }
}
