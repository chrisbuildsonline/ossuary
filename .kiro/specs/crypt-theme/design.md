# Design: crypt-theme

## Overview

The crypt is a second set of token values plus a few generic components and helpers. Structure does not change. The visual source of truth is `design/DESIGN.md`. This file says where each piece lives in code and how it is tested. It describes what was built. Places where the build differs from `requirements.md` are called out in "Decisions and alternatives" and in the "Not done" notes in `tasks.md`.

```
packages/ossuary-core/src/ui/
  tokens.css        crypt on :root, light on :root[data-mode="light"], [data-themed] picks --light-* / --crypt-*
  mode.ts           initMode, setMode, currentMode (localStorage "ossuary:mode")
  crypt.ts          cryptTheme(theme): pure colour derivation
  color.ts          hexToHsl, hslToHex, mixHex (contrast ratio stays in schema/contrast.ts)
  theme.ts          applyTheme writes both sets and data-themed
  first-visit.ts    seedFirstVisit({ specId, store, samples, storage })
  styles.ts         ensureDocumentTokens applies the stored mode when <html> has none
  elements/
    oss-mode-toggle.ts   the toggle button
    oss-shell.ts         hosts the toggle in its actions area, before the primary slot
    oss-decay.ts         halo, burnt outline and ghost glow paint; first-load keyframes
    oss-item.ts          --life, decaying slab, glows, dead ghost card, first-load arrival
    oss-list.ts          owns the one-shot first-load flag
  motifs/candle.ts       .burnt rect, .halo circle, flame-rise group
apps/<app>/src/data/samples.ts    samples(today) returns sample items, dated by day offsets
apps/<app>/src/main.ts            passes samples to mountApp
apps/<app>/src/app.ts             calls seedFirstVisit in start(), shows the "Sample items added" toast
apps/launcher/                    ensureDocumentTokens(), oss-mode-toggle in header .top-end beside GitHub
```

bone-forge templates and `docs/REMIX.md` were not changed. A scaffolded app has no toggle call, no `samples.ts` and no first-visit seeding yet.

## Components and interfaces

### Tokens and mode

- `tokens.css` holds the crypt values on `:root` and the light values on `:root[data-mode="light"]`. Non-colour tokens (radius, spacing, type, motion, focus) are shared and sit on `:root` once. Crypt-specific tokens: `--highlight`, `--halo`, `--spirit-glow`, `--glow-soon`, `--glow-urgent`, `--glow-ink`, `--atmosphere` (scales the canvas and card light, 0 in light), `--motif-*` (wax, flame, flame-core, ink, dish, spirit, spirit-line, moon). `--shadow-1..3` include `--highlight`.
- Themed elements: `[data-themed]` reads `--crypt-canvas`, `--crypt-surface`, `--crypt-surface-sunken` and the three `--crypt-accent*` values. `--track` and `--line` are mixed from the crypt surface and bone white with `color-mix`. `[data-mode="light"] [data-themed], [data-mode="light"][data-themed]` reads `--light-canvas`, `--light-accent`, `--light-accent-ink` and `--light-accent-tint`, with the core light colours as literal fallbacks, and sets light surface, sunken, track and line directly. The mode attribute is on `<html>` and the selector needs no JavaScript.
- `mode.ts`:

```ts
export type Mode = 'crypt' | 'light';
export const MODE_KEY = 'ossuary:mode';
export const currentMode = (doc?: Document): Mode;                     // reads data-mode, crypt unless "light"
export function initMode(doc?: Document, storage?: Storage): Mode;     // read key, set attribute, never writes, never throws
export function setMode(mode: Mode, doc?: Document, storage?: Storage): void; // set attribute, write key, swallow errors, dispatch `oss-mode` on doc
```

  `doc` and `storage` default to `document` and `localStorage`. They are arguments so tests pass fakes. `initMode` always sets the attribute, so `crypt` is written as `data-mode="crypt"`. Only `light` is special in CSS. `setMode` dispatches a `CustomEvent('oss-mode', { detail: { mode } })` on the document so every toggle on the page updates.
- `ensureDocumentTokens` (called by `oss-shell` and by the launcher's `main.ts`) calls `initMode` when `<html>` has no `data-mode`. This is how a stored light choice is applied.
- There is no inline `<head>` script in any `index.html`. The crypt is the `:root` default in `tokens.css`, so the first paint is dark with no flash. A visitor who chose light sees the crypt until the shell or launcher calls `ensureDocumentTokens`, which happens before the first item render. The precache list and offline behaviour are unchanged.

### Theme derivation

`color.ts` exports `hexToHsl`, `hslToHex` and `mixHex(a, b, amount)` (`a` at `amount` over `b`, per channel in sRGB). `contrastRatio` (WCAG 2.x) is the existing function in `schema/contrast.ts`. The derivation and the contrast tests both use it.

```ts
export interface CryptColours { canvas: string; surface: string; surfaceSunken: string; accent: string; accentInk: string; accentTint: string }
export function cryptTheme(theme: Theme | Pick<Theme, 'accent' | 'canvas'> | undefined): CryptColours;
```

Algorithm:

1. `base` = the spec's `canvas`, else the core light canvas. Take its hue `h` and saturation `s = min(s, 0.34)`.
2. `canvas = hsl(h, s, 0.065)`, `surface = hsl(h, 0.9 * s, 0.115)`, `surfaceSunken = hsl(h, s, 0.085)`. With no `theme.canvas` the core light canvas gives `#0d0f14`, `#181b23`, `#11141a`.
3. `accentTint = mix(spec accent, surface, 0.24)`. The spec accent is the base (core default `#3657c9`), so the tint does not move while the loop runs.
4. `accent`: starting from the spec accent, raise HSL lightness in 0.5% steps until `contrastRatio` against surface, canvas and tint is at least 4.6, or lightness reaches 100%. The loop stops at the first passing step, so an accent that already passes is kept.
5. `accentInk` = the crypt accent.

Expected values are asserted in `crypt.test.ts` as the contract: core `#0d0f14` / `#7a90db` with tint `#1f294b`, Pantry Reaper canvas `#14120d` and accent `#f07639`, Warranty Wraith canvas `#0b0e16` and accent `#9086e0`.

`applyTheme(el, theme)` writes, from the spec: `--light-accent`, `--light-accent-ink` (falls back to the accent), `--light-accent-tint`, `--light-canvas`. From `cryptTheme`: `--crypt-accent`, `--crypt-accent-ink`, `--crypt-accent-tint`, `--crypt-canvas`, `--crypt-surface`, `--crypt-surface-sunken`. It also writes `--font-display`, sets `data-themed` and sets `data-motif` and `data-empty-art`. Light surfaces are not authored by specs, so no `--light-surface*` is written. With `theme` undefined every property is removed, `data-themed` is removed and the motif attributes return to their defaults. The exported `themeProperties` list is what the tests and the cleanup loop use.

### Toggle

`<oss-mode-toggle>` is a core element. It renders one `<button type="button" aria-pressed aria-label="Light theme">` with an inline sun (in the crypt) or moon (in light) glyph from `glyphs.ts`, `aria-hidden`. A press calls `setMode` with the other mode and keeps focus on the button. It re-renders on the document's `oss-mode` event, so several toggles stay in step. It does not listen to the `storage` event, so a change in another tab is picked up on that tab's next load, not live. The button is a 44px round icon button styled inside the element. `oss-shell` renders `<oss-mode-toggle>` in its `.actions` area between the `actions` slot and the `primary` span, so the shell does not slot it. The launcher puts it in `header .top-end` beside the GitHub link.

### Decay motifs

`oss-decay` receives `motif`, `fraction`, `tone`, `size` and, on first load, `enter`. All drawing is procedural SVG from `motifs/`.

- Candle: wax height is `8 + 64 * fraction` (a stub of 8 when dead). A `.burnt` dashed rect of height `72 - wax height` marks where the full candle stood, and is absent at full height. A `.halo` circle (`r = 13 * flame scale`) sits in the `flame-rise` group with the wick and flame. It is omitted when dead. Paint is in `oss-decay`'s CSS: `.halo` has `opacity: var(--halo)` and `filter: blur(4px)`, `.burnt` is a dashed `--line-strong` stroke with no fill.
- Ghost: `.body` uses `--motif-spirit` and `--motif-spirit-line` with `filter: drop-shadow(0 0 5px var(--spirit-glow))` on the path itself, so the glow follows the fill. Fill opacity is `0.15 + 0.85 * fraction`, stroke opacity `0.35 + 0.65 * fraction`, with a dotted hem below 0.25 and a dead state. Eyes use `--motif-ink`. There is no gradient in the art.
- Wax and flame colours come from `--motif-wax`, `--motif-flame` and `--motif-flame-core`.
- First load: with `enter` set, the candle `.wax` animates `burn` from full height, `.flame-rise` animates `rise` by `--burn-dy` (full wax minus final wax), `.drip`, `.pool` and `.burnt` fade in late, and the ghost `.body` animates `haunt` from full fill and stroke opacity. Keyframes give only the from-state, so every animation ends on the static geometry that is already in the attributes.

### Decaying cards

`oss-item` sets `--life` (the quantised fraction) as an inline style on its link and the classes `tone-<tone>`, plus `dead ghost` when the stage is dead. CSS in `oss-item.ts`:

- Card slab: `color-mix(in srgb, var(--surface) calc(40% + 60% * var(--life)), transparent)` over a faint radial light in the motif's colour (`--atmosphere` scales it). The slab mixes toward transparent, so the canvas shows through.
- `tone-soon`: `--shadow-1` plus a 1px `--glow-soon` ring and a soft glow.
- `tone-urgent`: `--shadow-1` plus a 1px `--glow-urgent` ring, and an `::after` glow layer that animates `opacity` from .55 to 1 over 2.8s (`ember`, alternate). The card and text never fade.
- `ghost` (dead): transparent background, no shadow, a 1.5px dashed `--line-strong` border, the `oss-decay` at 55% opacity and greyscale, and the value and title in `--text-2`.
- Rows: `tone-soon` and `tone-urgent` get a 3px inset left bar in the tone's foreground colour. An urgent row also gets a glow gradient and a faint inset ember.
- First load: the link gets `enter` when the list marked it, which runs `arrive` (fade and 8px rise, the whole card) and, for a dead card, `to-ghost` (slab to dashed outline).

### First-load burn-down

`oss-list` has an instance field `#entered`, false until the first render that has items. On that render it sets `data-enter` on the `.groups` element, marks every `oss-item` with an `entering` attribute, and sets `--i` (the index) and `--enter-delay` (`min(index, 20) * 50ms`, so the stagger stops growing at 1s). Later renders do not set these. An empty or error render returns before the flag is used, so the first render with items plays it. `oss-item` reads and removes `entering` when it renders, passes `enter` to `oss-decay` and adds the `enter` class to its link. Because the marker is consumed once, a re-render of one item is static. The flag lives on the element, so it resets on a page load and not on a re-render. There is no `animationend` cleanup or timer fallback: the attributes are inert once the animations end.

### First visit

```ts
export const firstVisitKey = (specId: string) => `ossuary:${specId}:visited`;
export interface FirstVisit {
  specId: string;
  store: Pick<Store, 'list' | 'create'>;
  samples: readonly unknown[];   // item values, already resolved to dates
  storage?: Pick<Storage, 'getItem' | 'setItem'>;   // default localStorage
}
export async function seedFirstVisit(opts: FirstVisit): Promise<string[]>;   // ids it added
```

- With no samples it returns `[]` and sets nothing, so a remixer who adds samples later still gets them on a fresh device.
- If `localStorage["ossuary:<spec id>:visited"]` is set it returns `[]`. Otherwise it sets the key, then lists the store. A non-empty store (or a list error) returns `[]` with the key now set, so a store that is emptied later is not re-seeded. On an empty store it calls `store.create` for each sample and returns the ids that were accepted. `store.create` validates against the spec, so a sample that does not fit is skipped and the rest are kept.
- If `storage` throws, it adds nothing, because the visit could not be remembered and samples would return on every load.
- The toast and Clear live in each app's `start()`: after `reload()`, if ids were added it shows "Sample items added" with a "Clear" action that removes exactly those ids and reloads. Ids come from the store, so a user item is never touched.
- Each app's `samples.ts` exports `samples(today: IsoDay): Item[]`. Items are written as `daysAgo` offsets and turned into dates with `toDayNumber` and `fromDayNumber`, so the stages hold on any day. Pantry Reaper has 8 FoodKeeper foods (chicken, spinach, avocados, cheese, eggs, smoked salmon, hummus, brie). Warranty Wraith has 6 purchases, one of which matches the recall snapshot (the sensory swing). `main.ts` passes `samples` to `mountApp`, which passes `samples(now().day)` to `seedFirstVisit`.

### Reduced motion

The existing rule in `tokens.css` (`@media (prefers-reduced-motion: reduce)`) sets `--dur-*` to 0 and `animation: none !important; transition: none !important` on `:host, *, *::before, *::after`. It reaches every core element, so the first-load keyframes, `ember`, the flame sway and the card hover transitions are all off. Final states are the base styles, since the animations are from-to only. The list still marks the first render as used, and the `entering` attributes are set but have no effect. `motion-source.test.ts` checks in general that every stylesheet that animates is covered by that rule. It does not name individual keyframes.

## Data models

- `localStorage["ossuary:mode"]`: `"crypt" | "light"`, written on a toggle press only.
- `localStorage["ossuary:<spec id>:visited"]`: `"1"`. No IndexedDB schema change.
- Samples: plain item values, produced by `samples(today)` in each app.
- Theme: no schema change. `CryptColours` is derived and never stored.

## Error handling

- `localStorage` missing or throwing (private mode, blocked storage): `initMode` returns `crypt`, `setMode` still sets the attribute. `seedFirstVisit` adds nothing.
- An invalid sample is skipped by `store.create`. The rest are added. Nothing throws.
- IndexedDB unavailable: the app shows its error state and does not reach `seedFirstVisit`.
- `cryptTheme` never throws. A theme that cannot reach contrast returns the lightest step it tried, and `contrast-tokens.test.ts` names the failing pair.

## Testing strategy

Core unit tests use vitest with happy-dom. Dates are fixed.

- `crypt.test.ts` holds the colour helper tests (hex/HSL round trip, `mixHex` endpoints) and the `cryptTheme` tests: the core, warm and cool expected values, the 34% saturation cap, the accent lift to 4.6:1 on surface, canvas and tint for seven accents, and determinism by example. There is no `color.test.ts` and no fast-check property for the derivation.
- `contrast-tokens.test.ts` reads `tokens.css` for the fixed tokens, and builds its theme list by glob: core, every `apps/*/bone.json`, every `tools/*/template/bone.json` and the gallery themes. In both modes it checks tone pairs (4.5:1 word, 3:1 glyph), on-ink pairs, `--line-strong` at 3:1 on surface and sunken, text, text-2, text-3 and error at 4.5:1 on surface, sunken and canvas, and accent, accent-ink and focus-ring pairs. The thresholds are WCAG AA. The stricter ratios in DESIGN.md (13:1, 8:1, 5.9:1) are not asserted.
- `tokens.test.ts`: `:root` holds the crypt values, `:root[data-mode="light"]` the light ones, the motif and light tokens exist, `--halo` is positive in the crypt and 0 in light, no `#000`, `[data-themed]` picks the crypt or light set, reduced motion zeroes durations.
- `mode.test.ts`: default crypt, stored light, garbage value, throwing storage, `setMode` writes, sets the attribute and fires `oss-mode`.
- `theme.test.ts`: both sets written, `data-themed` set, removal on undefined, no text, radius or spacing tokens.
- `oss-mode-toggle.test.ts`: name, `aria-pressed`, hidden glyph, click flips mode and storage, and the shell places it in `.top` outside `.primary`.
- `motifs/motifs.test.ts`: wax height, `.burnt` height and absence at full, `.halo` present except dead, ghost fill and stroke opacity by formula, dotted hem, no hex colour in any motif.
- `elements/item-list.test.ts`: `--life` and tone class on cards, the dead ghost card still reads its number and pill, and the list's first-load behaviour (`data-enter` and `--i` on the first render with items, none on the second, none while empty).
- `first-visit.test.ts` (fake storage and a real store harness): seeds once, skips a non-empty store and marks the visit, does not re-seed an emptied store, empty list sets nothing, a bad sample is skipped, unavailable storage adds nothing.
- `apps/*/src/data/samples.test.ts`: samples fit the spec, the stages include living, soon or urgent, and dead on three different days, dates are relative to today, and Wraith has exactly one recall match.
- `apps/launcher/src/page.test.ts`: the toggle sits in `header .top-end` beside the GitHub link.
- Boundary: `hook:boundary` and the core boundaries test apply to the new files. Sample words appear only under `apps/`.
- Playwright: `playwright.config.ts` gives every project a `storageState` that marks both apps as visited (`ossuary:<id>:visited = 1` for the dev, preview and gallery origins), so every project starts as a returning visit and no older spec meets sample items. The crypt specs (`apps/pantry-reaper/e2e/crypt.spec.ts`, `apps/warranty-wraith/e2e/crypt.spec.ts`, `apps/launcher/e2e/crypt.spec.ts`) override it with an empty storage state to get a real first visit. They check:
  - the crypt canvas colour and `data-mode="crypt"`;
  - several candle heights or ghost strengths and the ember glow (or the phone row's left bar);
  - the dashed ghost card, axe clean, and no sample added on reload;
  - Clear;
  - the toggle, its survival across a reload, and axe in light;
  - the first-load animation on the first render and none after a detail round trip;
  - with `reducedMotion: 'reduce'`, no running animation and the final wax height or ghost opacity.
  The launcher spec checks the crypt, the halo and the toggle. The apps run it at 1280 and 390. The launcher runs under its two phone and desktop projects. The existing network guard stays on in the app specs.

## Decisions and alternatives

- **Crypt as the `:root` default, light behind an attribute**, rather than a `prefers-color-scheme` media query. The brand look is the crypt, so every visitor gets it, and the toggle is the only way to change it.
- **No inline `<head>` script.** Because the crypt is the `:root` default there is no dark flash for the default case, and an inline script would be one more thing to keep in step with `MODE_KEY` and the precache. The cost is that a stored light choice is applied when `ensureDocumentTokens` runs, a moment after first paint, so a light visitor can see a brief crypt flash on load. Revisit if that is noticed.
- **Both sets written by `applyTheme`, chosen in CSS**, rather than re-applying the theme on toggle. A switch is then one attribute, with no re-render.
- **Derive the crypt from the light theme** rather than add crypt fields to the spec. Specs stay unchanged, a third app gets a crypt for free, and the schema needs no migration. The cost is that the author cannot hand-tune the crypt.
- **Burn-down flag on the `oss-list` instance**, in memory, rather than in `localStorage` or a module variable. Playing once per page load is enough to teach the art, and a stored flag would hide the best moment from a returning judge. A list element that is removed and created again would play again, and the apps keep one list.
- **The whole card arrives on first load**, not only the art. `oss-item` fades and lifts the card (`arrive`), so the number, pill and name animate with it, and the final state is the same as the static one. The design had said only the art animates.
- **First-visit flag in `localStorage` (`ossuary:<spec id>:visited`)**, not an IndexedDB `meta` store. It needs no IndexedDB schema bump or migration and is readable before the store opens. The cost is that clearing IndexedDB alone does not reset the first visit, and clearing site data does both.
- **Samples as a function of today** (`samples(today)` with day offsets), rather than fixed dates, so the stages are the same whenever the app is opened.
- **`seedFirstVisit` returns the added ids and the app owns the toast.** Core needs no toast dependency, and Clear removes exactly the ids that were added.
- **Colour helpers are tested inside `crypt.test.ts`**, and the AA check for every theme in both modes lives in `contrast-tokens.test.ts`, which already read the token sources. This avoided a second file that read the same sources.
- **e2e projects start as a returning visit** through a `storageState` in `playwright.config.ts`, and only the crypt specs opt into a real first visit. The older specs then see an empty store as before.
- **Sample data in the apps**, with only the mechanism in core, so the core boundary holds.
- **Animation is from-to over final geometry**, so reduced motion means "do not run it" and needs no second drawing path. The global reduced-motion rule does this, so the list needs no reduced-motion branch.
