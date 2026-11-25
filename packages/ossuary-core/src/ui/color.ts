// Small sRGB/HSL helpers for deriving theme colours. Pure: hex strings in, hex strings out.
export interface Hsl {
  h: number; // 0..1
  s: number; // 0..1
  l: number; // 0..1
}

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
const toHex = (channels: number[]): string =>
  `#${channels.map((v) => Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, '0')).join('')}`;

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return { h, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  if (s === 0) return toHex([l, l, l]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return toHex([hue(h + 1 / 3), hue(h), hue(h - 1 / 3)]);
}

/** `a` at `amount` (0..1) over `b`, mixed per channel in sRGB. */
export function mixHex(a: string, b: string, amount: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  return toHex(cb.map((v, i) => v + ((ca[i] ?? 0) - v) * amount));
}
