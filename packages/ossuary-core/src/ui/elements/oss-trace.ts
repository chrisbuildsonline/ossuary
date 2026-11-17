// <oss-trace mode="card|drawer|auto">: how each expiry day was made, one rule per line. Drawer emits oss-close.
import type { Evaluation, LifespanEvaluation, Now } from '../../engine/evaluate';
import { toDayNumber } from '../../engine/iso-day';
import type { TraceLine } from '../../engine/trace';
import { shortDay } from '../countdown';
import { OssElement, define, h, isDesktop, nextId } from './base';
import { dialogCss, openModal } from './dialog';
import './oss-button';

const days = (n: number) => `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`;
const delta = (t: TraceLine) => (t.kind === 'base' ? days(t.deltaDays) : t.deltaDays === 0 ? 'no change' : `${t.deltaDays > 0 ? '+' : '-'}${days(Math.abs(t.deltaDays))}`);

export class OssTrace extends OssElement {
  static observedAttributes = ['mode'];
  static override styles = `
:host { display: block; }
${dialogCss}
.card { padding: var(--s-6); background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1); }
dialog .card { box-shadow: none; padding: 0; }
.eyebrow { margin: 0 0 var(--s-4); font: var(--t-eyebrow); letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
h3 { margin: var(--s-5) 0 var(--s-2); font: var(--t-heading); }
h3:first-of-type { margin-top: 0; }
.mark { color: var(--accent-ink); font: var(--t-caption); font-weight: 600; }
ol { list-style: none; margin: 0; padding: 0; position: relative; }
ol::before { content: ""; position: absolute; left: 4px; top: 12px; bottom: 12px; width: 2px; background: var(--line); }
li { position: relative; display: grid; grid-template-columns: 10px 1fr auto; gap: var(--s-3); align-items: baseline; padding: var(--s-2) 0; }
dialog[open] li { animation: line-in var(--dur-2) var(--ease-out) both; }
dialog[open] li:nth-child(2) { animation-delay: 40ms; } dialog[open] li:nth-child(3) { animation-delay: 80ms; } dialog[open] li:nth-child(4) { animation-delay: 120ms; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--surface); box-shadow: inset 0 0 0 2px var(--line-strong); align-self: center; }
.text { font: var(--t-body); }
.delta { font: var(--t-label); font-variant-numeric: tabular-nums; color: var(--text-2); white-space: nowrap; text-align: right; }
.changed .delta { color: var(--accent-ink); font-weight: 600; }
.total { display: flex; justify-content: space-between; gap: var(--s-3); margin-top: var(--s-2); padding-top: var(--s-3); border-top: 2px dashed var(--line); font: var(--t-heading); font-variant-numeric: tabular-nums; }
.open { min-height: 44px; padding: 0 var(--s-2); border: 0; background: none; color: var(--accent); font: var(--t-label); font-weight: 600; cursor: pointer; border-radius: var(--r-sm); }
.open:hover { text-decoration: underline; text-underline-offset: 4px; }
@keyframes line-in { from { opacity: 0; transform: translateY(8px); } }
`;

  #evaluation?: Evaluation;
  #now: Now = { day: '1970-01-01' };
  #release: (() => void) | undefined;

  get evaluation() {
    return this.#evaluation;
  }
  set evaluation(v: Evaluation | undefined) {
    this.#evaluation = v;
    this.update();
  }
  get now() {
    return this.#now;
  }
  set now(v: Now) {
    this.#now = v;
    this.update();
  }

  protected render(): void {
    const e = this.#evaluation;
    if (!e) {
      this.root.replaceChildren();
      return;
    }
    const mode = this.getAttribute('mode');
    const drawer = mode === 'drawer' || (mode !== 'card' && !isDesktop());
    const several = e.lifespans.length > 1;
    if (!drawer) {
      this.root.replaceChildren(this.#card(e, nextId('trace')));
      return;
    }
    const titleId = nextId('trace');
    const close = h('oss-button', { variant: 'icon', icon: 'close', label: 'Close' });
    const dialog = h(
      'dialog',
      { class: 'bottom side', 'aria-labelledby': titleId },
      h('div', { class: 'grabber', 'aria-hidden': 'true' }),
      h('div', { class: 'head' }, h('span'), close),
      h('div', { class: 'scroll' }, this.#card(e, titleId)),
    );
    const link = h('button', { type: 'button', class: 'open', 'aria-haspopup': 'dialog' }, several ? 'Why these dates?' : 'Why this date?');
    link.addEventListener('click', () => {
      this.#release = openModal(dialog, () => this.close(), close);
    });
    close.addEventListener('click', () => this.close());
    this.root.replaceChildren(link, dialog);
  }

  /** Closes the drawer and returns focus to its link. */
  close(): void {
    const release = this.#release;
    if (!release) return;
    this.#release = undefined;
    release();
    this.emit('oss-close');
  }

  #card(e: Evaluation, titleId: string): HTMLElement {
    const several = e.lifespans.length > 1;
    return h(
      'section',
      { class: 'card', 'aria-labelledby': titleId },
      h('h2', { class: 'eyebrow', id: titleId }, several ? 'Why these dates' : 'Why this date'),
      e.lifespans.flatMap((l, i) => this.#lifespan(l, several, i === e.primaryIndex)),
    );
  }

  #lifespan(l: LifespanEvaluation, several: boolean, primary: boolean): HTMLElement[] {
    const total = toDayNumber(l.expiresAt) - toDayNumber(l.startedAt);
    return [
      ...(several ? [h('h3', {}, l.label, primary ? h('span', { class: 'mark' }, ' · Primary') : null)] : []),
      h(
        'ol',
        {},
        l.trace.map((t) =>
          h('li', { class: t.changed && t.kind !== 'base' ? 'changed' : null }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'text' }, t.text), h('span', { class: 'delta' }, delta(t))),
        ),
      ),
      h('p', { class: 'total' }, h('span', {}, `Expires ${shortDay(l.expiresAt, this.#now)}`), h('span', {}, `= ${days(total)}`)),
    ];
  }
}

define('oss-trace', OssTrace);

declare global {
  interface HTMLElementTagNameMap {
    'oss-trace': OssTrace;
  }
}
