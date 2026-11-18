// Source scans for reduced motion (requirements 1.4 and 1.5), focus rings (3.2) and the axe runs (5.3).
// They read every UI source in core, the apps, the launcher, the gallery and the app template.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const apps = readdirSync(join(root, 'apps')).map((name) => join(root, 'apps', name));
const sourceDirs = [join(root, 'packages/ossuary-core/src/ui'), join(root, 'packages/ossuary-core/gallery'), ...apps.map((a) => join(a, 'src')), join(root, 'tools/bone-forge/template/src')];
const sources = sourceDirs
  .flatMap(walk)
  .filter((f) => /\.(ts|css)$/.test(f) && !f.endsWith('.test.ts'))
  .map((file) => ({ path: relative(root, file), text: readFileSync(file, 'utf8') }));
const specDirs = [join(root, 'packages/ossuary-core/e2e'), ...apps.map((a) => join(a, 'e2e')), join(root, 'tools/bone-forge/scripts')];
const specs = specDirs.flatMap(walk).filter((f) => f.endsWith('.ts')).map((file) => ({ path: relative(root, file), text: readFileSync(file, 'utf8') }));

const declaresMotion = (text: string) => /(^|[\s;{])(animation|transition)\s*:/m.test(text);
const ownReduceRule = (text: string) => /prefers-reduced-motion:\s*reduce/.test(text);

describe('reduced motion reaches every animation', () => {
  it('scans core, both apps, the launcher, the gallery and the template', () => {
    expect(sources.length).toBeGreaterThan(40);
    expect(sources.filter((s) => declaresMotion(s.text)).length).toBeGreaterThan(5);
  });

  it('gives every core shadow root the shared sheet: only base.ts attaches one, and it adopts the tokens', () => {
    const core = sources.filter((s) => s.path.startsWith('packages/ossuary-core/src/ui/') && s.text.includes('attachShadow('));
    expect(core.map((s) => s.path)).toEqual(['packages/ossuary-core/src/ui/elements/base.ts']);
    expect(core[0]?.text).toMatch(/adopt\(this\.root/);
    const styles = sources.find((s) => s.path.endsWith('src/ui/styles.ts'))?.text ?? '';
    expect(styles).toMatch(/adoptedStyleSheets = \[sheet\(tokens\)/);
  });

  it('covers every stylesheet that animates: core elements, adopted pages, or its own reduced-motion rule', () => {
    const uncovered = sources
      .filter((s) => declaresMotion(s.text))
      .filter((s) => {
        if (ownReduceRule(s.text)) return false;
        // Core element styles are adopted next to tokens.css by OssElement (checked above).
        if (s.path.startsWith('packages/ossuary-core/src/ui/') && !s.text.includes('attachShadow(')) return false;
        // A page sheet on a document that has the tokens (and their reduced-motion rule) adopted.
        if (!s.text.includes('attachShadow(') && s.text.includes('document.adoptedStyleSheets') && s.text.includes('ensureDocumentTokens')) return false;
        return true;
      })
      .map((s) => s.path);
    expect(uncovered).toEqual([]);
  });

  it('starts no script motion (frames, Element.animate, smooth scroll) without asking for reduced motion first', () => {
    const scripted = sources
      .filter((s) => /requestAnimationFrame|\.animate\(|scroll-behavior:\s*smooth|behavior:\s*['"]smooth['"]/.test(s.text))
      .filter((s) => !/matchMedia\(['"]\(prefers-reduced-motion: reduce\)['"]\)/.test(s.text))
      .map((s) => s.path);
    expect(scripted).toEqual([]);
  });
});

describe('focus rings are never removed', () => {
  it('allows outline: none only on a tabindex="-1" heading or an input whose wrapper rings it', () => {
    const bad: string[] = [];
    for (const s of sources) {
      for (const m of s.text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        if (!/outline:\s*(none|0)\b/.test(m[2] ?? '')) continue;
        const selector = (m[1] ?? '').trim().split('\n').at(-1)?.trim() ?? '';
        const heading = selector === 'h1:focus' && /el\('h1', \{ tabindex: '-1' \}/.test(s.text);
        const wrapped = selector === 'input' && /:has\(input:focus-visible\)\s*\{\s*outline:\s*var\(--focus\)/.test(s.text);
        if (!heading && !wrapped) bad.push(`${s.path}: ${selector}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('axe runs are never weakened', () => {
  it('runs axe only through checkAxe, with no disabled rule, no excluded node and the full tag list', () => {
    const helper = readFileSync(join(root, 'packages/ossuary-core/src/testing/a11y.ts'), 'utf8');
    expect(helper).toMatch(/AXE_TAGS = \['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'\]/);
    const weak = [...specs, { path: 'packages/ossuary-core/src/testing/a11y.ts', text: helper }]
      .filter((s) => /disableRules|\.exclude\(|\.include\(|withRules\(/.test(s.text) || (s.text.includes('AxeBuilder') && !s.path.endsWith('testing/a11y.ts')))
      .map((s) => s.path);
    expect(weak).toEqual([]);
    expect(specs.filter((s) => s.text.includes('checkAxe(')).length).toBeGreaterThanOrEqual(4);
  });
});
