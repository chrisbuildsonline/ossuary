# Tasks: claim-reminder

Rules for every task: write the failing test first where code is involved, then the code, and keep the whole suite green before the next task. Requirement numbers refer to `requirements.md`.

- [x] 1. Core
  - [x] 1.1 Write the failing core test (ical.js reads `DESCRIPTION` back with escaping and folding; absent, `''` and `undefined` `describe` leave the output unchanged). Then add the `describe` option to `exportIcs`. _Requirements: 1.1, 1.2, 1.3, 1.4, 4.2_

- [x] 2. Claim message
  - [x] 2.1 Write `apps/warranty-wraith/src/claim.test.ts` first, then `claim.ts` with `claimNote(values, warrantyEnds)`. _Requirements: 2.1, 2.2, 2.3, 2.4, 4.3_

- [x] 3. Button and download
  - [x] 3.1 Write the `app.test.ts` cases first (button shown, hidden when lapsed, download content, toast). Then add the `Claim reminder` button and the download. _Requirements: 3.1, 3.2, 3.3, 3.4, 4.3_

- [x] 4. Demo and write-up
  - [x] 4.1 Add the claim step to `apps/warranty-wraith/e2e/demo.spec.ts`, then update the Devpost write-up and `docs/DEMO.md` to describe the feature as built. _Requirements: 4.1, 4.4_

- [ ] 5. Wrap-up
  - [ ] 5.1 Run the full gate: `bun run test`, `bun run typecheck`, `bun run hook:boundary`, `bun run hook:spec` and `bun run e2e`. Fix every failure before closing the spec. _Requirements: 4.5_
