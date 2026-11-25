# Requirements: claim-reminder

## Introduction

A ready-to-send warranty claim reminder in Warranty Wraith. From a purchase that is still under warranty, the user downloads a calendar file whose event carries a claim message to paste into an email. The core change is generic. The wording lives in the app.

## Requirement 1: Event description in calendar export (core)

**User story:** As an app author, I want to attach text to an exported event without the core knowing what the text is about.

### Acceptance criteria

1.1 THE SYSTEM SHALL accept an optional `describe(entry, lifespan)` callback in the `opts` of `exportIcs` in `packages/ossuary-core/src/ics/export-ics.ts`.

1.2 WHEN `describe` returns a non-empty string, THE SYSTEM SHALL add a `DESCRIPTION` property to that event, with RFC 5545 TEXT escaping and the same line folding as the other properties.

1.3 WHEN `describe` is absent, or returns an empty string or `undefined`, THE SYSTEM SHALL produce output byte-identical to the output before this change.

1.4 THE SYSTEM SHALL keep the core free of domain words and of `Date` use in its pure layers.

## Requirement 2: Claim message (app)

**User story:** As a buyer, I want a claim message I can paste into an email without editing the layout.

### Acceptance criteria

2.1 THE SYSTEM SHALL export a pure function `claimNote(values, warrantyEnds)` from `apps/warranty-wraith/src/claim.ts` that returns plain text.

2.2 THE SYSTEM SHALL write in that text: a greeting, the item name, the model and price when present, where and when it was bought, the day the warranty ends, a line for the user to describe the fault, and a note that the receipt is attached.

2.3 THE SYSTEM SHALL write days as, for example, `5 November 2026`, from the `YYYY-MM-DD` string without a `Date` object, so no time zone changes the day.

2.4 WHEN a field is missing or empty, THE SYSTEM SHALL leave out its words. The text SHALL NOT contain `undefined`, `null`, or an empty label.

## Requirement 3: Claim reminder button (app)

**User story:** As a buyer, I want one click to put the claim deadline and message in my calendar.

### Acceptance criteria

3.1 WHILE the warranty has not lapsed, THE SYSTEM SHALL show a ghost button `Claim reminder` with `data-action="claim"` next to `Add to calendar` in the purchase detail.

3.2 WHEN the warranty has lapsed, THE SYSTEM SHALL NOT show the button.

3.3 WHEN the user clicks it, THE SYSTEM SHALL download `warranty-wraith-claim.ics` with one all-day event for the warranty lifespan only, the summary `Warranty claim: <item>`, the core stage alarms (90, 30 and 7 days before), and the `claimNote` text as `DESCRIPTION`.

3.4 WHEN the file has been saved, THE SYSTEM SHALL show the toast `Claim reminder saved`.

## Requirement 4: Docs and tests

**User story:** As a judge, I want the write-up to match what the app does.

### Acceptance criteria

4.1 THE SYSTEM SHALL describe the feature in the Devpost write-up and in `docs/DEMO.md` only as built.

4.2 THE SYSTEM SHALL have a core unit test in which ical.js reads `DESCRIPTION` back, and which shows that an absent `describe` leaves the output unchanged.

4.3 THE SYSTEM SHALL have `apps/warranty-wraith/src/claim.test.ts` and `app.test.ts` cases for: button shown, button hidden when lapsed, and the downloaded content.

4.4 THE SYSTEM SHALL have a step in `apps/warranty-wraith/e2e/demo.spec.ts` that downloads the claim file and reads its description.

4.5 THE SYSTEM SHALL pass the gate before the spec is closed.
