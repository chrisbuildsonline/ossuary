// The app glue: store, evaluation and the core elements, driven only by bone.json.
// No engine, schema, store or ICS logic here, and no words of any one domain: every label comes from the spec.
import { type Evaluation, type Item, type LifespanEvaluation, type Now, evaluate } from '@ossuary/core';
import { type Store, openStore } from '@ossuary/core/store';
import {
  type Download,
  type GlyphName,
  type ListEntry,
  type OssImport,
  type OssLifespan,
  type OssList,
  type OssSheet,
  type OssToast,
  applyTheme,
  downloadText,
  ensureDocumentTokens,
  glyph,
  loadDisplayFont,
  orderLifespans,
  saveCalendar,
  shortLine,
  titleOf,
} from '@ossuary/core/ui';
import { boneSpec, nowFromClock } from './spec';

export interface AppDeps {
  clock(): Date;
  newId(): string;
  indexedDB?: IDBFactory;
  download?: Download;
}

export interface App {
  close(): void;
}

/** Page layout only. Every value is a core token. */
const css = `
body { margin: 0; background: var(--canvas); }
[hidden] { display: none !important; }
h1:focus { outline: none; }
.bone-hero { display: grid; gap: var(--s-2); margin: var(--s-6) 0 var(--s-8); }
.bone-hero h1, .bone-detail h1 { margin: 0; font: var(--t-display); letter-spacing: -0.02em; color: var(--text); }
.bone-hero p { margin: 0; font: var(--t-body); color: var(--text-2); max-width: 60ch; }
.bone-back { margin: var(--s-2) 0 var(--s-2) calc(-1 * var(--s-2)); }
.bone-detail header { display: grid; gap: var(--s-1); margin-bottom: var(--s-6); }
.bone-meta { margin: 0; font: var(--t-body); color: var(--text-2); }
.bone-meta:empty { display: none; }
.bone-actions { display: flex; flex-wrap: wrap; gap: var(--s-3); }
.bone-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--s-6); align-items: start; }
.bone-main { grid-column: 1 / span 8; display: grid; gap: var(--s-6); }
.bone-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--s-6); }
.bone-trace { grid-column: 9 / span 4; }
.bone-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-6); }
.bone-option {
  display: grid; align-content: start; gap: var(--s-2); padding: var(--s-8) var(--s-6) var(--s-6);
  background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1);
}
.bone-option h2 { margin: var(--s-4) 0 0; font: var(--t-title); letter-spacing: -0.01em; color: var(--text); }
.bone-option p { margin: 0 0 var(--s-4); font: var(--t-body); color: var(--text-2); max-width: 44ch; }
.bone-tile { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--r-lg); background: var(--accent-tint); color: var(--accent-ink); }
.bone-tile svg { width: 28px; height: 28px; }
@media (max-width: 899px) {
  .bone-hero { margin: var(--s-4) 0 var(--s-6); }
  .bone-hero h1, .bone-detail h1 { font-size: 34px; line-height: 38px; }
  .bone-detail header { margin-bottom: var(--s-5); }
  .bone-grid, .bone-main, .bone-cards { gap: var(--s-3); }
  .bone-main, .bone-trace { grid-column: 1 / -1; }
  .bone-cards { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
  .bone-options { grid-template-columns: minmax(0, 1fr); gap: var(--s-4); }
  .bone-option { padding: var(--s-6) var(--s-4) var(--s-4); }
}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const inDays = (d: number) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);
const lifespanLabels = boneSpec.lifespans.map((l) => l.label.toLowerCase());
const listed = (words: string[]) => (words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);

/** Prefill for a new item: today on every lifespan start day, and each duration base amount in its number field. */
function newItem(now: Now): Item {
  const values: Item = {};
  for (const l of boneSpec.lifespans) {
    values[l.startField] = now.day;
    if (l.base.type === 'duration' && l.base.amountField !== undefined) values[l.base.amountField] = l.base.amount;
  }
  return values;
}

function evaluateItem(values: Item, now: Now): Evaluation | undefined {
  const r = evaluate(boneSpec, values, now);
  return r.ok ? r.value : undefined;
}

export async function mountApp(root: HTMLElement, deps: AppDeps): Promise<App> {
  ensureDocumentTokens(document);
  // The page behind the shell (overscroll, below a short screen) takes the theme too.
  applyTheme(document.documentElement, boneSpec.theme);
  const pageCss = new CSSStyleSheet();
  pageCss.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, pageCss];
  void loadDisplayFont(boneSpec.theme?.display);

  const now = () => nowFromClock(deps.clock());
  const shell = el('oss-shell', { current: 'items' });
  shell.spec = boneSpec;

  const addButton = el('oss-button', { variant: 'primary', slot: 'primary', hidden: '' }, boneSpec.copy?.addLabel ?? 'Add item');
  const doneButton = el('oss-button', { variant: 'primary', slot: 'primary', hidden: '' }, 'Done');

  const headline = el('h1', { tabindex: '-1' });
  const support = el('p');
  const list = el('oss-list', { layout: 'auto' }) as OssList;
  Object.assign(list, { spec: boneSpec, now: now() });
  const home = el('div', { class: 'bone-home' }, el('section', { class: 'bone-hero' }, headline, support), list);
  const detail = el('div', { class: 'bone-detail', hidden: '' });

  const sheet = el('oss-sheet') as OssSheet;
  const toast = el('oss-toast') as OssToast;
  const importer = el('oss-import') as OssImport;
  importer.spec = boneSpec;

  // Backup: the core store export as a file and the core store import from a chosen file. Import a list sits here too,
  // because the phone bottom bar has only Items and Backup.
  const saveBackup = el('oss-button', { variant: 'primary', icon: 'archive', 'data-action': 'backup' }, 'Download backup');
  const restoreFile = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  const restore = el('oss-button', { variant: 'ghost', icon: 'upload', 'data-action': 'restore' }, 'Restore from file');
  const importList = el('oss-button', { variant: 'ghost', icon: 'import', 'data-action': 'import' }, 'Import a list');
  const option = (icon: GlyphName, title: string, text: string, ...actions: Node[]) => {
    const tile = el('span', { class: 'bone-tile', 'aria-hidden': 'true' });
    tile.innerHTML = glyph(icon);
    return el('section', { class: 'bone-option' }, tile, el('h2', {}, title), el('p', {}, text), el('div', { class: 'bone-actions' }, ...actions));
  };
  const backup = el(
    'div',
    { class: 'bone-backup', hidden: '' },
    el('section', { class: 'bone-hero' }, el('h1', { tabindex: '-1' }, 'Backup'), el('p', {}, 'Keep everything in one file, or bring in a list.')),
    el(
      'div',
      { class: 'bone-options' },
      option('archive', 'Everything in one file', 'Save every item to one file. Restore it here, on this or any other device.', saveBackup, restore, restoreFile),
      option('import', 'From a spreadsheet', 'Paste a CSV or upload a file. You see a preview before anything is added.', importList),
    ),
  );
  shell.append(addButton, doneButton, home, detail, backup, sheet, toast, importer);
  root.append(shell);

  let store: Store | undefined;
  let entries: ListEntry[] = [];
  let selected: string | undefined;
  let view: 'items' | 'backup' = 'items';

  function render(): void {
    const entry = entries.find((e) => e.id === selected);
    if (!entry) selected = undefined;
    const items = view === 'items';
    shell.setAttribute('current', view);
    backup.hidden = items;
    home.hidden = !items || selected !== undefined;
    detail.hidden = !items || selected === undefined;
    // One primary pill per screen: the empty state and the backup screen bring their own.
    addButton.hidden = !items || selected !== undefined || entries.length === 0;
    doneButton.hidden = !items || selected === undefined;
    renderHome();
    if (entry) renderDetail(entry);
  }

  function renderHome(): void {
    list.now = now();
    list.removeAttribute('state');
    list.entries = entries;
    if (entries.length === 0) {
      headline.textContent = boneSpec.name;
      support.textContent = `Add your first item to watch its ${listed(lifespanLabels)} count down.`;
      return;
    }
    const soon = entries
      .flatMap((e) => e.evaluation.lifespans.map((l) => ({ name: titleOf(boneSpec, e.values), l })))
      .filter(({ l }) => l.stage.tone !== 'dead' && l.remaining.days <= 7)
      .sort((a, b) => a.l.remaining.days - b.l.remaining.days);
    headline.textContent = soon.length ? `${soon.length} ${soon.length === 1 ? 'ends' : 'end'} this week` : 'Nothing ends this week';
    support.textContent = soon.length
      ? `${soon
          .slice(0, 2)
          .map(({ name, l }) => `${name}: ${l.label} ends ${inDays(l.remaining.days)}`)
          .join(', ')}.`
      : `Every ${listed(lifespanLabels)} runs past this week.`;
  }

  function card(l: LifespanEvaluation, today: Now): OssLifespan {
    const node = el('oss-lifespan', { class: 'bone-card' }) as OssLifespan;
    Object.assign(node, { now: today, motif: boneSpec.theme?.motif ?? 'hourglass', lifespan: l });
    return node;
  }

  function renderDetail(entry: ListEntry): void {
    const today = now();
    const back = el('oss-button', { variant: 'link', class: 'bone-back' }, '← All items');
    back.addEventListener('click', () => go(undefined));
    const edit = el('oss-button', { variant: 'ghost', 'data-action': 'edit' }, 'Edit');
    edit.addEventListener('click', () => {
      Object.assign(sheet, { spec: boneSpec, now: today });
      sheet.show(entry.values, entry.id);
    });
    const calendar = el('oss-button', { variant: 'ghost', icon: 'calendar', 'data-action': 'calendar' }, 'Add to calendar');
    calendar.addEventListener('click', () => {
      saveCalendar(boneSpec, [{ id: entry.id, values: entry.values }], now(), { show: (m) => say(m) }, deps.download ?? downloadText);
    });
    const remove = el('oss-button', { variant: 'ghost', 'data-action': 'remove' }, 'Remove');
    remove.addEventListener('click', () => void removeEntry(entry, `Removed ${titleOf(boneSpec, entry.values)}`));
    const trace = el('oss-trace', { class: 'bone-trace' });
    Object.assign(trace, { now: today, evaluation: entry.evaluation });
    detail.replaceChildren(
      back,
      el('header', {}, el('h1', { tabindex: '-1' }, titleOf(boneSpec, entry.values)), el('p', { class: 'bone-meta' }, shortLine(boneSpec, entry.values, today))),
      el(
        'div',
        { class: 'bone-grid' },
        el(
          'div',
          { class: 'bone-main' },
          el('div', { class: 'bone-cards' }, ...orderLifespans(entry.evaluation).map((l) => card(l, today))),
          el('div', { class: 'bone-actions' }, calendar, edit, remove),
        ),
        trace,
      ),
    );
  }

  /** Removes the item and offers Undo, which stores it again. */
  async function removeEntry(entry: ListEntry, message: string): Promise<void> {
    if (!store) return;
    const r = await store.remove(entry.id);
    if (!r.ok) return say('Could not remove it. Try again.');
    go(undefined);
    await reload();
    say(message, async () => {
      await store?.create(entry.values);
      await reload();
    });
  }

  /** One toast at a time; `undo` belongs to the toast on screen. */
  let undo: (() => Promise<void>) | undefined;
  function say(message: string, onUndo?: () => Promise<void>): void {
    undo = onUndo;
    toast.show(message, onUndo ? { undoLabel: 'Undo' } : {});
  }
  toast.addEventListener('oss-undo', () => {
    const run = undo;
    undo = undefined;
    void run?.();
  });

  function go(id: string | undefined): void {
    selected = id;
    view = 'items';
    history.pushState(null, '', id ? `#item-${id}` : location.pathname + location.search);
    render();
    (selected ? detail.querySelector('h1') : headline)?.focus();
    scrollTo?.(0, 0);
  }

  function showError(message: string): void {
    list.setAttribute('message', message);
    list.setAttribute('state', 'error');
  }

  async function reload(): Promise<void> {
    if (!store) return;
    const r = await store.list();
    if (!r.ok) return showError('message' in r.error ? r.error.message : 'Your items could not be read. Try again.');
    const today = now();
    entries = r.value.flatMap((item) => {
      const evaluation = evaluateItem(item.values, today);
      return evaluation ? [{ id: item.id, values: item.values, evaluation }] : [];
    });
    render();
  }

  async function start(): Promise<void> {
    const opened = await openStore(boneSpec, { newId: deps.newId, nowIso: () => deps.clock().toISOString(), indexedDB: deps.indexedDB });
    if (!opened.ok) return showError('message' in opened.error ? opened.error.message : 'Storage is not available. Try again.');
    store = opened.value;
    importer.store = store;
    selected = /^#item-(.+)$/.exec(location.hash)?.[1];
    await reload();
  }

  const openAdd = () => {
    const today = now();
    Object.assign(sheet, { spec: boneSpec, now: today });
    sheet.show(newItem(today));
  };
  addButton.addEventListener('click', openAdd);
  shell.addEventListener('oss-add', openAdd);
  shell.addEventListener('oss-retry', () => void start());

  const openImport = () => {
    importer.now = now();
    importer.show();
  };
  shell.addEventListener('oss-import-open', openImport);
  importList.addEventListener('click', openImport);
  shell.addEventListener('oss-nav', (e) => {
    const target = (e as CustomEvent<{ target: string }>).detail.target;
    if (target === 'import') return openImport();
    if (target === 'items') return go(undefined);
    view = 'backup';
    render();
    backup.querySelector('h1')?.focus();
  });
  importer.addEventListener('oss-imported', async (e) => {
    const { added, updated } = (e as CustomEvent<{ added: number; updated: number }>).detail;
    await reload();
    say(`Imported ${count(added + updated, 'item', 'items')}`);
  });

  saveBackup.addEventListener('click', async () => {
    const r = await store?.exportBackup();
    if (!r?.ok) return say('Could not make the backup. Try again.');
    (deps.download ?? downloadText)(`${boneSpec.id}-backup.json`, JSON.stringify(r.value, null, 2), 'application/json');
    say('Backup file saved');
  });
  restore.addEventListener('click', () => restoreFile.click());
  restoreFile.addEventListener('change', async () => {
    const file = restoreFile.files?.[0];
    restoreFile.value = '';
    if (!file || !store) return;
    const r = await store.importBackup(await file.text(), 'merge');
    if (!r.ok) return say(r.error.code === 'invalid' ? (r.error.issues[0]?.message ?? 'This backup cannot be read.') : 'This backup cannot be read.');
    await reload();
    say(`Restored ${count(r.value.added + r.value.updated, 'item', 'items')}`);
  });
  list.addEventListener('oss-open', (e) => go((e as CustomEvent<{ id: string }>).detail.id));
  addEventListener('popstate', () => {
    view = 'items';
    selected = /^#item-(.+)$/.exec(location.hash)?.[1];
    render();
  });

  sheet.addEventListener('oss-save', async (e) => {
    const { id, values } = (e as CustomEvent<{ id?: string; values: Item }>).detail;
    if (!store) return;
    const r = id ? await store.update(id, values) : await store.create(values);
    if (!r.ok) return say(`Could not save ${titleOf(boneSpec, values)}. Try again.`);
    await reload();
    say(id ? 'Saved' : `Added ${titleOf(boneSpec, values)}`);
  });

  doneButton.addEventListener('click', () => {
    const entry = entries.find((x) => x.id === selected);
    if (entry) void removeEntry(entry, `Done with ${titleOf(boneSpec, entry.values)}`);
  });

  renderHome();
  await start();
  return { close: () => store?.close() };
}
