# Tasks: a11y-motion (accessibility and motion polish)

Rules for every task: write the failing test first, then the code, and keep the whole suite green before the next task. Requirement numbers refer to `requirements.md`. Do not touch `packages/ossuary-core/src/engine`. Add no domain word to `packages/ossuary-core`.

- [x] 1. Shared test helpers
  - [x] 1.1 Write a failing vitest for the pure parts of `packages/ossuary-core/src/testing/a11y.ts` (the formatter that turns axe results into a message with rule id, selector and summary, and the `WIDTHS` constant). Then add the module with `checkAxe`, `settle`, `runningMotion` and `tabThrough`, generic and with no domain words. _Requirements: 5.2, 7.2, 8.2_
  - [x] 1.2 Change `packages/ossuary-core/e2e/gallery.spec.ts` to use `tabThrough` and `settle` in place of its inlined copies, with the same assertions. Run the gallery project and confirm it still passes. _Requirements: 3.3, 6.5_

- [x] 2. Contrast
  - [x] 2.1 Write a failing vitest `contrast-tokens.test.ts` that reads `tokens.css`, the two app `bone.json` themes, the template theme, the launcher card themes and the gallery warm and cool themes, and checks every pair in the design table (tone text 4.5, tone glyph 3, text tokens, accent text, focus ring 3, `--line-strong` 3, `--on-ink` on `--ink`). Run it and record the failing pairs in the task notes before changing anything. _Requirements: 2.1, 2.2, 2.3, 2.4, 8.1_
    - Note (first run, before any token change): one failing pair, --line-strong #8a909c on --surface-sunken #f4f5f8 at 2.94:1 (min 3). Every other pair in every theme passes.
  - [x] 2.2 Fix each failing token to the nearest passing value with the same hue, in `tokens.css` or the theme block of the `bone.json` that owns it. Re-run the new test and the schema contrast tests. If a ratio quoted in `design/DESIGN.md` is proven wrong, correct that row in the same change. _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_
  - [x] 2.3 Write a failing happy-dom test that every `oss-pill` and `oss-item` stage word carries its glyph and word, so no status is colour-only. Then fix any gap in core. _Requirements: 2.6_

- [ ] 3. Countdown names and live regions
  - [x] 3.1 Write a failing happy-dom test (`a11y-names.test.ts`) that `oss-item` (card and row) and `oss-lifespan` expose one plain-language name from fixed items and a fixed `now`, for example "Milk. Use soon. Expires in 3 days, Friday 20 November.", with `aria-hidden` digits. Make it pass; fix core if a name is wrong. _Requirements: 4.1, 8.2_
  - [x] 3.2 Write a failing test in `apps/pantry-reaper/src/app.test.ts` that the detail countdown name holds the item name, the stage and "expires in N days, <date>". Then build it with `accessibleName` in `renderDetail`. Update any existing assertion on the old label. _Requirements: 4.1, 4.2_
  - [ ] 3.3 Write a failing happy-dom test that no `[aria-live]`, `[role="status"]` or `[role="alert"]` wraps a countdown or a `time` in core elements, either app, the template and the gallery, and that only the toast, the loading placeholder, the banner and a search combobox result count carry a live role. Fix any stray region. _Requirements: 4.3, 4.4_
  - [ ] 3.4 Write a failing e2e in each app (`e2e/a11y.spec.ts`) that moves the page clock on by 61 minutes (`page.clock`) with a `MutationObserver` on every live region, and sees no change. Then fix any timed re-render that touches a live region. _Requirements: 4.3, 4.5_

- [ ] 4. Reduced motion
  - [ ] 4.1 Write a failing source-scan vitest (`motion-source.test.ts`) that every `animation:` or `transition:` in core UI, both apps, the launcher, the gallery and the template is covered by the shared reduced-motion rule or has its own, and that `requestAnimationFrame`, `.animate(` and `scroll-behavior: smooth` appear only behind a `prefers-reduced-motion` check. Fix any uncovered file. _Requirements: 1.4, 1.5_
  - [ ] 4.2 Write a failing Playwright test in the gallery spec with `page.emulateMedia({ reducedMotion: 'reduce' })`: `runningMotion` is empty on the gallery, with the sheet, import dialog, trace drawer and toast opened, and every `--dur-*` computes to `0ms`. Fix any leak in core. _Requirements: 1.1, 1.2, 1.3, 8.3_
  - [ ] 4.3 Add the same test to `apps/pantry-reaper/e2e/a11y.spec.ts` (list, detail with the idle motif, add dialog, storage switch with its toast, food search list) and to `apps/warranty-wraith/e2e/a11y.spec.ts` (list, detail, add dialog, recall banner). Assert the toast text still says what changed. Fix any leak. _Requirements: 1.1, 1.2, 1.3, 8.3_
  - [ ] 4.4 Add the test to `apps/launcher/e2e/a11y.spec.ts`: both cards have `transform` of none (rotation 0), hover and focus do not lift them, and no motif animates. Add the `no-preference` counterpart for the launcher and for the gallery that sees the rotation and a running flame sway, so the rule is not always on. _Requirements: 1.1, 1.2, 1.6, 8.3_
  - [ ] 4.5 Add the `no-preference` counterpart on a Pantry Reaper detail (the idle flame runs) and fix nothing unless it fails. _Requirements: 1.6_

- [ ] 5. Focus
  - [ ] 5.1 Write a failing static test that greps every source for `outline: none` or `outline: 0` and fails on any that is not a `tabindex="-1"` target or a wrapper with a `:has(:focus-visible)` or `:focus-within` ring. Fix any other. _Requirements: 3.2_
  - [ ] 5.2 Write failing Tab-through e2e (`tabThrough`, `missed` and `noRing` empty) for the launcher, at 1280 and 390. Fix any missing ring. _Requirements: 3.1, 3.3, 8.4_
  - [ ] 5.3 Add Tab-through e2e for the Pantry Reaper list, detail and open add dialog, with a check that Tab stays in the dialog, Escape closes it and focus returns to the opening control. Fix any missing ring. _Requirements: 3.1, 3.3, 3.4_
  - [ ] 5.4 Add the same for the Warranty Wraith list, detail and open add dialog. _Requirements: 3.1, 3.3, 3.4_
  - [ ] 5.5 Add the gallery Tab-through for the warm and cool themes, since the ring colour is the theme accent. _Requirements: 3.1, 3.3_

- [ ] 6. Known issues
  - [ ] 6.1 Read the apps' detail action rows (Add to calendar, then Edit, in a wrapping flex row, no Remove). Write a failing happy-dom test in `tools/bone-forge/template/src/app.test.ts` that the template detail row has the same labels, order, `variant`, `icon` and `data-action` values. Then change the template `renderDetail` so it matches, keeping `removeEntry` reachable only where the apps place removal. Extend `src/scaffold/generated.test.ts` to check a scaffolded app has the same row. _Requirements: 6.1, 8.2_
  - [ ] 6.2 Write a failing test for the Pantry Reaper canvas: a happy-dom test that `document.documentElement` has `--canvas` `#f2efea` after `mountApp`, and an e2e that the body background computes to the theme canvas, also after scrolling past the end of a short list. Then call `applyTheme(document.documentElement, boneSpec.theme)` in `mountApp`, as Wraith and the template do. _Requirements: 6.2_
  - [ ] 6.3 Write a failing e2e for the Warranty Wraith trace at 900, 960, 1024, 1100 and 1200 px with the longest purchase labels: no trace line is clipped or overlapped, the trace stays inside its columns, no horizontal scroll, text at 13px or more. Fix `oss-trace` (shrinkable text, fixed delta) first, and the Wraith grid media rule only if the 4-column trace is still too narrow. Re-run the gallery trace tests. _Requirements: 6.3, 8.4_
  - [ ] 6.4 Write a failing happy-dom test (`gallery-loading.test.ts`) that the gallery list has `state="loading"` before the store answers, shows no `oss-empty` until it holds zero entries, and loses `state` when entries arrive. Add an e2e that a `MutationObserver` installed before load never sees `oss-empty` on the default state. Then set `state="loading"` when the list is created in `gallery.ts`. _Requirements: 6.4, 8.2_

- [ ] 7. Axe
  - [ ] 7.1 Write a failing e2e for the launcher at 1280 and 390: `checkAxe` after `settle`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, no excluded node and no disabled rule. Fix every violation in the page or in core. _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 7.2 Add axe e2e for the Pantry Reaper list, detail and add dialog (open) at both widths. Fix every violation in core when it is a core element, in the app otherwise. _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 7.3 Add axe e2e for the Warranty Wraith list, detail (with a recall banner) and add dialog (open) at both widths. Fix every violation. _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 7.4 Add axe e2e for the gallery in the core, warm and cool themes at both widths. Fix every violation. _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 7.5 Check that no spec contains `disableRules`, `exclude(` or a reduced tag list, with a static test. _Requirements: 5.3_

- [ ] 8. Wrap-up
  - [ ] 8.1 Check that `git diff` shows nothing under `packages/ossuary-core/src/engine`, no `Date.now()` or `new Date()` without arguments in the engine, no domain word in `packages/ossuary-core`, no app-to-app import, no new runtime dependency and no UI framework. _Requirements: 7.1, 7.2, 7.3_
  - [ ] 8.2 Run the full gate: `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`. Fix every failure before closing the spec. _Requirements: 6.5, 7.4, 8.5_
