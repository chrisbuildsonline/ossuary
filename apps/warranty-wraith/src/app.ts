// The app glue: store, evaluation against bone.json, and the core elements. No engine, schema, store or ICS logic here.
import { type IsoDay, type Item, evaluate, exportIcs } from '@ossuary/core';
import { type Store, openStore } from '@ossuary/core/store';
import {
  type Download,
  type GlyphName,
  type ListEntry,
  type OssBanner,
  type OssImport,
  type OssLifespan,
  type OssList,
  type OssSheet,
  type OssToast,
  applyTheme,
  downloadText,
  ensureDocumentTokens,
  glyph,
  groupEntries,
  loadDisplayFont,
  orderLifespans,
  saveCalendar,
  seedFirstVisit,
  shortDay,
  titleOf,
} from '@ossuary/core/ui';
import { claimNote } from './claim';
import type { Recall } from './data/cpsc';
import { type RecallMatch, matchRecalls } from './data/match';
import bundledRecalls from './data/recalls.json';
import { boneSpec, defaults, nowFromClock } from './spec';

export interface AppDeps {
  clock(): Date;
  newId(): string;
  indexedDB?: IDBFactory;
  download?: Download;
  /** Sample items for the very first visit to an empty store (main.ts passes them; tests opt in). */
  samples?: (today: IsoDay) => Item[];
  /** Where the first visit is remembered; localStorage by default. */
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** The recall list to match against; the bundled CPSC snapshot by default. */
  recalls?: readonly Recall[];
}

export interface App {
  close(): void;
}

/** Page layout only. Every value is a core token. */
const css = `
body { margin: 0; background: var(--canvas); }
[hidden] { display: none !important; }
h1:focus { outline: none; }
.ww-hero { display: grid; gap: var(--s-2); margin: var(--s-6) 0 var(--s-8); }
.ww-hero h1, .ww-detail h1 { margin: 0; font: var(--t-display); letter-spacing: -0.02em; color: var(--text); }
.ww-hero p { margin: 0; font: var(--t-body); color: var(--text-2); max-width: 60ch; }
.ww-back { margin: var(--s-2) 0 var(--s-2) calc(-1 * var(--s-2)); }
.ww-detail header { display: grid; gap: var(--s-1); margin-bottom: var(--s-6); }
.ww-meta { margin: 0; font: var(--t-body); color: var(--text-2); }
.ww-meta span { white-space: nowrap; }
.ww-actions { display: flex; flex-wrap: wrap; gap: var(--s-3); }
.ww-line { margin: calc(-1 * var(--s-2)) 0 var(--s-8); max-width: 720px; }
.ww-banners { display: grid; gap: var(--s-3); margin-bottom: var(--s-6); }
.ww-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-6); }
.ww-option {
  display: grid; grid-template-rows: auto auto 1fr auto; gap: var(--s-2); padding: var(--s-8) var(--s-6) var(--s-6);
  background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1);
}
.ww-option h2 { margin: var(--s-4) 0 0; font: var(--t-title); letter-spacing: -0.01em; color: var(--text); }
.ww-option p { margin: 0 0 var(--s-4); font: var(--t-body); color: var(--text-2); max-width: 44ch; }
.ww-option .ww-actions { min-height: 52px; align-items: center; }
.ww-tile { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--r-lg); background: var(--accent-tint); color: var(--accent-ink); }
.ww-tile svg { width: 28px; height: 28px; }
/* Detail: two equal countdown cards, then the trace. 12 columns from 900 px: cards 1-4 and 5-8, trace 9-12. */
.ww-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-template-rows: auto 1fr; gap: var(--s-6); align-items: stretch; }
.ww-card:nth-of-type(1) { grid-column: 1 / span 4; grid-row: 1; }
.ww-card:nth-of-type(2) { grid-column: 5 / span 4; grid-row: 1; }
.ww-trace { grid-column: 9 / span 4; grid-row: 1 / span 2; align-self: start; }
.ww-grid > .ww-actions { grid-column: 1 / span 8; grid-row: 2; align-self: start; }
@media (max-width: 899px) {
  .ww-hero { margin: var(--s-4) 0 var(--s-6); }
  .ww-hero h1, .ww-detail h1 { font-size: 34px; line-height: 38px; }
  .ww-detail header { margin-bottom: var(--s-5); }
  .ww-options { grid-template-columns: minmax(0, 1fr); gap: var(--s-4); }
  .ww-option { padding: var(--s-6) var(--s-4) var(--s-4); }
  .ww-option h2 { font-size: 24px; line-height: 30px; }
  .ww-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; gap: var(--s-3); }
  .ww-card:nth-of-type(1) { grid-column: 1; }
  .ww-card:nth-of-type(2) { grid-column: 2; }
  .ww-trace, .ww-grid > .ww-actions { grid-column: 1 / -1; grid-row: auto; }
  .ww-trace { justify-self: start; }
}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

const DONE_LABEL = 'Done with it';
const idsOf = (v: Item) => String(v.recalls_dismissed ?? '').split(/\s+/).filter(Boolean);

/** The item's values with the dismissed recall ids set to `ids`; the field is left out when there are none. */
function withDismissed(values: Item, ids: string[]): Item {
  const { recalls_dismissed: _, ...rest } = values;
  return ids.length ? { ...rest, recalls_dismissed: ids.join(' ') } : rest;
}

/** "CPSC 27054: DREO Space Heaters, model DR-HSH015, The recalled space heaters can overheat ..." */
const noticeText = (r: Recall) => `CPSC ${r.id}: ${[r.names[0] ?? r.title, r.hazard].filter(Boolean).join(', ')}`;
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const when = (d: number) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);

/** "2 return windows close this week", "1 warranty ends this week", both joined, or "Nothing closes this week". */
function headlineOf(entries: readonly ListEntry[]): { title: string; soon: { name: string; label: string; days: number }[] } {
  const soon = entries
    .flatMap((e) =>
      e.evaluation.lifespans
        .filter((l) => l.stage.tone !== 'dead' && l.remaining.days <= 7)
        .map((l) => ({ id: l.lifespanId, name: titleOf(boneSpec, e.values), label: l.label, days: l.remaining.days })),
    )
    .sort((a, b) => a.days - b.days);
  const returns = soon.filter((s) => s.id === 'return_window').length;
  const warranties = soon.filter((s) => s.id === 'warranty').length;
  const parts = [
    returns ? `${count(returns, 'return window', 'return windows')} ${returns === 1 ? 'closes' : 'close'}` : '',
    warranties ? `${count(warranties, 'warranty', 'warranties')} ${warranties === 1 ? 'ends' : 'end'}` : '',
  ].filter(Boolean);
  return { title: parts.length ? `${parts.join(' and ')} this week` : 'Nothing closes this week', soon };
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

  const addButton = el('oss-button', { variant: 'primary', slot: 'primary', hidden: '' }, boneSpec.copy?.addLabel ?? 'Add purchase');
  const doneButton = el('oss-button', { variant: 'primary', slot: 'primary', hidden: '' }, DONE_LABEL);

  const recalls = deps.recalls ?? (bundledRecalls as readonly Recall[]);
  const headline = el('h1', { tabindex: '-1' });
  const support = el('p');
  const recallLine = el('oss-banner', { variant: 'line', tone: 'urgent', class: 'ww-line', hidden: '' }) as OssBanner;
  const list = el('oss-list', { layout: 'auto' }) as OssList;
  Object.assign(list, { spec: boneSpec, now: now() });
  const home = el('div', { class: 'ww-home' }, el('section', { class: 'ww-hero' }, headline, support), recallLine, list);
  const detail = el('div', { class: 'ww-detail', hidden: '' });

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
    const tile = el('span', { class: 'ww-tile', 'aria-hidden': 'true' });
    tile.innerHTML = glyph(icon);
    return el('section', { class: 'ww-option' }, tile, el('h2', {}, title), el('p', {}, text), el('div', { class: 'ww-actions' }, ...actions));
  };
  const backup = el(
    'div',
    { class: 'ww-backup', hidden: '' },
    el('section', { class: 'ww-hero' }, el('h1', { tabindex: '-1' }, 'Backup'), el('p', {}, 'Keep your purchases, their dates and hidden recall notices in one file, or bring in a list.')),
    el(
      'div',
      { class: 'ww-options' },
      option('archive', 'Your drawer in one file', 'Save every purchase to one file. Restore it here, on this or any other device.', saveBackup, restore, restoreFile),
      option('import', 'From a spreadsheet', 'Paste a CSV or upload a file. You see a preview before anything is added.', importList),
    ),
  );
  shell.append(addButton, doneButton, home, detail, backup, sheet, toast, importer);
  root.append(shell);

  let store: Store | undefined;
  let entries: ListEntry[] = [];
  let selected: string | undefined;
  let view: 'items' | 'backup' = 'items';
  /** Open (not dismissed) recall matches per purchase id, worked out on every reload. */
  let matches = new Map<string, RecallMatch[]>();

  function openMatches(values: Item): RecallMatch[] {
    const dismissed = new Set(idsOf(values));
    const model = values.model === undefined ? undefined : String(values.model);
    return matchRecalls({ name: titleOf(boneSpec, values), model }, recalls).filter((m) => !dismissed.has(m.recall.id));
  }

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
    // One line for every open match, in list order; nothing at all when there is none.
    const affected = groupEntries(entries).flatMap((g) => g.entries).filter((e) => matches.get(e.id)?.length);
    const total = affected.reduce((n, e) => n + (matches.get(e.id)?.length ?? 0), 0);
    recallLine.hidden = total === 0;
    recallLine.text = total ? `${count(total, 'possible recall', 'possible recalls')} · ${affected.map((e) => titleOf(boneSpec, e.values)).join(', ')}` : '';
    recallLine.dataset.open = affected[0]?.id ?? '';
    if (entries.length === 0) {
      headline.textContent = 'What did you buy?';
      support.textContent = 'Add a purchase to watch its return window and warranty count down, and to check it against US CPSC recalls.';
      return;
    }
    const { title, soon } = headlineOf(entries);
    headline.textContent = title;
    support.textContent = soon.length
      ? `${soon.slice(0, 2).map((s) => `${s.name} ${s.label.toLowerCase()} ${s.days === 0 ? 'ends today' : `ends ${when(s.days)}`}`).join(', ')}.`
      : 'Every return window and warranty runs past this week.';
  }

  function renderDetail(entry: ListEntry): void {
    const today = now();
    const v = entry.values;
    const back = el('oss-button', { variant: 'link', class: 'ww-back' }, '← All purchases');
    back.addEventListener('click', () => go(undefined));
    const edit = el('oss-button', { variant: 'ghost', 'data-action': 'edit' }, 'Edit');
    edit.addEventListener('click', () => {
      Object.assign(sheet, { spec: boneSpec, now: today });
      sheet.show(v, entry.id);
    });
    const calendar = el('oss-button', { variant: 'ghost', icon: 'calendar', 'data-action': 'calendar' }, 'Add to calendar');
    calendar.addEventListener('click', () => {
      saveCalendar(boneSpec, [{ id: entry.id, values: v }], now(), { show: (m) => say(m) }, deps.download ?? downloadText);
    });
    // Claim reminder: the warranty alone, with the claim note as the event text, while the warranty is still live.
    const warranty = entry.evaluation.lifespans.find((l) => l.lifespanId === 'warranty');
    const claim = el('oss-button', { variant: 'ghost', icon: 'calendar', 'data-action': 'claim' }, 'Claim reminder');
    claim.addEventListener('click', () => {
      const spec = { ...boneSpec, lifespans: boneSpec.lifespans.filter((l) => l.id === 'warranty') };
      const values = { ...v, [boneSpec.entity.titleField]: `Warranty claim: ${titleOf(boneSpec, v)}` };
      const { ics } = exportIcs(spec, [{ id: entry.id, values }], { now: now(), describe: (_, l) => claimNote(v, l.expiresAt) });
      (deps.download ?? downloadText)(`${boneSpec.id}-claim.ics`, ics, 'text/calendar');
      say('Claim reminder saved');
    });
    const actions = [calendar, ...(warranty && warranty.stage.tone !== 'dead' ? [claim] : []), edit];
    const title = el('h1', { tabindex: '-1' }, titleOf(boneSpec, v));
    const meta = [
      String(v.retailer ?? ''),
      `bought ${shortDay(String(v.bought), today)}`,
      typeof v.price === 'number' ? `$${Number.isInteger(v.price) ? v.price : v.price.toFixed(2)}` : '',
      v.model ? `Model ${String(v.model)}` : '',
    ].filter(Boolean);
    const cards = orderLifespans(entry.evaluation).map((l) => {
      const card = el('oss-lifespan', { class: 'ww-card' }) as OssLifespan;
      Object.assign(card, { now: today, motif: boneSpec.theme?.motif ?? 'ghost', lifespan: l });
      return card;
    });
    const trace = el('oss-trace', { class: 'ww-trace' });
    Object.assign(trace, { now: today, evaluation: entry.evaluation });
    const banners = (matches.get(entry.id) ?? []).map(({ recall }) => {
      const read = el('a', { slot: 'actions', href: recall.url, target: '_blank', rel: 'noopener noreferrer' }, 'Read notice');
      const notMine = el('oss-button', { slot: 'actions', variant: 'ghost', 'data-action': 'dismiss' }, 'Not my model');
      notMine.addEventListener('click', () => void dismiss(entry, recall.id));
      return el('oss-banner', { tone: 'urgent', heading: 'Possible recall match', text: noticeText(recall) }, read, notMine);
    });
    detail.replaceChildren(
      back,
      el('header', {}, title, el('p', { class: 'ww-meta' }, ...meta.flatMap((m, i) => [i ? ' · ' : '', el('span', {}, m)]))),
      ...(banners.length ? [el('div', { class: 'ww-banners' }, ...banners)] : []),
      el('div', { class: 'ww-grid' }, ...cards, trace, el('div', { class: 'ww-actions' }, ...actions)),
    );
  }

  /** "Not my model": stores the recall id on the purchase, then offers Undo, which takes that id off again. */
  async function dismiss(entry: ListEntry, recallId: string): Promise<void> {
    const r = await store?.update(entry.id, withDismissed(entry.values, [...idsOf(entry.values), recallId]));
    if (!r?.ok) return say('Could not hide the notice. Try again.');
    await reload();
    detail.querySelector('h1')?.focus();
    say('Recall notice hidden', async () => {
      const current = entries.find((e) => e.id === entry.id);
      if (!current) return;
      const u = await store?.update(entry.id, withDismissed(current.values, idsOf(current.values).filter((id) => id !== recallId)));
      if (!u?.ok) return say('Could not show the notice again. Try again.');
      await reload();
    });
  }

  /** One toast at a time; `undo` belongs to the toast on screen. */
  let undo: (() => Promise<void>) | undefined;
  function say(message: string, onUndo?: () => Promise<void>, undoLabel = 'Undo'): void {
    undo = onUndo;
    toast.show(message, onUndo ? { undoLabel } : {});
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
    if (!r.ok) return showError('message' in r.error ? r.error.message : 'Your purchases could not be read. Try again.');
    const today = now();
    entries = [];
    matches = new Map();
    for (const item of r.value) {
      const e = evaluate(boneSpec, item.values, today);
      if (!e.ok) continue;
      entries.push({ id: item.id, values: item.values, evaluation: e.value });
      matches.set(item.id, openMatches(item.values));
    }
    render();
  }

  async function start(): Promise<void> {
    const opened = await openStore(boneSpec, { newId: deps.newId, nowIso: () => deps.clock().toISOString(), indexedDB: deps.indexedDB });
    if (!opened.ok) return showError('message' in opened.error ? opened.error.message : 'Storage is not available. Try again.');
    store = opened.value;
    importer.store = store;
    selected = /^#item-(.+)$/.exec(location.hash)?.[1];
    const added = deps.samples ? await seedFirstVisit({ specId: boneSpec.id, store, samples: deps.samples(now().day), storage: deps.storage }) : [];
    await reload();
    if (added.length > 0) {
      say(
        'Sample items added',
        async () => {
          for (const id of added) await store?.remove(id);
          await reload();
        },
        'Clear',
      );
    }
  }

  const openAdd = () => {
    const today = now();
    Object.assign(sheet, { spec: boneSpec, now: today });
    sheet.show({ bought: today.day, return_days: defaults.returnDays, warranty_months: defaults.warrantyMonths });
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
    scrollTo?.(0, 0);
  });
  importer.addEventListener('oss-imported', async (e) => {
    const { added, updated } = (e as CustomEvent<{ added: number; updated: number }>).detail;
    await reload();
    say(`Imported ${count(added + updated, 'purchase', 'purchases')}`);
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
    say(`Restored ${count(r.value.added + r.value.updated, 'purchase', 'purchases')}`);
  });
  list.addEventListener('oss-open', (e) => go((e as CustomEvent<{ id: string }>).detail.id));
  recallLine.addEventListener('oss-open', () => {
    if (recallLine.dataset.open) go(recallLine.dataset.open);
  });
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

  doneButton.addEventListener('click', async () => {
    const entry = entries.find((x) => x.id === selected);
    if (!store || !entry) return;
    const r = await store.remove(entry.id);
    if (!r.ok) return say('Could not remove it. Try again.');
    go(undefined);
    await reload();
    say(`Done with ${titleOf(boneSpec, entry.values)}`, async () => {
      await store?.create(entry.values);
      await reload();
    });
  });

  renderHome();
  await start();
  return { close: () => store?.close() };
}
