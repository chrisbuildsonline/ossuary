import { describe, expect, it } from 'vitest';
import { parseWith } from './issues';
import { themeSchema } from './theme';

const issuesOf = (input: unknown) => {
  const r = parseWith(themeSchema, input);
  return r.ok ? [] : r.error;
};

const core = { accent: '#3657c9', accentInk: '#3657c9', accentTint: '#e8edfa', canvas: '#eef0f4', display: 'inter', motif: 'hourglass', emptyArt: 'hourglass-side', wordmark: 'Widget Tracker' };
const warm = { accent: '#b8460e', accentInk: '#9a3a0b', accentTint: '#fbe9dc', canvas: '#f2efea', display: 'fraunces', motif: 'candle', emptyArt: 'candle-jar-moon', wordmark: 'Warm' };
const cool = { accent: '#5a4bd1', accentInk: '#5a4bd1', accentTint: '#ebe9fb', canvas: '#edeff6', display: 'space-grotesk', motif: 'ghost', emptyArt: 'ghost-parcel', wordmark: 'Cool' };

describe('themeSchema', () => {
  it('accepts the three DESIGN.md themes with all eight keys', () => {
    for (const theme of [core, warm, cool]) expect(parseWith(themeSchema, theme)).toEqual({ ok: true, value: theme });
  });

  it('accepts an empty theme and upper case hex', () => {
    expect(issuesOf({})).toEqual([]);
    expect(issuesOf({ accent: '#3657C9' })).toEqual([]);
  });

  it.each(['textColor', 'radius', 'spacing', 'shadow', 'typeScale', 'motion', 'focusRing', 'ink'])('rejects the key %s', (key) => {
    expect(issuesOf({ ...core, [key]: 'x' })).toEqual([{ path: key, message: `Unknown key "${key}".` }]);
  });

  it('needs colours in #rrggbb form', () => {
    for (const bad of ['#36c', '3657c9', '#3657c9ff', 'blue', '#gg0000']) {
      expect(issuesOf({ accent: bad })).toEqual([{ path: 'accent', message: 'Use a colour in the form #rrggbb.' }]);
    }
  });

  it('limits display, motif and emptyArt to their enums', () => {
    expect(issuesOf({ display: 'comic-sans' })).toEqual([{ path: 'display', message: 'Expected one of: inter, fraunces, space-grotesk.' }]);
    expect(issuesOf({ motif: 'skull' })).toEqual([{ path: 'motif', message: 'Expected one of: hourglass, candle, ghost.' }]);
    expect(issuesOf({ emptyArt: 'x' })).toEqual([
      { path: 'emptyArt', message: 'Expected one of: hourglass-side, candle-jar-moon, ghost-parcel.' },
    ]);
  });

  it('rejects an accent below 4.5:1 on white with the measured ratio', () => {
    expect(issuesOf({ accent: '#999999' })).toEqual([
      { path: 'accent', message: 'Accent contrast on white is 2.84:1; it must be at least 4.5:1.' },
      { path: 'accent', message: 'Accent contrast on the canvas (#eef0f4) is 2.49:1; it must be at least 4.5:1.' },
    ]);
  });

  it('does not round a failing ratio up to 4.5', () => {
    expect(issuesOf({ accent: '#777777', canvas: '#ffffff' })).toContainEqual({
      path: 'accent',
      message: 'Accent contrast on white is 4.47:1; it must be at least 4.5:1.',
    });
  });

  it('checks the accent against the default canvas when none is set', () => {
    expect(issuesOf({ accent: '#767676' })).toEqual([
      { path: 'accent', message: 'Accent contrast on the canvas (#eef0f4) is 3.98:1; it must be at least 4.5:1.' },
    ]);
  });

  it('checks the accent against the theme canvas', () => {
    expect(issuesOf({ accent: '#b8460e', canvas: '#f2efea' })).toEqual([]);
    expect(issuesOf({ accent: '#c0501a', canvas: '#f2efea' })).toEqual([
      { path: 'accent', message: 'Accent contrast on the canvas (#f2efea) is 4.15:1; it must be at least 4.5:1.' },
    ]);
  });

  it('keeps the canvas luminance within 0.84 to 0.89', () => {
    expect(issuesOf({ canvas: '#ededed' })).toEqual([]);
    expect(issuesOf({ canvas: '#f2f2f2' })).toEqual([]);
    expect(issuesOf({ canvas: '#ececec' })).toEqual([
      { path: 'canvas', message: 'Canvas luminance is 0.8388; it must be between 0.84 and 0.89.' },
    ]);
    expect(issuesOf({ canvas: '#f3f3f3' })).toEqual([
      { path: 'canvas', message: 'Canvas luminance is 0.8963; it must be between 0.84 and 0.89.' },
    ]);
  });

  it('needs accentInk on accentTint at 4.5:1', () => {
    expect(issuesOf({ accentInk: '#8a8fd8', accentTint: '#e8edfa' })).toEqual([
      { path: 'accentInk', message: 'Accent ink contrast on the accent tint is 2.56:1; it must be at least 4.5:1.' },
    ]);
  });

  it('checks a lone accentTint against the default ink', () => {
    expect(issuesOf({ accentTint: '#6070b0' })).toEqual([
      { path: 'accentTint', message: 'Accent ink contrast on the accent tint is 1.32:1; it must be at least 4.5:1.' },
    ]);
  });

  it('needs a wordmark of 1 to 80 characters', () => {
    expect(issuesOf({ wordmark: '' })).toEqual([{ path: 'wordmark', message: 'Must not be empty.' }]);
  });
});
