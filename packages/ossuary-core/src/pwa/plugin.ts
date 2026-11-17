// Build step: bundle the worker as sw.js next to the page, then write the precache list of the written build into it.
// Node modules are imported inside the hooks, so a browser bundle that imports this subpath pulls in none of them.
import type { Plugin } from 'vite';
import { precacheList } from './precache.ts';

export function ossuaryPwa({ prefix }: { prefix: string }): Plugin {
  return {
    name: 'ossuary-pwa',
    apply: 'build',
    enforce: 'post',
    async config(config) {
      const { resolve } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      return {
        build: {
          rolldownOptions: {
            input: { index: resolve(config.root ?? '.', 'index.html'), sw: fileURLToPath(new URL('./sw-entry.ts', import.meta.url)) },
            // The worker is a classic script, so entries keep no exports.
            preserveEntrySignatures: false,
            output: { entryFileNames: (chunk: { name: string }) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js') },
          },
        },
      };
    },
    // After the files are on disk, so the list and the hash are those of the real dist.
    async writeBundle({ dir }) {
      if (!dir) return this.error('no output dir');
      const { readFileSync, readdirSync, statSync, writeFileSync } = await import('node:fs');
      const { join, sep } = await import('node:path');
      const swPath = join(dir, 'sw.js');
      const names = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => statSync(join(dir, f)).isFile());
      const files = names.map((f) => ({ name: f.split(sep).join('/'), content: readFileSync(join(dir, f)) }));
      const sw = readFileSync(swPath, 'utf8');
      if (!sw.includes('__PRECACHE__')) return this.error('sw.js was not built');
      writeFileSync(swPath, sw.replaceAll('__PRECACHE__', `(${JSON.stringify(precacheList(files, { prefix }))})`));
    },
  };
}
