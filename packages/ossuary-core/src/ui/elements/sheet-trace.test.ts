// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBoneSpec } from '../../schema/bone-spec';
import { copyOf, gizmoSpec, widgetSpec } from '../../testing/fixtures';
import { gizmo, gizmoEntry, now, widget, widgets } from '../../testing/ui-fixtures';
import type { Entry } from '../../testing/ui-fixtures';
import { deepActiveElement } from '../a11y/focus-trap';
import type { OssField } from './oss-field';
import './oss-sheet';
import type { OssSheet } from './oss-sheet';
import './oss-trace';
import type { OssTrace } from './oss-trace';

afterEach(() => document.body.replaceChildren());

const q = (el: Element, sel: string) => el.shadowRoot?.querySelector(sel) ?? null;
const qa = (el: Element, sel: string) => Array.from(el.shadowRoot?.querySelectorAll(sel) ?? []);
const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));

function sheet(spec = widget): { el: OssSheet; opener: HTMLButtonElement } {
  const opener = document.createElement('button');
  const el = document.createElement('oss-sheet') as OssSheet;
  Object.assign(el, { spec, now });
  document.body.append(opener, el);
  opener.focus();
  return { el, opener };
}

const type = (f: OssField, value: string) => {
  const input = f.shadowRoot?.querySelector('input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};

describe('oss-sheet', () => {
  it('generates one field per spec field and moves focus into the dialog', () => {
    const { el } = sheet();
    el.show();
    expect((q(el, 'dialog') as HTMLDialogElement).open).toBe(true);
    const fields = qa(el, 'oss-field') as OssField[];
    expect(fields.map((f) => f.field?.key)).toEqual(['name', 'place', 'made', 'opened', 'count']);
    expect(q(el, 'h2')?.textContent).toBe('Add widget');
    expect(deepActiveElement()).toBe(fields[0]?.shadowRoot?.querySelector('input'));
  });

  it('re-runs the engine and updates the live preview on every change', () => {
    const { el } = sheet();
    el.show({ place: 'cold' });
    expect(q(el, '.expires')?.textContent).toBe('Fill in the required fields to see the date.');
    const fields = qa(el, 'oss-field') as OssField[];
    type(fields[0] as OssField, 'Blue widget');
    type(fields[2] as OssField, '2026-11-04');
    expect(q(el, '.expires')?.textContent).toBe('Expires in 4 days · Wed 18 Nov');
    expect(q(el, '.preview oss-pill')?.getAttribute('label')).toBe('Soon');
    expect(q(el, '.preview oss-decay')?.getAttribute('tone')).toBe('soon');
    expect(q(el, '.source')?.textContent).toBe('Based on Example reference');
  });

  it('shows the other lifespans in the preview', () => {
    const { el } = sheet(gizmo);
    el.show(gizmoEntry().values);
    expect(q(el, '.expires')?.textContent).toBe('Return window: expires in 2 days · Mon 16 Nov');
    expect(qa(el, '.preview .other').map((o) => o.textContent)).toEqual(['Cover23 moCovered']);
  });

  it('moves the preview date when the number field behind amountField changes', () => {
    const spec = copyOf(gizmoSpec);
    Object.assign(spec.lifespans[0]?.base ?? {}, { amountField: 'price' });
    const r = parseBoneSpec(spec);
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    const { el } = sheet(r.value);
    el.show(gizmoEntry().values);
    expect(q(el, '.expires')?.textContent).toBe('Return window: expires in 2 days · Mon 16 Nov');
    const price = (qa(el, 'oss-field') as OssField[]).find((f) => f.field?.key === 'price') as OssField;
    type(price, '40');
    expect(q(el, '.expires')?.textContent).toBe('Return window: expires in 12 days · Thu 26 Nov');
  });

  it('keeps the sheet open on an invalid save, shows errors and focuses the first invalid field', () => {
    const { el } = sheet();
    const save = vi.fn();
    el.addEventListener('oss-save', save);
    el.show({ place: 'cold' });
    (q(el, 'oss-button[variant="primary"]') as HTMLElement).click();
    expect(save).not.toHaveBeenCalled();
    expect((q(el, 'dialog') as HTMLDialogElement).open).toBe(true);
    const fields = qa(el, 'oss-field') as OssField[];
    expect(fields.filter((f) => f.error).map((f) => f.field?.key)).toEqual(['name', 'made']);
    expect(deepActiveElement()).toBe(fields[0]?.shadowRoot?.querySelector('input'));
  });

  it('saves valid values, closes and returns focus; Escape cancels', () => {
    const { el, opener } = sheet();
    const saved: unknown[] = [];
    el.addEventListener('oss-save', (e) => saved.push((e as CustomEvent).detail));
    const entry = widgets()[0] as Entry;
    el.show(entry.values, entry.id);
    expect(q(el, 'h2')?.textContent).toBe('Edit item');
    (q(el, 'oss-button[variant="primary"]') as HTMLElement).click();
    expect(saved).toEqual([{ id: 'w1', values: entry.values }]);
    expect((q(el, 'dialog') as HTMLDialogElement).open).toBe(false);
    expect(document.activeElement).toBe(opener);

    const cancel = vi.fn();
    el.addEventListener('oss-cancel', cancel);
    el.show();
    key(q(el, 'dialog') as Element, 'Escape');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect((q(el, 'dialog') as HTMLDialogElement).open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});

describe('oss-sheet hidden fields', () => {
  const withRef = (() => {
    const spec = copyOf(widgetSpec);
    spec.entity.fields.splice(1, 0, { key: 'ref', kind: 'text', label: 'Ref', required: true, hidden: true } as (typeof spec.entity.fields)[number]);
    const r = parseBoneSpec(spec);
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    return r.value;
  })();
  const saves = (el: OssSheet) => {
    const saved: unknown[] = [];
    el.addEventListener('oss-save', (e) => saved.push((e as CustomEvent).detail));
    return saved;
  };

  it('renders no input for a hidden field and saves its prefilled value', () => {
    const { el } = sheet(withRef);
    const saved = saves(el);
    el.show({ ref: 'r-7', place: 'cold' });
    expect((qa(el, 'oss-field') as OssField[]).map((f) => f.field?.key)).toEqual(['name', 'place', 'made', 'opened', 'count']);
    expect(el.shadowRoot?.textContent).not.toContain('Ref');
    const fields = qa(el, 'oss-field') as OssField[];
    type(fields[0] as OssField, 'Blue widget');
    type(fields[2] as OssField, '2026-11-04');
    (q(el, 'oss-button[variant="primary"]') as HTMLElement).click();
    expect(saved).toEqual([{ values: { ref: 'r-7', place: 'cold', name: 'Blue widget', made: '2026-11-04' } }]);
  });

  it('keeps the hidden value of an edited item on save', () => {
    const { el } = sheet(withRef);
    const saved = saves(el);
    el.show({ name: 'Blue widget', ref: 'r-9', place: 'cold', made: '2026-11-04' }, 'w1');
    type((qa(el, 'oss-field') as OssField[])[0] as OssField, 'Renamed widget');
    (q(el, 'oss-button[variant="primary"]') as HTMLElement).click();
    expect(saved).toEqual([{ id: 'w1', values: { name: 'Renamed widget', ref: 'r-9', place: 'cold', made: '2026-11-04' } }]);
  });
});

function trace(e: Entry, mode: 'card' | 'drawer' = 'card'): OssTrace {
  const el = document.createElement('oss-trace') as OssTrace;
  el.setAttribute('mode', mode);
  Object.assign(el, { now, evaluation: e.evaluation });
  document.body.append(el);
  return el;
}

describe('oss-trace', () => {
  it('lists one line per trace entry with signed deltas and a total', () => {
    const el = trace(widgets()[0] as Entry);
    expect(qa(el, 'ol')).toHaveLength(1);
    expect(q(el, 'h3')).toBeNull();
    const lines = qa(el, 'ol li');
    expect(lines.map((l) => l.querySelector('.delta')?.textContent)).toEqual(['14 days', 'no change', 'no change']);
    expect(lines[0]?.querySelector('.text')?.textContent).toBe('Base: Base 14 days (Example reference)');
    expect(q(el, '.total')?.textContent).toBe('Expires Wed 18 Nov= 14 days');
    expect(q(el, '.eyebrow')?.textContent).toBe('Why this date');
  });

  it('heads one list per lifespan in declared order and marks the primary', () => {
    const e = gizmoEntry();
    const el = trace(e);
    expect(qa(el, 'ol')).toHaveLength(2);
    expect(qa(el, 'h3').map((h) => h.textContent)).toEqual(['Return window · Primary', 'Cover']);
    expect(q(el, '.eyebrow')?.textContent).toBe('Why these dates');
  });

  it('opens as a drawer from a link, closes on Escape and returns focus', () => {
    const el = trace(gizmoEntry(), 'drawer');
    const closed = vi.fn();
    el.addEventListener('oss-close', closed);
    const link = q(el, 'button.open') as HTMLButtonElement;
    expect(link.textContent).toBe('Why these dates?');
    link.focus();
    link.click();
    const dialog = q(el, 'dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelectorAll('ol')).toHaveLength(2);
    key(dialog, 'Escape');
    expect(dialog.open).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(deepActiveElement()).toBe(link);
  });
});
