import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../schema/contrast';
import { hexToHsl, hslToHex, mixHex } from './color';
import { cryptTheme } from './crypt';

describe('colour helpers', () => {
  it('round-trips hex through HSL', () => {
    for (const hex of ['#b8460e', '#5a4bd1', '#3657c9', '#f2efea', '#000000', '#ffffff']) expect(hslToHex(hexToHsl(hex))).toBe(hex);
  });

  it('mixes two colours in sRGB', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#b8460e', '#241f17', 0)).toBe('#241f17');
    expect(mixHex('#b8460e', '#241f17', 1)).toBe('#b8460e');
  });
});

describe('cryptTheme', () => {
  it('turns the core light theme into a cool stone crypt', () => {
    expect(cryptTheme(undefined)).toEqual({
      canvas: '#0d0f14',
      surface: '#181b23',
      surfaceSunken: '#11141a',
      accent: '#7a90db',
      accentInk: '#7a90db',
      accentTint: '#1f294b',
    });
  });

  it('keeps each theme in its own hue: warm soot and ember, blue night and spectral violet', () => {
    const warm = cryptTheme({ accent: '#b8460e', accentInk: '#9a3a0b', accentTint: '#fbe9dc', canvas: '#f2efea' });
    expect([warm.canvas, warm.accent]).toEqual(['#14120d', '#f07639']);
    const cool = cryptTheme({ accent: '#5a4bd1', canvas: '#edeff6' });
    expect([cool.canvas, cool.accent]).toEqual(['#0b0e16', '#9086e0']);
  });

  it('caps the saturation so a loud canvas still gives stone, not neon', () => {
    const t = cryptTheme({ canvas: '#e0f0e0' });
    expect(hexToHsl(t.canvas).s).toBeLessThanOrEqual(0.341);
  });

  it('lifts any accent until it reads at 4.6:1 on the surface, canvas and tint', () => {
    for (const accent of ['#3657c9', '#b8460e', '#5a4bd1', '#17663a', '#a8261b', '#1d1d1d', '#f59e0b']) {
      const t = cryptTheme({ accent });
      for (const ground of [t.surface, t.canvas, t.accentTint]) expect(contrastRatio(t.accent, ground), `${accent} on ${ground}`).toBeGreaterThanOrEqual(4.6);
    }
  });

  it('is deterministic', () => {
    expect(cryptTheme({ accent: '#123456', canvas: '#f0eeea' })).toEqual(cryptTheme({ accent: '#123456', canvas: '#f0eeea' }));
  });
});
