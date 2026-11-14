---
inclusion: always
---

# Structure

pnpm workspaces monorepo.

```
packages/ossuary-core/   schema (zod), lifespan engine, store, UI primitives, theme tokens
apps/pantry-reaper/      bone spec + USDA FoodKeeper mapping data
apps/warranty-wraith/    bone spec + recall data snapshot
tools/bone-forge/        MCP server that scaffolds an app from a bone spec
design/DESIGN.md         UI design system
.kiro/steering/          steering files
```

## Boundaries

- `ossuary-core` has no domain knowledge and no dependency on any app or tool.
- Apps depend on `ossuary-core`. They never depend on each other.
- An app is its bone spec plus thin domain data and glue. Shared behavior moves into core, expressed generically.
- `bone-forge` generates apps with the same layout as the existing two.

## Conventions

- Tests live next to the code they cover. Playwright end-to-end tests live in each app.
- Engine tests are property-based (fast-check) with fixed time inputs.
- Keep modules small and single-purpose.
