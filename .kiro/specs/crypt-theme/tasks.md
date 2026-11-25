# Tasks: crypt-theme

Rules for every task: write the failing test first, then the code, and keep the whole suite green before the next task. Requirement numbers refer to `requirements.md`. Visual rules come from `design/DESIGN.md`.

- [ ] 1. Colour helpers and crypt derivation
  - [ ] 1.1 Write a failing `color.test.ts` (hex/HSL round trip, `mix`, `contrast` against known WCAG values). Then add `ui/color.ts`. _Requirements: 4.1, 4.5_
  - [ ] 1.2 Write a failing `crypt.test.ts`: the Pantry Reaper (`#14120d`, `#f07639`), Warranty Wraith (`#0b0e16`, `#9086e0`) and core (`#0d0f14`, `#181b23`, `#11141a`, `#7a90db`) results, the 34% saturation cap, an accent that already passes is kept, the tint is the spec accent at 24% over the surface, and a fast-check property that the same input gives the same output and every derived accent is at least 4.6:1 on surface, canvas and tint. Then add `ui/crypt.ts` with `cryptTheme`. Update DESIGN.md section 4 in the same change if a derived hex differs by one step. _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

- [ ] 2. Tokens
  - [ ] 2.1 Extend `tokens.test.ts` so it fails: `:root` holds the crypt values from DESIGN.md section 2, `:root[data-mode="light"]` holds the light values, both define every `--motif-*`, `--halo`, `--spirit-glow`, `--glow-*` and `--highlight`, `--halo` is 0 in light, and neither mode uses `#000`. Then rewrite `tokens.css` (crypt default, light behind `data-mode`, `[data-themed]` reads `--crypt-*` or `--light-*`). _Requirements: 1.1, 1.2, 1.3, 1.5, 3.2_
  - [ ] 2.2 Extend `contrast-tokens.test.ts` so it fails for any crypt pair below its ratio: text 13:1, text-2 8:1, text-3 5.9:1, `--line-strong` 3:1 on every crypt surface, the on-ink label, the five crypt pills at 8:1. Then fix the token values until it passes. Light pairs keep their current checks. _Requirements: 1.4_
  - [ ] 2.3 Move hard-coded colours, radii and durations out of core components into tokens where the crypt needs them. Extend the existing source test that scans component styles for literals so it fails first. _Requirements: 1.3_

- [ ] 3. Mode
  - [ ] 3.1 Write a failing `mode.test.ts` (default crypt, stored light, garbage value, throwing storage, `setMode` writes and sets the attribute, `initMode` never writes). Then add `ui/mode.ts` and export it from core. _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_
  - [ ] 3.2 Write a failing test for each `index.html` (launcher, both apps, the bone-forge template) that the `<head>` script reads `ossuary:mode` (same key as `MODE_KEY`) and sets `data-mode="light"` only for `light`. Then add the inline script and the `initMode()` call before the first render in each `main.ts`. _Requirements: 2.4_

- [ ] 4. Theme application
  - [ ] 4.1 Extend `theme.test.ts` so it fails: `applyTheme` writes `--light-*` and `--crypt-*` for accent, accent-ink, accent-tint, canvas, surface and surface-sunken, sets `data-themed`, leaves the light values as before, and removes everything and `data-themed` when the theme is undefined. Then update `ui/theme.ts` to call `cryptTheme`. _Requirements: 3.1, 3.3, 3.4_
  - [ ] 4.2 Write a failing `crypt-contrast.test.ts` that globs `apps/*/bone.json`, adds the bone-forge template theme and every gallery theme, and checks the AA pairs of requirement 4.6 in both modes, naming the app and pair on failure. Then fix `cryptTheme` or the token values until it passes. It must not list the apps by name. _Requirements: 4.6, 4.7_

- [ ] 5. Theme toggle
  - [ ] 5.1 Write a failing `oss-mode-toggle.test.ts` (a `<button>` named "Light theme", `aria-pressed`, `aria-hidden` glyph swap sun/moon, calls `setMode`, follows a `storage` event, Enter and Space, 44px target, does not touch the store). Then add `elements/oss-mode-toggle.ts` and register it. _Requirements: 5.3, 5.4, 5.5, 5.6_
  - [ ] 5.2 Write a failing test that `oss-shell` places the toggle left of the primary pill on desktop and at the right of the phone app bar, and that the shell still has exactly one primary pill. Then add the slot. Add a failing test for the launcher page that the toggle sits beside the GitHub link, then add it. _Requirements: 5.1, 5.2, 5.7_

- [ ] 6. Candle and ghost
  - [ ] 6.1 Extend `oss-decay` tests so they fail: `.burnt` height is `64 * (1 - fraction)` and absent at 1, `.halo` is present except for `dead` and uses `var(--halo)`, no gradient element in the output, the motif stays `aria-hidden`. Then add them to the candle. _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_
  - [ ] 6.2 Extend the ghost tests so they fail: fill opacity `0.15 + 0.85 * fraction`, stroke opacity `0.35 + 0.65 * fraction`, the glow wrapper follows the fill, eyes use `--motif-ink`, the dotted hem below 0.25, the dead outline. Then update the ghost. _Requirements: 6.3, 6.4_
  - [ ] 6.3 Extend the gallery with every motif in every stage and both modes, and check it by eye at 32, 48, 120 and 200px in the crypt and in light. _Requirements: 6.1, 6.2, 6.3_

- [ ] 7. Decaying cards
  - [ ] 7.1 Extend `item-list.test.ts` so it fails: every card and row carries `--life` (quantised) and the stage tone, a dead card has the ghost class and its number still reads "3 days ago" with the stage pill, and rows get the left ember bar for `urgent`. Then update `oss-item`. _Requirements: 7.1, 7.4, 7.5_
  - [ ] 7.2 Write a failing contrast test for the card slab at `life` 0 and `life` 1 (the mixed colour from `color-mix` computed in the test) against `--text`, `--text-2` and `--text-3`. Then write the slab, glow and ember-breath CSS (breath animates a glow layer's opacity, not the card). _Requirements: 7.2, 7.3, 7.6_

- [ ] 8. First-load burn-down
  - [ ] 8.1 Write a failing `burn-down.test.ts`: the first render with items sets `data-enter` and the per-item `--i` (capped so the run ends within 2.5s); a second render, a filter, an edit, a removal and an undo do not; an empty render does not use it up; a fresh module instance plays again. Then add the flag and attribute to `oss-list`. _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_
  - [ ] 8.2 Add the `burn`, `fade-in` and `slab-to-ghost` keyframes under `[data-enter]`, driven by `--from` over the final geometry, with the attribute removed on `animationend` and after a 2.6s fallback. Add a failing test first that the number, pill and name have no animation, and that the final computed state equals the static one. _Requirements: 8.1, 8.5_

- [ ] 9. Reduced motion
  - [ ] 9.1 Extend `motion-source.test.ts` so it fails: the new keyframes (`burn`, `fade-in`, `slab-to-ghost`, `ember`) and the card hover transition are all inside the reduced-motion rule. Then update the rule. _Requirements: 10.1, 10.3, 10.6_
  - [ ] 9.2 Write a failing test that with `prefers-reduced-motion: reduce` the list does not add `data-enter` but still marks the burn-down done, and that urgent glows are at full strength with no animation. Then fix `oss-list` and the CSS. _Requirements: 10.3, 10.4, 10.5_

- [ ] 10. First-visit samples
  - [ ] 10.1 Write a failing `first-visit.test.ts` with fake-indexeddb: seeds an empty store once and shows the toast with Clear; skips on a non-empty store; skips on the second call; Clear removes only `sample-*` ids and leaves a user item; a store emptied by the user is not re-seeded; an invalid sample writes nothing and names the id; the same `now` gives the same items; an empty list does nothing and does not set the key. Then add the `meta` store (a schema version bump that keeps existing items) and `ui/first-visit.ts`, exported from core. _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  - [ ] 10.2 Write a failing `samples.test.ts` in each app that resolves its samples at a fixed `now` through the engine and finds at least one living, one `soon` or `urgent` and one `dead` item, that all validate against the app spec, and that Warranty Wraith has one sample that matches the recall snapshot. Then add `apps/pantry-reaper/src/data/samples.ts` and `apps/warranty-wraith/src/data/samples.ts` and call `seedFirstVisit` in each `main.ts`. _Requirements: 9.6, 9.7, 9.8, 9.9, 12.2_
  - [ ] 10.3 Write a failing bone-forge test that the scaffold emits an empty `samples.ts`, the `initMode()` call and the `<head>` script, and that `seedFirstVisit` with an empty list does nothing. Then update the templates. _Requirements: 9.8, 12.4_

- [ ] 11. Boundaries
  - [ ] 11.1 Run `bun run hook:boundary` and the core boundaries test. Fix any app import, `Date` or DOM use in a pure layer, or domain word in core (the toggle, sample types and tests included). Check `bun run hook:spec` passes with no `bone.json` change. _Requirements: 12.1, 12.2, 12.3, 12.5_

- [ ] 12. End-to-end
  - [ ] 12.1 Add failing Playwright tests for the launcher, Pantry Reaper and Warranty Wraith at 1280 and 390: the toggle flips the mode and the choice survives a reload; the first visit shows samples and the toast; Clear empties the list; a reload adds no samples; the network guard stays clean. Then fix what fails. _Requirements: 2.1, 5.1, 5.2, 9.2, 9.4, 9.5, 9.10_
  - [ ] 12.2 Add failing tests that the burn-down plays on the first list render (animations present) and not after a filter, and that with `reducedMotion: 'reduce'` `document.getAnimations()` is empty on the list and detail screens and the cards are in their final state. Then fix what fails. _Requirements: 8.1, 8.2, 10.1, 10.2, 10.3_
  - [ ] 12.3 Extend the existing axe specs so they run in the crypt (the default) with sample items present, at 1280 and 390, on every screen they already visit (list, empty state, detail, add sheet, import dialog, trace drawer, the recall banner), then again in light through the toggle. Also assert no horizontal scroll and 44px targets in both modes. Then fix what fails. _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 13. Docs and wrap-up
  - [ ] 13.1 Update `README.md` (crypt default, the toggle, sample items, `cryptTheme`) and `docs/REMIX.md` (a third app gets a crypt for free, how to add `samples.ts`). Check each claim against the code. _Requirements: 12.4_
  - [ ] 13.2 Run the full gate: `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`. Fix every failure before closing the spec. _Requirements: 12.6_
