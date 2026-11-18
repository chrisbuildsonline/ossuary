# Design: release-polish

## Overview

Small changes across docs, scripts and tests. No new runtime behaviour, and no new dependency.

```
README.md, docs/REMIX.md          docs
Dockerfile, .dockerignore         container gate
scripts/dockerfile.test.ts        checks both container files
scripts/domain-words.json         the one domain word list
scripts/check-specs.test.ts       discovers apps/*/bone.json
packages/ossuary-core/            ics dependency removed, pwa plugin fixed
```

## Components and interfaces

- **Dockerfile**: starts from the Playwright v1.65.1 image, copies bun in from the `oven/bun:1.4.2` image, copies the repo, then runs `bunx pnpm@10.34.9 install --frozen-lockfile`. `CMD` runs `bun run test`, `bun run typecheck`, `bun run hook:boundary`, `bun run hook:spec`, then `bun run e2e`, joined so the first failure stops the run.
- **`.dockerignore`**: `node_modules`, `dist`, `.git` and test output.
- **`domain-words.json`**: a JSON array of strings. The core boundaries test reads it with `readFileSync`, because the file sits outside the core package. `hook:boundary` and the bone-forge tests import `scripts/domain-words.ts`, which loads the JSON. None keeps its own copy.
- **pwa plugin**: the worker entry is resolved from a path on disk instead of `new URL('./sw-entry.ts', import.meta.url)`. Vite no longer sees the URL as an asset, so `sw-entry.ts` is not copied into app assets.
- **`check-specs.test.ts`**: does not glob. It asserts that `findSpecs(root)` contains `apps/pantry-reaper/bone.json` and `apps/warranty-wraith/bone.json`, returns them in name order, returns only existing files, and skips the launcher. It has no exact list, so a third app is covered without an edit.

## Data models

`domain-words.json`: `string[]`, lower case.

## Error handling

The container `CMD` exits non-zero on the first failing step. `hook:boundary` and the tests fail with the file and the word they found.

## Testing strategy

- `scripts/dockerfile.test.ts` reads `Dockerfile` and `.dockerignore` and asserts: the Dockerfile exists; every `bun run <script>` in it exists in `package.json`; the `CMD` runs test, typecheck, hook:boundary, hook:spec and e2e; the install uses the pnpm version pinned in the `packageManager` field of `package.json` with `--frozen-lockfile`; the `FROM` Playwright image tag equals the installed `@playwright/test` version; `.dockerignore` lists `**/node_modules`, `**/dist`, `.env` and `.git` and does not exclude `.kiro`, `design`, `scripts`, `pnpm-lock.yaml`, `apps`, `packages` or `tools`. It does not check the bun version.
- The pantry and wraith precache tests build with `NODE_ENV=production`. They assert the built page script (`assets/index-*.js`, loaded by `index.html`) calls `serviceWorker.register('./sw.js')`, that the precache list names existing files, and that no `.ts` file is in the build output.
- The boundary checks read `scripts/domain-words.json`, so a word added there is enforced in all three places.
- The gate is the final check.

## Decisions and alternatives

- **One JSON file** rather than four identical copies (hook, core test, two bone-forge tests), so they cannot drift. JSON is readable from the hook, vitest and the MCP tests with no loader.
- **Fixing the plugin** rather than deleting the copied file after the build, because the cause was the `new URL` form.
- **Discovering apps** rather than listing them, so `scaffold_app` output needs no test edit.
- **A test for the Dockerfile**, because Docker is not available in every environment where the suite runs.
