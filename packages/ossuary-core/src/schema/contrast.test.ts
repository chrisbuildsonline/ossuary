import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
  });

  it('puts the three DESIGN.md canvases in the soft-neutral range', () => {
    for (const canvas of ['#eef0f4', '#f2efea', '#edeff6']) {
      expect(relativeLuminance(canvas)).toBeGreaterThanOrEqual(0.84);
      expect(relativeLuminance(canvas)).toBeLessThanOrEqual(0.89);
    }
  });

  it('accepts upper case hex', () => {
    expect(relativeLuminance('#EEF0F4')).toBe(relativeLuminance('#eef0f4'));
  });
});

describe('contrastRatio', () => {
  it.each([
    ['#3657c9', '#ffffff', 6.25],
    ['#3657c9', '#eef0f4', 5.47],
    ['#b8460e', '#ffffff', 5.36],
    ['#b8460e', '#f2efea', 4.67],
    ['#5a4bd1', '#ffffff', 6.25],
    ['#5a4bd1', '#edeff6', 5.44],
    ['#3657c9', '#e8edfa', 5.33],
    ['#9a3a0b', '#fbe9dc', 5.96],
    ['#5a4bd1', '#ebe9fb', 5.23],
    ['#17663a', '#e2f3e8', 6.08],
    ['#3c414b', '#e4e6ea', 8.2],
    ['#15171c', '#ffffff', 17.93],
  ])('%s on %s is %s:1', (fg, bg, ratio) => {
    // DESIGN.md rounds #3657c9 on white (6.243) up to 6.25, so compare to one decimal
    expect(contrastRatio(fg, bg)).toBeCloseTo(ratio, 1);
  });

  it('is symmetric and 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#000000')).toBe(21);
  });

  it('rejects a light grey accent', () => {
    expect(contrastRatio('#999999', '#ffffff')).toBeLessThan(4.5);
  });
});
