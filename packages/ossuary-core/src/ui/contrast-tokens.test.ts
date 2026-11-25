// Contrast of every status, text and accent pair (requirement 2), read from the token sources, never from copies:
// tokens.css, every apps/*/bone.json theme, every tools/*/template/bone.json theme and the gallery themes.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { galleryThemes } from '../../gallery/themes';
import { contrastRatio } from '../schema/contrast';
import { tones } from '../schema/stages';
import { cryptTheme } from './crypt';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
type Mode = 'crypt' | 'light';
const modes: Mode[] = ['crypt', 'light'];
/** The light block; the crypt values are the defaults on :root, the first block that declares a token. */
const lightCss = /:root\[data-mode="light"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
/** The value of a custom property in a mode: the light block first for light, then the :root defaults. */
const token = (name: string, mode: Mode = 'crypt'): string => {
  const find = (text: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(text)?.[1]?.trim();
  const v = (mode === 'light' ? find(lightCss) : undefined) ?? find(css);
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${name} is missing or not #rrggbb in tokens.css (${mode})`);
  return v;
};

interface ThemeColours {
  accent?: string;
  accentInk?: string;
  accentTint?: string;
  canvas?: string;
}

const root = fileURLToPath(new URL('../../../../', import.meta.url));
/** Every bone.json theme under `dir/<name>/<rest>`, named by its folder. */
function specThemes(dir: string, rest: string): [string, ThemeColours][] {
  return readdirSync(root + dir)
    .sort()
    .filter((name) => existsSync(`${root}${dir}/${name}/${rest}`))
    .map((name) => [name, (JSON.parse(readFileSync(`${root}${dir}/${name}/${rest}`, 'utf8')) as { theme?: ThemeColours }).theme ?? {}]);
}

const themes: [string, ThemeColours][] = [
  ['core', {}],
  ...specThemes('apps', 'bone.json'),
  ...specThemes('tools', 'template/bone.json'),
  ...Object.entries(galleryThemes).map(([name, t]): [string, ThemeColours] => [`gallery ${name}`, t]),
];

/** A theme's colours in a mode with the core defaults filled in, as applyTheme and tokens.css leave them. */
const resolved = (t: ThemeColours, mode: Mode) => {
  if (mode === 'crypt') return cryptTheme(t);
  return {
    accent: t.accent ?? token('--accent', 'light'),
    accentInk: t.accentInk ?? t.accent ?? token('--accent-ink', 'light'),
    accentTint: t.accentTint ?? token('--accent-tint', 'light'),
    canvas: t.canvas ?? token('--canvas', 'light'),
    surface: token('--surface', 'light'),
    surfaceSunken: token('--surface-sunken', 'light'),
  };
};

type Pair = [label: string, fg: string, bg: string, min: number];

/** Each pair below its minimum, as "label fg on bg: ratio < min". */
const failing = (pairs: Pair[]) =>
  pairs
    .map(([label, fg, bg, min]) => ({ label, fg, bg, min, ratio: contrastRatio(fg, bg) }))
    .filter((p) => p.ratio < p.min)
    .map((p) => `${p.label} ${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)} < ${p.min}`);

describe('contrast of the token sources', () => {
  it('reads three app themes and three gallery themes', () => {
    expect(themes.length).toBeGreaterThanOrEqual(6);
    expect(themes.filter(([name]) => name.startsWith('gallery')).map(([name]) => name)).toEqual(['gallery core', 'gallery warm', 'gallery cool']);
  });

  it.each(modes)('keeps every tone pair at 4.5:1 for its word, 3:1 for its glyph, and its word at 4.5:1 on a surface (%s)', (mode) => {
    const surfaces = mode === 'crypt' ? themes.map(([, t]) => cryptTheme(t).surface) : [token('--surface', mode)];
    const pairs = tones.flatMap((t): Pair[] => {
      const fg = token(`--tone-${t}-fg`, mode);
      const bg = token(`--tone-${t}-bg`, mode);
      return [
        [`--tone-${t}-fg on --tone-${t}-bg (text)`, fg, bg, 4.5],
        [`--tone-${t}-fg on --tone-${t}-bg (glyph)`, fg, bg, 3],
        ...surfaces.map((surface): Pair => [`--tone-${t}-fg on --surface ${surface}`, fg, surface, 4.5]),
      ];
    });
    expect(failing(pairs)).toEqual([]);
  });

  it.each(modes)('keeps the primary pill and toast label at 4.5:1 on ink and ink hover (%s)', (mode) => {
    expect(
      failing([
        ['--on-ink on --ink', token('--on-ink', mode), token('--ink', mode), 4.5],
        ['--on-ink on --ink-hover', token('--on-ink', mode), token('--ink-hover', mode), 4.5],
      ]),
    ).toEqual([]);
  });

  it.each(modes)('keeps input outlines at 3:1 on the surface and the sunken surface in every theme (%s)', (mode) => {
    const pairs = themes.flatMap(([name, theme]): Pair[] => {
      const t = resolved(theme, mode);
      return [
        [`${name} --line-strong on --surface`, token('--line-strong', mode), t.surface, 3],
        [`${name} --line-strong on --surface-sunken`, token('--line-strong', mode), t.surfaceSunken, 3],
      ];
    });
    expect(failing(pairs)).toEqual([]);
  });

  it.each(modes)('keeps text, accent text, errors and the focus ring readable in every theme (%s)', (mode) => {
    const pairs = themes.flatMap(([name, theme]): Pair[] => {
      const t = resolved(theme, mode);
      const grounds: [string, string][] = [
        ['--surface', t.surface],
        ['--surface-sunken', t.surfaceSunken],
        ['canvas', t.canvas],
      ];
      return [
        ...['--text', '--text-2', '--text-3', '--error'].flatMap((fg) => grounds.map(([bg, hex]): Pair => [`${name} ${fg} on ${bg}`, token(fg, mode), hex, 4.5])),
        [`${name} --accent on --surface (link)`, t.accent, t.surface, 4.5],
        [`${name} --accent on canvas (link)`, t.accent, t.canvas, 4.5],
        [`${name} --accent-ink on --accent-tint`, t.accentInk, t.accentTint, 4.5],
        [`${name} --accent-ink on --surface`, t.accentInk, t.surface, 4.5],
        [`${name} --accent-ink on canvas`, t.accentInk, t.canvas, 4.5],
        [`${name} focus ring --accent on --surface`, t.accent, t.surface, 3],
        [`${name} focus ring --accent on canvas`, t.accent, t.canvas, 3],
      ];
    });
    expect(failing(pairs)).toEqual([]);
  });
});
