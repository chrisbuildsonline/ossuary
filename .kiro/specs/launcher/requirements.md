# Requirements: launcher (`apps/launcher`)

## Introduction

The launcher is the front door of Ossuary and the last UI: one static page with two large app cards and one action. It follows `design/DESIGN.md` section 7 "Launcher" and the core theme (canvas `#eef0f4`, white floating surfaces, 16-20px radius, soft shadow, one near-black pill primary action, one accent). The same work adds the static build that puts the launcher and both apps in one `dist`.

Terms:

- **App card**: a large link to one app, in that app's own theme (the `theme` of its `bone.json`).
- **Remix guide**: `https://github.com/chrisbuildsonline/ossuary/blob/main/docs/REMIX.md`.
- **Decay motif**: the candle (Pantry Reaper) or the ghost (Warranty Wraith) from `ossuary-core`, at size `xl`.

## Requirement 1: Page content

**User story:** As a visitor, I want one headline and two obvious ways in, so that I reach an app in one tap.

### Acceptance criteria

1.1 WHEN the launcher loads THE SYSTEM SHALL show one `h1` "Everything expires. Know when.", one supporting line, two app cards and one primary action.

1.2 THE SYSTEM SHALL render the primary action as a near-black pill "Make your own", a link to the remix guide that opens in a new tab with `rel="noopener noreferrer"`.

1.3 THE SYSTEM SHALL render each app card as one `a` with the app name as accessible name and `href` `./pantry-reaper/` or `./warranty-wraith/`.

1.4 THE SYSTEM SHALL rotate the cards by -3 and +2 degrees on desktop, and SHALL use 0 under `prefers-reduced-motion` and at phone width.

## Requirement 2: Theme and motifs

**User story:** As a visitor, I want each card to look like its app, so that the two apps feel distinct.

### Acceptance criteria

2.1 THE SYSTEM SHALL style each card from the theme read from that app's `bone.json` at build time, and the page from core tokens. It SHALL NOT copy colour values by hand.

2.2 THE SYSTEM SHALL draw the candle on the Pantry Reaper card and the ghost on the Warranty Wraith card, live, at size `xl`, through the core motif component, marked `aria-hidden`.

2.3 THE SYSTEM SHALL keep text at 4.5:1 contrast or more, show a visible focus ring on every link, and make every link at least 44 by 44 CSS px.

## Requirement 3: Single static build

**User story:** As the maintainer, I want one command to produce one folder that works from a sub-path.

### Acceptance criteria

3.1 WHEN `bun run build` runs THE SYSTEM SHALL write the launcher to `dist/index.html`, Pantry Reaper to `dist/pantry-reaper/` and Warranty Wraith to `dist/warranty-wraith/`.

3.2 THE SYSTEM SHALL build with a relative base, so no asset, icon or script link in any `index.html` starts with `/` or `http`.

3.3 THE SYSTEM SHALL write each app manifest with `scope` and `start_url` `./` and relative icons.

3.4 THE SYSTEM SHALL register each app's worker as `./sw.js`, so its scope is its sub-path. Each precache list SHALL name only files that exist in that app's folder.

3.5 THE SYSTEM SHALL register no service worker in the launcher and ship no `sw.js` at `dist/`.

3.6 WHEN `bun run preview` runs THE SYSTEM SHALL serve `dist` on port 4180.

## Requirement 4: Local-first and boundaries

**User story:** As the maintainer, I want the launcher to obey the repo rules.

### Acceptance criteria

4.1 THE SYSTEM SHALL make no request to another origin on load. External links are followed only by the user.

4.2 THE SYSTEM SHALL import nothing from the two apps (it reads their `bone.json` at build time only), add no UI framework or runtime dependency, and keep `bun run hook:boundary` passing.

## Requirement 5: Tests

**User story:** As the maintainer, I want a broken sub-path to fail before release.

### Acceptance criteria

5.1 THE SYSTEM SHALL include a vitest that runs the build and checks the layout, relative asset links, manifests, precache lists and link targets (1.2, 1.3, 3.1 to 3.5).

5.2 THE SYSTEM SHALL include a happy-dom test of the page markup (1.1 to 1.3, 2.2).

5.3 THE SYSTEM SHALL include Playwright tests at 1280 and 390 widths: cards visible, each link navigates to its app, each worker controls only its sub-path and the app works offline, no console error, no non-local request, no horizontal scroll, 44px targets (2.3, 3.4, 4.1).

5.4 THE SYSTEM SHALL pass `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec` before the spec is closed.
