# Requirements: Warranty Wraith (`apps/warranty-wraith`)

## Introduction

Warranty Wraith is the second app on the Ossuary skeleton. It tracks purchases with two countdowns each (a return window and a warranty), checks each purchase against a snapshot of US CPSC product recalls, and exports both countdowns to a calendar. It is built only on the public API of `packages/ossuary-core` (package `@ossuary/core`): one bone spec, one data snapshot and a little glue. It does not restate the skeleton contract (`.kiro/specs/skeleton-contract/requirements.md`, cited as **C1.1**, **C2.15** and so on) and it follows the layout and rules of `.kiro/specs/app-pantry-reaper/`.

Domain words (warranty, return window, recall, CPSC) are allowed in the app and forbidden in the core (C6.1).

The app proves the skeleton is reusable, so it must not look like a second skin of Pantry Reaper (requirement 5). Where the core cannot do what the app needs, this spec adds small generic addenda to the core, with no domain word and with core tests (requirements 7 to 10). Requirement 8 also moves the service worker code that Pantry Reaper wrote into the core, so that neither app owns a copy.

Repo layout: the app has no scripts and no vitest or Playwright config of its own. Vite, vitest and Playwright run from the repo root (`bun run dev:wraith`, `build:wraith`, `preview:wraith`, `data:wraith`, `icons:wraith`, `test`, `typecheck`, `e2e`). The app has an `apps/warranty-wraith/vite.config.ts` that only calls the core plugin from requirement 8. Unit tests live in `apps/warranty-wraith/src` (the root `vitest.config.ts` includes `{packages,apps,tools}/*/src/**/*.test.ts`) and end-to-end tests in `apps/warranty-wraith/e2e`.

Terms:

- **Return window**: the lifespan `return_window`, in days from the purchase day.
- **Warranty**: the lifespan `warranty`, in months from the purchase day.
- **Purchase**: one stored item of this app.
- **CPSC**: the US Consumer Product Safety Commission. Its Recalls REST API (`saferproducts.gov`) is a US government work.
- **Snapshot**: the raw CPSC recalls JSON, downloaded once and committed under `apps/warranty-wraith/data/`.
- **Recall**: one mapped entry of `src/data/recalls.json` (shape in `design.md`).
- **Match**: a recall that `matchRecalls` returns for a purchase. A match is a possible recall, never a confirmation.
- **Dismissed**: a match the user hid with "Not my model".
- **Snake_case id**: an id that matches `^[a-z][a-z0-9_]*$`.

Scope: spec, data, theme and wiring, plus the four core addenda in requirements 7 to 10. Out of scope: recalls outside the snapshot, live recall lookups, recall sources other than CPSC, receipt photos or scans, price or currency features, accounts, sync, notifications other than ICS alarms, per-countdown calendar files, `tools/bone-forge`, and any other change to `packages/ossuary-core` or `apps/pantry-reaper`.

## Requirement 1: Bone spec

**User story:** As the app author, I want the whole app described in `apps/warranty-wraith/bone.json`, so that the skeleton does the work.

### Acceptance criteria

1.1 THE SYSTEM SHALL provide `apps/warranty-wraith/bone.json` that `parseBoneSpec` accepts with `ok: true` (C1.1), with `id` `warranty-wraith` (the core's app id pattern allows `-` there) and exactly two lifespans in this order: `return_window` with `label` "Return window" and `warranty` with `label` "Warranty" (C1.23).

1.2 THE SYSTEM SHALL use snake_case ids for every field key, lifespan id, rule id, stage id and source id in `bone.json`, and a test SHALL match each of them against `^[a-z][a-z0-9_]*$`.

1.3 THE SYSTEM SHALL declare these fields, in this order (C1.2, C1.4, C1.18):

| key | kind | label | required | other |
|---|---|---|---|---|
| `name` | text | Item | yes | `titleField` |
| `retailer` | text | Bought at | yes | |
| `bought` | date | Bought on | yes | |
| `return_days` | number | Return window (days) | no | `min` 0, `max` 365, `step` 1 |
| `warranty_months` | number | Warranty (months) | no | `min` 0, `max` 120, `step` 1 |
| `price` | number | Price | no | `min` 0, `step` 0.01 |
| `model` | text | Model | no | |
| `recalls_dismissed` | text | Dismissed recalls | no | `hidden: true` |

and `summaryFields` `["retailer", "model"]`.

1.4 THE SYSTEM SHALL give both lifespans `startField` `bought` (C1.5), no rules, and a duration base with `amountField` (requirement 7): `return_window` with `unit` `day`, `amount` 30, `amountField` `return_days` and base label "Return window", and `warranty` with `unit` `month`, `amount` 12, `amountField` `warranty_months` and base label "Warranty". The base `amount` is the default: the add sheet prefills the number fields from it, and an item without a value uses it (requirement 7.3).

1.5 THE SYSTEM SHALL declare stages per lifespan with the same label for the same tone in both lifespans, so that a list group header reads the same whichever lifespan is primary (C1.11):

- `return_window`: `covered` (tone `fresh`, "Covered"), `closing` (`soon`, "Closing", `enterAtDays` 7), `last_days` (`urgent`, "Last days", 2), `lapsed` (`dead`, "Lapsed").
- `warranty`: `covered` (`fresh`, "Covered"), `ending` (`steady`, "Ending", 90), `closing` (`soon`, "Closing", 30), `last_days` (`urgent`, "Last days", 7), `lapsed` (`dead`, "Lapsed").

1.6 THE SYSTEM SHALL declare the cool theme from `design/DESIGN.md` section 4: `accent` `#5a4bd1`, `accentInk` `#5a4bd1`, `accentTint` `#ebe9fb`, `canvas` `#edeff6`, `display` `space-grotesk`, `motif` `ghost`, `emptyArt` `ghost-parcel` and `wordmark` "Warranty Wraith", and no other theme key (C1.12 to C1.16).

1.7 THE SYSTEM SHALL declare one source with id `cpsc_recalls`, an `https` `url` (the request URL of the snapshot, without query), a `license` stating public domain (US government work) and `retrievedOn` set to the day the snapshot was downloaded (C1.17).

1.8 THE SYSTEM SHALL declare `copy` with `emptyTitle` "No ghosts in the drawer yet." and `addLabel` "Add purchase".

1.9 WHEN a purchase has a lapsed return window and a live warranty THE SYSTEM SHALL evaluate it with the warranty as primary lifespan, so that its stage tone is not `dead` and the list never groups it as lapsed (C2.15). A test SHALL cover this with fixed `now` values: default periods and a purchase 40 days old (return window 10 days past, warranty live) gives `primaryIndex` 1 and a non-`dead` stage. A fast-check property over `return_days` 0 to 365, `warranty_months` 0 to 120 and purchase ages SHALL hold: IF either lifespan is live THEN the primary is live and its stage is not `dead`, and the item is `dead` only WHEN both lifespans have lapsed.

1.10 WHEN `return_days` or `warranty_months` changes THE SYSTEM SHALL change the expiry of that lifespan only, and a test SHALL assert that the other lifespan's evaluation is deeply equal (C2.14).

## Requirement 2: Recall data and matching

**User story:** As a user, I want to be told when something I bought may be recalled, using real government data, so that I can act on it.

### Acceptance criteria

2.1 THE SYSTEM SHALL commit a real snapshot of US CPSC recalls to `apps/warranty-wraith/data/cpsc-recalls.raw.json`, downloaded once by the maintainer from the public CPSC Recalls REST API (`https://www.saferproducts.gov/RestWebServices/Recall`) with `format=json`, and SHALL NOT download it at build time, test time or runtime. The repo contains no fetch script. The snapshot SHALL be real data, never a fixture or a hand-written sample.

2.2 THE SYSTEM SHALL provide `apps/warranty-wraith/SOURCE.md` that names the dataset, the full request URL with its query (including the date window), the retrieval day, the licence note (US government work, public domain, as stated on the CPSC API page on that day), and the statement that a recall match is a possible match for the user to check, not a confirmation.

2.3 WHEN `mapCpscRecalls(raw)` is called THE SYSTEM SHALL return `{ recalls, skipped }`, SHALL NOT throw for any input, SHALL validate the raw rows with zod, and SHALL return one recall per row that has a recall number, a real recall day, a title, a CPSC notice URL and at least one product name. Every other row SHALL be listed in `skipped` with its row number and a reason.

2.4 THE SYSTEM SHALL map each recall to the fields `{ id, date, title, hazard, url, names, brands, models }` (shape in `design.md`), SHALL keep `url` only WHEN it is an `https` URL on the host `www.cpsc.gov`, SHALL cut `title` and `hazard` to 160 characters, and SHALL de-duplicate and trim `names`, `brands` and `models` and drop empty ones.

2.5 THE SYSTEM SHALL commit the mapped result as `apps/warranty-wraith/src/data/recalls.json`, produced from the snapshot by the root script `bun run data:wraith`, no larger than 1 MB (the date window in `SOURCE.md` is chosen to fit), and a test SHALL fail IF the file differs from `mapCpscRecalls` applied to the snapshot, IF it is empty, or IF it holds a recall without an `https` `www.cpsc.gov` URL.

2.6 WHEN `matchRecalls(item, recalls)` is called with `item` `{ name, model? }` THE SYSTEM SHALL return at most 5 matches, each `{ recall, score, reasons }`, ranked by score, then by newer recall day, then by id. It SHALL be a pure function: no network, no clock, no mutation of its arguments, and the same inputs give deeply equal outputs.

2.7 THE SYSTEM SHALL compare text only after normalisation: Unicode NFD with accent marks removed, lower case, every run of characters outside `a-z0-9` as a separator, tokens shorter than 3 characters dropped and a fixed stop-word list dropped (for example "the", "and", "for", "with"). A **generic token** is a token that occurs in the product names of more than 2% of the recalls given to the call (computed from `recalls`, cached per array, so the function stays pure). A model is compared as its compact form (lower case letters and digits only, no separators).

2.8 THE SYSTEM SHALL compute three signals per recall: a **model hit** (the item model's compact form, at least 4 characters long and containing a digit, equals the compact form of one of the recall's models), a **brand hit** (all tokens of one of the recall's brands appear among the item name's tokens) and **name hits** (the distinct item name tokens, brand tokens excluded, that appear among the tokens of the recall's product names). It SHALL return the recall only WHEN (model hit AND (brand hit OR at least one name hit)) OR (brand hit AND at least one name hit) OR at least two distinct non-generic name hits.

2.9 THE SYSTEM SHALL NOT return a match on a lone generic word, a lone brand, or a lone model. A purchase named only with generic or stop words (for example "Heater" or "The kettle") SHALL match nothing.

2.10 THE SYSTEM SHALL test `matchRecalls` and `mapCpscRecalls` with unit tests on a small fixture of real-shaped rows and with fast-check fuzz tests (fixed seeds) that hold these properties: arbitrary strings for name and model never throw; an empty name matches nothing; case, accents, punctuation and token order in the item name do not change the result; the result has at most 5 entries and is ranked; for every recall that has a brand, a model and a product name, an item built from that brand, product name and model matches that recall; and `mapCpscRecalls(fc.anything())` never throws.

## Requirement 3: App behaviour

**User story:** As a user, I want to add a purchase, see both countdowns and any recall that may apply, and put the dates in my calendar, so that I return or claim in time.

### Acceptance criteria

3.1 THE SYSTEM SHALL use the namespace `ossuary:warranty-wraith` for its items (C3.1), SHALL pass the clock and the id generator into the store from the app entry point, and SHALL read the local clock in one place only, building `now` for the engine from it (C2.2).

3.2 WHEN the app starts THE SYSTEM SHALL apply the theme from `bone.json` through `oss-shell`, load the Space Grotesk display font through the core's `loadDisplayFont` (C5.2), and show the ghost motif, and WHILE the item list is empty THE SYSTEM SHALL show `oss-empty` with the `ghost-parcel` art, the title from `copy.emptyTitle` and the add action (C5.17).

3.3 WHEN purchases exist THE SYSTEM SHALL show them with the core `oss-list`, grouped by the tone of each purchase's primary lifespan (C5.10), with each card showing the primary countdown large and the other lifespan as a smaller line with its own stage text (C5.24). It SHALL show a headline in the voice of `design/DESIGN.md` section 4, built from the live countdowns that end within 7 days, for example "2 return windows close this week" or "1 warranty ends this week", and "Nothing closes this week" WHEN there are none.

3.4 WHEN the user activates the add action THE SYSTEM SHALL open the core `oss-sheet` with `bought` set to today's local day, `return_days` set to the `amount` of the `return_window` base and `warranty_months` set to the `amount` of the `warranty` base (read from `bone.json`, not repeated in code), and the live preview SHALL show both countdowns (C5.13). WHEN the user saves THE SYSTEM SHALL write the purchase through the core store (C3.2) and show an "Added" toast. The sheet SHALL show no input for `recalls_dismissed`, in the add sheet and in the edit sheet, and saving an edit SHALL keep the stored `recalls_dismissed`.

3.5 WHEN the user opens a purchase THE SYSTEM SHALL show a detail view with one core `oss-lifespan` card per lifespan (requirement 9), side by side in two equal columns at 390 px and at 1280 px, with the primary lifespan first and the other after it. Each card SHALL have its own ghost, number, stage pill and absolute date. The detail SHALL also show the core `oss-trace` for both lifespans (C5.16), as a persistent card beside the countdown cards at 900 px or wider and as a bottom drawer opened by "Why these dates?" below that.

3.6 WHEN a purchase has one or more matches that are not dismissed THE SYSTEM SHALL show, above the countdown cards of the detail view, one core `oss-banner` per match (tone `urgent`) with the heading "Possible recall match", the text `CPSC <recall id>: <product name>, <hazard>`, a "Read notice" link and a "Not my model" button. The link SHALL point at the recall's `www.cpsc.gov` URL, open in a new tab with `rel="noopener noreferrer"`, and SHALL NOT be fetched by the app. The banner SHALL be a status region (C5.22).

3.7 WHEN the user activates "Not my model" THE SYSTEM SHALL add that recall's id to the purchase's `recalls_dismissed` through `store.update`, hide that banner, show a toast "Recall notice hidden" with an Undo action that removes the id again, and SHALL keep the dismissal after a reload, in a backup and after a restore. A dismissed recall SHALL NOT appear in the banner or in the count of requirement 3.8.

3.8 WHEN at least one match across all purchases is not dismissed THE SYSTEM SHALL show one line above the list on the home view, as a core `oss-banner` with `variant` `line`, reading "N possible recalls" (or "1 possible recall") followed by the names of the affected purchases, cut to one line. Activating it SHALL open the first affected purchase.

3.9 WHEN no match is left THE SYSTEM SHALL show no recall banner and no recall line, and SHALL NOT show "0".

3.10 WHEN the user activates "Add to calendar" on the detail view THE SYSTEM SHALL export the selected purchase only, calling `exportIcs(boneSpec, [entry], { now })` and offering the file as a download with the "Calendar file saved" toast (C4.1, C4.8). The file SHALL contain two events, one on each lifespan's `expiresAt`, with the summaries "<name> - Return window" and "<name> - Warranty", stable UIDs built from the lifespan ids (C4.2), and the alarms of that lifespan's own stages that are not in the past: 7 and 2 days for the return window, 90, 30 and 7 days for the warranty (C4.3, C4.4). The app SHALL have one calendar button per detail view, not one per card.

3.11 WHEN the user activates the detail view's primary action "Done with it" THE SYSTEM SHALL remove the purchase through the store and show a toast with an Undo action that creates it again.

3.12 WHEN the user activates the Import tab, or the empty state's "or import a list" link, THE SYSTEM SHALL show the core `oss-import` element for the app's spec and store. WHEN the user activates the Backup tab THE SYSTEM SHALL offer a backup download built by the core store export, a restore control that reads a chosen file through the core store import and then refreshes the list, and an "Import a list" action that opens `oss-import` (the phone bottom bar has only Items and Backup once purchases exist). No tab or link SHALL be inert, and the app SHALL NOT implement CSV, backup or restore logic of its own (requirement 6.3).

3.13 THE SYSTEM SHALL show no "Required." text in the add sheet, the edit sheet or the Import screen when they open. A required field shows "Required." only as an error after a save or submit with that field empty or invalid.

3.14 IF the store returns an error THEN THE SYSTEM SHALL show one line and one action, and SHALL NOT throw (C3.12).

3.15 THE SYSTEM SHALL render lists, cards, sheet, trace, banner, empty state and toasts only with core elements (`oss-shell`, `oss-list`, `oss-item`, `oss-lifespan`, `oss-banner`, `oss-sheet`, `oss-trace`, `oss-empty`, `oss-toast`, `oss-button`, `oss-pill`, `oss-decay`), SHALL define no custom element of its own, and SHALL NOT define its own colours, radii or durations (C5.1).

3.16 THE SYSTEM SHALL make no request to another origin after the page has loaded (C6.4). Reading the recall data, matching and exporting the calendar all happen on the device.

## Requirement 4: Installable and offline

**User story:** As a user, I want to install the app and open it with no signal, so that I can find a warranty at the shop counter.

### Acceptance criteria

4.1 THE SYSTEM SHALL ship a web app manifest with `name`, `short_name`, `start_url`, `scope`, `display` `standalone`, `theme_color` `#5a4bd1`, `background_color` `#edeff6`, and 192 px and 512 px PNG icons (one maskable) drawn from the ghost motif in the accent and canvas colours, linked from `index.html`. The icons are drawn once by `apps/warranty-wraith/scripts/draw-icons.ts`, run with `bun run icons:wraith`, and committed.

4.2 THE SYSTEM SHALL get its service worker, precache list, cache name and registration only from `@ossuary/core/pwa` (requirement 8). The app SHALL contain no service worker handler, no precache code and no registration code of its own: its `vite.config.ts` calls the core plugin with the cache prefix `warranty-wraith-`, and its entry point calls the core `registerSw()`.

4.3 THE SYSTEM SHALL precache every file of the production build except `sw.js` and source maps (HTML, JS, CSS, the Space Grotesk and Inter fonts, icons and manifest). `recalls.json` is imported as a module, so Vite bundles it into a JS file and the build emits no separate file for it. The recall data SHALL be inside a precached script.

4.4 WHEN the app has loaded once online THE SYSTEM SHALL reload offline and show the saved purchases, match recalls, add a purchase, dismiss a recall and export the calendar file, with no failed request and no cross-origin request. The offline end-to-end test runs against the built app served by `bun run preview:wraith` on port 4174, through a root Playwright `webServer` that builds and previews it. The Wraith dev server stays on port 5174 and Pantry Reaper's preview stays on port 4173.

4.5 THE SYSTEM SHALL add no runtime dependency beyond `@ossuary/core` (C6.5). `zod`, used by the data mapper, is a development dependency, and the mapper is not part of the browser bundle.

## Requirement 5: Clearly different from Pantry Reaper

**User story:** As a judge or a user, I want the two apps to look and behave differently, so that the skeleton is shown to be reusable and not one app with a second skin.

### Acceptance criteria

5.1 THE SYSTEM SHALL differ from Pantry Reaper in every `theme` value: canvas `#edeff6` (cool) against `#f2efea`, accent `#5a4bd1` (violet) against `#b8460e`, display font Space Grotesk against Fraunces, motif `ghost` against `candle`, empty art `ghost-parcel` against `candle-jar-moon`, and its wordmark and `copy`. A test SHALL compare against these literal Pantry Reaper values from `design/DESIGN.md` and SHALL NOT import or read anything of `apps/pantry-reaper`.

5.2 THE SYSTEM SHALL differ in behaviour: no food search and no storage switch, two countdowns on every card and detail view, number fields in the add sheet, a recall banner and a recall count line, and a calendar file with two events.

5.3 THE SYSTEM SHALL show one ghost per countdown on the detail view (DESIGN.md section 5), each reflecting that lifespan's own fraction and stage, and always next to its number, pill and date (DESIGN.md "Text pairing").

5.4 THE SYSTEM SHALL list the countdown card of the primary lifespan first (the one that dies first while any is live) and the other lifespan after it.

5.5 THE SYSTEM SHALL pass the sign-off checklist in DESIGN.md section 10 for its screens, judged at 1280 px and 390 px, and an end-to-end test SHALL assert the checkable items: one primary pill per screen, targets of at least 44 px, no horizontal scroll at 390 px, the theme values of requirement 1.6 on the page, the Space Grotesk font on a countdown number, the ghost motif, and the two cards side by side with the primary first.

## Requirement 6: Boundaries

**User story:** As the maintainer, I want the app to stay thin, so that it proves the skeleton and not a fork of it.

### Acceptance criteria

6.1 THE SYSTEM SHALL import from `@ossuary/core` only through its exports map (C6.3), and a test SHALL fail IF the app imports a path inside the core's `src`.

6.2 THE SYSTEM SHALL NOT import from, read or copy code from `apps/pantry-reaper` or `tools/*`, and SHALL NOT change any file outside `apps/warranty-wraith` except: the requirement 7 to 10 addenda in `packages/ossuary-core`, the requirement 8 switch of `apps/pantry-reaper` to the core `./pwa` subpath (and the requirement 10 extension of Pantry Reaper's toast end-to-end test), the new scripts in the root `package.json`, and the Wraith projects and `webServer` entry in the root `playwright.config.ts`.

6.3 THE SYSTEM SHALL keep app glue (everything in `src` except `src/data`) small, with no engine, schema, store, ICS, PWA or CSV logic of its own, except `matchRecalls`, which is domain data logic and lives in `src/data`. IF the app needs other logic THEN the core is missing something and the gap SHALL be recorded as a generic core addendum in this spec, not coded around.

6.4 THE SYSTEM SHALL have no scripts and no vitest or Playwright config in `apps/warranty-wraith`. The root `package.json` SHALL hold `data:wraith`, `build:wraith`, `preview:wraith` and `icons:wraith` next to the existing `dev:wraith`, and every command in this spec and its tasks SHALL be written as `bun run <script>`.

## Requirement 7: Core addendum, duration from a number field

**User story:** As an app author, I want a lifespan's length to come from a number the user enters on the item, so that one lifespan fits every purchase.

This is the first small generic addition to the skeleton contract. It names no domain. The contract's base is a fixed duration or a date field (C1.5), which cannot hold "30 days for this item and 90 for that one". Without it, the sheet's live preview could not follow the number the user types.

### Acceptance criteria

7.1 THE SYSTEM SHALL accept an optional `amountField` (a field key) on a lifespan base of type `duration`, in `packages/ossuary-core/src/schema`. `amount` stays required and is the default. A base of type `field` SHALL still reject `amountField` as an unknown key (C1.19).

7.2 IF `amountField` references a field that does not exist or is not of kind `number` THEN `parseBoneSpec` SHALL return an issue at `lifespans[i].base.amountField` that names the key (C1.10).

7.3 WHEN a lifespan has `amountField` THE SYSTEM SHALL use the item's value for that field as the base amount, and SHALL use `amount` WHEN the item has no value for it. IF the value is not a whole number from 0 to 9999 THEN `evaluate` SHALL return `{ ok: false, issues }` with an issue at that field's path and SHALL NOT throw (C2.13).

7.4 THE SYSTEM SHALL write the base amount that was used into the trace line ("30 days"), so the trace explains the date for that item (C2.9).

7.5 THE SYSTEM SHALL keep every other behaviour unchanged: the unit stays the lifespan's `unit`, rules run on the resulting expiry in declared order (C2.7), and a lifespan without `amountField` evaluates exactly as before.

7.6 WHEN fast-check runs with fixed seeds and fixed `now` values THE SYSTEM SHALL hold: for a spec with `amountField`, `evaluate` equals `evaluate` of the same spec with a fixed base `amount` equal to the item's value; the result is equal under `TZ` set to `UTC`, `America/New_York` and `Pacific/Auckland`; and changing the field changes only that lifespan (C2.14).

7.7 THE SYSTEM SHALL regenerate `packages/ossuary-core/bone-spec.schema.json` so it includes `amountField`, the drift test (C1.21) SHALL pass, and the `oss-sheet` live preview and `exportIcs` SHALL use the item's value without further change (a core test SHALL change the number field in the sheet and see the preview date move).

7.8 THE SYSTEM SHALL change only the schema, the engine's base step and trace text, their tests and `bone-spec.schema.json`, and SHALL use no domain word.

## Requirement 8: Core addendum, `./pwa` subpath

**User story:** As an app author, I want installable offline support from the core, so that a second app does not copy the first app's service worker.

This addendum moves code that exists in `apps/pantry-reaper` (`src/sw.ts`, `src/pwa/precache.ts`, `src/pwa/register-sw.ts` and the build step in its `vite.config.ts`) into the core, generic, with the cache prefix as a parameter. It names no domain.

### Acceptance criteria

8.1 THE SYSTEM SHALL add the export `"./pwa": "./src/pwa/index.ts"` to the core's exports map and export from it: `registerSw`, `startWorker`, `precacheList`, the types `Precache` and `WorkerScope`, and `ossuaryPwa` (the Vite plugin).

8.2 WHEN `precacheList(files, { prefix })` is called THE SYSTEM SHALL return `{ cacheName, urls }` with the same rules as Pantry Reaper's current function: every file except `sw.js` and source maps, sorted by name, as `./<name>`, and a cache name of `<prefix>` followed by an 8-digit hexadecimal FNV-1a hash over every kept file's name and bytes, so it changes when any file changes and not with file order.

8.3 WHEN `startWorker(scope, precache)` runs THE SYSTEM SHALL behave as Pantry Reaper's worker does now: on `install` cache every listed URL and `skipWaiting`; on `activate` delete every cache that starts with the same prefix and is not the current one, leave other caches alone, and `claim` clients; on `fetch` handle same-origin GET requests only, cache first with `ignoreVary`, serve navigations from the cached `./index.html`, and fall back to the network on a miss. The prefix SHALL be the cache name without its 8-digit hash, so the precache object keeps the shape `{ cacheName, urls }`.

8.4 WHEN an app's `vite.config.ts` has `plugins: [ossuaryPwa({ prefix })]` THE SYSTEM SHALL build the worker as `sw.js` next to the page, and after the files are written SHALL replace the token `__PRECACHE__` in `sw.js` with the precache list of the real `dist`. The app needs no worker source file and no further build configuration.

8.5 WHEN `registerSw()` is called THE SYSTEM SHALL register `./sw.js` after the page `load` event in production builds only, and SHALL ignore a failed registration, so the app still works online.

8.6 THE SYSTEM SHALL write the files under `packages/ossuary-core/src/pwa` so that Node's native TypeScript loader can load them from a Vite config: relative imports carry the `.ts` extension, only erasable TypeScript syntax is used, and no module that a browser bundle imports has a top-level import of a `node:` module (the plugin imports `node:fs` and `node:path` inside its `writeBundle` function). The core `tsconfig.json` SHALL allow `.ts` extension imports.

8.7 THE SYSTEM SHALL switch both apps to the subpath. In `apps/pantry-reaper`, `src/sw.ts`, `src/pwa/precache.ts` and `src/pwa/register-sw.ts` SHALL be deleted, its `vite.config.ts` SHALL call `ossuaryPwa({ prefix: 'pantry-reaper-' })`, and `src/main.ts` SHALL call the core `registerSw()`. Every existing Pantry Reaper test SHALL stay green: its built-`dist` and manifest tests in `precache.test.ts` stay and keep their assertions (including the cache name pattern `pantry-reaper-` plus 8 hex digits), its `sw.test.ts` cases and the `precacheList` unit test move to the core with the same assertions and a prefix parameter, `boundaries.test.ts` is unchanged, and the Pantry Reaper offline end-to-end test passes.

8.8 THE SYSTEM SHALL add no runtime dependency to the core. `vite` is added to the core as a development dependency, used for types only (C6.5). The core SHALL contain no app name and no domain word, and no service worker code SHALL remain in either app.

## Requirement 9: Core addendum, a card per lifespan and a banner

**User story:** As an app author, I want a card for one countdown and a status banner, so that a two-countdown detail view and a notice need no custom components.

This is the third small generic addition. The core renders all countdowns inside one item card (C5.24) and has no banner. It names no domain.

### Acceptance criteria

9.1 WHEN `oss-lifespan` is given one `LifespanEvaluation`, a `now` and a motif THE SYSTEM SHALL render one card: the lifespan's label as an eyebrow, an `oss-decay` of that lifespan's own fraction and stage, the countdown number in the display face with a muted unit (C5.6), the `oss-pill` of its stage, and its absolute date inside a `<time datetime>` element. The decay visual SHALL NOT render without the number, unit and pill in the same card (C5.9).

9.2 THE SYSTEM SHALL give the card one accessible name of the form "Label: expires in 12 days, Thursday 26 November." (the sentence of C5.7, "expired 3 days ago" for a lapsed one), SHALL hide the digits and the decay visual from assistive technology, and SHALL NOT use a live region (C5.22).

9.3 THE SYSTEM SHALL size the decay visual by the viewport: `s` below 900 px and `m` from 900 px (the `size` attribute overrides), so two cards fit side by side at 390 px (each about 171 px wide, DESIGN.md section 7). WHEN the lifespan is in its `dead` stage THE SYSTEM SHALL show the number with "days ago" and the dotted-outline decay (C5.6, DESIGN.md section 5).

9.4 THE SYSTEM SHALL export `orderLifespans(evaluation)` from `@ossuary/core/ui`, returning the lifespan evaluations with the primary lifespan first and the others in declared order. A one-lifespan evaluation returns that one.

9.5 WHEN `oss-banner` is given `heading` and `text` and slotted actions THE SYSTEM SHALL render a status region (`role="status"`) with the alert glyph, the heading in `--t-heading`, the text in `--t-body`, and the actions slot, on the tone slot's tint (`tone`, default `urgent`, DESIGN.md section 3), with `--r-md` and 16 px padding. A slotted `<a>` in the actions slot SHALL be styled by the banner as an underlined text link at least 44 px high, so an app can offer a real link next to an `oss-button`. WHERE `variant` is `line` THE SYSTEM SHALL render one line with an ellipsis, the glyph and the text only, as a 44 px high button-like row that emits `oss-open` when activated.

9.6 THE SYSTEM SHALL keep every text and glyph in both elements at 4.5:1 contrast or better on its background (DESIGN.md section 9), pair the banner's colour with its glyph and a word (C5.21), and keep every target of the line variant at 44 by 44 px or larger (C5.4).

9.7 THE SYSTEM SHALL add both elements to the core gallery in every state (live, closing, last days and lapsed for the card; block and line for the banner; in the core, warm and cool themes and at 1280 px and 390 px), with neutral fixture words only, and the axe and keyboard checks of C5.23 SHALL pass with zero violations.

9.8 THE SYSTEM SHALL export both elements, `orderLifespans` and the `expirySentence` helper from `@ossuary/core/ui`, add happy-dom tests for them, change nothing else in the core, and use no domain word.

## Requirement 10: Core addendum, the Undo toast never covers a control

**User story:** As a user on a short phone, I want the toast to leave every button and link reachable, so that I can still act while it is on screen.

This is the fourth small generic fix. Today the toast clears every button and link of the item view only down to about 784 px of screen height, because the view happens to fit above it. At 390 by 664 the content is taller than the screen, and the bottom of the scrolled page sits under the toast. It names no domain.

### Acceptance criteria

10.1 WHILE an `oss-toast` message is visible THE SYSTEM SHALL set the custom property `--oss-toast-space` on the document element to the measured height of the toast box plus the core spacing token `--s-3`, SHALL update it WHEN the box changes size (for example a message that wraps to two lines), and SHALL remove it WHEN the toast hides, is replaced by another message or is disconnected.

10.2 THE SYSTEM SHALL add `var(--oss-toast-space, 0px)` to the bottom padding of the `oss-shell` content area at both widths, so that the end of the scrolled page always sits above the toast box and above the bottom bar.

10.3 THE SYSTEM SHALL express this only with the measured toast height, existing spacing tokens and `env(safe-area-inset-bottom)`. It SHALL NOT add a fixed pixel height for a worst-case toast, a particular phone or a particular screen height, so that it scales with the message length, the safe-area inset and the viewport.

10.4 WHEN an Undo toast is visible and the item view has been scrolled to its end THE SYSTEM SHALL keep the toast box above the bottom bar and clear of the bounding box of every visible button and link of the view, at 390 by 664 and at 390 by 844. This SHALL hold in the core gallery and in both apps, and at 390 by 844 Pantry Reaper's existing check (requirement 3.14 of its spec) SHALL keep passing.

10.5 THE SYSTEM SHALL add no animation or transition for this rule, so it needs no reduced-motion variant, and SHALL change only `oss-toast`, `oss-shell`, their tests and the gallery and end-to-end tests named in requirement 10.6 in the core.

10.6 THE SYSTEM SHALL test it: a core happy-dom test of `oss-toast` (the property is set from a stubbed box height, updated on resize, removed on hide, replace and disconnect) and of the `oss-shell` padding rule, a core gallery end-to-end test in the `gallery-phone` project at 390 by 664, an extension of the Pantry Reaper toast end-to-end test to 390 by 664, and the same test in the Warranty Wraith end-to-end suite. In each end-to-end test the page is scrolled to its end and the toast is held open (focus on its Undo button pauses its timer) before the boxes are read.
