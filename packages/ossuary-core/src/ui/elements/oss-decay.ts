// <oss-decay motif fraction tone size idle?>: the procedural decay visual. Always aria-hidden; text nearby says the same.
import { type Motif, type MotifSize, motifSizes, motifSvg } from '../motifs/index';
import { OssElement, define, svg } from './base';
import { asTone } from './oss-pill';

const motifs: readonly Motif[] = ['hourglass', 'candle', 'ghost'];
export const asMotif = (v: string | null | undefined): Motif => (motifs.includes(v as Motif) ? (v as Motif) : 'hourglass');
const asSize = (v: string | null): MotifSize => (v && v in motifSizes ? (v as MotifSize) : 'm');

export class OssDecay extends OssElement {
  static observedAttributes = ['motif', 'fraction', 'tone', 'size'];
  static override styles = `
:host { display: inline-flex; flex: none; line-height: 0; }
svg { overflow: visible; }
.motif * { stroke-linecap: round; stroke-linejoin: round; transition: all var(--dur-4) var(--ease-out); }
.wax, .drip { fill: var(--motif-wax); stroke: var(--text); stroke-width: 2.5; }
.dish { fill: var(--surface-sunken); stroke: var(--text); stroke-width: 2.5; }
.pool { fill: var(--motif-wax); stroke: var(--text); stroke-width: 1.5; }
.wick { fill: var(--text); }
.flame-outer { fill: var(--motif-flame); }
.flame-inner { fill: var(--motif-flame-core); }
.smoke { fill: none; stroke: var(--text-3); stroke-width: 2; }
.body { fill: var(--surface); stroke: var(--text); stroke-width: 2.5; }
.eye { fill: var(--text); }
.lid { fill: none; stroke: var(--text); stroke-width: 2; }
.glass { fill: var(--surface); stroke: var(--text); stroke-width: 2.5; }
.sand { fill: var(--accent-tint); stroke: var(--accent); stroke-width: 1.5; }
.stream { stroke: var(--accent); stroke-width: 1.5; }
.cap { fill: var(--text); }
:host([idle]) .flame path { transform-box: fill-box; transform-origin: 50% 100%; animation: sway 1.8s var(--ease-in-out) infinite alternate; }
:host([idle]) .tone-urgent .flame path { animation: flicker .9s var(--ease-in-out) infinite; }
:host([idle]) .float { animation: float 3.2s var(--ease-in-out) infinite alternate; }
@keyframes sway { from { transform: scaleY(1) skewX(-2deg); } to { transform: scaleY(.93) skewX(2deg); } }
@keyframes flicker { 0% { transform: scaleY(1); } 40% { transform: scaleY(.9) skewX(2deg); } 70% { transform: scaleY(.96) skewX(-2deg); } 100% { transform: scaleY(1); } }
@keyframes float { from { transform: translateY(0); } to { transform: translateY(-3px); } }
`;

  override connectedCallback(): void {
    this.setAttribute('aria-hidden', 'true');
    super.connectedCallback();
  }

  get motif(): Motif {
    return asMotif(this.getAttribute('motif'));
  }
  set motif(v: string) {
    this.setAttribute('motif', v);
  }
  get fraction(): number {
    return Number(this.getAttribute('fraction') ?? 1);
  }
  set fraction(v: number) {
    this.setAttribute('fraction', String(v));
  }
  get tone(): string {
    return asTone(this.getAttribute('tone'));
  }
  set tone(v: string) {
    this.setAttribute('tone', v);
  }

  protected render(): void {
    this.root.replaceChildren(svg(motifSvg(this.motif, this.fraction, asTone(this.tone), asSize(this.getAttribute('size')))));
  }
}

define('oss-decay', OssDecay);
