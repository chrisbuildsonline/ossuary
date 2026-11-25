# Demo script (under 3 minutes)

Every app step below runs on the shipped data and is walked end to end by a Playwright test:
`apps/pantry-reaper/e2e/demo.spec.ts` and `apps/warranty-wraith/e2e/demo.spec.ts` (`bun run e2e`).
Record it in a fresh browser profile, so each app opens with its first-visit sample items.

**0:00-0:15**: The launcher in the crypt theme, then Pantry Reaper on its first visit: the sample kitchen, with
candles burning down and a spoiled item gone ghostly.
> Everything we own is quietly dying: food, warranties, renewals. Meet Ossuary, a skeleton for anything that expires.

**0:15-0:40**: The repo tree: `packages/ossuary-core`, `apps/pantry-reaper`, `apps/warranty-wraith`, and `.kiro/` at the root.
> One small core, two app folders, and the whole project steered by Kiro specs, hooks and steering.

**0:40-1:10**: `apps/pantry-reaper/bone.json`: fields, the storage rule, the warning stages, the theme.
> An app is just a bone spec. Items have a storage method, the shelf life comes from USDA FoodKeeper, and warnings fire in stages.

**1:10-1:50**: Pantry Reaper: search "buttermilk", save it (Fridge is preselected), open it, switch Fridge to Freezer.
The date jumps 83 days and the toast says "Moved to freezer: +83 days". The "why this date" trace names the storage rule
and USDA FoodKeeper.
> Move buttermilk to the freezer and the deterministic engine extends the date, then shows exactly which rule did it. No model guesses a number.

Why buttermilk and not milk: FoodKeeper gives plain milk ("Milk, plain or flavored", ID 27) no fridge number, only
"Package use-by date", so the app maps milk to the freezer only. Buttermilk (ID 2) has both: 1-2 weeks in the fridge
(7 days, the low end) and 3 months in the freezer (90 days). Both rows are in `apps/pantry-reaper/data/foodkeeper.raw.json`.

**1:50-2:20**: Warranty Wraith: Add purchase, item "DREO space heater", bought at "Corner shop", bought on a day a few
weeks back. The home line shows a possible recall; open the purchase. The banner quotes CPSC recall 27054 and its
hazard. Click "Add to calendar" (return window and warranty), then "Claim reminder": a calendar file with one event on
the warranty's last day, alarms 90, 30 and 7 days before, and a ready-to-send claim note to paste into an email.
> Different domain, same skeleton. Warranty Wraith counts down the return window and the warranty, checks public CPSC recall data, and puts a claim reminder in your calendar before the warranty dies.

**2:20-2:45**: In Kiro, ask the bone-forge MCP to validate and scaffold a third app (the prompt in `docs/REMIX.md`);
the new folder appears and `bun run hook:spec` passes. This step needs Kiro, so it is checked by the bone-forge tests
in `tools/bone-forge/src`, not by the Playwright demo tests.
> Need a third app? Ask Kiro. The bone-forge MCP scaffolds it from a spec, and the boundary hook keeps the core clean.

**2:45-2:58**: Both apps side by side, repo link on screen.
> Ossuary: one skeleton, two apps, endless things to keep alive. Fork it and remix.
