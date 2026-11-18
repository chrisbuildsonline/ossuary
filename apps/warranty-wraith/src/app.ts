// The app glue: store, evaluation against bone.json, and the core elements. No engine, schema, store or ICS logic here.
import { type Evaluation, type Item, evaluate } from '@ossuary/core';
import { type Store, openStore } from '@ossuary/core/store';
import {
  type Download,
  type ListEntry,
  type OssLifespan,
  type OssList,
  type OssSheet,
  type OssToast,
  downloadText,
  ensureDocumentTokens,
  loadDisplayFont,
  orderLifespans,
  saveCalendar,
  shortDay,
  titleOf,
} from '@ossuary/core/ui';
import { boneSpec, defaults, nowFromClock } from './spec';

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
.ww-hero { display: grid; gap: var(--s-2); margin: var(--s-6) 0 var(--s-8); }
.ww-hero h1, .ww-detail h1 { margin: 0; font: var(--t-display); letter-spacing: -0.02em; color: var(--text); }
.ww-hero p { margin: 0; font: var(--t-body); color: var(--text-2); max-width: 60ch; }
.ww-back { margin: var(--s-2) 0 var(--s-2) calc(-1 * var(--s-2)); }
.ww-detail header { display: grid; gap: var(--s-1); margin-bottom: var(--s-6); }
.ww-meta { margin: 0; font: var(--t-body); color: var(--text-2); }
.ww-meta span { white-space: nowrap; }
.ww-actions { display: flex; flex-wrap: wrap; gap: var(--s-3); }
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
  const pageCss = new CSSStyleSheet();
  pageCss.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, pageCss];
  void loadDisplayFont(boneSpec.theme?.display);

  const now = () => nowFromClock(deps.clock());
  const shell = el('oss-shell', { current: 'items' });
  shell.spec = boneSpec;

  const addButton = el('oss-button', { variant: 'primary', slot: 'primary', hidden: '' }, boneSpec.copy?.addLabel ?? 'Add purchase');
  const doneButton = el('oss-button', { variant: 'primary', slot: 'primary', hidden: '' }, DONE_LABEL);

  const headline = el('h1', { tabindex: '-1' });
  const support = el('p');
  const list = el('oss-list', { layout: 'auto' }) as OssList;
  Object.assign(list, { spec: boneSpec, now: now() });
  const home = el('div', { class: 'ww-home' }, el('section', { class: 'ww-hero' }, headline, support), list);
  const detail = el('div', { class: 'ww-detail', hidden: '' });

  const sheet = el('oss-sheet') as OssSheet;
  const toast = el('oss-toast') as OssToast;
  shell.append(addButton, doneButton, home, detail, sheet, toast);
  root.append(shell);

  let store: Store | undefined;
  let entries: ListEntry[] = [];
  let selected: string | undefined;

  function render(): void {
    const entry = entries.find((e) => e.id === selected);
    if (!entry) selected = undefined;
    home.hidden = selected !== undefined;
    detail.hidden = selected === undefined;
    // One primary pill per screen: the empty state brings its own.
    addButton.hidden = selected !== undefined || entries.length === 0;
    doneButton.hidden = selected === undefined;
    renderHome();
    if (entry) renderDetail(entry);
  }

  function renderHome(): void {
    list.now = now();
    list.removeAttribute('state');
    list.entries = entries;
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
    detail.replaceChildren(
      back,
      el('header', {}, title, el('p', { class: 'ww-meta' }, ...meta.flatMap((m, i) => [i ? ' · ' : '', el('span', {}, m)]))),
      el('div', { class: 'ww-grid' }, ...cards, trace, el('div', { class: 'ww-actions' }, calendar, edit)),
    );
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
    for (const item of r.value) {
      const e = evaluate(boneSpec, item.values, today);
      if (e.ok) entries.push({ id: item.id, values: item.values, evaluation: e.value as Evaluation });
    }
    render();
  }

  async function start(): Promise<void> {
    const opened = await openStore(boneSpec, { newId: deps.newId, nowIso: () => deps.clock().toISOString(), indexedDB: deps.indexedDB });
    if (!opened.ok) return showError('message' in opened.error ? opened.error.message : 'Storage is not available. Try again.');
    store = opened.value;
    selected = /^#item-(.+)$/.exec(location.hash)?.[1];
    await reload();
  }

  const openAdd = () => {
    const today = now();
    Object.assign(sheet, { spec: boneSpec, now: today });
    sheet.show({ bought: today.day, return_days: defaults.returnDays, warranty_months: defaults.warrantyMonths });
  };
  addButton.addEventListener('click', openAdd);
  shell.addEventListener('oss-add', openAdd);
  shell.addEventListener('oss-retry', () => void start());
  shell.addEventListener('oss-nav', (e) => {
    if ((e as CustomEvent<{ target: string }>).detail.target === 'items') go(undefined);
  });
  list.addEventListener('oss-open', (e) => go((e as CustomEvent<{ id: string }>).detail.id));
  addEventListener('popstate', () => {
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
