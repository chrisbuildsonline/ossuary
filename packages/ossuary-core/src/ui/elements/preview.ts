// Countdown lines shared by the sheet preview and the import preview.
import type { LifespanEvaluation, Now } from '../../engine/evaluate';
import { formatCountdown, shortDay } from '../countdown';
import { toneGlyph } from '../glyphs';
import { h, svg } from './base';

/** "Expires in 4 days · Fri 20 Nov" (with "Label: expires ..." when there are several lifespans). */
export function expiresLine(l: LifespanEvaluation, now: Now, several: boolean): string {
  const c = formatCountdown(l, now);
  const verb = l.remaining.days < 0 ? `expired ${c.spoken}` : c.spoken === 'today' ? 'expires today' : `expires in ${c.spoken}`;
  const text = several ? `${l.label}: ${verb}` : verb.charAt(0).toUpperCase() + verb.slice(1);
  return `${text} · ${shortDay(l.expiresAt, now)}`;
}

/** A compact line for a non-primary lifespan: label, countdown, glyph and stage word. */
export function otherLine(l: LifespanEvaluation, now: Now): HTMLLIElement {
  return h(
    'li',
    { class: `other tone-${l.stage.tone}` },
    h('span', { class: 'label' }, l.label),
    h('span', { class: 'when' }, formatCountdown(l, now).text),
    h('span', { class: 'stage' }, svg(toneGlyph(l.stage.tone)), h('span', {}, l.stage.label)),
  );
}

export const otherCss = `
.others { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-1); }
.other { display: flex; align-items: center; gap: var(--s-2); font: var(--t-caption); color: var(--text-2); min-width: 0; }
.other .label { color: var(--text); font-weight: 600; }
.other .when { font-variant-numeric: tabular-nums; }
.stage { display: inline-flex; align-items: center; gap: 4px; color: var(--tone-fg); font-weight: 600; margin-left: auto; }
.stage svg { width: 14px; height: 14px; }
`;
