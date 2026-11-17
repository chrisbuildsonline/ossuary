// Build step only: bundle src/sw.ts as sw.js and write the precache list of this build into it.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Plugin, defineConfig } from 'vite';
import { precacheList } from './src/pwa/precache';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

function serviceWorker(): Plugin {
  return {
    name: 'pantry-reaper-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const sw = bundle['sw.js'];
      if (sw?.type !== 'chunk') return this.error('sw.js was not built');
      const files = Object.values(bundle).map((f) => ({ name: f.fileName, content: f.type === 'chunk' ? f.code : f.source }));
      for (const name of readdirSync(here('./public'))) files.push({ name, content: readFileSync(here(`./public/${name}`)) });
      sw.code = sw.code.replaceAll('__PRECACHE__', `(${JSON.stringify(precacheList(files))})`);
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
