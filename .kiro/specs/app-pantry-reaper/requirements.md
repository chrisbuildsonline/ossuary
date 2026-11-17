# Requirements: Pantry Reaper (`apps/pantry-reaper`)

## Introduction

Pantry Reaper is a thin food-expiry app built only on the public API of `packages/ossuary-core` (package `@ossuary/core`). It is one bone spec, one data snapshot and a little glue. It does not restate the skeleton contract, and changes it by two small generic addenda only (requirements 6 and 7). Requirements of that spec (`.kiro/specs/skeleton-contract/requirements.md`) are cited as **C1.1**, **C2.7** and so on.

Domain words (food, shelf life, FoodKeeper) are allowed here and forbidden in the core (C6.1).

Repo layout: the app has no scripts and no vitest or Playwright config of its own. Vite, vitest and Playwright run from the repo root (`bun run dev:pantry`, `build:pantry`, `preview:pantry`, `data:pantry`, `test`, `typecheck`, `e2e`). The app may have an `apps/pantry-reaper/vite.config.ts` for the build and service-worker step. Unit tests live in `apps/pantry-reaper/src` (the root `vitest.config.ts` includes `apps/*/src/**/*.test.ts`) and end-to-end tests in `apps/pantry-reaper/e2e`.

Terms:

- **FoodKeeper**: the USDA FoodKeeper dataset, a US government work in the public domain.
- **Snapshot**: the raw FoodKeeper JSON, downloaded once and committed under `apps/pantry-reaper/data/`.
- **Food**: one mapped entry: `{ id, name, days: { pantry?, fridge?, freezer? } }`, with shelf life as whole days.
- **Storage method**: `pantry`, `fridge` or `freezer`.
- **Food spec**: the bone spec derived for one food (requirement 3.4).

Scope: spec, data, theme and wiring, plus the two core addenda in requirements 6 and 7. Out of scope: custom foods that are not in the snapshot, recall data, accounts, sync, notifications other than ICS alarms, and any other change to `packages/ossuary-core`.

## Requirement 1: Bone spec

**User story:** As the app author, I want the whole app described in `apps/pantry-reaper/bone.json`, so that the skeleton does the work.

### Acceptance criteria

1.1 THE SYSTEM SHALL provide `apps/pantry-reaper/bone.json` that `parseBoneSpec` accepts with `ok: true` (C1.1), with `id` `pantry-reaper` and exactly one lifespan with `id` `best_by` and `label` "Best by" (C1.23).

1.2 THE SYSTEM SHALL declare the item fields `name` (text, required, the `titleField`), `food_id` (text, required, label "FoodKeeper entry", `hidden: true` per requirement 6), `storage` (enum of `pantry`, `fridge`, `freezer`, required) and `bought` (date, required, label "Opened or bought"), and SHALL use `bought` as the lifespan's `startField` (C1.2, C1.5, C1.18).

1.3 THE SYSTEM SHALL declare one `lookup` rule on `storage` with a table entry for every option and a `sourceId` for the FoodKeeper source, and no other rule (C1.6, C1.9). The table values in `bone.json` are template defaults only. Every evaluation uses the food spec from requirement 3.4.

1.4 THE SYSTEM SHALL give the lifespan base a human `label` (for example "Typical shelf life") and SHALL NOT use the label "Base", so that the trace never reads "Base: Base N days" (C2.9).

1.5 THE SYSTEM SHALL declare five stages, one per tone slot, in this order: `fresh` ("Fresh"), `steady` ("Keeping well", `enterAtDays` 14), `soon` ("Use soon", 3), `urgent` ("Eat today", 0) and `dead` ("Spoiled") (C1.11).

1.6 THE SYSTEM SHALL declare the warm theme from `design/DESIGN.md` section 4: `accent` `#b8460e`, `accentInk` `#9a3a0b`, `accentTint` `#fbe9dc`, `canvas` `#f2efea`, `display` `fraunces`, `motif` `candle`, `emptyArt` `candle-jar-moon` and `wordmark` "Pantry Reaper", and no other theme key (C1.12, C1.13, C1.14, C1.15, C1.16).

1.7 THE SYSTEM SHALL declare one source with id `usda_foodkeeper`, an `https` `url`, a `license` stating public domain (US government work) and `retrievedOn` set to the day the snapshot was downloaded (C1.17).

1.8 THE SYSTEM SHALL declare `copy` with `emptyTitle` "Nothing's dying yet." and `addLabel` "Add food".

## Requirement 2: FoodKeeper data

**User story:** As a user, I want shelf life taken from real USDA guidance, so that the dates are not made up.

### Acceptance criteria

2.1 THE SYSTEM SHALL commit the raw snapshot to `apps/pantry-reaper/data/foodkeeper.raw.json`, downloaded once by the maintainer and committed, and SHALL NOT download it at build time, test time or runtime. The repo contains no fetch script.

2.2 THE SYSTEM SHALL provide `apps/pantry-reaper/SOURCE.md` that names the dataset, its download URL, the retrieval day, the public-domain licence note (US government work, no restrictions) and the statement that the app gives guidance, not a safety guarantee.

2.3 WHEN `mapFoodKeeper(raw)` is called THE SYSTEM SHALL return `{ foods, skipped }`, SHALL NOT throw for any input, SHALL validate the raw rows with zod, and SHALL return one food per product row with a name and at least one usable storage method.

2.4 WHEN a product has a shelf-life range for a storage method THE SYSTEM SHALL use the minimum of the range, SHALL convert hours to 1 day (rounded up), weeks to 7 days, months to 30 days and years to 365 days, and SHALL leave the method out when the unit or value is missing or not numeric (for example "When ripe").

2.5 WHERE a product has both a "from purchase" value and a general value for a method THE SYSTEM SHALL use the "from purchase" value.

2.6 THE SYSTEM SHALL build the product name from the product name and its subtitle when one exists, SHALL give each food a stable `id` taken from the dataset id, and SHALL list every skipped row with its row number and a reason.

2.7 THE SYSTEM SHALL commit the mapped result as `apps/pantry-reaper/src/data/foods.json`, produced from the snapshot by the root script `bun run data:pantry`, and a test SHALL fail IF it differs from `mapFoodKeeper` applied to the snapshot.

2.8 WHEN `searchFoods(foods, query)` is called THE SYSTEM SHALL match the query case-insensitively and ignoring accents against the food name, rank names that start with the query before names that contain it, and return at most 8 foods.

2.9 WHEN a product has no usable `fridge` value from either the "from purchase" or the general Refrigerate columns THE SYSTEM SHALL fall back to its `Refrigerate_After_Opening` value, using the same unit conversion, rounding and range-minimum rules as requirement 2.4, SHALL mark that food's `fridge` method as after opening (`afterOpening: true`), and SHALL NOT use the after-opening value when any other usable Refrigerate value exists. WHERE a food's `fridge` method is after opening THE SYSTEM SHALL label the storage option "Fridge (after opening)", so that the trace line for that method names the USDA FoodKeeper after-opening time (requirement 3.6). A product that still has no usable method SHALL stay skipped with a reason (requirement 2.3).

## Requirement 3: App behaviour

**User story:** As a user, I want to find a food, add it, and see how long it keeps in each place, so that I know when to eat it.

### Acceptance criteria

3.1 WHEN the user types in the food search THE SYSTEM SHALL show matching foods from the snapshot as a keyboard-operable listbox, using only `searchFoods` on `foods.json` and making no network request (C6.4).

3.2 WHEN the user picks a food THE SYSTEM SHALL open the core `oss-sheet` with `name` and `food_id` filled, `storage` set to `fridge` (or the first method the food has), and `bought` set to today's local day, and WHEN the user saves THE SYSTEM SHALL write the item through the core store (C3.2, C5.12, C5.13). The sheet SHALL show no input for `food_id`, in the add sheet and in the edit sheet, and saving an edit SHALL keep the stored `food_id` (requirement 6).

3.3 THE SYSTEM SHALL use the namespace `ossuary:pantry-reaper` for its items (C3.1), and SHALL pass the clock and the id generator into the store from the app entry point.

3.4 WHEN an item is evaluated THE SYSTEM SHALL derive the food spec: `bone.json` with the lookup table set to that food's shelf-life days and the `storage` options reduced to the methods the food has, validated with `parseBoneSpec`, and SHALL call `evaluate(foodSpec, item, now)` with `now` built from the local clock at the app edge (C2.1, C2.2). A food spec is never mutated and the derived spec never differs from `bone.json` except in those two places.

3.5 WHEN the user switches an item between `fridge` and `freezer` (or any two methods the food has) THE SYSTEM SHALL update the stored item, re-evaluate, show the new `expiresAt`, and show the toast "Moved to <method>: +N days" or "-N days" with an Undo action that restores the previous method (C5.13, C5.22).

3.6 THE SYSTEM SHALL show the `oss-trace` for the item, and WHEN the user has changed `storage` the trace SHALL include one line that names the lookup rule and the new storage method, the number of days, and the source name "USDA FoodKeeper" (C2.9, C5.16).

3.7 WHEN the user triggers calendar export THE SYSTEM SHALL export the selected item only, calling `exportIcs(foodSpec, [entry], { now })`, and offer the file as a download with the "Calendar file saved" toast (C4.1, C4.8). The file contains one event on the item's `expiresAt`, with alarms at the 14, 3 and 0 day stages that are not in the past (C4.3, C4.4).

3.8 THE SYSTEM SHALL render the list, cards, sheet, trace, empty state and toasts only with the core elements (`oss-shell`, `oss-list`, `oss-item`, `oss-sheet`, `oss-trace`, `oss-empty`, `oss-toast`, `oss-button`), and SHALL add only the small app elements for food search and the storage switch. It SHALL NOT define its own colours, radii or durations (C5.1).

3.9 WHEN the app starts THE SYSTEM SHALL apply the theme from `bone.json` through `oss-shell` and load the Fraunces display font through the core's `loadDisplayFont`, which uses the core's self-hosted font package (C5.2), and the shell SHALL show the candle motif and the `candle-jar-moon` empty state.

3.10 WHILE the item list is empty THE SYSTEM SHALL show `oss-empty` with the add action (C5.17).

3.11 IF the store returns an error THEN THE SYSTEM SHALL show one line and one action, and SHALL NOT throw (C3.12).

3.12 WHERE a food has no value for a storage method THE SYSTEM SHALL NOT offer that method for the food.

3.13 WHEN the user activates the Import tab THE SYSTEM SHALL show the core `oss-import` element for the app's spec and store, and WHEN the user activates the empty state's "or import a list" link THE SYSTEM SHALL open that same element. WHEN the user activates the Backup tab THE SYSTEM SHALL offer a backup download built by the core store export, and a restore control that reads a chosen backup file through the core store import and then refreshes the list. No tab or link SHALL be inert. The app SHALL NOT implement CSV, backup or restore logic of its own (requirement 5.3).

3.14 WHILE the viewport is 390 px wide THE SYSTEM SHALL place the Undo toast above the bottom bar, and SHALL NOT let the toast overlap the bounding box of the selected item's actions ("Add to calendar" and "Edit").

3.15 THE SYSTEM SHALL render the storage switch as a segmented control with one segment per method the food has. It SHALL always have exactly one selected value (the item's current method) and SHALL NOT show a "Required." hint or any other validation message for it.

## Requirement 4: Installable and offline

**User story:** As a user, I want to install the app and use it in the kitchen without a connection, so that it works when my signal does not.

### Acceptance criteria

4.1 THE SYSTEM SHALL ship a web app manifest with `name`, `short_name`, `start_url`, `scope`, `display` `standalone`, `theme_color` `#b8460e`, `background_color` `#f2efea`, and 192 px and 512 px PNG icons (one maskable), linked from `index.html`.

4.2 THE SYSTEM SHALL register a service worker that, on first load, precaches every file of the production build except `sw.js` and source maps (HTML, JS, CSS, the Fraunces and Inter fonts, icons and manifest) and serves them from the cache when the network is unavailable. `foods.json` is imported as a module, so Vite bundles it into a JS file and the build emits no separate `foods.json`. The food data SHALL be inside a precached script. The worker and its precache list are produced by the build step in `apps/pantry-reaper/vite.config.ts`, run by `bun run build:pantry`.

4.3 THE SYSTEM SHALL use a cache name that includes a build hash and delete caches from older builds on activation, and SHALL make requests to same-origin files only.

4.4 WHEN the app has loaded once online THE SYSTEM SHALL reload offline and show the saved items, search foods, add an item, switch storage and export the calendar file, with no failed requests. The offline end-to-end test runs against the built app served by `bun run preview:pantry` on its own port, through a root Playwright `webServer` that builds and previews it. The existing dev-server Playwright project keeps working.

4.5 THE SYSTEM SHALL add no runtime dependency beyond `@ossuary/core` (C6.5). The font package is the core's dependency, not the app's.

## Requirement 5: Boundaries

**User story:** As the maintainer, I want the app to stay thin, so that it proves the skeleton and not a fork of it.

### Acceptance criteria

5.1 THE SYSTEM SHALL import from `@ossuary/core` only through its exports map (C6.3), and a test SHALL fail IF the app imports a path inside the core's `src`.

5.2 THE SYSTEM SHALL NOT import from `apps/warranty-wraith` or `tools/*`, and SHALL NOT change any file outside `apps/pantry-reaper` except: the requirement 6 and requirement 7 addenda in `packages/ossuary-core`, the new scripts in the root `package.json`, and the Pantry Reaper projects and `webServer` entry in the root `playwright.config.ts`.

5.3 THE SYSTEM SHALL keep app glue (everything in `src` except `src/data`) small, with no engine, schema, store or ICS logic of its own. IF the app needs such logic THEN the core is missing something and the gap SHALL be recorded in the open questions of `design.md` instead of coded around.

5.4 THE SYSTEM SHALL have no scripts and no vitest or Playwright config in `apps/pantry-reaper`. The root `package.json` SHALL hold `build:pantry`, `preview:pantry` and `data:pantry` next to the existing `dev:pantry`, and every command in this spec and its tasks SHALL be written as `bun run <script>`.

## Requirement 6: Contract addendum, hidden fields

**User story:** As an app author, I want to keep a value on an item without showing an input for it, so that the add and edit sheet never shows a raw id.

This is one small generic addition to the skeleton contract. It names no domain.

### Acceptance criteria

6.1 THE SYSTEM SHALL accept an optional boolean `hidden` on any field of the bone spec, in `packages/ossuary-core/src/schema`, and `parseBoneSpec` SHALL reject a non-boolean `hidden` with an issue naming the field path.

6.2 THE SYSTEM SHALL validate and store a hidden field exactly like any other field (required, kind and options rules, C3.3), with no change to the item schema, the store, CSV, backup or ICS.

6.3 WHEN `oss-sheet` renders THE SYSTEM SHALL render no input for a hidden field. WHEN the sheet opens with a value for a hidden field (prefill or an item being edited) THE SYSTEM SHALL keep that value and include it on save.

6.4 THE SYSTEM SHALL regenerate `packages/ossuary-core/bone-spec.schema.json` so it includes `hidden`, and the existing drift test (C1.21) SHALL pass.


## Requirement 7: Contract addendum, list stage-group gap

**User story:** As a user on a wide screen, I want cards in the same stage group to stay apart, so that they never touch.

This is a second small generic fix in the core, found at sign-off. It names no domain.

### Acceptance criteria

7.1 WHILE `oss-list` shows its desktop stage-group layout THE SYSTEM SHALL give the stage-group subgrid a non-zero gap (a core spacing token, no new colour, radius or duration), so that two cards in one stage group never touch.

7.2 THE SYSTEM SHALL change only the `oss-list` component, its CSS and its test in `packages/ossuary-core`, and SHALL use no domain word.
