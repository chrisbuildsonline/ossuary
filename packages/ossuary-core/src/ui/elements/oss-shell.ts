// <oss-shell current="items|import|backup">: the themed app frame. Desktop top bar; phone app bar and bottom bar.
import type { BoneSpec } from '../../schema/bone-spec';
import { loadDisplayFont } from '../fonts';
import { type GlyphName, glyph } from '../glyphs';
import { ensureDocumentTokens } from '../styles';
import { applyTheme } from '../theme';
import { OssElement, define, h, svg } from './base';

const nav: { id: string; label: string; icon: GlyphName }[] = [
  { id: 'items', label: 'Items', icon: 'list' },
  { id: 'import', label: 'Import', icon: 'import' },
  { id: 'backup', label: 'Backup', icon: 'archive' },
];

export class OssShell extends OssElement {
  static observedAttributes = ['current'];
  static override styles = `
:host { display: block; min-height: 100dvh; background: var(--canvas); color: var(--text); }
.top { display: flex; align-items: center; gap: var(--s-6); height: 72px; max-width: 1120px; margin: 0 auto; padding: 0 var(--s-10); }
.brand { display: flex; align-items: center; gap: var(--s-2); color: var(--text); flex: none; }
.wordmark { font: 600 20px/24px var(--font-display); letter-spacing: -0.01em; white-space: nowrap; }
.top-nav { display: flex; gap: var(--s-2); flex: 1; justify-content: center; }
.tab, .bottom button {
  min-height: 44px; min-width: 44px; padding: 0 var(--s-3); border: 0; background: none; cursor: pointer;
  font: var(--t-label); color: var(--text-2); border-radius: var(--r-sm);
}
.tab:hover { color: var(--text); }
.tab[aria-current="page"] { color: var(--accent-ink); text-decoration: underline 2px var(--accent); text-underline-offset: 8px; }
.actions { display: flex; align-items: center; gap: var(--s-3); flex: none; }
main { display: block; max-width: 1120px; margin: 0 auto; padding: var(--s-4) var(--s-10) calc(var(--s-14) + var(--oss-toast-space, 0px)); }
.bottom { display: none; }
@media (max-width: 899px) {
  .top { position: sticky; top: 0; z-index: 12; height: 56px; padding: 0 var(--s-4); background: var(--canvas); gap: var(--s-3); justify-content: space-between; }
  .top-nav { display: none; }
  .primary { position: fixed; z-index: 11; left: 50%; transform: translateX(-50%); bottom: calc(8px + env(safe-area-inset-bottom)); min-width: 160px; }
  ::slotted([slot="primary"]) { min-width: 160px; }
  main { padding: var(--s-2) var(--s-4) calc(72px + var(--s-10) + env(safe-area-inset-bottom) + var(--oss-toast-space, 0px)); }
  .bottom {
    display: flex; justify-content: space-between; align-items: center; position: fixed; z-index: 10; left: 0; right: 0; bottom: 0;
    height: calc(72px + env(safe-area-inset-bottom)); padding: 0 var(--s-4) env(safe-area-inset-bottom);
    background: var(--surface); box-shadow: var(--shadow-3); border-radius: var(--r-xl) var(--r-xl) 0 0;
  }
  .bottom button { display: grid; justify-items: center; gap: 2px; padding: var(--s-1) var(--s-3); font: var(--t-caption); }
  .bottom button[aria-current="page"] { color: var(--accent-ink); }
}
`;

  #spec?: BoneSpec;
  get spec() {
    return this.#spec;
  }
  set spec(v: BoneSpec | undefined) {
    this.#spec = v;
    this.update();
  }

  override connectedCallback(): void {
    ensureDocumentTokens(this.ownerDocument);
    super.connectedCallback();
  }

  protected render(): void {
    const theme = this.#spec?.theme;
    applyTheme(this, theme);
    void loadDisplayFont(theme?.display ?? 'inter');
    const current = this.getAttribute('current');
    const go = (id: string) => () => this.emit('oss-nav', { target: id });
    const tab = (n: (typeof nav)[number], withIcon: boolean) => {
      const b = h('button', { type: 'button', class: withIcon ? null : 'tab', 'aria-current': n.id === current ? 'page' : null }, withIcon && svg(glyph(n.icon)), n.label);
      b.addEventListener('click', go(n.id));
      return b;
    };
    this.root.replaceChildren(
      h(
        'header',
        { class: 'top' },
        h('div', { class: 'brand' }, svg(glyph('bone')), h('span', { class: 'wordmark' }, theme?.wordmark ?? this.#spec?.name ?? 'Ossuary')),
        h('nav', { class: 'top-nav', 'aria-label': 'Main' }, nav.map((n) => tab(n, false))),
        h('div', { class: 'actions' }, h('slot', { name: 'actions' }), h('span', { class: 'primary' }, h('slot', { name: 'primary' }))),
      ),
      h('main', {}, h('slot')),
      h('nav', { class: 'bottom', 'aria-label': 'Tabs' }, tab(nav[0] as (typeof nav)[number], true), tab(nav[2] as (typeof nav)[number], true)),
    );
  }
}

define('oss-shell', OssShell);

declare global {
  interface HTMLElementTagNameMap {
    'oss-shell': OssShell;
  }
}
