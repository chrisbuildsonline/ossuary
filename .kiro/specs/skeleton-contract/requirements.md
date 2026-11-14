# Requirements: skeleton contract (`packages/ossuary-core`)

## Introduction

`ossuary-core` is the skeleton. An app is one bone spec (JSON) plus thin domain data. This spec fixes the contract between the core and any app: the bone spec schema, the lifespan engine, the local store, ICS export and the UI primitives.

The core never contains domain words (food, warranty, recall, pantry and similar). Examples inside core tests and the gallery use neutral fixtures (for example "widget" and "gizmo").

Terms:

- **Bone spec**: the declarative JSON document that defines one app.
- **Item**: one user record. A flat map of field key to value, validated against the spec's entity fields.
- **ISO day**: a calendar day string `YYYY-MM-DD`. No time zone, no time of day.
- **Tone slot**: one of `fresh`, `steady`, `soon`, `urgent`, `dead` (DESIGN.md section 3). The core owns the colours of the slots.
- **Lifespan**: one named countdown in a bone spec (`id`, `label`, start field, base, its own ordered rules and its own stages). A spec declares one or more. A spec with one lifespan is the common case.
- **Stage**: a spec-named warning stage of one lifespan, mapped to one tone slot.
- **Primary lifespan**: the live lifespan (`remaining.days` of 0 or more) of an item with the fewest days remaining, ties broken by declared order. Only when every lifespan has expired is it the one that expired last (greatest `remaining.days`), ties broken by declared order. Its stage drives the item's stage pill and list grouping.
- **Trace**: the plain-language lines that explain how one lifespan's expiry day was computed.

## Requirement 1: Bone spec schema

**User story:** As an app author, I want to describe a lifespan in one JSON spec and get clear errors when it is wrong, so that I can build an app without reading the core's source.

### Acceptance criteria

1.1 WHEN a candidate value is passed to `parseBoneSpec` THE SYSTEM SHALL return `{ ok: true, spec }` or `{ ok: false, issues }` and SHALL NOT throw for any input, including `null`, arrays, random JSON and non-objects.

1.2 WHEN a spec declares entity fields THE SYSTEM SHALL accept only the kinds `text`, `date`, `enum` and `number`, each with a unique `key` (a lowercase identifier), a `label` and an optional `required` flag.

1.3 WHERE a field has kind `enum` THE SYSTEM SHALL require one or more unique options, each with a `value` and a `label`.

1.4 WHERE a field has kind `number` THE SYSTEM SHALL accept optional `min`, `max` and `step`, and IF `min` is greater than `max` THEN THE SYSTEM SHALL return an issue at that field's path.

1.5 WHEN a lifespan declares its base THE SYSTEM SHALL accept exactly one of a duration (`amount` as a non-negative integer, `unit` one of `day`, `week`, `month`, `year`) or a reference to a `date` field, and SHALL require the lifespan to have a `startField` that references a `date` field.

1.6 WHEN a lifespan declares rules THE SYSTEM SHALL accept the kinds `extend`, `shorten`, `clamp` and `lookup`, SHALL accept a lifespan with no rules, and SHALL preserve the declared order in the parsed spec. Rule ids SHALL be unique within their lifespan.

1.7 WHERE a rule is `extend` or `shorten` THE SYSTEM SHALL require a positive duration and accept an optional `when` condition of the form `{ field, equals }`.

1.8 WHERE a rule is `clamp` THE SYSTEM SHALL require at least one of `min` or `max` as durations measured from that lifespan's start day, and IF `min` is longer than `max` THEN THE SYSTEM SHALL return an issue at that rule's path.

1.9 WHERE a rule is `lookup` THE SYSTEM SHALL require a `field` of kind `enum` or `text`, a `table` mapping field values to durations and an optional `default` duration. IF the field is an `enum` and an option has no table entry and there is no `default`, or a table key is not an option, THEN THE SYSTEM SHALL return an issue naming that option.

1.10 IF a rule, `when` condition, base or `startField` references a field key that does not exist, or a field of the wrong kind, THEN THE SYSTEM SHALL return an issue whose path points at the reference (for example `lifespans[1].rules[0].when.field`) and whose message names the key.

1.11 WHEN a lifespan declares stages THE SYSTEM SHALL require, within that lifespan, unique stage ids, a `label`, and a `tone` from the five tone slots. The first stage SHALL have no threshold, each middle stage SHALL have an integer `enterAtDays` of 0 or more that is strictly lower than the stage before it, and the last stage SHALL be the only `dead` stage and SHALL have no threshold.

1.12 WHEN a spec declares `theme` THE SYSTEM SHALL accept only the keys `accent`, `accentInk`, `accentTint`, `canvas`, `display`, `motif`, `emptyArt` and `wordmark`, and SHALL reject every other key, including text colours, radius, spacing, shadow, type scale and motion.

1.13 WHERE `theme` sets a colour THE SYSTEM SHALL require the form `#rrggbb`. WHERE `display` is set it SHALL be one of `inter`, `fraunces`, `space-grotesk`, `motif` one of `hourglass`, `candle`, `ghost`, and `emptyArt` one of `hourglass-side`, `candle-jar-moon`, `ghost-parcel`.

1.14 IF `theme.accent` has a WCAG 2.x contrast ratio below 4.5:1 against white, or against the effective canvas (`theme.canvas` or the core default `#eef0f4`), THEN THE SYSTEM SHALL return an issue at `theme.accent` that states the measured ratio and the 4.5:1 minimum.

1.15 IF `theme.canvas` has a relative luminance outside 0.84 to 0.89 inclusive THEN THE SYSTEM SHALL return an issue at `theme.canvas` that states the measured luminance and the allowed range.

1.16 IF `theme.accentInk` on `theme.accentTint` has a contrast ratio below 4.5:1 THEN THE SYSTEM SHALL return an issue at `theme.accentInk`.

1.17 WHEN a spec declares `sources` THE SYSTEM SHALL require each source to have a unique `id`, a `name`, an `https` `url` and a `license`, and accept an optional `retrievedOn` ISO day. WHERE a base or rule has a `sourceId` THE SYSTEM SHALL require it to match a declared source.

1.18 WHEN a spec declares an entity `titleField` and optional `summaryFields` (at most three) THE SYSTEM SHALL require each to reference an existing field.

1.19 IF a spec exceeds 40 fields, 4 lifespans, 50 rules in total across its lifespans, or 8 stages in any one lifespan, or contains an unknown key anywhere except inside `table` THEN THE SYSTEM SHALL return an issue at that path.

1.20 WHEN parsing fails THE SYSTEM SHALL return issues of the form `{ path, message }`, where `path` is a readable string such as `lifespans[0].rules[2].when.field` and `message` is plain English with no library internals, and SHALL return at most 50 issues.

1.21 WHEN the package is built THE SYSTEM SHALL export a JSON Schema for the bone spec, and a test SHALL fail IF the checked-in `bone-spec.schema.json` differs from the generated one.

1.22 WHEN `fast-check` generates arbitrary JSON values and arbitrary mutations of a valid spec THE SYSTEM SHALL return a result without throwing, and every `ok: true` result SHALL pass a second `parseBoneSpec` call unchanged.

1.23 WHEN a spec declares `lifespans` THE SYSTEM SHALL require an array of one to four lifespans, each with a unique `id` (a lowercase identifier), a `label`, a `startField`, a base, optional `rules` and its own `stages`, and SHALL preserve the declared order, which sets the tie-break for the primary lifespan. IF `lifespans` is missing, empty or not an array THEN THE SYSTEM SHALL return an issue at `lifespans`.

## Requirement 2: Lifespan engine

**User story:** As an app author, I want the expiry date, the remaining time and the stage computed the same way every time, so that I can trust the countdown and explain it.

### Acceptance criteria

2.1 WHEN `evaluate(spec, item, now)` is called with a valid item THE SYSTEM SHALL return `{ ok: true, result }` where `result` holds `lifespans` (one evaluation per declared lifespan, in declared order) and `primaryIndex` (the index of the primary lifespan). Each lifespan evaluation holds `lifespanId`, `label`, `startedAt`, `expiresAt` (ISO days), `remaining` (`days`, plus `hours` when `days` is 0), `fraction` (0 to 1), `stage` (id, label, tone, index) and `trace` (ordered lines).

2.2 THE SYSTEM SHALL take `now` as an argument (an ISO day, with an optional `minuteOfDay` from 0 to 1439) and SHALL NOT read the clock, the time zone or the locale anywhere in the engine.

2.3 WHEN the same `(spec, item, now)` is evaluated twice THE SYSTEM SHALL return deeply equal results, and SHALL NOT mutate any argument.

2.4 THE SYSTEM SHALL compute with ISO calendar days converted to integer day numbers, so that the result is identical under any `TZ` setting and across daylight saving transitions.

2.5 WHERE a lifespan's base is a duration THE SYSTEM SHALL set its expiry day to its start day plus that duration. WHERE the base is a date field THE SYSTEM SHALL set its expiry day to that field's value.

2.6 WHEN a duration is added in `month` or `year` units THE SYSTEM SHALL use calendar arithmetic and, IF the target month is shorter, SHALL use that month's last day.

2.7 WHEN rules apply THE SYSTEM SHALL run the rules of each lifespan in that lifespan's declared order, and a rule SHALL NOT affect any other lifespan. `extend` SHALL move the expiry later, `shorten` SHALL move it earlier but not before the start day, `clamp` SHALL move it into the range `[start + min, start + max]`, and `lookup` SHALL set the expiry to the start day plus the table duration for the item's field value (or the `default`).

2.8 WHERE a rule has a `when` condition THE SYSTEM SHALL apply the rule only IF the item's field value equals the condition, and SHALL skip it silently otherwise.

2.9 WHEN a rule applies THE SYSTEM SHALL add one trace line with the rule id, the kind, a plain-language sentence, the signed change in days and a `changed` flag. A `clamp` that leaves the expiry unchanged SHALL still add a line that says "no change". WHERE the rule or base has a `sourceId` THE SYSTEM SHALL name the source in the line.

2.10 THE SYSTEM SHALL compute each lifespan's `remaining.days` as its expiry day number minus the `now` day number, so 0 means "today" and a negative number means days past expiry.

2.11 THE SYSTEM SHALL select each lifespan's stage from that lifespan's own stages: the stage whose threshold is the lowest one that is still greater than or equal to `remaining.days`, and the `dead` stage only WHEN `remaining.days` is below 0. At a threshold of N days the item SHALL be in the stage that declares N, and at N + 1 days it SHALL be in the stage before it.

2.12 THE SYSTEM SHALL compute each lifespan's `fraction` as `clamp((expiresAt - now) / (expiresAt - startedAt), 0, 1)` in days, and SHALL return 0 WHEN `expiresAt` equals `startedAt`.

2.13 IF a required field is missing, a value has the wrong kind, an ISO day is not a real calendar day (including any lifespan's start field or date base), or an `enum` value is not an option THEN THE SYSTEM SHALL return `{ ok: false, issues }` with a path for each problem and SHALL NOT throw. The item SHALL be validated once, and no lifespan evaluation SHALL be returned for an invalid item.

2.14 WHEN fast-check runs with fixed seeds and fixed `now` values THE SYSTEM SHALL hold these properties for every lifespan of every generated spec: `remaining.days` does not increase as `now` increases; the stage index does not decrease as `now` increases; adding an `extend` rule never moves `expiresAt` earlier; WHERE a `clamp` is the last applied rule, `expiresAt` lies within its bounds; stage boundaries are exact at every declared threshold; and results are equal under `TZ` set to `UTC`, `America/New_York` and `Pacific/Auckland`. Adding or changing the rules of one lifespan SHALL leave the evaluation of the other lifespans unchanged.

2.15 THE SYSTEM SHALL choose the primary lifespan as the live lifespan (`remaining.days` of 0 or more) with the lowest `remaining.days`, and WHEN two or more live lifespans have the same `remaining.days` SHALL choose the one declared first. A lifespan in its `dead` stage has negative `remaining.days` and SHALL NOT be chosen while any lifespan is live, so a lapsed lifespan never makes a still-valid one look dead. WHEN every lifespan has expired THE SYSTEM SHALL choose the one that expired last (greatest `remaining.days`), and on a tie the one declared first. Expired lifespans that are not primary still appear on the card per 5.24, with their dead stage text.

2.16 WHEN a spec has one lifespan THE SYSTEM SHALL return `lifespans` with one entry and `primaryIndex` 0. WHEN fast-check runs with fixed seeds THE SYSTEM SHALL hold these properties: `lifespans` has the same length and order as the spec's lifespans; IF any lifespan is live THEN the primary is live; WHERE the primary is live its `remaining.days` is less than or equal to that of every other live lifespan; WHERE every lifespan has expired the primary's `remaining.days` is greater than or equal to every other lifespan's; and no earlier lifespan has the same `remaining.days` as the primary among the candidates of the same kind (live, or all expired).

## Requirement 3: Local store

**User story:** As a user, I want my items kept on my device and easy to back up and bring in, so that the app works without an account or a network.

### Acceptance criteria

3.1 THE SYSTEM SHALL store items in IndexedDB through `idb`, in one database per app namespace (`ossuary:<appId>`), so that two apps on one origin never see each other's items.

3.2 WHEN `create`, `get`, `list`, `update` and `remove` are called THE SYSTEM SHALL perform the operation on that namespace and return a `Result`, and SHALL use an injected id generator and clock rather than reading them directly.

3.3 IF an item fails validation against the spec's fields THEN THE SYSTEM SHALL reject the write with path-level issues and SHALL leave the stored data unchanged.

3.4 IF `get`, `update` or `remove` targets an id that does not exist THEN THE SYSTEM SHALL return a `not_found` error.

3.5 WHEN `exportBackup` is called THE SYSTEM SHALL return a JSON document with `format: "ossuary-backup"`, `version`, `appId`, `exportedAt` and all items.

3.6 WHEN `importBackup` is called THE SYSTEM SHALL parse the document with zod, check `format`, `version` and `appId`, validate every item against the spec, and write all items in one transaction in `merge` mode (upsert by id) or `replace` mode.

3.7 IF a backup is not valid JSON, has the wrong `appId`, an unsupported `version`, or contains an invalid item THEN THE SYSTEM SHALL write nothing and return issues that name the item index and field.

3.8 WHEN a CSV text is passed to `parseCsv` THE SYSTEM SHALL handle quoted fields, escaped quotes, embedded commas and newlines, CRLF and LF line endings, and a leading byte-order mark.

3.9 WHEN a CSV header row is read THE SYSTEM SHALL propose a column-to-field mapping by comparing normalised header text with field keys and labels, and SHALL let the caller override each mapping or set it to "ignore".

3.10 WHEN `previewCsvImport` is called with a mapping THE SYSTEM SHALL convert each row into an item, accept dates only as `YYYY-MM-DD`, match `enum` values by value or label ignoring case, and return `valid` rows and `skipped` rows, where each skipped row has its row number and a reason such as "No date".

3.11 IF CSV text exceeds 5 MB or 10,000 rows THEN THE SYSTEM SHALL return a `too_large` error before parsing the rows.

3.12 IF IndexedDB is unavailable, blocked, or out of quota THEN THE SYSTEM SHALL return `unavailable`, `blocked` or `quota` errors that the UI can show, and SHALL NOT throw.

3.13 THE SYSTEM SHALL make no network request in the store.

3.14 WHEN tests run THE SYSTEM SHALL use `fake-indexeddb` and SHALL cover CRUD, namespace isolation, backup round trip (export then import into a clean namespace gives equal items), and fuzzed backup and CSV inputs that never throw and never leave a partial write.

## Requirement 4: ICS export

**User story:** As a user, I want a calendar file with reminders before an item runs out, so that I get nudged without the app being open.

### Acceptance criteria

4.1 WHEN `exportIcs(spec, entries, { now })` is called with one entry or many THE SYSTEM SHALL return a valid iCalendar string with one all-day `VEVENT` per lifespan of each entry, on that lifespan's `expiresAt` day. An entry in a one-lifespan spec therefore produces one event.

4.2 THE SYSTEM SHALL give each event a stable `UID` built from the app id, the item id and the lifespan id, a `DTSTAMP` derived from the `now` argument, and a `SUMMARY` built from the item's title field. WHERE the spec has more than one lifespan THE SYSTEM SHALL append the lifespan's label to the `SUMMARY`.

4.3 WHEN an event is built THE SYSTEM SHALL add one display `VALARM` for each stage of that event's lifespan that has a threshold (every stage except the first and the `dead` stage), firing at 09:00 on the day the item enters that stage, with a description that names the stage label. Alarms SHALL come only from the event's own lifespan.

4.4 IF an alarm's day is earlier than the `now` day THEN THE SYSTEM SHALL omit that alarm.

4.5 IF an item cannot be evaluated THEN THE SYSTEM SHALL skip it (all of its lifespans), and SHALL list it in the `skipped` array of the result with its issues.

4.6 WHEN item text contains commas, semicolons, backslashes or line breaks THE SYSTEM SHALL escape them and fold long lines so that a parser reads back the original text.

4.7 WHEN tests run THE SYSTEM SHALL parse the output with an iCalendar parser (not a string match) and assert event count (one per lifespan per entry), dates, UIDs, summaries, alarm count per event and alarm trigger times for one entry and for many, including a spec with two lifespans.

4.8 WHEN a user triggers a calendar export in the UI THE SYSTEM SHALL offer the file as a download and show a "Calendar file saved" toast.

## Requirement 5: UI primitives

**User story:** As an app author, I want themed, accessible building blocks driven by my spec, so that my app looks and works like the others without custom components.

### Acceptance criteria

5.1 THE SYSTEM SHALL provide these custom elements: `oss-shell`, `oss-button`, `oss-item`, `oss-pill`, `oss-decay`, `oss-list`, `oss-sheet`, `oss-field`, `oss-trace`, `oss-empty`, `oss-import` and `oss-toast`, with all styling from the tokens in DESIGN.md section 2 and no hard-coded colours, radii or durations in components.

5.2 WHEN `oss-shell` receives a spec THE SYSTEM SHALL apply `theme` as CSS custom properties on itself (`--accent`, `--accent-ink`, `--accent-tint`, `--canvas`, `--font-display`), derive the focus ring from the accent, and render the `wordmark`.

5.3 WHILE the viewport is 900px wide or more THE SYSTEM SHALL render the 72px top bar with wordmark, text navigation and the screen's primary pill. WHILE it is narrower THE SYSTEM SHALL render the 56px app bar and the bottom bar with the primary pill.

5.4 THE SYSTEM SHALL render at most one primary pill per screen, and SHALL render every interactive target at 44 by 44 px or larger.

5.5 WHEN `oss-item` is given an evaluated item THE SYSTEM SHALL render the primary lifespan's countdown number, large, with a muted unit, the primary lifespan's stage pill (card variant), the decay visual, the title, a short line from `summaryFields`, and the primary lifespan's absolute date inside a `<time datetime>` element.

5.6 WHEN a lifespan's `remaining` is under 1 day THE SYSTEM SHALL show hours; WHEN it is exactly 0 days it SHALL show "Today"; WHEN it is under 60 days it SHALL show days; under 2 years months; otherwise years and months. WHEN the lifespan is in the `dead` stage THE SYSTEM SHALL show the number with "days ago". This applies to the primary countdown and to every other lifespan's countdown.

5.7 THE SYSTEM SHALL give each item one accessible name of the form "Title. Stage label. Expires in 2 days, Friday 20 November." built from the primary lifespan, and SHALL hide the visual digits and the decay visual from assistive technology. WHERE the item has more than one lifespan THE SYSTEM SHALL append one sentence per other lifespan in declared order, of the form "Label: expires in 12 days, Tuesday 1 December.", and SHALL name the primary lifespan's label in its own sentence.

5.8 WHEN `oss-pill` renders a stage THE SYSTEM SHALL draw the tone slot's background, text colour and glyph from the core, always show the stage label as visible text, and mark the glyph `aria-hidden`.

5.9 WHEN `oss-decay` renders THE SYSTEM SHALL draw the chosen motif from the primary lifespan's `fraction` (quantised to 1/20) and stage mood, SHALL be `aria-hidden`, and SHALL NOT render without the number, unit and pill in the same card.

5.10 WHEN `oss-list` is given evaluated items THE SYSTEM SHALL group them by the tone of each item's primary lifespan stage in the order urgent, soon, steady, fresh, dead, hide empty groups, show a pill and item count in each group header, wrap each group in a `<section aria-labelledby>`, and collapse the `dead` group by default behind a toggle.

5.11 WHILE the viewport is under 900px THE SYSTEM SHALL render each group as one surface card of rows. WHILE it is 900px or more THE SYSTEM SHALL render a card grid.

5.12 WHEN `oss-sheet` opens for add or edit THE SYSTEM SHALL generate one `oss-field` per spec field (`text` and `number` as inputs, `date` as a native date input, `enum` with 4 or fewer options as a segmented radiogroup, `enum` with more as a native select), each with a visible label, `required` state and an `aria-describedby` helper or error.

5.13 WHEN a field value changes THE SYSTEM SHALL re-run `evaluate` and update the live preview (decay, "Expires in N days", date, pill) in the sheet from the primary lifespan, and the countdown of each other lifespan.

5.14 IF the user saves with invalid values THEN THE SYSTEM SHALL keep the sheet open, show the issue text next to each field with an alert glyph, and move focus to the first invalid field.

5.15 WHEN a sheet or dialog opens THE SYSTEM SHALL move focus into it, trap Tab and Shift+Tab inside, close on Escape, and return focus to the element that opened it.

5.16 WHEN `oss-trace` is given a result THE SYSTEM SHALL render, for each lifespan, an ordered list with one line per trace entry, the signed change right-aligned, and a total line with the expiry date and the total days. WHERE the result has more than one lifespan THE SYSTEM SHALL head each list with the lifespan's label, follow declared order, and mark the primary lifespan in text. WHILE the viewport is narrower than 900px THE SYSTEM SHALL present it as a bottom drawer opened by a "Why this date?" link.

5.17 WHEN the item list is empty THE SYSTEM SHALL render `oss-empty` with the spec's `emptyArt`, one title line, one primary action and an optional import link.

5.18 WHEN `oss-import` opens THE SYSTEM SHALL offer paste CSV, upload file and restore backup, show the column mapping, a preview of the first five rows with computed countdowns, the ready and skipped counts, and import only after the user confirms. WHILE the viewport is narrower than 900px it SHALL present three steps with a "2 of 3" caption.

5.19 IF an import yields skipped rows THEN THE SYSTEM SHALL show an urgent pill and the reason on each skipped row in the preview.

5.20 WHILE `prefers-reduced-motion: reduce` is active THE SYSTEM SHALL set all `--dur-*` tokens to 0ms, remove keyframe animation, show the final state of every decay visual, and open sheets without sliding.

5.21 WHERE the system shows status THE SYSTEM SHALL pair colour with a word and a glyph, and SHALL NOT rely on colour or animation alone.

5.22 WHEN a user action changes an item's primary stage THE SYSTEM SHALL announce it through `oss-toast` (`role="status"`, `aria-live="polite"`), and SHALL NOT use live regions for countdown numbers.

5.23 WHEN the Playwright suite runs on the core gallery page at 1280 px and 390 px wide THE SYSTEM SHALL pass axe checks with zero violations for every primitive in every state shown on the gallery (including the core, warm and cool themes and an item with two lifespans), SHALL show no horizontal scroll at 390 px, and SHALL pass a keyboard-only flow: Tab reaches every action, focus is visible, the add sheet traps and restores focus, and Escape closes the sheet, the drawer and the dialog.

5.24 WHERE an item has more than one lifespan THE SYSTEM SHALL show every lifespan's countdown on the item card in declared order, the primary one large and each other one smaller. Each other countdown SHALL show the lifespan's label, its countdown text (per 5.6) and its own stage label as visible text with the tone glyph. The card SHALL have one stage pill only, the primary lifespan's. WHERE the item has one lifespan THE SYSTEM SHALL render the card with no lifespan label and no extra countdown.

## Requirement 6: Core boundaries

**User story:** As the maintainer, I want the core kept generic and local, so that any app can be built on it and the two proof apps stay different.

### Acceptance criteria

6.1 THE SYSTEM SHALL contain no domain words in `packages/ossuary-core` (a banned-word list including food, grocery, pantry, warranty, recall, USDA, receipt, kettle), and a test SHALL fail IF any appears in source, fixtures or the gallery.

6.2 THE SYSTEM SHALL contain no call to `Date.now()` and no `new Date()` without arguments in `packages/ossuary-core/src/engine`, `schema` and `ics`, and a test SHALL fail IF one appears.

6.3 THE SYSTEM SHALL import nothing from `apps/*` or `tools/*`.

6.4 THE SYSTEM SHALL make no network request after the page loads, and the Playwright suite SHALL fail IF the gallery makes one.

6.5 THE SYSTEM SHALL add no UI framework, and SHALL add only these runtime dependencies: `zod`, `idb`, `ics`, and self-hosted `@fontsource-variable/*` fonts.
