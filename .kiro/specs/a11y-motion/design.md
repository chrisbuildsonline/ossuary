# Design: a11y-motion (accessibility and motion polish)

## Overview

The work is mostly checks. Each requirement gets a test that reads the real tokens, markup or page, and the fixes are small edits in the files the tests point at. No engine code changes, so the engine stays free of `Date`.

What exists today (read before writing this spec):

- `tokens.css` already zeroes `--dur-*` and sets `animation: none !important; transition: none !important` under `prefers-reduced-motion: reduce` on `:host, *, *::before, *::after`. Every shadow root adopts that sheet through `adopt()` in `styles.ts`, so core elements are covered by that rule. The pages themselves (apps, launcher, gallery, template) get it through `ensureDocumentTokens`. Nothing proves it end to end yet.
- `launcher.css` uses `@media (min-width: 900px) and (prefers-reduced-motion: no-preference)` for rotation and lift.
- Animations that exist: `oss-decay` (sway, flicker, float, tween), `dialog.ts` (side-in, up-in, fade-in), `oss-toast` (toast-in), `oss-trace` (line-in), `oss-list` (loading pulse), `pr-food-search` (list `in`), and transitions on pill, button, item, field, storage switch and the list toggle.
- `tokens.test.ts` checks tone pairs and text tokens against 4.5:1 with the `contrastRatio` helper in `schema/contrast.ts`. It does not check themes, glyphs, ring or outline at 3:1.
- Focus: `baseCss` sets `:focus-visible { outline: var(--focus); outline-offset: 2px }`. The gallery e2e already tabs through one screen and checks a ring. The apps and launcher do not.
- `@axe-core/playwright` is already in the root and core `package.json`. No test uses it yet.
- Countdown names: `accessibleName` and `expirySentence` in `ui/countdown.ts` build "Milk. Use soon. Expires in 3 days, Friday 20 November." `oss-item` and `oss-lifespan` set it as `aria-label` with the digits `aria-hidden`. The Pantry detail countdown sets `aria-label` to `${stage}. ${spoken}`, which names no item and no "expires".
- Known issues: template detail row is `calendar, edit, remove`, the apps are `calendar, edit`; Pantry Reaper never calls `applyTheme(document.documentElement, ...)` while Wraith and the template do; the gallery builds `oss-list` with no `state` and sets one only after `openStore` resolves.

## Components and interfaces

New files (tests live next to code):

```
packages/ossuary-core/src/ui/contrast-tokens.test.ts   contrast for every tone pair and theme
packages/ossuary-core/src/ui/motion-source.test.ts     source scan for 1.4 and 1.5
packages/ossuary-core/src/ui/a11y-names.test.ts        names and live regions (happy-dom)
packages/ossuary-core/src/testing/a11y.ts              generic Playwright helpers (no domain words)
packages/ossuary-core/gallery/gallery-loading.test.ts  loading state (happy-dom)
apps/<app>/e2e/a11y.spec.ts                            reduced motion, focus, axe, per app
apps/launcher/e2e/a11y.spec.ts                         same for the launcher
packages/ossuary-core/e2e/a11y.spec.ts                 same for the gallery
```

`testing/a11y.ts` is the one shared helper module. It is generic (no food or warranty words) and sits beside `network-guard.ts`, which the launcher e2e already imports the same way.

```ts
// packages/ossuary-core/src/testing/a11y.ts (Playwright types only; not imported by shipped code)
export const WIDTHS = [1280, 390] as const;
export async function checkAxe(page: Page): Promise<void>;                 // wcag2a, wcag2aa, wcag21a, wcag21aa; throws with rule, target, summary
export async function settle(page: Page): Promise<void>;                   // fonts ready, then no running animation in any shadow root
export async function runningMotion(page: Page): Promise<string[]>;      // running animations and non-zero transition durations, by selector
export async function tabThrough(page: Page): Promise<{ missed: string[]; noRing: string[] }>; // deep Tab walk, as the gallery test does today
```

- `settle` and `tabThrough` lift and generalise the code now inlined in `gallery.spec.ts` (the shadow-root walk, `__tab` list, ring check). The gallery spec is then changed to call them, with the same assertions, so there is one implementation.
- `checkAxe` uses `new AxeBuilder({ page }).withTags([...]).analyze()` and fails with a message listing `id`, `nodes[].target` and `nodes[].any[].message`. It has no `disableRules` and no `exclude`.
- `runningMotion` walks `document` and every open shadow root, calls `getAnimations()` and reads `getComputedStyle(el).transitionDuration` and `animationName`. It reports anything running, and any non-zero duration, so a rule that only pauses an animation still fails.

## Reduced motion (requirement 1)

The shared rule already exists. The work is to prove it and close the holes:

1. Write the Playwright test first (`emulateMedia({ reducedMotion: 'reduce' })`, then each screen, `runningMotion` must be `[]`). It also opens a sheet, a dialog, the trace drawer and the toast, the places motion starts on an action.
2. The source scan (`motion-source.test.ts`) reads every `.ts`/`.css` under `packages/ossuary-core/src/ui`, the apps, the launcher, the gallery and the template. A file that declares `animation:` or `transition:` must be in a shadow root that calls `adopt()` or on a page that loads `tokens.css`, or must carry its own `prefers-reduced-motion` rule. The launcher rule stays, since it sets rotation to 0 under reduce.
3. Likely fixes if the test fails: a page-level `<style>` or `adoptedStyleSheets` entry that is not covered because it sets `transition` with higher specificity than `*` (the `!important` already wins), and an `animation` set through the `animate` API (none exist now; 1.5 keeps it that way).
4. In reduce mode the date jump needs no motion. The apps already say it in the toast ("Moved to freezer: +58 days"), and a test confirms the toast text in reduce mode (1.3).
5. `no-preference` is tested too (1.6): the same screens still run the flame sway on a hovered detail motif, so the rule is not accidentally always on.

## Contrast (requirement 2)

`contrast-tokens.test.ts` is a vitest that reads the data, not copies:

- `tokens.css` is read as text (as `tokens.test.ts` does) for `--tone-*-bg/fg`, `--text*`, `--surface*`, `--canvas`, `--line-strong`, `--accent*`, `--ink`, `--ink-hover`, `--on-ink`.
- Each app's theme is read from `apps/pantry-reaper/bone.json`, `apps/warranty-wraith/bone.json` and `tools/bone-forge/template/bone.json`. The launcher uses the core tokens and each card's theme, read the same way. The gallery warm and cool themes are read from the constant in `gallery.ts` (exported from a small `gallery/themes.ts` so the test and the page share one source; if exporting is a larger change, the test reads the file text).
- Pairs checked, with the minimum:

| Pair | Min |
|---|---|
| each tone `fg` on `bg` (text) | 4.5 |
| each tone `fg` on `bg` (glyph, 14px stroke) | 3 |
| `--text`, `--text-2`, `--text-3` on `--surface`, `--surface-sunken`, each canvas | 4.5 |
| `--accent` on `--surface` and each canvas (link text) | 4.5 |
| `--accent-ink` on `--accent-tint` | 4.5 |
| `--accent` focus ring on `--surface` and each canvas | 3 |
| `--line-strong` on `--surface` and `--surface-sunken` | 3 |
| `--on-ink` on `--ink` and `--ink-hover` | 4.5 |
| `--tone-*-fg` on `--surface` (the stage word beside a glyph in `oss-item`) | 4.5 |

- The test builds the name of each failing pair into the message, for example `pantry-reaper --text-3 on canvas #f2efea: 4.38`.
- Fixes stay inside the look. A failing token is darkened (text, ring) or lightened (tint), keeping hue and saturation, to the first value that passes with 0.1 margin. Tone slots are owned by core, so a tone fix is one edit in `tokens.css`, not per app. DESIGN.md quotes ratios. If the test proves a quoted ratio wrong, the same change corrects that table. The existing schema rule (accent at least 4.5 on white and canvas) stays.
- Large text (3:1) applies to numbers at 24px and above, but the tests use 4.5 for them as well. It costs nothing, since all tokens already clear it, and it removes a judgement call.

## Focus (requirement 3)

`tabThrough` is the gallery's walk made generic: it collects every focusable element, deep through open shadow roots, with its resting `box-shadow`. It then presses Tab until each is reached (limit `2n + 10` presses) and checks a ring (outline of at least 2px, or a `box-shadow` that differs from rest, the second for wrappers such as `.field:has(input:focus-visible)`). It returns `missed` and `noRing`; both must be empty.

Per app it runs on list, detail and open dialog; for the launcher on the one page; for the gallery on the existing screen plus the themed variants. A dialog is walked with the trap on, so only its controls are expected.

Likely fixes: any `outline: none` or `outline: 0` on an interactive element that has no wrapper ring. The `outline: none` rules found while reading the code are `h1:focus` (a `tabindex="-1"` target, allowed by 3.2) and the `pr-food-search` inner input (rung by `.field:has(input:focus-visible)`). A static test greps for `outline:\s*(none|0)` and fails on any other, so a new one cannot slip in.

## Countdown names and live regions (requirement 4)

- `a11y-names.test.ts` (happy-dom) renders `oss-item` (card and row) and `oss-lifespan` from fixed items and fixed `now`, and asserts the exact `aria-label` ("Milk. Use soon. Expires in 3 days, Friday 20 November."), that the digits are `aria-hidden`, and that no `[aria-live], [role="status"], [role="alert"]` exists inside any countdown.
- Pantry detail: the number `p` gets the same sentence form through `accessibleName`, with the item title and the evaluation, replacing `${stage}. ${spoken}`. This is a one-line change in the app plus an update to the e2e that asserts the old label, if one does.
- The whole-app check (e2e, per screen) lists every `[aria-live], [role=status], [role=alert]` in the document and shadow roots and asserts each is the toast, the loading placeholder, a banner or a search combobox result count, and that none contains a `time` element or a countdown digit.
- No timer re-renders text inside a live region. The minute refresh (if an app has one) goes through `render()` on non-live nodes only. A test advances the page clock with `page.clock` by 61 minutes on a list and asserts that the toast region text did not change and the live-region mutation count is 0 (a `MutationObserver` on every live region).

## Axe (requirement 5)

One spec per project calls the helpers in a loop over `WIDTHS` with `page.setViewportSize`. The apps' projects (`pantry-reaper`, `warranty-wraith`, launcher, gallery) already exist in `playwright.config.ts`, so no project is added. The launcher and gallery have 1280 and 390 projects already and the tests run in both. The apps run at the default viewport, so their spec loops over `WIDTHS` itself. Each test is named `axe: <screen> at <width>` so a failure names the screen.

Screens are reached the way the existing e2e does: seeded items through the app's own test helpers (`e2e/purchases.ts` for Wraith, the signoff spec's seeding for Pantry) and `?state=` and `?theme=` for the gallery. For dialogs, axe runs while the sheet is open, after `settle`.

Violations seen in practice with web components (to fix in core, not suppress): a `dialog` without an accessible name, `aria-label` on a `div` without a role, a `label` not tied to its control across shadow roots, colour contrast on the `oss-pill` and a duplicate landmark from two `oss-shell` regions. The fix for each is in the core element, so every app gains it.

## Known issues (requirement 6)

**6.1 Template parity.** First a failing happy-dom test in `template/src/app.test.ts` that renders the detail view and compares the action row with the apps: labels, order, `variant`, `icon`, `data-action`. The expected row is written down in the test (Add to calendar, Edit) from the apps, with a comment pointing at the two app `renderDetail` functions. Then `renderDetail` in the template drops the extra "Remove" from that row. `removeEntry` and its Undo path stay in the template. Task 6.1 first reads how each app exposes removal (Pantry Reaper has a "Remove" only on its unreadable-item note; the detail views have none) and the template copies that placement, or drops the control if the apps offer nothing equivalent. If the user wants remove on the detail row in all three, that is a change to the two apps, not this spec, and it is listed under open questions. The `bone-forge` `generated.test.ts` is extended to assert a freshly scaffolded app has the same row.

**6.2 Pantry canvas.** A failing e2e: load Pantry Reaper, read `getComputedStyle(document.documentElement).getPropertyValue('--canvas')` and the body's computed `background-color`, and assert both equal the theme canvas `#f2efea`. Today `body { background: var(--canvas) }` resolves against `:root`, which has only the core value. The fix is one line in `mountApp`, `applyTheme(document.documentElement, boneSpec.theme)`, as the template and Wraith do. A happy-dom test in `app.test.ts` covers the same through the `--canvas` property on `documentElement`.

**6.3 Wraith trace wrap.** A failing e2e at 900, 960, 1024, 1100 and 1200 px on a purchase with the longest labels from `purchases.ts`: every `li` in `oss-trace` has a height of one line (or, if wrapping is allowed, `scrollWidth <= clientWidth`), the trace box lies inside the grid columns, and the document has no horizontal scroll. The trace sits in columns 9 to 12 and is about 270 px wide at 900. The likely cause is the right-aligned delta taking its width before the rule text can shrink. The fix is in `oss-trace` (`min-width: 0` on the text, `overflow-wrap: anywhere`, the delta `flex: none`) so the text wraps in its own column. If the 4-column trace is too narrow at 900 to 1000, the Wraith grid moves the trace under the cards below 1000 px (a `.ww-grid` media rule, app layout only). The fix that keeps the text at 13px or more wins, and the test says which.

**6.4 Gallery loading.** A failing happy-dom test: building the gallery list sets `state="loading"` before the store answers, the empty element is absent until `reload()` finishes with zero entries (or `?state=empty`), and `state` is removed when entries arrive. The fix is to set `list.setAttribute('state', 'loading')` when the list is created, ahead of `start()`. `reload()` already removes `state`. An e2e checks that a `MutationObserver` installed before load never sees `oss-empty` in `oss-list` on the default state.

## Data models

None. Test helpers return plain arrays of strings. No schema, store or spec change.

## Error handling

- A failing axe run prints one block per violation (rule id, impact, selector, message). It never retries.
- A flaky motion check is not retried. `settle` waits for the page, and if animations still run it fails with the selector.
- Playwright tests run with `reducedMotion` set per test, and are reset after, so one test cannot leak the setting.

## Testing strategy

- **Vitest (fast, in `bun run test`):** contrast of tokens and themes; source scans for motion, `outline: none` and live regions; names; template parity; gallery loading; Pantry theme on `documentElement`. These use fixed `now` values and no clock.
- **Playwright (`bun run e2e`):** reduced-motion on every screen; Tab-through on every screen; axe on the eight screens at two widths; Pantry canvas; Wraith trace at 900-1200; gallery loading flash.
- **No change to the engine tests.** `git diff` on `packages/ossuary-core/src/engine` is empty at close, and the engine property tests stay as they are.

## Decisions and alternatives

- **One shared helper in core `testing/`** rather than a copy in each app, because the three apps and the gallery need the same walk and axe call. It has no domain words and apps do not import each other.
- **Read tokens, do not copy them.** A test that holds its own list of colours passes when the token drifts. Reading `tokens.css` and `bone.json` keeps the check honest.
- **Fix tokens, not the test.** Failing colours are adjusted inside the look. Lowering the bar or widening a theme is out of scope.
- **No axe exclusions.** Excluding a node hides the problem the check exists to find.
- **Reduced motion by the existing shared rule, proven by test**, rather than per-component media queries. A new component then gets it for free from `adopt()`, and the scan catches a page that bypasses it.
- **Template drops "Remove" from the detail row** rather than adding it to the apps, because the request is to make the template match the apps, and the apps are the shipped reference.

## Open questions

- Should "Remove" exist on the detail view of all three apps? This spec assumes no, and matches the template to the two apps as they are.
- The exact failing pairs are unknown until the contrast test runs. The first task records them before any token changes.
