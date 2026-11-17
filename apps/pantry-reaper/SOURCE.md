# Data source

Pantry Reaper's shelf-life numbers come from the **USDA FoodKeeper** dataset, published by the USDA Food Safety and Inspection Service (FSIS).

- Dataset: FSIS FoodKeeper Data (file name in the snapshot: `FMA-Data-v128.xlsx`)
- Official URL: https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json
- Downloaded from: https://web.archive.org/web/20250314020622id_/https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json
- Catalog page: https://catalog.data.gov/dataset/fsis-foodkeeper-data
- Retrieved: 2026-11-17
- Committed as: `data/foodkeeper.raw.json` (631,800 bytes, 661 rows in the `Product` sheet)

The official FSIS host returned HTTP 403 to the download, so the bytes come from the Internet Archive copy of the same file. `bone.json` cites the official URL.

## Licence

Public domain: a work of the US government, with no restrictions on use. The data.gov catalog lists it under Creative Commons Zero (CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/).

## How it is used

The snapshot is downloaded once and committed. Nothing in the repo fetches it at build time, test time or runtime. `bun run data:pantry` maps it to `src/data/foods.json`, using the shortest time in each FoodKeeper range.

The app gives guidance, not a safety guarantee. Check the food, and when in doubt, throw it out.
