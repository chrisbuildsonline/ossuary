# Design: crypt-theme

## Overview

The crypt is a second set of token values plus a few generic components and helpers. Structure does not change. The visual source of truth is `design/DESIGN.md`. This file says where each piece lives in code and how it is tested.

```
packages/ossuary-core/src/ui/
  tokens.css        crypt on :root, light on :root[data-mode="light"], [data-themed] picks --light-* / --crypt-*
  mode.ts           initMode, setMode, getMode (localStorage "ossuary:mode")
  crypt.ts          cryptTheme(theme): pure colour derivation
  color.ts          hex/HSL helpers and contrast ratio (shared with contrast tests)
  theme.ts          applyTheme writes both sets and data-themed
  first-visit.ts    seedFirstVisit(store, samples, options)
  elements/
    oss-mode-toggle.ts   the toggle button
    oss-shell.ts         hosts the toggle (top bar / phone app bar)
    oss-decay.ts         candle .burnt and .halo, ghost glow
    oss-item.ts          --life, decaying slab, glows, dead ghost card
    oss-list.ts          owns the one-shot burn-down flag
apps/<app>/src/data/samples.ts    sample items as data (offsets in days)
apps/<app>/src/main.ts            initMode(), seedFirstVisit(...)
apps/launcher/                    initMode(), oss-mode-toggle beside GitHub
tools/bone-forge/                 template: initMode(), <head> script, empty samples.ts
```

## Components and interfaces

### Tokens and mode

- `tokens.css` holds the crypt values on `:root` and the light values on `:root[data-mode="light"]`, copied from DESIGN.md section 2. Non-colour tokens (radius, spacing, type, motion, focus) are shared and sit on `:root` once. New tokens: `--highlight`, `--halo`, `--spirit-glow`, `--glow-soon`, `--glow-urgent`, `--motif-*`. `--shadow-1` includes `--highlight`.
- Themed elements: `[data-themed] { --canvas: var(--crypt-canvas, var(--canvas-core)); ... }` and `:root[data-mode="light"] [data-themed] { --canvas: var(--light-canvas, ...); ... }`. The mode attribute is on `<html>`, the themed element is below it, so the selector needs no JavaScript. The core fallbacks are kept as separate `--core-*` names so the fallback is not a self-reference.
- `mode.ts`:

```ts
export type Mode = 'crypt' | 'light';
export const MODE_KEY = 'ossuary:mode';
export function getMode(root?: HTMLElement): Mode;                 // reads data-mode, default crypt
export function initMode(storage?: Storage, root?: HTMLElement): Mode; // read key, set attribute, never throws
export function setMode(mode: Mode, storage?: Storage, root?: HTMLElement): void; // set attribute, write key, swallow errors
```

  `storage` and `root` default to `localStorage` and `document.documentElement`. They are arguments so tests pass fakes. Only `light` is stored as a special case in CSS. `crypt` is written as `data-mode="crypt"` for symmetry.
- Each `index.html` has a tiny inline `<head>` script (`try{if(localStorage.getItem('ossuary:mode')==='light')document.documentElement.dataset.mode='light'}catch(e){}`) so a stored light choice does not flash. A test compares the script's key with `MODE_KEY`. CSP is not set on these static pages, so inline script is allowed. The precache list and the offline behaviour do not change.

### Theme derivation

`color.ts` exports `hexToHsl`, `hslToHex`, `mix(a, b, t)` and `contrast(a, b)` (WCAG 2.x). The contrast tests import it, so the checker and the derivation use one implementation.

```ts
export interface CryptColors { canvas: string; surface: string; surfaceSunken: string; accent: string; accentInk: string; accentTint: string }
export function cryptTheme(theme: Theme | undefined): CryptColors;
```

Algorithm:

1. `base` = the spec's `canvas`, else the core light canvas `#eef0f4`. Take its hue `h` and saturation `s = min(s, 0.34)`.
2. canvas, surface, sunken = `hsl(h, s, 0.065 | 0.115 | 0.085)`. Core defaults are returned unchanged when there is no `theme.canvas`, so the core crypt stays `#0d0f14`/`#181b23`/`#11141a`.
3. `accent` = the spec accent (core default `#3657c9`). Raise HSL lightness in 1% steps until `contrast(accent, surface)`, `contrast(accent, canvas)` and `contrast(accent, tint)` are all at least 4.6, or lightness reaches 95%. The tint depends on the accent, so it is recomputed per step: `tint = mix(accent_spec, surface, 0.24)` uses the spec accent, not the stepped one, so it does not move while the loop runs.
4. `accentInk` = the crypt accent. `accentTint` = the tint from step 3.

Expected values (`#f07639`, `#9086e0`, `#7a90db`) are asserted in a unit test as the contract. If the 1% step produces a neighbouring hex, the test and DESIGN.md are updated together, because DESIGN.md says these are what the function returns.

`applyTheme(el, theme)`:

```ts
const crypt = cryptTheme(theme);
el.style.setProperty('--light-accent', t.accent) ... // only when the spec sets it
el.style.setProperty('--crypt-accent', crypt.accent) ...
el.dataset.themed = '';        // attribute present
```

`--light-surface` and `--light-surface-sunken` are not authored by specs, so they are written only for symmetry when needed. The light set keeps writing only what the spec gives, so light behaviour is as before. With `theme` undefined every `--light-*` and `--crypt-*` is removed and `data-themed` is deleted.

### Toggle

`<oss-mode-toggle>` is a core element. It renders one `<button type="button" aria-pressed aria-label="Light theme">` with an inline sun or moon glyph (Lucide, inlined, `aria-hidden`). It reads `getMode()` on connect, flips with `setMode`, and listens to the `storage` event for `ossuary:mode` to follow other tabs. `oss-shell` places it in its `actions` area (left of the primary pill on desktop, right in the phone app bar) by slot, so the shell has no knowledge of it beyond the slot. The launcher page adds it to its top links. The button is a 44px icon button from `oss-button`'s icon variant.

### Decay motifs

`oss-decay` already receives `motif`, `fraction`, `stage`, `size`. Additions, all procedural:

- Candle: a `.burnt` dashed rect (stroke `--line-strong`, `stroke-dasharray: 3 3`, no fill) with height `64 * (1 - fraction)` sitting on top of the wax, and a `.halo` circle (fill flame colour, `filter: blur(6px)`, `opacity: var(--halo)`, `r` scaled by flame size). The halo is omitted for `dead`. Burnt is omitted at fraction 1.
- Ghost: fill and stroke use `--motif-spirit`, `--motif-spirit-line`; `filter: drop-shadow(0 0 6px var(--spirit-glow))` on a wrapper with `opacity` set from the fill opacity so the glow follows it. Eyes use `--motif-ink`.
- Wax and flame colours stay fixed (`#f6efe3`, `#f59e0b`, `#fde68a`).
- Burn-down uses CSS custom property `--from` (full height or opacity) and a class `.enter` on the motif. The motif's final geometry is set as attributes, so the static state is the real state and the animation is a visual from-to only. This is what makes reduced motion trivial: with no animation the final geometry is already there.

### Decaying cards

`oss-item` sets `style="--life: .45"` and `data-tone="soon"` on its host. CSS:

```css
oss-item[data-variant="card"] .slab {
  background: color-mix(in srgb, var(--surface) calc(40% + 60% * var(--life)), var(--canvas));
}
oss-item[data-tone="soon"]   .slab { box-shadow: var(--shadow-1), 0 0 24px var(--glow-soon); }
oss-item[data-tone="urgent"] .slab { box-shadow: var(--shadow-1), 0 0 28px var(--glow-urgent); animation: ember 2.8s var(--ease-in-out) infinite alternate; }
oss-item[data-tone="dead"]   .slab { background: none; box-shadow: none; outline: 1.5px dashed var(--line-strong); }
```

`--life` is unitless, so `calc(40% + 60% * var(--life))` is valid inside `color-mix`. The slab is a background layer, so text stays on `--surface` text tokens, and contrast is tested against the mixed result at life 0 (the worst case). Rows use a `::before` 3px bar. The ember animation animates `opacity` of a pseudo-element glow layer (`.6 → 1`), not the card, so text never fades. The `dead` card uses `filter: grayscale(1)` and `opacity: .55` on the motif only.

### First-load burn-down

`oss-list` holds a module-level `let burnPlayed = false`. On render with items and `!burnPlayed`, it adds `data-enter` to the list for the render, sets `--i` (the item index, capped so `i * 50ms + 1.2s <= 2.5s`) on each item, then sets `burnPlayed = true`. CSS keyframes (`burn`, `fade-in`, `slab-to-ghost`) run under `[data-enter]` only. The attribute is removed on `animationend` of the last item, and after 2.6s as a fallback. An empty render leaves the flag false. Under `prefers-reduced-motion: reduce` the flag is set but `data-enter` is never added. Keeping the flag in the module means it resets on a page load and not on re-render, as 8.2 and 8.6 require.

### First visit

```ts
export interface Sample { id: string; fields: Record<string, string | number | { daysAgo: number } | { daysFromNow: number }>; }  // dates as day offsets
export interface SeedOptions {
  now: Date | number;                   // passed in, as in the engine
  spec: BoneSpec;
  toast: (msg: string, action?: { label: string; run: () => void | Promise<void> }) => void;
}
export async function seedFirstVisit(store: Store, samples: readonly Sample[], opts: SeedOptions): Promise<'seeded' | 'skipped'>;
```

- A `Sample` is `{ id, fields }` where a date field is `{ daysAgo: number }` or `{ daysFromNow: number }`. `seedFirstVisit` resolves them against `now` to `YYYY-MM-DD` in local time, builds an item, validates it with the existing item parser for `spec`, and writes all of them in one transaction. If any is invalid nothing is written. Ids are prefixed `sample-` and are stable, so Clear can find them.
- Meta: the store gets a `meta` object store key `firstVisitDone` (a version bump of the IndexedDB schema with a no-data migration; existing databases keep their items). `seedFirstVisit` reads it. If it is set, or the item count is above 0, it sets the key and returns `skipped`. Otherwise it writes samples, sets the key in the same transaction, and shows the toast `Sample items added` with `Clear`. Clear deletes only the stored ids that start with `sample-` and still exist, then refreshes the list.
- Each app's `samples.ts` exports `samples: Sample[]` with five to seven items covering fresh, steady (where the app has one), soon, urgent and dead. Pantry Reaper uses foods (a jar of yogurt, spinach, chicken, a frozen item, an old leftover). Warranty Wraith uses purchases with a return window and a warranty and one that matches the recall snapshot, so the banner shows. Both read as the app's own voice. Because dates are offsets, the stages hold on any day.
- bone-forge emits `export const samples: Sample[] = [];`. An empty list makes `seedFirstVisit` return `skipped` without setting the key, so a remixer who adds samples later still gets them on a fresh device.

### Reduced motion

The existing rule in `tokens.css` (`@media (prefers-reduced-motion: reduce)`) sets `--dur-*` to 0 and `animation: none !important; transition: none !important` on core elements. New keyframes (`burn`, `fade-in`, `slab-to-ghost`, `ember`) are added to the list that `motion-source.test.ts` checks, and are only reachable under `[data-enter]` or the urgent tone. In reduced motion the `ember` rule is `animation: none` and the glow is at `opacity: 1`. Final states are the base styles, since the animation is from-to only.

## Data models

- `localStorage["ossuary:mode"]`: `"crypt" | "light"`.
- IndexedDB `meta` store: `{ key: 'firstVisitDone', value: true }`.
- `Sample`: `{ id: string; fields: Record<string, string | number | { daysAgo: number } | { daysFromNow: number }> }`.
- Theme: no schema change. `CryptColors` is derived and never stored.

## Error handling

- `localStorage` missing or throwing (private mode, blocked storage): `initMode` returns `crypt`, `setMode` still sets the attribute.
- Invalid sample: `seedFirstVisit` throws a `ValidationError` naming the sample id and field before anything is written. The app's `main` catches it, logs it to the console and continues with an empty store, because a bad sample must not stop the app.
- IndexedDB unavailable: the store already reports it. `seedFirstVisit` is not called.
- `cryptTheme` never throws. A theme that cannot reach contrast returns the best it found and the unit test names the failing pair.

## Testing strategy

All tests are written before the code. Core unit tests use vitest with happy-dom. Dates are fixed.

- `color.test.ts`: round trip hex/HSL, `contrast` against known WCAG values.
- `crypt.test.ts`: the three expected value sets; saturation cap at 34%; accent already passing is kept; determinism (fast-check: same input gives the same output, output contrast at least 4.6 for any accent that is below 4.5:1 on white); no `Date`, DOM or random use (covered by `hook:boundary`).
- `crypt-contrast.test.ts`: every `apps/*/bone.json` (glob), the bone-forge template theme and each gallery theme, in both modes, against all pairs in requirement 4.6, with the app and pair in the failure message. Extends `contrast-tokens.test.ts`, which reads `tokens.css` for the fixed tokens.
- `tokens.test.ts`: `:root` holds the crypt values, `:root[data-mode="light"]` the light ones, every token exists in both, no `#000`, `--halo` is 0 in light.
- `mode.test.ts`: default crypt; stored `light`; garbage value; throwing storage; `setMode` writes; `initMode` does not write.
- `theme.test.ts` (extended): both sets written, `data-themed` set, removal on undefined, light values unchanged from before.
- `oss-mode-toggle.test.ts`: name, `aria-pressed`, glyph swap, `setMode` call, `storage` event, keyboard, 44px class, no store access.
- `oss-decay.test.ts` (extended): `.burnt` height for several fractions and absence at 1; `.halo` present except `dead`; ghost opacities by formula; `aria-hidden`; no `<linearGradient>` in the output.
- `item-list.test.ts` (extended): `--life` and tone on cards and rows, dead card has the ghost class, number text unchanged.
- `burn-down.test.ts`: first non-empty render sets `data-enter`; second render does not; empty render does not use it up; reduced motion never sets it and still marks it done; a new module instance plays again.
- `first-visit.test.ts` (fake-indexeddb): seeds on empty store with toast; skips on non-empty; skips on second call; Clear removes only `sample-*` ids and leaves a user item; invalid sample writes nothing; same `now` gives the same items; empty list does nothing and does not set the key; every app's samples cover living, dying and dead stages in the engine at a fixed `now`.
- `motion-source.test.ts` (extended): the new keyframes are inside the reduced-motion rule.
- Boundary: `hook:boundary` and the core boundaries test must pass with the new files. No domain word is allowed in the toggle, the sample types or the tests of core. Sample words appear only under `apps/`.
- Playwright (per app and launcher, 1280 and 390): the toggle flips the mode and the choice survives a reload; the first visit shows the samples and the toast, Clear empties the list, and a reload adds nothing; the burn-down plays once (animations present on the first render, none after filtering); with `reducedMotion: 'reduce'` `document.getAnimations()` is empty and every card is in its final state; axe is clean in the crypt and in light, with samples present.
- Network guard: the existing e2e guard stays on, so any request leaving the machine fails the run.

## Decisions and alternatives

- **Crypt as the `:root` default, light behind an attribute**, rather than a `prefers-color-scheme` media query. The brand look is the crypt, so every visitor gets it, and the toggle is the only way to change it. A media query would give light to some judges first.
- **Both sets written by `applyTheme`, chosen in CSS**, rather than re-applying the theme on toggle. A switch is then one attribute, with no re-render and no flash.
- **Derive the crypt from the light theme** rather than add crypt fields to the spec. Specs stay unchanged, a third app gets a crypt for free, and the schema needs no migration. The cost is that the author cannot hand-tune the crypt. If that is ever needed it is a spec field, added later.
- **Burn-down flag in memory**, rather than in `localStorage`. Playing once per page load is enough to teach the art, and a stored flag would hide the best moment from a returning judge.
- **Sample dates as day offsets**, rather than fixed dates, so the stages are the same whenever the app is opened.
- **Sample flag in the store's own meta**, rather than in `localStorage`. Clearing site data then resets both together, so the first visit really is first.
- **Sample data in the apps**, with only the mechanism in core, so the core boundary holds.
- **Animation is from-to over final geometry**, so reduced motion means "do not run it" and needs no second drawing path.
