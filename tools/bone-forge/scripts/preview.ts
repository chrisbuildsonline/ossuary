// Scaffolds a two-lifespan sample app into .backups/forge-preview (gitignored) and serves it with vite on port 5190.
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { twoSpec } from '../src/fixtures';
import { scaffoldApp } from '../src/tools/scaffold-app';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const root = join(repo, '.backups/forge-preview');

// A scaffold expects to sit in the repo, so link the core package, packages/ and the base tsconfig beside its apps folder.
mkdirSync(join(root, 'node_modules/@ossuary'), { recursive: true });
mkdirSync(join(root, 'apps'), { recursive: true });
const link = (target: string, path: string) => existsSync(path) || symlinkSync(target, path);
link(join(repo, 'packages/ossuary-core'), join(root, 'node_modules/@ossuary/core'));
link(join(repo, 'tsconfig.base.json'), join(root, 'tsconfig.base.json'));
link(join(repo, 'packages'), join(root, 'packages'));

// A fresh folder per run: the scaffold never overwrites.
const made = scaffoldApp(root, { spec: twoSpec, name: `sample-${Date.now()}` });
if (!made.ok) throw new Error(made.error);

const server = await createServer({ root: join(root, made.value.dir), server: { port: 5190, strictPort: true } });
await server.listen();
server.printUrls();
