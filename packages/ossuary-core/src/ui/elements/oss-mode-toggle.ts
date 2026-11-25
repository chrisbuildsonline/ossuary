// <oss-mode-toggle>: the crypt/light switch. A 44px icon toggle, never a primary action (DESIGN.md section 6).
import { glyph } from '../glyphs';
import { currentMode, setMode } from '../mode';
import { OssElement, define, h, svg } from './base';

export class OssModeToggle extends OssElement {
  static override delegatesFocus = true;
  static override styles = `
:host { display: inline-flex; }
button {
  display: inline-grid; place-items: center; width: 44px; height: 44px; padding: 0; margin: 0; border: 0; border-radius: 50%;
  background: none; color: var(--text-2); cursor: pointer; transition: background-color var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out);
}
button:hover { background: var(--surface-sunken); color: var(--text); }
`;
  #onMode = () => this.update();

  override connectedCallback(): void {
    this.ownerDocument.addEventListener('oss-mode', this.#onMode);
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    this.ownerDocument.removeEventListener('oss-mode', this.#onMode);
  }

  override focus(options?: FocusOptions): void {
    this.root.querySelector('button')?.focus(options);
  }

  protected render(): void {
    const light = currentMode(this.ownerDocument) === 'light';
    // Pressed means light is on; the glyph shows what a press brings (the sun in the crypt, the moon in light).
    const b = h('button', { type: 'button', 'aria-label': 'Light theme', 'aria-pressed': String(light) }, svg(glyph(light ? 'moon' : 'sun')));
    b.addEventListener('click', () => {
      const focused = this.root.activeElement === b;
      setMode(light ? 'crypt' : 'light', this.ownerDocument);
      if (focused) this.focus();
    });
    this.root.replaceChildren(b);
  }
}

define('oss-mode-toggle', OssModeToggle);

declare global {
  interface HTMLElementTagNameMap {
    'oss-mode-toggle': OssModeToggle;
  }
}
