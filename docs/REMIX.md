# Make a third app in 10 minutes

Every Ossuary app is a bone spec (`bone.json`) plus four generic source files. This guide makes
**Library Lich**, a library-loan tracker, from a clean checkout. Swap in your own spec and name.

You need bun and the installed workspace (`bunx pnpm@10 install`). Run every command from the repo root.

## 1. Write the spec (5 minutes)

Save this as `library-lich.json` in the repo root. Any path works; this one keeps the commands short.

```json
{
  "id": "library-lich",
  "name": "Library Lich",
  "version": 1,
  "entity": {
    "titleField": "title",
    "summaryFields": ["library"],
    "fields": [
      { "key": "title", "kind": "text", "label": "Book", "required": true },
      { "key": "library", "kind": "text", "label": "Library" },
      { "key": "borrowed", "kind": "date", "label": "Borrowed on", "required": true },
      { "key": "loan_days", "kind": "number", "label": "Loan (days)", "min": 1, "max": 90, "step": 1 }
    ]
  },
  "lifespans": [
    {
      "id": "loan",
      "label": "Loan",
      "startField": "borrowed",
      "base": { "type": "duration", "amount": 21, "unit": "day", "amountField": "loan_days", "label": "Loan period" },
      "stages": [
        { "id": "borrowed", "label": "On loan", "tone": "fresh" },
        { "id": "due_soon", "label": "Due soon", "tone": "soon", "enterAtDays": 3 },
        { "id": "due_today", "label": "Due today", "tone": "urgent", "enterAtDays": 0 },
        { "id": "overdue", "label": "Overdue", "tone": "dead" }
      ]
    }
  ],
  "theme": { "motif": "hourglass", "wordmark": "Library Lich" },
  "copy": { "emptyTitle": "No books haunting you yet.", "addLabel": "Add book" }
}
```

Rules that trip people up:

- The spec `id` is also the folder name. Use `a` to `z`, digits and `-`, starting with a letter, at most 40 characters.
  No `_` in the spec id. Field, lifespan, stage and rule ids are the other way round: `a` to `z`, digits and `_`.
- Stages run from the first (no `enterAtDays`) to the last, which must have tone `dead`. The ones in between
  have `enterAtDays` that go down.
- A theme accent must reach 4.5:1 on white and on the canvas. Leave `theme` colours out and you get the core
  slate blue.

Check it:

```sh
bun run hook:spec library-lich.json
```

It prints `ok library-lich.json`, or one `path: message` line per problem.

## 2a. Scaffold with bone-forge (1 minute)

**In Kiro.** `.kiro/settings/mcp.json` already registers the bone-forge MCP server. Ask in chat:

> Read library-lich.json, call the bone-forge tool validate_spec with it, then scaffold_app with it.

Kiro asks before it runs `scaffold_app`, because that tool writes files. The same thing from the terminal:

```sh
kiro-cli chat --no-interactive --trust-tools=fs_read,@bone-forge \
  "Read library-lich.json. Call the bone-forge MCP tool validate_spec with it, then the bone-forge MCP tool scaffold_app with it. Do not edit or create any file yourself."
```

**Without Kiro.** This calls the same handler that the MCP tool runs:

```sh
bun -e "import { scaffoldAppTool } from './tools/bone-forge/src/tools/scaffold-app.ts'; import { repoRoot } from './tools/bone-forge/src/root.ts'; const r = scaffoldAppTool(repoRoot, { spec: await Bun.file('library-lich.json').text() }); console.log(r.content[0].text); process.exit(r.isError ? 1 : 0)"
```

Either way you get:

```
Created apps/library-lich (11 files). Next:
1. Add { "path": "apps/library-lich" } to "references" in tsconfig.json.
2. Add "dev:library-lich" and "build:library-lich" scripts to package.json (vite apps/library-lich).
3. Run pnpm install.
```

`scaffold_app` never overwrites. If `apps/library-lich` exists, it refuses and writes nothing.

## 2b. Or by hand (3 minutes)

These are the same files the scaffold writes, minus the manifest and icon:

```sh
mkdir -p apps/library-lich/src
cp tools/bone-forge/template/src/main.ts tools/bone-forge/template/src/spec.ts \
   tools/bone-forge/template/src/app.ts tools/bone-forge/template/src/spec.test.ts apps/library-lich/src/
cp library-lich.json apps/library-lich/bone.json
```

Don't copy `template/src/app.test.ts`. It tests the template's own placeholder spec.

`apps/library-lich/package.json`:

```json
{
  "name": "@ossuary/library-lich",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "dependencies": { "@ossuary/core": "workspace:*" },
  "devDependencies": {
    "@types/node": "^26.6.6",
    "fake-indexeddb": "^6.2.8",
    "fast-check": "^4.10.2",
    "happy-dom": "^21.0.4",
    "ical.js": "^2.2.1",
    "zod": "^4.6.7"
  }
}
```

`apps/library-lich/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "rootDir": ".",
    "outDir": "node_modules/.tmp/tsc"
  },
  "include": ["src", "bone.json", "vite.config.ts"],
  "references": [{ "path": "../../packages/ossuary-core" }]
}
```

`apps/library-lich/vite.config.ts`. The prefix names the offline cache:

```ts
import { ossuaryPwa } from '@ossuary/core/pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [ossuaryPwa({ prefix: 'library-lich-' })],
});
```

`apps/library-lich/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Library Lich</title>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

## 3. Wire it in (2 minutes)

In the root `tsconfig.json`, add to `references`:

```json
{ "path": "apps/library-lich" },
```

In the root `package.json`, add to `scripts`. Ports 5173, 5174 and 5180 are taken:

```json
"dev:library-lich": "vite apps/library-lich --port 5175 --strictPort",
"build:library-lich": "vite build apps/library-lich",
```

Then link the new workspace package:

```sh
bunx pnpm@10 install
```

## 4. Run and check it

```sh
bun run dev:library-lich            # http://localhost:5175
bun run test:one apps/library-lich  # the generated spec test: 3 passing
bun run hook:spec                   # ok apps/library-lich/bone.json, and the other two
bun run typecheck
bun run build:library-lich          # apps/library-lich/dist with sw.js, works offline
```

The app has a list grouped by stage, an add and edit sheet built from your fields, a detail view with one card
per lifespan and the "why this date" trace, calendar export, CSV import, and JSON backup and restore. All of it
comes from the core, so the new app holds no logic of its own.

## Where to go next

- **Suggest durations from data.** Pantry Reaper fills the shelf life from a USDA FoodKeeper snapshot through a
  `lookup` rule. Warranty Wraith matches CPSC recalls. Both keep their data and its `SOURCE.md` in the app folder,
  never in the core.
- **Rules.** `extend`, `shorten`, `clamp` and `lookup` change a base duration, optionally `when` a field equals a
  value. A `base` can also be `{ "type": "field", "field": "<a date field>" }` for a fixed end date.
- **Theme.** `accent`, `accentInk`, `accentTint`, `canvas`, `display` (`inter`, `fraunces`, `space-grotesk`),
  `motif` (`hourglass`, `candle`, `ghost`), `emptyArt` and `wordmark`. The schema rejects colours that fail contrast.
- **The full schema** is `packages/ossuary-core/bone-spec.schema.json`. Point your editor's JSON schema setting
  at it for completion in `bone.json`.
