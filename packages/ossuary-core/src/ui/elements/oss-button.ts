// <oss-button variant="primary|ghost|link|icon" icon? label? disabled? block?>: a native button inside.
import { type GlyphName, glyph, glyphNames } from '../glyphs';
import { OssElement, define, h, svg } from './base';

const variants = ['primary', 'ghost', 'link', 'icon'] as const;
export type ButtonVariant = (typeof variants)[number];

export class OssButton extends OssElement {
  static observedAttributes = ['variant', 'icon', 'label', 'disabled', 'pressed', 'current'];
  static override styles = `
:host { display: inline-flex; vertical-align: middle; }
:host([block]) { display: flex; width: 100%; }
.b {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--s-2);
  width: 100%; min-height: 44px; min-width: 44px; margin: 0; border: 0; cursor: pointer;
  padding: 0 var(--s-5); border-radius: var(--r-pill); background: none; color: var(--text);
  font: var(--t-label); font-weight: 600; white-space: nowrap; text-decoration: none;
  transition: background-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out), transform var(--dur-1) var(--ease-out);
}
.b:active:not(:disabled) { transform: scale(.98); }
.primary { min-height: 52px; padding: 0 var(--s-6); background: var(--ink); color: var(--on-ink); }
.primary:hover:not(:disabled) { background: var(--ink-hover); }
.primary:disabled { background: var(--disabled); color: var(--text-2); cursor: not-allowed; }
.ghost { background: var(--surface); box-shadow: var(--shadow-1); padding: 0 var(--s-4); }
.ghost:hover:not(:disabled) { box-shadow: var(--shadow-2); }
.ghost[aria-pressed="true"] { background: var(--accent-tint); color: var(--accent-ink); box-shadow: inset 0 0 0 1.5px var(--accent); }
.link { color: var(--accent); padding: 0 var(--s-2); }
.link:hover { text-decoration: underline; text-underline-offset: 4px; }
.icon { width: 44px; height: 44px; padding: 0; border-radius: 50%; }
.icon:hover { background: var(--surface-sunken); }
.b:disabled { cursor: not-allowed; }
@media (max-width: 899px) { .primary { min-height: 56px; font-size: 16px; } }
`;

  get variant(): ButtonVariant {
    const v = this.getAttribute('variant');
    return (variants as readonly string[]).includes(v ?? '') ? (v as ButtonVariant) : 'ghost';
  }

  override focus(options?: FocusOptions): void {
    this.root.querySelector('button')?.focus(options);
  }

  protected render(): void {
    const icon = this.getAttribute('icon');
    const pressed = this.getAttribute('pressed');
    const button = h(
      'button',
      {
        class: `b ${this.variant}`,
        type: 'button',
        part: 'control',
        disabled: this.hasAttribute('disabled'),
        'aria-label': this.getAttribute('label'),
        'aria-pressed': pressed,
        'aria-current': this.getAttribute('current'),
      },
      icon && (glyphNames as string[]).includes(icon) ? svg(glyph(icon as GlyphName)) : null,
      h('slot'),
    );
    this.root.replaceChildren(button);
  }
}

define('oss-button', OssButton);

declare global {
  interface HTMLElementTagNameMap {
    'oss-button': OssButton;
  }
}
