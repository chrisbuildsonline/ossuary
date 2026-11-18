// Test helper: temporary folders that are removed after each test file.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

const made: string[] = [];
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A new empty folder. */
export function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bone-forge-'));
  made.push(dir);
  return dir;
}

/** A new root with an empty apps/ folder. */
export function tmpRoot(): string {
  const root = tmpDir();
  mkdirSync(join(root, 'apps'));
  return root;
}
