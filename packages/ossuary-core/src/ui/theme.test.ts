// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { displayFamilies, loadDisplayFont } from './fonts';
import { applyTheme, themeProperties } from './theme';

const props = (el: HTMLElement) => Array.from({ length: el.style.length }, (_, i) => el.style.item(i)).sort();

describe('applyTheme', () => {
  it('writes only the five allowed custom properties and the motif attributes', () => {
    const el = document.createElement('div');
    applyTheme(el, {
      accent: '#b8460e',
      accentInk: '#9a3a0b',
      accentTint: '#fbe9dc',
      canvas: '#f2efea',
      display: 'fraunces',
      motif: 'candle',
      emptyArt: 'candle-jar-moon',
      wordmark: 'Widget Tracker',
    });
    expect(props(el)).toEqual(['--accent', '--accent-ink', '--accent-tint', '--canvas', '--font-display']);
    expect([...themeProperties].sort()).toEqual(props(el));
    expect(el.style.getPropertyValue('--accent')).toBe('#b8460e');
    expect(el.style.getPropertyValue('--accent-ink')).toBe('#9a3a0b');
    expect(el.style.getPropertyValue('--font-display')).toContain('Fraunces Variable');
    expect(el.dataset.motif).toBe('candle');
    expect(el.dataset.emptyArt).toBe('candle-jar-moon');
  });

  it('falls back to core defaults for a missing theme and clears earlier values', () => {
    const el = document.createElement('div');
    applyTheme(el, { accent: '#5a4bd1', display: 'space-grotesk' });
    expect(el.style.getPropertyValue('--accent-ink')).toBe('#5a4bd1');
    applyTheme(el, undefined);
    expect(props(el)).toEqual([]);
    expect(el.dataset.motif).toBe('hourglass');
    expect(el.dataset.emptyArt).toBe('hourglass-side');
  });

  it('never writes text, radius, spacing, shadow or motion tokens', () => {
    const el = document.createElement('div');
    applyTheme(el, { accent: '#3657c9', text: '#ff0000', radius: '0px' } as never);
    expect(props(el)).toEqual(['--accent', '--accent-ink']);
  });
});

describe('loadDisplayFont', () => {
  it('names a self-hosted family for each display face', () => {
    expect(displayFamilies.inter).toContain('Inter Variable');
    expect(displayFamilies.fraunces).toContain('Fraunces Variable');
    expect(displayFamilies['space-grotesk']).toContain('Space Grotesk Variable');
  });

  it('loads each face once through its loader', async () => {
    const fraunces = vi.fn(async () => ({}));
    const loaders = { inter: vi.fn(async () => ({})), fraunces, 'space-grotesk': vi.fn(async () => ({})) };
    await loadDisplayFont('fraunces', loaders);
    await loadDisplayFont('fraunces', loaders);
    expect(fraunces).toHaveBeenCalledTimes(1);
    expect(loaders.inter).toHaveBeenCalledTimes(1);
  });

  it('resolves even when a loader fails, so text still shows in the fallback face', async () => {
    const loaders = { inter: async () => ({}), fraunces: async () => ({}), 'space-grotesk': () => Promise.reject(new Error('offline')) };
    await expect(loadDisplayFont('space-grotesk', loaders)).resolves.toBe(false);
  });
});
