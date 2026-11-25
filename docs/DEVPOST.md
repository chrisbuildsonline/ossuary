# Devpost write-up: Ossuary

Every claim below names the file that backs it. `scripts/docs.test.ts` fails if a named path is missing or a
"fill in" placeholder is left. Numbers were measured on 2026-11-25 at commit ccc8cb8.

## Inspiration

Every household has a graveyard of things that quietly expired: the yogurt, the laptop warranty nobody claimed, the
return window that closed last Tuesday. Each has the same shape: an item, a start date, a lifespan, a few warning
thresholds and a moment it dies. People rebuild this tracker from scratch every time, or live in a spreadsheet. The
Skeleton Crew category asks for a lean template proven by two distinct apps, and this problem fits it.

## What it does

Ossuary is a skeleton: a lifespan engine, a local-first store, a crypt-themed web-component UI and a calendar export,
all driven by one declarative bone spec per app (`packages/ossuary-core`). Two apps prove it:

- **Pantry Reaper** (`apps/pantry-reaper`) tracks food. It maps 640 foods from the public USDA FoodKeeper data
  (`apps/pantry-reaper/SOURCE.md`, CC0) to a shelf life per storage method, counts down to spoilage, and explains each
  date with a trace of the rule that set it. Move buttermilk from the fridge to the freezer and the date jumps 83 days
  (`apps/pantry-reaper/e2e/demo.spec.ts`).
- **Warranty Wraith** (`apps/warranty-wraith`) tracks purchases: the return window and the warranty, side by side. It
  checks each purchase against 264 US CPSC recall notices bundled offline (`apps/warranty-wraith/SOURCE.md`,
  public domain), and a **Claim reminder** button saves a calendar event on the warranty's last day, with alarms 90, 30
  and 7 days before and a ready-to-send claim message (item, model, shop, day, price, end of warranty) in the event
  text (`apps/warranty-wraith/src/claim.ts`, `.kiro/specs/claim-reminder/requirements.md`).

Both apps export calendar files, keep everything in IndexedDB on the device, work offline as installable PWAs, and fetch
nothing over the network at run time (`apps/warranty-wraith/e2e/offline.spec.ts`). Neither uses AI at run time.

## How we built it

We started with a Kiro spec for the skeleton contract (`.kiro/specs/skeleton-contract/requirements.md`): the bone spec
schema, a pure TypeScript lifespan engine, an IndexedDB store, web-component UI elements and a hand-written iCalendar
exporter (`packages/ossuary-core/src/ics/export-ics.ts`). Each app then got its own small spec
(`.kiro/specs/app-pantry-reaper/tasks.md`, `.kiro/specs/app-warranty-wraith/tasks.md`) that lists only its bone spec,
data mapping and screens. An app is a bone spec (`apps/warranty-wraith/bone.json`), a mapper for its public dataset
and about 700 to 950 lines of app glue; the core is about 5,300 lines and has no food or warranty words in it (`scripts/domain-words.json`,
`scripts/check-boundary.ts`).

A custom MCP server, bone-forge (`tools/bone-forge`, registered in `.kiro/settings/mcp.json`), validates a spec,
scaffolds a new app folder from it and previews countdowns. Three Kiro hooks run on save: engine tests when core
files change, the core boundary check, and bone spec validation (`.kiro/hooks/engine-tests.kiro.hook`,
`.kiro/hooks/core-boundary.kiro.hook`, `.kiro/hooks/bone-spec.kiro.hook`). Steering files hold the rules every session
follows (`.kiro/steering/product.md`, `.kiro/steering/tech.md`, `.kiro/steering/structure.md`).

The date math is deterministic and covered by property tests (`packages/ossuary-core/src/engine/properties.test.ts`), so
no language model touches a number. Measured: `bun run build` builds the launcher and both apps in 1.2 to 1.5 (three runs) s; the
built JavaScript is 81.5 kB gzipped for Pantry Reaper (food table included) and 102.9 kB for Warranty
Wraith (recall table included).

## Challenges

The hard part was deciding what belongs in the skeleton and what in the app. Domain rules became generic rule types
in the bone spec (`extend`, `shorten`, `clamp`, each optionally conditional on a field, in
`packages/ossuary-core/src/engine/rules.ts`). Two guardrails keep it that way: the core boundary hook fails if the core
imports an app or picks up a domain word (`scripts/check-boundary.ts`), and each app's boundary test fails if it
imports the core other than through its public exports (`apps/warranty-wraith/src/boundaries.test.ts`). Mapping messy public data was the other one: FoodKeeper mixes ranges,
units and "Package use-by date" text, so the mapper converts what it can and skips the rest with a reason (plain milk
has no fridge number there, which is why the demo uses buttermilk, `docs/DEMO.md`).

Measured test counts from one full `bun run test` run: 1,142 unit and property tests in 107 files, all passing, plus
the core suite run again under 3 time zones (UTC, America/New_York, Pacific/Auckland; 759 tests each). `bun run e2e`
adds 96 Playwright end-to-end tests that drive both apps, the launcher and the component gallery in a real browser,
including the demo script in `docs/DEMO.md`.

## Accomplishments

Two different apps on one core, differing in spec, data and screens rather than date logic. Every countdown can be
explained by a plain-language trace of which rule set which date (`packages/ossuary-core/src/engine/trace.ts`). A third
app takes one call: bone-forge's `scaffold_app` wrote the 11 files of a library-loan app from the spec in
`docs/REMIX.md` in 16 to 25 ms (the bun one-liner in that guide, which calls the same handler as the MCP tool);
wiring it in is three listed steps. The crypt UI is functional: candles burn down as time runs out and dead items turn
ghostly, always paired with text.

## What we learned

Writing the skeleton contract as a Kiro spec before any code forced us to name the seams, and that made the second app
cheap. Steering is the right place for the rule that the core stays domain-free, and hooks are most useful as
guardrails. Deterministic code plus a clear explanation trace is easier to trust for dates than a generated answer.

## What's next

Publish the skeleton as a template repository, a gallery of shared bone specs (pet vaccinations, certificate renewals,
library loans), encrypted backups (today's backup file is plain JSON), and opt-in reminders through the browser's
notification APIs.

## Data sources

USDA FSIS FoodKeeper (CC0) and the US CPSC Recalls API (public domain, US government work). Both snapshots are committed
with their retrieval day (`apps/pantry-reaper/SOURCE.md`, `apps/warranty-wraith/SOURCE.md`).
