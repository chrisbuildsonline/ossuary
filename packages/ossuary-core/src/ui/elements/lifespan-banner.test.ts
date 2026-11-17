// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Evaluation, LifespanEvaluation } from '../../engine/evaluate';
import { entry, gizmo, gizmoEntry, now } from '../../testing/ui-fixtures';
import { expirySentence, orderLifespans } from '../index';
import { OssBanner } from './oss-banner';
import type { OssLifespan } from './oss-lifespan';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const q = (el: Element, sel: string) => el.shadowRoot?.querySelector(sel) ?? null;
const qa = (el: Element, sel: string) => Array.from(el.shadowRoot?.querySelectorAll(sel) ?? []);

function media(desktop: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: desktop, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}

function card(l: LifespanEvaluation, attrs: Record<string, string> = {}): OssLifespan {
  const el = document.createElement('oss-lifespan') as OssLifespan;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  Object.assign(el, { lifespan: l, now, motif: 'ghost' });
  document.body.append(el);
  return el;
}

const live = () => gizmoEntry().evaluation.lifespans[0] as LifespanEvaluation;
const lapsed = () => entry(gizmo, 'g2', { name: 'Old gizmo', bought: '2026-09-01' }).evaluation.lifespans[0] as LifespanEvaluation;

describe('oss-lifespan', () => {
  it('is one labelled section with the expiry sentence for a live lifespan', () => {
    const el = card(live());
    const section = q(el, 'section');
    expect(section?.getAttribute('aria-label')).toBe('Return window: expires in 2 days, Monday 16 November.');
    expect(section?.getAttribute('aria-label')).toBe(`Return window: ${expirySentence(live(), now)}.`);
    expect(q(el, '.eyebrow')?.textContent).toBe('Return window');
  });

  it('says "expired N days ago" for a lapsed lifespan', () => {
    const el = card(lapsed());
    expect(q(el, 'section')?.getAttribute('aria-label')).toBe('Return window: expired 44 days ago, Thursday 1 October.');
  });

  it('hides the digits and the decay, and shows one pill and the date in a time element', () => {
    const el = card(live());
    expect(q(el, '.count')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.value')?.textContent).toBe('2');
    expect(q(el, '.unit')?.textContent).toBe('days');
    const decay = q(el, 'oss-decay');
    expect(decay?.getAttribute('aria-hidden')).toBe('true');
    expect(decay?.getAttribute('motif')).toBe('ghost');
    expect(decay?.getAttribute('tone')).toBe('urgent');
    expect(decay?.getAttribute('fraction')).toBe(String(live().fraction));
    const pills = qa(el, 'oss-pill');
    expect(pills).toHaveLength(1);
    expect(pills[0]?.getAttribute('label')).toBe('Last days');
    expect(pills[0]?.getAttribute('tone')).toBe('urgent');
    const time = q(el, 'time');
    expect(time?.getAttribute('datetime')).toBe('2026-11-16');
    expect(time?.textContent).toBe('Mon 16 Nov');
  });

  it('shows "days ago", the dead pill and the dead decay for a lapsed lifespan', () => {
    const el = card(lapsed());
    expect(q(el, '.value')?.textContent).toBe('44');
    expect(q(el, '.unit')?.textContent).toBe('days ago');
    expect(q(el, 'oss-pill')?.getAttribute('tone')).toBe('dead');
    expect(q(el, 'oss-pill')?.getAttribute('label')).toBe('Closed');
    expect(q(el, 'oss-decay')?.getAttribute('tone')).toBe('dead');
    expect(q(el, 'section')?.classList.contains('dead')).toBe(true);
  });

  it('uses no live region', () => {
    const el = card(live());
    expect(qa(el, '[aria-live], [role="status"], [role="alert"]')).toHaveLength(0);
    expect(el.getAttribute('aria-live')).toBeNull();
  });

  it('sizes the decay s on phones and m on desktop, and the size attribute wins', () => {
    media(false);
    expect(q(card(live()), 'oss-decay')?.getAttribute('size')).toBe('s');
    media(true);
    expect(q(card(live()), 'oss-decay')?.getAttribute('size')).toBe('m');
    media(false);
    expect(q(card(live(), { size: 'm' }), 'oss-decay')?.getAttribute('size')).toBe('m');
    media(true);
    expect(q(card(live(), { size: 's' }), 'oss-decay')?.getAttribute('size')).toBe('s');
  });

  it('renders nothing without a lifespan and keeps a default slot', () => {
    const empty = document.createElement('oss-lifespan');
    document.body.append(empty);
    expect(empty.shadowRoot?.childElementCount).toBe(0);
    expect(q(card(live()), 'slot:not([name])')).toBeTruthy();
  });
});

describe('orderLifespans', () => {
  const l = (id: string) => ({ lifespanId: id }) as LifespanEvaluation;
  const ids = (e: Evaluation) => orderLifespans(e).map((x) => x.lifespanId);

  it('puts the primary first and keeps the others in declared order', () => {
    expect(ids({ lifespans: [l('a'), l('b')], primaryIndex: 1 })).toEqual(['b', 'a']);
    expect(ids({ lifespans: [l('a'), l('b')], primaryIndex: 0 })).toEqual(['a', 'b']);
  });

  it('returns the one lifespan of a one-lifespan evaluation', () => {
    expect(ids({ lifespans: [l('a')], primaryIndex: 0 })).toEqual(['a']);
  });

  it('keeps declared order for three lifespans', () => {
    expect(ids({ lifespans: [l('a'), l('b'), l('c')], primaryIndex: 2 })).toEqual(['c', 'a', 'b']);
    expect(ids({ lifespans: [l('a'), l('b'), l('c')], primaryIndex: 1 })).toEqual(['b', 'a', 'c']);
  });

  it('does not change the evaluation', () => {
    const e = { lifespans: [l('a'), l('b')], primaryIndex: 1 };
    orderLifespans(e);
    expect(e.lifespans.map((x) => x.lifespanId)).toEqual(['a', 'b']);
  });
});

function banner(html: string): OssBanner {
  const box = document.createElement('div');
  box.innerHTML = html;
  document.body.append(box);
  return box.firstElementChild as OssBanner;
}

describe('oss-banner', () => {
  it('is a status region with the glyph, the heading, the text and the actions slot', () => {
    const el = banner('<oss-banner heading="Possible match" text="Item 12: Blue widget, loose part"><a slot="actions" href="#more">Read more</a></oss-banner>');
    const status = q(el, '[role="status"]');
    expect(status).toBeTruthy();
    expect(status?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.heading')?.textContent).toBe('Possible match');
    expect(q(el, '.text')?.textContent).toBe('Item 12: Blue widget, loose part');
    expect(q(el, '.actions slot[name="actions"]')).toBeTruthy();
  });

  it('defaults the tone to urgent and follows the tone attribute', () => {
    const el = banner('<oss-banner heading="Note" text="Some words"></oss-banner>');
    expect(q(el, '[role="status"]')?.classList.contains('tone-urgent')).toBe(true);
    el.setAttribute('tone', 'soon');
    expect(q(el, '[role="status"]')?.classList.contains('tone-soon')).toBe(true);
    el.setAttribute('tone', 'nope');
    expect(q(el, '[role="status"]')?.classList.contains('tone-urgent')).toBe(true);
  });

  it('sets heading and text as text, never markup', () => {
    const el = banner('<oss-banner></oss-banner>');
    el.heading = '<b>bold</b>';
    el.text = '<i>slanted</i>';
    expect(q(el, 'b')).toBeNull();
    expect(q(el, 'i')).toBeNull();
    expect(q(el, '.heading')?.textContent).toBe('<b>bold</b>');
    expect(q(el, '.text')?.textContent).toBe('<i>slanted</i>');
  });

  it('renders the line variant as one button row with the glyph and the text only, and emits oss-open', () => {
    const el = banner('<oss-banner variant="line" heading="Unused" text="1 possible match · Blue widget"><a slot="actions" href="#x">Read</a></oss-banner>');
    const buttons = qa(el, 'button');
    expect(buttons).toHaveLength(1);
    const line = buttons[0] as HTMLButtonElement;
    expect(line.classList.contains('line')).toBe(true);
    expect(line.textContent).toBe('1 possible match · Blue widget');
    expect(line.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.heading')).toBeNull();
    expect(q(el, 'slot')).toBeNull();
    const onOpen = vi.fn();
    el.addEventListener('oss-open', onOpen);
    line.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('styles a slotted link as a 44px underlined text link and keeps the line at 44px with an ellipsis', () => {
    const css = OssBanner.styles;
    expect(css).toMatch(/::slotted\(a\)\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/::slotted\(a\)\s*\{[^}]*text-decoration:\s*underline/);
    expect(css).toMatch(/\.line\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
    expect(css).toMatch(/border-radius:\s*var\(--r-md\)/);
  });
});
