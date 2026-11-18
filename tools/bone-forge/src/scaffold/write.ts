// Writes a new app folder: `mkdir` for the folder (fails if it exists), then each file with the `wx` flag.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Result } from '@ossuary/core/schema';
import type { AppFile } from './files';

export type WriteFile = (path: string, content: string, options: { flag: 'wx' }) => void;

export function writeAll(dir: string, files: readonly AppFile[], writeFile: WriteFile = writeFileSync): Result<null, string> {
  try {
    mkdirSync(dir);
    const folders = new Set([dir]);
    for (const file of files) {
      const path = join(dir, file.path);
      const parent = dirname(path);
      if (!folders.has(parent)) {
        mkdirSync(parent);
        folders.add(parent);
      }
      writeFile(path, file.content, { flag: 'wx' });
    }
    return { ok: true, value: null };
  } catch (e) {
    return { ok: false, error: `Could not write the app: ${e instanceof Error ? e.message : String(e)}` };
  }
}
