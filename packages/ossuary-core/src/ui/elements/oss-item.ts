// <oss-item variant="card|row" href?>: one item as a single link, driven by its primary lifespan.
import type { Evaluation, LifespanEvaluation, Now } from '../../engine/evaluate';
import type { BoneSpec } from '../../schema/bone-spec';
import type { Item } from '../../schema/item';
import { accessibleName, formatCountdown, shortDay } from '../countdown';
import { toneGlyph } from '../glyphs';
import { shortLine, titleOf } from '../item-text';
import { quantise } from '../motifs/index';
import { OssElement, define, h, svg } from './base';
import './oss-decay';
import './oss-pill';
import { toneCss } from './oss-pill';

export class OssItem extends OssElement {
  static observedAttributes = ['variant', 'href'];
  static override styles = `
:host { display: block; min-width: 0; }
${toneCss}
.motif-candle { --motif-light: var(--motif-flame); }
.motif-ghost { --motif-light: var(--motif-spirit); }
.motif-hourglass { --motif-light: var(--accent); }
.item { --life: 1; position: relative; display: grid; color: inherit; text-decoration: none; min-width: 0; -webkit-tap-highlight-color: transparent; }
.card {
  grid-template-columns: auto 1fr auto; grid-template-areas: "decay count pill" "decay date date" "title title title" "meta meta meta" "others others others";
  column-gap: var(--s-4); row-gap: 0; align-items: start; min-height: 168px; padding: calc(var(--s-6) - 1.5px);
  /* Ghost fade: the slab loses substance with the life left. Text sits on solid pairs, so contrast holds. */
  /* Light from the motif (a candle's warmth, a ghost's pallor) pools behind it, dimmer as life runs out. */
  background:
    radial-gradient(circle at 48px 64px, color-mix(in srgb, var(--motif-light) calc(var(--atmosphere) * (6% + 14% * var(--life))), transparent), transparent 150px),
    color-mix(in srgb, var(--surface) calc(40% + 60% * var(--life)), transparent);
  border: 1.5px solid transparent; border-radius: var(--r-lg); box-shadow: var(--shadow-1);
  transition: transform var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out);
}
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); }
/* Glow near death: amber when soon, a slowly breathing ember when urgent (the glow layer breathes, never the motif). */
.card.tone-soon { box-shadow: var(--shadow-1), 0 0 0 1px var(--glow-soon), 0 0 28px -6px var(--glow-soon); }
.card.tone-urgent { box-shadow: var(--shadow-1), 0 0 0 1px var(--glow-urgent); }
.card.tone-urgent::after, .row.tone-urgent::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  box-shadow: 0 0 40px -4px var(--glow-urgent), inset 0 0 28px -10px var(--glow-urgent);
  animation: ember 2.8s var(--ease-in-out) infinite alternate;
}
@keyframes ember { from { opacity: .55; } to { opacity: 1; } }
/* Dead: a ghost of a card. No slab, a dashed outline, a faded grey motif. */
.card.ghost { background: transparent; box-shadow: none; border-color: var(--line-strong); border-style: dashed; }
.ghost oss-decay { opacity: .55; filter: grayscale(1); }
.ghost .value { color: var(--text-2); }
/* First load: cards rise in one after another, and the dead fade from a slab to their ghost. */
.enter { animation: arrive .5s var(--ease-out) both; animation-delay: var(--enter-delay, 0ms); }
.card.enter.ghost { animation: arrive .5s var(--ease-out) both, to-ghost 1.4s var(--ease-out) both; animation-delay: var(--enter-delay, 0ms), calc(var(--enter-delay, 0ms) + 400ms); }
@keyframes arrive { from { opacity: 0; transform: translateY(8px); } }
@keyframes to-ghost { from { background-color: var(--surface); border-color: transparent; box-shadow: var(--shadow-1); } }
.card:active { transform: scale(.99); }
.card oss-decay { grid-area: decay; }
.card .count { grid-area: count; align-self: end; }
.card oss-pill { grid-area: pill; }
.card .date { grid-area: date; font: var(--t-caption); color: var(--text-3); margin-top: var(--s-1); }
.card .title { grid-area: title; margin-top: var(--s-4); }
.card .meta { grid-area: meta; }
.card .others { grid-area: others; }
.count { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.value { font: var(--t-num-l); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.unit { font: var(--t-caption); color: var(--text-2); }
.title { font: var(--t-heading); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font: var(--t-caption); color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dead .title { color: var(--text-2); }
.lifespan { color: var(--text-2); font-weight: 600; }
.others { list-style: none; margin: var(--s-3) 0 0; padding: var(--s-3) 0 0; border-top: 1px solid var(--line); display: grid; gap: var(--s-1); }
.other { display: flex; align-items: center; gap: var(--s-2); font: var(--t-caption); color: var(--text-2); min-width: 0; white-space: nowrap; }
.other .label { color: var(--text); font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.other .when { flex: none; font-variant-numeric: tabular-nums; }
.stage { flex: none; display: inline-flex; align-items: center; gap: 4px; color: var(--tone-fg); font-weight: 600; margin-left: auto; }
.stage svg { width: 14px; height: 14px; }
.row {
  grid-template-columns: auto 1fr auto; grid-template-areas: "decay mid count" "decay others others";
  align-items: center; column-gap: var(--s-3); row-gap: 0; min-height: 76px; padding: var(--s-3) var(--s-4);
  transition: background-color var(--dur-2) var(--ease-out);
}
.row:hover { background: var(--surface-sunken); }
.row.tone-soon { box-shadow: inset 3px 0 0 var(--tone-soon-fg); }
.row.tone-urgent { box-shadow: inset 3px 0 0 var(--tone-urgent-fg); background: linear-gradient(90deg, var(--glow-urgent), transparent 45%); }
.row.tone-urgent::after { box-shadow: inset 0 0 24px -12px var(--glow-urgent); }
.row.ghost .title { color: var(--text-2); }
.row:active { transform: scale(.99); }
.row oss-decay { grid-area: decay; }
.row .mid { grid-area: mid; display: grid; gap: 2px; min-width: 0; }
.row .count { grid-area: count; flex-direction: column; align-items: flex-end; gap: 0; }
.row .value { font: var(--t-num-m); }
/* The other lifespans run under the name and the number, so a long label and "330 days ago" stay on one line. */
.row .others { grid-area: others; border: 0; margin: var(--s-1) 0 0; padding: 0; min-width: 0; }
a:focus-visible { outline: var(--focus); outline-offset: 2px; }
.row:focus-visible { outline-offset: -3px; border-radius: var(--r-md); }
@media (max-width: 899px) { .card { padding: var(--s-4); } }
`;

  #spec?: BoneSpec;
  #evaluation?: Evaluation;
  #values?: Item;
  #now: Now = { day: '1970-01-01' };

  get spec() {
    return this.#spec;
  }
  set spec(v: BoneSpec | undefined) {
    this.#spec = v;
    this.update();
  }
  get evaluation() {
    return this.#evaluation;
  }
  set evaluation(v: Evaluation | undefined) {
    this.#evaluation = v;
    this.update();
  }
  get values() {
    return this.#values;
  }
  set values(v: Item | undefined) {
    this.#values = v;
    this.update();
  }
  get now() {
    return this.#now;
  }
  set now(v: Now) {
    this.#now = v;
    this.update();
  }

  override focus(options?: FocusOptions): void {
    this.root.querySelector('a')?.focus(options);
  }

  protected render(): void {
    const spec = this.#spec;
    const e = this.#evaluation;
    const values = this.#values;
    const primary = e?.lifespans[e.primaryIndex];
    if (!spec || !e || !values || !primary) {
      this.root.replaceChildren();
      return;
    }
    const now = this.#now;
    const row = this.getAttribute('variant') === 'row';
    const dead = primary.stage.tone === 'dead';
    const c = formatCountdown(primary, now);
    const title = titleOf(spec, values);
    const several = e.lifespans.length > 1;

    const count = h('span', { class: 'count', 'aria-hidden': 'true' }, h('span', { class: 'value' }, c.value), c.unit && h('span', { class: 'unit' }, c.unit));
    // The list marks its items on first load only; the mark is used once, so later renders are static.
    const enter = this.hasAttribute('entering');
    this.removeAttribute('entering');
    const decay = h('oss-decay', { motif: spec.theme?.motif ?? 'hourglass', fraction: primary.fraction, tone: primary.stage.tone, size: row ? 's' : 'm', enter });
    const time = h('time', { datetime: primary.expiresAt, class: row ? 'sr-only' : null }, shortDay(primary.expiresAt, now));
    const others = several
      ? h(
          'ul',
          { class: 'others' },
          e.lifespans.filter((_, i) => i !== e.primaryIndex).map((l) => this.#otherLine(l, now)),
        )
      : null;
    const titleEl = h('span', { class: 'title' }, title);
    const meta = h('span', { class: 'meta' }, shortLine(spec, values, now));

    const link = h('a', {
      class: `item ${row ? 'row' : 'card'} motif-${spec.theme?.motif ?? 'hourglass'} tone-${primary.stage.tone}${dead ? ' dead ghost' : ''}${enter ? ' enter' : ''}`,
      href: this.getAttribute('href') ?? '#',
    });
    link.style.setProperty('--life', String(quantise(primary.fraction)));
    if (row) link.append(decay, h('span', { class: 'mid' }, titleEl, meta), count, ...(others ? [others] : []), time);
    else {
      // With several lifespans the primary countdown names its lifespan beside the date.
      const date = h('span', { class: 'date' }, time, several && ' · ', several && h('span', { class: 'lifespan' }, primary.label));
      link.append(decay, count, h('oss-pill', { tone: primary.stage.tone, label: primary.stage.label }), date, titleEl, meta);
      if (others) link.append(others);
    }
    // The link is named from its content: one plain sentence for screen readers, and the visible parts (the same
    // facts) for the eye only. No aria-label, so the name never contradicts the text inside (WCAG 2.5.3).
    for (const part of Array.from(link.children)) part.setAttribute('aria-hidden', 'true');
    link.append(h('span', { class: 'sr-only said' }, accessibleName(title, e, now)));
    this.root.replaceChildren(link);
  }

  #otherLine(l: LifespanEvaluation, now: Now): HTMLLIElement {
    return h(
      'li',
      { class: `other tone-${l.stage.tone}` },
      h('span', { class: 'label' }, l.label),
      h('span', { class: 'when' }, formatCountdown(l, now).text),
      h('span', { class: 'stage' }, svg(toneGlyph(l.stage.tone)), h('span', {}, l.stage.label)),
    );
  }
}

define('oss-item', OssItem);

declare global {
  interface HTMLElementTagNameMap {
    'oss-item': OssItem;
  }
}
