# Design: claim-reminder

## Overview

One generic option in core, one pure function and one button in Warranty Wraith. No new dependency.

```
packages/ossuary-core/src/ics/export-ics.ts   describe option
apps/warranty-wraith/src/claim.ts             claimNote
apps/warranty-wraith/src/app.ts               Claim reminder button and download
apps/warranty-wraith/e2e/demo.spec.ts         claim step
docs/DEMO.md, Devpost write-up                description of the feature
```

## Components and interfaces

- **`exportIcs`**: `opts` gains `describe?: (entry: IcsEntry, lifespan: LifespanEvaluation) => string | undefined`. After the event is built, the writer calls it once per lifespan. A non-empty result becomes `DESCRIPTION:<escaped text>`, written through the existing folding code. Escaping covers backslash, semicolon, comma and newline (`\n`). Otherwise nothing is added, so the output stays byte-identical.
- **`claimNote(values: Item, warrantyEnds: string): string`**: builds lines and joins them with `\n`. Optional lines (model, price) are added only when the value is non-empty. A private `formatDay('YYYY-MM-DD')` splits the string and looks up the month name in a fixed English list. It does not use `Date`.
- **Claim button**: rendered in the detail only when the warranty lifespan's stage is not the dead stage. On click, the app builds a copy of the spec that keeps only the warranty lifespan, and one entry whose title field is `Warranty claim: <item>`. It calls `exportIcs` with `describe: () => claimNote(originalValues, expiresAt)`, then `downloadText('warranty-wraith-claim.ics', ics, 'text/calendar')`, then shows the toast `Claim reminder saved`. Stage alarms come from the core as they do for `Add to calendar`.

## Data models

No new stored data. `claimNote` reads the existing purchase fields (name, model, price, store, bought on) and the warranty expiry day from the engine.

## Error handling

`claimNote` never throws on missing fields. A date that is not `YYYY-MM-DD` is written as given. If `exportIcs` skips the entry, the app shows no success toast.

## Testing strategy

- Core: a unit test passes `describe` with commas, semicolons, a newline and a long line, and reads `DESCRIPTION` back with ical.js. A second test shows output without `describe`, and with a callback that returns `''` or `undefined`, is equal to the output today.
- `claim.test.ts`: all fields present, optional fields missing, a day with no zero padding (`2026-11-05` gives `5 November 2026`), and no `undefined` in the text.
- `app.test.ts`: the button is shown while the warranty runs, hidden when it has lapsed, and the downloaded file has one event, the summary, three alarms and the description.
- Demo e2e: opens a purchase, clicks `Claim reminder`, reads the download and checks the description.

## Decisions and alternatives

- **A `describe` callback** rather than a `description` field in the spec, so the core stays free of wording and the text can use the whole item.
- **Title field override** for the summary, rather than a second core option, so the core API grows by one option only.
- **A fixed month list** rather than `Intl` or `Date`, so the day cannot shift with the time zone.
