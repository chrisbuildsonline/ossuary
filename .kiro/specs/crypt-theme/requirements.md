# Requirements: crypt-theme

## Introduction

A dark **crypt** theme becomes the default look of Ossuary. The soft-paper look stays as **light mode** behind one toggle. The visual rules are in `design/DESIGN.md` (sections 2, 4, 5, 6, 8, 9 and 10, plus the mode paragraph at the top). This spec covers the code that makes them true: tokens, mode persistence, theme derivation, the toggle, decaying cards, the first-load burn-down, first-visit sample items and reduced motion.

All of it lives in `packages/ossuary-core` as generic tokens, components and helpers. The apps add config (their `bone.json` theme, which is unchanged) and data (their sample items). The core stays free of domain words, so `bun run hook:boundary` keeps passing. No new dependency.

## Requirement 1: Crypt tokens are the default, light mode sits behind a flag

**User story:** As a visitor, I want the page to be dark from the first paint, and to be able to switch to the light look.

### Acceptance criteria

1.1 THE SYSTEM SHALL declare the crypt token values from `design/DESIGN.md` section 2 on `:root` in `packages/ossuary-core/src/ui/tokens.css`, so the page is dark before any script runs.

1.2 THE SYSTEM SHALL declare the light values on `:root[data-mode="light"]`, with `--halo: 0`, no glows, `--motif-ink: var(--text)`, `--motif-spirit: var(--surface)`, `--motif-spirit-line: var(--text)` and `--motif-dish: var(--surface-sunken)`.

1.3 THE SYSTEM SHALL define the tokens `--motif-ink`, `--motif-dish`, `--motif-spirit`, `--motif-spirit-line`, `--halo`, `--spirit-glow`, `--glow-urgent`, `--glow-soon` and `--highlight` in both modes. Components SHALL use these tokens and no hard-coded colour, radius or duration.

1.4 THE SYSTEM SHALL meet WCAG AA as the asserted floor in both modes: at least 4.5:1 for text (including `--text`, `--text-2`, `--text-3` and the stage pill words) on every crypt surface, and at least 3:1 for outlines (`--line-strong`) on every crypt surface. The higher ratios in DESIGN.md (`--text` 13:1, `--text-2` 8:1, `--text-3` 5.9:1, stage pill words 8:1) are design targets and are not asserted by a test.

1.5 THE SYSTEM SHALL NOT use `#000` as a canvas or surface in either mode.

## Requirement 2: The mode is stored on the device

**User story:** As a visitor, I want my choice of mode to stick.

### Acceptance criteria

2.1 THE SYSTEM SHALL export `initMode()` and `setMode(mode)` from core. `initMode()` reads `localStorage["ossuary:mode"]` and sets `<html data-mode>` to `"crypt"` or `"light"`. `setMode(mode)` sets the attribute and writes the key.

2.2 WHEN the key is missing, holds any other value, or `localStorage` throws, THEN `initMode()` SHALL select `crypt`. It SHALL NOT throw. `setMode()` SHALL still set the attribute when the write fails.

2.3 WHEN `setMode("crypt")` runs THEN the attribute SHALL be `data-mode="crypt"`. `tokens.css` SHALL treat only `data-mode="light"` as light.

2.4 THE SYSTEM SHALL call `initMode()` before the first item render in each app and in the launcher, through `ensureDocumentTokens`. No `index.html` SHALL have an inline script in `<head>`. The crypt is the `:root` default in `tokens.css`, so the first paint is dark without a script, and a stored light choice is applied when `ensureDocumentTokens` runs.

2.5 THE SYSTEM SHALL write `ossuary:mode` only on a toggle press. It SHALL NOT write it on load.

2.6 THE SYSTEM SHALL make no network request for any of this.

## Requirement 3: applyTheme writes both sets

**User story:** As an app author, I want one `theme` block to style both modes.

### Acceptance criteria

3.1 THE SYSTEM SHALL change `applyTheme(el, theme)` so it writes each themable token twice, as `--light-*` and `--crypt-*` (`--light-accent`, `--crypt-accent`, `--light-accent-ink`, `--crypt-accent-ink`, `--light-accent-tint`, `--crypt-accent-tint`, `--light-canvas`, `--crypt-canvas`, `--light-surface`, `--crypt-surface`, `--light-surface-sunken`, `--crypt-surface-sunken`), and sets `data-themed` on the element. `--font-display`, `data-motif` and `data-empty-art` behave as before.

3.2 THE SYSTEM SHALL have `tokens.css` pick the set for the current mode on a themed element (`[data-themed]`), so a mode switch is pure CSS and never re-renders a component.

3.3 WHEN `theme` is undefined THEN `applyTheme` SHALL remove every `--light-*` and `--crypt-*` property it wrote and the element SHALL fall back to the core values. `data-themed` SHALL be absent or `false`.

3.4 THE SYSTEM SHALL NOT let a spec set text colours, ink, stage tones, radius, spacing, shadows, type scale, focus or motion. The schema is unchanged.

## Requirement 4: Crypt colours are derived from the light theme

**User story:** As an app author, I want a dark theme for free from the colours I already chose.

### Acceptance criteria

4.1 THE SYSTEM SHALL export a pure function `cryptTheme(theme)` from `packages/ossuary-core/src/ui/crypt.ts` that returns `{ canvas, surface, surfaceSunken, accent, accentInk, accentTint }`.

4.2 THE SYSTEM SHALL derive canvas, surface and sunken from the hue and saturation (saturation capped at 34%) of the spec's light canvas, at HSL lightness 6.5%, 11.5% and 8.5%. For the light canvases in DESIGN.md section 4 the results SHALL be `#14120d` (Pantry Reaper) and `#0b0e16` (Warranty Wraith). With no canvas it SHALL return the core crypt values (`#0d0f14`, `#181b23`, `#11141a`).

4.3 THE SYSTEM SHALL derive the crypt accent by raising the HSL lightness of the spec accent in small steps until it reaches 4.6:1 on the crypt surface, canvas and accent tint, and no further. A spec accent that already passes SHALL be kept. The results SHALL be `#f07639` (Pantry Reaper), `#9086e0` (Warranty Wraith) and `#7a90db` (core).

4.4 THE SYSTEM SHALL set the crypt accent tint to the spec accent at 24% over the crypt surface and the crypt accent ink to the crypt accent.

4.5 THE SYSTEM SHALL be deterministic and pure: the same input gives the same output, with no DOM, `Date` or random value.

4.6 THE SYSTEM SHALL check, in a unit test, every app theme (`apps/*/bone.json`, found by glob, so a third app is covered), the bone-forge template theme and every gallery theme, in both modes, against these pairs: text, text-2, text-3 and accent-ink on canvas, surface, sunken and tint; the accent against canvas and surface at 4.5:1; `--line-strong` against surface and sunken at 3:1; the on-ink label on ink; each stage pill word on its pill. Each pair SHALL be at least 4.5:1 (3:1 for UI boundaries).

4.7 IF a theme cannot reach 4.5:1 THEN `cryptTheme` SHALL still return a value and the unit test SHALL fail with the app and pair named. The function SHALL NOT throw.

## Requirement 5: A theme toggle

**User story:** As a visitor, I want one button to switch between crypt and light.

### Acceptance criteria

5.1 THE SYSTEM SHALL show a 44x44px icon button in `oss-shell`: in the desktop top bar left of the primary pill, and at the right of the phone app bar. It SHALL NOT be a primary action.

5.2 THE SYSTEM SHALL show the same toggle on the launcher beside the GitHub link.

5.3 THE SYSTEM SHALL implement the toggle as one core element (`oss-mode-toggle`) used by both. It SHALL be a real `<button>` with `aria-pressed` (`true` when light is on) and the accessible name "Light theme". The glyph (sun in crypt, moon in light) SHALL be `aria-hidden`.

5.4 WHEN the toggle is pressed THEN it SHALL call `setMode`, flip `aria-pressed` and update the glyph. It SHALL NOT re-render the list or touch the store.

5.5 WHEN the mode is changed in the page THEN every toggle SHALL follow it through the document `oss-mode` event. Following a change made in another tab (`storage` event) is task 5.3 and is not required.

5.6 THE SYSTEM SHALL be operable by keyboard (Enter and Space) and show the focus ring.

5.7 THE SYSTEM SHALL keep exactly one primary pill per screen. The toggle SHALL NOT count as one.

## Requirement 6: Candle and ghost in the crypt

**User story:** As a visitor, I want to see at a glance how much life is left.

### Acceptance criteria

6.1 THE SYSTEM SHALL draw, above the wax of a candle, a dashed `--line-strong` outline (class `.burnt`) of height `64 * (1 - fraction)` in the 48x96 viewBox. It SHALL be absent at `fraction` 1.

6.2 THE SYSTEM SHALL draw a blurred flame-coloured circle (class `.halo`) behind the flame, with opacity `var(--halo)` and a radius scaled with the flame. It SHALL be absent when the stage is `dead`. In light mode `--halo` is 0, so it is invisible.

6.3 THE SYSTEM SHALL fill a ghost with `--motif-spirit`, stroke it with `--motif-spirit-line` and give it a `--spirit-glow` drop-shadow that follows the fill opacity, so a full-life ghost glows and a nearly dead one fades into the stone. Fill opacity SHALL be `0.15 + 0.85 * fraction` and stroke opacity `0.35 + 0.65 * fraction`. Eyes SHALL use `--motif-ink`.

6.4 THE SYSTEM SHALL keep the existing candle and ghost rules (drips, flame size by stage, dotted hem below 0.25, dead states) and the quantisation of `fraction` to 1/20 steps.

6.5 THE SYSTEM SHALL keep motifs `aria-hidden="true"` and always next to the number, unit and stage pill.

6.6 THE SYSTEM SHALL NOT use a gradient inside the art. Light is made by CSS blur, drop-shadow and box-shadow.

## Requirement 7: Decaying item cards

**User story:** As a visitor, I want cards to look weaker as the item nears its end.

### Acceptance criteria

7.1 THE SYSTEM SHALL set `--life` (the quantised fraction) and the stage tone as attributes or properties on every `oss-item` card and row.

7.2 THE SYSTEM SHALL paint the card slab as `--surface` at `40% + 60% * life` over the canvas, while text stays on solid colours. Text contrast SHALL be at least 4.5:1 at `life` 0 and at `life` 1, checked in a test.

7.3 THE SYSTEM SHALL give `soon` cards a faint amber edge glow (`--glow-soon`) and `urgent` cards an ember glow (`--glow-urgent`) that breathes slowly (opacity .6 to 1 over 2.8s, at most 0.4Hz). A row gets the same as a 3px left ember bar. Both glows are 0 in light mode.

7.4 THE SYSTEM SHALL render a `dead` card as a ghost of a card: no slab, a 1.5px dashed `--line-strong` outline, the motif at 55% opacity and greyscale, and the name and number in `--text-2`. The number SHALL still read "3 days ago" and the pill SHALL still say the stage word.

7.5 THE SYSTEM SHALL keep the whole card one link, 44px targets, the hover lift and the visible focus ring on every state.

7.6 THE SYSTEM SHALL animate only the urgent ember breath on a list at rest. It SHALL idle at most one motif on screen, and only on detail or the hovered card.

## Requirement 8: First-load burn-down

**User story:** As a first-time visitor, I want the decay to play once so I understand what the art means.

### Acceptance criteria

8.1 WHEN a list renders with at least one item for the first time in a page load THEN every candle SHALL burn down from full height to its fraction, every ghost SHALL fade from full to its opacity, and every dead card SHALL fade from a slab to its ghost outline. It SHALL take 1.2s with `--ease-out` and 50ms stagger between items (stagger capped so the whole run ends within 2.5s).

8.2 THE SYSTEM SHALL NOT replay it on any later render in the same page load: filtering, editing, removing, undo, switching storage, a mode switch or a store refresh.

8.3 WHEN a list renders empty THEN it SHALL NOT use up the burn-down. The first render that has items plays it.

8.4 THE SYSTEM SHALL have `oss-list` own the one-shot flag, so apps need no code for it.

8.5 THE SYSTEM SHALL animate the whole card on first load: it fades in and rises, so the art, the number, the pill and the name arrive together. The number and the pill SHALL NOT change value during it. The final state SHALL be the same as the static one.

8.6 THE SYSTEM SHALL keep the flag in memory only. A new page load (a browser reload) plays the burn-down once again.

## Requirement 9: First-visit sample items

**User story:** As a first-time visitor, I want to see living, dying and dead items straight away without typing anything.

### Acceptance criteria

9.1 THE SYSTEM SHALL export `seedFirstVisit(store, samples, options)` from core. `samples` is data the app passes in. The core holds no sample items and no domain words.

9.2 WHEN the app starts on the very first visit and the store is empty THEN `seedFirstVisit` SHALL add the samples once, and an `oss-toast` SHALL say "Sample items added" with a "Clear" action.

9.3 THE SYSTEM SHALL record the visit in `localStorage` under the key `ossuary:<spec id>:visited`, so it works offline and needs no IndexedDB change. It SHALL write the key whether or not it added items, except when the sample list is empty, where it writes nothing.

9.4 WHEN the key exists, or the store is not empty (including after "Clear", a restore, an import or the user deleting everything) THEN it SHALL add nothing. A later visit SHALL NOT re-add samples.

9.5 WHEN "Clear" is pressed THEN exactly the samples it added SHALL be removed, found by id, and no item the user created since. The toast action SHALL be reachable by keyboard and the toast SHALL follow the existing toast rules (5s, pause on hover and focus).

9.6 THE SYSTEM SHALL compute sample dates from the `now` passed in (for example "bought 3 days ago"), as offsets in days, never as fixed calendar dates. The same call with the same `now` SHALL write the same items. The sample set SHALL contain at least one item in each of the living, dying (`soon` or `urgent`) and `dead` stages.

9.7 THE SYSTEM SHALL validate each sample against the app's spec with the existing item schema before writing, and write nothing if one is invalid.

9.8 THE SYSTEM SHALL hold each app's samples as data in the app (`apps/<app>/src/data/samples.ts`) and each SHALL be different in voice. Pantry Reaper and Warranty Wraith SHALL each have a sample set. The bone-forge scaffold SHALL emit an empty `samples` list, and `seedFirstVisit` SHALL do nothing for an empty list, so a scaffolded app still works.

9.9 THE SYSTEM SHALL NOT mark sample items as private or hidden. They behave as any item (edit, delete, export).

9.10 THE SYSTEM SHALL make no network request.

## Requirement 10: Reduced motion shows final static states

**User story:** As a visitor who asks for less motion, I want everything drawn in its end state.

### Acceptance criteria

10.1 WHEN `prefers-reduced-motion: reduce` matches THEN all `--dur-*` tokens SHALL be `0ms`, as already specified in a11y-motion.

10.2 WHEN it matches THEN the SYSTEM SHALL run no CSS animation and no CSS transition on any crypt feature: the first-load burn-down, the ember breath, the flame sway, the ghost float, the card hover lift and the death animation. A test SHALL assert `getAnimations()` is empty on the list and detail screens.

10.3 WHEN it matches THEN candles, ghosts, glows and ghost cards SHALL be drawn in their final state: the burnt outline and halo at their static values, ghost fill at its final opacity, `urgent` glow at full strength, `dead` cards as dashed outlines.

10.4 WHEN it matches THEN the first-load burn-down SHALL be skipped but SHALL still be marked done, so it does not run later.

10.5 THE SYSTEM SHALL keep every state readable without motion. The number, pill and glyph carry the meaning.

10.6 THE SYSTEM SHALL keep the motion source test (`motion-source.test.ts`) passing: every keyframe and transition in core is covered by the reduced-motion rule.

## Requirement 11: Accessibility in the crypt

**User story:** As a visitor with low vision or a keyboard, I want the dark theme to be as usable as the light one.

### Acceptance criteria

11.1 THE SYSTEM SHALL have no axe violations in the crypt (the default) on the launcher, Pantry Reaper and Warranty Wraith, at 1280 and 390 px wide, on every screen the existing e2e a11y specs visit (list, empty state, detail, add sheet, import dialog, trace drawer, and the recall banner on Wraith), and with the sample items present.

11.2 THE SYSTEM SHALL keep the same specs passing in light mode, set through the toggle.

11.3 THE SYSTEM SHALL have no horizontal scroll at 390 px, keep all targets at 44x44px, and keep the focus ring visible and at least 3:1 against canvas and surface in both modes.

11.4 THE SYSTEM SHALL NOT use colour as the only status signal in either mode.

11.5 THE SYSTEM SHALL derive the focus ring from the accent as before, and it SHALL use the crypt accent in the crypt.

## Requirement 12: Boundaries and gate

**User story:** As the maintainer, I want the theme to respect the skeleton rules.

### Acceptance criteria

12.1 THE SYSTEM SHALL keep `bun run hook:boundary` passing: no app or tool import in core, no `Date` or DOM in the pure layers (`cryptTheme` is pure; `initMode`, `setMode` and `seedFirstVisit` are not in a pure layer and take `now` and `storage` as arguments where they need them), and no domain word in core.

12.2 THE SYSTEM SHALL keep the apps as config plus data. The only new app code is the `samples` data, one `seedFirstVisit` call in `main` and the `initMode()` call. Neither app SHALL fork a component.

12.3 THE SYSTEM SHALL keep `bun run hook:spec` passing without a schema change: existing `bone.json` files stay valid and unchanged.

12.4 THE SYSTEM SHALL keep bone-forge output the same layout as the existing apps, with the new `initMode()` call, the `<head>` script and an empty `samples.ts`.

12.5 THE SYSTEM SHALL add no runtime dependency.

12.6 THE SYSTEM SHALL pass the gate before the spec is closed: `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`.
