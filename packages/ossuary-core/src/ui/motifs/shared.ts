import type { Tone } from '../../schema/stages';

export type Motif = 'hourglass' | 'candle' | 'ghost';
export type MotifSize = 's' | 'm' | 'l' | 'xl';

/** Width and height in px (DESIGN.md section 5). */
export const motifSizes: Record<MotifSize, readonly [number, number]> = { s: [32, 40], m: [48, 64], l: [120, 160], xl: [200, 240] };

/** Clamps to 0..1 and snaps to 1/20 steps. */
export function quantise(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.round(Math.min(Math.max(fraction, 0), 1) * 20) / 20;
}

/** Rounds path numbers so output is stable and short. */
export const n = (v: number): string => String(Math.round(v * 100) / 100);

export function frame(motif: Motif, fraction: number, tone: Tone, size: MotifSize, view: string, body: string, extra = ''): string {
  const [w, h] = motifSizes[size];
  return `<svg xmlns="http://www.w3.org/2000/svg" class="motif motif-${motif} tone-${tone}" viewBox="${view}" width="${w}" height="${h}" data-motif="${motif}" data-tone="${tone}" data-fraction="${fraction}"${extra} aria-hidden="true" focusable="false">${body}</svg>`;
}
