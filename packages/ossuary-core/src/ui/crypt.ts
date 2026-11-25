// The crypt: a dark stone version of any spec theme, derived so a new app gets one for free (DESIGN.md section 4).
import { contrastRatio } from '../schema/contrast';
import { type Theme, defaultTheme } from '../schema/theme';
import { hexToHsl, hslToHex, mixHex } from './color';

export interface CryptColours {
  canvas: string;
  surface: string;
  surfaceSunken: string;
  accent: string;
  accentInk: string;
  accentTint: string;
}

const CORE_ACCENT = '#3657c9';
const MAX_SATURATION = 0.34;
const LIGHTNESS = { canvas: 0.065, surface: 0.115, sunken: 0.085 } as const;
const TINT = 0.24;
const ACCENT_MIN = 4.6;

/** Canvas and slabs in the light canvas's hue, the accent lifted until it reads on all of them. */
export function cryptTheme(theme: Theme | Pick<Theme, 'accent' | 'canvas'> | undefined): CryptColours {
  const { h, s: lightS } = hexToHsl(theme?.canvas ?? defaultTheme.canvas);
  const s = Math.min(lightS, MAX_SATURATION);
  const canvas = hslToHex({ h, s, l: LIGHTNESS.canvas });
  const surface = hslToHex({ h, s: s * 0.9, l: LIGHTNESS.surface });
  const surfaceSunken = hslToHex({ h, s, l: LIGHTNESS.sunken });
  const base = theme?.accent ?? CORE_ACCENT;
  const accentTint = mixHex(base, surface, TINT);
  const hsl = hexToHsl(base);
  let accent = base;
  for (let l = hsl.l; l <= 1; l += 0.005) {
    accent = hslToHex({ ...hsl, l });
    if (Math.min(contrastRatio(accent, surface), contrastRatio(accent, canvas), contrastRatio(accent, accentTint)) >= ACCENT_MIN) break;
  }
  return { canvas, surface, surfaceSunken, accent, accentInk: accent, accentTint };
}
