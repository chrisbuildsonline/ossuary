# Ossuary

One skeleton for anything that expires: describe a lifespan in one JSON spec and get a local-first countdown app, proven by two apps built on it.

Built for [Kiroween 2026](https://kiroween.devpost.com/). Submissions close 2026-12-04.

## What it does

Ossuary is a skeleton: a lifespan engine, a local-first store, a crypt-themed UI shell and an export layer, all driven by one declarative bone spec per app. We prove it with two distinct apps. Pantry Reaper tracks food and groceries, using public USDA FoodKeeper storage guidance to suggest shelf life per item and storage method, then counts down to spoilage with ghostly fading cards. Warranty Wraith tracks warranties, subscriptions and renewal paperwork, checks products against public product-recall data, and turns an expiring warranty into a ready-to-send claim reminder. Both export calendar files, work offline, and share zero app-specific code in the core.

## Stack

TypeScript, Vite, web components (no heavy framework), IndexedDB via idb, zod for the bone spec schema, vitest and fast-check for deterministic engine tests, ics for calendar export, a small Node MCP server (bone-forge) using the MCP TypeScript SDK, static hosting. Monorepo with pnpm workspaces: packages/ossuary-core, apps/pantry-reaper, apps/warranty-wraith, tools/bone-forge. OSI license: MIT.

## License

MIT, see LICENSE.
