# Tasks: crypt-theme

Rules for every task: write the failing test first, then the code, and keep the whole suite green before the next task. Requirement numbers refer to `requirements.md`. Visual rules come from `design/DESIGN.md`.

Status was checked against the code and tests. A task is ticked only when its behaviour exists in the code and in a test. Unticked tasks carry a "Not done:" note.

- [x] 1. Colour helpers and crypt derivation
  - [x] 1.1 Colour helper tests (hex/HSL round trip, `mixHex` endpoints) in `crypt.test.ts`, and `ui/color.ts` (`hexToHsl`, `hslToHex`, `mixHex`). Contrast stays in `schema/contrast.ts`. _Requirements: 4.1, 4.5_
  - [x] 1.2 `crypt.test.ts` for `cryptTheme`: the core, Pantry Reaper and Warranty Wraith results, the 34% saturation cap, the accent lifted to 4.6:1 on surface, canvas and tint for seven accents, and determinism. Then `ui/crypt.ts`. _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

- [ ] 2. Tokens
  - [x] 2.1 `tokens.test.ts`: `:root` holds the crypt values, `:root[data-mode="light"]` the light values, the motif, `--halo`, `--spirit-glow`, `--glow-*` and `--highlight` tokens exist, `--halo` is 0 in light and positive in the crypt, no `#000`, and `[data-themed]` picks the crypt or light set. `tokens.css` is rewritten to match. _Requirements: 1.1, 1.2, 1.3, 1.5, 3.2_
  - [x] 2.2 `contrast-tokens.test.ts` checks, in both modes and for every theme found by glob (core, apps, bone-forge template, gallery), the tone pairs (4.5:1 word, 3:1 glyph), the on-ink pairs, `--line-strong` at 3:1, and text, accent, error and focus-ring pairs at AA. _Requirements: 1.4, 4.6_
    Not done: the stricter DESIGN.md ratios (text 13:1, text-2 8:1, text-3 5.9:1, pills 8:1) are not asserted. The test checks AA only.
  - [ ] 2.3 Move hard-coded colours, radii and durations out of core components into tokens where the crypt needs them. _Requirements: 1.3_
    Not done: there is no source test that scans core component styles for literals. The motif SVG output and the launcher files are scanned for hex colours. Some components still carry their own durations and radii.

- [ ] 3. Mode
  - [x] 3.1 `mode.test.ts` (default crypt, stored light, garbage value, throwing storage, `setMode` writes, sets the attribute and fires `oss-mode`) and `ui/mode.ts`, exported from core. `initMode(doc, storage)` and `setMode(mode, doc, storage)` take the document first. `ensureDocumentTokens` calls `initMode` when `<html>` has no mode. _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_
  - [ ] 3.2 An inline `<head>` script in each `index.html` that sets `data-mode="light"` from `ossuary:mode`, with a test that its key equals `MODE_KEY`. _Requirements: 2.4_
    Not done: decided against. There is no inline head script. The crypt is the `:root` default, so there is no dark flash, and a stored light choice is applied when the shell or the launcher calls `ensureDocumentTokens`. The launcher and apps get `initMode` through that call and not through their own `main.ts`. The bone-forge template was not changed.

- [x] 4. Theme application
  - [x] 4.1 `theme.test.ts`: `applyTheme` writes `--light-accent`, `--light-accent-ink`, `--light-accent-tint`, `--light-canvas` and the six `--crypt-*` values, sets `data-themed`, removes everything when the theme is undefined, and never writes text, radius or spacing tokens. `ui/theme.ts` calls `cryptTheme`. _Requirements: 3.1, 3.3, 3.4_
  - [x] 4.2 The crypt contrast check for every theme in both modes lives in `contrast-tokens.test.ts` (task 2.2), not in a separate `crypt-contrast.test.ts`. It finds apps by glob and names the theme and pair on failure. _Requirements: 4.6, 4.7_

- [ ] 5. Theme toggle
  - [x] 5.1 `oss-mode-toggle.test.ts`: a `<button>` named "Light theme", `aria-pressed`, hidden glyph, a click sets the mode and storage and flips `aria-pressed`. `elements/oss-mode-toggle.ts` is a 44px button that swaps sun and moon and follows the document `oss-mode` event. _Requirements: 5.3, 5.4, 5.6_
  - [x] 5.2 The shell renders the toggle in `.top`, outside `.primary`, in its actions area before the primary slot (test in `oss-mode-toggle.test.ts`). The launcher header has it in `.top-end` beside the GitHub link (test in `apps/launcher/src/page.test.ts`). _Requirements: 5.1, 5.2, 5.7_
  - [ ] 5.3 Follow a mode change made in another tab through the `storage` event, with a test. _Requirements: 5.5_
    Not done: the toggle only follows the in-page `oss-mode` event.

- [ ] 6. Candle and ghost
  - [x] 6.1 `motifs.test.ts`: the candle `.burnt` height is `72 - wax height` and absent at full height, `.halo` is present except for `dead`, no motif contains a hex colour, every motif is `aria-hidden`. `.halo` takes `var(--halo)` from CSS in `oss-decay`. _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_
  - [x] 6.2 `motifs.test.ts` for the ghost: fill opacity `0.15 + 0.85 * fraction`, stroke opacity `0.35 + 0.65 * fraction`, the dotted hem below 0.25, the dead outline. The glow is a `drop-shadow` on the ghost body path. _Requirements: 6.3, 6.4_
  - [ ] 6.3 Show every motif in every stage and both modes in the gallery, and check by eye at 32, 48, 120 and 200px. _Requirements: 6.1, 6.2, 6.3_
    Not done: the gallery has a motif grid, but no check that it covers every stage in both modes at those sizes was found.

- [ ] 7. Decaying cards
  - [x] 7.1 `item-list.test.ts`: every card carries `--life` (quantised) and the tone class, and a dead card has the `ghost` class and still reads "ago" with the dead pill. `oss-item` adds the soon and urgent glows, the ember breath on an `::after` layer, and the left bar on rows. The e2e crypt specs check the ember glow on a card and the 3px bar on a phone row. _Requirements: 7.1, 7.3, 7.4, 7.5_
  - [ ] 7.2 A contrast test for the card slab at `life` 0 and `life` 1 against `--text`, `--text-2` and `--text-3`. _Requirements: 7.2, 7.6_
    Not done: the slab CSS exists (`color-mix` of `--surface` toward transparent), but no test computes the mixed colour and checks the text contrast on it.

- [ ] 8. First-load burn-down
  - [x] 8.1 `item-list.test.ts`: the first render with items sets `data-enter` on `.groups` and `--i` on every item, a second render does not, and an empty render does not use it up. `oss-list` holds an instance flag `#entered` and marks items with `entering` and `--enter-delay` (stagger capped at 20 items). _Requirements: 8.1, 8.3, 8.4_
  - [x] 8.2 `oss-decay` has the `burn`, `rise`, `late` and `haunt` keyframes and `oss-item` has `arrive` and `to-ghost`, all from-to over the static drawing. The e2e crypt specs check the animation runs on the first render and not after a detail round trip. _Requirements: 8.1, 8.2, 8.6_
    Notes: the whole card arrives, so the number, pill and name animate too (requirement 8.5 said art only). There is no `animationend` cleanup or timer. No unit test covers filter, edit, remove and undo renders, or a fresh list element replaying.

- [ ] 9. Reduced motion
  - [x] 9.1 The reduced-motion rule in `tokens.css` zeroes `--dur-*` and sets `animation: none` and `transition: none` on every element, so it covers all the new keyframes and the card hover transition. `motion-source.test.ts` checks that every stylesheet that animates is covered. _Requirements: 10.1, 10.2, 10.6_
  - [x] 9.2 The e2e crypt specs with `reducedMotion: 'reduce'` check that no animation runs on first load and that candles and ghosts show their final height or opacity. _Requirements: 10.2, 10.3, 10.5_
    Notes: the list does not skip the first-load marker under reduced motion. It sets it and the global rule stops the animations, so the result is the same. It still counts as used (requirement 10.4). The e2e check covers the list, not the detail screen. No test asserts the urgent glow strength under reduced motion.

- [ ] 10. First-visit samples
  - [x] 10.1 `first-visit.test.ts`: seeds an empty store once and returns the ids, skips a non-empty store and marks the visit, does not re-seed an emptied store, does nothing and sets no key for an empty list, skips an invalid sample and keeps the rest, adds nothing when storage throws. `ui/first-visit.ts` keeps the flag in `localStorage["ossuary:<spec id>:visited"]`, exported from core. Each app's `start()` shows "Sample items added" with Clear, which removes exactly the added ids. _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.10_
  - [x] 10.2 `samples.test.ts` in each app: samples fit the spec, include living, soon or urgent, and dead stages on three different days, and are dated relative to today. Warranty Wraith has exactly one sample that matches a recall. `samples(today)` in each app's `src/data/samples.ts` returns 8 foods and 6 purchases, and `main.ts` passes it to `mountApp`. _Requirements: 9.6, 9.7, 9.8, 9.9, 12.2_
  - [ ] 10.3 bone-forge emits an empty `samples.ts`, the mode wiring and the seeding call, with a test. _Requirements: 9.8, 12.4_
    Not done: the bone-forge templates were not changed.

- [x] 11. Boundaries
  - [x] 11.1 Run `bun run hook:boundary` and the core boundaries test, and `bun run hook:spec`. _Requirements: 12.1, 12.2, 12.3, 12.5_

- [ ] 12. End-to-end
  - [x] 12.1 The crypt e2e specs for Pantry Reaper, Warranty Wraith (1280 and 390) and the launcher (its desktop and phone projects): the toggle flips the mode and survives a reload, a first visit shows samples and the toast, Clear empties the list, a reload adds no samples, and the apps' network guard stays clean. `playwright.config.ts` starts every project as a returning visit through a `storageState`, and the crypt specs opt into a real first visit. _Requirements: 2.1, 5.1, 5.2, 9.2, 9.4, 9.5, 9.10_
  - [x] 12.2 The same specs check that the burn-down plays on the first list render and not after a detail round trip, and that with `reducedMotion: 'reduce'` nothing runs. _Requirements: 8.1, 8.2, 10.2, 10.3_
  - [ ] 12.3 Run axe in the crypt with sample items present, and then in light through the toggle, on every screen the existing a11y specs visit (list, empty state, detail, add sheet, import dialog, trace drawer, the recall banner), at 1280 and 390. Also assert no horizontal scroll and 44px targets in both modes. _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
    Not done: the crypt specs run axe on the sample list, the expanded ghost group and the empty state in the crypt, and on the list in light. The existing a11y specs run in the crypt as a returning visit, so without samples, and never in light. Detail, sheet, import, trace and banner are not checked in light. No horizontal-scroll or 44px check was added for both modes.

- [ ] 13. Docs and wrap-up
  - [ ] 13.1 Update `README.md` (crypt default, the toggle, sample items, `cryptTheme`) and `docs/REMIX.md` (a third app gets a crypt for free, how to add `samples.ts`). _Requirements: 12.4_
    Not done: `README.md` describes the crypt, the toggle, the samples and `cryptTheme`. `docs/REMIX.md` was not changed.
  - [x] 13.2 Run the full gate: `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`. _Requirements: 12.6_
