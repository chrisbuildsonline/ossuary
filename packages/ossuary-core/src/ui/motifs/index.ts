// Procedural decay motifs: pure (fraction, tone, size) => SVG string. Numbers only, so the markup is safe to inline.
import type { Tone } from '../../schema/stages';
import { candle } from './candle';
import { ghost } from './ghost';
import { hourglass } from './hourglass';
import type { Motif, MotifSize } from './shared';

export { type Motif, type MotifSize, motifSizes, quantise } from './shared';

const motifs = { candle, ghost, hourglass } as const;

export function motifSvg(motif: Motif, fraction: number, tone: Tone, size: MotifSize): string {
  return motifs[motif](fraction, tone, size);
}

export { candle, ghost, hourglass };
