# Requirements: bone-forge (`tools/bone-forge`)

## Introduction

bone-forge is a stdio MCP server that lets an AI assistant check a bone spec, preview its countdowns and scaffold a new app from it. It is a thin layer over `ossuary-core`. It never re-implements schema or engine logic: validation is `parseBoneSpec` and countdowns are `evaluate`.

It is written in TypeScript on `@modelcontextprotocol/sdk` (`McpServer`, `StdioServerTransport`, zod 4 input schemas), and run with bun from `tools/bone-forge/src/main.ts` or through the root script `bun run bone-forge`. `bone-forge` may import `ossuary-core`. `ossuary-core` never imports `bone-forge`.

Terms:

- **Bone spec**, **Item**, **ISO day**, **Issue** (`{ path, message }`): as defined in the skeleton-contract spec.
- **Repo root**: the directory the server was started with. The server factory receives it as an argument, so tests use a temporary directory.
- **App name**: the folder name under `apps/`. Lowercase `a` to `z`, digits and `-`, starting with a letter, at most 40 characters.
- **Spec input**: a bone spec given either as a JSON object or as JSON text.
- **Tool error**: an MCP tool result with `isError: true`.
- **Template**: the folder `tools/bone-forge/template`, holding the generic TypeScript files that every generated app shares.

## Requirement 1: Server and transport

**User story:** As an app author using an AI assistant, I want to start one server and see its three tools, so that I can validate, preview and scaffold without reading the core's source.

### Acceptance criteria

1.1 WHEN `bun tools/bone-forge/src/main.ts` runs THE SYSTEM SHALL serve MCP over stdio and expose exactly the tools `validate_spec`, `scaffold_app` and `preview_countdown`, each with a description and a zod 4 input schema.

1.2 WHEN `bun run bone-forge` runs from the repo root THE SYSTEM SHALL start the same server, with the repo root set to the current directory of the repo.

1.3 THE SYSTEM SHALL build the server in a factory `createServer({ root })` that registers the tools and returns the `McpServer` without connecting a transport, so tests can run it against a temporary root.

1.4 THE SYSTEM SHALL write protocol messages only to stdout and any log line only to stderr.

1.5 THE SYSTEM SHALL make no network request and SHALL read no file outside the repo root, except its own template folder.

1.6 THE SYSTEM SHALL read the clock and the random source nowhere. Time enters `preview_countdown` only as the `now` argument.

## Requirement 2: validate_spec

**User story:** As an app author, I want to paste a spec and get every problem listed with its path, so that I can fix it in one pass.

### Acceptance criteria

2.1 WHEN `validate_spec` is called with `spec` as an object or as JSON text THE SYSTEM SHALL run `parseBoneSpec` and return structured content `{ valid: boolean, issues: { path, message }[] }`.

2.2 WHEN the spec is valid THE SYSTEM SHALL return `valid: true`, an empty `issues` list and a text content with one "ok" line naming the spec id.

2.3 WHEN the spec is invalid THE SYSTEM SHALL return `valid: false`, the issues exactly as `parseBoneSpec` reports them, and a text content with one line per issue in the form `path: message`.

2.4 THE SYSTEM SHALL treat an invalid spec as a normal result and SHALL NOT set `isError` for it.

2.5 IF the spec is JSON text that does not parse THEN THE SYSTEM SHALL return `valid: false` with one issue at path `""` and a plain message, and SHALL NOT set `isError`.

2.6 THE SYSTEM SHALL NOT throw for any input, including `null`, numbers, arrays, very long strings and random JSON. For every generated JSON value, `valid` SHALL equal the `ok` of `parseBoneSpec` on the same value, and the issues SHALL equal its issues.

2.7 THE SYSTEM SHALL NOT change the spec it validates, and the same input SHALL give the same output.

## Requirement 3: scaffold_app

**User story:** As an app author, I want one call that turns a valid spec into a runnable app folder shaped like the existing apps, so that a new app starts from the same skeleton.

### Acceptance criteria

3.1 WHEN `scaffold_app` is called THE SYSTEM SHALL accept `spec` (object or JSON text) and an optional `name`, and SHALL default `name` to the spec id.

3.2 THE SYSTEM SHALL validate the spec with `parseBoneSpec` before it touches the disk. IF the spec is invalid THEN THE SYSTEM SHALL return a tool error that lists the issues, and SHALL write nothing.

3.3 IF `name` is not an app name (uppercase, a dot, a slash, a leading digit or hyphen, empty, or longer than 40 characters) THEN THE SYSTEM SHALL return a tool error naming the rule, and SHALL write nothing. This SHALL also apply to a defaulted name taken from the spec id.

3.4 IF `apps/<name>` already exists, as a folder, a file or a link, THEN THE SYSTEM SHALL return a tool error, and SHALL leave the existing path untouched.

3.5 THE SYSTEM SHALL write only inside `apps/<name>` of the repo root. IF the resolved target is not a direct child of `<root>/apps` THEN THE SYSTEM SHALL return a tool error and write nothing, whatever `name` contains.

3.6 WHEN the spec and name are accepted THE SYSTEM SHALL write these files, and no others:
- `package.json`: name `@ossuary/<name>`, `private`, `type: module`, license MIT, dependency `@ossuary/core` as `workspace:*`, and the same dev dependencies as `apps/warranty-wraith`.
- `bone.json`: the parsed spec, pretty printed with two spaces and a final newline.
- `index.html`: title and description from the spec, `theme-color` from the spec accent, manifest and icon links.
- `tsconfig.json`: the same shape as the existing apps, with a reference to `packages/ossuary-core`.
- `vite.config.ts`: `ossuaryPwa({ prefix: '<name>-' })`.
- `public/manifest.webmanifest`: `name` and `short_name` from the spec, `theme_color` from the spec accent, `background_color` from the spec canvas (or the core default), standalone display.
- `src/main.ts`, `src/spec.ts`, `src/app.ts`, `src/spec.test.ts`.

3.7 THE SYSTEM SHALL keep `src/main.ts` as the only generated file that reads the clock or makes ids. `src/spec.ts` SHALL parse `bone.json` with `parseBoneSpec`, throw at load when it is invalid, and export `boneSpec` and `nowFromClock`.

3.8 THE SYSTEM SHALL generate `src/app.ts` as generic glue built only from `@ossuary/core` elements and functions: shell, list, add sheet, detail with a card per lifespan, trace and calendar export, and done and remove actions. It SHALL contain no domain words and no engine, schema, store or ICS logic of its own.

3.9 THE SYSTEM SHALL read the generic files `src/main.ts`, `src/spec.ts`, `src/app.ts` and `src/spec.test.ts` from `tools/bone-forge/template`, and fill only the spec-derived values (name, ids, prefix, title, colours). The template files SHALL be typechecked by `tsc -b` through their own tsconfig referenced from the root `tsconfig.json`, so a generated app compiles.

3.10 THE SYSTEM SHALL return structured content `{ dir, files }`, where `dir` is `apps/<name>` and `files` lists the written paths relative to the repo root, and a text content with the next steps: add the app to the root `tsconfig.json` references, add `dev:<name>` and `build:<name>` scripts to the root `package.json`, and run `pnpm install`. THE SYSTEM SHALL NOT edit any existing file.

3.11 IF a write fails part way THEN THE SYSTEM SHALL remove the files it created in this call, return a tool error, and leave no partial `apps/<name>` folder.

3.12 THE SYSTEM SHALL produce the same files for the same spec and name.

## Requirement 4: preview_countdown

**User story:** As an app author, I want to see what the engine says for one example item on a chosen day, so that I can check my rules and stages before building the app.

### Acceptance criteria

4.1 WHEN `preview_countdown` is called with `spec`, `item` (field key to value) and `now` (`{ day: "YYYY-MM-DD", minuteOfDay?: 0..1439 }`) THE SYSTEM SHALL run `parseBoneSpec` and then `evaluate(spec, item, now)`.

4.2 WHEN all three inputs are valid THE SYSTEM SHALL return structured content with the whole `Evaluation`: every lifespan with `startedAt`, `expiresAt`, `remaining`, `fraction`, `stage` and `trace`, and `primaryIndex`.

4.3 THE SYSTEM SHALL return a text content with one line per lifespan: the label, the expiry day, the remaining days, and the stage label, with the primary lifespan marked in text.

4.4 IF the spec is invalid, or the item or `now` fails validation, THEN THE SYSTEM SHALL return a tool error whose text lists each issue as `path: message`, with `now` issues under the path `now`.

4.5 THE SYSTEM SHALL take time only from the `now` argument. The same inputs SHALL give the same output under any `TZ` setting.

4.6 THE SYSTEM SHALL NOT throw for any input.

## Requirement 5: Reuse and boundaries

**User story:** As the maintainer, I want bone-forge to stay a thin layer, so that the core remains the one source of truth.

### Acceptance criteria

5.1 THE SYSTEM SHALL validate every spec through `parseBoneSpec` and every countdown through `evaluate`, imported from `@ossuary/core`, and SHALL contain no copy of schema, contrast, day arithmetic or rule logic.

5.2 THE SYSTEM SHALL have `packages/ossuary-core` import nothing from `tools/*`, and `bun run hook:boundary` SHALL keep passing.

5.3 THE SYSTEM SHALL add no dependency other than `@modelcontextprotocol/sdk` and `zod` at runtime. Test tools stay dev dependencies.

5.4 THE SYSTEM SHALL generate apps with the same layout and the same dependency on `ossuary-core` as `apps/pantry-reaper` and `apps/warranty-wraith`, and every generated `bone.json` SHALL pass `bun run hook:spec` once the app is in place.

## Requirement 6: Kiro registration

**User story:** As a Kiro user, I want the server registered in the workspace, so that the tools appear without manual setup.

### Acceptance criteria

6.1 THE SYSTEM SHALL provide `.kiro/settings/mcp.json` with an `mcpServers` object holding `bone-forge`, with `command` `bun`, `args` `["tools/bone-forge/src/main.ts"]` and `disabled` false.

6.2 THE SYSTEM SHALL list only `validate_spec` and `preview_countdown` in `autoApprove`. `scaffold_app` writes files and SHALL NOT be auto approved.

6.3 WHEN tests run THE SYSTEM SHALL fail IF `mcp.json` is not valid JSON, names another command or args, auto approves `scaffold_app`, or auto approves a tool the server does not expose.

## Requirement 7: Tests and gates

**User story:** As the maintainer, I want the server proven by tests that match the repo's engineering rules, so that I can trust it without running it by hand.

### Acceptance criteria

7.1 THE SYSTEM SHALL keep vitest tests next to the code, in `tools/bone-forge/src/**/*.test.ts`, with a unit test group per tool and fixed `now` values.

7.2 THE SYSTEM SHALL include a fast-check test that `validate_spec` never throws and agrees with `parseBoneSpec` on arbitrary JSON values, mutated valid specs and arbitrary strings.

7.3 THE SYSTEM SHALL include scaffold tests in a temporary directory that cover: the written file list, `bone.json` reparsing equal to the parsed spec, an existing folder, a bad name, an invalid spec, and a path escape (`../x`, an absolute path, a nested path, a symlinked `apps`).

7.4 THE SYSTEM SHALL include an integration test that spawns the real server over stdio with the SDK `Client` and `StdioClientTransport`, lists the three tools, calls each one with valid input, and calls one with invalid input that comes back as an `isError` result.

7.5 THE SYSTEM SHALL pass these gates before the spec is closed: `bun run test`, `bun run typecheck`, `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`.
