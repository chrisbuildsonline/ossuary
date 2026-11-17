// Ghost: fill and stroke fade with the fraction, the eyes follow the stage. 64x80 view box.
import type { Tone } from '../../schema/stages';
import { type MotifSize, frame, quantise } from './shared';

const BODY = 'M12.2 70V34.4C12 18.6 21.2 8.4 32.1 8.4 43 8.2 52 18.4 51.8 34.2V70q-6.5-6.9-13.2 0-6.8-7.2-13.5.1-6.5-7.1-12.9-.1Z';

type Eyes = 'round' | 'half' | 'worried' | 'none';
const eyesFor: Record<Tone, Eyes> = { fresh: 'round', steady: 'round', soon: 'half', urgent: 'worried', dead: 'none' };

const round = '<circle class="eye" cx="25.2" cy="35" r="3"/><circle class="eye" cx="38.9" cy="34.8" r="3"/>';
const eyeParts: Record<Eyes, string> = {
  round,
  half: '<path class="eye" d="M22.2 34.6a3 3 0 0 0 6 0Z"/><path class="eye" d="M35.9 34.4a3 3 0 0 0 6 0Z"/><path class="lid" d="M21.6 34.5h7.2M35.3 34.3h7.2"/>',
  worried: `${round}<path class="lid" d="M21.4 28.6l6.4-2.2M42.6 28.4l-6.4-2.2"/>`,
  none: '',
};

export function ghost(fraction: number, tone: Tone, size: MotifSize): string {
  const f = quantise(fraction);
  const eyes = eyesFor[tone];
  const dead = tone === 'dead';
  const fill = dead ? 0 : 0.15 + 0.85 * f;
  const strokeOpacity = dead ? 0.35 : 0.35 + 0.65 * f;
  const dotted = dead || f < 0.25 ? ' stroke-dasharray="2 4"' : '';
  const o = (v: number) => String(Math.round(v * 1000) / 1000);
  const body = `<path class="body" d="${BODY}" fill-opacity="${o(fill)}" stroke-opacity="${o(strokeOpacity)}"${dotted}/>`;
  return frame('ghost', f, tone, size, '0 0 64 80', `<g class="float">${body}${eyeParts[eyes]}</g>`, ` data-eyes="${eyes}"`);
}
