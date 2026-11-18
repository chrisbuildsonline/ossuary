# Requirements: release-polish

## Introduction

Final pass before release. All of this work is already implemented. The spec records it so the repo, the docs and the tests agree. No new features. The gate is `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`.

## Requirement 1: Docs match the code

**User story:** As a reader, I want every claim in the docs to be true.

### Acceptance criteria

1.1 THE SYSTEM SHALL have a `README.md` in which every claim (commands, counts, files, behaviour) matches the code.

1.2 THE SYSTEM SHALL have `docs/REMIX.md` explaining how to make a third app with bone-forge `scaffold_app` (in Kiro, with kiro-cli, or with a bun one-liner) and by hand. Every command in it SHALL have been run.

1.3 THE SYSTEM SHALL describe calendar export as hand-written, with no `ics` dependency, in the README and in `.kiro/steering/tech.md`.

## Requirement 2: Reproducible gate in a container

**User story:** As a judge, I want to run the gate in one command on a clean machine.

### Acceptance criteria

2.1 THE SYSTEM SHALL have a root `Dockerfile` on the Playwright v1.65.1 image, with bun 1.4.2 and a frozen pnpm 10.34.9 install, whose `CMD` runs `bun run test`, `bun run typecheck`, `bun run hook:boundary`, `bun run hook:spec` and `bun run e2e`.

2.2 THE SYSTEM SHALL have a `.dockerignore` that keeps `node_modules`, build output and `.git` out of the build context.

2.3 THE SYSTEM SHALL check both files in `scripts/dockerfile.test.ts`.

## Requirement 3: One domain word list

**User story:** As the maintainer, I want one list so the checks cannot drift apart.

### Acceptance criteria

3.1 THE SYSTEM SHALL keep the domain word list only in `scripts/domain-words.json`.

3.2 THE SYSTEM SHALL read that file in `hook:boundary`, in the core boundaries test and in the bone-forge tests.

## Requirement 4: Dependencies and build output

**User story:** As the maintainer, I want no unused dependency and no source file in a shipped app.

### Acceptance criteria

4.1 THE SYSTEM SHALL NOT list `ics` in `packages/ossuary-core`.

4.2 THE SYSTEM SHALL build the app precache tests with `NODE_ENV=production`. They SHALL assert that the built page registers `./sw.js` and that no `.ts` file ships.

4.3 THE SYSTEM SHALL NOT use `new URL('./sw-entry.ts', import.meta.url)` in the core pwa plugin, so Vite does not copy `sw-entry.ts` into app assets.

## Requirement 5: Spec check covers a third app

**User story:** As a remixer, I want my new app to keep the suite green.

### Acceptance criteria

5.1 THE SYSTEM SHALL NOT hard-code an exact app list in `scripts/check-specs.test.ts`. It SHALL assert that `findSpecs(root)` contains `apps/pantry-reaper/bone.json` and `apps/warranty-wraith/bone.json`, is in name order, returns only existing files and skips the launcher.

5.2 THE SYSTEM SHALL pass the gate before the spec is closed.