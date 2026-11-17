// @vitest-environment happy-dom
import ICAL from 'ical.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Field } from '../../schema/fields';
import { gizmo, gizmoEntry, now, widget } from '../../testing/ui-fixtures';
import { downloadText, saveCalendar } from '../download';
import './oss-field';
import type { OssField } from './oss-field';
import './oss-shell';
import type { OssShell } from './oss-shell';
import './oss-toast';
import type { OssToast } from './oss-toast';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

const q = (el: Element, sel: string) => el.shadowRoot?.querySelector(sel) ?? null;
const qa = (el: Element, sel: string) => Array.from(el.shadowRoot?.querySelectorAll(sel) ?? []);
const fieldOf = (key: string): Field => widget.entity.fields.find((f) => f.key === key) as Field;

describe('oss-shell', () => {
  it('applies the theme on itself, renders the wordmark and a primary slot', () => {
    const el = document.createElement('oss-shell') as OssShell;
    el.spec = widget;
    document.body.append(el);
    expect(el.style.getPropertyValue('--accent')).toBe('#b8460e');
    expect(el.dataset.motif).toBe('candle');
    expect(q(el, '.wordmark')?.textContent).toBe('Widget Tracker');
    expect(q(el, '.brand svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(qa(el, 'slot[name="primary"]')).toHaveLength(1);
    expect(q(el, 'main slot:not([name])')).toBeTruthy();
  });

  it('has text navigation with the current item, bottom tabs, and emits oss-nav', () => {
    const el = document.createElement('oss-shell') as OssShell;
    el.setAttribute('current', 'items');
    el.spec = widget;
    document.body.append(el);
    const nav = qa(el, 'nav.top-nav button');
    expect(nav.map((b) => b.textContent)).toEqual(['Items', 'Import', 'Backup']);
    expect(nav[0]?.getAttribute('aria-current')).toBe('page');
    expect(qa(el, 'nav.bottom button')).toHaveLength(2);
    const seen: unknown[] = [];
    el.addEventListener('oss-nav', (e) => seen.push((e as CustomEvent).detail));
    (nav[2] as HTMLButtonElement).click();
    expect(seen).toEqual([{ target: 'backup' }]);
  });
});

function field(f: Field, value?: string | number, error?: string): OssField {
  const el = document.createElement('oss-field') as OssField;
  Object.assign(el, { field: f, value, error });
  document.body.append(el);
  return el;
}

describe('oss-field', () => {
  it('wires a text input to its label, required state and helper', () => {
    const el = field(fieldOf('name'), 'Blue');
    const input = q(el, 'input') as HTMLInputElement;
    expect(q(el, `label[for="${input.id}"]`)?.textContent).toBe('Name');
    expect(input.required).toBe(true);
    expect(input.value).toBe('Blue');
    const help = el.shadowRoot?.getElementById(input.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toBe('');
  });

  it('emits oss-change with typed values', () => {
    const el = field(fieldOf('count'));
    const seen: unknown[] = [];
    el.addEventListener('oss-change', (e) => seen.push((e as CustomEvent).detail));
    const input = q(el, 'input') as HTMLInputElement;
    expect(input.type).toBe('number');
    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    (q(el, 'button[aria-label="Increase Count"]') as HTMLButtonElement).click();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(seen).toEqual([
      { key: 'count', value: 3 },
      { key: 'count', value: 4 },
      { key: 'count', value: undefined },
    ]);
  });

  it('uses a native date input', () => {
    const el = field(fieldOf('made'), '2026-11-04');
    const input = q(el, 'input') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-11-04');
  });

  it('renders 4 or fewer options as a segmented radiogroup with arrow keys', () => {
    const el = field(fieldOf('place'), 'cold');
    const group = q(el, '[role="radiogroup"]') as HTMLElement;
    expect(el.shadowRoot?.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Kept in');
    const radios = qa(el, '[role="radio"]') as HTMLElement[];
    expect(radios.map((r) => r.textContent)).toEqual(['Cold', 'Deep cold', 'Shelf']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    const seen: unknown[] = [];
    el.addEventListener('oss-change', (e) => seen.push((e as CustomEvent).detail));
    radios[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const after = qa(el, '[role="radio"]') as HTMLElement[];
    expect(after.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(el.shadowRoot?.activeElement).toBe(after[1]);
    after[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    after[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(seen).toEqual([
      { key: 'place', value: 'deep_cold' },
      { key: 'place', value: 'cold' },
      { key: 'place', value: 'shelf' },
    ]);
  });

  it('renders more than 4 options as a native select', () => {
    const many: Field = { key: 'tint', kind: 'enum', label: 'Tint', options: ['a', 'b', 'c', 'd', 'e'].map((v) => ({ value: v, label: v.toUpperCase() })) };
    const el = field(many, 'c');
    const select = q(el, 'select') as HTMLSelectElement;
    expect(select.value).toBe('c');
    expect(Array.from(select.options, (o) => o.textContent)).toEqual(['Choose', 'A', 'B', 'C', 'D', 'E']);
  });

  it('shows an error with the alert glyph, marks the control invalid and describes it', () => {
    const el = field(fieldOf('made'), undefined, 'This is required.');
    const input = q(el, 'input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const help = el.shadowRoot?.getElementById(input.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toBe('Required.');
    expect(help?.classList.contains('error')).toBe(true);
    expect(help?.querySelector('svg')).toBeTruthy();
    el.focus();
    expect(el.shadowRoot?.activeElement).toBe(input);
  });
});

describe('oss-toast', () => {
  it('is a polite status region that shows, auto-dismisses at 5s and pauses on hover', () => {
    vi.useFakeTimers();
    const el = document.createElement('oss-toast') as OssToast;
    document.body.append(el);
    const region = q(el, '[role="status"]') as HTMLElement;
    expect(region.getAttribute('aria-live')).toBe('polite');
    el.show('Calendar file saved');
    expect(region.textContent).toContain('Calendar file saved');
    vi.advanceTimersByTime(4000);
    region.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(10_000);
    expect(region.textContent).toContain('Calendar file saved');
    region.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(5000);
    expect(region.textContent).toBe('');
  });

  it('offers undo and emits oss-undo', () => {
    const el = document.createElement('oss-toast') as OssToast;
    document.body.append(el);
    const undo = vi.fn();
    el.addEventListener('oss-undo', undo);
    el.show('Moved: +58 days', { undoLabel: 'Undo' });
    const button = q(el, 'button') as HTMLButtonElement;
    expect(button.textContent).toBe('Undo');
    button.click();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(q(el, '[role="status"]')?.textContent).toBe('');
  });
});

describe('downloads', () => {
  it('offers text as a file through a temporary link', () => {
    const clicks: { download: string; href: string }[] = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ download: this.download, href: this.href });
    });
    downloadText('a.txt', 'hello', 'text/plain');
    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.download).toBe('a.txt');
    spy.mockRestore();
  });

  it('saves a calendar with one event per lifespan and confirms with a toast', () => {
    const files: string[] = [];
    const toast = document.createElement('oss-toast') as OssToast;
    document.body.append(toast);
    const g = gizmoEntry();
    const result = saveCalendar(gizmo, [{ id: g.id, values: g.values }], now, toast, (name, text) => files.push(name, text));
    expect(files[0]).toBe('gizmo-keeper.ics');
    const events = new ICAL.Component(ICAL.parse(files[1] ?? '')).getAllSubcomponents('vevent');
    expect(events).toHaveLength(2);
    expect(result.skipped).toEqual([]);
    expect(q(toast, '[role="status"]')?.textContent).toContain('Calendar file saved');
  });
});
