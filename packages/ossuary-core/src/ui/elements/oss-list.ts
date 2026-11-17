// <oss-list layout="auto|grid|rows" state="ready|loading|error">: items grouped by their primary stage tone.
import type { Evaluation, Now } from '../../engine/evaluate';
import type { BoneSpec } from '../../schema/bone-spec';
import type { Item } from '../../schema/item';
import type { Tone } from '../../schema/stages';
import { glyph } from '../glyphs';
import { OssElement, define, h, isDesktop, nextId, svg } from './base';
import './oss-empty';
import './oss-item';
import type { OssItem } from './oss-item';
import './oss-pill';

export interface ListEntry {
  id: string;
  values: Item;
  evaluation: Evaluation;
}

export const groupOrder: readonly Tone[] = ['urgent', 'soon', 'steady', 'fresh', 'dead'];

const primaryOf = (e: ListEntry) => e.evaluation.lifespans[e.evaluation.primaryIndex];
const plural = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

/** Entries grouped by primary tone, in display order, soonest first (most recently dead first). */
export function groupEntries(entries: readonly ListEntry[]): { tone: Tone; entries: ListEntry[] }[] {
  return groupOrder
    .map((tone) => ({
      tone,
      entries: entries
        .filter((e) => primaryOf(e)?.stage.tone === tone)
        .sort((a, b) => {
          const da = primaryOf(a)?.remaining.days ?? 0;
          const db = primaryOf(b)?.remaining.days ?? 0;
          return tone === 'dead' ? db - da : da - db;
        }),
    }))
    .filter((g) => g.entries.length > 0);
}

export class OssList extends OssElement {
  static observedAttributes = ['layout', 'state', 'message'];
  static override styles = `
:host { display: block; container-type: inline-size; }
.groups { display: grid; gap: var(--s-10); }
section { display: grid; gap: var(--s-3); }
/* Card mode: groups share one column grid, so small groups sit side by side and cards line up across them. */
.groups.cards { grid-template-columns: minmax(0, 1fr); column-gap: var(--s-5); align-items: start; }
.cards > section { grid-template-columns: subgrid; column-gap: var(--s-5); row-gap: var(--s-3); }
.cards > section > h2, .cards > section > .grid { grid-column: 1 / -1; }
.cards > section > .grid { grid-template-columns: subgrid; column-gap: var(--s-5); row-gap: var(--s-5); }
.cards > section[data-span="all"] { grid-column: 1 / -1; }
@container (min-width: 680px) {
  .groups.cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cards > section[data-span="2"] { grid-column: span 2; }
}
@container (min-width: 1040px) { .groups.cards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
h2 { margin: 0; display: flex; align-items: center; gap: var(--s-3); font: var(--t-heading); color: var(--text-2); }
.toggle {
  display: inline-flex; align-items: center; gap: var(--s-3); min-height: 44px; padding: 0 var(--s-3) 0 0; margin: 0;
  border: 0; background: none; font: inherit; color: inherit; cursor: pointer; border-radius: var(--r-pill);
}
.toggle svg { transition: transform var(--dur-2) var(--ease-out); }
.toggle[aria-expanded="true"] svg { transform: rotate(180deg); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--s-5); }
.rows { display: grid; background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1); overflow: hidden; }
.rows oss-item + oss-item { background: linear-gradient(var(--line), var(--line)) 64px 0 / calc(100% - 64px) 1px no-repeat; }
.skeleton { display: grid; gap: var(--s-5); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.bone { height: 168px; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--shadow-1); position: relative; overflow: hidden; }
.bone::after { content: ""; position: absolute; inset: var(--s-6); border-radius: var(--r-sm); background: var(--track); opacity: .7; animation: pulse 1.6s var(--ease-in-out) infinite alternate; }
@keyframes pulse { to { opacity: .35; } }
`;

  #spec?: BoneSpec;
  #entries: ListEntry[] = [];
  #now: Now = { day: '1970-01-01' };
  #openDead = false;
  #media?: MediaQueryList;
  #onMedia = () => this.update();

  get spec() {
    return this.#spec;
  }
  set spec(v: BoneSpec | undefined) {
    this.#spec = v;
    this.update();
  }
  get entries() {
    return this.#entries;
  }
  set entries(v: ListEntry[]) {
    this.#entries = v;
    this.update();
  }
  get now() {
    return this.#now;
  }
  set now(v: Now) {
    this.#now = v;
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

  #rows(): boolean {
    const layout = this.getAttribute('layout');
    return layout === 'rows' || (layout !== 'grid' && !isDesktop());
  }

  protected render(): void {
    const state = this.getAttribute('state');
    if (state === 'loading') {
      this.root.replaceChildren(
        h('div', { class: 'skeleton', 'aria-busy': 'true' }, h('span', { class: 'sr-only', role: 'status' }, 'Loading items'), [1, 2, 3].map(() => h('div', { class: 'bone' }))),
      );
      return;
    }
    if (state === 'error' || this.#entries.length === 0) {
      const empty = h('oss-empty', { kind: state === 'error' ? 'error' : 'empty', message: this.getAttribute('message') });
      empty.spec = this.#spec;
      this.root.replaceChildren(empty);
      return;
    }
    const rows = this.#rows();
    this.root.replaceChildren(h('div', { class: rows ? 'groups' : 'groups cards' }, groupEntries(this.#entries).map((g) => this.#group(g.tone, g.entries, rows))));
  }

  #group(tone: Tone, entries: ListEntry[], rows: boolean): HTMLElement {
    const headId = nextId('group');
    const bodyId = nextId('group-body');
    const first = entries[0] ? primaryOf(entries[0]) : undefined;
    const pill = h('oss-pill', { tone, label: first?.stage.label ?? tone });
    const count = h('span', { class: 'count' }, plural(entries.length));
    const body = h('div', { class: rows ? 'rows' : 'grid', id: bodyId }, entries.map((e) => this.#item(e, rows)));
    let heading: HTMLElement;
    if (tone === 'dead') {
      const toggle = h('button', { class: 'toggle', type: 'button', 'aria-expanded': String(this.#openDead), 'aria-controls': bodyId }, pill, count, svg(glyph('chevron')));
      body.hidden = !this.#openDead;
      toggle.addEventListener('click', () => {
        this.#openDead = !this.#openDead;
        toggle.setAttribute('aria-expanded', String(this.#openDead));
        body.hidden = !this.#openDead;
      });
      heading = h('h2', { id: headId }, toggle);
    } else heading = h('h2', { id: headId }, pill, count);
    // How many grid columns the group takes in card mode: one per card up to two, then the full row.
    const span = tone === 'dead' || entries.length > 2 ? 'all' : String(entries.length);
    return h('section', { 'aria-labelledby': headId, 'data-tone': tone, 'data-span': span }, heading, body);
  }

  #item(e: ListEntry, rows: boolean): OssItem {
    const el = h('oss-item', { variant: rows ? 'row' : 'card', href: `#item-${e.id}`, 'data-id': e.id }) as OssItem;
    Object.assign(el, { spec: this.#spec, now: this.#now, values: e.values, evaluation: e.evaluation });
    el.addEventListener('click', (event) => {
      event.preventDefault();
      this.emit('oss-open', { id: e.id });
    });
    return el;
  }
}

define('oss-list', OssList);

declare global {
  interface HTMLElementTagNameMap {
    'oss-list': OssList;
  }
}
