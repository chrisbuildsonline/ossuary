# Design: bone-forge (`tools/bone-forge`)

## Overview

bone-forge is a small stdio MCP server over `ossuary-core`. Each tool is a pure function from input to a result, plus (for `scaffold_app`) one controlled write. The MCP wiring is a thin shell around those functions, so the logic is tested without a transport and the wiring is tested once against the real process.

```
main.ts  ->  server.ts (createServer)  ->  tools/validate-spec.ts
                                       ->  tools/scaffold-app.ts  ->  scaffold/files.ts, scaffold/safe-path.ts
                                       ->  tools/preview-countdown.ts
                         all of them  ->  @ossuary/core (parseBoneSpec, evaluate)
```

Dependencies point one way: `tools/bone-forge` imports `@ossuary/core`, never the other way. The core stays free of domain words. The template files for generated apps live in `tools/bone-forge/template` and use no domain words either.

## Directory layout

```
tools/bone-forge/
  package.json        deps: @modelcontextprotocol/sdk, zod; dev: vitest, fast-check, @types/node
  tsconfig.json       src; references the core
  src/
    main.ts           stdio entry: createServer({ root }) + StdioServerTransport
    server.ts         createServer({ root }): registers three tools
    input.ts          readSpecInput(value): Result<unknown> (object or JSON text)
    result.ts         ok(structured, text) / toolError(text) helpers
    tools/
      validate-spec.ts       validateSpec(input)
      scaffold-app.ts        scaffoldApp(root, input)
      preview-countdown.ts   previewCountdown(input)
    scaffold/
      app-name.ts            parseAppName
      safe-path.ts           resolveAppDir(root, name)
      files.ts               renderFiles(spec, name, templates): { path, content }[]
      write.ts               writeAll with rollback
    *.test.ts         next to each module; integration.test.ts spawns the server
  template/
    tsconfig.json     typechecks the template files against the core
    src/main.ts  src/spec.ts  src/app.ts  src/spec.test.ts
    bone.json         placeholder spec so `import bone from '../bone.json'` resolves
```

Root changes the implementation makes (not this spec): script `"bone-forge": "bun tools/bone-forge/src/main.ts"` in `package.json`, a `tools/bone-forge/template` entry in the root `tsconfig.json` references, and the `.kiro/settings/mcp.json` file.

## Components and interfaces

### Result helpers (`result.ts`)

```ts
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
export const ok = (structuredContent: Record<string, unknown>, text: string): CallToolResult =>
  ({ content: [{ type: 'text', text }], structuredContent });
export const toolError = (text: string): CallToolResult =>
  ({ isError: true, content: [{ type: 'text', text }] });
export const issueLines = (issues: Issue[]): string =>
  issues.map((i) => `${i.path || '(spec)'}: ${i.message}`).join('\n');
```

### Spec input (`input.ts`)

```ts
export function readSpecInput(value: unknown): Result<unknown>;
```

An object passes through. A string goes through `JSON.parse` in a `try/catch`. A parse failure returns one issue at path `""` with the message "The spec is not valid JSON." The function never throws and never changes its argument. The tool input schema is `z.union([z.record(z.string(), z.unknown()), z.string()])` for `spec`, so an array or `null` is rejected by the MCP layer for `scaffold_app` and `preview_countdown`. For `validate_spec` the schema is `z.unknown()`, so any JSON value reaches `parseBoneSpec`, which reports it as an issue. This keeps "never throws" true for every input.

### validate_spec

```ts
export function validateSpec(spec: unknown): { valid: boolean; issues: Issue[] };
```

1. `readSpecInput(spec)`. On failure, `{ valid: false, issues }`.
2. `parseBoneSpec(value)`. `ok` gives `{ valid: true, issues: [] }`, otherwise `{ valid: false, issues: error }`.
3. The handler wraps the call in `try/catch` as a last guard that returns one issue at `""`. The tool never returns `isError`.

Output schema: `{ valid: z.boolean(), issues: z.array(z.object({ path: z.string(), message: z.string() })) }`. Text: `ok: <spec id>` or one `path: message` line per issue.

### scaffold_app

```ts
export function scaffoldApp(root: string, input: { spec: unknown; name?: string }):
  Result<{ dir: string; files: string[] }, string>;   // error is the tool error text
```

Order of checks, each one before any write:

1. `readSpecInput`, then `parseBoneSpec`. Invalid: error text is the issue lines.
2. `parseAppName(input.name ?? spec.id)`: `/^[a-z][a-z0-9-]{0,39}$/`. The spec id uses the regex `/^[a-z][a-z0-9-]*$/` with a maximum of 40 characters, so it can never contain `_`: only lowercase a-z, digits and `-` are allowed, starting with a letter. A spec id with `_` is rejected by `parseBoneSpec` as an invalid spec (issue at path `id`) before the name is checked. `parseAppName` then re-checks the defaulted name as a second guard.
3. `resolveAppDir(root, name)`: `path.resolve(root, 'apps', name)`, then require `path.dirname(target) === path.resolve(root, 'apps')` and that `apps` itself is not a symlink (`lstat` then `realpath` must equal the resolved path). The name regex already rules out separators, so this is a second guard against future change.
4. `lstat(target)` must fail with `ENOENT`. Anything else (folder, file, link) is "already exists".
5. `renderFiles(spec, name, templates)` builds the contents in memory.
6. `writeAll`: create `apps/<name>` with `mkdir` (non-recursive for the leaf, so a race with another writer fails instead of merging), then each file with the `wx` flag. On any error, remove the files written so far and the folder (only paths this call created), and return the error.

Rendering:

| File | Source |
|---|---|
| `package.json` | built from an object, `JSON.stringify(…, null, 2)`, dev dependencies copied from the warranty-wraith set |
| `bone.json` | `JSON.stringify(parsedSpec, null, 2) + '\n'` |
| `index.html` | string template: `spec.name`, description, `spec.theme?.accent ?? defaultTheme.accentInk` as `theme-color`. Text is HTML-escaped. |
| `tsconfig.json` | string template, same as the existing apps |
| `vite.config.ts` | string template with the prefix `<name>-` |
| `public/manifest.webmanifest` | `JSON.stringify` of an object, so no escaping bugs |
| `public/icon.svg` | SVG string template: a bone on the accent fill |
| `src/main.ts`, `src/spec.ts`, `src/app.ts`, `src/spec.test.ts` | read from `template/src`, copied as they are |

The four `src` files are copied without edits. Everything that depends on the spec (id, name, copy) reaches them through `bone.json`, so the template needs no placeholders, and what the template compiler checks is exactly what ships. `bone.json` in `template/` is a minimal valid spec, used only so the template typechecks.

Package name `@ossuary/<name>`; `name` is the only user-chosen string that reaches a file path, and it is limited by the regex above. Spec text (name, description, colours) is written through `JSON.stringify` or HTML escaping, never pasted into code.

Output: `{ dir: 'apps/<name>', files: [...] }`, sorted. Text:

```
Created apps/<name> (11 files). Next:
1. Add { "path": "apps/<name>" } to "references" in tsconfig.json.
2. Add "dev:<name>" and "build:<name>" scripts to package.json (vite apps/<name>).
3. Run pnpm install.
```

### preview_countdown

```ts
export function previewCountdown(input: { spec: unknown; item: unknown; now: unknown }):
  Result<Evaluation, Issue[]>;
```

1. `readSpecInput`, `parseBoneSpec`.
2. `evaluate(spec, item, now)`. The core already validates `now` (`now.day`, `now.minuteOfDay`) and the item, and returns issues with paths.
3. Failure becomes a tool error: `issueLines(issues)`.

The `now` input schema is `z.object({ day: z.string(), minuteOfDay: z.number().int().min(0).max(1439).optional() })`. The day string is checked by the engine as a real calendar day, so the tool has no date logic. The item schema is `z.record(z.string(), z.union([z.string(), z.number()]))`. Output schema mirrors `Evaluation`. Text, one line per lifespan: `Cover ends 2027-03-01, 108 days left, Steady (primary)`.

### Server (`server.ts`, `main.ts`)

```ts
export function createServer({ root }: { root: string }): McpServer {
  const server = new McpServer({ name: 'bone-forge', version: '0.0.0' });
  server.registerTool('validate_spec',     { description, inputSchema, outputSchema }, handler);
  server.registerTool('scaffold_app',      { description, inputSchema, outputSchema }, handler);
  server.registerTool('preview_countdown', { description, inputSchema, outputSchema }, handler);
  return server;
}
```

`main.ts` resolves the root from its own location (`new URL('../../..', import.meta.url)`), so the server works whatever the current directory is, and connects `StdioServerTransport`. It reads no argument and no environment variable. The only log line goes to stderr ("bone-forge ready").

`src/main.ts` of bone-forge is a Node/bun entry, not a browser file, so reading its own URL there is allowed. The clock and random rule applies to the tool functions.

### `.kiro/settings/mcp.json`

```json
{
  "mcpServers": {
    "bone-forge": {
      "command": "bun",
      "args": ["tools/bone-forge/src/main.ts"],
      "disabled": false,
      "autoApprove": ["validate_spec", "preview_countdown"]
    }
  }
}
```

`scaffold_app` is left out of `autoApprove`, so Kiro asks before files are written.

## Template and generated app

`template/tsconfig.json` extends `tsconfig.base.json`, includes `src` and `bone.json`, and references `packages/ossuary-core`. It is added to the root `tsconfig.json` references, so `tsc -b` compiles the template with the same settings as an app. A template change that breaks the core API fails `bun run typecheck`.

`app.ts` uses the same core calls as the existing apps (`openStore`, `evaluate`, `groupEntries`, `oss-shell`, `oss-list`, `oss-sheet`, `oss-trace`, `saveCalendar`, `applyTheme`, `loadDisplayFont`). It shows the list, an add sheet generated from the spec, a detail view with one card per lifespan, the trace and a calendar export, and "Done" and "Remove" actions. It takes `AppDeps` (`clock`, `newId`, `indexedDB?`, `download?`) like the existing apps, so `main.ts` is the only file that reads the clock. Titles and labels come from the spec, so the template holds no domain words.

`spec.test.ts` in each generated app checks that `bone.json` parses, that `nowFromClock` maps a fixed `Date` to the right ISO day and minute, and that one fixed sample item evaluates.

## Data models

```ts
type ValidateOutput  = { valid: boolean; issues: Issue[] };
type ScaffoldOutput  = { dir: string; files: string[] };
type PreviewInput    = { spec: object | string; item: Record<string, string | number>; now: { day: string; minuteOfDay?: number } };
type PreviewOutput   = Evaluation;   // from @ossuary/core: lifespans[] + primaryIndex
```

## Error handling

| Tool | Failure | Behaviour |
|---|---|---|
| validate_spec | Invalid spec, bad JSON text, any value | Normal result, `valid: false`, issues. Never `isError`, never throws. |
| scaffold_app | Invalid spec | Tool error with issue lines. Nothing written. |
| scaffold_app | Bad name, path outside `apps/` | Tool error naming the rule. Nothing written. |
| scaffold_app | `apps/<name>` exists | Tool error. Existing path untouched. |
| scaffold_app | Write failure | Created files removed, tool error with the system message. |
| preview_countdown | Bad spec, item or `now` | Tool error with `path: message` lines. |
| all | Unexpected exception | `try/catch` in the handler returns a tool error (`validate_spec`: one issue at `""`). The process stays up. |

The MCP layer rejects input that does not match the zod input schema before a handler runs. That is a protocol error and is outside the three tools' own results.

## Testing strategy

Tests sit next to the code. Per `tech.md`, each task writes the failing test first. Tool functions are tested directly, the server once over stdio.

- **validate_spec** (`validate-spec.test.ts`): a valid spec as object and as text, an invalid spec with a known path, bad JSON text gives one issue at `""`, `null` and arrays and numbers give `valid: false`, no `isError`. **Fuzz** (`validate-spec.fuzz.test.ts`, fast-check with a fixed seed): `fc.jsonValue()`, `fc.anything()`, arbitrary strings and mutated copies of a valid spec never throw, `valid` equals `parseBoneSpec(...).ok`, and issues are equal.
- **preview_countdown** (`preview-countdown.test.ts`): fixed `now` values, such as `2026-11-18` with and without `minuteOfDay`, an item on a threshold day and one day before, a two-lifespan spec with `primaryIndex` checked, invalid spec, item and `now` (bad day, `minuteOfDay` 1440) each give a tool error with the path, same input gives equal output, and a test under three `TZ` values.
- **scaffold_app** (`scaffold-app.test.ts`, `mkdtemp` root with an empty `apps/`): the exact file list, `bone.json` reparses equal to the parsed spec, `package.json` fields, manifest colours, `vite.config.ts` prefix, identical output for a second run in a second temporary root, existing folder, existing file and existing symlink refused and untouched, names `Bad`, `a/b`, `..`, `1x`, `-x`, an empty string and 41 characters refused, a spec id with `_` and no name refused as an invalid spec (path `id`), nothing written, invalid spec leaves the temporary root empty, path escape cases (`../x`, absolute path, nested, `apps` as a symlink to another folder) write nothing outside, a forced write failure (read-only folder) removes what was created, and a scan that no generated file contains a banned domain word.
- **template** (`template.test.ts`): the four template files exist, `app.ts` contains no domain word from the core banned list, `main.ts` is the only template file that mentions `new Date(` or `randomUUID`, and files copied by `renderFiles` equal the template files byte for byte.
- **mcp.json** (`mcp-config.test.ts`): parses, matches requirement 6.1 and 6.2, and every `autoApprove` name is a tool the server lists.
- **Integration** (`integration.test.ts`): spawn `bun tools/bone-forge/src/main.ts` with the SDK `StdioClientTransport`, connect a `Client`, list tools (exactly three, with schemas), call `validate_spec` and `preview_countdown` with the example spec, call `scaffold_app` against a temporary root through a second spawned server (root passed by the test's factory use, see below), and call `validate_spec` and `preview_countdown` with invalid input and check `isError` for the second. Because `main.ts` fixes the root to the repo, the scaffold call in the integration test targets a refusal path (invalid spec returns `isError`), and a successful scaffold is covered in-process with `createServer({ root: tmp })` over `InMemoryTransport`.
- **Gates**: `bun run test`, `bun run typecheck` (includes the template), `bun run e2e`, `bun run hook:boundary` and `bun run hook:spec`.

## Decisions and alternatives

- **Template files copied verbatim, spec-dependent values through `bone.json`.** The template compiles under `tsc -b`, so generated apps compile. Alternative: string templates with placeholders. Rejected because they are not typechecked.
- **Root passed to a factory.** Tests use a temporary directory and never touch the repo. `main.ts` fixes the root to the repo, so a client cannot ask for another root.
- **Invalid spec is a result for `validate_spec` and an error for the other two.** Validation is the question the first tool answers. The other two cannot proceed without a valid spec.
- **`preview_countdown` takes `now` as a plain value.** The engine has no `Date`, and the same input must give the same output.
- **Create-only scaffold.** It never edits root files. The next steps are returned as text. Alternative: edit `tsconfig.json` and `package.json`. Rejected because it changes files the user owns, and a bad edit is harder to undo than a printed instruction.
- **`scaffold_app` is not auto approved.** It is the only tool that writes.

## Open questions

1. The dev dependencies in the generated `package.json` are copied from `apps/warranty-wraith`. If the existing apps' lists differ, the implementation uses the union and notes it in the task.
