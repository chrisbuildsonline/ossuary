// @vitest-environment happy-dom
// Requirement 4: one plain sentence per countdown with the digits hidden, and no live region around a countdown.
import { afterEach, describe, expect, it } from 'vitest';
import { gizmo, gizmoEntry, now, widget, widgets } from '../testing/ui-fixtures';
import type { Entry } from '../testing/ui-fixtures';
import './elements/oss-banner';
import './elements/oss-empty';
import './elements/oss-item';
import type { OssItem } from './elements/oss-item';
import './elements/oss-lifespan';
import type { OssLifespan } from './elements/oss-lifespan';
import './elements/oss-list';
import type { OssList } from './elements/oss-list';
import './elements/oss-shell';
import type { OssShell } from './elements/oss-shell';
import './elements/oss-toast';
import type { OssToast } from './elements/oss-toast';
import './elements/oss-trace';
import type { OssTrace } from './elements/oss-trace';
import { orderLifespans } from './lifespans';

afterEach(() => document.body.replaceChildren());

const q = (el: Element | null | undefined, sel: string) => el?.shadowRoot?.querySelector(sel) ?? null;
const add = <T extends Element>(el: T): T => {
  document.body.append(el);
  return el;
};

function item(e: Entry, variant: 'card' | 'row'): OssItem {
  const el = add(document.createElement('oss-item')) as OssItem;
  el.setAttribute('variant', variant);
  Object.assign(el, { spec: widget, now, values: e.values, evaluation: e.evaluation });
  return el;
}

/** Every live region in `root` and its open shadow roots, with the element that hosts it. */
export function liveRegions(root: Document | ShadowRoot): { host: string; el: Element }[] {
  const found: { host: string; el: Element }[] = [];
  root.querySelectorAll('*').forEach((e) => {
    if (e.matches('[aria-live], [role="status"], [role="alert"]')) found.push({ host: ((e.getRootNode() as ShadowRoot).host?.tagName ?? 'document').toLowerCase(), el: e });
    if (e.shadowRoot) found.push(...liveRegions(e.shadowRoot));
  });
  return found;
}

describe('countdown names', () => {
  it('names a card and a row with one sentence: title, stage, when, and hides the digits', () => {
    const [blue] = widgets() as [Entry];
    for (const variant of ['card', 'row'] as const) {
      const el = item(blue, variant);
      // Named from content: the one sentence, with every visible part hidden from screen readers.
      expect(q(el, 'a')?.hasAttribute('aria-label'), variant).toBe(false);
      expect(q(el, 'a > .said.sr-only')?.textContent, variant).toBe('Blue widget. Soon. Expires in 4 days, Wednesday 18 November.');
      expect(Array.from(q(el, 'a')?.children ?? []).filter((c) => !c.matches('.said, [aria-hidden="true"]')), variant).toEqual([]);
      expect(q(el, '.count')?.getAttribute('aria-hidden'), variant).toBe('true');
      expect(q(el, 'time')?.getAttribute('datetime'), variant).toBe('2026-11-18');
    }
  });

  it('names a dead item in the past tense', () => {
    const old = widgets()[3] as Entry;
    expect(q(item(old, 'card'), 'a .said')?.textContent).toBe('Old widget. Gone. Expired 11 days ago, Tuesday 3 November.');
  });

  it('names an item with two lifespans with one sentence per lifespan', () => {
    const g = gizmoEntry();
    const el = add(document.createElement('oss-item')) as OssItem;
    Object.assign(el, { spec: gizmo, now, values: g.values, evaluation: g.evaluation });
    expect(q(el, 'a .said')?.textContent).toBe(
      'Desk gizmo. Last days. Return window: expires in 2 days, Monday 16 November. Cover: expires in 23 months, Tuesday 17 October 2028.',
    );
  });

  it('names a lifespan card "Label: expires in N days, date." and hides the digits', () => {
    const [first] = orderLifespans(gizmoEntry().evaluation);
    const card = add(document.createElement('oss-lifespan')) as OssLifespan;
    Object.assign(card, { now, lifespan: first });
    expect(q(card, 'section')?.getAttribute('aria-label')).toBe('Return window: expires in 2 days, Monday 16 November.');
    expect(q(card, '.count')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('live regions', () => {
  it('has none inside any countdown: items, rows, lifespan cards, the list and the trace', () => {
    const list = add(document.createElement('oss-list')) as OssList;
    Object.assign(list, { spec: widget, now, entries: widgets() });
    const rows = add(document.createElement('oss-list')) as OssList;
    rows.setAttribute('layout', 'rows');
    Object.assign(rows, { spec: widget, now, entries: widgets() });
    for (const l of orderLifespans(gizmoEntry().evaluation)) Object.assign(add(document.createElement('oss-lifespan')) as OssLifespan, { now, lifespan: l });
    for (const mode of ['card', 'drawer']) {
      const trace = add(document.createElement('oss-trace')) as OssTrace;
      trace.setAttribute('mode', mode);
      Object.assign(trace, { now, evaluation: gizmoEntry().evaluation });
    }
    expect(document.querySelectorAll('oss-list, oss-lifespan, oss-trace').length).toBe(6);
    expect(liveRegions(document).map((r) => r.host)).toEqual([]);
  });

  it('keeps a polite status only on the toast, the loading placeholder and the banner, with no date or countdown inside', () => {
    const shell = add(document.createElement('oss-shell')) as OssShell;
    shell.spec = widget;
    const loading = add(document.createElement('oss-list')) as OssList;
    loading.setAttribute('state', 'loading');
    const empty = add(document.createElement('oss-list')) as OssList;
    empty.spec = widget;
    const banner = add(document.createElement('oss-banner'));
    banner.setAttribute('heading', 'Possible match');
    const line = add(document.createElement('oss-banner'));
    line.setAttribute('variant', 'line');
    line.setAttribute('text', '1 possible match');
    const toast = add(document.createElement('oss-toast')) as OssToast;
    toast.show('Moved: +58 days', { undoLabel: 'Undo' });

    const regions = liveRegions(document);
    expect(regions.map((r) => r.host).sort()).toEqual(['oss-banner', 'oss-banner', 'oss-list', 'oss-toast']);
    for (const { host, el } of regions) {
      expect(el.getAttribute('role'), host).toBe('status');
      expect(el.getAttribute('aria-live'), host).toBe('polite');
      expect(el.querySelector('time, .count, .value'), host).toBeNull();
    }
    toast.hide();
  });
});
