// <oss-lifespan size?>: one countdown as its own card (eyebrow, decay, number, pill, date). Data comes in as properties.
import type { LifespanEvaluation, Now } from '../../engine/evaluate';
import { expirySentence, formatCountdown, shortDay } from '../countdown';
import type { Motif } from '../motifs/index';
import { OssElement, define, h, isDesktop } from './base';
import './oss-decay';
import './oss-pill';

export class OssLifespan extends OssElement {
  static observedAttributes = ['size'];
  static override styles = `
:host { display: block; min-width: 0; }
.card {
  display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "eyebrow eyebrow" "decay count" "pill pill" "date date" "extra extra";
  column-gap: var(--s-3); align-items: end; height: 100%; padding: var(--s-6);
  background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1);
}
.eyebrow { grid-area: eyebrow; margin: 0 0 var(--s-3); font: var(--t-eyebrow); letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); overflow-wrap: anywhere; }
oss-decay { grid-area: decay; }
.count { grid-area: count; display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 6px; min-width: 0; }
.value { font: var(--t-num-l); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.unit { font: var(--t-caption); color: var(--text-2); }
oss-pill { grid-area: pill; justify-self: start; margin-top: var(--s-3); }
.date { grid-area: date; margin-top: var(--s-1); font: var(--t-caption); color: var(--text-3); }
.extra { grid-area: extra; }
.dead .value { color: var(--text-2); }
.small { padding: var(--s-4); }
.small .value { font: var(--t-num-m); }
`;

  #lifespan?: LifespanEvaluation;
  #now: Now = { day: '1970-01-01' };
  #motif: Motif = 'hourglass';
  #media?: MediaQueryList;
  #onMedia = () => this.update();

  get lifespan() {
    return this.#lifespan;
  }
  set lifespan(v: LifespanEvaluation | undefined) {
    this.#lifespan = v;
    this.update();
  }
  get now() {
    return this.#now;
  }
  set now(v: Now) {
    this.#now = v;
    this.update();
  }
  get motif() {
    return this.#motif;
  }
  set motif(v: Motif) {
    this.#motif = v;
    this.update();
  }

  override connectedCallback(): void {
    if (typeof matchMedia === 'function') {
      this.#media = matchMedia('(min-width: 900px)');
      this.#media.addEventListener('change', this.#onMedia);
    }
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    this.#media?.removeEventListener('change', this.#onMedia);
  }

  protected render(): void {
    const l = this.#lifespan;
    if (!l) {
      this.root.replaceChildren();
      return;
    }
    const now = this.#now;
    const attr = this.getAttribute('size');
    const size = attr === 's' || attr === 'm' ? attr : isDesktop() ? 'm' : 's';
    const dead = l.stage.tone === 'dead';
    const c = formatCountdown(l, now);
    this.root.replaceChildren(
      h(
        'section',
        { class: `card${size === 's' ? ' small' : ''}${dead ? ' dead' : ''}`, 'aria-label': `${l.label}: ${expirySentence(l, now)}.` },
        h('p', { class: 'eyebrow' }, l.label),
        h('oss-decay', { motif: this.#motif, fraction: l.fraction, tone: l.stage.tone, size }),
        h('span', { class: 'count', 'aria-hidden': 'true' }, h('span', { class: 'value' }, c.value), c.unit && h('span', { class: 'unit' }, c.unit)),
        h('oss-pill', { tone: l.stage.tone, label: l.stage.label }),
        h('span', { class: 'date' }, h('time', { datetime: l.expiresAt }, shortDay(l.expiresAt, now))),
        h('div', { class: 'extra' }, h('slot')),
      ),
    );
  }
}

define('oss-lifespan', OssLifespan);

declare global {
  interface HTMLElementTagNameMap {
    'oss-lifespan': OssLifespan;
  }
}
