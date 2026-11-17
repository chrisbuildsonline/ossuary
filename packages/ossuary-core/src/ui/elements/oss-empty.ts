// <oss-empty kind="empty|error">: centred art, one line, one primary action and an optional import link.
import type { BoneSpec } from '../../schema/bone-spec';
import { type EmptyArt, emptyArtSvg, emptyArts } from '../motifs/empty-art';
import { OssElement, define, h, svg } from './base';
import './oss-button';
import { motifCss } from './oss-decay';

export class OssEmpty extends OssElement {
  static observedAttributes = ['kind', 'message'];
  static override styles = `
:host { display: block; }
${motifCss}
.box {
  display: grid; justify-items: center; text-align: center; gap: var(--s-4);
  padding: var(--s-10) var(--s-6); background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1);
}
.art svg { width: 200px; height: 240px; max-width: 100%; }
h2 { margin: 0; font: var(--t-title); letter-spacing: -0.01em; color: var(--text); }
p { margin: 0; font: var(--t-body); color: var(--text-2); max-width: 40ch; }
.actions { display: grid; justify-items: center; gap: var(--s-2); margin-top: var(--s-2); }
.moon { fill: var(--accent-tint); stroke: var(--text); stroke-width: 2.5; }
.jar, .box { fill: var(--surface); stroke: var(--text); stroke-width: 2.5; }
.lid-cap, .box-flap { fill: var(--accent-tint); stroke: var(--text); stroke-width: 2.5; stroke-linejoin: round; }
.jar-line, .zz { fill: none; stroke: var(--text-3); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
`;

  #spec?: BoneSpec;
  get spec() {
    return this.#spec;
  }
  set spec(v: BoneSpec | undefined) {
    this.#spec = v;
    this.update();
  }

  protected render(): void {
    const spec = this.#spec;
    const error = this.getAttribute('kind') === 'error';
    const named = spec?.theme?.emptyArt;
    const art: EmptyArt = named && emptyArts.includes(named) ? named : 'hourglass-side';
    const title = error ? 'Your items could not be opened.' : (spec?.copy?.emptyTitle ?? 'Nothing here yet.');
    const body = error ? this.getAttribute('message') : spec?.copy?.emptyBody;
    const action = h('oss-button', { variant: 'primary' }, error ? 'Try again' : (spec?.copy?.addLabel ?? 'Add your first item'));
    action.addEventListener('click', () => this.emit(error ? 'oss-retry' : 'oss-add'));
    const link = error ? null : h('oss-button', { variant: 'link' }, 'or import a list');
    link?.addEventListener('click', () => this.emit('oss-import-open'));
    this.root.replaceChildren(
      h(
        'div',
        { class: 'box' },
        h('div', { class: 'art' }, svg(emptyArtSvg(art))),
        h('h2', {}, title),
        body ? h('p', {}, body) : null,
        h('div', { class: 'actions' }, action, link),
      ),
    );
  }
}

define('oss-empty', OssEmpty);

declare global {
  interface HTMLElementTagNameMap {
    'oss-empty': OssEmpty;
  }
}
