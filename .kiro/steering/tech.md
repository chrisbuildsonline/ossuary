---
inclusion: always
---

# Tech

## Stack

- TypeScript, Vite, web components (no heavy framework)
- IndexedDB via `idb`
- `zod` for the bone spec schema
- `vitest` and `fast-check` for deterministic property tests of the lifespan engine
- Playwright for end-to-end UI tests
- Calendar export (ICS) hand-written in core, no dependency
- bone-forge built on the MCP TypeScript SDK
- Static hosting
- pnpm workspaces monorepo
- License: MIT

## Engineering rules

- **Pure engine:** the lifespan engine is pure and deterministic. Time is passed in as an argument. Never call `Date.now()` or `new Date()` without arguments inside it.
- **Tests first:** write a failing test, then the code. Keep the whole suite green before moving on to the next task.
- **Local-first:** no accounts, no server calls after load. Data lives in IndexedDB.
- **Validate at boundaries:** parse bone specs and imported data with zod. Don't trust unvalidated input.
- **No domain words in core:** never put food, warranty or similar terms in `packages/ossuary-core`. Domain data belongs in the apps.
- **Dependencies:** keep them minimal. Don't add a UI framework.

## UI

Follow `design/DESIGN.md`: soft neutral canvas, floating white cards, one accent color, near-black pill primary action, tinted status pills. Must be accessible (contrast, keyboard use, labels, reduced motion).
