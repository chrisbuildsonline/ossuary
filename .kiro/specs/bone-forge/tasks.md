# Tasks: bone-forge (`tools/bone-forge`)

Rules for every task: write the failing test first, then the code, and keep the whole suite green before the next task. Requirement numbers refer to `requirements.md`.

- [x] 1. Package and server skeleton
  - [x] 1.1 Write a failing test that `createServer({ root })` returns an `McpServer` with exactly the tools `validate_spec`, `scaffold_app` and `preview_countdown`. Then add the dependencies (`@modelcontextprotocol/sdk`, `zod`; dev `fast-check`, `@types/node`), `server.ts`, `result.ts` (`ok`, `toolError`, `issueLines`) and `input.ts` (`readSpecInput` for objects and JSON text, never throws). _Requirements: 1.1, 1.3, 1.6, 5.1, 5.3_
  - [x] 1.2 Write a failing test for `main.ts` (logs only to stderr, root fixed to the repo), then add `main.ts` with `StdioServerTransport`, and the root script `"bone-forge": "bun tools/bone-forge/src/main.ts"`. _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 2. validate_spec
  - [x] 2.1 Write failing tests with fixed specs: valid as object and as text, invalid with a known path, `ok` text line, one text line per issue, no `isError`. Then implement `validateSpec` over `parseBoneSpec` and register the tool with its input and output schema. _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 2.2 Write failing tests for JSON text that does not parse (one issue at path `""`) and for `null`, numbers, arrays and very long strings. Then handle them in `readSpecInput` and the handler `try/catch`. _Requirements: 2.5, 2.6_
  - [x] 2.3 Write the fast-check fuzz test (fixed seed): `fc.jsonValue()`, `fc.anything()`, arbitrary strings and mutated valid specs never throw, and `valid` and `issues` equal `parseBoneSpec`. Add a test that the input is not changed and the same input gives the same output. _Requirements: 2.6, 2.7, 7.2_

- [x] 3. preview_countdown
  - [x] 3.1 Write failing tests with fixed `now` values (a plain day, a day with `minuteOfDay`, a threshold day and the day before) for a one-lifespan spec. Then implement `previewCountdown` over `parseBoneSpec` and `evaluate` and register the tool with the `now` input schema. _Requirements: 4.1, 4.2, 4.5_
  - [x] 3.2 Write failing tests for a two-lifespan spec: `primaryIndex`, one text line per lifespan with the primary marked, and structured content equal to `evaluate`. Then add the output schema and text lines. _Requirements: 4.2, 4.3_
  - [x] 3.3 Write failing tests for an invalid spec, an invalid item, a bad `now.day` and `minuteOfDay` 1440: each is a tool error listing `path: message`. Add determinism and the three-`TZ` check, and a no-throw check. Then implement the error mapping. _Requirements: 4.4, 4.5, 4.6_

- [x] 4. Template and generated files
  - [x] 4.1 Write failing tests for the template (files exist, no domain word, only `main.ts` reads the clock or makes ids). Then add `tools/bone-forge/template` with `tsconfig.json`, a placeholder `bone.json`, and `src/main.ts`, `src/spec.ts`, `src/spec.test.ts`. Reference the template tsconfig from the root `tsconfig.json` so `tsc -b` checks it. _Requirements: 3.7, 3.9, 5.4_
  - [x] 4.2 Write failing tests, then add the generic `template/src/app.ts` built only from core elements and functions: shell, list, add sheet, detail with a card per lifespan, trace, calendar export, done and remove. Make `bun run typecheck` pass. _Requirements: 3.8, 3.9_
  - [x] 4.3 Write failing tests for `renderFiles` (the exact path list, `bone.json` pretty printed, `package.json` fields and dependency `workspace:*`, manifest name and colours, `index.html` escaping, `vite.config.ts` prefix, template files copied byte for byte, same output twice). Then implement `scaffold/files.ts`. _Requirements: 3.6, 3.7, 3.12, 5.4_

- [ ] 5. scaffold_app
  - [x] 5.1 Write failing tests for `parseAppName` (valid names; `Bad`, `a/b`, `..`, `1x`, `-x`, empty, 41 characters refused; a spec id with `_` and no name refused). Then implement `scaffold/app-name.ts`. _Requirements: 3.1, 3.3_
  - [x] 5.2 Write failing tests for `resolveAppDir` (direct child of `<root>/apps` only; `../x`, absolute path, nested path and `apps` as a symlink to another folder refused). Then implement `scaffold/safe-path.ts`. _Requirements: 3.5, 7.3_
  - [ ] 5.3 Write failing tests in a temporary directory: written file list, `bone.json` reparses equal to the parsed spec, existing folder, file and symlink refused and untouched, invalid spec leaves the root empty, returned `{ dir, files }` and next-steps text, no root file edited. Then implement `tools/scaffold-app.ts` and `scaffold/write.ts` (`mkdir` then `wx` writes) and register the tool. _Requirements: 3.1, 3.2, 3.4, 3.6, 3.10, 7.3_
  - [ ] 5.4 Write a failing test that a forced write failure removes everything the call created and returns a tool error. Then add the rollback. _Requirements: 3.11_
  - [ ] 5.5 Write a failing test that a scaffolded app's `bone.json` passes `checkSpecs` from `scripts/check-specs.ts`, and that a scan of the generated files finds no banned domain word. Then fix any gap. _Requirements: 5.4_

- [ ] 6. Kiro registration
  - [ ] 6.1 Write a failing test for `.kiro/settings/mcp.json` (valid JSON, `bone-forge` with command `bun`, args `["tools/bone-forge/src/main.ts"]`, `disabled` false, `autoApprove` exactly `validate_spec` and `preview_countdown`, every name is a tool the server lists). Then add the file. _Requirements: 6.1, 6.2, 6.3_

- [ ] 7. Integration over stdio
  - [ ] 7.1 Write a failing test that spawns `bun tools/bone-forge/src/main.ts` with `StdioClientTransport`, connects the SDK `Client`, lists the three tools, and calls `validate_spec` and `preview_countdown` with valid input. Then fix the wiring until it passes. _Requirements: 1.1, 1.4, 7.4_
  - [ ] 7.2 Write failing tests that an invalid `preview_countdown` call and an invalid `scaffold_app` call come back as `isError` results over stdio, and that an invalid `validate_spec` call does not. Add an in-memory test of a successful `scaffold_app` with `createServer({ root: tmp })`. _Requirements: 2.4, 3.2, 4.4, 7.4_

- [ ] 8. Wrap-up
  - [ ] 8.1 Check that `packages/ossuary-core` imports nothing from `tools/*`, that bone-forge runtime dependencies are only `@modelcontextprotocol/sdk` and `zod`, and that no network call or file read outside the repo root exists. _Requirements: 1.5, 5.1, 5.2, 5.3_
  - [ ] 8.2 Run the full gate: `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`. Fix every failure before closing the spec. _Requirements: 7.5_
