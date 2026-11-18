// Builds the launcher and both apps into one dist/: the launcher at the root, each app in its own folder.
// The relative base keeps every asset, manifest and service worker working from any sub-path.
// Usage: bun scripts/build-dist.ts. The launcher goes first, because it empties dist/.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = join(root, 'node_modules/.bin/vite');
const targets = [
  { app: 'apps/launcher', out: 'dist' },
  { app: 'apps/pantry-reaper', out: 'dist/pantry-reaper' },
  { app: 'apps/warranty-wraith', out: 'dist/warranty-wraith' },
];

// Always a production build: an inherited NODE_ENV=test (vitest) would turn import.meta.env.PROD off and drop the worker.
const env = { ...process.env, NODE_ENV: 'production' };

for (const { app, out } of targets) {
  const run = spawnSync(vite, ['build', app, '--base', './', '--outDir', join(root, out), '--emptyOutDir'], { cwd: root, env, stdio: 'inherit' });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
