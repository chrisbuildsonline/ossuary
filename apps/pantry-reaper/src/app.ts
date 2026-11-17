// The app glue: store, evaluation per food spec, and the core elements. No engine, schema, store or ICS logic here.
import { type Evaluation, type Item, evaluate } from '@ossuary/core';
import { type Store, openStore } from '@ossuary/core/store';
import { type Download, type ListEntry, type OssList, ensureDocumentTokens, loadDisplayFont, shortDay, titleOf } from '@ossuary/core/ui';
import { foods } from './data/foods';
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

/** Page layout only. Every value is a core token. */
const css = `
body { margin: 0; background: var(--canvas); }
.pr-hero { display: grid; gap: var(--s-2); margin: var(--s-6) 0 var(--s-8); }
.pr-hero h1 { margin: 0; font: var(--t-display); letter-spacing: -0.02em; color: var(--text); }
.pr-hero p { margin: 0; font: var(--t-body); color: var(--text-2); }
.pr-notes:not(:empty) { display: grid; gap: var(--s-3); margin-bottom: var(--s-8); }
.pr-note {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); margin: 0; padding: var(--s-3) var(--s-3) var(--s-3) var(--s-5);
  background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1); font: var(--t-label); color: var(--text-2);
}
@media (max-width: 899px) { .pr-hero { margin: var(--s-4) 0 var(--s-6); } }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

const primaryOf = (e: Evaluation) => e.lifespans[e.primaryIndex];
const days = (n: number) => `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`;

/** Evaluates a stored item against its own food spec. */
function evaluateItem(values: Item, now: ReturnType<typeof nowFromClock>): Evaluation | undefined {
  const food = byId.get(String(values.food_id));
  if (!food) return undefined;
  const r = evaluate(specForFood(food), values, now);
  return r.ok ? r.value : undefined;
}

export async function mountApp(root: HTMLElement, deps: AppDeps): Promise<App> {
  ensureDocumentTokens(document);
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  void loadDisplayFont(boneSpec.theme?.display);

  const now = () => nowFromClock(deps.clock());
  const shell = el('oss-shell', { current: 'items' });
  shell.spec = boneSpec;
  const headline = el('h1');
  const support = el('p');
  const list = el('oss-list', { layout: 'auto' }) as OssList;
  Object.assign(list, { spec: boneSpec, now: now() });
  const notes = el('div', { class: 'pr-notes' });
  shell.append(el('section', { class: 'pr-hero' }, headline, support), notes, list);
  root.append(shell);

  let store: Store | undefined;
  let entries: ListEntry[] = [];

  function renderHome(): void {
    const today = now();
    list.now = today;
    list.removeAttribute('state');
    list.entries = entries;
    const soon = entries
      .map((e) => ({ e, l: primaryOf(e.evaluation) }))
      .filter(({ l }) => l && l.stage.tone !== 'dead' && l.remaining.days <= 7)
      .sort((a, b) => (a.l?.remaining.days ?? 0) - (b.l?.remaining.days ?? 0));
    if (entries.length === 0) {
      headline.textContent = "What's in your kitchen?";
      support.textContent = `Search ${foods.length} foods with USDA FoodKeeper shelf life, and see when each one dies.`;
      return;
    }
    headline.textContent = soon.length === 0 ? 'Nothing dies this week' : `${soon.length} ${soon.length === 1 ? 'thing dies' : 'things die'} this week`;
    const when = (d: number, day: string) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : d <= 7 ? `in ${days(d)}` : `by ${shortDay(day, today)}`);
    support.textContent = soon.length
      ? `${soon.slice(0, 2).map(({ e, l }) => `${titleOf(boneSpec, e.values)} ${when(l?.remaining.days ?? 0, l?.expiresAt ?? today.day)}`).join(', ')}.`
      : 'Everything you have keeps for more than a week.';
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
    renderHome();
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
    await reload();
  }

  shell.addEventListener('oss-retry', () => void start());

  renderHome();
  await start();
  return { close: () => store?.close() };
}

