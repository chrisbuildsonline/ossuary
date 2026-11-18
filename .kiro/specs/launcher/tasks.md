# Tasks: launcher (`apps/launcher`)

Rules for every task: write the failing test first, then the code, and keep the whole suite green before the next task. Requirement numbers refer to `requirements.md`.

- [ ] 1. Page markup
  - [ ] 1.1 Write a failing happy-dom test for `renderLauncher`: one `h1`, one supporting line, two card links with their names and relative `href`s, one pill with `REMIX_URL`, `target="_blank"` and `rel="noopener noreferrer"`, `aria-hidden` motifs. Then add the `apps/launcher` package, `index.html`, `page.ts` and `cards.ts` (cards from the two `bone.json` files). _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 4.2, 5.2_
  - [ ] 1.2 Write a failing test that card theme values equal the `bone.json` theme and that the page holds no hand-written colour copies. Then set the per-card tokens in `page.ts`. _Requirements: 2.1_

- [ ] 2. Styling
  - [ ] 2.1 Add `launcher.css` and `main.ts` with the core theme, the rotated cards (-3 and +2 degrees), the stacked phone layout, the bottom pill, the focus ring, 44px targets and the reduced-motion rule. Check it by eye at 1280 and 390 against DESIGN.md section 7. _Requirements: 1.4, 2.3_

- [ ] 3. Static build
  - [ ] 3.1 Write a failing vitest (`build.test.ts`) that runs `bun run build` and checks the layout: `dist/index.html`, `dist/pantry-reaper/index.html`, `dist/warranty-wraith/index.html`. Then add `scripts/build-dist.ts` (launcher first, then each app, base `./`) and the root `build` script. _Requirements: 3.1, 5.1_
  - [ ] 3.2 Extend the test: no `src` or `href` starts with `/` or `http` except the remix link, each manifest has `scope` and `start_url` `./` with relative icons, each app registers `./sw.js`, and each precache list names only files that exist. Fix the plugin in core if it emits absolute paths, generically, with its own tests. _Requirements: 3.2, 3.3, 3.4, 5.1_
  - [ ] 3.3 Extend the test: the launcher registers no worker, `dist/sw.js` is absent, and the card `href`s point to folders that exist. _Requirements: 1.3, 3.5, 5.1_

- [ ] 4. Preview
  - [ ] 4.1 Write a failing test that `scripts/preview-dist.ts` serves `dist` on 4180, maps folder URLs to `index.html` and refuses `..`. Then add it and the root `preview` script. _Requirements: 3.6_

- [ ] 5. End-to-end
  - [ ] 5.1 Add the Playwright config for `apps/launcher/e2e` (web server `bun run preview`, projects 1280 and 390). Write tests: cards visible, each link navigates to its app, no console errors, only requests to `localhost:4180`. _Requirements: 1.3, 4.1, 5.3_
  - [ ] 5.2 Add tests: each app's worker scope equals its sub-path and does not control the other app or the launcher, and the app reloads offline. _Requirements: 3.4, 3.5, 5.3_
  - [ ] 5.3 Add tests: no horizontal scroll and every link at least 44px at both widths. Fix the CSS until they pass. _Requirements: 2.3, 5.3_

- [ ] 6. Wrap-up
  - [ ] 6.1 Check that the launcher imports no app code, adds no runtime dependency, and that core stays free of domain words. _Requirements: 4.2_
  - [ ] 6.2 Run the full gate: `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`. Fix every failure before closing the spec. _Requirements: 5.4_
