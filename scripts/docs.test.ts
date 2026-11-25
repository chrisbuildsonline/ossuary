// The README and docs/ are finished text: no "[fill in ...]" placeholder is left, and every repo path the Devpost
// write-up names in backticks exists, so each claim in it points at a real file.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const docs = readdirSync(join(root, 'docs'), { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.md'))
  .map((f) => join('docs', f));

describe('docs', () => {
  it('leave no "[fill in" placeholder in README.md or docs/', () => {
    expect(docs).toContain(join('docs', 'DEVPOST.md'));
    const left = ['README.md', ...docs].filter((f) => /\[fill in/i.test(readFileSync(join(root, f), 'utf8')));
    expect(left).toEqual([]);
  });

  it('name only repo paths that exist in the Devpost write-up', () => {
    const text = readFileSync(join(root, 'docs', 'DEVPOST.md'), 'utf8');
    const paths = [...text.matchAll(/`([^`\s]+)`/g)]
      .map((m) => m[1] ?? '')
      .filter((p) => /^(\.kiro|apps|packages|tools|scripts|docs|design)\//.test(p) || /^[\w.-]+\.(md|json|ts)$/.test(p));
    expect(paths.length).toBeGreaterThan(10);
    expect(paths.filter((p) => !existsSync(join(root, p)))).toEqual([]);
  });
});
