// Gallery: every primitive in every state, wired to the browser store, the engine and ICS. Fixed now: 2026-11-14.
import { type Evaluation, type Now, evaluate } from '../src/engine/evaluate';
import { type BoneSpec, parseBoneSpec } from '../src/schema/bone-spec';
import type { Item } from '../src/schema/item';
import { tones } from '../src/schema/stages';
import type { Store } from '../src/store/repo';
import { openStore } from '../src/store/repo';
import { downloadText, ensureDocumentTokens, orderLifespans, saveCalendar, titleOf } from '../src/ui/index';
import type { ListEntry, OssImport, OssList, OssSheet, OssToast } from '../src/ui/index';
import core from './fixtures/core.json';
import multi from './fixtures/multi.json';

const now: Now = { day: '2026-11-14' };
const params = new URLSearchParams(location.search);
const themes = {
  core: core.theme,
  warm: { accent: '#b8460e', accentInk: '#9a3a0b', accentTint: '#fbe9dc', canvas: '#f2efea', display: 'fraunces', motif: 'candle', emptyArt: 'candle-jar-moon', wordmark: 'Widget Shelf' },
  cool: { accent: '#5a4bd1', accentInk: '#5a4bd1', accentTint: '#ebe9fb', canvas: '#edeff6', display: 'space-grotesk', motif: 'ghost', emptyArt: 'ghost-parcel', wordmark: 'Widget Shelf' },
};
const themeName = (params.get('theme') ?? 'core') as keyof typeof themes;
const state = params.get('state') ?? 'ready';

function spec(input: unknown): BoneSpec {
  const r = parseBoneSpec(input);
  if (!r.ok) throw new Error(r.error.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return r.value;
}
const theme = themes[themeName] ?? themes.core;
const widgets = spec({ ...core, id: `gallery-${themeName}`, theme });
const gizmos = spec({ ...multi, theme: { ...theme, wordmark: 'Gizmo Keeper' } });

const seed: Item[] = [
  { name: 'Blue widget', kind: 'a', place: 'cold', made: '2026-11-12' },
  { name: 'Red widget', kind: 'b', place: 'cold', made: '2026-11-01', count: 2 },
  { name: 'Green widget', kind: 'c', place: 'shelf', made: '2026-06-01' },
  { name: 'Grey widget', kind: 'a', place: 'deep_cold', made: '2026-08-01' },
  { name: 'Old widget', kind: 'd', place: 'cold', made: '2026-10-20' },
];
const gizmoValues: Item[] = [
  { name: 'Desk gizmo', maker: 'Acme', bought: '2026-10-17', plan: 'basic' },
  { name: 'Spare gizmo', maker: 'Orbit', bought: '2026-09-01', plan: 'plus' },
];

const evaluated = (s: BoneSpec, id: string, values: Item): ListEntry | undefined => {
  const r = evaluate(s, values, now);
  return r.ok ? { id, values, evaluation: r.value } : undefined;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}

const css = new CSSStyleSheet();
css.replaceSync(`
body { margin: 0; background: var(--canvas); font: var(--t-body); color: var(--text); }
.hero { display: grid; gap: var(--s-2); margin: var(--s-8) 0 var(--s-10); }
.hero h1 { margin: 0; font: var(--t-display); letter-spacing: -0.02em; }
.hero p { margin: 0; color: var(--text-2); }
.block { margin-top: var(--s-14); display: grid; gap: var(--s-5); }
.block > h2 { margin: 0; font: var(--t-title); letter-spacing: -0.01em; }
.row { display: flex; flex-wrap: wrap; gap: var(--s-3); align-items: center; }
.panel { padding: var(--s-6); background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1); display: grid; gap: var(--s-5); }
.motifs { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: var(--s-4); }
.motifs figure { margin: 0; display: grid; justify-items: center; gap: var(--s-2); }
.motifs figcaption { font: var(--t-caption); color: var(--text-2); }
.duo { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--s-5); align-items: start; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--s-5); }
.notices { display: grid; gap: var(--s-3); }
.end { justify-content: center; margin-top: var(--s-10); }
.lifespans { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--s-5); }
@media (max-width: 899px) { .lifespans { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-4); } }
.detail { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--s-6); align-items: start; }
.detail oss-lifespan:nth-of-type(1) { grid-column: 1 / span 4; }
.detail oss-lifespan:nth-of-type(2) { grid-column: 5 / span 4; }
.detail .side { grid-column: 9 / span 4; grid-row: 1; }
@media (max-width: 899px) {
  .detail { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-3); }
  .detail oss-lifespan:nth-of-type(1) { grid-column: 1; }
  .detail oss-lifespan:nth-of-type(2) { grid-column: 2; }
  .detail .side { grid-column: 1 / -1; grid-row: auto; justify-self: start; }
}
@media (max-width: 899px) { .hero { margin: var(--s-4) 0 var(--s-8); } .block { margin-top: var(--s-10); } }
`);
ensureDocumentTokens();
document.adoptedStyleSheets = [...document.adoptedStyleSheets, css];

const shell = el('oss-shell', { current: 'items' });
shell.spec = widgets;
const add = el('oss-button', { variant: 'primary', slot: 'primary', 'data-action': 'add' }, widgets.copy?.addLabel ?? 'Add item');
const calendar = el('oss-button', { variant: 'ghost', icon: 'calendar', slot: 'actions', 'data-action': 'calendar' }, 'Calendar');
const headline = el('h1');
const support = el('p');
const list = el('oss-list', { layout: 'auto', 'data-list': 'items' }) as OssList;
Object.assign(list, { spec: widgets, now });
const sheet = el('oss-sheet') as OssSheet;
Object.assign(sheet, { spec: widgets, now });
const importer = el('oss-import') as OssImport;
Object.assign(importer, { spec: widgets, now });
const toast = el('oss-toast') as OssToast;

let store: Store | undefined;
let entries: ListEntry[] = [];

async function reload(): Promise<void> {
  if (!store) return;
  const r = await store.list();
  if (!r.ok) {
    list.setAttribute('message', 'message' in r.error ? r.error.message : 'Storage failed.');
    list.setAttribute('state', 'error');
    return;
  }
  entries = r.value.flatMap((i) => evaluated(widgets, i.id, i.values) ?? []);
  list.entries = state === 'empty' ? [] : entries;
  list.removeAttribute('state');
  const week = entries.filter((e) => {
    const d = e.evaluation.lifespans[e.evaluation.primaryIndex]?.remaining.days ?? -1;
    return d >= 0 && d <= 7;
  });
  headline.textContent = `${week.length} ${week.length === 1 ? 'thing expires' : 'things expire'} this week`;
  support.textContent = week.length ? `${week.slice(0, 2).map((e) => titleOf(widgets, e.values)).join(', ')} first.` : 'Nothing is close yet.';
}

async function start(): Promise<void> {
  if (state === 'loading') {
    list.setAttribute('state', 'loading');
    return;
  }
  if (state === 'error') {
    list.setAttribute('message', 'This browser blocked local storage.');
    list.setAttribute('state', 'error');
    return;
  }
  const opened = await openStore(widgets, { newId: () => crypto.randomUUID(), nowIso: () => new Date().toISOString() });
  if (!opened.ok) {
    list.setAttribute('state', 'error');
    return;
  }
  store = opened.value;
  importer.store = store;
  const existing = await store.list();
  if (existing.ok && existing.value.length === 0) await store.createMany(seed);
  await reload();
}

add.addEventListener('click', () => sheet.show({ made: now.day }));
shell.addEventListener('oss-add', () => sheet.show({ made: now.day }));
shell.addEventListener('oss-import-open', () => importer.show());
shell.addEventListener('oss-retry', () => location.reload());
list.addEventListener('oss-open', async (e) => {
  const id = (e as CustomEvent<{ id: string }>).detail.id;
  const found = entries.find((x) => x.id === id);
  if (found) sheet.show(found.values, id);
});
sheet.addEventListener('oss-save', async (e) => {
  const { id, values } = (e as CustomEvent<{ id?: string; values: Item }>).detail;
  if (!store) return;
  const before = entries.find((x) => x.id === id)?.evaluation;
  const r = id ? await store.update(id, values) : await store.create(values);
  if (!r.ok) return toast.show('Could not save. Try again.');
  await reload();
  const after = evaluated(widgets, r.value.id, r.value.values)?.evaluation;
  toast.show(stageMessage(before, after) ?? 'Saved', id ? { undoLabel: 'Undo' } : {});
});
importer.addEventListener('oss-imported', async (e) => {
  const s = (e as CustomEvent<{ added: number; updated: number }>).detail;
  await reload();
  toast.show(`Imported ${s.added + s.updated} items`);
});
calendar.addEventListener('click', () => saveCalendar(widgets, entries.map(({ id, values }) => ({ id, values })), now, toast));
shell.addEventListener('oss-nav', async (e) => {
  const target = (e as CustomEvent<{ target: string }>).detail.target;
  if (target === 'import') importer.show();
  if (target === 'backup' && store) {
    const b = await store.exportBackup();
    if (b.ok) {
      downloadText(`${widgets.id}-backup.json`, JSON.stringify(b.value, null, 2), 'application/json');
      toast.show('Backup saved');
    }
  }
});

function stageMessage(before: Evaluation | undefined, after: Evaluation | undefined): string | undefined {
  const a = before?.lifespans[before.primaryIndex]?.stage;
  const b = after?.lifespans[after.primaryIndex]?.stage;
  return a && b && a.id !== b.id ? `Now ${b.label.toLowerCase()}` : undefined;
}

// Two lifespans: list, card and trace.
const gizmoEntries = gizmoValues.flatMap((v, i) => evaluated(gizmos, `g${i}`, v) ?? []);
const gizmoList = el('oss-list', { layout: 'auto', 'data-list': 'multi' }) as OssList;
Object.assign(gizmoList, { spec: gizmos, now, entries: gizmoEntries });
const gizmoCalendar = el('oss-button', { variant: 'ghost', icon: 'calendar', 'data-action': 'calendar-multi' }, 'Add to calendar');
gizmoCalendar.addEventListener('click', () => saveCalendar(gizmos, gizmoEntries.map(({ id, values }) => ({ id, values })), now, toast));
const gizmoTrace = el('oss-trace', { mode: 'auto' });
Object.assign(gizmoTrace, { now, evaluation: gizmoEntries[0]?.evaluation });

// One card per lifespan (last days and live, then closing and lapsed) and the banner in block and line form.
const lifespanCards = el(
  'div',
  { class: 'lifespans' },
  ...[
    { name: 'Desk gizmo', bought: '2026-10-17' },
    { name: 'Old gizmo', bought: '2024-11-30' },
  ]
    .flatMap((v, i) => {
      const e = evaluated(gizmos, `l${i}`, v);
      return e ? orderLifespans(e.evaluation) : [];
    })
    .map((lifespan) => Object.assign(el('oss-lifespan'), { lifespan, now, motif: gizmos.theme?.motif ?? 'hourglass' })),
);
const notMine = el('oss-button', { variant: 'ghost', slot: 'actions' }, 'Not mine');
const matchBanner = el('oss-banner', { heading: 'Possible match', text: 'Item 12: Blue widget, loose part' }, el('a', { slot: 'actions', href: '#lifespans' }, 'Read more'), notMine);
const softBanner = el('oss-banner', { tone: 'soon', heading: 'Worth a look', text: 'A widget on this list may need a check.' });
const lineBanner = el('oss-banner', { variant: 'line', text: '1 possible match · Blue widget' });
notMine.addEventListener('click', () => toast.show('Match hidden'));
lineBanner.addEventListener('oss-open', () => toast.show('Match opened'));

// A two-lifespan detail with longer labels and a lifespan that closed long ago: the list (rows on phone),
// two cards in columns 1-4 and 5-8 and the trace in 9-12 from 900 px, as an app detail view lays them out.
const longGizmos = spec({
  ...multi,
  id: 'gallery-long',
  lifespans: multi.lifespans.map((l) => {
    const label = l.id === 'trial' ? 'Rental window' : 'Cover period';
    return { ...l, label, base: { ...l.base, label } };
  }),
  theme: { ...theme, wordmark: 'Gizmo Keeper' },
});
const oldGizmo = evaluated(longGizmos, 'old', { name: 'Old gizmo', maker: 'Orbit', bought: '2024-12-14', plan: 'basic' });
const longList = el('oss-list', { layout: 'auto', 'data-list': 'long' }) as OssList;
Object.assign(longList, { spec: longGizmos, now, entries: oldGizmo ? [oldGizmo] : [] });
const longTrace = el('oss-trace', { mode: 'auto', class: 'side' });
Object.assign(longTrace, { now, evaluation: oldGizmo?.evaluation });
const detailGrid = el(
  'div',
  { class: 'detail' },
  ...(oldGizmo ? orderLifespans(oldGizmo.evaluation) : []).map((lifespan) => Object.assign(el('oss-lifespan'), { lifespan, now, motif: longGizmos.theme?.motif ?? 'hourglass' })),
  longTrace,
);

// Primitives in every state.
const pills = el('div', { class: 'row' }, ...tones.map((t) => el('oss-pill', { tone: t, label: t[0]?.toUpperCase() + t.slice(1) })));
const motifs = el(
  'div',
  { class: 'motifs' },
  ...(['hourglass', 'candle', 'ghost'] as const).flatMap((m) =>
    tones.map((t, i) => el('figure', {}, el('oss-decay', { motif: m, tone: t, fraction: String(1 - i / 4), size: 'm' }), el('figcaption', {}, `${m}, ${t}`))),
  ),
);
const buttons = el(
  'div',
  { class: 'row' },
  el('oss-button', { variant: 'ghost' }, 'Ghost'),
  el('oss-button', { variant: 'ghost', pressed: 'true' }, 'Selected'),
  el('oss-button', { variant: 'ghost', disabled: '' }, 'Disabled'),
  el('oss-button', { variant: 'link' }, 'Link'),
  el('oss-button', { variant: 'icon', icon: 'close', label: 'Close example' }),
);
const fields = el('div', { class: 'fields' });
for (const [i, f] of widgets.entity.fields.entries()) {
  const field = el('oss-field');
  Object.assign(field, { field: { ...f, key: `demo_${f.key}` }, value: seed[1]?.[f.key], error: i === 0 ? 'This is required.' : undefined });
  fields.append(field);
}
const firstEntry = evaluated(widgets, 'demo', seed[0] as Item);
const singleTrace = el('oss-trace', { mode: 'card' });
Object.assign(singleTrace, { now, evaluation: firstEntry?.evaluation });
const drawerTrace = el('oss-trace', { mode: 'drawer' });
Object.assign(drawerTrace, { now, evaluation: firstEntry?.evaluation });
const deadItem = evaluated(widgets, 'dead', seed[4] as Item);
const items = el('div', { class: 'duo' });
for (const [variant, entry] of [['card', firstEntry], ['card', deadItem], ['row', firstEntry]] as const) {
  const item = el('oss-item', { variant, href: '#primitives' });
  Object.assign(item, { spec: widgets, now, values: entry?.values, evaluation: entry?.evaluation });
  items.append(item);
}

// The page ends on a control, so a toast that hides the last row shows up in the short-phone test.
const toTop = el('oss-button', { variant: 'ghost', 'data-action': 'top' }, 'Back to top');
toTop.addEventListener('click', () => window.scrollTo({ top: 0 }));

const block = (title: string, id: string, ...kids: Node[]) => el('section', { class: 'block', id, 'aria-labelledby': `${id}-title` }, el('h2', { id: `${id}-title` }, title), ...kids);

shell.append(
  add,
  calendar,
  el('div', { class: 'hero' }, headline, support),
  list,
  block('Two lifespans', 'multi', el('div', { class: 'row' }, gizmoCalendar), el('div', { class: 'duo' }, gizmoList, gizmoTrace)),
  block('Lifespan cards and banners', 'lifespans', el('div', { class: 'notices' }, lineBanner, matchBanner, softBanner), lifespanCards),
  block('Two-lifespan detail', 'detail', longList, detailGrid),
  block(
    'Primitives',
    'primitives',
    el('div', { class: 'panel' }, pills, buttons, el('div', { class: 'row' }, drawerTrace)),
    motifs,
    items,
    el('div', { class: 'duo' }, singleTrace, el('div', { class: 'panel' }, fields)),
  ),
  el('div', { class: 'row end' }, toTop),
);
if (state === 'empty') add.remove();
document.body.append(shell, sheet, importer, toast);
void start();
