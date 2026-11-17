// <oss-pill tone label size?>: a stage word in a tinted pill with its tone glyph. Status, not a button.
import { type Tone, tones } from '../../schema/stages';
import { toneGlyph } from '../glyphs';
import { OssElement, define, h, svg } from './base';

export const asTone = (v: string | null | undefined): Tone => ((tones as readonly string[]).includes(v ?? '') ? (v as Tone) : 'steady');

/** Per-tone colour rules shared by pills and other tone-coloured text. */
export const toneCss = tones.map((t) => `.tone-${t} { --tone-bg: var(--tone-${t}-bg); --tone-fg: var(--tone-${t}-fg); }`).join('\n');

export class OssPill extends OssElement {
  static observedAttributes = ['tone', 'label', 'size'];
  static override styles = `
:host { display: inline-flex; vertical-align: middle; }
${toneCss}
.pill {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px 0 8px;
  border-radius: var(--r-pill); background: var(--tone-bg); color: var(--tone-fg);
  font: var(--t-caption); font-weight: 600; white-space: nowrap;
  transition: background-color var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out);
}
:host([size="l"]) .pill { height: 32px; }
.pill svg { width: 14px; height: 14px; }
`;

  get tone(): Tone {
    return asTone(this.getAttribute('tone'));
  }
  set tone(v: Tone) {
    this.setAttribute('tone', v);
  }
  get label(): string {
    return this.getAttribute('label') ?? '';
  }
  set label(v: string) {
    this.setAttribute('label', v);
  }

  protected render(): void {
    this.root.replaceChildren(h('span', { class: `pill tone-${this.tone}` }, svg(toneGlyph(this.tone)), h('span', {}, this.label)));
  }
}

define('oss-pill', OssPill);

declare global {
  interface HTMLElementTagNameMap {
    'oss-pill': OssPill;
  }
}
