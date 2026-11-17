// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OssList } from './oss-list';

const tokens = readFileSync(join(import.meta.dirname, '../tokens.css'), 'utf8');

/** The column gap the list's own CSS gives `selector`, with later rules winning, as in the cascade. */
function columnGap(css: string, selector: string): string | undefined {
  let gap: string | undefined;
  for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors?.split(',').some((s) => s.trim() === selector)) continue;
    for (const decl of body?.split(';') ?? []) {
      const [prop, ...rest] = decl.split(':');
      const value = rest.join(':').trim();
      if (prop?.trim() === 'gap') gap = value.split(/\s+(?![^(]*\))/)[1] ?? value;
      if (prop?.trim() === 'column-gap') gap = value;
    }
  }
  return gap;
}

/** The pixel value of a `var(--s-N)` spacing token, or 0 for anything else. */
function px(value: string | undefined): number {
  const name = /^var\((--s-\d+)\)$/.exec(value ?? '')?.[1];
  const found = name ? new RegExp(`${name}:\\s*(\\d+)px`).exec(tokens) : null;
  return found ? Number(found[1]) : 0;
}

describe('oss-list card layout', () => {
  it('keeps a spacing-token gap between cards in one stage group, so two cards never touch', () => {
    for (const selector of ['.cards > section', '.cards > section > .grid']) {
      const gap = columnGap(OssList.styles, selector);
      expect(gap, selector).toMatch(/^var\(--s-\d+\)$/);
      expect(px(gap), selector).toBeGreaterThan(0);
    }
  });

  it('uses the same gap inside a group as between groups', () => {
    expect(columnGap(OssList.styles, '.cards > section > .grid')).toBe(columnGap(OssList.styles, '.groups.cards'));
  });
});
