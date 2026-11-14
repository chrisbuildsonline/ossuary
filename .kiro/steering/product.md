---
inclusion: always
---

# Product

Ossuary is an entry for Kiroween 2026, category **Skeleton Crew**: a reusable skeleton code template, proven by two distinct apps built on it.

**Pitch:** One skeleton for anything that expires. Describe a lifespan in one JSON spec (a "bone spec") and get a local-first countdown app.

## Components

- **ossuary-core**: the skeleton. Bone spec schema, lifespan engine, local store, UI primitives, theme tokens. No domain knowledge.
- **Pantry Reaper**: food expiry. Uses a USDA FoodKeeper shelf-life mapping to suggest shelf life per item and storage method.
- **Warranty Wraith**: product warranties and returns windows. Uses a recall data snapshot.
- **bone-forge**: a small MCP server that scaffolds a new app from a bone spec.

## Principles

- Every app is defined by its bone spec plus thin domain data. If an app needs more, the core is missing something.
- Local-first: no accounts, no network needed after the page loads.
- Calendar export (ICS) turns any countdown into a reminder.
- The two apps must stay genuinely different. They prove the skeleton is reusable, not a food app with a second skin.

## Rules

- The core must never contain app-specific domain words (food, warranty, and similar).
- License: MIT.
