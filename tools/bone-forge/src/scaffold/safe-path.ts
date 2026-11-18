// apps/<name> of the root, and nothing else: a second guard behind the app name rule.
import { lstatSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type { Result } from '@ossuary/core/schema';

export function resolveAppDir(root: string, name: string): Result<string, string> {
  const apps = resolve(root, 'apps');
  const target = resolve(apps, name);
  // The name must be the folder itself: no separator, no absolute path, no `.` or `..`.
  if (dirname(target) !== apps || basename(target) !== name) {
    return { ok: false, error: 'The app folder must be directly inside apps/.' };
  }
  let link: boolean;
  try {
    link = lstatSync(apps).isSymbolicLink();
  } catch {
    return { ok: false, error: 'There is no apps/ folder in the repo.' };
  }
  if (link || realpathSync(apps) !== join(realpathSync(root), 'apps')) {
    return { ok: false, error: 'apps/ must be a real folder in the repo, not a link.' };
  }
  return { ok: true, value: target };
}
