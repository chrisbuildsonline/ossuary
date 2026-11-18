# Tasks: release-polish

Rules for every task: write the failing test first where code is involved, then the code, and keep the whole suite green before the next task. Requirement numbers refer to `requirements.md`.

- [x] 1. Dependencies and build output
  - [x] 1.1 Drop the unused `ics` dependency from `packages/ossuary-core` and fix the stack line in `.kiro/steering/tech.md`. _Requirements: 1.3, 4.1_
  - [x] 1.2 Make the app precache tests build with `NODE_ENV=production` and assert the built page registers `./sw.js` and no `.ts` file ships. Then replace `new URL('./sw-entry.ts', import.meta.url)` in the core pwa plugin. _Requirements: 4.2, 4.3_

- [x] 2. One domain word list
  - [x] 2.1 Add `scripts/domain-words.json` and make `hook:boundary`, the core boundaries test and the bone-forge tests read it. Remove the other copies. _Requirements: 3.1, 3.2_

- [x] 3. Spec check
  - [x] 3.1 Change `scripts/check-specs.test.ts` to assert that `findSpecs(root)` contains `apps/pantry-reaper/bone.json` and `apps/warranty-wraith/bone.json`, is in name order, returns only existing files and skips the launcher, with no exact list. _Requirements: 5.1_

- [x] 4. Container gate
  - [x] 4.1 Write `scripts/dockerfile.test.ts` (script names exist in `package.json`, `CMD` steps, pinned pnpm frozen install, Playwright image tag, `.dockerignore` entries). Then add the `Dockerfile` and `.dockerignore`. _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Docs
  - [x] 5.1 Write `docs/REMIX.md`: a third app with `scaffold_app` (in Kiro, kiro-cli, bun one-liner) and by hand. Run every command in it. _Requirements: 1.2_
  - [x] 5.2 Rewrite `README.md` and check each claim against the code. _Requirements: 1.1, 1.3_

- [x] 6. Wrap-up
  - [x] 6.1 Run the full gate: `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`. Fix every failure before closing the spec. _Requirements: 5.2_
