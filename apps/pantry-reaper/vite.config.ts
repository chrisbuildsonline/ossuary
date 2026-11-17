// Build step only: bundle src/sw.ts as sw.js and write the precache list of the written build into it.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Plugin, defineConfig } from 'vite';
import { precacheList } from './src/pwa/precache.ts';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

function serviceWorker(): Plugin {
  return {
    name: 'pantry-reaper-sw',
    apply: 'build',
    enforce: 'post',
    // After the files are on disk, so the list and the hash are those of the real dist.
    writeBundle({ dir }) {
      if (!dir) return this.error('no output dir');
      const swPath = join(dir, 'sw.js');
      const names = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => statSync(join(dir, f)).isFile());
      const files = names.map((f) => ({ name: f.split(sep).join('/'), content: readFileSync(join(dir, f)) }));
      const sw = readFileSync(swPath, 'utf8');
      if (!sw.includes('__PRECACHE__')) return this.error('sw.js was not built');
      writeFileSync(swPath, sw.replaceAll('__PRECACHE__', `(${JSON.stringify(precacheList(files))})`));
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
  build: {
    rolldownOptions: {
      input: { index: here('./index.html'), sw: here('./src/sw.ts') },
      // The worker is a classic script, so entries keep no exports.
      preserveEntrySignatures: false,
      output: { entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js') },
    },
  },
});
