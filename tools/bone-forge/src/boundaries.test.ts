// bone-forge stays a thin, offline layer over the core.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkBoundary } from '../../../scripts/check-boundary';

const src = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../../..', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

const sources = walk(src)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !/test-(client|tmp)\.ts$/.test(f))
  .map((f) => ({ path: relative(src, f), text: readFileSync(f, 'utf8') }));

describe('bone-forge boundaries', () => {
  it('leaves the core free of any import from tools/*', () => {
    expect(checkBoundary(join(repo, 'packages/ossuary-core'))).toEqual([]);
  });

  it('has only the MCP SDK and zod as third-party runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(src, '../package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['@modelcontextprotocol/sdk', '@ossuary/core', 'zod']);
    expect(pkg.dependencies['@ossuary/core']).toBe('workspace:*');
  });

  it('makes no network call', () => {
    for (const { path, text } of sources) {
      // The SVG namespace of the generated icon is an identifier, not an address that is fetched.
      const code = text.replaceAll('http://www.w3.org/2000/svg', '');
      expect(/\bfetch\(|XMLHttpRequest|WebSocket|node:(https?|net|dgram|tls)|https?:\/\//.test(code), path).toBe(false);
    }
  });

  it('touches the file system only to read its template, check apps/ and write the new app', () => {
    const fsUsers = sources.filter(({ text }) => /from 'node:fs'/.test(text)).map((s) => s.path).sort();
    expect(fsUsers).toEqual(['scaffold/files.ts', 'scaffold/safe-path.ts', 'scaffold/write.ts', 'tools/scaffold-app.ts']);
    // The only file read: the template folder next to the package.
    const reads = sources.filter(({ text }) => /readFileSync|readdirSync|createReadStream/.test(text)).map((s) => s.path);
    expect(reads).toEqual(['scaffold/files.ts']);
  });

  it('reads no clock and no random source', () => {
    for (const { path, text } of sources) {
      expect(/new Date\(|Date\.now|Math\.random|randomUUID|getRandomValues|process\.env|process\.argv/.test(text), path).toBe(false);
    }
  });

  it('copies no schema or engine logic: specs go through parseBoneSpec, countdowns through evaluate', () => {
    for (const { path, text } of sources) {
      expect(/toDayNumber|fromDayNumber|contrastRatio|selectStage|addDuration|safeParse/.test(text), path).toBe(false);
    }
    expect(sources.find((s) => s.path === 'input.ts')?.text).toContain('parseBoneSpec');
    expect(sources.find((s) => s.path === 'tools/preview-countdown.ts')?.text).toContain('evaluate(');
  });
});
