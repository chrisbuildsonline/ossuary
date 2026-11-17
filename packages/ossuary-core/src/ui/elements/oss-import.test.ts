// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Store } from '../../store/repo';
import { now, widget } from '../../testing/ui-fixtures';
import { deepActiveElement } from '../a11y/focus-trap';
import type { OssField } from './oss-field';
import './oss-import';
import type { OssImport } from './oss-import';

afterEach(() => document.body.replaceChildren());

const q = (el: Element, sel: string) => el.shadowRoot?.querySelector(sel) ?? null;
const qa = (el: Element, sel: string) => Array.from(el.shadowRoot?.querySelectorAll(sel) ?? []);

const csv = 'name,kept in,made\nBlue widget,cold,2026-11-04\nRed widget,Cold,2026-11-01\nNo date widget,cold,\n';

function setup() {
  const store = {
    createMany: vi.fn(async (values: unknown[]) => ({ ok: true, value: { added: values.length, updated: 0, removed: 0 } })),
    importBackup: vi.fn(async () => ({ ok: true, value: { added: 1, updated: 0, removed: 0 } })),
    list: vi.fn(async () => ({ ok: true, value: [] })),
  } as unknown as Store;
  const el = document.createElement('oss-import') as OssImport;
  Object.assign(el, { spec: widget, now, store });
  const opener = document.createElement('button');
  document.body.append(opener, el);
  opener.focus();
  el.show();
  return { el, store, opener };
}

const paste = (el: OssImport, text: string) => {
  const area = q(el, 'textarea') as HTMLTextAreaElement;
  area.value = text;
  area.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('oss-import', () => {
  it('offers paste, upload and restore as a segmented source, in a modal with a step caption', () => {
    const { el } = setup();
    expect((q(el, 'dialog') as HTMLDialogElement).open).toBe(true);
    const source = q(el, 'oss-field') as OssField;
    expect(source.field?.kind === 'enum' && source.field.options.map((o) => o.label)).toEqual(['Paste CSV', 'Upload file', 'Restore backup']);
    expect(q(el, '.steps')?.textContent).toBe('1 of 3');
    expect(q(el, 'textarea')).toBeTruthy();
  });

  it('maps columns, previews rows with countdowns and skipped reasons, then imports on confirm', async () => {
    const { el, store, opener } = setup();
    paste(el, csv);
    const selects = qa(el, '.map select') as HTMLSelectElement[];
    expect(selects.map((s) => s.value)).toEqual(['name', 'place', 'made']);
    expect(qa(el, '.preview oss-item')).toHaveLength(2);
    const skipped = qa(el, '.preview .skipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.querySelector('oss-pill')?.getAttribute('tone')).toBe('urgent');
    expect(skipped[0]?.querySelector('oss-pill')?.getAttribute('label')).toBeTruthy();
    expect(q(el, '.summary')?.textContent).toBe('2 items ready, 1 skipped');
    const primary = q(el, '.foot oss-button[variant="primary"]') as HTMLElement;
    expect(primary.textContent).toBe('Import 2 items');
    expect(store.createMany).not.toHaveBeenCalled();
    const done = new Promise((resolve) => el.addEventListener('oss-imported', (e) => resolve((e as CustomEvent).detail)));
    primary.click();
    expect(await done).toEqual({ added: 2, updated: 0, removed: 0 });
    expect(store.createMany).toHaveBeenCalledTimes(1);
    expect((q(el, 'dialog') as HTMLDialogElement).open).toBe(false);
    expect(deepActiveElement()).toBe(opener);
  });

  it('re-previews when a mapping changes to ignore', () => {
    const { el } = setup();
    paste(el, csv);
    const made = (qa(el, '.map select') as HTMLSelectElement[])[2] as HTMLSelectElement;
    made.value = '';
    made.dispatchEvent(new Event('change', { bubbles: true }));
    expect(q(el, '.summary')?.textContent).toBe('0 items ready, 3 skipped');
    expect((q(el, '.foot oss-button[variant="primary"]') as HTMLElement).hasAttribute('disabled')).toBe(true);
  });

  it('restores a backup in merge mode', async () => {
    const { el, store } = setup();
    const source = q(el, 'oss-field') as OssField;
    source.dispatchEvent(new CustomEvent('oss-change', { detail: { key: 'source', value: 'backup' }, bubbles: true, composed: true }));
    const backup = JSON.stringify({
      format: 'ossuary-backup',
      version: 1,
      appId: 'widget-tracker',
      exportedAt: '2026-11-14T10:00:00.000Z',
      items: [{ id: 'a', values: { name: 'Blue widget', place: 'cold', made: '2026-11-04' }, createdAt: 'x', updatedAt: 'x' }],
    });
    paste(el, backup);
    await vi.waitFor(() => expect(q(el, '.summary')?.textContent).toBe('1 item in this backup: 1 new, 0 updated'));
    const primary = q(el, '.foot oss-button[variant="primary"]') as HTMLElement;
    expect(primary.textContent).toBe('Restore 1 item');
    primary.click();
    await vi.waitFor(() => expect(store.importBackup).toHaveBeenCalledWith(backup, 'merge'));
  });

  it('closes on Escape', () => {
    const { el } = setup();
    q(el, 'dialog')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect((q(el, 'dialog') as HTMLDialogElement).open).toBe(false);
  });
});
