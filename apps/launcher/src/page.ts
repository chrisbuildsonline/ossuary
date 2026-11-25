// The launcher: one headline, one line, the two apps as cards in their own themes, and one pill to the remix guide.
import { h, svg } from '../../../packages/ossuary-core/src/ui/elements/base.ts';
import '../../../packages/ossuary-core/src/ui/elements/oss-decay.ts';
import '../../../packages/ossuary-core/src/ui/elements/oss-mode-toggle.ts';
import { glyph } from '../../../packages/ossuary-core/src/ui/glyphs.ts';
import { applyTheme } from '../../../packages/ossuary-core/src/ui/theme.ts';
import { type CardData, REMIX_URL, REPO_URL } from './cards';

const newTab = { target: '_blank', rel: 'noopener noreferrer' };

function appCard(c: CardData): HTMLLIElement {
  const id = `app-${c.folder}`;
  const decay = h('oss-decay', { motif: c.motif, tone: 'fresh', fraction: '0.75', size: 'xl' });
  const link = h(
    'a',
    // Named from its content, the app name (the only part not hidden); the blurb and the source describe it.
    { class: 'card', href: c.href, 'aria-describedby': `${id}-blurb ${id}-source` },
    h('span', { class: 'art' }, decay),
    h(
      'span',
      { class: 'text' },
      h('span', { class: 'eyebrow', id: `${id}-source`, 'aria-hidden': 'true' }, c.source),
      h('span', { class: 'name', id: `${id}-name` }, c.name),
      h('span', { class: 'blurb', id: `${id}-blurb`, 'aria-hidden': 'true' }, c.blurb),
      h('span', { class: 'go', 'aria-hidden': 'true' }, 'Open', svg(glyph('arrow'))),
    ),
  );
  applyTheme(link, c.theme);
  // Only the hovered or focused card idles, so at most one motif moves (DESIGN.md section 5).
  for (const [type, idle] of [['pointerenter', true], ['pointerleave', false], ['focus', true], ['blur', false]] as const) {
    link.addEventListener(type, () => decay.toggleAttribute('idle', idle));
  }
  return h('li', {}, link);
}

export function renderLauncher(root: ParentNode, cards: readonly CardData[]): void {
  const top = h(
    'header',
    { class: 'top' },
    h('span', { class: 'brand' }, svg(glyph('bone')), 'Ossuary'),
    h('div', { class: 'top-end' }, h('oss-mode-toggle'), h('a', { class: 'link', href: REPO_URL, ...newTab }, 'GitHub')),
  );
  const main = h(
    'main',
    { class: 'launcher' },
    h(
      'div',
      { class: 'intro' },
      h('h1', {}, h('span', {}, 'Everything expires.'), ' ', h('span', {}, 'Know when.')),
      h('p', { class: 'lede' }, 'One JSON bone spec turns any lifespan into a local-first countdown app. These two share every bone.'),
    ),
    h('div', { class: 'cta' }, h('a', { class: 'pill', href: REMIX_URL, ...newTab }, 'Make your own', svg(glyph('arrow')))),
    h('ul', { class: 'apps', 'aria-label': 'Apps' }, cards.map(appCard)),
  );
  root.append(top, main);
}
