// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Entry, entry, gizmo, gizmoEntry, now, widget, widgets } from '../../testing/ui-fixtures';
import { accessibleName } from '../countdown';
import './oss-item';
import './oss-list';
import type { OssItem } from './oss-item';
import type { OssList } from './oss-list';

afterEach(() => document.body.replaceChildren());

function item(e: Entry, variant: 'card' | 'row' = 'card', spec = widget): OssItem {
  const el = document.createElement('oss-item') as OssItem;
  el.setAttribute('variant', variant);
  Object.assign(el, { spec, now, values: e.values, evaluation: e.evaluation });
  document.body.append(el);
  return el;
}

const q = (el: Element, sel: string) => el.shadowRoot?.querySelector(sel) ?? null;
const qa = (el: Element, sel: string) => Array.from(el.shadowRoot?.querySelectorAll(sel) ?? []);

describe('oss-item card', () => {
  it('renders the primary countdown, pill, decay, title, short line and date', () => {
    const [blue] = widgets();
    const el = item(blue as Entry);
    expect(q(el, '.value')?.textContent).toBe('4');
    expect(q(el, '.unit')?.textContent).toBe('days');
    const pill = q(el, 'oss-pill');
    expect(pill?.getAttribute('label')).toBe('Soon');
    expect(pill?.getAttribute('tone')).toBe('soon');
    const decay = q(el, 'oss-decay');
    expect(decay?.getAttribute('motif')).toBe('candle');
    expect(decay?.getAttribute('tone')).toBe('soon');
    expect(decay?.getAttribute('size')).toBe('m');
    expect(q(el, '.title')?.textContent).toBe('Blue widget');
    expect(q(el, '.meta')?.textContent).toBe('Cold · No');
    const time = q(el, 'time');
    expect(time?.getAttribute('datetime')).toBe('2026-11-18');
    expect(time?.textContent).toBe('Wed 18 Nov');
  });

  it('is one link with one accessible name and hides the digits', () => {
    const [blue] = widgets() as [Entry];
    const el = item(blue);
    el.setAttribute('href', '#w1');
    const link = q(el, 'a');
    expect(link?.getAttribute('href')).toBe('#w1');
    expect(link?.getAttribute('aria-label')).toBe(accessibleName('Blue widget', blue.evaluation, now));
    expect(link?.getAttribute('aria-label')).toBe('Blue widget. Soon. Expires in 4 days, Wednesday 18 November.');
    expect(q(el, '.count')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('has no lifespan label and no extra countdown with one lifespan', () => {
    const el = item(widgets()[0] as Entry);
    expect(qa(el, '.other')).toHaveLength(0);
    expect(q(el, '.lifespan')).toBeNull();
  });

  it('shows dead items muted with "days ago"', () => {
    const el = item(widgets()[3] as Entry);
    expect(q(el, '.item')?.classList.contains('dead')).toBe(true);
    expect(q(el, '.value')?.textContent).toBe('11');
    expect(q(el, '.unit')?.textContent).toBe('days ago');
  });

  it('shows every lifespan in declared order, the primary large, with one pill only', () => {
    const card = item(gizmoEntry(), 'card', gizmo);
    expect(qa(card, 'oss-pill')).toHaveLength(1);
    expect(q(card, 'oss-pill')?.getAttribute('label')).toBe('Last days');
    expect(q(card, '.value')?.textContent).toBe('2');
    expect(q(card, '.lifespan')?.textContent).toBe('Return window');
    const others = qa(card, '.other');
    expect(others).toHaveLength(1);
    const other = others[0] as Element;
    expect(other.querySelector('.label')?.textContent).toBe('Cover');
    expect(other.querySelector('.when')?.textContent).toBe('23 mo');
    expect(other.querySelector('.stage')?.textContent).toBe('Covered');
    expect(other.querySelector('.stage svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(card, 'a')?.getAttribute('aria-label')).toBe(
      'Desk gizmo. Last days. Return window: expires in 2 days, Monday 16 November. Cover: expires in 23 months, Tuesday 17 October 2028.',
    );
  });
});

describe('oss-item row', () => {
  it('puts the decay small on the left, no pill, and the number over its unit', () => {
    const el = item(widgets()[1] as Entry, 'row');
    expect(q(el, '.item')?.classList.contains('row')).toBe(true);
    expect(q(el, 'oss-pill')).toBeNull();
    expect(q(el, 'oss-decay')?.getAttribute('size')).toBe('s');
    expect(q(el, '.value')?.textContent).toBe('1');
    expect(q(el, '.unit')?.textContent).toBe('day');
    expect(q(el, 'time')?.getAttribute('datetime')).toBe('2026-11-15');
  });
});

function list(entries: Entry[], layout: 'grid' | 'rows' = 'grid', spec = widget): OssList {
  const el = document.createElement('oss-list') as OssList;
  el.setAttribute('layout', layout);
  Object.assign(el, { spec, now, entries });
  document.body.append(el);
  return el;
}

describe('oss-list', () => {
  it('groups by primary tone in the order urgent, soon, steady, fresh, dead and hides empty groups', () => {
    const el = list(widgets());
    const groups = qa(el, 'section');
    expect(groups.map((g) => g.getAttribute('data-tone'))).toEqual(['urgent', 'soon', 'fresh', 'dead']);
    for (const g of groups) {
      const id = g.getAttribute('aria-labelledby') ?? '';
      expect(id).not.toBe('');
      expect(el.shadowRoot?.getElementById(id)?.tagName).toBe('H2');
    }
  });

  it('heads each group with a pill and an item count', () => {
    const el = list([...widgets(), entry(widget, 'w5', { name: 'Grey widget', place: 'cold', made: '2026-11-05' })]);
    const soon = q(el, 'section[data-tone="soon"]') as Element;
    expect(soon.querySelector('h2 oss-pill')?.getAttribute('label')).toBe('Soon');
    expect(soon.querySelector('.count')?.textContent).toBe('2 items');
    expect(q(el, 'section[data-tone="urgent"] .count')?.textContent).toBe('1 item');
    const names = Array.from(soon.querySelectorAll('oss-item')).map((i) => (i as OssItem).values?.name);
    expect(names).toEqual(['Blue widget', 'Grey widget']);
  });

  it('collapses the dead group behind a toggle', () => {
    const el = list(widgets());
    const dead = q(el, 'section[data-tone="dead"]') as Element;
    const toggle = dead.querySelector('button') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const body = dead.querySelector(`#${toggle.getAttribute('aria-controls')}`) as HTMLElement;
    expect(body.hidden).toBe(true);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(body.hidden).toBe(false);
  });

  it('renders a card grid or a surface card of rows', () => {
    const grid = list(widgets(), 'grid');
    expect(q(grid, 'section[data-tone="soon"] .grid oss-item')?.getAttribute('variant')).toBe('card');
    const rows = list(widgets(), 'rows');
    expect(q(rows, 'section[data-tone="soon"] .rows oss-item')?.getAttribute('variant')).toBe('row');
  });

  it('emits oss-open with the item id', () => {
    const el = list(widgets());
    const onOpen = vi.fn();
    el.addEventListener('oss-open', (e) => onOpen((e as CustomEvent).detail));
    const first = q(el, 'oss-item') as OssItem;
    (first.shadowRoot?.querySelector('a') as HTMLAnchorElement).click();
    expect(onOpen).toHaveBeenCalledWith({ id: 'w2' });
  });

  it('shows the empty state with the spec art, one line, one primary action and an import link', () => {
    const el = list([]);
    const empty = q(el, 'oss-empty') as HTMLElement;
    expect(empty).toBeTruthy();
    expect(q(empty, 'svg')?.getAttribute('data-art')).toBe('candle-jar-moon');
    expect(q(empty, 'h2')?.textContent).toBe('Nothing here yet.');
    const buttons = qa(empty, 'oss-button');
    expect(buttons.map((b) => b.getAttribute('variant'))).toEqual(['primary', 'link']);
    expect(buttons[0]?.textContent).toBe('Add widget');
    const events: string[] = [];
    for (const type of ['oss-add', 'oss-import-open']) el.addEventListener(type, () => events.push(type));
    for (const b of buttons) (b as HTMLElement).click();
    expect(events).toEqual(['oss-add', 'oss-import-open']);
  });

  it('shows an error state with one action, and a loading state', () => {
    const el = list(widgets());
    el.setAttribute('message', 'Storage is blocked.');
    el.setAttribute('state', 'error');
    const empty = q(el, 'oss-empty') as HTMLElement;
    expect(q(empty, 'p')?.textContent).toBe('Storage is blocked.');
    expect(qa(empty, 'oss-button').map((b) => b.textContent)).toEqual(['Try again']);
    el.setAttribute('state', 'loading');
    expect(q(el, '[aria-busy="true"]')).toBeTruthy();
    expect(q(el, '[role="status"]')?.textContent).toBe('Loading items');
  });

  it('groups a two-lifespan item by its primary lifespan', () => {
    const el = list([gizmoEntry()], 'grid', gizmo);
    expect(qa(el, 'section').map((g) => g.getAttribute('data-tone'))).toEqual(['urgent']);
  });
});
