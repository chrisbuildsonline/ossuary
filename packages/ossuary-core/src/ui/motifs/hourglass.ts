// Hourglass: top sand is the fraction left, bottom sand the rest. Dead lays it on its side. 48x64 view box.
import type { Tone } from '../../schema/stages';
import { type MotifSize, frame, n, quantise } from './shared';

const GLASS = 'M12.4 8.2C12.2 21.8 21.6 27.6 21.8 32 21.6 36.4 12.2 42.2 12.4 55.8H35.6C35.8 42.2 26.4 36.4 26.2 32 26.4 27.6 35.8 21.8 35.6 8.2Z';
const NECK = 32;
const SPAN = 22; // usable sand height in each bulb

/** Inner width of a bulb at height y (narrow at the neck, wide at the ends). */
const width = (y: number) => 4 + (20 * Math.abs(y - NECK)) / 24;

export function hourglass(fraction: number, tone: Tone, size: MotifSize): string {
  const f = quantise(fraction);
  const parts = [`<path class="glass" d="${GLASS}"/>`];
  if (f > 0) {
    const y = NECK - 1 - SPAN * f;
    const w = width(y);
    parts.push(`<path class="sand top" d="M${n(24 - w / 2)} ${n(y)}H${n(24 + w / 2)}L26 ${NECK - 1}H22Z"/>`);
  }
  if (f < 1) {
    const y = 55 - SPAN * (1 - f);
    const w = width(y);
    parts.push(`<path class="sand bottom" d="M13 55H35L${n(24 + w / 2)} ${n(y + 2)}Q24 ${n(y - 1)} ${n(24 - w / 2)} ${n(y + 2)}Z"/>`);
  }
  if (f > 0 && f < 1 && tone !== 'dead') parts.push(`<path class="stream" d="M24 ${NECK}V${n(55 - SPAN * (1 - f))}"/>`);
  parts.push('<rect class="cap" x="7.8" y="4" width="32.4" height="4.4" rx="2.2"/><rect class="cap" x="7.8" y="55.6" width="32.4" height="4.4" rx="2.2"/>');
  // On its side the 56px-tall glass must fit the 48px width, so it shrinks around the centre.
  const body = tone === 'dead' ? `<g transform="translate(24 32) rotate(90) scale(.8) translate(-24 -32)">${parts.join('')}</g>` : parts.join('');
  return frame('hourglass', f, tone, size, '0 0 48 64', body, ` data-top="${f}" data-bottom="${n(1 - f)}"`);
}
