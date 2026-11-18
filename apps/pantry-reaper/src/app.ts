// The app glue: store, evaluation per food spec, and the core elements. No engine, schema, store or ICS logic here.
import { type BoneSpec, type Evaluation, type Item, type Now, evaluate, toDayNumber } from '@ossuary/core';
import { type Store, openStore } from '@ossuary/core/store';
import {
  type Download,
  type GlyphName,
  type ListEntry,
  type OssImport,
  type OssList,
  type OssSheet,
  type OssToast,
  accessibleName,
  applyTheme,
  downloadText,
  ensureDocumentTokens,
  fieldText,
  formatCountdown,
  glyph,
  loadDisplayFont,
  longDay,
  saveCalendar,
  shortDay,
  titleOf,
} from '@ossuary/core/ui';
import type { Food } from './data/foodkeeper';
import { foods } from './data/foods';
import './elements/pr-food-search';
import './elements/pr-storage-switch';
import { boneSpec, nowFromClock, specForFood } from './spec';

export interface AppDeps {
  clock(): Date;
  newId(): string;
  indexedDB?: IDBFactory;
  download?: Download;
}

export interface App {
  close(): void;
}

const byId = new Map(foods.map((f) => [f.id, f]));
const foodOf = (values: Item): Food | undefined => byId.get(String(values.food_id));

/** Page layout only. Every value is a core token. */
const css = `
body { margin: 0; background: var(--canvas); }
[hidden] { display: none !important; }
h1:focus { outline: none; }
.pr-hero { display: grid; gap: var(--s-2); margin: var(--s-6) 0 var(--s-6); }
.pr-hero h1, .pr-detail h1 { margin: 0; font: var(--t-display); letter-spacing: -0.02em; color: var(--text); }
.pr-hero p { margin: 0; font: var(--t-body); color: var(--text-2); max-width: 60ch; }
pr-food-search { margin-bottom: var(--s-10); max-width: 640px; }
.pr-notes:not(:empty) { display: grid; gap: var(--s-3); margin-bottom: var(--s-8); }
.pr-note {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); margin: 0; padding: var(--s-3) var(--s-3) var(--s-3) var(--s-5);
  background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1); font: var(--t-label); color: var(--text-2);
}
.pr-back { margin: var(--s-2) 0 var(--s-2) calc(-1 * var(--s-2)); }
.pr-detail header { display: grid; gap: var(--s-1); margin-bottom: var(--s-6); }
.pr-meta { margin: 0; font: var(--t-body); color: var(--text-2); }
.pr-grid { display: grid; grid-template-columns: 7fr 5fr; gap: var(--s-6); align-items: start; }
.pr-card { display: grid; gap: var(--s-6); padding: var(--s-6); background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1); }
.pr-life { display: grid; grid-template-columns: auto 1fr; gap: var(--s-6); align-items: center; }
.pr-count { display: flex; align-items: baseline; gap: var(--s-2); }
.pr-num { font: var(--t-num-xl); font-variant-numeric: tabular-nums; letter-spacing: -0.03em; color: var(--text); }
.pr-unit { font: var(--t-heading); color: var(--text-2); }
.pr-when { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-3); margin-top: var(--s-3); font: var(--t-label); color: var(--text-3); }
.pr-eyebrow { margin: 0 0 var(--s-2); font: var(--t-eyebrow); letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
.pr-actions { display: flex; flex-wrap: wrap; gap: var(--s-3); }
.pr-options { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6); }
.pr-option { align-content: space-between; }
.pr-option-head { display: grid; grid-template-columns: auto 1fr; gap: var(--s-4); align-items: start; }
.pr-option h2 { margin: 0 0 var(--s-1); font: var(--t-heading); color: var(--text); }
.pr-option p { margin: 0; font: var(--t-body); color: var(--text-2); }
.pr-tile { display: grid; place-items: center; width: 48px; height: 48px; border-radius: var(--r-md); background: var(--accent-tint); color: var(--accent-ink); }
.pr-tile svg { width: 24px; height: 24px; }
@media (max-width: 899px) {
  .pr-options { grid-template-columns: 1fr; gap: var(--s-4); }
  .pr-hero { margin: var(--s-4) 0 var(--s-5); }
  pr-food-search { margin-bottom: var(--s-8); }
  .pr-grid { grid-template-columns: 1fr; gap: var(--s-4); }
  .pr-card { padding: var(--s-5) var(--s-4); gap: var(--s-5); }
  /* Candle beside the countdown, so the whole item view fits one phone screen above the toast. */
  .pr-life { gap: var(--s-5); }
  .pr-detail oss-trace { justify-self: center; }
}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

const primaryOf = (e: Evaluation) => e.lifespans[e.primaryIndex];
const days = (n: number) => `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`;
const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

/** Evaluates a stored item against its own food spec. */
function evaluateItem(values: Item, now: Now): Evaluation | undefined {
  const food = foodOf(values);
  if (!food) return undefined;
  const r = evaluate(specForFood(food), values, now);
  return r.ok ? r.value : undefined;
}

const firstMethod = (food: Food) => (food.days.fridge !== undefined ? 'fridge' : (['pantry', 'freezer'] as const).find((m) => food.days[m] !== undefined));

export async function mountApp(root: HTMLElement, deps: AppDeps): Promise<App> {
  ensureDocumentTokens(document);
  // The page behind the shell (overscroll, below a short screen) takes the theme too.
  applyTheme(document.documentElement, boneSpec.theme);
  const sheetCss = new CSSStyleSheet();
  sheetCss.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheetCss];
  void loadDisplayFont(boneSpec.theme?.display);

  const now = () => nowFromClock(deps.clock());
  const shell = el('oss-shell', { current: 'items' });
  shell.spec = boneSpec;

  const addButton = el('oss-button', { variant: 'primary', slot: 'primary' }, boneSpec.copy?.addLabel ?? 'Add food');
  const usedButton = el('oss-button', { variant: 'primary', slot: 'primary', hidden: '' }, 'Used it');

  const headline = el('h1', { tabindex: '-1' });
  const support = el('p');
  const search = el('pr-food-search');
  search.foods = foods;
  const notes = el('div', { class: 'pr-notes' });
  const list = el('oss-list', { layout: 'auto' }) as OssList;
  Object.assign(list, { spec: boneSpec, now: now() });
  const home = el('div', { class: 'pr-home' }, el('section', { class: 'pr-hero' }, headline, support), search, notes, list);
  const detail = el('div', { class: 'pr-detail', hidden: '' });

  const sheet = el('oss-sheet') as OssSheet;
  const toast = el('oss-toast') as OssToast;
  const importer = el('oss-import') as OssImport;
  importer.spec = boneSpec;

  // Backup: the core store export as a file, and the core store import from a chosen file.
  const download = el('oss-button', { variant: 'primary', icon: 'archive' }, 'Download backup');
  const restoreFile = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  const restore = el('oss-button', { variant: 'ghost', icon: 'upload' }, 'Restore from file');
  // Import also lives here: on a phone with items the bottom bar has only Items and Backup.
  const importList = el('oss-button', { variant: 'ghost', icon: 'import' }, 'Import a list');
  const option = (label: string, icon: GlyphName, title: string, text: string, ...actions: Node[]) => {
    const tile = el('span', { class: 'pr-tile' });
    tile.innerHTML = glyph(icon);
    return el(
      'section',
      { class: 'pr-card pr-option', 'aria-label': label },
      el('div', { class: 'pr-option-head' }, tile, el('div', {}, el('h2', {}, title), el('p', {}, text))),
      el('div', { class: 'pr-actions' }, ...actions),
    );
  };
  const backup = el(
    'div',
    { class: 'pr-backup', hidden: '' },
    el('section', { class: 'pr-hero' }, el('h1', { tabindex: '-1' }, 'Backup'), el('p', {}, 'Keep a copy of your kitchen, or bring food in from a list.')),
    el(
      'div',
      { class: 'pr-options' },
      option('Backup', 'archive', 'Your kitchen in one file', 'Save everything to one file. Restore it here, on this or any other device.', download, restore, restoreFile),
      option('Import', 'import', 'From a spreadsheet', 'Paste a CSV or upload a file. You see a preview before anything is added.', importList),
    ),
  );
  shell.append(addButton, usedButton, home, detail, backup, sheet, toast, importer);
  root.append(shell);

  let store: Store | undefined;
  let entries: ListEntry[] = [];
  let selected: string | undefined;
  let view: 'items' | 'backup' = 'items';

  function render(): void {
    const entry = entries.find((e) => e.id === selected);
    const food = entry && foodOf(entry.values);
    if (!entry || !food) selected = undefined;
    shell.setAttribute('current', view);
    backup.hidden = view !== 'backup';
    home.hidden = view !== 'items' || selected !== undefined;
    detail.hidden = view !== 'items' || selected === undefined;
    // One primary pill per screen: the empty state and the backup screen bring their own.
    addButton.hidden = view !== 'items' || selected !== undefined || entries.length === 0;
    usedButton.hidden = view !== 'items' || selected === undefined;
    renderHome();
    if (entry && food && selected) renderDetail(entry, food);
  }

  function renderHome(): void {
    const today = now();
    list.now = today;
    list.removeAttribute('state');
    list.entries = entries;
    if (entries.length === 0) {
      headline.textContent = "What's in your kitchen?";
      support.textContent = `Search ${foods.length} foods with USDA FoodKeeper shelf life, and see when each one dies.`;
      return;
    }
    const soon = entries
      .map((e) => ({ e, l: primaryOf(e.evaluation) }))
      .filter(({ l }) => l && l.stage.tone !== 'dead' && l.remaining.days <= 7)
      .sort((a, b) => (a.l?.remaining.days ?? 0) - (b.l?.remaining.days ?? 0));
    headline.textContent = soon.length === 0 ? 'Nothing dies this week' : `${soon.length} ${soon.length === 1 ? 'thing dies' : 'things die'} this week`;
    const when = (d: number) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${days(d)}`);
    support.textContent = soon.length
      ? `${soon.slice(0, 2).map(({ e, l }) => `${titleOf(boneSpec, e.values)} ${when(l?.remaining.days ?? 0)}`).join(', ')}.`
      : 'Everything you have keeps for more than a week.';
  }

  function renderDetail(entry: ListEntry, food: Food): void {
    const today = now();
    const spec = specForFood(food);
    const l = primaryOf(entry.evaluation);
    if (!l) return;
    const c = formatCountdown(l, today);
    const back = el('oss-button', { variant: 'link', class: 'pr-back' }, '← All food');
    back.addEventListener('click', () => go(undefined));
    const edit = el('oss-button', { variant: 'ghost', 'data-action': 'edit' }, 'Edit');
    edit.addEventListener('click', () => {
      Object.assign(sheet, { spec, now: today });
      sheet.show(entry.values, entry.id);
    });
    const title = el('h1', { tabindex: '-1' }, titleOf(boneSpec, entry.values));
    const where = fieldText(spec, 'storage', entry.values.storage);
    const meta = el('p', { class: 'pr-meta' }, `${where} · opened or bought ${shortDay(String(entry.values.bought), today)}`);
    const life = el(
      'div',
      { class: 'pr-life' },
      el('oss-decay', { motif: boneSpec.theme?.motif ?? 'candle', fraction: String(l.fraction), tone: l.stage.tone, size: 'l', idle: '' }),
      el(
        'div',
        {},
        // One sentence for screen readers (name, stage, when); the digits and unit are visual only.
        el(
          'p',
          { class: 'pr-count', style: 'margin:0', role: 'img', 'aria-label': accessibleName(titleOf(boneSpec, entry.values), entry.evaluation, today) },
          el('span', { class: 'pr-num', 'aria-hidden': 'true' }, c.value),
          c.unit ? el('span', { class: 'pr-unit', 'aria-hidden': 'true' }, c.unit) : '',
        ),
        el('div', { class: 'pr-when' }, el('oss-pill', { tone: l.stage.tone, label: l.stage.label }), el('time', { datetime: l.expiresAt }, longDay(l.expiresAt, today))),
      ),
    );
    const storage = el('pr-storage-switch');
    storage.show(spec, String(entry.values.storage));
    storage.addEventListener('pr-storage', (e) => void moveTo(entry, spec, (e as CustomEvent<{ value: string }>).detail.value));
    const trace = el('oss-trace');
    Object.assign(trace, { now: today, evaluation: entry.evaluation });
    const calendar = el('oss-button', { variant: 'ghost', icon: 'calendar', 'data-action': 'calendar' }, 'Add to calendar');
    calendar.addEventListener('click', () => {
      saveCalendar(spec, [{ id: entry.id, values: entry.values }], now(), { show: (m) => say(m) }, deps.download ?? downloadText);
    });
    const card = el('section', { class: 'pr-card', 'aria-label': 'Best by' }, life, storage, el('div', { class: 'pr-actions' }, calendar, edit));
    detail.replaceChildren(back, el('header', {}, title, meta), el('div', { class: 'pr-grid' }, card, trace));
  }

  /** Switches storage, then says how far the date jumped, with Undo. */
  async function moveTo(entry: ListEntry, spec: BoneSpec, to: string): Promise<void> {
    const from = entry.values.storage;
    const before = primaryOf(entry.evaluation)?.expiresAt;
    const r = await store?.update(entry.id, { ...entry.values, storage: to });
    if (!r?.ok) {
      render();
      return say('Could not move it. Try again.');
    }
    await reload();
    detail.querySelector('pr-storage-switch')?.focus();
    const moved = entries.find((x) => x.id === entry.id);
    const after = moved && primaryOf(moved.evaluation)?.expiresAt;
    if (!before || !after) return;
    const jump = toDayNumber(after) - toDayNumber(before);
    say(`Moved to ${fieldText(spec, 'storage', to).toLowerCase()}: ${jump < 0 ? '-' : '+'}${days(Math.abs(jump))}`, async () => {
      await store?.update(entry.id, { ...entry.values, storage: from });
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
    entries = [];
    notes.replaceChildren();
    for (const item of r.value) {
      const evaluation = evaluateItem(item.values, today);
      if (evaluation) entries.push({ id: item.id, values: item.values, evaluation });
      else notes.append(unreadable(item.id, titleOf(boneSpec, item.values)));
    }
    render();
  }

  /** An item whose food left the snapshot: one line and one action. */
  function unreadable(id: string, name: string): HTMLElement {
    const remove = el('oss-button', { variant: 'ghost' }, 'Remove');
    remove.addEventListener('click', async () => {
      await store?.remove(id);
      await reload();
    });
    return el('p', { class: 'pr-note' }, el('span', {}, `${name} is no longer in the USDA FoodKeeper list, so its date cannot be worked out.`), remove);
  }

  async function start(): Promise<void> {
    const opened = await openStore(boneSpec, { newId: deps.newId, nowIso: () => deps.clock().toISOString(), indexedDB: deps.indexedDB });
    if (!opened.ok) return showError('message' in opened.error ? opened.error.message : 'Storage is not available. Try again.');
    store = opened.value;
    importer.store = store;
    selected = /^#item-(.+)$/.exec(location.hash)?.[1];
    await reload();
  }

  const focusSearch = () => {
    go(undefined);
    search.scrollIntoView?.({ block: 'center' });
    search.focus();
  };
  addButton.addEventListener('click', focusSearch);
  shell.addEventListener('oss-add', focusSearch);
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
    say(`Imported ${items(added + updated)}`);
  });

  download.addEventListener('click', async () => {
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
    say(`Restored ${items(r.value.added + r.value.updated)}`);
  });
  list.addEventListener('oss-open', (e) => go((e as CustomEvent<{ id: string }>).detail.id));
  addEventListener('popstate', () => {
    view = 'items';
    selected = /^#item-(.+)$/.exec(location.hash)?.[1];
    render();
  });

  search.addEventListener('pr-pick', (e) => {
    const food = (e as CustomEvent<{ food: Food }>).detail.food;
    const today = now();
    Object.assign(sheet, { spec: specForFood(food), now: today });
    sheet.show({ name: food.name, food_id: food.id, storage: firstMethod(food), bought: today.day });
  });

  sheet.addEventListener('oss-save', async (e) => {
    const { id, values } = (e as CustomEvent<{ id?: string; values: Item }>).detail;
    if (!store) return;
    const r = id ? await store.update(id, values) : await store.create(values);
    if (!r.ok) return say(`Could not save ${titleOf(boneSpec, values)}. Try again.`);
    await reload();
    say(id ? 'Saved' : `Added ${titleOf(boneSpec, values)}`);
  });

  usedButton.addEventListener('click', async () => {
    const entry = entries.find((x) => x.id === selected);
    if (!store || !entry) return;
    const r = await store.remove(entry.id);
    if (!r.ok) return say('Could not remove it. Try again.');
    go(undefined);
    await reload();
    say(`${titleOf(boneSpec, entry.values)} used up`, async () => {
      await store?.create(entry.values);
      await reload();
    });
  });

  renderHome();
  await start();
  return { close: () => store?.close() };
}
