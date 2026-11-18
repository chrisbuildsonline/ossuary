// @vitest-environment happy-dom
// Requirement 2.6: no status is colour only. Every pill, stage line and group header shows the stage word and its glyph.
import { afterEach, describe, expect, it } from 'vitest';
import { tones } from '../../schema/stages';
import { gizmo, gizmoEntry, now, widget, widgets } from '../../testing/ui-fixtures';
import type { Entry } from '../../testing/ui-fixtures';
import { orderLifespans } from '../lifespans';
import './oss-banner';
import './oss-item';
import type { OssItem } from './oss-item';
import './oss-lifespan';
import type { OssLifespan } from './oss-lifespan';
import './oss-list';
import type { OssList } from './oss-list';
import './oss-pill';

afterEach(() => document.body.replaceChildren());

const q = (el: Element | null | undefined, sel: string) => el?.shadowRoot?.querySelector(sel) ?? null;
const qa = (el: Element | null | undefined, sel: string) => Array.from(el?.shadowRoot?.querySelectorAll(sel) ?? []);
const add = <T extends Element>(el: T): T => {
  document.body.append(el);
  return el;
};

/** The visible word and the glyph a pill renders. */
function pillParts(pill: Element | null) {
  const svg = q(pill, '.pill svg');
  return { word: q(pill, '.pill > span')?.textContent ?? '', glyph: svg?.outerHTML ?? '', hidden: svg?.getAttribute('aria-hidden') };
}

describe('status is a word and a glyph, never colour only', () => {
  it('gives every tone pill its word and its own glyph, hidden from screen readers', () => {
    const glyphs = new Set<string>();
    for (const tone of tones) {
      const pill = add(document.createElement('oss-pill'));
      pill.setAttribute('tone', tone);
      pill.setAttribute('label', `Word ${tone}`);
      const parts = pillParts(pill);
      expect(parts.word, tone).toBe(`Word ${tone}`);
      expect(parts.glyph, tone).toContain('<svg');
      expect(parts.hidden, tone).toBe('true');
      glyphs.add(parts.glyph);
    }
    expect(glyphs.size).toBe(tones.length);
  });

  it('puts a pill with the stage word and glyph on every item card', () => {
    for (const e of widgets()) {
      const card = add(document.createElement('oss-item')) as OssItem;
      card.setAttribute('variant', 'card');
      Object.assign(card, { spec: widget, now, values: e.values, evaluation: e.evaluation });
      const stage = e.evaluation.lifespans[e.evaluation.primaryIndex]?.stage;
      const parts = pillParts(q(card, 'oss-pill'));
      expect(parts.word).toBe(stage?.label);
      expect(parts.glyph).toContain('<svg');
    }
  });

  it('gives each other lifespan line on a card and a row its glyph and stage word', () => {
    const g = gizmoEntry();
    for (const variant of ['card', 'row']) {
      const el = add(document.createElement('oss-item')) as OssItem;
      el.setAttribute('variant', variant);
      Object.assign(el, { spec: gizmo, now, values: g.values, evaluation: g.evaluation });
      const lines = qa(el, '.other .stage');
      expect(lines.length, variant).toBe(1);
      for (const line of lines) {
        expect(line.querySelector('svg'), variant).not.toBeNull();
        expect(line.textContent?.trim(), variant).toBe('Covered');
      }
    }
  });

  it('heads every group of rows with a pill (word and glyph), so a row needs no pill of its own', () => {
    const list = add(document.createElement('oss-list')) as OssList;
    list.setAttribute('layout', 'rows');
    Object.assign(list, { spec: widget, now, entries: widgets() });
    const groups = qa(list, 'section');
    expect(groups.length).toBe(4);
    for (const group of groups) {
      const parts = pillParts(group.querySelector('h2 oss-pill'));
      const rowStages = Array.from(group.querySelectorAll('oss-item')).map((i) => {
        const e = (i as OssItem).evaluation as Entry['evaluation'];
        return e.lifespans[e.primaryIndex]?.stage.label;
      });
      expect(parts.word).toBeTruthy();
      expect(parts.glyph).toContain('<svg');
      expect(new Set(rowStages)).toEqual(new Set([parts.word]));
    }
  });

  it('puts a pill with the stage word and glyph on every lifespan card', () => {
    for (const l of orderLifespans(gizmoEntry().evaluation)) {
      const card = add(document.createElement('oss-lifespan')) as OssLifespan;
      Object.assign(card, { now, lifespan: l });
      const parts = pillParts(q(card, 'oss-pill'));
      expect(parts.word).toBe(l.stage.label);
      expect(parts.glyph).toContain('<svg');
    }
  });

  it('gives a banner its glyph and a heading or text in words', () => {
    const block = add(document.createElement('oss-banner'));
    block.setAttribute('heading', 'Possible match');
    block.setAttribute('text', 'Item 12');
    expect(q(block, '.glyph svg')).not.toBeNull();
    expect(q(block, '.heading')?.textContent).toBe('Possible match');
    const line = add(document.createElement('oss-banner'));
    line.setAttribute('variant', 'line');
    line.setAttribute('text', '1 possible match');
    expect(q(line, '.line svg')).not.toBeNull();
    expect(q(line, '.line .label')?.textContent).toBe('1 possible match');
  });
});
