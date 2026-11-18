# Design: launcher (`apps/launcher`)

## Overview

The launcher is a static page in `ossuary-core` web components and plain CSS. A root build script builds the three Vite projects with a relative base into one `dist`. Only the two apps have a service worker.

```
apps/launcher/   index.html, src/main.ts, src/page.ts, src/cards.ts, src/launcher.css
scripts/build-dist.ts      builds launcher + apps into dist/
scripts/preview-dist.ts    serves dist on 4180
```

The launcher reads `apps/*/bone.json` at build time (a Vite JSON import) for names, descriptions and themes. It does not import any app code.

## Components and interfaces

```ts
// page.ts: pure, no clock, no network
export type CardData = { id: string; name: string; blurb: string; href: string; theme: Theme; motif: 'candle' | 'ghost' };
export const REMIX_URL = 'https://github.com/chrisbuildsonline/ossuary/blob/main/docs/REMIX.md';
export function renderLauncher(root: ParentNode, cards: CardData[]): void;
```

- `cards.ts` builds the two `CardData` from the two `bone.json` files. `href` is `./<folder>/`. The motif name is the one constant per card, since the motif is the app's decay motif.
- `renderLauncher` writes the `h1`, the supporting line, one `a.card` per card (theme tokens set as custom properties on the card, the core motif at `xl` inside, `aria-hidden`) and the pill `a`. It uses `textContent` only, never `innerHTML` with spec text.
- `main.ts` applies the core theme and calls `renderLauncher(document.body, cards)`. It registers nothing.

## Build

`scripts/build-dist.ts` runs, in order, `vite build --base ./` for the launcher with `outDir` `dist` and `emptyOutDir` true, then for each app with `outDir` `dist/<folder>` and `emptyOutDir` true. The launcher goes first, so the apps are not erased.

- The apps' `vite.config.ts` already use `ossuaryPwa({ prefix })`. With base `./` the plugin must emit the manifest `scope` and `start_url` as `./`, relative icon paths and a precache list of paths relative to the worker. If it hard-codes `/`, change the plugin generically in core and keep its own tests green.
- Apps register with `navigator.serviceWorker.register('./sw.js')`. The default scope is the folder of `sw.js`, so it is the sub-path. The launcher has no registration code and the build writes no `dist/sw.js`.
- Root scripts: `"build": "bun scripts/build-dist.ts"`, `"preview": "bun scripts/preview-dist.ts"`. Existing `build:<name>` scripts stay.
- `preview-dist.ts` uses `Bun.serve` on port 4180 over `dist`, with directory URLs mapped to `index.html` and a path check that refuses `..`.

## Theme and layout

Core tokens give the canvas, white surfaces, radius 16-20px, `--shadow-3` and the pill. Each card sets its own tokens (accent, tint, display face) from its theme. On desktop the headline block and the two rotated cards sit side by side, as in DESIGN.md. At 390px the cards stack, rotation is 0, and the pill is fixed to the bottom. The page uses `max-width: 100%` and no fixed widths, so nothing scrolls sideways. `@media (prefers-reduced-motion)` removes rotation and hover motion.

## Data models

`CardData` above is the only model. Links: card `href` values are relative, the pill `href` is `REMIX_URL`.

## Error handling

A missing or invalid `bone.json` fails the build (`parseBoneSpec`), not the page. The page has no runtime failure path beyond a missing mount node, which throws at load.

## Testing strategy

- **Build test** (`build.test.ts`, vitest, long timeout): runs `bun run build`, then checks the three `index.html` files exist, no `src`/`href` starts with `/` or `http` (except the remix link), each manifest has `scope` and `start_url` `./`, each `sw.js` precache list names existing files, `dist/sw.js` is absent, and the card `href`s point to folders that exist.
- **Markup test** (`page.test.ts`, happy-dom): `renderLauncher` gives one `h1`, one line, two links with the right names and `href`s, one pill with `REMIX_URL`, `target` and `rel`, aria-hidden motifs.
- **E2E** (`apps/launcher/e2e`, Playwright, `bun run preview`, projects 1280 and 390): cards visible; click each, URL ends with the sub-path and the app renders; after load `navigator.serviceWorker.ready` scope equals the sub-path and the other app's scope is not controlled; offline reload works; zero console errors; every request is to `localhost:4180`; `scrollWidth <= innerWidth`; every link box is at least 44px.

## Decisions and alternatives

- **Relative base and `./sw.js`** rather than a fixed base such as `/ossuary/`, so the folder can be hosted at any path.
- **One build script** rather than a Vite multi-page setup, because each app keeps its own config, worker and manifest.
- **Build-time `bone.json` read** keeps the card theme in sync with the app without importing app code.
