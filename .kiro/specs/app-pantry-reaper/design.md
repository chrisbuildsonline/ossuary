# Design: Pantry Reaper (`apps/pantry-reaper`)

## Overview

Pantry Reaper is `bone.json`, a FoodKeeper snapshot, one mapping module and glue that connects the public API of `@ossuary/core` (`packages/ossuary-core`: schema, engine, store, ICS, UI elements). The contract is in `.kiro/specs/skeleton-contract/`. This design records what the app adds, plus one small generic addendum to the core (optional `hidden` on a field).

```
data/foodkeeper.raw.json --mapFoodKeeper--> src/data/foods.json   (bun run data:pantry)
bone.json + foods.json --specForFood--> food spec --> evaluate / exportIcs / oss-*
oss-* elements <-- main.ts (glue) --> store (IndexedDB, ossuary:pantry-reaper)
bun run build:pantry --> dist + sw.js (precache) + manifest
```

## Repo integration

The app has no scripts and no vitest or Playwright config. Everything runs from the repo root.

Existing root scripts used as they are: `test` (runs `test-tz.ts --all`), `test:one` (`vitest run`), `typecheck` (`tsc -b`), `e2e` (`playwright test`), `dev:pantry` (`vite apps/pantry-reaper --port 5173 --strictPort`). The root `vitest.config.ts` already includes `apps/*/src/**/*.test.ts`, so every unit test lives under `apps/pantry-reaper/src`.

New root `package.json` scripts:

| Script | Command | Purpose |
|---|---|---|
| `data:pantry` | `bun apps/pantry-reaper/scripts/build-foods.ts` | Map the raw snapshot to `src/data/foods.json`. |
| `build:pantry` | `vite build apps/pantry-reaper` | Build the app and the service worker. |
| `preview:pantry` | `vite preview apps/pantry-reaper --port 4173 --strictPort` | Serve the built app on its own port. |

The existing root `build` script is left as it is. Vite loads `apps/pantry-reaper/vite.config.ts` because the app directory is the root argument.

Root `playwright.config.ts` changes:

- The existing `pantry-reaper` project (dev server, port 5173) stays. It gets `testIgnore: '**/offline.spec.ts'` so the offline test only runs against the built app.
- A new project `pantry-reaper-offline` with `testDir: 'apps/pantry-reaper/e2e'`, `testMatch: '**/offline.spec.ts'`, Desktop Chrome and `baseURL: 'http://localhost:4173'`.
- A new `webServer` entry: `command: 'bun run build:pantry && bun run preview:pantry'`, `url: 'http://localhost:4173'`, `reuseExistingServer: false`. The existing entries for the dev servers and the gallery are unchanged.

## Directory layout

```
apps/pantry-reaper/
  package.json                    existing: dependency on @ossuary/core, no scripts; devDependency ical.js
  tsconfig.json                   existing: include extended to vite.config.ts and scripts
  index.html  vite.config.ts      vite.config.ts: precache + service-worker build step only
  bone.json
  SOURCE.md                       dataset, URL, retrieval day, licence note
  data/foodkeeper.raw.json        raw snapshot, downloaded once by the maintainer, committed
  scripts/build-foods.ts          run by bun run data:pantry: raw -> src/data/foods.json
  src/
    data/  foodkeeper.ts  foodkeeper.test.ts  foods.json  foods-snapshot.test.ts  search.ts  search.test.ts
    spec.ts  spec.test.ts         load bone.json, specForFood
    main.ts                       glue: store, evaluate, elements, ICS, toasts
    elements/  pr-food-search.ts  pr-storage-switch.ts
    pwa/  register-sw.ts  precache.ts  precache.test.ts
    sw.ts  sw.test.ts             service worker (hand-written)
    boundaries.test.ts
  public/  manifest.webmanifest  icon-192.png  icon-512.png  icon-512-maskable.png
  e2e/  smoke.spec.ts  pantry-reaper.spec.ts  offline.spec.ts
```

## Components and interfaces

### 0. Core addendum: hidden fields

The one change outside `apps/pantry-reaper` besides root scripts and Playwright config. It names no domain.

- `packages/ossuary-core/src/schema/fields.ts`: the shared field shape gains `hidden: z.boolean().optional()`. Validation of items, the store, CSV, backup and ICS do not change, so a hidden field is validated and stored like any other.
- `packages/ossuary-core/src/ui/elements/oss-sheet.ts`: skips hidden fields when it builds inputs. Values for hidden fields from the prefill or the item being edited are kept and written on save.
- `packages/ossuary-core/bone-spec.schema.json`: regenerated with the existing generator. The existing drift test keeps it in sync.

### 1. `bone.json`

One lifespan, one lookup rule. Ids follow the core id pattern `^[a-z][a-z0-9_]*$`. Values below are the real ones from DESIGN.md. The table numbers are template defaults that pass validation. Real numbers come from the food spec.

```json
{
  "id": "pantry-reaper",
  "name": "Pantry Reaper",
  "version": 1,
  "entity": {
    "titleField": "name",
    "summaryFields": ["storage"],
    "fields": [
      { "key": "name",    "kind": "text", "label": "Food", "required": true },
      { "key": "food_id", "kind": "text", "label": "FoodKeeper entry", "required": true, "hidden": true },
      { "key": "storage", "kind": "enum", "label": "Storage", "required": true, "options": [
          { "value": "pantry", "label": "Pantry" },
          { "value": "fridge", "label": "Fridge" },
          { "value": "freezer", "label": "Freezer" } ] },
      { "key": "bought",  "kind": "date", "label": "Opened or bought", "required": true }
    ]
  },
  "lifespans": [{
    "id": "best_by",
    "label": "Best by",
    "startField": "bought",
    "base": { "type": "duration", "amount": 7, "unit": "day", "label": "Typical shelf life" },
    "rules": [{
      "id": "storage_life", "kind": "lookup", "field": "storage", "label": "Storage",
      "table": { "pantry": { "amount": 30, "unit": "day" },
                 "fridge": { "amount": 7,  "unit": "day" },
                 "freezer": { "amount": 180, "unit": "day" } },
      "sourceId": "usda_foodkeeper"
    }],
    "stages": [
      { "id": "fresh",  "label": "Fresh",        "tone": "fresh" },
      { "id": "steady", "label": "Keeping well", "tone": "steady", "enterAtDays": 14 },
      { "id": "soon",   "label": "Use soon",     "tone": "soon",   "enterAtDays": 3 },
      { "id": "urgent", "label": "Eat today",    "tone": "urgent", "enterAtDays": 0 },
      { "id": "spoiled","label": "Spoiled",      "tone": "dead" }
    ]
  }],
  "theme": { "accent": "#b8460e", "accentInk": "#9a3a0b", "accentTint": "#fbe9dc",
             "canvas": "#f2efea", "display": "fraunces", "motif": "candle",
             "emptyArt": "candle-jar-moon", "wordmark": "Pantry Reaper" },
  "copy": { "emptyTitle": "Nothing's dying yet.", "addLabel": "Add food" },
  "sources": [{ "id": "usda_foodkeeper", "name": "USDA FoodKeeper",
                "url": "https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json", "license": "Public domain (US government work)",
                "retrievedOn": "2026-11-17" }]
}
```

`url` and `retrievedOn` are filled in by task 2.1 from the real download. The stage glyph and colour for each tone come from the core (C5.8). The trace reads, for a yogurt moved to the freezer: "Typical shelf life 7 days", then "Storage is Freezer: 60 days (USDA FoodKeeper)", total `= 60 days`. The base line names a human label, never "Base".

Stage thresholds are time based, so a stage label never names a storage place.

### 2. FoodKeeper mapping (`src/data/foodkeeper.ts`)

```ts
export type StorageMethod = 'pantry' | 'fridge' | 'freezer';
export interface Food {
  id: string; name: string;
  days: Partial<Record<StorageMethod, number>>;
  afterOpening?: true;   // set only when days.fridge came from the Refrigerate_After_Opening fallback
}
export interface MapResult { foods: Food[]; skipped: { row: number; reason: string }[] }
export function mapFoodKeeper(raw: unknown): MapResult;   // never throws
```

The snapshot is the FoodKeeper JSON from the real download (file name `FMA-Data-v128.xlsx`, 631,800 bytes). Its shape is `{ fileName, sheets: [{ name, data, maxRows, maxCols }] }`, with the sheets `Version`, `Category`, `Product`, `CookingTips`, `CookingMethods` and `Data Dictionary`. The mapper reads only the `Product` sheet, which has 661 rows. Its columns are:

- Identity: `ID`, `Category_ID`, `Name`, `Name_subtitle`, `Keywords`.
- Per storage method, a minimum, a maximum and a metric, for pantry, refrigerate and freeze: `Pantry_Min`, `Pantry_Max`, `Pantry_Metric`, `Refrigerate_Min`, `Refrigerate_Max`, `Refrigerate_Metric`, `Freeze_Min`, `Freeze_Max`, `Freeze_Metric`.
- The separate "from purchase" (date of purchase) variants of the same nine columns, prefixed `DOP_`: `DOP_Pantry_Min`, `DOP_Pantry_Max`, `DOP_Pantry_Metric`, `DOP_Refrigerate_Min`, `DOP_Refrigerate_Max`, `DOP_Refrigerate_Metric`, `DOP_Freeze_Min`, `DOP_Freeze_Max`, `DOP_Freeze_Metric`.

The mapper ignores the `*_tips` and `*_Tips` columns, the `Refrigerate_After_Thawing_*` columns, every `*_After_Opening_*` column except the three `Refrigerate_After_Opening_*` ones (minimum, maximum and metric, used only by the fallback below), and every other sheet. A zod schema describes only the columns the mapper reads and ignores the rest, so a changed column fails loudly in a test and not silently in the app.

The maintainer downloaded the snapshot once and committed it as `data/foodkeeper.raw.json`. The repo has no fetch script. The dataset licence is CC0 1.0. The live FSIS URL (`https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json`) returned HTTP 403 from the download environment, so the committed bytes come from the Internet Archive copy `https://web.archive.org/web/20250314020622id_/https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json`, retrieved 2026-11-17. The `url` of the `usda_foodkeeper` source in `bone.json` is the official FSIS URL and `retrievedOn` is `2026-11-17`. `SOURCE.md` records the Internet Archive URL, the catalog page `https://catalog.data.gov/dataset/fsis-foodkeeper-data`, the retrieval day and the licence.

`scripts/build-foods.ts` reads `data/foodkeeper.raw.json`, calls `mapFoodKeeper`, and writes `src/data/foods.json`. The root script `data:pantry` runs it.

Rules (requirements 2.3 to 2.6):

- `days = minimum * unitFactor`, with hours rounded up to 1 day, weeks x 7, months x 30, years x 365. Anything else (missing, zero, "When ripe") leaves that method out.
- A "from purchase" value wins over the general value.
- The minimum is used because the app errs on the early side for food.
- After-opening fallback (requirement 2.9): only when neither the `DOP_Refrigerate_*` nor the `Refrigerate_*` columns give a usable value, `days.fridge` is taken from `Refrigerate_After_Opening_*` with the same conversion, rounding and range-minimum rules, and the food gets `afterOpening: true`. The flag belongs to the `fridge` method, the only method with an after-opening column, and it is omitted (not `false`) otherwise, so existing entries in `foods.json` do not change. This lets sour cream, soy milk and almond milk be mapped and found by search. The fallback never overrides a usable Refrigerate value.
- Storage option label: `specForFood` labels the `fridge` option "Fridge (after opening)" when `food.afterOpening` is true, and "Fridge" otherwise. The rule table and the other options are unchanged. The lookup trace line then reads "Storage is Fridge (after opening): N days (USDA FoodKeeper)", so the value is shown as the after-opening time and not as a general fridge life. This label is part of the "options" difference the derived spec is allowed to have (section 3).
- A product with no usable method, after the fallback, is skipped with a reason.
- Name is `name` plus `, subtitle` when present.

`searchFoods(foods, query)`: normalise with `toLowerCase()` and `normalize('NFD')` with accent marks removed, rank prefix before substring, then alphabetical, limit 8.

### 3. Food spec (`src/spec.ts`)

```ts
export const boneSpec: BoneSpec;                       // parseBoneSpec(bone.json), throws at module load if invalid
export function specForFood(food: Food): BoneSpec;     // cached by food id
export function nowFromClock(d: Date): Now;            // the only place the app reads the clock
```

The contract has one static lookup table per spec, but shelf life differs per food. The app handles that without touching the core: `specForFood` clones `boneSpec`, replaces the table of rule `storage_life` with `food.days` converted to `{ amount, unit: 'day' }`, removes `storage` options the food lacks, and runs `parseBoneSpec` on the result. Validation C1.9 then guarantees a table entry for every offered method. The clone differs from `bone.json` in those two places only, and a test proves it.

Items are stored against `boneSpec` (all three options). Evaluation, ICS and the trace use `specForFood`. The list passes each item's own evaluation to `oss-list` (its `entries[].evaluation`), and `exportIcs` is called for the one item being exported, so one spec per call is enough.

### 4. Glue (`src/main.ts`) and app elements

`main.ts` does the following and nothing else:

1. Parse the spec, `applyTheme` through `oss-shell`, `loadDisplayFont('fraunces')`.
2. `openStore(boneSpec, { newId: crypto.randomUUID, nowIso })`.
3. Render `oss-shell` with `oss-list` (or `oss-empty`), the primary pill "Add food" and the "Calendar" action.
4. For each stored item, find the food by `food_id`, evaluate with `specForFood(food)` and `nowFromClock(new Date())`. An item whose food is no longer in the snapshot is shown with the evaluation error text and an action to remove it.
5. `pr-food-search`: a text input with a listbox (`role="combobox"`, arrow keys, Enter to pick, Escape to close) over `searchFoods`. Picking opens `oss-sheet` with the prefilled values (3.2). The sheet shows `name`, `storage` and `bought`. `food_id` is hidden (requirement 6), so no raw id is ever shown, and edits keep it.
6. `pr-storage-switch`: a thin wrapper that renders `oss-field` for `storage` with only the food's methods. On change it calls `store.update`, re-evaluates, builds the toast text from the difference of the two `expiresAt` day numbers, and shows `oss-toast` with Undo.
7. `oss-trace` on the detail view for the selected item.
8. Calendar button: exports the selected item with `exportIcs`, then the core download helper and toast.

The two app elements use the core's tokens and the shared stylesheet helper. They add no colours, radii or durations.

### 5. PWA

- `public/manifest.webmanifest` (requirement 4.1). Icons are drawn once in a script from the candle motif, kept as PNGs, and use the accent and canvas colours.
- `src/pwa/precache.ts`: a pure function that turns the list of emitted files and their contents into `{ cacheName, urls }`, where the cache name carries a hash of the build. It is unit tested in `src/pwa/precache.test.ts`.
- `vite.config.ts`: a small plugin that, after the bundle is generated, calls that function over the emitted files, writes the list into the service worker and emits `sw.js` next to the app. This is the only build-step code in the app.
- `src/sw.ts`: on `install`, `cache.addAll` of the list. On `activate`, delete caches not named for this hash and `clients.claim()`. On `fetch`, same-origin GET only: cache first, falling back to the network, and for navigations falling back to the cached `index.html`.
- `register-sw.ts` registers the worker after `load`, in production builds only.
- No Workbox and no PWA plugin. The worker is about 40 lines and has no dependency.
- Data lives in IndexedDB, so items survive offline reloads without the worker. The worker supplies the shell, fonts and `foods.json`.

## Data models

```ts
type PantryItem = { name: string; food_id: string; storage: 'pantry' | 'fridge' | 'freezer'; bought: IsoDay };
```

Stored through the core as `StoredItem.values` (C3.2). Backup format is the core's (C3.5).

## Error handling

| Where | Failure | Behaviour |
|---|---|---|
| `mapFoodKeeper` | Bad or changed raw rows | Skipped with row number and reason. Never throws. |
| `specForFood` | Derived spec invalid | Throws in tests only. At runtime the item shows an error line and a remove action. |
| Item | Food id not in snapshot | Error line and remove action. |
| Store | Unavailable, blocked, quota | One line and one action (C3.12). |
| Service worker | Registration fails | App still works online. Offline claim is not made. |
| Offline | Request for a file not in cache | Navigations fall back to `index.html`, other requests fail quietly. |

## Testing strategy

Per `tech.md`, each task writes the failing test first. Everything runs from the root: `bun run test` (all vitest suites), `bun run typecheck`, `bun run e2e`.

**Core addendum (vitest, in `packages/ossuary-core`).**
- Schema test next to `fields.ts`: `hidden: true` and `hidden: false` parse, a non-boolean `hidden` is rejected with the field path, and an item with a hidden required field still fails validation when the value is missing.
- `json-schema.test.ts`: the checked-in `bone-spec.schema.json` equals the generated one and contains `hidden`.
- Sheet test next to `oss-sheet.ts`: a hidden field renders no input, a prefilled or edited hidden value is kept and saved.

**Unit (vitest, in `apps/pantry-reaper/src`).**
- `foodkeeper.test.ts`: a small fixture of raw rows. Cases: days, weeks, months and years conversion, hours rounded up, "When ripe" dropped, minimum of a range, "from purchase" value preferred, name plus subtitle, skipped row with reason, fuzzed input (`fc.anything()`) never throws. After-opening fallback: a row with only `Refrigerate_After_Opening` gets `days.fridge` and `afterOpening: true`; the same unit, rounding and range-minimum rules apply; a row with a usable `Refrigerate` or `DOP_Refrigerate` value ignores the after-opening value and has no `afterOpening` flag; a row with an unusable after-opening value and nothing else is skipped with a reason.
- `foods-snapshot.test.ts`: `foods.json` equals `mapFoodKeeper(raw)`, has at least one food for each of yogurt, chicken, spinach and bread (real names, found by search), and every food has at least one method. It also asserts that "sour cream" is present, found by `searchFoods`, with a `fridge` value and `afterOpening: true`.
- `search.test.ts`: case, accents, prefix before substring, limit 8, empty query.
- `spec.test.ts`: `bone.json` parses; `food_id` is hidden; one lifespan, five stages with the five tones in order; theme values equal the DESIGN.md table; trace base label is not "Base"; the derived spec differs from `bone.json` only in the table and the options; a food without a freezer value has no freezer option; a food with `afterOpening: true` has the option label "Fridge (after opening)" and a trace line that contains "Storage", "Fridge (after opening)" and "USDA FoodKeeper", while other foods keep the label "Fridge"; evaluating yogurt-like food with fixed `now` gives the expected `expiresAt` for fridge and freezer, and the trace line contains "Storage", the method and "USDA FoodKeeper".
- `boundaries.test.ts`: imports only from the core exports map, no import of `warranty-wraith` or `tools`, runtime dependency allow-list (`@ossuary/core` only).
- `precache.test.ts` and `sw.test.ts`: the file list includes the index, JS, CSS, fonts, manifest and `foods.json`, the cache name changes when a file changes, and the worker handles same-origin GET only.

**Playwright (root `playwright.config.ts`, tests in `apps/pantry-reaper/e2e`).** Two files in two projects.

`pantry-reaper.spec.ts` runs in the existing `pantry-reaper` project (dev server, port 5173). One flow test at 1280 x 800 and a short check at 390 x 844:
1. Open the app. Empty state shows "Nothing's dying yet." and the candle art.
2. Type "yogurt", pick the first real result with the keyboard. The sheet has no input labelled "FoodKeeper entry". Save with the default fridge. The list shows it with a countdown and a stage pill.
3. Read the date. Switch to freezer. The date is later than before, the toast says "Moved to freezer: +N days", and the trace has one line naming "Storage", "Freezer" and "USDA FoodKeeper".
4. Download the calendar file, parse it (ical.js, dev dependency of the app), and assert one event whose date equals the displayed date.
5. Open the edit sheet. It has no raw id input, and saving keeps the item's food.
6. Assert there was no request to another origin.
7. Style checks: `--accent` computes to `#b8460e` and the display font family is Fraunces.

`offline.spec.ts` runs in the `pantry-reaper-offline` project (built app on port 4173, started by the root `webServer`):
1. Load online, add an item, wait for the service worker to control the page.
2. Set the context offline and reload. The item is still there with the same date.
3. Search a second food, add it, switch storage, and export the calendar file, all offline.
4. Assert no request to another origin and no failed request during the offline part.

`smoke.spec.ts` stays in the dev-server project. Task 4.1 updates it if the page changes.

## Decisions and alternatives

- **Per-food spec derived in the app (accepted for the hackathon).** The contract's lookup table is fixed in the spec, so per-food shelf life needs one spec per food. Alternative: put every food and method into `bone.json` under a composite text key. Rejected because it makes the spec huge and the trace unreadable. Alternative: ask the core for per-item lookup tables. Not done now. If the core later lets a lookup read its table from the item, `specForFood` can go.
- **Hidden `food_id` through a generic core addendum.** The core sheet makes one input per spec field (C5.12), so `food_id` would show a raw id. Decision: add one optional boolean `hidden` to a field in the bone spec schema. Hidden fields are validated and stored, and the sheet renders no input for them. It is one task, test first, and `bone.json` marks `food_id` hidden. Alternative: a read-only field kind. Rejected because it still shows the id. Alternative: store the food id outside the item. Rejected because it splits one record in two.
- **Calendar exports the selected item (accepted).** `exportIcs` takes one spec per call, and each item has its own food spec. A combined file of all items would need a spec per entry in the core. Not needed for the hackathon.
- **Repo layout follows the root.** The app has no scripts and no test configs. Vite, vitest and Playwright run from the repo root, with `bun run` scripts for data, build and preview. A `vite.config.ts` in the app holds only the build and service-worker step. Alternative: per-app scripts and configs. Rejected because the repo already runs all apps from the root.
- **Offline test on the built app.** The service worker exists only in the production build, so the offline test uses a separate Playwright project and a `webServer` that builds and previews the app on its own port. The dev-server project stays for everything else.
- **Raw snapshot downloaded once, no fetch script.** The maintainer downloads it and commits it. `SOURCE.md` records the URL and the day. Nothing in the repo can change the data by accident.
- **Minimum of the FoodKeeper range.** Safer for food and simple. The cost is conservative dates.
- **Committed snapshot plus committed mapped file.** The app never fetches data and the build is reproducible. A test keeps the two in sync.
- **Hand-written service worker.** No dependency, small, and testable. Alternative: a PWA plugin. Rejected under the minimal-dependencies rule.
- **Only foods in the snapshot.** Custom foods would need a manual shelf-life entry and a second code path. Left out to keep the app thin.

## Open questions

1. **Exact FoodKeeper columns and URL. Resolved (2026-11-17).** Confirmed against the real download: the sheets, the 661-row `Product` sheet and its columns are listed in section 2. The official FSIS URL is `https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json` (also listed as `http://www.fsis.usda.gov/shared/data/EN/foodkeeper.json`). It returned HTTP 403 (Akamai "Access Denied") from the download environment, so the snapshot came from the Internet Archive copy `https://web.archive.org/web/20250314020622id_/https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json`. Licence: CC0 1.0 (`https://catalog.data.gov/dataset/fsis-foodkeeper-data`). `bone.json` cites the official URL, and `SOURCE.md` holds the archive URL.
