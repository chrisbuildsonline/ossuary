// <oss-decay motif fraction tone size idle?>: the procedural decay visual. Always aria-hidden; text nearby says the same.
import { FULL_WAX, waxHeight } from '../motifs/candle';
import { type Motif, type MotifSize, motifSizes, motifSvg } from '../motifs/index';
import { OssElement, define, svg } from './base';
import { asTone } from './oss-pill';

const motifs: readonly Motif[] = ['hourglass', 'candle', 'ghost'];
export const asMotif = (v: string | null | undefined): Motif => (motifs.includes(v as Motif) ? (v as Motif) : 'hourglass');
const asSize = (v: string | null): MotifSize => (v && v in motifSizes ? (v as MotifSize) : 'm');

/** Paint for the motif parts, shared with the empty-state art. */
export const motifCss = `
.motif * { stroke-linecap: round; stroke-linejoin: round; transition: all var(--dur-4) var(--ease-out); }
.wax, .drip { fill: var(--motif-wax); stroke: var(--motif-ink); stroke-width: 2.5; }
.dish { fill: var(--motif-dish); stroke: var(--motif-ink); stroke-width: 2.5; }
.pool { fill: var(--motif-wax); stroke: var(--motif-ink); stroke-width: 1.5; }
.burnt { fill: none; stroke: var(--line-strong); stroke-width: 1.75; stroke-dasharray: 3 4; }
.wick { fill: var(--motif-ink); }
.halo { fill: var(--motif-flame); opacity: var(--halo); filter: blur(4px); }
.flame-outer { fill: var(--motif-flame); }
.flame-inner { fill: var(--motif-flame-core); }
.smoke { fill: none; stroke: var(--text-3); stroke-width: 2; }
.body { fill: var(--motif-spirit); stroke: var(--motif-spirit-line); stroke-width: 2.5; filter: drop-shadow(0 0 5px var(--spirit-glow)); }
.eye { fill: var(--motif-ink); }
.lid { fill: none; stroke: var(--motif-ink); stroke-width: 2; }
.glass { fill: var(--surface); stroke: var(--text); stroke-width: 2.5; }
.sand { fill: var(--accent-tint); stroke: var(--accent); stroke-width: 1.5; }
.stream { stroke: var(--accent); stroke-width: 1.5; }
.cap { fill: var(--text); }
`;

export class OssDecay extends OssElement {
  static observedAttributes = ['motif', 'fraction', 'tone', 'size'];
  static override styles = `
:host { display: inline-flex; flex: none; line-height: 0; }
svg { overflow: visible; }
${motifCss}
:host([idle]) .flame path { transform-box: fill-box; transform-origin: 50% 100%; animation: sway 1.8s var(--ease-in-out) infinite alternate; }
:host([idle]) .tone-urgent .flame path { animation: flicker .9s var(--ease-in-out) infinite; }
:host([idle]) .float { animation: float 3.2s var(--ease-in-out) infinite alternate; }
@keyframes sway { from { transform: scaleY(1) skewX(-2deg); } to { transform: scaleY(.93) skewX(2deg); } }
@keyframes flicker { 0% { transform: scaleY(1); } 40% { transform: scaleY(.9) skewX(2deg); } 70% { transform: scaleY(.96) skewX(-2deg); } 100% { transform: scaleY(1); } }
@keyframes float { from { transform: translateY(0); } to { transform: translateY(-3px); } }
/* First load (DESIGN.md section 5): the candle burns down from full to its height, the ghost fades from full to its
   opacity. Only the from-state is given, so every animation ends on the static drawing. */
:host([enter]) .wax { animation: burn 1.2s var(--ease-out) both; animation-delay: var(--enter-delay, 0ms); }
:host([enter]) .flame-rise { animation: rise 1.2s var(--ease-out) both; animation-delay: var(--enter-delay, 0ms); }
:host([enter]) .drip, :host([enter]) .pool, :host([enter]) .burnt { animation: late 1.2s var(--ease-out) both; animation-delay: var(--enter-delay, 0ms); }
:host([enter]) .body { animation: haunt 1.4s var(--ease-out) both; animation-delay: var(--enter-delay, 0ms); }
@keyframes burn { from { y: 18px; height: ${FULL_WAX}px; } }
@keyframes rise { from { transform: translateY(calc(-1px * var(--burn-dy, 0))); } }
@keyframes late { from, 70% { opacity: 0; } }
@keyframes haunt { from { fill-opacity: 1; stroke-opacity: 1; } }
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
    const tone = asTone(this.tone);
    // How far the flame drops while the candle burns down on first load, in view box units.
    this.style.setProperty('--burn-dy', String(FULL_WAX - waxHeight(this.fraction, tone)));
    this.root.replaceChildren(svg(motifSvg(this.motif, this.fraction, tone, asSize(this.getAttribute('size')))));
  }
}

define('oss-decay', OssDecay);

declare global {
  interface HTMLElementTagNameMap {
    'oss-decay': OssDecay;
  }
}
