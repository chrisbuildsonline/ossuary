// <oss-banner tone heading text variant="line"?>: a status notice on a tone tint with an actions slot.
// The line variant is one button row (glyph and text) that emits oss-open.
import type { Tone } from '../../schema/stages';
import { glyph } from '../glyphs';
import { OssElement, define, h, svg } from './base';
import { asTone, toneCss } from './oss-pill';

export class OssBanner extends OssElement {
  static observedAttributes = ['tone', 'heading', 'text', 'variant'];
  static override styles = `
:host { display: block; min-width: 0; }
${toneCss}
.banner {
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--s-2) var(--s-3);
  padding: var(--s-4); border-radius: var(--r-md); background: var(--tone-bg);
}
.glyph { color: var(--tone-fg); padding-top: 4px; }
.words { flex: 1 1 220px; min-width: 0; display: grid; gap: 2px; }
.heading { font: var(--t-heading); color: var(--tone-fg); }
.text { font: var(--t-body); color: var(--text-2); overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-2) var(--s-4); margin-left: auto; }
::slotted(a) {
  display: inline-flex; align-items: center; min-height: 44px; min-width: 44px;
  font: var(--t-label); font-weight: 600; color: var(--tone-fg); text-decoration: underline; text-underline-offset: 3px;
}
::slotted(a:focus-visible) { outline: var(--focus); outline-offset: 2px; border-radius: var(--r-xs); }
.line {
  display: flex; align-items: center; gap: var(--s-2); width: 100%; min-height: 44px; padding: 0 var(--s-4);
  border: 0; border-radius: var(--r-md); background: var(--tone-bg); color: var(--tone-fg);
  font: var(--t-label); font-weight: 600; text-align: left; cursor: pointer;
}
.line .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

  /** The tone slot, `urgent` when missing or unknown. */
  get tone(): Tone {
    const v = this.getAttribute('tone');
    const t = asTone(v);
    return t === v ? t : 'urgent';
  }
  set tone(v: Tone) {
    this.setAttribute('tone', v);
  }
  get heading(): string {
    return this.getAttribute('heading') ?? '';
  }
  set heading(v: string) {
    this.setAttribute('heading', v);
  }
  get text(): string {
    return this.getAttribute('text') ?? '';
  }
  set text(v: string) {
    this.setAttribute('text', v);
  }

  protected render(): void {
    const tone = this.tone;
    const alert = h('span', { class: 'glyph' }, svg(glyph('alert')));
    if (this.getAttribute('variant') === 'line') {
      const line = h('button', { type: 'button', class: 'line' }, alert, h('span', { class: 'label' }, this.text));
      line.addEventListener('click', () => this.emit('oss-open'));
      this.root.replaceChildren(h('div', { role: 'status', 'aria-live': 'polite', class: `tone-${tone}` }, line));
      return;
    }
    this.root.replaceChildren(
      h(
        'div',
        { role: 'status', 'aria-live': 'polite', class: `banner tone-${tone}` },
        alert,
        h('div', { class: 'words' }, h('span', { class: 'heading' }, this.heading), h('span', { class: 'text' }, this.text)),
        h('div', { class: 'actions' }, h('slot', { name: 'actions' })),
      ),
    );
  }
}

define('oss-banner', OssBanner);

declare global {
  interface HTMLElementTagNameMap {
    'oss-banner': OssBanner;
  }
}
