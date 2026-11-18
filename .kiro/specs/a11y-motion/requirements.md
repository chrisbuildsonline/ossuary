# Requirements: a11y-motion (accessibility and motion polish)

## Introduction

This spec makes the finished UI accessible and calm under reduced motion, and fixes four known visual and behaviour bugs. It covers `packages/ossuary-core/src/ui`, Pantry Reaper, Warranty Wraith, the launcher, the gallery (`packages/ossuary-core/gallery`) and the bone-forge template (`tools/bone-forge/template`). It follows `design/DESIGN.md` section 5 (decay visual and motion) and section 9 (accessibility). It adds checks and fixes. It adds no feature, no dependency (`@axe-core/playwright` is already installed) and no domain word to core.

Terms:

- **Tone pair**: a `--tone-<tone>-bg` and `--tone-<tone>-fg` token for one of the five tones `fresh`, `steady`, `soon`, `urgent`, `dead`.
- **Accent text**: `--accent-ink` on `--accent-tint`, `--accent` on `--surface` and on `--canvas`, for core and for each app theme (read from `bone.json`).
- **Screen**: one of the eight views listed in 5.1.
- **Reduced motion**: a page with `prefers-reduced-motion: reduce`, set in Playwright by `page.emulateMedia({ reducedMotion: 'reduce' })`.
- **Focus ring**: a computed `outline-style` other than `none` with `outline-width` of at least 2px on the element that has `:focus-visible`.

## Requirement 1: Reduced motion

**User story:** As a visitor who prefers less motion, I want nothing to move on its own or slide in, so that the app is comfortable to use.

### Acceptance criteria

1.1 WHILE `prefers-reduced-motion: reduce` is set, THE SYSTEM SHALL run no CSS animation and no CSS transition on any element in any shadow root or in the page of Pantry Reaper, Warranty Wraith, the launcher, the gallery and the bone-forge template. This covers motif idle and one-shot motion, number landing, pill and card transitions, sheet, dialog and drawer entry, trace line entry, the loading placeholder, the toast, the launcher card rotation and lift, and the food search list.

1.2 WHILE reduced motion is set, THE SYSTEM SHALL set every `--dur-*` token to `0ms` and SHALL render each `oss-decay` in its final state.

1.3 WHILE reduced motion is set, THE SYSTEM SHALL still communicate every change that motion would have shown (a date jump, a stage change) through text, the toast or the pill.

1.4 THE SYSTEM SHALL cover animations added later without a per-component rule: every element's shadow root receives the reduced-motion rule from the shared base sheet, and a source-scan test fails when a stylesheet declares `animation` or `transition` in a place that rule does not reach.

1.5 THE SYSTEM SHALL start no script-driven animation (`requestAnimationFrame` loops, `Element.animate`, smooth scrolling) unless it first checks `matchMedia('(prefers-reduced-motion: reduce)')`.

1.6 WHEN `prefers-reduced-motion` is `no-preference` THE SYSTEM SHALL keep today's motion unchanged (DESIGN.md section 5).

## Requirement 2: Colour contrast

**User story:** As a visitor with low vision, I want every status and accent text to be readable, so that I never guess a status.

### Acceptance criteria

2.1 THE SYSTEM SHALL keep every tone pair at 4.5:1 or more for text, and its glyph (the same `fg` on `bg`) at 3:1 or more.

2.2 THE SYSTEM SHALL keep accent text at 4.5:1 or more, and the focus ring (`--accent` against `--surface` and against `--canvas`) and every input outline (`--line-strong` against `--surface` and `--surface-sunken`) at 3:1 or more, in core and in each app theme.

2.3 THE SYSTEM SHALL keep muted text (`--text-2`, `--text-3`) at 4.5:1 or more on `--surface`, `--surface-sunken` and on the canvas of core and of each app theme, and the toast and primary pill label (`--on-ink` on `--ink`, and on `--ink-hover`) at 4.5:1 or more.

2.4 THE SYSTEM SHALL read all values for 2.1 to 2.3 from the token sources (`tokens.css` and each app `bone.json` theme), not from copies in the test.

2.5 IF a token fails 2.1 to 2.3 THEN THE SYSTEM SHALL change that token to the nearest value that passes while keeping its hue, so the look stays inside DESIGN.md sections 2 to 4. The same change SHALL update the ratios quoted in DESIGN.md only if the test shows they were wrong.

2.6 THE SYSTEM SHALL NOT use a colour as the only signal of a status. Every pill keeps its word and its glyph.

## Requirement 3: Focus

**User story:** As a keyboard user, I want to see where focus is on every screen.

### Acceptance criteria

3.1 THE SYSTEM SHALL show a focus ring (definition above) on every interactive element on every screen: links, buttons, inputs, selects, segmented options, chips, steppers, dialog close buttons, toast buttons, cards and rows.

3.2 THE SYSTEM SHALL NOT remove an outline without drawing a replacement ring on the same element or its wrapper (an `outline: none` is allowed only on a programmatic-focus target with `tabindex="-1"` such as `h1`, or where a `:has(:focus-visible)` or `:focus-within` rule rings the wrapper).

3.3 WHEN a test tabs through a screen, THE SYSTEM SHALL reach every interactive element by Tab and Shift+Tab and show a focus ring on each.

3.4 WHEN a sheet or dialog opens THE SYSTEM SHALL keep Tab inside it, close it on Escape and return focus to the control that opened it (existing behaviour, kept under test on the new screens).

## Requirement 4: Countdown names and announcements

**User story:** As a screen reader user, I want each countdown read as one plain sentence, and not interrupted by ticking.

### Acceptance criteria

4.1 THE SYSTEM SHALL give each countdown one accessible name in plain language, for example "Milk. Use soon. Expires in 3 days, Friday 20 November." for a list item, and "Return window: expires in 3 days, Friday 20 November." for a lifespan card. The visual digits and unit SHALL be `aria-hidden`.

4.2 THE SYSTEM SHALL give the Pantry Reaper detail countdown the same sentence form (name, stage, "expires in N days") and not only "Use soon. 3 days".

4.3 THE SYSTEM SHALL contain no `aria-live`, `role="status"` or `role="alert"` region that holds a countdown value, a unit or a date. Countdowns refresh at most once a minute and silently.

4.4 THE SYSTEM SHALL keep `role="status"` with `aria-live="polite"` only on the toast, the loading placeholder, the recall banner, and the result count of a search combobox (it changes only as the user types), and each SHALL change only on a user action or a data load, never on a timer.

4.5 WHEN a countdown crosses a stage by the passing of time THE SYSTEM SHALL change its name and pill without announcing it.

## Requirement 5: Automated axe checks

**User story:** As the maintainer, I want an automated check that a screen has no WCAG A or AA failure.

### Acceptance criteria

5.1 THE SYSTEM SHALL run `@axe-core/playwright` in Playwright with the tags `wcag2a` and `wcag2aa` (and `wcag21a`, `wcag21aa`) on each of these eight screens, at 1280 and at 390 px wide:

1. launcher;
2. Pantry Reaper list;
3. Pantry Reaper detail;
4. Pantry Reaper add dialog (open);
5. Warranty Wraith list;
6. Warranty Wraith detail;
7. Warranty Wraith add dialog (open);
8. gallery (the core theme, and again with the warm and cool themes it offers).

5.2 THE SYSTEM SHALL report zero violations on each. A failure SHALL print the rule id, the selector and the contrast detail, so a fix is clear.

5.3 THE SYSTEM SHALL NOT disable a rule, exclude an element or lower the tag set to pass. The only allowed exclusion is a third-party element the page does not own, and none exists today.

5.4 WHILE a screen is checked THE SYSTEM SHALL have it in a settled state (data loaded, fonts ready, no running animation), so axe does not read a half-faded colour.

## Requirement 6: Known issues

**User story:** As a user, I want the apps to look and behave the same wherever they should.

### Acceptance criteria

6.1 **Template parity.** THE SYSTEM SHALL make the bone-forge template detail view offer the same actions in the same order, with the same labels, variants, icons and `data-action` values, as the apps' detail views (the apps today: "Add to calendar", then "Edit", in a `flex-wrap` row). An action the apps do not have, such as the template's "Remove", SHALL be removed from that row, or moved to where the apps put the same action, so the three detail views match. The template SHALL keep one primary pill per screen.

6.2 **Pantry Reaper canvas.** THE SYSTEM SHALL paint the Pantry Reaper `html` and `body` with the Pantry Reaper theme canvas (`#f2efea`), by applying the theme to `document.documentElement` as Warranty Wraith and the template do. The core canvas (`#eef0f4`) SHALL NOT show at overscroll, below a short screen or behind the shell.

6.3 **Wraith trace.** THE SYSTEM SHALL keep every trace line in Warranty Wraith detail on one line, or wrap it with no clipping and no horizontal scroll, at every viewport width from 900 to 1200 px, with the trace card inside its grid columns (9 to 12) and no text overlapping the delta column. The fix SHALL be in core `oss-trace` or in the Wraith layout, not by shrinking text below 13px.

6.4 **Gallery loading.** THE SYSTEM SHALL NOT show the empty state before the gallery has data. The gallery list SHALL start in `state="loading"`, change to the ready list when the store has answered, and show the empty state only when the store holds no item or the page asks for `?state=empty`.

6.5 THE SYSTEM SHALL keep every existing test, including the existing gallery Tab test, passing after these fixes.

## Requirement 7: Boundaries and engine

**User story:** As the maintainer, I want these changes to obey the repo rules.

### Acceptance criteria

7.1 THE SYSTEM SHALL keep the lifespan engine free of `Date`: no `Date.now()` and no `new Date()` in `packages/ossuary-core/src/engine`. No change in this spec touches the engine.

7.2 THE SYSTEM SHALL add no domain word (food, warranty, recall, pantry and similar) to `packages/ossuary-core`. Shared test helpers live in core and are generic.

7.3 THE SYSTEM SHALL NOT make an app import another app, add a UI framework, or add a runtime dependency. `@axe-core/playwright` stays a dev dependency.

7.4 THE SYSTEM SHALL keep `bun run hook:boundary` and `bun run hook:spec` passing.

## Requirement 8: Tests and gate

**User story:** As the maintainer, I want every requirement above to fail a test if it breaks.

### Acceptance criteria

8.1 THE SYSTEM SHALL include a vitest that computes contrast for every tone pair and accent text from the tokens and the three themes (2.1 to 2.4).

8.2 THE SYSTEM SHALL include vitest and happy-dom tests for accessible names, absence of live regions around countdowns, template parity and the gallery loading state (4.1 to 4.4, 6.1, 6.4).

8.3 THE SYSTEM SHALL include Playwright tests, with `emulateMedia({ reducedMotion: 'reduce' })`, that find no running animation and no non-zero transition duration on any screen (1.1, 1.2), and tests with `no-preference` that still see the motion (1.6).

8.4 THE SYSTEM SHALL include Playwright Tab-through tests on every screen in 5.1 (3.1, 3.3), the axe runs (5.1, 5.2) and layout checks for 6.2 and 6.3.

8.5 THE SYSTEM SHALL pass `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec` before the spec is closed.
