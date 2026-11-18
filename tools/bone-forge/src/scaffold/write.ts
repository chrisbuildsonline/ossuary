// Writes a new app folder: `mkdir` for the folder (fails if it exists), then each file with the `wx` flag.
// On any failure it removes only what this call created, files first, then folders, deepest first.
import { mkdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Result } from '@ossuary/core/schema';
import type { AppFile } from './files';

export type WriteFile = (path: string, content: string, options: { flag: 'wx' }) => void;

const quietly = (undo: () => void) => {
  try {
    undo();
  } catch {
    // Best effort: a path that cannot be removed stays, and the error below still reports the failure.
  }
};

export function writeAll(dir: string, files: readonly AppFile[], writeFile: WriteFile = writeFileSync): Result<null, string> {
  const folders: string[] = [];
  const written: string[] = [];
  try {
    mkdirSync(dir);
    folders.push(dir);
    for (const file of files) {
      const path = join(dir, file.path);
      const parent = dirname(path);
      if (!folders.includes(parent)) {
        mkdirSync(parent);
        folders.push(parent);
      }
      writeFile(path, file.content, { flag: 'wx' });
      written.push(path);
    }
    return { ok: true, value: null };
  } catch (e) {
    for (const path of written.reverse()) quietly(() => unlinkSync(path));
    for (const folder of folders.reverse()) quietly(() => rmdirSync(folder));
    return { ok: false, error: `Could not write the app: ${e instanceof Error ? e.message : String(e)}` };
  }
}
