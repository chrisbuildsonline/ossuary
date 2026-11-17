// <oss-import>: paste CSV, upload a file or restore a backup; map columns, preview five rows, confirm. Emits oss-imported.
import { type Now, evaluate } from '../../engine/evaluate';
import type { BoneSpec } from '../../schema/bone-spec';
import type { Field } from '../../schema/fields';
import { parseBackup } from '../../store/backup';
import { parseCsv } from '../../store/csv';
import { type CsvPreview, type Mapping, commitCsvImport, previewCsvImport, suggestMapping } from '../../store/csv-import';
import type { Store } from '../../store/repo';
import { glyph } from '../glyphs';
import { OssElement, define, h, isDesktop, nextId, svg } from './base';
import { dialogCss, openModal } from './dialog';
import './oss-button';
import './oss-field';
import { fieldCss } from './oss-field';
import './oss-item';
import './oss-pill';

type Source = 'paste' | 'upload' | 'backup';
const sourceField: Field = {
  key: 'source',
  kind: 'enum',
  label: 'Source',
  required: true,
  options: [
    { value: 'paste', label: 'Paste CSV' },
    { value: 'upload', label: 'Upload file' },
    { value: 'backup', label: 'Restore backup' },
  ],
};
const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

export class OssImport extends OssElement {
  static override styles = `
:host { display: contents; }
${dialogCss}
${fieldCss.replace(':host { display: block; }', '')}
.steps { font: var(--t-caption); color: var(--text-3); display: none; }
.head-text { display: grid; }
section { display: grid; gap: var(--s-3); margin-bottom: var(--s-6); }
h3 { margin: 0; font: var(--t-eyebrow); letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
textarea {
  width: 100%; height: 200px; padding: var(--s-3) 14px; border: 1px solid var(--line-strong); border-radius: var(--r-sm);
  background: var(--surface-sunken); font: var(--t-body); color: var(--text); resize: vertical;
}
textarea:focus { background: var(--surface); }
textarea:focus-visible { outline: var(--focus); outline-offset: 2px; }
.drop {
  display: grid; place-items: center; align-content: center; gap: var(--s-2); height: 160px; border: 2px dashed var(--line-strong);
  border-radius: var(--r-lg); color: var(--text-2); font: var(--t-label); cursor: pointer; text-align: center;
}
.drop:focus-within { outline: var(--focus); outline-offset: 2px; }
.drop.over { background: var(--accent-tint); }
.map { display: grid; gap: var(--s-2); }
.map label { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.4fr); align-items: center; gap: var(--s-3); font: var(--t-label); }
.map .col { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview { display: grid; background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1); overflow: hidden; }
.skipped { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); min-height: 76px; padding: var(--s-3) var(--s-4); font: var(--t-label); color: var(--text-2); }
.summary { margin: 0; font: var(--t-heading); }
.foot .back { margin-right: auto; }
@media (min-width: 900px) { .back { display: none; } }
@media (max-width: 899px) {
  .steps { display: block; }
  section[data-step]:not([data-step="current"]) { display: none; }
}
`;

  #spec?: BoneSpec;
  #store?: Store;
  #now: Now = { day: '1970-01-01' };
  #release: (() => void) | undefined;
  #source: Source = 'paste';
  #step = 1;
  #text = '';
  #rows: string[][] = [];
  #mapping: Mapping = {};
  #preview: CsvPreview | undefined;
  #backup: { count: number; added: number; updated: number } | undefined;
  #problem = '';

  get spec() {
    return this.#spec;
  }
  set spec(v: BoneSpec | undefined) {
    this.#spec = v;
  }
  get store() {
    return this.#store;
  }
  set store(v: Store | undefined) {
    this.#store = v;
  }
  get now() {
    return this.#now;
  }
  set now(v: Now) {
    this.#now = v;
  }
  get open(): boolean {
    return this.#release !== undefined;
  }

  protected render(): void {
    // Content is built on show().
  }

  show(): void {
    if (!this.#spec) return;
    this.#release?.();
    this.#source = 'paste';
    this.#step = 1;
    this.#text = '';
    this.#reset();
    const titleId = nextId('import');
    const close = h('oss-button', { variant: 'icon', icon: 'close', label: 'Close' });
    close.addEventListener('click', () => this.close());
    const dialog = h(
      'dialog',
      { class: 'center', 'aria-labelledby': titleId },
      h('div', { class: 'head' }, h('div', { class: 'head-text' }, h('h2', { id: titleId }, 'Import'), h('span', { class: 'steps' })), close),
      h('div', { class: 'scroll' }),
      h('div', { class: 'foot' }),
    );
    dialog.addEventListener('oss-change', (e) => {
      const d = (e as CustomEvent<{ key: string; value: string }>).detail;
      if (d.key !== 'source') return;
      this.#source = d.value as Source;
      this.#text = '';
      this.#reset();
      this.#draw();
    });
    this.root.replaceChildren(dialog);
    this.#draw();
    this.#release = openModal(dialog, () => this.close(), this.root.querySelector('oss-field') as HTMLElement | null);
  }

  close(): void {
    const release = this.#release;
    this.#release = undefined;
    release?.();
  }

  #reset(): void {
    this.#rows = [];
    this.#mapping = {};
    this.#preview = undefined;
    this.#backup = undefined;
    this.#problem = '';
  }

  #ready(): number {
    return this.#source === 'backup' ? (this.#backup?.count ?? 0) : (this.#preview?.valid.length ?? 0);
  }

  /** Rebuilds the dialog body and footer from state. Keeps the source and text controls when only results change. */
  #draw(keepSource = false): void {
    const scroll = this.root.querySelector('.scroll');
    const foot = this.root.querySelector('.foot');
    if (!scroll || !foot) return;
    const step = (n: number, ...children: (Node | null)[]) => h('section', { 'data-step': n === this.#step ? 'current' : String(n) }, children);
    const first = keepSource ? scroll.firstElementChild : this.#sourceStep(step);
    const csv = this.#source !== 'backup';
    const has = csv ? this.#preview !== undefined : this.#backup !== undefined;
    const sections = [
      first,
      csv && has ? step(2, h('h3', {}, 'Map columns'), this.#mapRows(), h('h3', {}, 'Preview'), this.#previewRows()) : null,
      has || this.#problem
        ? step(
            3,
            h(
              'p',
              { class: 'summary' },
              this.#problem ||
                (csv
                  ? `${items(this.#preview?.valid.length ?? 0)} ready, ${this.#preview?.skipped.length ?? 0} skipped`
                  : `${items(this.#backup?.count ?? 0)} in this backup: ${this.#backup?.added ?? 0} new, ${this.#backup?.updated ?? 0} updated`),
            ),
          )
        : null,
    ];
    if (first) first.setAttribute('data-step', this.#step === 1 ? 'current' : '1');
    scroll.replaceChildren(...sections.filter((s): s is Element => s !== null));
    (this.root.querySelector('.steps') as HTMLElement).textContent = `${this.#step} of 3`;

    const n = this.#ready();
    const last = isDesktop() || this.#step === 3 || (!csv && this.#step === 2);
    const label = last ? (csv ? `Import ${items(n)}` : `Restore ${items(n)}`) : 'Next';
    const primary = h('oss-button', { variant: 'primary', disabled: last ? n === 0 : !has }, label);
    primary.addEventListener('click', () => (last ? void this.#commit() : this.#go(this.#step + 1)));
    const back = this.#step > 1 ? h('oss-button', { variant: 'ghost', class: 'back' }, 'Back') : null;
    back?.addEventListener('click', () => this.#go(this.#step - 1));
    foot.replaceChildren(...(back ? [back, primary] : [primary]));
  }

  #go(step: number): void {
    const csv = this.#source !== 'backup';
    this.#step = Math.min(Math.max(step, 1), 3);
    if (!csv && this.#step === 2) this.#step = step > 2 ? 3 : step;
    this.#draw(true);
    (this.root.querySelector('section[data-step="current"] select, section[data-step="current"] textarea, .foot oss-button[variant="primary"]') as HTMLElement | null)?.focus();
  }

  #sourceStep(step: (n: number, ...c: (Node | null)[]) => HTMLElement): HTMLElement {
    const source = h('oss-field');
    Object.assign(source, { field: sourceField, value: this.#source });
    const id = nextId('import-text');
    let input: HTMLElement;
    if (this.#source === 'upload') {
      const file = h('input', { type: 'file', accept: '.csv,.json,text/csv,application/json', class: 'sr-only', id });
      file.addEventListener('change', () => void this.#readFile(file.files?.[0]));
      const drop = h('label', { class: 'drop', for: id }, svg(glyph('upload')), 'Drop a .csv or .json', file);
      drop.addEventListener('dragover', (e) => {
        e.preventDefault();
        drop.classList.add('over');
      });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('over');
        void this.#readFile(e.dataTransfer?.files[0]);
      });
      input = drop;
    } else {
      const area = h('textarea', { id, spellcheck: 'false' });
      area.value = this.#text;
      area.addEventListener('input', () => this.#read(area.value));
      input = h('div', { class: 'field' }, h('label', { for: id }, this.#source === 'backup' ? 'Backup file contents' : 'CSV with a header row'), area);
    }
    return step(1, source, input);
  }

  async #readFile(file: File | undefined): Promise<void> {
    if (!file) return;
    const text = await file.text();
    if (file.name.endsWith('.json')) this.#source = 'backup';
    this.#read(text);
  }

  #read(text: string): void {
    const spec = this.#spec;
    if (!spec) return;
    this.#text = text;
    this.#reset();
    if (text.trim() === '') return this.#draw(true);
    if (this.#source === 'backup') {
      const r = parseBackup(spec, text);
      if (!r.ok) {
        this.#problem = r.error.code === 'invalid' ? (r.error.issues[0]?.message ?? 'This backup cannot be read.') : 'This backup cannot be read.';
        return this.#draw(true);
      }
      const incoming = r.value.items;
      this.#backup = { count: incoming.length, added: incoming.length, updated: 0 };
      this.#draw(true);
      void this.#store?.list().then((existing) => {
        if (!existing.ok || !this.#backup) return;
        const ids = new Set(existing.value.map((i) => i.id));
        const updated = incoming.filter((i) => ids.has(i.id)).length;
        this.#backup = { count: incoming.length, added: incoming.length - updated, updated };
        this.#draw(true);
      });
      return;
    }
    const parsed = parseCsv(text);
    if (!parsed.ok) {
      this.#problem = 'message' in parsed.error ? parsed.error.message : 'This CSV cannot be read.';
      return this.#draw(true);
    }
    this.#rows = parsed.value;
    this.#mapping = suggestMapping(spec, this.#rows[0] ?? []);
    this.#preview = previewCsvImport(spec, this.#rows, this.#mapping);
    this.#draw(true);
  }

  #mapRows(): HTMLElement {
    const spec = this.#spec as BoneSpec;
    const headers = this.#rows[0] ?? [];
    return h(
      'div',
      { class: 'map' },
      headers.map((header, i) => {
        const select = h(
          'select',
          {},
          h('option', { value: '' }, 'Ignore'),
          spec.entity.fields.map((f) => h('option', { value: f.key }, f.label)),
        );
        select.value = this.#mapping[i] ?? '';
        select.addEventListener('change', () => {
          this.#mapping = { ...this.#mapping, [i]: select.value === '' ? null : select.value };
          this.#preview = previewCsvImport(spec, this.#rows, this.#mapping);
          this.#draw(true);
        });
        return h('label', {}, h('span', { class: 'col' }, header || `Column ${i + 1}`), svg(glyph('arrow')), h('span', { class: 'control' }, select, h('span', { class: 'chev' }, svg(glyph('chevron')))));
      }),
    );
  }

  #previewRows(): HTMLElement {
    const spec = this.#spec as BoneSpec;
    const p = this.#preview ?? { valid: [], skipped: [] };
    const rows = [...p.valid.map((v) => ({ row: v.row, valid: v })), ...p.skipped.map((s) => ({ row: s.row, skipped: s }))].sort((a, b) => a.row - b.row).slice(0, 5);
    return h(
      'div',
      { class: 'preview' },
      rows.map((r) => {
        if ('skipped' in r && r.skipped) {
          return h('div', { class: 'skipped' }, h('span', {}, `Row ${r.row}`), h('oss-pill', { tone: 'urgent', label: r.skipped.reason }));
        }
        const values = 'valid' in r ? r.valid.values : {};
        const e = evaluate(spec, values, this.#now);
        if (!e.ok) return h('div', { class: 'skipped' }, h('span', {}, `Row ${r.row}`), h('oss-pill', { tone: 'urgent', label: 'Cannot evaluate' }));
        const item = h('oss-item', { variant: 'row' });
        Object.assign(item, { spec, now: this.#now, values, evaluation: e.value });
        return item;
      }),
    );
  }

  async #commit(): Promise<void> {
    const store = this.#store;
    if (!store) return;
    const r = this.#source === 'backup' ? await store.importBackup(this.#text, 'merge') : await commitCsvImport(store, this.#preview ?? { valid: [], skipped: [] });
    if (!r.ok) {
      this.#problem = r.error.code === 'invalid' ? (r.error.issues[0]?.message ?? 'Nothing was imported.') : 'message' in r.error ? r.error.message : 'Nothing was imported.';
      this.#draw(true);
      return;
    }
    this.close();
    this.emit('oss-imported', r.value);
  }
}

define('oss-import', OssImport);

declare global {
  interface HTMLElementTagNameMap {
    'oss-import': OssImport;
  }
}
