// <oss-field>: one spec field with a visible label and a helper or error. Emits oss-change { key, value }.
import type { Field } from '../../schema/fields';
import type { Item } from '../../schema/item';
import { glyph } from '../glyphs';
import { OssElement, define, h, nextId, svg } from './base';

type Value = Item[string];

export const fieldCss = `
:host { display: block; }
.field { display: grid; gap: var(--s-2); }
label, .label { font: var(--t-label); color: var(--text); }
.help { margin: 0; display: flex; align-items: center; gap: 6px; font: var(--t-caption); color: var(--text-3); }
.help.error { color: var(--error); }
.control { position: relative; display: flex; gap: var(--s-2); }
input, select {
  width: 100%; height: 48px; padding: 0 14px; border: 1px solid var(--line-strong); border-radius: var(--r-sm);
  background: var(--surface-sunken); font: var(--t-body); color: var(--text); appearance: none; min-width: 0;
}
input:focus, select:focus { background: var(--surface); }
input:focus-visible, select:focus-visible { outline: var(--focus); outline-offset: 2px; }
input[aria-invalid="true"], select[aria-invalid="true"], .seg[aria-invalid="true"] { border-color: var(--error); box-shadow: inset 0 0 0 1px var(--error); }
input[type="date"] { padding-right: 44px; }
input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; width: 44px; height: 44px; position: absolute; right: 0; cursor: pointer; }
.cal { position: absolute; right: 12px; top: 12px; pointer-events: none; color: var(--text-2); }
.cal svg { width: 24px; height: 24px; }
select { padding-right: 40px; cursor: pointer; }
.chev { position: absolute; right: 16px; top: 16px; pointer-events: none; color: var(--text-2); }
.step {
  flex: none; width: 48px; height: 48px; border: 0; border-radius: var(--r-pill); background: var(--track); color: var(--text);
  display: grid; place-items: center; cursor: pointer;
}
.step:hover { background: var(--line); }
.seg { display: flex; gap: 4px; padding: 4px; min-height: 52px; border-radius: var(--r-pill); background: var(--track); }
.seg button {
  flex: 1 1 0; min-width: 44px; min-height: 44px; padding: 0 var(--s-3); border: 0; border-radius: var(--r-pill); background: none;
  font: var(--t-label); color: var(--text-2); cursor: pointer; white-space: nowrap;
  transition: background-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out);
}
.seg button[aria-checked="true"] { background: var(--surface); color: var(--accent-ink); font-weight: 600; box-shadow: var(--shadow-1), inset 0 0 0 1.5px var(--accent); }
.seg button:focus-visible { outline: var(--focus); outline-offset: 2px; }
`;

export class OssField extends OssElement {
  static override styles = fieldCss;

  #field?: Field;
  #value: Value;
  #error?: string;
  readonly #id = nextId('f');

  get field() {
    return this.#field;
  }
  set field(v: Field | undefined) {
    this.#field = v;
    this.update();
  }
  get value(): Value {
    return this.#value;
  }
  set value(v: Value) {
    this.#value = v;
    this.update();
  }
  get error() {
    return this.#error;
  }
  /** Updates the helper and invalid state in place, so a focused control keeps focus. */
  set error(v: string | undefined) {
    if (v === this.#error) return;
    this.#error = v;
    const help = this.root.querySelector('.help');
    const control = this.root.querySelector('[aria-describedby]');
    if (!help || !control) {
      this.update();
      return;
    }
    help.className = v ? 'help error' : 'help';
    help.replaceChildren(...(v ? [svg(glyph('alert')), v] : [this.#field ? this.#helper(this.#field) : '']));
    if (v) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  }

  /** Focuses the control (the checked segment for a radiogroup). */
  override focus(options?: FocusOptions): void {
    (this.root.querySelector('input, select, [role="radio"][tabindex="0"]') as HTMLElement | null)?.focus(options);
  }

  #change(value: Value): void {
    this.#value = value;
    this.emit('oss-change', { key: this.#field?.key, value });
  }

  protected render(): void {
    const f = this.#field;
    if (!f) {
      this.root.replaceChildren();
      return;
    }
    const id = `${this.#id}-input`;
    const labelId = `${this.#id}-label`;
    const helpId = `${this.#id}-help`;
    const error = this.#error;
    const common = { id, 'aria-describedby': helpId, 'aria-invalid': error ? 'true' : null, required: f.required === true };
    const help = h('p', { id: helpId, class: error ? 'help error' : 'help' }, error ? [svg(glyph('alert')), error] : [this.#helper(f)]);
    let control: HTMLElement;
    let label: HTMLElement = h('label', { for: id, id: labelId }, f.label);

    if (f.kind === 'enum' && f.options.length <= 4) {
      label = h('span', { class: 'label', id: labelId }, f.label);
      control = this.#segmented(f, { 'aria-labelledby': labelId, 'aria-describedby': helpId, 'aria-invalid': common['aria-invalid'], 'aria-required': f.required ? 'true' : null });
    } else if (f.kind === 'enum') {
      const select = h(
        'select',
        common,
        h('option', { value: '' }, 'Choose'),
        f.options.map((o) => h('option', { value: o.value, selected: o.value === this.#value }, o.label)),
      );
      select.value = this.#value === undefined ? '' : String(this.#value);
      select.addEventListener('change', () => this.#change(select.value === '' ? undefined : select.value));
      control = h('div', { class: 'control' }, select, h('span', { class: 'chev' }, svg(glyph('chevron'))));
    } else {
      const type = f.kind === 'number' ? 'number' : f.kind === 'date' ? 'date' : 'text';
      const extra = f.kind === 'number' ? { min: f.min, max: f.max, step: f.step ?? 'any', inputmode: 'decimal' } : {};
      const input = h('input', { ...common, ...extra, type, autocomplete: 'off' });
      input.value = this.#value === undefined ? '' : String(this.#value);
      const read = (): Value => {
        if (input.value === '') return undefined;
        return f.kind === 'number' ? Number(input.value) : input.value;
      };
      input.addEventListener('input', () => this.#change(read()));
      control = h('div', { class: 'control' }, input);
      if (f.kind === 'date') control.append(h('span', { class: 'cal' }, svg(glyph('calendar'))));
      if (f.kind === 'number' && f.step !== undefined) {
        const step = f.step;
        const bump = (sign: number) => () => {
          const current = typeof this.#value === 'number' ? this.#value : (f.min ?? 0) - (sign > 0 ? step : 0);
          let next = current + sign * step;
          if (f.min !== undefined) next = Math.max(f.min, next);
          if (f.max !== undefined) next = Math.min(f.max, next);
          input.value = String(next);
          this.#change(next);
        };
        const minus = h('button', { type: 'button', class: 'step', 'aria-label': `Decrease ${f.label}` }, svg(glyph('minus')));
        const plus = h('button', { type: 'button', class: 'step', 'aria-label': `Increase ${f.label}` }, svg(glyph('plus')));
        minus.addEventListener('click', bump(-1));
        plus.addEventListener('click', bump(1));
        control.prepend(minus);
        control.append(plus);
      }
    }
    this.root.replaceChildren(h('div', { class: 'field' }, label, control, help));
  }

  #helper(f: Field): string {
    if (f.kind === 'number' && (f.min !== undefined || f.max !== undefined)) {
      const range = f.min !== undefined && f.max !== undefined ? `${f.min} to ${f.max}` : f.min !== undefined ? `${f.min} or more` : `Up to ${f.max}`;
      return `${f.required ? 'Required' : 'Optional'}, ${range}.`;
    }
    return f.required ? 'Required.' : 'Optional.';
  }

  #segmented(f: Extract<Field, { kind: 'enum' }>, attrs: Record<string, string | null>): HTMLElement {
    const group = h('div', { class: 'seg', role: 'radiogroup', ...attrs });
    const checkedIndex = f.options.findIndex((o) => o.value === this.#value);
    const radios = f.options.map((o, i) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(i === checkedIndex), tabindex: i === Math.max(checkedIndex, 0) ? '0' : '-1' }, o.label),
    );
    const select = (i: number) => {
      const o = f.options[i];
      if (!o) return;
      radios.forEach((r, j) => {
        r.setAttribute('aria-checked', String(i === j));
        r.tabIndex = i === j ? 0 : -1;
      });
      radios[i]?.focus();
      this.#change(o.value);
    };
    radios.forEach((r, i) => {
      r.addEventListener('click', () => select(i));
      r.addEventListener('keydown', (e) => {
        const n = radios.length;
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        select((to + n) % n);
      });
    });
    group.append(...radios);
    return group;
  }
}

define('oss-field', OssField);

declare global {
  interface HTMLElementTagNameMap {
    'oss-field': OssField;
  }
}
