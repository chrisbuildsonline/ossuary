// <pr-storage-switch>: a segmented control over the methods this food has. Always one selected, no required hint. Emits pr-storage { value }.
import type { BoneSpec } from '@ossuary/core';

/** DESIGN.md section 6 segmented control, in core tokens only. */
const css = `
:host { display: grid; gap: var(--s-2); }
.label { font: var(--t-eyebrow); letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
.seg { display: flex; gap: 4px; padding: 4px; min-height: 52px; border-radius: var(--r-pill); background: var(--track); }
button {
  flex: 1 1 0; min-width: 44px; min-height: 44px; padding: 0 var(--s-3); border: 0; border-radius: var(--r-pill); background: none;
  font: var(--t-label); color: var(--text-2); cursor: pointer; white-space: nowrap;
  transition: background-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out);
}
button:hover { color: var(--text); }
button[aria-checked="true"] { background: var(--surface); color: var(--accent-ink); font-weight: 600; box-shadow: var(--shadow-1), inset 0 0 0 1.5px var(--accent); }
button:focus-visible { outline: var(--focus); outline-offset: 2px; }
/* This shadow root does not adopt the core tokens sheet, so it carries the reduced-motion rule itself. */
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;

let styles: CSSStyleSheet | undefined;

export class PrStorageSwitch extends HTMLElement {
  #radios: HTMLButtonElement[] = [];

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    if (!styles) {
      styles = new CSSStyleSheet();
      styles.replaceSync(css);
    }
    root.adoptedStyleSheets = [styles];
  }

  /** Renders the `storage` options of a food spec with `value` selected (the first option if `value` is not offered). */
  show(spec: BoneSpec, value: string): void {
    const field = spec.entity.fields.find((f) => f.key === 'storage');
    const options = field?.kind === 'enum' ? field.options : [];
    let current = Math.max(
      options.findIndex((o) => o.value === value),
      0,
    );
    const label = document.createElement('span');
    label.className = 'label';
    label.id = 'label';
    label.textContent = field?.label ?? 'Storage';
    const group = document.createElement('div');
    group.className = 'seg';
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-labelledby', 'label');
    const mark = () =>
      this.#radios.forEach((r, i) => {
        r.setAttribute('aria-checked', String(i === current));
        r.tabIndex = i === current ? 0 : -1;
      });
    const pick = (i: number) => {
      const o = options[i];
      this.#radios[i]?.focus();
      if (!o || i === current) return;
      current = i;
      mark();
      this.dispatchEvent(new CustomEvent('pr-storage', { detail: { value: o.value }, bubbles: true }));
    };
    this.#radios = options.map((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.textContent = o.label;
      b.addEventListener('click', () => pick(i));
      b.addEventListener('keydown', (e) => {
        const n = options.length;
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        pick((to + n) % n);
      });
      return b;
    });
    mark();
    group.append(...this.#radios);
    this.shadowRoot?.replaceChildren(label, group);
  }

  override focus(options?: FocusOptions): void {
    this.#radios.find((r) => r.tabIndex === 0)?.focus(options);
  }
}

if (!customElements.get('pr-storage-switch')) customElements.define('pr-storage-switch', PrStorageSwitch);

declare global {
  interface HTMLElementTagNameMap {
    'pr-storage-switch': PrStorageSwitch;
  }
}
