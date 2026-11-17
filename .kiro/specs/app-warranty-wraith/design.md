# Design: Warranty Wraith (`apps/warranty-wraith`)

## Overview

Warranty Wraith is `bone.json`, a CPSC recall snapshot, one matching module and glue that connects the public API of `@ossuary/core` (`packages/ossuary-core`: schema, engine, store, ICS, UI elements, and from this spec the `./pwa` subpath). The contract is in `.kiro/specs/skeleton-contract/`. The sister app is `.kiro/specs/app-pantry-reaper/`, whose layout this design follows.

The app adds one thing the first app did not need: two lifespans on one item. The contract already supports that (C1.23, C2.15, C5.24). It does not yet offer a duration taken from the item, a card for one lifespan, a banner, a shared service worker, or a toast rule for short phones. Those five gaps become four small generic core addenda (sections 0a to 0d), each with core tests and no domain word.

```
data/cpsc-recalls.raw.json --mapCpscRecalls--> src/data/recalls.json     (bun run data:wraith)
bone.json (+ amountField) --evaluate--> two lifespans per purchase --> oss-list / oss-lifespan / oss-trace / ICS
purchase {name, model} + recalls.json --matchRecalls--> matches --> oss-banner (detail) and one line (home)
oss-* elements <-- app.ts (glue) --> store (IndexedDB, ossuary:warranty-wraith)
bun run build:wraith --> dist + sw.js (core plugin) + manifest
```

## Repo integration

The app has no scripts and no vitest or Playwright config. Everything runs from the repo root.

Existing root scripts used as they are: `test` (runs `test-tz.ts --all`), `test:one` (`vitest run`), `typecheck` (`tsc -b`), `e2e` (`playwright test`), `dev:wraith` (`vite apps/warranty-wraith --port 5174 --strictPort`). The root `vitest.config.ts` already includes `apps/*/src/**/*.test.ts`.

New root `package.json` scripts:

| Script | Command | Purpose |
|---|---|---|
| `data:wraith` | `bun apps/warranty-wraith/scripts/build-recalls.ts` | Map the raw snapshot to `src/data/recalls.json`. |
| `icons:wraith` | `bun apps/warranty-wraith/scripts/draw-icons.ts` | Draw the three PWA icons once. Output is committed. |
| `build:wraith` | `vite build apps/warranty-wraith` | Build the app and the service worker. |
| `preview:wraith` | `vite preview apps/warranty-wraith --port 4174 --strictPort` | Serve the built app on its own port. |

The existing root `build` script already builds both apps and is left as it is.

Ports: Pantry Reaper dev 5173 and preview 4173 (unchanged), Warranty Wraith dev 5174 (unchanged) and preview 4174 (new), gallery 5180.

Root `playwright.config.ts` changes (the existing `apps` list already gives Wraith a dev-server project with `testIgnore: '**/offline.spec.ts'`):

- A new project `warranty-wraith-offline` with `testDir: 'apps/warranty-wraith/e2e'`, `testMatch: '**/offline.spec.ts'`, Desktop Chrome and `baseURL: 'http://localhost:4174'`.
- A new `webServer` entry `bun run build:wraith && bun run preview:wraith`, `url: 'http://localhost:4174'`, `reuseExistingServer: false`, `timeout: 120_000`, next to the Pantry Reaper one.

## Directory layout

```
packages/ossuary-core/src/
  schema/lifespans.ts (+ bone-spec.ts, test)   0a: amountField
  engine/rules.ts, evaluate.ts, trace.ts       0a: amount from the item
  pwa/  index.ts precache.ts worker.ts register.ts plugin.ts sw-entry.ts  + tests     0b
  ui/elements/oss-lifespan.ts oss-banner.ts (+ tests), ui/lifespans.ts (orderLifespans)  0c
  ui/elements/oss-toast.ts oss-shell.ts (+ tests)                                       0d
apps/warranty-wraith/
  package.json                    existing: dependency on @ossuary/core, no scripts; devDependencies added (below)
  tsconfig.json                   existing: extended like Pantry Reaper's
  index.html  vite.config.ts      vite.config.ts: `plugins: [ossuaryPwa({ prefix: 'warranty-wraith-' })]` and nothing else
  bone.json
  SOURCE.md                       dataset, request URL, retrieval day, licence note
  data/cpsc-recalls.raw.json      raw snapshot, downloaded once by the maintainer, committed
  scripts/build-recalls.ts        run by bun run data:wraith: raw -> src/data/recalls.json
  scripts/draw-icons.ts           run by bun run icons:wraith
  src/
    data/  cpsc.ts cpsc.test.ts  recalls.json  recalls-snapshot.test.ts  match.ts match.test.ts match.fuzz.test.ts
    spec.ts spec.test.ts          load bone.json, nowFromClock, defaults read from the bone spec
    app.ts app.test.ts            glue: store, evaluate, core elements, ICS, toasts, recalls
    main.ts                       entry: clock, id generator, registerSw()
    boundaries.test.ts  precache.test.ts
  public/  manifest.webmanifest  icon-192.png  icon-512.png  icon-512-maskable.png
  e2e/  smoke.spec.ts  guard.ts  guard.spec.ts  warranty-wraith.spec.ts  offline.spec.ts
```

`package.json` devDependencies: `@types/node`, `fake-indexeddb`, `fast-check`, `happy-dom`, `ical.js`, `zod` (versions as in Pantry Reaper). The runtime dependency stays `@ossuary/core` only.

`tsconfig.json` is extended like Pantry Reaper's: `types` `vite/client` and `node`, `resolveJsonModule`, `allowImportingTsExtensions`, `include` for `src`, `src/**/*.json`, `bone.json`, `e2e`, `scripts` and `vite.config.ts`, and a reference to the core.

## Components and interfaces

### 0a. Core addendum: duration from a number field

The contract's base is `{ type: 'duration', amount, unit }` or `{ type: 'field', field }`. Pantry Reaper got per-item lengths by deriving one spec per food at run time (`specForFood`). That works there because the food is chosen before the sheet opens. Here the user types the length into the sheet, so a derived spec would leave the live preview (C5.13) stale. The core needs the length to come from the item.

- `schema/lifespans.ts`: the `duration` base gains `amountField: ref.optional()`. `amount` stays required and is the default. The `field` base is untouched and still strict.
- `schema/bone-spec.ts`: cross-reference check next to the existing `startField` and `base.field` checks: `amountField` must name a field of kind `number`, issue path `lifespans[i].base.amountField`, message names the key and the kind.
- `engine/rules.ts`: `runLifespan` reads `valueOf(item, amountField)`. A whole number from 0 to 9999 replaces `amount`. A missing value keeps `amount`. `evaluate` checks the value before running (next to `checkLifespanDays`) and returns an issue at the field path for anything else. The base trace step carries the amount actually used, so `trace.ts` prints "30 days" and not the default.
- `bone-spec.schema.json` is regenerated by the existing generator, and the drift test (C1.21) keeps it in sync.

Tests, core only and with neutral words ("widget"): schema (accepts, rejects a text field, rejects a missing field with the path, rejects on a `field` base), engine unit cases (value used, default used, 0, 9999, and 10000, -1 and 1.5 rejected with the field path), a trace test, and the fast-check equivalence property (a spec with `amountField` and item value `n` evaluates equal to the same spec with fixed `amount` `n`), run in the three `TZ` values of `test:tz`.

### 0b. Core addendum: `./pwa`

Moves Pantry Reaper's PWA code into the core and makes the cache prefix a parameter. Nothing in the behaviour changes, which is why Pantry Reaper's built-`dist` test is the acceptance test.

```
packages/ossuary-core/src/pwa/
  index.ts       export { registerSw, startWorker, precacheList, ossuaryPwa } and the types
  precache.ts    precacheList(files, { prefix }): { cacheName, urls }       (was apps/pantry-reaper/src/pwa/precache.ts)
  worker.ts      startWorker(scope, precache), WorkerScope                  (was apps/pantry-reaper/src/sw.ts)
  register.ts    registerSw()                                               (was apps/pantry-reaper/src/pwa/register-sw.ts)
  plugin.ts      ossuaryPwa({ prefix }): Vite plugin                        (was the plugin in apps/pantry-reaper/vite.config.ts)
  sw-entry.ts    the classic-script entry: startWorker(self, __PRECACHE__)  (new, replaces the app's src/sw.ts)
```

- **Prefix.** `Precache` stays `{ cacheName, urls }` so the JSON the plugin writes into `sw.js` keeps its shape and Pantry Reaper's regex-based test is unchanged. `startWorker` takes the prefix from the cache name: `cacheName.replace(/[0-9a-f]{8}$/, '')`.
- **Plugin.** `ossuaryPwa({ prefix })` returns a Vite plugin with `apply: 'build'`. Its `config` hook adds the worker as a second input next to the page (`sw` resolved to `sw-entry.ts` inside the core, `index` resolved from `config.root`) and sets `entryFileNames` so the worker is `sw.js` and `preserveEntrySignatures: false`. Its `writeBundle` hook, with `enforce: 'post'`, reads the written `dist`, calls `precacheList` and replaces `__PRECACHE__` in `sw.js`, as the Pantry Reaper plugin does now. The two `node:` imports sit inside `writeBundle` (`await import('node:fs')`), so a browser bundle that imports `registerSw` from the same subpath does not pull in Node modules. The built-`dist` test would fail loudly if one leaked in (the page script would contain a `node:` import).
- **Native loading.** The apps' `vite.config.ts` imports `@ossuary/core/pwa`, which resolves to a `.ts` file. Pantry Reaper already learned that its config loader needs local imports with extensions. The same rule applies inside `src/pwa`: every relative import ends in `.ts`, only erasable syntax is used (no `enum`, no parameter properties), and `tsconfig.json` of the core gets `allowImportingTsExtensions`. `vite` is a development dependency of the core, for the `Plugin` type only.
- **Apps after the switch.** Each app has `vite.config.ts` with the plugin call, `registerSw()` in its entry point, a manifest, icons and `<link rel="manifest">`. That is all PWA code an app owns.

Tests move with the code. `precache.test.ts` (the `precacheList` cases), `worker.test.ts` (the four `sw.test.ts` cases with a fake `self`) and a plugin test (calls the hooks on a temporary directory and checks `sw.js` carries the list) live in the core. Pantry Reaper keeps its built-`dist` and manifest tests, with the import of `precacheList` pointed at `@ossuary/core/pwa` and `{ prefix: 'pantry-reaper-' }` added.

### 0c. Core addendum: `oss-lifespan` and `oss-banner`

`oss-item` renders every lifespan inside one card with one pill (C5.24). A detail view needs one card per lifespan, each with its own ghost and pill, and a notice banner. Both are small, take their data as properties and own no domain text.

`oss-lifespan` (`packages/ossuary-core/src/ui/elements/oss-lifespan.ts`):

```
properties: lifespan: LifespanEvaluation, now: Now, motif: Motif       attribute: size="s|m" (optional)
+--------------------------+
| RETURN WINDOW   (eyebrow)|        phone (171 px wide): ghost s, number --t-num-m, pill, date
| [ghost]  12 days         |        desktop: ghost m, number --t-num-l
| (~ Closing)              |
| Thu 26 Nov     (<time>)  |
+--------------------------+
```

It reuses `formatCountdown`, `shortDay`, `expirySentence`, `oss-decay` and `oss-pill`. The card is a `section` with `aria-label` from `expirySentence` ("Return window: expires in 12 days, Thursday 26 November."), the digits and the decay are `aria-hidden`. `size` defaults to `isDesktop() ? 'm' : 's'`. A `dead` lifespan shows "N days ago", the dotted-outline decay and the `dead` pill. A default slot below the date lets an app add an action later. Wraith does not use it.

`orderLifespans(evaluation)` in `ui/lifespans.ts` returns `[primary, ...others in declared order]`.

`oss-banner` (`oss-banner.ts`):

```
properties/attributes: tone (default urgent), heading, text, variant="line"?       slot: actions
block:  +----------------------------------------------------------------+
        | (!)  Possible recall match                                     |   role="status"
        |      CPSC 24-117: Acme K2 kettle, overheating   Read notice  [Not my model] |
        +----------------------------------------------------------------+
line:   | (!) 1 possible recall · Acme K2 kettle                      |   one line, ellipsis, 44 px, emits oss-open
```

The tint, glyph and text colours are the tone slot's (DESIGN.md section 3), through the existing `toneCss`. Heading uses the tone's text colour (`#a8261b` on `#fde3df`, 5.82:1) and the body text uses `--text-2`-equivalent from the slot. A slotted `<a>` gets `min-height: 44px`, underline and tone-text colour from `::slotted(a)`, so Wraith can place a real link beside an `oss-button` without a new colour. The line variant is one button-like row.

Both are added to the gallery (`packages/ossuary-core/gallery/gallery.ts`) with neutral text ("Possible match", "widget") in every state and theme, and are covered by the existing axe and keyboard checks.

### 0d. Core addendum: toast clearance on short phones

Why it fails today: `oss-toast` sits 72 px + `--s-6` + the safe-area inset above the bottom of the viewport on phones, and `oss-shell` pads the content bottom by 72 px + `--s-10` + the inset. That covers the toast's offset but not its height, so the last buttons of a page that has to scroll end up under the toast. Pantry Reaper hid this by making its item view fit on one screen down to about 784 px.

The fix has two parts and one rule: the toast tells the page how much room it takes, and the shell reserves it.

- `oss-toast`: after `show()` renders the message, it measures its `.toast` box (`getBoundingClientRect().height`) and sets `--oss-toast-space` on `document.documentElement` to `height + var(--s-3)`. A `ResizeObserver` on the box keeps it current when the message wraps (a long item name, a narrower window). `hide()`, a second `show()` (which sets it again) and `disconnectedCallback` remove it. Where `ResizeObserver` is missing (happy-dom), the value is set from the measurement taken in `show()`.
- `oss-shell`: `main` bottom padding becomes `calc(<existing padding> + var(--oss-toast-space, 0px))` at both widths. The existing padding already covers the toast's offset from the bottom, so the sum is toast offset plus toast height plus a 12 px gap, and it scales with the measured height and the inset.
- Rule: the scroll end of the page is always at least toast height + gap above the bottom bar, so a toast never covers the last row of content. Nothing in the rule names a screen height.

Why this is enough at 664 px: at the scroll end, the content bottom sits at `viewport height − padding`, and the toast box starts below that. Everything above the content bottom is above the toast, so no visible control intersects the toast. A page shorter than the viewport is the same case. The end-to-end tests scroll to the end and hold the toast open before they measure; a real user sees the same after scrolling, and the toast, which auto-dismisses at 5 s, leaves the page as it was.

Pantry Reaper keeps its compact item layout, which still fits at 844 px and above without scrolling. Its check is extended to 664 px, where it now scrolls.

### 1. `bone.json`

Ids are snake_case (`^[a-z][a-z0-9_]*$`), except the app's own `id`, which the core pattern allows to be kebab-case. Values are the real ones from DESIGN.md.

```json
{
  "id": "warranty-wraith",
  "name": "Warranty Wraith",
  "version": 1,
  "entity": {
    "titleField": "name",
    "summaryFields": ["retailer", "model"],
    "fields": [
      { "key": "name", "kind": "text", "label": "Item", "required": true },
      { "key": "retailer", "kind": "text", "label": "Bought at", "required": true },
      { "key": "bought", "kind": "date", "label": "Bought on", "required": true },
      { "key": "return_days", "kind": "number", "label": "Return window (days)", "min": 0, "max": 365, "step": 1 },
      { "key": "warranty_months", "kind": "number", "label": "Warranty (months)", "min": 0, "max": 120, "step": 1 },
      { "key": "price", "kind": "number", "label": "Price", "min": 0, "step": 0.01 },
      { "key": "model", "kind": "text", "label": "Model" },
      { "key": "recalls_dismissed", "kind": "text", "label": "Dismissed recalls", "hidden": true }
    ]
  },
  "lifespans": [
    {
      "id": "return_window", "label": "Return window", "startField": "bought",
      "base": { "type": "duration", "amount": 30, "unit": "day", "amountField": "return_days", "label": "Return window" },
      "stages": [
        { "id": "covered", "label": "Covered", "tone": "fresh" },
        { "id": "closing", "label": "Closing", "tone": "soon", "enterAtDays": 7 },
        { "id": "last_days", "label": "Last days", "tone": "urgent", "enterAtDays": 2 },
        { "id": "lapsed", "label": "Lapsed", "tone": "dead" }
      ]
    },
    {
      "id": "warranty", "label": "Warranty", "startField": "bought",
      "base": { "type": "duration", "amount": 12, "unit": "month", "amountField": "warranty_months", "label": "Warranty" },
      "stages": [
        { "id": "covered", "label": "Covered", "tone": "fresh" },
        { "id": "ending", "label": "Ending", "tone": "steady", "enterAtDays": 90 },
        { "id": "closing", "label": "Closing", "tone": "soon", "enterAtDays": 30 },
        { "id": "last_days", "label": "Last days", "tone": "urgent", "enterAtDays": 7 },
        { "id": "lapsed", "label": "Lapsed", "tone": "dead" }
      ]
    }
  ],
  "theme": { "accent": "#5a4bd1", "accentInk": "#5a4bd1", "accentTint": "#ebe9fb", "canvas": "#edeff6",
             "display": "space-grotesk", "motif": "ghost", "emptyArt": "ghost-parcel", "wordmark": "Warranty Wraith" },
  "copy": { "emptyTitle": "No ghosts in the drawer yet.", "addLabel": "Add purchase" },
  "sources": [{ "id": "cpsc_recalls", "name": "CPSC Recalls", "url": "https://www.saferproducts.gov/RestWebServices/Recall",
                "license": "Public domain (US government work)", "retrievedOn": "<day of the download>" }]
}
```

`retrievedOn` is added by task 2.2 with the real day (task 2.1 leaves it out, because the field is optional and the spec must parse before the snapshot exists).

Why the stage labels repeat: the list group header takes the label of the first entry of a tone. With one label per tone across both lifespans, the "Closing" group reads the same whichever lifespan put a purchase there. `return_window` has no `steady` stage; the lifespans may use different tone subsets.

Why the primary-lifespan rule matters here: a return window ends after 30 days, so for 11 months of a 12-month warranty the return window is `lapsed` and `dead`. The contract's primary rule (C2.15) picks the live warranty, so the card shows "Covered", is grouped as live, and the lapsed return window shows as a smaller "Lapsed" line. Requirement 1.9 tests it.

Defaults come from the spec, not from code: `spec.ts` reads `lifespans[i].base.amount` for the add sheet prefill. A trace for a default purchase bought on Tue 17 Nov 2026 reads "Return window 30 days" then "Expires Thu 17 Dec = 30 days", and "Warranty 12 months" then "Expires Wed 17 Nov 2027 = 365 days".

### 2. Recall data

#### Snapshot

The maintainer downloads once, with `format=json` and a date window (for example `RecallDateStart` five years back) chosen so the mapped file stays under 1 MB, and commits the bytes as `data/cpsc-recalls.raw.json`. There is no fetch script. `SOURCE.md` records the exact request URL, the retrieval day and the licence note as read on the CPSC API page that day.

#### Raw fields

The snapshot `data/cpsc-recalls.raw.json` (request `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2026-06-01`, retrieved 2026-11-17, 264 recalls, 816,658 bytes, recall days 2026-06-04 to 2026-11-12) is a flat JSON array. Every row has these 22 keys: `RecallID`, `RecallNumber`, `RecallDate`, `Description`, `URL`, `Title`, `ConsumerContact`, `LastPublishDate`, `Products`, `Inconjunctions`, `Images`, `Injuries`, `Manufacturers`, `Retailers`, `Importers`, `Distributors`, `SoldAtLabel`, `ManufacturerCountries`, `ProductUPCs`, `Hazards`, `Remedies`, `RemedyOptions`.

The mapper reads only `RecallNumber` (a string such as "27054", no dash), `RecallDate` ("YYYY-MM-DDT00:00:00"; the day is the first 10 characters), `Title`, `URL`, `Products[].Name`, `Products[].Model`, `Manufacturers[].Name`, `Importers[].Name`, `Distributors[].Name` and `Hazards[].Name`.

Facts of the real download:

- `Products[].Model` is an empty string in all 264 rows. A model, when given, is inside the product name, so a model hit cannot fire on this snapshot, and the self-match property of requirement 2.10 is tested on fixture rows.
- `Manufacturers` is non-empty in 49 rows, `Importers` in 145 and `Distributors` in 83. Their names read like "Allstar Marketing Group, LLC, of Winston-Salem, North Carolina" or "Hesung Innovation Corp, dba DREO, of Clifton, New Jerse".
- `URL` is `https://www.cpsc.gov/Recalls/...` in 173 rows and `https://cpsc.gov/Recalls/...` in 91 rows.

One real example row, trimmed to the fields the mapper reads:

```json
{"RecallNumber": "27054", "RecallDate": "2026-10-29T00:00:00", "Title": "DREO Recalls DR-HSH015 Space Heaters Due to Fire and Burn Hazards", "URL": "https://cpsc.gov/Recalls/2027/DREO-Recalls-DR-HSH015-Space-Heaters-Due-to-Fire-and-Burn-Hazards", "Products": [{"Name": "DREO Space Heaters, model DR-HSH015", "Model": ""}], "Manufacturers": [], "Importers": [{"Name": "Hesung Innovation Corp, dba DREO, of Clifton, New Jerse"}], "Distributors": [], "Hazards": [{"Name": "The recalled space heaters can overheat and ignite, posing fire and burn hazards."}]}
```

The zod row schema describes only the fields the mapper reads and ignores the rest, so a renamed field fails in a test and not silently in the app.

#### Mapped shape (`src/data/cpsc.ts`)

```ts
export interface Recall {
  id: string;          // RecallNumber, e.g. "27054"
  date: string;        // ISO day of the recall
  title: string;       // cut to 160 characters
  hazard: string;      // first hazard name, cut to 160 characters, "" when none
  url: string;         // https://www.cpsc.gov/... only; a https://cpsc.gov/ URL is rewritten to the www host
  names: string[];     // product names, trimmed, de-duplicated
  brands: string[];    // from Manufacturers, Importers and Distributors: the first comma-separated part with any text in parentheses removed, plus any part that starts with 'dba ' or 'doing business as ' without that prefix; trimmed, de-duplicated
  models: string[];    // product model strings, split on , ; and "and", trimmed, de-duplicated
}
export interface MapResult { recalls: Recall[]; skipped: { row: number; reason: string }[] }
export function mapCpscRecalls(raw: unknown): MapResult;   // never throws
```

`scripts/build-recalls.ts` reads the raw file, calls `mapCpscRecalls`, writes `src/data/recalls.json` one recall per line (readable diffs) and prints the skipped rows. The mapper uses `zod` and is imported only by the script and by tests, so it is not in the browser bundle.

#### Matching (`src/data/match.ts`, pure, no zod)

```ts
export interface RecallMatch { recall: Recall; score: number; reasons: ('model' | 'brand' | 'name')[] }
export function matchRecalls(item: { name: string; model?: string }, recalls: readonly Recall[]): RecallMatch[];
```

1. `tokens(s)`: NFD, strip marks, lower case, split on `[^a-z0-9]+`, drop tokens shorter than 3 characters, drop stop words (articles and prepositions, and company suffixes such as "inc", "llc", "corp", "ltd", "company", "usa").
2. `compact(s)`: lower case, letters and digits only.
3. Per recalls array (cached in a `WeakMap`, so the function stays pure): `generic` is the set of tokens that occur in the product names of more than 2% of the recalls.
4. Per recall: `brandHit` when all tokens of one brand (and at least one token) are in the item name's tokens; `modelHit` when `compact(item.model)` has at least 4 characters and a digit and equals `compact(m)` for one of the recall's models; `nameHits` is the set of item name tokens that are not brand tokens and appear in the tokens of the recall's `names`; `strong` is `nameHits` without generic tokens.
5. Match when `(modelHit && (brandHit || nameHits.size ≥ 1)) || (brandHit && nameHits.size ≥ 1) || strong.size ≥ 2`.
6. `score = (modelHit ? 3 : 0) + (brandHit ? 2 : 0) + strong.size + 0.5 × (nameHits.size − strong.size)`. Sort by score, then newer `date`, then `id`. Return the first 5.

What this keeps out: "Heater" (one generic token), "The kettle" (generic after stop words), a lone brand ("Acme") and a lone model. What it keeps in: "Acme K2 kettle" with model "K2-100" against a recall by Acme for a kettle with model "K2100" (model and brand), "Rock n Play sleeper" against "Rock 'n Play Sleeper" (two distinctive tokens, no brand needed).

The threshold of 2% and the minimum model length of 4 are constants in the module, covered by tests and easy to change.

### 3. Glue (`src/spec.ts`, `src/app.ts`, `src/main.ts`)

`spec.ts`:

```ts
export const boneSpec: BoneSpec;                         // parseBoneSpec(bone.json), throws at module load if invalid
export const defaults: { returnDays: number; warrantyMonths: number };   // read from the two lifespans' base.amount
export function nowFromClock(d: Date): Now;              // the only place the app reads the clock
```

`nowFromClock` is the same six lines as Pantry Reaper's. It is not shared yet (see Decisions).

`app.ts` (`mountApp(root, deps)`, same shape as Pantry Reaper's) does the following and nothing else:

1. `ensureDocumentTokens`, theme through `oss-shell`, `loadDisplayFont('space-grotesk')`.
2. `openStore(boneSpec, { newId, nowIso })` in the namespace `ossuary:warranty-wraith`. Purchases are evaluated against `boneSpec` directly, with no derived spec.
3. Home: headline (voice from DESIGN.md), the recall line (`oss-banner variant="line"`), the `oss-list`, or `oss-empty`. The shell's primary pill "Add purchase" opens `oss-sheet` with `bought` today, `return_days` and `warranty_months` from `defaults`. The sheet's live preview shows both countdowns (core C5.13).
4. Headline: for every live lifespan with `remaining.days` of 7 or less, count by lifespan id. "N return windows close this week", "N warranties end this week", both joined with "and" in one sentence when both exist, "Nothing closes this week" otherwise.
5. Detail (`#item-<id>`): a title and meta line (retailer, bought date, price when set, model when set), the recall banners, a two-column card row, the trace, the calendar button and the Edit button. The primary pill in the shell is "Done with it".
   - Cards: `orderLifespans(evaluation)` then one `oss-lifespan` each with `motif` `ghost`.
   - Layout (tokens only): a 12-column grid at 900 px and wider with the cards in columns 1 to 4 and 5 to 8 and `oss-trace` in 9 to 12; below 900 px a two-column row for the cards (each 171 px at 390 px), then the trace link (`oss-trace` is a drawer there), then the calendar and edit buttons.
6. Recalls: `matchRecalls({ name, model }, recalls)` per purchase, filtered by the ids in `recalls_dismissed` (split on whitespace). One `oss-banner` per remaining match on the detail view with a "Read notice" `<a href=url target=_blank rel="noopener noreferrer">` and an `oss-button` "Not my model". Dismissing calls `store.update` with the id appended to `recalls_dismissed` (a space-separated list), reloads, and shows the toast "Recall notice hidden" with Undo. The home line counts matches over all purchases the same way.
7. Calendar: `saveCalendar(boneSpec, [{ id, values }], now, toast, download)` from the core. Two events, because `exportIcs` writes one per lifespan.
8. Import and Backup screens, the Import action on the Backup screen for phones, and the restore control: the same wiring as Pantry Reaper (core `oss-import`, store `exportBackup` and `importBackup`), written here with no format logic.
9. Errors: a store error is one line and one action through `oss-list state="error"`.

No custom elements are defined. CSS in `app.ts` is page layout only and uses core tokens.

### 4. PWA

- `public/manifest.webmanifest` (requirement 4.1), icons drawn by `scripts/draw-icons.ts` from the ghost motif in the accent and canvas colours (ghost body in white on the violet accent for the maskable icon with a safe margin, accent ghost on the canvas for the others).
- `vite.config.ts`: `defineConfig({ plugins: [ossuaryPwa({ prefix: 'warranty-wraith-' })] })`. `main.ts` calls `registerSw()` from `@ossuary/core/pwa`. There is no `sw.ts` in the app.
- `recalls.json` is imported as a module (`import recalls from './data/recalls.json'`), so Vite bundles it into a JS chunk. The build emits no separate file and the precache list has no entry for one. The recall data is available offline because that chunk is precached.
- Data lives in IndexedDB, so purchases survive an offline reload without the worker. The worker supplies the shell, the fonts and the JS bundle that contains the recall data.

## Data models

```ts
type Purchase = {
  name: string; retailer: string; bought: IsoDay;
  return_days?: number; warranty_months?: number; price?: number; model?: string;
  recalls_dismissed?: string;   // recall ids separated by a space, e.g. "24-117 23-902"
};
```

Stored through the core as `StoredItem.values` (C3.2). The backup format is the core's (C3.5), so dismissals travel with a backup.

## Error handling

| Where | Failure | Behaviour |
|---|---|---|
| `mapCpscRecalls` | Bad or renamed raw rows | Skipped with row number and reason. Never throws. |
| `matchRecalls` | Odd strings, empty name | Returns `[]`. Never throws. |
| `evaluate` | `return_days` or `warranty_months` not a whole number from 0 to 9999 | The sheet shows the issue next to the field (C5.14). A stored item that fails shows one line and a remove action. |
| Store | Unavailable, blocked, quota | One line and one action (C3.12). |
| Dismiss | `store.update` fails | Toast "Could not hide the notice. Try again." The banner stays. |
| Service worker | Registration fails | App still works online. No offline claim. |
| Offline | Request for a file not in the cache | Navigations fall back to `index.html`, other requests fail quietly. "Read notice" needs a connection, because it opens the CPSC page. |

## Testing strategy

Per `tech.md`, each task writes the failing test first. Everything runs from the root: `bun run test` (all vitest suites, in three time zones), `bun run typecheck`, `bun run e2e`.

**Core (vitest and Playwright, in `packages/ossuary-core`).**
- 0a: schema, engine and trace tests and the equivalence property of section 0a, the sheet-preview test, and the drift test for `bone-spec.schema.json`.
- 0b: `precache.test.ts`, `worker.test.ts`, the plugin test, and an assertion that no file in `src/pwa` has an extension-less relative import (a regular expression test, because the native loader depends on it).
- 0c: happy-dom tests for `oss-lifespan` (name sentence, hidden digits, dead text, size by viewport with a stubbed `matchMedia`, one pill) and `oss-banner` (role, slots, line variant event), `orderLifespans` cases (primary first, one lifespan, three lifespans), and the gallery axe and keyboard checks.
- 0d: `oss-toast` tests (property set from a stubbed box height, updated by a stubbed `ResizeObserver`, removed on hide, replace and disconnect), an `oss-shell` test (the padding rule contains the property), and a gallery test at 390 by 664 in `gallery-phone`: show a toast with Undo, scroll to the end, hold it open, assert the toast box is above the bottom bar and clear of every visible button and link.
- The existing boundary tests run unchanged and now cover the new files (no domain word, no clock in `schema`, `engine`, `ics`, only allowed runtime dependencies).

**Unit (vitest, in `apps/warranty-wraith/src`).**
- `spec.test.ts`: `bone.json` parses; ids are snake_case; field table; two lifespans in order with the stages above; theme equals the DESIGN.md table; theme, copy and wordmark differ from Pantry Reaper's literal values; base labels are not "Base"; the primary-lifespan cases and the fast-check property of requirement 1.9; independence of the two lifespans (requirement 1.10); `defaults` equal the base amounts.
- `cpsc.test.ts`: real-shaped fixture rows: all fields, missing number, bad date, non-CPSC URL, no product names, duplicate names, long title cut, model split, fuzz (`fc.anything()`) never throws.
- `recalls-snapshot.test.ts`: the raw file parses, `SOURCE.md` names the URL, the retrieval day (equal to `retrievedOn` in `bone.json`) and the licence note, `recalls.json` equals `mapCpscRecalls(raw)`, is non-empty, under 1 MB, every URL is `https://www.cpsc.gov/...`.
- `match.test.ts` and `match.fuzz.test.ts`: the examples of section 2 and the properties of requirement 2.10.
- `app.test.ts` (happy-dom, `fake-indexeddb`, fixed clock): empty state; add with defaults; the sheet shows no input for `recalls_dismissed` and the edit keeps it; detail has two `oss-lifespan` cards with the primary first and a lapsed return window second; a recall fixture produces a banner with the right text and link attributes; "Not my model" writes the id, hides the banner, survives a remount, and Undo restores it; the home line counts and disappears; the calendar file, parsed with `ical.js`, has two events with the right dates, summaries, UIDs and alarms; Done with Undo; store error line.
- `boundaries.test.ts`: imports only through the core exports map, no import of `pantry-reaper` or `tools`, runtime dependency allow-list (`@ossuary/core` only), no scripts, no vitest or Playwright config, the root scripts exist with the right ports, no runtime file imports `zod`, and no file in the app defines a service worker (`self.addEventListener`) or registers one.
- `precache.test.ts`: builds the real app (`bun run build:wraith`) and checks the real `dist` as Pantry Reaper's does: every precache URL exists, every built file except `sw.js` and source maps is listed, the page script, CSS, Space Grotesk and Inter fonts, manifest and icons are listed, a known recall id from `recalls.json` appears inside a listed script, the cache name matches `warranty-wraith-` plus 8 hex digits and is the one `precacheList` computes, no listed script contains a `node:` import. Manifest tests: values, icon sizes, link tags.

**Playwright (root `playwright.config.ts`, tests in `apps/warranty-wraith/e2e`).** Two files in two projects, plus the smoke test.

`warranty-wraith.spec.ts` runs in the dev-server project (port 5174), 1280 by 800 and 390 by 844 and 390 by 664:
1. Empty state: title, ghost-in-parcel art, one primary pill.
2. Add a purchase "Acme K2 kettle" with model; the preview shows two countdowns; the sheet has no "Dismissed recalls" input and no "Required." text; save.
3. Home: the card shows the primary countdown and the other lifespan as a line; the headline names the count; the item is not in a lapsed group for an old purchase with a live warranty (add one dated 40 days back through the sheet).
4. Detail: two `oss-lifespan` cards side by side (equal widths within 2 px, same top), the primary first; each card has a ghost; trace lists both lifespans.
5. Recall: use a purchase whose name and model match a real recall from `recalls.json` (the test reads the committed data and builds the purchase from one recall's brand, product name and model, so it follows the data). The banner shows the "Possible recall match" heading, the text, a "Read notice" link with the CPSC URL, `target="_blank"` and `rel` with `noopener noreferrer`, and the home line says "1 possible recall". "Not my model" hides both and survives a reload; Undo brings it back.
6. ICS: download, parse with `ical.js`, two events on the two displayed dates.
7. Look: `--accent` is `#5a4bd1`, canvas `#edeff6`, the countdown number's font family starts with "Space Grotesk", the card decay is the ghost, no horizontal scroll at 390 px, targets of at least 44 px, one primary pill per screen.
8. Toast at 390 by 664 and 390 by 844: dismiss a notice so an Undo toast shows, focus its Undo button, scroll to the end, and assert the toast is above the bottom bar and clear of every visible button and link of the detail view.
9. Import and Backup: both reachable, backup download and restore bring the purchases and the dismissal back; no "Required." on open; Import on phone from the Backup screen.
10. No request to another origin, no console error (the `guard.ts` helper).

`offline.spec.ts` runs in the `warranty-wraith-offline` project (built app on port 4174, started by the root `webServer`): load online, add the recall-matching purchase, wait for the worker to control the page; go offline and reload; the purchase, its dates and its recall banner are still there; add a second purchase, dismiss the notice and export the calendar, all offline; no failed request and no cross-origin request.

`smoke.spec.ts` stays in the dev-server project and is updated in task 3.1 when the page changes.

`guard.ts` and `guard.spec.ts` are the Wraith copy of the network guard (see Decisions).

Pantry Reaper's `signoff.spec.ts` toast test is extended to 390 by 664 (scroll to the end, hold the toast open, same boxes) in task 1.4, and its other tests are untouched.

## Decisions and alternatives

- **A core addendum for the length, not a derived spec per purchase (accepted).** Pantry Reaper derives one spec per food. That is fine when the choice is made before the sheet opens, but here the user edits the number in the sheet, and a spec fixed at `show()` would give a stale live preview, a stale ICS and no CSV support. `amountField` is one optional key, defaults stay in the spec, and every consumer (sheet, trace, ICS, import) works with no glue. Alternative: a `lookup` rule keyed on an enum of common periods. Rejected, since users want any number of days or months.
- **The service worker moves into the core now (accepted).** The user asked for it, and a second copy of a worker is the clearest sign that the core is missing something (requirement 6.3 of Pantry Reaper's spec). The prefix is a parameter, and the precache shape does not change, so Pantry Reaper's built-`dist` test is the proof that nothing changed. Alternative: copy it. Rejected as the opposite of the point of the skeleton.
- **Lazy `node:` imports in the plugin instead of a second subpath or export conditions.** One subpath, `./pwa`, serves both the browser (`registerSw`) and the Vite config (`ossuaryPwa`). The `node:fs` import is inside `writeBundle`, and a test looks for a leaked `node:` import in the built page script. Alternative: a separate `./pwa/vite` subpath. Cleaner on paper, but the request was one subpath, and the test makes a leak visible.
- **Cards and banner are core elements, not app elements (accepted).** DESIGN.md already specifies the recall banner and the two-card detail, and both are generic (a banner with a heading, text and actions; a card for one countdown). Alternative: define `wr-*` elements in the app. Rejected, because the app would then own markup and CSS that Pantry Reaper and every future app also need.
- **One calendar button for both countdowns.** `exportIcs` takes a whole spec and writes one event per lifespan, which is what requirement 3.10 asks for. A button per card, as in the DESIGN.md wireframe, would need a one-lifespan spec derived in the app. The cost of one button is that a user cannot export only the warranty. The calendar app lets them delete an event.
- **Dismissals stored in a hidden field of the purchase.** They are then validated, stored, backed up and restored by the core with no new store. Alternative: a second IndexedDB store or `localStorage`. Rejected, because backup would miss it and `tech.md` puts data in IndexedDB through the core. The hidden field reuses requirement 6 of Pantry Reaper's spec.
- **Cards sorted primary first, not by expiry day.** "The card that dies first" is the primary lifespan while any is live, so a lapsed return window does not jump ahead of a live warranty. When both have lapsed, the one that lapsed last is first, per C2.15.
- **Recall matching by tokens, models and brands, no fuzzy score.** The matcher is small, explainable (`reasons`) and testable with properties. A fuzzy or edit-distance matcher would find more but would raise false alarms on a safety notice. The user can always say "Not my model". The cost is missed matches when the user names an item with no brand or model.
- **Recall data is bundled, not loaded.** A separate fetch at run time would break local-first (no server calls after load). The cost is a larger script (up to 1 MB of JSON in the bundle), bounded by the date window.
- **Duplication kept, for now.** `nowFromClock` (6 lines), the Import and Backup screens (about 60 lines) and `e2e/guard.ts` exist in both apps. Moving them into the core is a further addendum and would change Pantry Reaper's code beyond the PWA switch. They are listed so a later spec can do it.
- **Toast clearance by measured space, not by a taller item view.** Making the Wraith detail fit on a 664 px screen is impossible with two cards, a banner and a trace link. Reserving the toast's measured height at the end of the scroll works for every app and every screen size. Alternative: move the toast above a sticky footer. That still leaves content under the toast while scrolling, so it does not remove the overlap.
- **Primary pill on detail is "Done with it".** DESIGN.md names the label as a spec action (`actions.done.label`), which the schema does not have. The label is a constant in the app. Adding action labels to the schema is out of scope.

## Open questions

None.
