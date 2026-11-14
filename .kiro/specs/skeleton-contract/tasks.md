# Tasks: skeleton contract (`packages/ossuary-core`)

Rules for every task: write the failing test first, then the code, and keep the whole suite green before the next task. Requirement numbers refer to `requirements.md`.

- [x] 1. Scaffold the package
  - [x] 1.1 Create `packages/ossuary-core` with `package.json` (exports map, runtime deps `zod`, `idb`, `ics`, `@fontsource-variable/inter|fraunces|space-grotesk`), `tsconfig.json`, Vite and vitest config, and a `test:tz` script. _Requirements: 6.5_
  - [x] 1.2 Add dev dependencies: `vitest`, `fast-check`, `fake-indexeddb`, `happy-dom`, `ical.js`, `@playwright/test`, `@axe-core/playwright`. _Requirements: 3.14, 4.7, 5.23_
  - [x] 1.3 Add boundary tests: banned-word scan, `Date.now()` / `new Date()` scan over `engine`, `schema`, `ics`, import scan for `apps/` and `tools/`, runtime dependency allow-list, and a gallery network guard helper. _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. Bone spec schema (`src/schema`)
  - [x] 2.1 Add `issues.ts` (`Issue`, `Result`, `formatIssues` with readable paths, max 50) with tests. _Requirements: 1.20_
  - [x] 2.2 Add `contrast.ts` (`relativeLuminance`, `contrastRatio`) with tests against the DESIGN.md ratios. _Requirements: 1.14, 1.15, 1.16_
  - [x] 2.3 Write failing tests, then implement `fields.ts`: kinds text/date/enum/number, unique keys, enum options, number min/max/step. _Requirements: 1.2, 1.3, 1.4_
  - [x] 2.4 Write failing tests, then implement `lifespans.ts` (array of one to four lifespans, unique ids, labels, `startField`, base as duration or date field) and `rules.ts` (extend, shorten, clamp, lookup, `when`, declared order kept, rule ids unique per lifespan). Add the one-lifespan, four, five, empty and duplicate-id cases. _Requirements: 1.5, 1.6, 1.7, 1.8, 1.9, 1.23_
  - [x] 2.5 Write failing tests, then implement `stages.ts`, applied per lifespan: tones, unique ids, thresholds strictly decreasing, single last `dead` stage. _Requirements: 1.11_
  - [x] 2.6 Write failing tests, then implement `theme.ts`: strict eight keys, hex format, enums, accent contrast on white and canvas, canvas luminance range, accentInk on accentTint. _Requirements: 1.12, 1.13, 1.14, 1.15, 1.16_
  - [x] 2.7 Implement `sources` attribution and `sourceId` references, `titleField` / `summaryFields`, optional `copy`. _Requirements: 1.17, 1.18_
  - [x] 2.8 Implement root `parseBoneSpec` with cross-reference checks in `superRefine` (run per lifespan, paths like `lifespans[1].rules[0].when.field`), size limits (40 fields, 4 lifespans, 50 rules in total, 8 stages per lifespan), unknown-key rejection and the last-resort `try/catch`. _Requirements: 1.1, 1.10, 1.19, 1.20, 1.23_
  - [x] 2.9 Implement `buildItemSchema` / `validateItem` (real calendar days, enum membership, required fields) with tests. _Requirements: 2.13, 3.3_
  - [x] 2.10 Generate `bone-spec.schema.json` with `z.toJSONSchema`, check it in, and add the sync test. _Requirements: 1.21_
  - [x] 2.11 Add fast-check fuzz: `fc.jsonValue()`, `fc.anything()`, and mutated valid specs never throw, and accepted specs reparse equal. Add the valid-spec arbitrary used by later tasks (one to four lifespans). _Requirements: 1.1, 1.22_

- [x] 3. Lifespan engine (`src/engine`)
  - [x] 3.1 Write failing tests, then implement `iso-day.ts` (parse, format, day numbers, real-day check) with no `Date` object. Include leap years and century rules. _Requirements: 2.4_
  - [x] 3.2 Write failing tests, then implement `duration.ts` with month and year arithmetic that clamps to the last day of the target month. _Requirements: 2.6_
  - [x] 3.3 Write failing tests, then implement base evaluation and rules in declared order for one lifespan (`extend`, `shorten` with start floor, `clamp`, `lookup`, `when`). _Requirements: 2.5, 2.7, 2.8_
  - [x] 3.4 Write failing tests, then implement `trace.ts` templates, one line per applied rule (including "no change" for clamp) and source names. _Requirements: 2.9_
  - [x] 3.5 Write failing tests, then implement `remaining`, `hours`, `fraction` and exact stage selection at thresholds, using the lifespan's own stages. _Requirements: 2.10, 2.11, 2.12_
  - [x] 3.6 Implement `evaluate(spec, item, now)` returning `Result<Evaluation>`: validate the item once, evaluate every lifespan in declared order into `lifespans`, with invalid-item issues, no mutation and deep-equal determinism. _Requirements: 2.1, 2.2, 2.3, 2.13_
  - [x] 3.7 Write failing tests, then implement `primary.ts` (`pickPrimary`) and set `primaryIndex`: fewest `remaining.days` among live lifespans (days >= 0), ties to the earlier declared lifespan; when every lifespan has expired, the greatest `remaining.days`, ties to the earlier declared lifespan; live beats dead; single lifespan gives index 0. _Requirements: 2.15, 2.16_
  - [x] 3.8 Add fast-check properties per lifespan: monotonic `remaining` and stage index, `extend` never shortens, clamp bounds hold, exact stage boundaries, determinism, lifespan independence. Add the primary properties (same length and order, if any lifespan is live the primary is live, minimal days among live, greatest days when all expired, no earlier tie). Use fixed seeds and fixed `now` values. _Requirements: 2.14, 2.16_
  - [x] 3.9 Run the engine suite under `TZ=UTC`, `America/New_York` and `Pacific/Auckland` through `test:tz`, with dates across DST changes. _Requirements: 2.4, 2.14_

- [ ] 4. Local store (`src/store`)
  - [x] 4.1 Write failing tests with `fake-indexeddb`, then implement `errors.ts` and `db.ts` (`ossuary:<appId>` database, `items` and `meta` stores, error mapping). _Requirements: 3.1, 3.12_
  - [x] 4.2 Implement `repo.ts` CRUD with injected `newId` and `nowIso`, validation on write, `not_found`, and namespace isolation tests. _Requirements: 3.2, 3.3, 3.4_
  - [x] 4.3 Implement `backup.ts`: zod backup schema, `exportBackup`, `importBackup` in `merge` and `replace` modes in one transaction, round-trip test. _Requirements: 3.5, 3.6, 3.7_
  - [ ] 4.4 Implement `csv.ts`: RFC 4180 parser with quotes, CRLF, BOM, embedded newlines, and the 5 MB / 10,000 row limits. _Requirements: 3.8, 3.11_
  - [ ] 4.5 Implement `csv-import.ts`: `suggestMapping`, `previewCsvImport` (dates as `YYYY-MM-DD`, enum match by value or label, skipped reasons) and `commitCsvImport`. _Requirements: 3.9, 3.10_
  - [ ] 4.6 Add fuzz tests for backup text and CSV grids: never throws, never leaves a partial write. Assert no network calls from the store. _Requirements: 3.7, 3.13, 3.14_

- [ ] 5. ICS export (`src/ics`)
  - [ ] 5.1 Write failing tests that parse output with `ical.js`, then implement `exportIcs` for one entry with one lifespan: all-day event on that lifespan's `expiresAt`, stable UID from app id, item id and lifespan id, `DTSTAMP` from `now`, summary. _Requirements: 4.1, 4.2, 4.7_
  - [ ] 5.2 Add alarms at each threshold stage of the event's own lifespan (09:00 on the entry day), drop past alarms, and assert trigger values by parsing. Add a two-lifespan case: two events per entry, distinct UIDs, label appended to the summary, alarms taken from each lifespan's stages. _Requirements: 4.2, 4.3, 4.4, 4.7_
  - [ ] 5.3 Support many entries, skipped entries with issues (all lifespans of the entry skipped), and escaping and folding round-trip tests. _Requirements: 4.1, 4.5, 4.6, 4.7_

- [ ] 6. UI foundations (`src/ui`)
  - [ ] 6.1 Add `tokens.css` from DESIGN.md section 2, the tone slot colours from section 3, and the reduced-motion block. Add a test that every colour pair in the tone table meets 4.5:1. _Requirements: 5.1, 5.8, 5.20_
  - [ ] 6.2 Implement `theme.ts` (`applyTheme`) and `fonts.ts` (`loadDisplayFont`), and unit-test that only the allowed custom properties are written. _Requirements: 5.2_
  - [ ] 6.3 Implement `glyphs.ts` (five tone glyphs, alert, import, calendar, bone) and the pure motif functions (candle, ghost, hourglass) with output tests at fractions 0, 0.5, 1 for each tone. _Requirements: 5.9, 5.21_
  - [ ] 6.4 Implement the countdown formatter and accessible-name builder (primary sentence, plus one sentence per other lifespan) with boundary tests (5 hrs, today, 59 and 60 days, 23 and 24 months, dead) and one- and two-lifespan names. _Requirements: 5.6, 5.7_
  - [ ] 6.5 Implement `focus-trap.ts` and a shared constructable-stylesheet helper. _Requirements: 5.15_

- [ ] 7. UI elements (each starts with a failing happy-dom test)
  - [ ] 7.1 `oss-button` (primary, ghost, link; 44 px targets). _Requirements: 5.1, 5.4_
  - [ ] 7.2 `oss-pill` and `oss-decay` (quantised fraction, `aria-hidden`, tone mood). _Requirements: 5.8, 5.9_
  - [ ] 7.3 `oss-item` card and row variants with `<time>`, accessible name and hidden digits, driven by the primary lifespan, plus the compact countdown lines for other lifespans (label, countdown, glyph and stage label as text, one pill only). _Requirements: 5.5, 5.6, 5.7, 5.9, 5.24_
  - [ ] 7.4 `oss-list` with grouping by primary tone, order, hidden empty groups, header pill and count, collapsed `dead` group, card grid and row layouts. _Requirements: 5.10, 5.11_
  - [ ] 7.5 `oss-shell` with theme application, desktop top bar, phone app bar and bottom bar, one primary pill slot. _Requirements: 5.2, 5.3, 5.4_
  - [ ] 7.6 `oss-field` for all four kinds (segmented radiogroup for 4 or fewer options, select above that) with label, helper and error wiring. _Requirements: 5.12_
  - [ ] 7.7 `oss-sheet` generated from spec fields with live preview (primary plus other lifespans), validation errors, focus to first invalid field, and focus trap, Escape and focus return. _Requirements: 5.12, 5.13, 5.14, 5.15_
  - [ ] 7.8 `oss-trace` card and drawer modes: one `<ol>` section per lifespan (label heading and primary marker when more than one), signed deltas and a total line. _Requirements: 5.16_
  - [ ] 7.9 `oss-empty` with the three empty-state arts. _Requirements: 5.17_
  - [ ] 7.10 `oss-import` with source step, mapping, five-row preview, skipped-row pills, confirm, backup restore, and the three-step phone layout. _Requirements: 5.18, 5.19_
  - [ ] 7.11 `oss-toast` (`role="status"`, pause on hover and focus, undo) and the ICS download helper with the "Calendar file saved" toast. _Requirements: 4.8, 5.22_

- [ ] 8. Gallery page
  - [ ] 8.1 Build `gallery/index.html` with neutral fixtures for the core, warm and cool themes (`?theme=`, one lifespan each), a `multi.json` fixture with two lifespans shown in its own section under every theme, a fixed `now` of `2026-11-14`, and every primitive in every state: five tones, three motifs, empty, error, loading, dead, sheet, drawer, import, and the multi-lifespan card, list and trace. _Requirements: 5.1, 5.23, 5.24, 6.1_
  - [ ] 8.2 Wire the gallery to the store (browser IndexedDB), engine and ICS so the add, edit, import and calendar flows work end to end. _Requirements: 3.2, 4.8, 5.13_

- [ ] 9. Playwright end-to-end (`e2e/`)
  - [ ] 9.1 Configure projects at 1280 x 800 and 390 x 844, and a network guard that fails on non-local requests. _Requirements: 5.23, 6.4_
  - [ ] 9.2 Axe tests for every gallery state in the core, warm and cool themes, tags `wcag2a`, `wcag2aa`, `wcag21aa`, zero violations. _Requirements: 5.8, 5.21, 5.23_
  - [ ] 9.3 Keyboard flow tests: Tab reaches every action, visible focus, sheet, drawer and dialog trap focus, close on Escape and return focus; arrow keys on segmented controls. _Requirements: 5.15, 5.23_
  - [ ] 9.4 Layout tests: no horizontal scroll at 390 px, one primary pill per screen, targets of at least 44 px, grid at 1280 and row groups at 390. _Requirements: 5.3, 5.4, 5.11, 5.23_
  - [ ] 9.5 Reduced-motion test with `reducedMotion: 'reduce'`: no running animations, sheets open without sliding. _Requirements: 5.20_
  - [ ] 9.6 Flow tests: add an item and see the preview and list update, invalid save shows errors, import CSV with a skipped row, backup restore, and download an ICS file that parses with the expected alarms (one event per lifespan for the multi-lifespan item). _Requirements: 3.10, 4.8, 5.13, 5.14, 5.18, 5.19_

- [ ] 10. Wrap-up
  - [ ] 10.1 Export the public API from `src/index.ts` and subpath exports, and check that `apps/*` can import only from the exports map. _Requirements: 6.3_
  - [ ] 10.2 Run the full gate: `vitest`, `test:tz`, Playwright at both widths, type-check and the boundary tests. Fix every failure before closing the spec. _Requirements: 1.22, 1.23, 2.14, 2.15, 2.16, 3.14, 4.7, 5.23, 5.24, 6.1, 6.2, 6.3, 6.4, 6.5_
