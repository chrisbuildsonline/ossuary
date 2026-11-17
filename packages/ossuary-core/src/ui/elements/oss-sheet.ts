// <oss-sheet>: add/edit sheet generated from spec fields, with a live preview. Emits oss-save { id?, values } and oss-cancel.
import { type Now, evaluate } from '../../engine/evaluate';
import type { BoneSpec } from '../../schema/bone-spec';
import type { Item } from '../../schema/item';
import { OssElement, define, h } from './base';
import { dialogCss, openModal } from './dialog';
import './oss-button';
import './oss-decay';
import './oss-field';
import type { OssField } from './oss-field';
import './oss-pill';
import { toneCss } from './oss-pill';
import { expiresLine, otherCss, otherLine } from './preview';

export class OssSheet extends OssElement {
  static override styles = `
:host { display: contents; }
${dialogCss}
${toneCss}
${otherCss}
.preview {
  display: grid; grid-template-columns: auto 1fr; gap: var(--s-1) var(--s-4); align-items: center;
  padding: var(--s-4); margin-bottom: var(--s-6); border-radius: var(--r-lg); background: var(--surface-sunken);
}
.preview oss-decay { grid-row: span 3; }
.expires { margin: 0; font: var(--t-heading); }
.source { margin: 0; font: var(--t-caption); color: var(--text-3); }
.preview .others { grid-column: 1 / -1; margin-top: var(--s-2); }
form { display: grid; gap: var(--s-5); }
`;

  #spec?: BoneSpec;
  #now: Now = { day: '1970-01-01' };
  #values: Item = {};
  #id: string | undefined;
  #release: (() => void) | undefined;

  get spec() {
    return this.#spec;
  }
  set spec(v: BoneSpec | undefined) {
    this.#spec = v;
  }
  get now() {
    return this.#now;
  }
  set now(v: Now) {
    this.#now = v;
  }
  get open(): boolean {
    return this.#release !== undefined;
  }

  protected render(): void {
    // Content is built on show().
  }

  /** Opens for add (no id) or edit (with the item id), seeded with `values`. */
  show(values: Item = {}, id?: string): void {
    const spec = this.#spec;
    if (!spec) return;
    this.#release?.();
    this.#values = { ...values };
    this.#id = id;
    const titleId = 'sheet-title';
    const close = h('oss-button', { variant: 'icon', icon: 'close', label: 'Close' });
    close.addEventListener('click', () => this.cancel());
    const save = h('oss-button', { variant: 'primary' }, 'Save item');
    save.addEventListener('click', () => this.save());
    const fields = spec.entity.fields.map((f) => {
      const el = h('oss-field', { 'data-key': f.key });
      Object.assign(el, { field: f, value: this.#values[f.key] });
      return el;
    });
    const form = h('form', { novalidate: true }, fields);
    form.addEventListener('oss-change', (e) => {
      const { key, value } = (e as CustomEvent<{ key: string; value: Item[string] }>).detail;
      if (value === undefined) delete this.#values[key];
      else this.#values[key] = value;
      const field = fields.find((f) => f.field?.key === key);
      if (field) field.error = undefined;
      this.#preview();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
    const dialog = h(
      'dialog',
      { class: 'side', 'aria-labelledby': titleId },
      h('div', { class: 'grabber', 'aria-hidden': 'true' }),
      h('div', { class: 'head' }, h('h2', { id: titleId }, id ? 'Edit item' : (spec.copy?.addLabel ?? 'Add item')), close),
      h('div', { class: 'scroll' }, h('section', { class: 'preview', 'aria-label': 'Preview' }), form),
      h('div', { class: 'foot' }, save),
    );
    this.root.replaceChildren(dialog);
    this.#preview();
    this.#release = openModal(dialog, () => this.cancel(), fields[0]);
  }

  /** Validates through the engine. Invalid: errors beside fields and focus on the first. Valid: emits oss-save and closes. */
  save(): void {
    const spec = this.#spec;
    if (!spec) return;
    const r = evaluate(spec, this.#values, this.#now);
    const fields = Array.from(this.root.querySelectorAll('oss-field')) as OssField[];
    if (!r.ok) {
      const errors = new Map<string, string>();
      for (const issue of r.error) {
        const key = issue.path.split(/[.[]/)[0] ?? '';
        if (!errors.has(key)) errors.set(key, issue.message);
      }
      for (const f of fields) f.error = errors.get(f.field?.key ?? '');
      fields.find((f) => f.error)?.focus();
      return;
    }
    this.emit('oss-save', this.#id === undefined ? { values: { ...this.#values } } : { id: this.#id, values: { ...this.#values } });
    this.#close();
  }

  cancel(): void {
    if (!this.open) return;
    this.#close();
    this.emit('oss-cancel');
  }

  #close(): void {
    const release = this.#release;
    this.#release = undefined;
    release?.();
  }

  #preview(): void {
    const spec = this.#spec;
    const box = this.root.querySelector('.preview');
    if (!spec || !box) return;
    const motif = spec.theme?.motif ?? 'hourglass';
    const r = evaluate(spec, this.#values, this.#now);
    if (!r.ok) {
      box.replaceChildren(h('oss-decay', { motif, fraction: 1, tone: 'steady', size: 'm' }), h('p', { class: 'expires' }, 'Fill in the required fields to see the date.'));
      return;
    }
    const e = r.value;
    const primary = e.lifespans[e.primaryIndex];
    if (!primary) return;
    const several = e.lifespans.length > 1;
    const sourceId = primary.trace.find((t) => t.sourceId)?.sourceId;
    const source = spec.sources?.find((s) => s.id === sourceId)?.name;
    box.replaceChildren(
      h('oss-decay', { motif, fraction: primary.fraction, tone: primary.stage.tone, size: 'm' }),
      h('p', { class: 'expires' }, expiresLine(primary, this.#now, several)),
      h('div', {}, h('oss-pill', { tone: primary.stage.tone, label: primary.stage.label })),
    );
    if (source) box.append(h('p', { class: 'source' }, `Based on ${source}`));
    if (several) box.append(h('ul', { class: 'others' }, e.lifespans.filter((_, i) => i !== e.primaryIndex).map((l) => otherLine(l, this.#now))));
  }
}

define('oss-sheet', OssSheet);

declare global {
  interface HTMLElementTagNameMap {
    'oss-sheet': OssSheet;
  }
}
