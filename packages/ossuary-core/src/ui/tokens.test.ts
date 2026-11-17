import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../schema/contrast';
import { tones } from '../schema/stages';

const path = new URL('./tokens.css', import.meta.url);
const css = existsSync(path) ? readFileSync(path, 'utf8') : '';

/** The value of a custom property in the first `:root` block that declares it. */
const token = (name: string): string | undefined => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();

describe('tokens.css', () => {
  it('declares the DESIGN.md section 2 tokens', () => {
    const names = [
      '--canvas', '--surface', '--surface-sunken', '--track', '--line', '--line-strong', '--text', '--text-2', '--text-3',
      '--ink', '--ink-hover', '--on-ink', '--scrim', '--accent', '--accent-ink', '--accent-tint',
      '--r-xs', '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-pill', '--shadow-1', '--shadow-2', '--shadow-3',
      '--s-1', '--s-2', '--s-3', '--s-4', '--s-5', '--s-6', '--s-8', '--s-10', '--s-14', '--s-18',
      '--font-ui', '--font-display', '--font-num', '--t-display', '--t-title', '--t-num-xl', '--t-num-l', '--t-num-m',
      '--t-heading', '--t-body', '--t-label', '--t-caption', '--t-eyebrow',
      '--dur-1', '--dur-2', '--dur-3', '--dur-4', '--ease-out', '--ease-in-out', '--ease-settle', '--focus',
    ];
    expect(names.filter((n) => token(n) === undefined)).toEqual([]);
    expect(token('--canvas')).toBe('#eef0f4');
    expect(token('--accent')).toBe('#3657c9');
    expect(token('--ink')).toBe('#15171c');
  });

  it('gives every tone slot a background and text colour that meet 4.5:1', () => {
    for (const tone of tones) {
      const bg = token(`--tone-${tone}-bg`);
      const fg = token(`--tone-${tone}-fg`);
      expect(bg, tone).toMatch(/^#[0-9a-f]{6}$/);
      expect(fg, tone).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(fg ?? '', bg ?? ''), tone).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the text tokens at 4.5:1 on white and on the canvas', () => {
    for (const name of ['--text', '--text-2', '--text-3', '--accent']) {
      for (const bg of ['#ffffff', token('--canvas') ?? '']) {
        expect(contrastRatio(token(name) ?? '', bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrastRatio(token('--accent-ink') ?? '', token('--accent-tint') ?? '')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token('--line-strong') ?? '', '#ffffff')).toBeGreaterThanOrEqual(3);
  });

  it('zeroes every duration and stops animation under reduced motion', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? '';
    for (const n of [1, 2, 3, 4]) expect(block).toMatch(new RegExp(`--dur-${n}:\\s*0ms`));
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
  });

  it('derives the focus ring and number face where a theme is applied', () => {
    expect(css).toMatch(/:root,\s*\[data-motif\]\s*\{[^}]*--focus:\s*3px solid var\(--accent\)/);
    expect(css).toMatch(/:root,\s*\[data-motif\]\s*\{[^}]*--font-num:\s*var\(--font-display\)/);
  });
});
