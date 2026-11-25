// Candle: wax height follows the fraction, the flame follows the stage. 48x96 view box.
import type { Tone } from '../../schema/stages';
import { type MotifSize, frame, n, quantise } from './shared';

const flameScale: Record<Exclude<Tone, 'dead'>, number> = { fresh: 1, steady: 1, soon: 0.8, urgent: 0.6 };
const BOTTOM = 90;
/** A full candle: the wax stands this tall at fraction 1. */
export const FULL_WAX = 72;

/** Wax height in the 48x96 view box: `8 + 64 * fraction`, a stub when dead. */
export const waxHeight = (fraction: number, tone: Tone): number => (tone === 'dead' ? 8 : 8 + 64 * quantise(fraction));

export function candle(fraction: number, tone: Tone, size: MotifSize): string {
  const f = quantise(fraction);
  const dead = tone === 'dead';
  const h = waxHeight(f, tone);
  const top = BOTTOM - h;
  const burnt = FULL_WAX - h;
  const parts: string[] = ['<ellipse class="dish" cx="24" cy="91.2" rx="18.4" ry="3.6"/>'];
  // Where the full candle stood, dashed, so the shrink reads at a glance.
  if (burnt > 0) parts.push(`<rect class="burnt" x="12" y="${n(BOTTOM - FULL_WAX)}" width="24" height="${n(burnt)}" rx="4"/>`);
  parts.push(`<rect class="wax" x="12" y="${n(top)}" width="24" height="${n(h)}" rx="4"/>`);
  // Drips hang from the rim: one below 0.66, two below 0.33. Slight wobble baked into the curves.
  const drip = (x: number, len: number) =>
    `<path class="drip" d="M${n(x)} ${n(top + 1)}v${n(len)}c0 2.1 3.2 2.3 3.1-.2V${n(top + 1)}"/>`;
  if (f < 0.66) parts.push(drip(15.2, Math.min(9, h - 4)));
  if (f < 0.33) parts.push(drip(28.4, Math.min(5.5, h - 4)));
  if (tone === 'urgent') parts.push('<ellipse class="pool" cx="23.6" cy="89.4" rx="14.2" ry="2.3"/>');
  if (dead) {
    parts.push(
      `<path class="smoke" d="M19.6 ${n(top - 3)}c-2.6-3.8 2.4-6.1 0-10.2s2.3-6.4.2-9.6"/>`,
      `<path class="smoke" d="M24.4 ${n(top - 5)}c2.5-3.6-2.6-6.6-.1-10.4s-2.2-6 .3-9.8"/>`,
      `<path class="smoke" d="M28.8 ${n(top - 3)}c-2.4-3.1 2.2-5.7 0-9.1"/>`,
    );
  } else {
    const scale = flameScale[tone];
    // The wick, its halo of light and the flame ride the top of the wax together (the first-load burn-down moves them).
    parts.push(
      '<g class="flame-rise">' +
        `<circle class="halo" cx="24" cy="${n(top - 5 - 6.5 * scale)}" r="${n(13 * scale)}"/>` +
        `<rect class="wick" x="23" y="${n(top - 5)}" width="2" height="6" rx="1"/>` +
        `<g class="flame" transform="translate(24 ${n(top - 5)}) scale(${scale})">` +
        '<path class="flame-outer" d="M0 0C-5.2-3.4-5-8.1.1-13.1 5-8 5.1-3.6 0 0Z"/>' +
        '<path class="flame-inner" d="M0-1.6C-2.4-3.4-2.6-6 0-8.6 2.5-6 2.4-3.5 0-1.6Z"/></g>' +
        '</g>',
    );
  }
  return frame('candle', f, tone, size, '0 0 48 96', parts.join(''));
}
