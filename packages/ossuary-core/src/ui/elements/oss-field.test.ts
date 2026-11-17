// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import type { Field } from '../../schema/fields';
import { now, widget } from '../../testing/ui-fixtures';
import './oss-field';
import type { OssField } from './oss-field';
import './oss-import';
import type { OssImport } from './oss-import';
import './oss-sheet';
import type { OssSheet } from './oss-sheet';

afterEach(() => document.body.replaceChildren());

const text = (el: Element) => el.shadowRoot?.textContent ?? '';
const helpOf = (el: OssField) => el.shadowRoot?.querySelector('.help');
const fieldOf = (key: string): Field => widget.entity.fields.find((f) => f.key === key) as Field;

function field(f: Field, value?: string | number): OssField {
  const el = document.createElement('oss-field') as OssField;
  Object.assign(el, { field: f, value });
  document.body.append(el);
  return el;
}

const type = (el: OssField, value: string) => {
  const input = el.shadowRoot?.querySelector('input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};

describe('oss-field required state', () => {
  it('shows no "Required." on render, empty or filled', () => {
    const ranged: Field = { key: 'n', kind: 'number', label: 'N', required: true, min: 1, max: 9 };
    for (const el of [field(fieldOf('name')), field(fieldOf('place'), 'cold'), field(fieldOf('made'), '2026-11-04'), field(ranged)]) {
      expect(text(el)).not.toMatch(/required/i);
    }
  });

  it('shows "Required." as an error after an invalid save, and clears it once the field has a value', () => {
    const sheet = document.createElement('oss-sheet') as OssSheet;
    Object.assign(sheet, { spec: widget, now });
    document.body.append(sheet);
    sheet.show({ place: 'cold' });
    const fields = Array.from(sheet.shadowRoot?.querySelectorAll('oss-field') ?? []) as OssField[];
    const [name, place, made] = fields as [OssField, OssField, OssField];
    expect(fields.some((f) => /required/i.test(text(f)))).toBe(false);

    sheet.save();
    expect(helpOf(name)?.textContent).toBe('Required.');
    expect(helpOf(name)?.classList.contains('error')).toBe(true);
    expect(helpOf(made)?.textContent).toBe('Required.');
    expect(text(place)).not.toMatch(/required/i);

    type(name, 'Blue widget');
    expect(text(name)).not.toMatch(/required/i);
    expect(name.shadowRoot?.querySelector('input')?.hasAttribute('aria-invalid')).toBe(false);
  });

  it('clears its own error once the user gives it a value', () => {
    const el = field(fieldOf('name'));
    el.error = 'This is required.';
    expect(helpOf(el)?.textContent).toBe('Required.');
    type(el, 'Blue');
    expect(el.error).toBeUndefined();
    expect(text(el)).not.toMatch(/required/i);
  });

  it('shows no "Required." in the import dialog on open', () => {
    const el = document.createElement('oss-import') as OssImport;
    Object.assign(el, { spec: widget, now });
    document.body.append(el);
    el.show();
    const source = el.shadowRoot?.querySelector('oss-field') as OssField;
    expect(text(el) + text(source)).not.toMatch(/required/i);
  });
});
