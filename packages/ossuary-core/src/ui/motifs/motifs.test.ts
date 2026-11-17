import { describe, expect, it } from 'vitest';
import { tones } from '../../schema/stages';
import { glyph, glyphNames, toneGlyph } from '../glyphs';
import { candle } from './candle';
import { ghost } from './ghost';
import { hourglass } from './hourglass';
import { motifSizes, motifSvg, quantise } from './index';

const fractions = [0, 0.5, 1] as const;
const attr = (svg: string, name: string, cls: string) =>
  new RegExp(`<[^>]*class="${cls}"[^>]*\\s${name}="([^"]+)"`).exec(svg)?.[1] ?? new RegExp(`<[^>]*\\s${name}="([^"]+)"[^>]*class="${cls}"`).exec(svg)?.[1];
const count = (svg: string, cls: string) => (svg.match(new RegExp(`class="${cls}"`, 'g')) ?? []).length;

describe('quantise', () => {
  it('snaps to 1/20 steps and clamps to 0..1', () => {
    expect(quantise(0.512)).toBe(0.5);
    expect(quantise(0.526)).toBe(0.55);
    expect(quantise(-1)).toBe(0);
    expect(quantise(4)).toBe(1);
    expect(quantise(Number.NaN)).toBe(0);
  });
});

describe('every motif', () => {
  it.each(['candle', 'ghost', 'hourglass'] as const)('%s is aria-hidden, sized and built from numbers only', (motif) => {
    for (const tone of tones) {
      for (const f of fractions) {
        const svg = motifSvg(motif, f, tone, 'm');
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('aria-hidden="true"');
        expect(svg).toContain('focusable="false"');
        expect(svg).toContain(`width="${motifSizes.m[0]}" height="${motifSizes.m[1]}"`);
        expect(svg).toContain(`data-tone="${tone}"`);
        expect(svg).toContain(`data-fraction="${f}"`);
        expect(svg).not.toMatch(/#[0-9a-f]{3,6}\b|<script|\son\w+=/i);
      }
    }
  });

  it('gives the same output for the same input', () => {
    expect(motifSvg('ghost', 0.37, 'soon', 'l')).toBe(motifSvg('ghost', 0.37, 'soon', 'l'));
    expect(motifSvg('candle', 0.51, 'fresh', 's')).toBe(motifSvg('candle', 0.5, 'fresh', 's'));
  });
});

describe('candle', () => {
  const flameScale = { fresh: '1', steady: '1', soon: '0.8', urgent: '0.6' } as const;
  for (const tone of tones) {
    for (const f of fractions) {
      it(`${tone} at ${f}`, () => {
        const svg = candle(f, tone, 'm');
        const height = Number(attr(svg, 'height', 'wax'));
        if (tone === 'dead') {
          expect(height).toBe(8);
          expect(count(svg, 'flame')).toBe(0);
          expect(count(svg, 'smoke')).toBe(3);
        } else {
          expect(height).toBe(8 + 64 * f);
          expect(svg).toMatch(new RegExp(`class="flame[^"]*"[^>]*scale\\(${flameScale[tone]}\\)`));
          expect(count(svg, 'smoke')).toBe(0);
        }
        expect(count(svg, 'drip')).toBe(f < 0.33 ? 2 : f < 0.66 ? 1 : 0);
        expect(count(svg, 'pool')).toBe(tone === 'urgent' ? 1 : 0);
      });
    }
  }
});

describe('ghost', () => {
  const eyes = { fresh: 'round', steady: 'round', soon: 'half', urgent: 'worried', dead: 'none' } as const;
  for (const tone of tones) {
    for (const f of fractions) {
      it(`${tone} at ${f}`, () => {
        const svg = ghost(f, tone, 'm');
        expect(svg).toContain(`data-eyes="${eyes[tone]}"`);
        if (tone === 'dead') {
          expect(attr(svg, 'fill-opacity', 'body')).toBe('0');
          expect(attr(svg, 'stroke-opacity', 'body')).toBe('0.35');
          expect(attr(svg, 'stroke-dasharray', 'body')).toBe('2 4');
        } else {
          expect(Number(attr(svg, 'fill-opacity', 'body'))).toBeCloseTo(0.15 + 0.85 * f, 5);
          expect(Number(attr(svg, 'stroke-opacity', 'body'))).toBeCloseTo(0.35 + 0.65 * f, 5);
          expect(attr(svg, 'stroke-dasharray', 'body')).toBe(f < 0.25 ? '2 4' : undefined);
        }
      });
    }
  }
});

describe('hourglass', () => {
  for (const tone of tones) {
    for (const f of fractions) {
      it(`${tone} at ${f}`, () => {
        const svg = hourglass(f, tone, 'm');
        expect(Number(/data-top="([^"]+)"/.exec(svg)?.[1])).toBeCloseTo(f, 5);
        expect(Number(/data-bottom="([^"]+)"/.exec(svg)?.[1])).toBeCloseTo(1 - f, 5);
        expect(svg.includes('rotate(90')).toBe(tone === 'dead');
        expect(count(svg, 'sand top')).toBe(f > 0 ? 1 : 0);
        expect(count(svg, 'sand bottom')).toBe(f < 1 ? 1 : 0);
      });
    }
  }
});

describe('glyphs', () => {
  it('has a distinct, hidden 16px glyph for each tone', () => {
    const all = tones.map(toneGlyph);
    expect(new Set(all).size).toBe(tones.length);
    for (const svg of all) {
      expect(svg).toContain('viewBox="0 0 16 16"');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
      expect(svg).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
  });

  it('has the alert, import, calendar and bone glyphs', () => {
    for (const name of ['alert', 'import', 'calendar', 'bone'] as const) {
      expect(glyphNames).toContain(name);
      expect(glyph(name)).toContain('aria-hidden="true"');
    }
    expect(glyph('bone')).toContain('width="20"');
  });
});
