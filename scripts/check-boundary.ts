// Checks the core boundary rules from .kiro/steering and the skeleton-contract design:
// core never depends on an app or tool, the pure layers (engine, schema, ics) never read the clock
// or touch the DOM, and core holds no domain words.
// Usage: bun scripts/check-boundary.ts [coreDir]. Exits 1 and lists every violation.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { domainWords } from './domain-words.ts';

const pure = ['engine', 'schema', 'ics'].map((layer) => `src/${layer}/`);
const domGlobals = /\b(document|window|navigator|customElements|HTMLElement|localStorage|indexedDB)\b/;
const specifier = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

const appOrTool = (spec: string) => /(^|\/)(apps|tools)\//.test(spec) || (spec.startsWith('@ossuary/') && !spec.startsWith('@ossuary/core'));
const domModule = (spec: string) => /(^|\/)(ui|store|pwa)(\/|$)/.test(spec) || spec === 'idb' || spec.endsWith('-dom');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules') return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Source without comments, so a comment may say "no Date object". */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export function checkBoundary(coreDir: string): string[] {
  const problems: string[] = [];
  for (const file of walk(coreDir)) {
    const path = relative(coreDir, file).split(sep).join('/');
    const text = readFileSync(file, 'utf8');
    const lower = text.toLowerCase();
    for (const word of domainWords) if (lower.includes(word)) problems.push(`${path}: mentions "${word}" (core has no domain words)`);
    if (!path.endsWith('.ts')) continue;

    const imports = [...text.matchAll(specifier)].map((m) => m[1] ?? '');
    for (const spec of imports.filter(appOrTool)) problems.push(`${path}: imports '${spec}' (core must not depend on an app or tool)`);

    if (!pure.some((dir) => path.startsWith(dir)) || path.endsWith('.test.ts')) continue;
    const body = code(text);
    if (/\bDate\b/.test(body)) problems.push(`${path}: uses Date (time must come in as an argument)`);
    for (const spec of imports.filter(domModule)) problems.push(`${path}: imports '${spec}' (engine, schema and ics stay DOM-free)`);
    const dom = domGlobals.exec(body);
    if (dom) problems.push(`${path}: uses ${dom[1]} (engine, schema and ics stay DOM-free)`);
  }
  return problems.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const coreDir = process.argv[2] ?? fileURLToPath(new URL('../packages/ossuary-core', import.meta.url));
  const problems = checkBoundary(coreDir);
  if (problems.length > 0) {
    console.error(`Core boundary broken (${problems.length}):\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Core boundary holds.');
}
