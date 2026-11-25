# Design: skeleton contract (`packages/ossuary-core`)

## Overview

The core is four pure or near-pure layers and a UI layer. Each layer depends only on the ones above it in this list.

```
schema   ->  engine  ->  ics
   \            \
    +-> store    +-> ui (web components) -> gallery + Playwright
```

- `schema`: zod bone spec, item validation, contrast maths, JSON Schema export.
- `engine`: `evaluate(spec, item, now)`. Pure.
- `store`: IndexedDB, backup, CSV import.
- `ics`: calendar export.
- `ui`: custom elements, tokens, motifs.

Time never enters a layer except as an argument. Browser edges (`new Date()`, `crypto.randomUUID()`) are created by the app glue or the gallery and passed in.

## Directory layout

```
packages/ossuary-core/
  src/
    schema/    bone-spec.ts  fields.ts  lifespans.ts  rules.ts  stages.ts  theme.ts  contrast.ts
               item.ts  issues.ts  json-schema.ts  index.ts
    engine/    iso-day.ts  duration.ts  rules.ts  stage.ts  trace.ts  primary.ts  evaluate.ts
    store/     db.ts  repo.ts  backup.ts  csv.ts  csv-import.ts  errors.ts
    ics/       export-ics.ts
    ui/        tokens.css  theme.ts  fonts.ts  a11y/focus-trap.ts
               elements/  oss-shell.ts oss-button.ts oss-item.ts oss-pill.ts oss-decay.ts
                          oss-list.ts oss-sheet.ts oss-field.ts oss-trace.ts oss-empty.ts
                          oss-import.ts oss-toast.ts
               motifs/    candle.ts ghost.ts hourglass.ts   (procedural SVG)
               glyphs.ts  (5 tone glyphs, alert, import, calendar, bone)
    index.ts
  bone-spec.schema.json       generated, checked in
  gallery/   index.html  gallery.ts  fixtures/{core,warm,cool,multi}.json  fixtures/items.ts
  e2e/       gallery.spec.ts  a11y.spec.ts  keyboard.spec.ts  responsive.spec.ts
  playwright.config.ts  vitest.config.ts
```

Package `exports`: `.` (everything), `./schema`, `./engine`, `./store`, `./ics`, `./ui`, `./ui/tokens.css`, `./bone-spec.schema.json`. The engine and schema entry points import no DOM code.

## Components and interfaces

### Shared types (`schema/issues.ts`)

```ts
export type IsoDay = string; // 'YYYY-MM-DD', a real calendar day
export interface Issue { path: string; message: string }          // path e.g. 'rules[2].when.field'
export type Result<T, E = Issue[]> = { ok: true; value: T } | { ok: false; error: E };
```

### 1. Schema

```ts
export function parseBoneSpec(input: unknown): Result<BoneSpec>;   // never throws
export function formatIssues(err: z.ZodError): Issue[];            // max 50, readable paths
export function buildItemSchema(spec: BoneSpec): z.ZodType<Item>;  // fields -> zod
export function validateItem(spec: BoneSpec, input: unknown): Result<Item>;
export const boneSpecJsonSchema: object;                           // z.toJSONSchema(...)
export function contrastRatio(fgHex: string, bgHex: string): number;   // WCAG 2.x
export function relativeLuminance(hex: string): number;
```

`parseBoneSpec` wraps `safeParse` in `try/catch` as a last guard, so an unexpected internal error becomes `{ path: '', message: 'Could not read this spec.' }` rather than a throw.

Structure is zod objects with `.strict()`. Cross-field checks (references, enum coverage, thresholds, contrast) run in `superRefine` on the root, only after the structural parse succeeds, so they never see malformed data. Every `addIssue` sets an explicit `path` so messages point at the offending key. Because each lifespan carries its own rules and stages, the cross-field checks run once per lifespan and paths include the lifespan index, for example `lifespans[1].stages[2].enterAtDays`. Lifespan ids are checked for uniqueness across the spec, rule ids and stage ids within their lifespan.

JSON Schema is generated with zod's `z.toJSONSchema`. It covers structure only. `superRefine` checks (references, contrast, thresholds) are not expressible in it, and the file header comment in the generated schema's `description` says so.

### 2. Engine

```ts
export interface Now { day: IsoDay; minuteOfDay?: number }   // local wall clock, supplied by caller

export interface TraceLine {
  ruleId: string;            // 'base' for the base line
  kind: 'base' | 'extend' | 'shorten' | 'clamp' | 'lookup';
  text: string;              // plain language
  deltaDays: number;         // signed change to the expiry day
  changed: boolean;
  sourceId?: string;
}

export interface LifespanEvaluation {
  lifespanId: string;
  label: string;
  startedAt: IsoDay;
  expiresAt: IsoDay;
  remaining: { days: number; hours?: number };  // hours only when days === 0
  fraction: number;                             // 0..1
  stage: { id: string; label: string; tone: Tone; index: number };  // index within this lifespan's stages
  trace: TraceLine[];
}

export interface Evaluation {
  lifespans: LifespanEvaluation[];  // one per spec lifespan, declared order
  primaryIndex: number;             // fewest remaining days among live lifespans, ties to the lowest index; if all expired, the greatest remaining days, ties to the lowest index
}

export function evaluate(spec: BoneSpec, item: unknown, now: Now): Result<Evaluation>;
```

Algorithm (all arithmetic on integer day numbers):

1. `validateItem` once. On failure return its issues.
2. For each lifespan, in declared order, run steps 3 to 8 using only that lifespan's start field, base, rules and stages.
3. `start = dayNumber(item[startField])`.
4. Base: duration gives `expiry = addDuration(start, d)`. A date field gives `expiry = dayNumber(item[field])`. Add a `base` trace line.
5. For each rule in declared order: skip IF `when` is false. Otherwise
   - `extend`: `expiry = addDuration(expiry, d)`
   - `shorten`: `expiry = max(start, addDuration(expiry, -d))`
   - `clamp`: `expiry = min(max(expiry, start + min), start + max)` with absent bounds ignored
   - `lookup`: `expiry = addDuration(start, table[value] ?? default)`
   and add a trace line with `deltaDays = newExpiry - oldExpiry`.
6. `remaining.days = expiry - nowDay`. `hours = ceil((1440 - minuteOfDay) / 60)` when `days === 0` and `minuteOfDay` is given.
7. Stage: if `remaining.days < 0`, the dead stage. Otherwise the last non-dead stage whose threshold is `>= remaining.days` (see "Stage selection").
8. `fraction = expiry <= start ? 0 : clamp((expiry - nowDay) / (expiry - start), 0, 1)`.
9. `primaryIndex` (`primary.ts`, `pickPrimary(lifespans)`): the index chosen in two passes over declared order. First pass: among lifespans with `remaining.days >= 0`, the one with the lowest `remaining.days`; a strict `<` comparison gives the tie-break to the earlier lifespan. If no lifespan is live, second pass over all lifespans: the one with the greatest `remaining.days` (the one that expired last), using a strict `>` comparison so ties go to the earlier lifespan. A lapsed lifespan therefore never hides a still-valid one. Expired lifespans that are not primary still render as the smaller lines on the card with their dead stage text.

**Stage selection** (per lifespan). Stages are `[s0, s1 ... sn-2, dead]` with `s0` having no threshold and thresholds strictly decreasing. Stage `i` is the last non-dead stage whose threshold (infinity for `s0`) is `>= remaining.days`. Example thresholds 7 and 2: remaining 8 is `s0`, 7 is `s1`, 3 is `s1`, 2 is `s2`, 0 is `s2`, -1 is dead. A threshold of N means "entered when N days remain", which is the same day the ICS alarm fires. Stage indexes are local to a lifespan and are not comparable across lifespans. Only `remaining.days` decides the primary.

**`iso-day.ts`** has `parseIsoDay`, `formatIsoDay`, `toDayNumber`, `fromDayNumber` using the proleptic Gregorian civil-from-days algorithm on integers. It uses no `Date` object, so the time zone and DST cannot affect it. `isRealDay` rejects `2026-02-30`.

**`duration.ts`** `addDuration(dayNumber, {amount, unit})`: `day` adds n days and `week` adds 7n days. `month` and `year` (12 months) go through civil date: add months to year and month, then `min(day, daysInMonth)`.

**Trace text** comes from fixed templates and spec-provided labels, for example:

- base duration: `Base: {label} {n} days` where `label` is the optional `label` on the base (or "Base lifespan").
- extend: `{label} extends by {n} days` / shorten: `{label} shortens by {n} days`
- clamp: `Limit: at most {n} days` or `no change`
- lookup: `{field label} is {option label}: {n} days`

Source names append as ` (Source name)`. Rules and the base have an optional `label` for this purpose.

### 3. Store

```ts
export interface StoredItem { id: string; values: Item; createdAt: string; updatedAt: string }
export interface StoreDeps { newId(): string; nowIso(): string; indexedDB?: IDBFactory }

export type StoreError =
  | { code: 'not_found'; id: string }
  | { code: 'invalid'; issues: Issue[] }
  | { code: 'unavailable' | 'blocked' | 'quota'; message: string }
  | { code: 'too_large'; message: string };

export function openStore(spec: BoneSpec, deps: StoreDeps): Promise<Result<Store, StoreError>>;

interface Store {
  create(values: unknown): Promise<Result<StoredItem, StoreError>>;
  get(id: string): Promise<Result<StoredItem, StoreError>>;
  list(): Promise<Result<StoredItem[], StoreError>>;
  update(id: string, values: unknown): Promise<Result<StoredItem, StoreError>>;
  remove(id: string): Promise<Result<void, StoreError>>;
  exportBackup(): Promise<Result<Backup, StoreError>>;
  importBackup(text: string, mode: 'merge' | 'replace'): Promise<Result<ImportSummary, StoreError>>;
  close(): void;
}
export function parseCsv(text: string): Result<string[][], StoreError>;
export function suggestMapping(spec: BoneSpec, headers: string[]): Mapping;
export function previewCsvImport(spec: BoneSpec, rows: string[][], mapping: Mapping): CsvPreview;
export function commitCsvImport(store: Store, preview: CsvPreview): Promise<Result<ImportSummary, StoreError>>;
```

IndexedDB layout, database `ossuary:<appId>`, version 1: object store `items` (keyPath `id`) and store `meta` (key `schema`, value `{ appId, createdAt }`). Backup import and replace run in one `readwrite` transaction. A thrown validation problem happens before the transaction opens, so a failed import cannot leave partial data.

`parseCsv` is a small hand-written RFC 4180 state machine (no dependency). CSV mapping (`Mapping = Record<columnIndex, fieldKey | null>`) is auto-suggested, then edited by the UI. Dates must be `YYYY-MM-DD`. Other formats are skipped with "Use YYYY-MM-DD" because day-month and month-day order is ambiguous.

`CsvPreview = { valid: { row: number; values: Item }[]; skipped: { row: number; reason: string }[] }`.

Error mapping from `idb`/DOM: `SecurityError` or missing `indexedDB` to `unavailable`, `QuotaExceededError` to `quota`, an `onblocked` event to `blocked`.

### 4. ICS

```ts
export interface IcsEntry { id: string; values: Item }
export function exportIcs(
  spec: BoneSpec,
  entries: IcsEntry[],
  opts: { now: Now; prodId?: string; describe?: (entry: IcsEntry, lifespan: LifespanEvaluation) => string | undefined },
): { ics: string; skipped: { id: string; issues: Issue[] }[] };
```

Each entry is evaluated once with `evaluate`. For every lifespan in the result, the `ics` package builds one all-day event on that lifespan's `expiresAt`, so a one-lifespan spec gives one event per entry. The `UID` is `<appId>-<itemId>-<lifespanId>@ossuary`. The `SUMMARY` is the item's title, followed by ` - <lifespan label>` only when the spec has more than one lifespan. For each stage of that lifespan with a threshold, the alarm day is `expiresAt - enterAtDays`. All-day events start at midnight, so a 09:00 alarm n days before is `TRIGGER:-P{n-1}DT15H` when `n >= 1` and `TRIGGER:PT9H` when `n = 0`. Alarms whose day is before `now.day` are dropped. An entry that fails evaluation is skipped with all of its lifespans. The UI helper `downloadText(filename, text, mime)` lives in `ui/` so `ics/` stays DOM-free.

### 5. UI

Design source of truth is `design/DESIGN.md`. This section records only the element contracts and wiring.

| Element | Properties (set by host) | Events |
|---|---|---|
| `oss-shell` | `spec`, `screen` (`'home' \| 'detail' \| 'other'`), slot `primary` | `oss-nav` |
| `oss-button` | `variant: 'primary' \| 'ghost' \| 'link'` | native `click` |
| `oss-item` | `spec`, `evaluation`, `values`, `variant: 'card' \| 'row'`, `href` | native link |
| `oss-pill` | `tone`, `label` | none |
| `oss-decay` | `motif`, `fraction`, `tone`, `size` | none |
| `oss-list` | `spec`, `entries: {id, values, evaluation}[]`, `layout: 'auto'` | `oss-open` |
| `oss-sheet` | `spec`, `now`, `values?` (edit), `open` | `oss-save`, `oss-cancel` |
| `oss-field` | `field`, `value`, `error` | `oss-change` |
| `oss-trace` | `evaluation`, `mode: 'card' \| 'drawer'` | `oss-close` |
| `oss-empty` | `spec` | `oss-add`, `oss-import-open` |
| `oss-import` | `spec`, `store`, `now`, `open` | `oss-imported` |
| `oss-toast` | `message`, `undoLabel?` | `oss-undo` |

Rules for all elements:

- `evaluation` is the full `Evaluation`. The primary lifespan is `evaluation.lifespans[evaluation.primaryIndex]`. `oss-item` renders it large with the stage pill and `oss-decay`, and `oss-list` groups by its stage tone. With more than one lifespan, `oss-item` also renders the other lifespans in declared order as compact lines (label, countdown text, tone glyph and stage label as text). With one lifespan it renders none of these lines and no lifespan label. `oss-decay` and `oss-pill` take plain values and know nothing about lifespans. `oss-trace` renders one section per lifespan (headed by the label when there is more than one, primary marked in text), and its drawer is one drawer for all sections. The accessible-name builder adds one sentence per other lifespan.
- Elements use Shadow DOM and adopt a shared constructable stylesheet built from `tokens.css`, so custom properties flow in from `oss-shell`.
- The host sets `now` (an object) and data. Elements never read the clock. The gallery uses the fixed day `2026-11-14`.
- Tone colours (background, text, glyph) live in `tokens.css` as `--tone-<slot>-bg` and `--tone-<slot>-fg`. Themes cannot override them.
- `applyTheme(el, theme)` writes only the five colour and font custom properties and sets `data-motif` and `data-empty-art`. Fonts load through `loadDisplayFont(name)`, a dynamic import of the matching `@fontsource-variable/*` CSS.
- Segmented control and filter chips are `role="radiogroup"` with roving tabindex and arrow keys.
- `oss-sheet` and `oss-import` use the native `<dialog>` element with `showModal()` for the scrim, top-layer stacking and Escape, plus the small `focus-trap.ts` for the case where `inert` background is not enough, and restore focus to `document.activeElement` captured at open.
- `oss-decay` motif functions are pure: `(fraction, tone, size) => SVG string`. They are unit-tested for exact output at a few inputs. Wobble is baked into constant path data.
- Reduced motion is handled in `tokens.css` with one `@media (prefers-reduced-motion: reduce)` block that zeroes `--dur-*` and disables animation.

Heights, radii and spacing come from DESIGN.md tokens. Where an element needs a value not in DESIGN.md, add the token to `tokens.css` and to DESIGN.md first.

### Gallery

`gallery/index.html` is a Vite page, not shipped in the package `exports`. It renders every primitive in every state (all five tones, three motifs, empty, error, loading, dead, sheet open, trace drawer, import dialog), with `?theme=core|warm|cool` selecting a fixture spec and a fixed `now`. The three fixtures use neutral names ("Widget", "Gizmo") and the theme values from DESIGN.md section 4 so contrast checks run against real tokens. Each declares one lifespan. A fourth fixture, `multi.json` (core theme, a "Gizmo" with two lifespans of different bases and stages), is rendered in its own gallery section under every theme, so axe and layout tests cover the multi-lifespan card, list grouping, trace and sheet preview. Tests use Playwright's `reducedMotion` option for reduced motion.

## Data models

### Bone spec (abridged JSON example)

```json
{
  "id": "widget-tracker",
  "name": "Widget Tracker",
  "version": 1,
  "entity": {
    "titleField": "name",
    "summaryFields": ["kind", "place"],
    "fields": [
      { "key": "name",   "kind": "text",   "label": "Name", "required": true },
      { "key": "kind",   "kind": "enum",   "label": "Kind", "options": [
          { "value": "a", "label": "Type A" }, { "value": "b", "label": "Type B" } ] },
      { "key": "place",  "kind": "enum",   "label": "Place", "options": [
          { "value": "cold", "label": "Cold" }, { "value": "dry", "label": "Dry" } ] },
      { "key": "made",   "kind": "date",   "label": "Made", "required": true },
      { "key": "opened", "kind": "enum",   "label": "Opened", "options": [
          { "value": "no", "label": "No" }, { "value": "yes", "label": "Yes" } ] }
    ]
  },
  "lifespans": [
    {
      "id": "main",
      "label": "Use by",
      "startField": "made",
      "base": { "type": "duration", "amount": 14, "unit": "day", "label": "Base", "sourceId": "ref1" },
      "rules": [
        { "id": "r1", "kind": "lookup", "field": "place", "label": "Place",
          "table": { "cold": { "amount": 14, "unit": "day" }, "dry": { "amount": 3, "unit": "month" } },
          "sourceId": "ref1" },
        { "id": "r2", "kind": "shorten", "label": "Opened", "when": { "field": "opened", "equals": "yes" },
          "by": { "amount": 7, "unit": "day" } },
        { "id": "r3", "kind": "clamp", "label": "Limit", "max": { "amount": 90, "unit": "day" } }
      ],
      "stages": [
        { "id": "fresh",  "label": "Fresh",  "tone": "fresh" },
        { "id": "soon",   "label": "Soon",   "tone": "soon",   "enterAtDays": 7 },
        { "id": "urgent", "label": "Urgent", "tone": "urgent", "enterAtDays": 2 },
        { "id": "gone",   "label": "Gone",   "tone": "dead" }
      ]
    }
  ],
  "theme": { "accent": "#3657c9", "display": "inter", "motif": "hourglass",
             "emptyArt": "hourglass-side", "wordmark": "Widget Tracker" },
  "copy": { "emptyTitle": "Nothing here yet.", "addLabel": "Add item" },
  "sources": [ { "id": "ref1", "name": "Example reference", "url": "https://example.org/data",
                 "license": "CC0-1.0", "retrievedOn": "2026-10-01" } ]
}
```

A spec with several lifespans lists them in `lifespans`. Only the `lifespans` entry changes. Each lifespan has its own start field, base, rules and stages. This sketch has two (rules omitted, stages abridged):

```json
"lifespans": [
  { "id": "trial", "label": "Trial ends", "startField": "made",
    "base": { "type": "duration", "amount": 30, "unit": "day" },
    "stages": [ { "id": "ok", "label": "Open", "tone": "fresh" },
                { "id": "last", "label": "Last days", "tone": "urgent", "enterAtDays": 3 },
                { "id": "over", "label": "Closed", "tone": "dead" } ] },
  { "id": "cover", "label": "Cover ends", "startField": "made",
    "base": { "type": "duration", "amount": 2, "unit": "year" },
    "stages": [ { "id": "ok", "label": "Covered", "tone": "steady" },
                { "id": "soon", "label": "Ending", "tone": "soon", "enterAtDays": 30 },
                { "id": "over", "label": "Ended", "tone": "dead" } ] }
]
```

The primary lifespan is the one with fewer days remaining. Its stage drives the pill and the list group.

Fields in `copy` (`emptyTitle`, `emptyBody`, `addLabel`) are optional text strings (max 80 characters) with core defaults. They are the only free text the UI takes from the spec besides labels. They are rendered as text, never as HTML.

### Types (zod-inferred)

```ts
type Tone = 'fresh' | 'steady' | 'soon' | 'urgent' | 'dead';
type Unit = 'day' | 'week' | 'month' | 'year';
interface Duration { amount: number; unit: Unit }
type Field =
  | { key: string; kind: 'text'; label: string; required?: boolean }
  | { key: string; kind: 'date'; label: string; required?: boolean }
  | { key: string; kind: 'number'; label: string; required?: boolean; min?: number; max?: number; step?: number }
  | { key: string; kind: 'enum'; label: string; required?: boolean; options: { value: string; label: string }[] };
type Item = Record<string, string | number | undefined>;   // date as IsoDay
type Rule =
  | { id: string; kind: 'extend' | 'shorten'; label?: string; by: Duration; when?: Cond; sourceId?: string }
  | { id: string; kind: 'clamp'; label?: string; min?: Duration; max?: Duration; when?: Cond; sourceId?: string }
  | { id: string; kind: 'lookup'; label?: string; field: string; table: Record<string, Duration>; default?: Duration; sourceId?: string };
interface Cond { field: string; equals: string | number }
interface Stage { id: string; label: string; tone: Tone; enterAtDays?: number }
type Base =
  | { type: 'duration'; amount: number; unit: Unit; label?: string; sourceId?: string }
  | { type: 'field'; field: string; label?: string; sourceId?: string };
interface Lifespan {
  id: string;                 // lowercase identifier, unique in the spec
  label: string;
  startField: string;         // a date field
  base: Base;
  rules?: Rule[];             // rule ids unique within the lifespan
  stages: Stage[];            // this lifespan's own warning stages
}
// BoneSpec.lifespans: [Lifespan, ...Lifespan[]]   (1 to 4, declared order is the tie-break)
```

### Backup document

```json
{ "format": "ossuary-backup", "version": 1, "appId": "widget-tracker",
  "exportedAt": "2026-11-14T16:35:04.648Z",
  "items": [ { "id": "…", "values": { "name": "…", "made": "2026-11-09" },
               "createdAt": "…", "updatedAt": "…" } ] }
```

## Error handling

| Layer | Failure | Behaviour |
|---|---|---|
| Schema | Any bad input | `{ ok: false, issues }`, readable path and message, max 50. Never throws. |
| Schema | Internal error | One generic issue at the root. |
| Engine | Invalid item, bad day | `{ ok: false, issues }`. No partial result, for any lifespan. |
| Engine | Missing optional field used by a `when` | Condition is false, rule skipped. |
| Store | Invalid write | `invalid` error, nothing written. |
| Store | Missing id | `not_found`. |
| Store | IndexedDB unavailable, blocked, quota | `unavailable`, `blocked`, `quota`. UI shows one line and one action ("Try again" or "Export backup"). |
| Store | Bad backup or CSV | Nothing written. Issues name item index or row number and field. |
| Store | Over 5 MB or 10,000 rows | `too_large` before row parsing. |
| ICS | Item cannot be evaluated | Item skipped and reported in `skipped`. The rest is exported. |
| UI | Invalid sheet values | Sheet stays open, per-field error with glyph and text, focus to the first invalid field. |
| UI | Store error | Toast with `role="status"`, or an inline error state in the list with one action. |

User-provided text (item values, spec labels, CSV cells) is always set through `textContent` or properties, never `innerHTML`. Motif SVG is built from numbers only.

## Testing strategy

Tests sit next to the code (`*.test.ts`). Playwright tests are in `e2e/`. Per `tech.md`, each task writes the failing test first.

**Schema (vitest + fast-check).**
- Example tests: a valid spec per feature, and one failing spec per criterion 1.2 to 1.19 and 1.23 asserting the exact `path` and a message substring. Lifespan cases: one lifespan, four lifespans, five lifespans, an empty array, a duplicate lifespan id, a top-level `rules` or `stages` key (unknown key), and a bad reference in the second lifespan reported at `lifespans[1]...`.
- Contrast: known pairs from DESIGN.md (`#3657c9` on white 6.25, `#b8460e` on `#f2efea` 4.67) and a rejected accent such as `#999999`.
- Luminance boundary: canvases just inside and just outside 0.84 and 0.89.
- Fuzz: `fc.jsonValue()`, `fc.anything()`, and a mutation arbitrary (delete, replace or retype a random path in a valid spec) never throw. Accepted specs reparse equal. A spec arbitrary generates valid specs for the engine tests.
- Snapshot-free check that `bone-spec.schema.json` equals `boneSpecJsonSchema`.

**Engine (vitest + fast-check, fixed seed and fixed `now`).**
- Example tests for each rule, rule order (clamp before extend differs from after), month-end clamping (31 Jan + 1 month), leap day, `when`, lookup default, shorten floor, trace lines.
- Properties from criteria 2.14 and 2.16. Use a generated spec arbitrary (one to four lifespans) and an item arbitrary. Use `fc.configureGlobal({ seed })` for reproducible runs.
- Primary selection: examples for a clear winner, a tie (the earlier declared lifespan wins), a dead lifespan beating a live one, and a single lifespan (`primaryIndex` 0). Independence: changing one lifespan's rules leaves the others' evaluations deep equal.
- Threshold exactness: for each generated threshold N, evaluate at `now = expiry - N` and `expiry - N - 1`.
- Time zone safety: a `test:tz` script runs the same suite with `TZ=UTC`, `America/New_York` and `Pacific/Auckland`, and includes dates over the 2026 DST changes in those zones.
- A source scan (criterion 6.2) fails on `Date.now(` or `new Date()` in `engine`, `schema`, `ics`.

**Store (vitest + fake-indexeddb).**
- CRUD, namespace isolation, validation rejection leaving data unchanged, `not_found`.
- Backup round trip, wrong `appId`, bad version, one invalid item among valid ones writes nothing.
- CSV parser: quoting, CRLF, BOM, embedded newlines. Mapping suggestions. Preview with skipped reasons. Size limits.
- Fuzz: random strings and random JSON as backup, random cell grids as CSV. Never throws, store contents are either unchanged or fully replaced.

**ICS (vitest).**
- Output parsed with `ical.js` (dev dependency). Asserts event count (one per lifespan per entry), `DTSTART` dates, UIDs (distinct per lifespan), summaries (label appended only with more than one lifespan), alarm count per event from that lifespan's stages, trigger values, omitted past alarms, escaping round trip, skipped entries. Cases with one and two lifespans.

**UI unit (vitest + jsdom or happy-dom).**
- Motif functions: output at fraction 0, 0.5, 1 and each tone. Quantisation to 1/20.
- Countdown formatter: boundaries at 5 hrs, today, 59 and 60 days, 23 and 24 months.
- Grouping order by primary tone and hidden empty groups. Accessible name builder (one and two lifespans). Multi-lifespan card: all countdowns shown in declared order, one pill only.

**Playwright on the gallery.**
- Projects: `desktop` (1280 x 800) and `phone` (390 x 844). Theme fixtures core, warm, cool.
- axe via `@axe-core/playwright` on every gallery state, tags `wcag2a`, `wcag2aa`, `wcag21aa`. Zero violations.
- Keyboard flow: Tab through the shell, open the sheet with Enter, assert focus inside and trapped, change a segmented control with arrow keys, see the live preview change, Escape closes, focus returns to the opener. Same for the drawer and the import dialog.
- Layout: no horizontal scroll at 390 px (`scrollWidth <= clientWidth`), exactly one primary pill per screen, interactive targets at least 44 px.
- Reduced motion: `reducedMotion: 'reduce'` shows no running animations (`document.getAnimations()` is empty).
- Network: fail the test on any request to a non-local origin.

**Boundary tests (vitest).** Banned-word scan over `packages/ossuary-core` (skipping the scan test file), import scan for `apps/` and `tools/`, runtime dependency allow-list check against `package.json`.

## Decisions and alternatives

- **`now` is an ISO day plus optional minute.** A full instant would bring the time zone back. The caller converts its local clock once, at the edge. Alternative considered: pass `Date`. Rejected because it makes DST handling the engine's problem.
- **Expiry is end of the `expiresAt` day.** "Today" stays visible all day and day counts are integers.
- **A rule changes the expiry day, not a duration total.** This keeps month and year arithmetic anchored to real calendar days, and keeps the trace delta in days.
- **Hand-written CSV parser.** About 60 lines, no dependency, and it is fuzzable. Alternative: a CSV library. Rejected under the "keep dependencies minimal" rule.
- **Native `<dialog>`** for sheets and import. It gives modal behaviour and Escape for free, at the cost of styling the backdrop and the slide through CSS.
- **Shadow DOM with a shared stylesheet.** Keeps component styles isolated, and the custom properties still cascade in from the shell.
- **`lifespans[]` in one spec, with a computed primary.** An item can carry several countdowns (for example a trial and a cover period) without a second spec or a second item. The primary is the lifespan with the fewest remaining days, ties to the declared order, so the card, list grouping and decay visual always follow the most pressing countdown. Each lifespan owns its rules and stages, so lifespans never interact. The cost is that `Evaluation` is a list plus `primaryIndex` and every consumer (ICS, card, trace, sheet preview) iterates it. A one-lifespan spec stays the common case and renders as before. Alternative considered: a second spec for the same items. Rejected because the items, store and list would split in two.

## Open questions

1. `copy`, `titleField` and `summaryFields` are not in the requested schema list. They are needed by the item card and empty state in DESIGN.md. Drop them if you want the schema strictly as listed.
