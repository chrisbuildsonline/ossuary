# Ossuary design system

One skeleton, many lifespans. Every Ossuary app shares these components and tokens. A bone spec
changes the accent, the display face and the decay motif, nothing structural. Stack: Vite + plain
web components, so everything below is CSS custom properties plus component anatomy.

Refs in `design/refs/` are inspiration only. Never copy, trace or ship them.

**Two modes, one skeleton.** The default is the **crypt**: a deep stone canvas lit by candlelight, bone-white
type, each app's accent turned into a glow. **Light** (the original soft-paper look) stays as an option behind
one toggle. Both modes use the same components and tokens; only token values change. Every rule below applies
to both modes unless it says "crypt" or "light".

## 1. Principles

1. **Stone canvas, lit slabs.** Crypt: a near-black stone canvas tinted by the app's hue (`#0d0f14` core) with
   slightly lighter stone slabs (surfaces) at 16-20px radius. Depth comes from light (a 1px top highlight and a
   soft dark shadow), never from borders. Light mode: the soft neutral canvas (`#eef0f4`) with white surfaces.
2. **One loud thing per screen.** Each screen has one primary pill (bone-white in the crypt, near-black in
   light) and one accent colour (per app) for links, selection and charts. Everything else stays quiet.
3. **The number is the hero.** A countdown is a big tabular number with a small unit ("2 days").
   Titles are large, secondary text is muted and sections get real space between them.
4. **Status is a word in a tinted pill**, and it always comes with a glyph. Colour is never the only signal.
5. **Scannable, not exhaustive.** A list row is the motif, the name, kind + one short line, then the
   countdown. Detail only lives on the detail screen.
6. **Decay you can see across the room.** The haunting lives in light and decay, not in props: candles that
   visibly burn down to a stub, ghosts that fade into the stone, a warm glow around things about to die, and
   cards that turn to ghosts once they are gone. Always next to text that says the same thing.

**Forbidden:** bordered white boxes stacked on a white page; grey "admin kit" UI (flat #1e1e1e panels, neon
accents, left sidebars) – the crypt is warm stone and candlelight, not a dashboard; pure `#000` backgrounds; more
than one accent per app; more than one primary pill per screen; full-width coloured (non-ink) primary
buttons; orange-and-black Halloween palettes, bats, spiders, cobwebs, blood/drip fonts or skulls on content;
rainbow icon tiles; walls of equal-weight text; desktop tables shrunk onto phones; colour-only status;
animation as the only signal; copied or traced Dribbble/stock art.

## 2. Tokens (core defaults, `packages/ossuary-core/src/ui/tokens.css`)

`tokens.css` declares the crypt values on `:root` (the default, so the page is dark before any script runs)
and the light values on `:root[data-mode="light"]`. The mode lives on `<html data-mode>`, set from
`localStorage["ossuary:mode"]` by `initMode()` and switched by `setMode()` (section 6, theme toggle).

**Crypt (default)**

```css
:root {
  --canvas: #0d0f14;            /* core; apps derive theirs from their hue (section 4) */
  --surface: #181b23;           /* stone slab: cards, sheets */
  --surface-sunken: #11141a;    /* input fills, trace rows */
  --track: #262a33;  --line: #2a2e38;
  --line-strong: #7a7468;       /* input outlines, >=3:1 on every crypt surface */
  --text: #efe8da;              /* bone white, >=13:1 */
  --text-2: #bdb5a6;            /* >=8:1 */
  --text-3: #a19a8c;            /* >=5.9:1 */
  --ink: #efe8da;  --ink-hover: #fffaf0;  --on-ink: #16130f;   /* the primary pill is bone, 15.2:1 */
  --scrim: rgb(4 5 8 / .66);  --disabled: #3a3833;  --error: #ff8a7a;
  --highlight: inset 0 1px 0 rgb(255 248 230 / .06);          /* the lit top edge of a slab */
  --shadow-1: var(--highlight), 0 1px 2px rgb(0 0 0 / .4), 0 6px 16px rgb(0 0 0 / .32);
  /* motif paint: wax stays cream, lines go dark, light glows */
  --motif-ink: #1a140d;  --motif-dish: #3b342b;  --motif-spirit: #e4e8ff;  --motif-spirit-line: #cfd5fb;
  --halo: .28;           /* candle halo opacity (0 in light) */
  --spirit-glow: rgb(196 206 255 / .45);
  --glow-urgent: rgb(255 112 82 / .30);  --glow-soon: rgb(244 187 85 / .16);
  --atmosphere: 1;       /* canvas and card light; 0 in light */
}
/* themed elements also warm --track and --line toward bone from their own crypt surface */
```

**Light (option, `data-mode="light"`)** keeps the original values below, with `--halo: 0`, no glows,
`--motif-ink: var(--text)`, `--motif-spirit: var(--surface)`, `--motif-spirit-line: var(--text)` and
`--motif-dish: var(--surface-sunken)`.

```css
:root[data-mode="light"] {
  /* colour */
  --canvas: #eef0f4;            /* page */
  --surface: #ffffff;           /* cards, sheets */
  --surface-sunken: #f4f5f8;    /* input fills, trace rows */
  --track: #e9ebf0;             /* segmented track, progress track */
  --line: #eceef2;              /* decorative dividers inside cards only */
  --line-strong: #858b98;       /* input outlines: 3.42:1 white, 3.13:1 sunken (WCAG 1.4.11) */
  --text: #15171c;              /* 17.93:1 white, 15.72:1 canvas */
  --text-2: #555c69;            /* secondary: 6.73:1 white, 5.90:1 canvas */
  --text-3: #646a78;            /* muted/captions: 5.42:1 white, 4.75:1 canvas */
  --ink: #15171c;               /* primary pill bg; white label 17.93:1 */
  --ink-hover: #2a2d35;
  --on-ink: #ffffff;
  --scrim: rgb(21 23 28 / .32);

  /* accent (overridden per app; see section 4) */
  --accent: #3657c9;            /* 6.25:1 white, 5.47:1 canvas */
  --accent-ink: #3657c9;        /* accent used as text on --accent-tint */
  --accent-tint: #e8edfa;       /* accent-ink on tint 5.33:1 */

  /* radius */
  --r-xs: 8px; --r-sm: 12px; --r-md: 16px; --r-lg: 20px; --r-xl: 28px; --r-pill: 999px;

  /* shadow (cool ink tint, never pure black) */
  --shadow-1: 0 1px 2px rgb(21 23 28 / .04), 0 4px 12px rgb(21 23 28 / .05);   /* cards at rest */
  --shadow-2: 0 2px 4px rgb(21 23 28 / .05), 0 12px 32px rgb(21 23 28 / .09);  /* hover, chips selected */
  --shadow-3: 0 8px 16px rgb(21 23 28 / .08), 0 24px 64px rgb(21 23 28 / .18); /* sheets, dialogs, toast */

  /* spacing (4px base) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px;
  --s-8: 32px; --s-10: 40px; --s-14: 56px; --s-18: 72px;

  /* type */
  --font-ui: "Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-display: var(--font-ui);   /* per app override */
  --font-num: var(--font-display);  /* numbers use the display face, always tabular */
  /*            size/line-height        weight  tracking */
  --t-display: 600 48px/52px var(--font-display);  /* phone 34px/38px, -0.02em */
  --t-title:   600 28px/34px var(--font-display);  /* phone 24px/30px, -0.01em */
  --t-num-xl:  600 88px/88px var(--font-num);      /* detail countdown; phone 72px/72px */
  --t-num-l:   600 40px/40px var(--font-num);      /* card countdown */
  --t-num-m:   600 24px/28px var(--font-num);      /* row countdown, stat */
  --t-heading: 600 17px/24px var(--font-ui);       /* section headers, card names */
  --t-body:    400 16px/24px var(--font-ui);
  --t-label:   500 14px/20px var(--font-ui);       /* buttons in-line, field labels */
  --t-caption: 500 13px/18px var(--font-ui);       /* units, meta, pills */
  --t-eyebrow: 600 12px/16px var(--font-ui);       /* UPPERCASE, +0.08em, --text-3 */

  /* motion */
  --dur-1: 120ms;  /* press */
  --dur-2: 200ms;  /* hover, pill tone change */
  --dur-3: 320ms;  /* sheet / drawer */
  --dur-4: 600ms;  /* decay change, date jump */
  --ease-out: cubic-bezier(.22, 1, .36, 1);
  --ease-in-out: cubic-bezier(.65, 0, .35, 1);
  --ease-settle: cubic-bezier(.34, 1.4, .64, 1);   /* tiny overshoot, number landing only */

  /* focus */
  --focus: 3px solid var(--accent);  /* used as outline, offset 2px */
}
```

Rules: numbers always use `font-variant-numeric: tabular-nums`. Units sit beside the number in
`--t-caption`/`--text-2` on the baseline. Section gaps are `--s-10` desktop / `--s-8` phone. Card padding is
`--s-6` desktop / `--s-4` phone. Never set text smaller than 13px.

Fonts (all OFL, self-hosted via `@fontsource-variable/*`, `font-display: swap`): **Inter** (UI, all
apps), **Fraunces** (Pantry Reaper display/numbers, `"SOFT" 100, "opsz" 72`), **Space Grotesk** (Warranty
Wraith display/numbers). There is no mono font. The trace uses tabular Inter.

## 3. Stage pills

A spec names its own stages (any number). Each stage maps onto one of five **tone slots** via
`stages[].tone`, and the core owns the colours of those slots, not the spec.

| Tone | Background | Text | Ratio | Glyph (16px, inline SVG) | Pantry Reaper | Warranty Wraith |
|---|---|---|---|---|---|---|
| `fresh` | `#e2f3e8` | `#17663a` | **6.08:1** | filled circle + check | Fresh | Covered |
| `steady` | `#e5edfa` | `#2b4f96` | **6.70:1** | open ring | Frozen (long-life) | Registered / not started |
| `soon` | `#fcefd6` | `#8a4b00` | **5.98:1** | hourglass | Use soon | Closing |
| `urgent` | `#fde3df` | `#a8261b` | **5.82:1** | exclamation in triangle | Eat today | Last days |
| `dead` | `#e4e6ea` | `#3c414b` | **8.20:1** | tombstone | Spoiled | Lapsed |

Crypt pills are dark tinted glass with a light word: `fresh` `#7fd8a2` on `#123222` (8.14), `steady` `#a3c0f5`
on `#17263f` (8.24), `soon` `#f4bb55` on `#3a2809` (8.13), `urgent` `#ff9c8c` on `#431713` (7.58), `dead`
`#bcc0c8` on `#2a2c31` (7.66). Every crypt word is also >=8:1 on every crypt surface.

All ratios are WCAG 2.x relative luminance, text on pill background, and all pass AA for 13px/600.
Anatomy: height 28px (32px on detail), padding `0 10px 0 8px`, gap 6px, `--r-pill`, `--t-caption` at
weight 600, glyph 14px in the text colour, `aria-hidden="true"`. The label is always the visible stage word.
Pills are status, not buttons. A stage that is filterable appears as a chip (section 6), not a pill.

## 4. Per-app themes

Themes are token overrides generated from the spec's `theme` block by `applyTheme(el, theme)`. It writes each
themable token twice, as `--light-*` and `--crypt-*`, and marks the element `data-themed`; `tokens.css` picks
the set for the current mode, so switching modes is pure CSS and never re-renders.

**Crypt values are derived, not authored** (`cryptTheme()` in `ui/crypt.ts`), so a third app gets a crypt for free:
- canvas / surface / sunken = the hue and saturation (capped at 34%) of the spec's light canvas at HSL
  lightness 6.5% / 11.5% / 8.5%. Pantry's warm paper becomes warm soot (`#14120d`), Wraith's cool paper a
  blue night (`#0b0e16`).
- accent = the spec accent with its HSL lightness raised until it reaches 4.6:1 on the crypt surface, canvas
  and tint. Pantry `#b8460e` becomes ember `#f07639`, Wraith `#5a4bd1` spectral `#9086e0`, core `#7a90db`.
- accent tint = the spec accent at 24% over the crypt surface; accent ink = the crypt accent.
A unit test checks every app, template and gallery theme against all AA pairs in both modes.

| Token | Core / launcher | Pantry Reaper | Warranty Wraith |
|---|---|---|---|
| `--canvas` (crypt) | `#0d0f14` | `#14120d` (warm soot) | `#0b0e16` (blue night) |
| `--accent` (crypt) | `#7a90db` | `#f07639` ember | `#9086e0` spectral |
| `--canvas` (light) | `#eef0f4` | `#f2efea` (warm, candle-lit) | `#edeff6` (cool, moonlit) |
| `--accent` | `#3657c9` slate blue | `#b8460e` pumpkin | `#5a4bd1` spectral violet |
| accent ratio (white / own canvas) | 6.25 / 5.47 | 5.36 / 4.67 | 6.25 / 5.44 |
| `--accent-ink` on `--accent-tint` | `#3657c9` on `#e8edfa` 5.33 | `#9a3a0b` on `#fbe9dc` 5.96 | `#5a4bd1` on `#ebe9fb` 5.23 |
| `--font-display` | Inter 700, -0.03em | Fraunces 600, soft serif | Space Grotesk 600 |
| motif | hourglass | candle | ghost |
| empty-state art | hourglass on its side | unlit candle, jar, crescent moon | ghost asleep in a parcel box |
| voice | "3 things expire this week" | "3 things die this week" | "2 return windows close this week" |

Pantry Reaper feels like a warm kitchen at night: a serif display face, a pumpkin accent, cream wax and amber
flame. Warranty Wraith feels like a tidy receipt drawer: a geometric grotesk, a violet accent, cool ink and pale
spectres. Same components, clearly different apps.

**Spec `theme` block may set:** `accent`, `accentInk`, `accentTint`, `canvas`, `display`
(`"inter" | "fraunces" | "space-grotesk"`), `motif` (`"hourglass" | "candle" | "ghost"`), `emptyArt`,
`wordmark` (text), and `stages[].tone`. The zod schema rejects an accent below 4.5:1 on white or on the
canvas, and a canvas whose luminance is outside 0.84-0.89 (it must stay soft neutral).
**Spec may not set:** text colours, ink/primary pill, stage tone colours, radius, spacing, shadows, type
scale, focus ring (derived from accent) or motion.

## 5. Decay visual and motion

`<oss-decay motif fraction stage size>` is one component with three procedural SVG motifs. Spec-agnostic.

- `fraction` = `clamp((expiresAt - now) / (expiresAt - startedAt), 0, 1)`, quantised to 1/20 steps. `now` is
  passed in, matching the pure engine. `stage` comes from the engine. **Stage drives the mood, fraction drives the amount.**
- Sizes: `s` 32x40 (phone row), `m` 48x64 (card), `l` 120x160 (detail), `xl` 200x240 (empty state/launcher).
- Always `aria-hidden="true"`. The adjacent number, unit and pill carry the meaning.

**Candle (Pantry Reaper).** A cream wax body `#f6efe3` with a 2px `--motif-ink` stroke and 4px radius. Its height
is `8 + 64 * fraction` (in a 48x96 viewBox), standing on an ellipse dish. **Burnt outline:** above the wax, a
dashed `--line-strong` outline (`.burnt`, height `64 * (1 - fraction)`) shows where the full candle stood, so the
shrink reads at a glance even at 32px. **Halo:** a blurred flame-coloured circle (`.halo`, opacity `--halo`)
behind the flame, radius scaled with the flame; none when dead. Drips: one at fraction <0.66 and two
at <0.33. A wick (2x6) holds a flame: an outer teardrop `#f59e0b` and an inner `#fde68a` (the only gradient-free
warm colours). `fresh`/`steady` get a tall flame with a slow sway. `soon` gets a 0.8x flame. `urgent` gets a 0.6x
guttering flame and a wax pool on the dish. `dead` is a stub with no flame and three smoke curls that rise and fade once.

**Ghost (Warranty Wraith).** A rounded body with a wavy 3-lobe hem, 2px `--motif-spirit-line` stroke and
`--motif-spirit` fill with a `--spirit-glow` drop-shadow, so a full-life ghost glows and a dying one fades into
the stone (the glow follows the fill opacity). Eyes are `--motif-ink`. Fill
opacity is `0.15 + 0.85 * fraction` and stroke opacity `0.35 + 0.65 * fraction`. Below 0.25 the hem stroke turns
dotted (`stroke-dasharray: 2 4`). Eyes: round (`fresh`/`steady`), half-lidded (`soon`), worried brows (`urgent`).
For `dead` only a dotted outline remains at 0.35 opacity. On detail Wraith shows one ghost per countdown
(return window, warranty).

**Hourglass (core).** Top sand area = fraction and bottom = 1 - fraction. The sand is in `--accent-tint` with an
`--accent` stroke. `dead` lays it on its side.

**Decaying cards (crypt and light).** The item card carries its life as `--life` (the fraction) and its tone:
- *Ghost fade:* the card slab is `--surface` at `40% + 60% * life` over the canvas, so a card loses substance as
  it nears death. Text stays on solid colour pairs, so contrast never drops.
- *Motif light:* behind the motif a soft pool of its own light (flame amber for the candle, spirit white for the
  ghost, the accent for the hourglass) at `--atmosphere * (6% + 14% * life)`, so a full candle warms its card and a
  dying one leaves it cold. In the crypt the shell also hangs a faint accent glow over the top of the page.
  `--atmosphere` is 1 in the crypt and 0 in light, which removes both.
- *Glow near death:* `soon` cards get a faint amber edge glow (`--glow-soon`); `urgent` cards an ember glow
  (`--glow-urgent`) that breathes slowly (opacity .6→1, 2.8s, ≤0.4Hz). Rows get the same glow as a 3px left ember bar.
- *Dead = a ghost of a card:* no slab, a 1.5px dashed `--line-strong` outline, motif at 55% opacity and greyscale,
  name and number in `--text-2`.
- *First load:* the first time a list renders with items, every candle burns down from full height to its
  fraction and every ghost fades from full to its opacity (1.2s `--ease-out`, 50ms stagger), and dead cards
  fade from a slab to their ghost outline. Later re-renders are static.
- *First visit:* an app may ship sample items (`samples` passed to `seedFirstVisit`). On the very first visit with
  an empty store they are added once, a toast says "Sample items added" with a "Clear" action, and the crypt
  shows living, dying and dead cards straight away. A later visit never re-adds them.

**Text pairing (mandatory).** A decay visual is never rendered without, in the same card: the number+unit,
the stage pill and (on detail) the absolute date (`Fri 20 Nov`).

**Motion:**

| Moment | What | Duration / easing |
|---|---|---|
| Idle flame sway (detail, hovered card only) | `scaleY 1→.93`, `skewX ±2deg`, origin at wick | 1.8s `--ease-in-out` infinite alternate. `urgent`: 0.9s with an irregular 3-key flicker |
| Idle ghost float (detail, hovered card only) | `translateY 0→-3px` | 3.2s `--ease-in-out` infinite alternate |
| Fraction/stage change (edit, fridge→freezer) | wax height / ghost opacity / sand tween | `--dur-4` `--ease-out` |
| Date jump number | count old→new, then land | 600ms `--ease-out` count, 200ms `--ease-settle` scale 1.04→1 |
| Pill tone change | background/colour crossfade | `--dur-2` `--ease-out` |
| Death (crosses into `dead`) | flame out, smoke curls rise 12px and fade / ghost dissolves to outline | 900ms `--ease-out`, plays once |
| Card hover | `translateY(-2px)`, `--shadow-2` | `--dur-2` `--ease-out` |
| Sheet/drawer in | phone: translateY 100%→0. Desktop side sheet: translateX 24px + fade | `--dur-3` `--ease-out`. Out is 200ms `--ease-in-out` |

List cards are static at rest apart from the urgent ember breath (glow only, never the motif). At most one idling
motif is on screen.

**`prefers-reduced-motion: reduce`:** set every `--dur-*` to `0ms`, remove all infinite and one-shot
keyframes (the first-load burn-down and the ember breath included: candles, ghosts, glows and ghost cards are
drawn in their final state), render the decay visual in its final state, change numbers instantly, and open sheets without
sliding. The date jump is still communicated by its toast ("Moved to freezer: +58 days").

## 6. Components

All are custom elements prefixed `oss-`. Every interactive target is ≥44x44px.

**App shell `<oss-shell>`.**
- *Desktop ≥900px:* a 72px top bar on the canvas, not a coloured bar. On the left, the wordmark (bone glyph +
  app name in `--font-display` 20px). In the middle, text nav (Items, Import, Backup) in `--t-label`; the
  current item is in `--accent-ink` with a 2px accent underline at 8px offset. On the right, the screen's
  primary pill. Content max-width is 1120px, centred, with 40px side padding.
- *Phone <900px:* a 56px app bar holds the wordmark (or back + title on inner screens) and a 44px overflow
  icon button. The bottom bar is 72px + `env(safe-area-inset-bottom)`, a surface with `--shadow-3` and a top
  radius of `--r-xl`. Its centre holds the primary pill (48px tall, 160px min) and its sides hold two 44px tab
  buttons (icon 24 + caption).
- The page background is always `--canvas`. Nothing sticks to the top except the phone app bar.
- **Theme toggle:** a 44px icon button in the top bar, left of the primary pill on desktop and at the right of
  the phone app bar (`aria-pressed`, label "Light theme", sun glyph in crypt, moon glyph in light). It is not a
  primary action. The launcher has the same toggle beside GitHub. The choice persists per device.

**Primary pill `<oss-button variant="primary">`.** `--ink` background (bone in the crypt, with a soft candle
glow `0 0 24px rgb(255 214 150 / .16)`), `--on-ink` `--t-label` at weight 600 (16px on
phone). Height 52px desktop / 56px in phone footers, padding `0 24px`, `--r-pill`. Hover `--ink-hover`, press
`scale(.98)` over `--dur-1`. Disabled: `#c9ccd3` with `--text-2`. Other variants: `ghost` (surface, `--shadow-1`,
`--text`, 44px) and `link` (accent text, underline on hover). An icon button is a 44px circle that shows
`--surface-sunken` on hover.

**Item card `<oss-item variant="card|row">`.**
```
card (desktop grid, min 320px, h ~168)           row (phone, inside a group card, h 76)
+--------------------------------------+         +--------------------------------------+
| [decay m]  2  days         (! Soon)  |         | [decay s]  Greek yogurt        2     |
|            Fri 20 Nov                |         |            Dairy · Fridge     days   |
| Greek yogurt                (17px)   |         +--------------------------------------+
| Dairy · Fridge · opened Tue (13px)   |
+--------------------------------------+
```
- *Card:* surface, `--r-lg`, `--shadow-1`, padding 24. Number `--t-num-l`, unit `--t-caption --text-2`, date
  `--t-caption --text-3`. Name `--t-heading`. Short line = kind · location/field · one spec-chosen fact, in
  `--t-caption --text-2` on one line with ellipsis.
- *Row:* 16px padding, decay `s` left, name + short line in the middle, `--t-num-m` number over its unit on the
  right. No pill, because the group header carries the stage. Dividers are 1px `--line` inset 64px.
- The whole card/row is one link to detail. States: hover (lift), focus-visible (ring around the card),
  pressed (`scale(.99)`), `dead` (name `--text-2`, number shows "3" + "days ago").
- Countdown units: under 1 day "5 hrs"; 0 days shows the word "Today" in the number slot; under 60 days shows
  days; under 2 years "8 mo"; longer "1 yr 11 mo".

**Stage-grouped list `<oss-list>`.** Groups in order urgent → soon → steady → fresh → dead, and empty groups
are hidden. The section header shows a stage pill + count (`--t-heading`, `--text-2`, "2 items"), with 12px
below it and `--s-10` between groups. `dead` is collapsed by default ("Spoiled · 4", toggle). Desktop: a card
grid (3 cols at 1280, gap 20). Phone: one surface group card per stage containing rows.

**Filter chips.** 44px tall, `--r-pill`, surface + `--shadow-1`, `--t-label`, with a count in `--text-3`.
Selected: `--accent-tint` background, `--accent-ink` text, 1.5px inset `--accent` ring. Uses
`role="radio"`/`aria-checked` in a radiogroup.

**Add/edit sheet `<oss-sheet>` + `<oss-field>`.** Generated from `spec.fields`.
- Desktop: a right side sheet 480px wide, inset 16px from the viewport, `--r-xl`, `--shadow-3`, over a scrim.
  Phone: a bottom sheet with `--r-xl` top corners, a 36x4 grabber in `#d5d8df`, max height 92dvh, and a sticky
  footer with a full-width primary pill ("Save item").
- The top of the sheet is a **live preview**: decay `m` + "Expires in 4 days · Fri 20 Nov" + pill, re-run on
  every change. Any spec suggestion shows below it as a caption ("Suggested by USDA FoodKeeper: 3-5 days").
- Fields: the label sits above the field (`--t-label`, `--text`) with 8px between label and field and 20px
  between fields. Helper/error text below is `--t-caption` (error in `#a8261b` + alert glyph + the
  `aria-describedby` text).
  - `text` / `number`: 48px tall, `--surface-sunken`, 1px `--line-strong`, `--r-sm`, padding `0 14px`. On focus
    the field turns white with the focus ring. `number` gets −/+ 44px steppers when `step` is set.
  - `date`: native `<input type="date">` styled the same, with a calendar glyph on the right.
  - `enum` with ≤4 options: a **segmented control**, 48px, `--track` background, `--r-pill`, 4px inset. The
    selected thumb is white with `--shadow-1`, `--accent-ink` 600 text and a 1.5px `--accent` ring. Option
    glyphs come from the spec (e.g. fridge/freezer/pantry). Changing it animates the preview date jump.
  - `enum` with >4 options: a native `<select>` styled like `text`.

**Explain-trace drawer `<oss-trace>`.** A receipt of how the date was made, one rule per line in plain
language.
```
WHY THIS DATE                                    (eyebrow)
o  Base: yogurt, fridge (USDA FoodKeeper)    14 days
o  Opened -> shorten to 7 days               -7 days
o  Moved to freezer -> extend               +60 days
o  Clamp: max 90 days                      no change
- - - - - - - - - - - - - - - - - - - - - - - - - - -
   Expires Sat 21 Jan 2027                 = 67 days
```
Each line is a 10px dot on a 2px `--line` vertical rail with the rule text in `--t-body`. The delta is
right-aligned, tabular and `--text-2` (`--accent-ink` when it changed the outcome). A dashed divider precedes a
total in `--t-heading`. Desktop: a persistent card in the detail's right column. Phone: a bottom drawer opened
by a "Why this date?" link. Lines fade/slide in 8px with a 40ms stagger over 200ms (none under reduced motion).
The markup is an `<ol>`.

**Empty state.** Centred in a surface card: `xl` art, one line in `--t-title` ("Nothing's dying yet."), one
`--t-body --text-2` line (optional), one primary pill ("Add your first item") and an optional link ("or
import a list").

**Import dialog `<oss-import>`.** Desktop: centred, 720px wide, `--r-xl`, `--shadow-3`. Phone: full screen in
3 steps (Source → Map → Confirm) with a step caption "2 of 3".
1. Source: a segmented control (Paste CSV · Upload file · Restore backup). Paste is a 200px monospace-free
   textarea. Upload is a dashed 2px `--line-strong` drop zone, `--r-lg`, 160px tall, with an upload glyph and
   "Drop a .csv or .json".
2. Map: for each CSV column, a row "column name → [spec field select]", with confidence auto-matched by
   header name. The preview shows the first 5 rows as `row` items with computed countdowns. Invalid rows show
   an urgent pill + reason ("No date").
3. Confirm: summary "24 items ready, 2 skipped" and the primary pill "Import 24 items". JSON backup restore
   skips mapping and shows a diff count (new / updated).

**Recall banner (Warranty Wraith) `<oss-banner tone="urgent">`.** A surface-width card in `#fde3df` with
`--r-md` and 16px padding. Left: an alert glyph in `#a8261b`. Text: `--t-heading` "Possible recall match" plus
`--t-body` "CPSC 24-117: Acme K2 kettle, overheating" (`#3c414b` on the tint). Actions: "Read notice" link and
"Not my model" ghost button. `role="status"`. On home it collapses to one line above the list ("1 possible
recall").

**Toast `<oss-toast>`.** Bottom centre, 24px above the bottom bar on phone. `--ink` background, white
`--t-label`, `--r-pill`, min height 48px, padding `0 8px 0 20px`, optional "Undo" text button (white,
underlined). Auto-dismisses at 5s and pauses on hover/focus. `role="status"` `aria-live="polite"`. Enters
translateY 12px + fade over `--dur-2`.

**ICS export button.** A ghost pill with a calendar glyph: "Add to calendar" (detail, per countdown) or
"Calendar" (home, all upcoming). It downloads `.ics` with alarms at each spec warning stage and confirms with a
toast "Calendar file saved".

## 7. Screens

Desktop is 1280 wide and phone is 390. `[P]` = the screen's one primary pill.

**Home / list**
```
DESKTOP                                                               PHONE
+------------------------------------------------------------------+  +----------------------------+
| (bone) Pantry Reaper    Items  Import  Backup   [Calendar] [P Add]|  | (bone) Pantry Reaper   (..)|
|                                                                  |  |                            |
|  3 things die this week               +------+ +------+ +------+ |  | 3 things die               |
|  Chicken tonight, spinach tomorrow.   | 2    | | 3    | | 19   | |  | this week                  |
|                                       |Eat   | |Use   | |Fresh | |  | Chicken tonight, spinach.. |
|                                       |today | |soon  | |      | |  |                            |
|                                       +------+ +------+ +------+ |  | [All 24][Fridge 14][Freez..|
|  [All 24] [Fridge 14] [Freezer 6] [Pantry 4]                     |  |                            |
|                                                                  |  | (! Eat today)  2 items     |
|  (! Eat today)  2 items                                          |  | +------------------------+ |
|  +-------------------+ +-------------------+                     |  | |[c] Chicken thighs Today| |
|  | [c] Today (!Eat)  | | [c] 1 day  (!Eat) |                     |  | |[c] Spinach          1  | |
|  | Chicken thighs    | | Baby spinach      |                     |  | +------------------------+ |
|  | Meat . Fridge     | | Produce . Fridge  |                     |  | (~ Use soon)  3 items      |
|  +-------------------+ +-------------------+                     |  | +------------------------+ |
|  (~ Use soon)  3 items                                           |  | |[c] Greek yogurt     2  | |
|  +-------------------+ +-------------------+ +-----------------+ |  |  ...                       |
+------------------------------------------------------------------+  | [Items] (P + Add item) [Bk]|
                                                                      +----------------------------+
```
The status headline is the title (`--t-display`) and comes from the spec's `copy.summary` template. The
supporting line names the first two items. The stat cards on desktop are stage filters (number `--t-num-l`).
On phone the chip row replaces them.

**Item detail + explain trace**
```
DESKTOP (Pantry Reaper)                                               PHONE
+------------------------------------------------------------------+  +----------------------------+
| <- Items                                    (edit) (del) [P Used it]| | <- Greek yogurt   (edit)   |
|  Greek yogurt                                                     |  |                            |
|  Dairy . bought Mon 9 Nov                                         |  |        [candle l]          |
|  +----------------------------------+ +-------------------------+ |  |        2 days              |
|  |  [candle l]   2  days            | | WHY THIS DATE           | |  |   (~ Use soon) Fri 20 Nov  |
|  |               (~ Use soon)       | | o Base 14 days          | |  |                            |
|  |               Fri 20 Nov         | | o Opened  -7 days       | |  | [Fridge|Freezer|Pantry]    |
|  |  STORAGE                         | | - - - - - - - - - - -   | |  | Why this date? ->          |
|  |  [ Fridge | Freezer | Pantry ]   | | Expires Fri 20 Nov = 2  | |  | [Add to calendar]          |
|  |  [Add to calendar]               | +-------------------------+ |  |                            |
|  +----------------------------------+                             |  |    (P Used it) full width  |
+------------------------------------------------------------------+  +----------------------------+
```
Grid: 7 / 5 columns, gap 24. The primary action label comes from the spec (`actions.done.label`: "Used it",
"Done with it"). Switching storage runs the date jump plus the toast with Undo.

**Warranty Wraith detail** (two countdowns side by side, recall above)
```
+------------------------------------------------------------------+   PHONE: banner, then the two
| <- Items                                  (edit) (del) [P Done]  |   countdown cards side by side
|  Acme K2 kettle          Kitchen . bought 2 Nov . $89            |   (2 x 171px: ghost s, number
|  [! Possible recall match  CPSC 24-117 ...  Read notice  Not mine]|   --t-num-m, pill), then the
|  +----------------------+ +----------------------+ +------------+ |   trace link, then the sticky
|  | RETURN WINDOW        | | WARRANTY             | | WHY THESE  | |   footer [P Done].
|  | [ghost] 12 days      | | [ghost] 1 yr 11 mo   | | DATES      | |
|  | (~ Closing) 26 Nov   | | (* Covered) 2 Nov 28 | | o Return.. | |
|  | [Add to calendar]    | | [Add to calendar]    | | o Warranty | |
|  +----------------------+ +----------------------+ +------------+ |
+------------------------------------------------------------------+
```
Countdown cards are 4/4 columns with the trace in 4. Each card has its own ghost, number, pill, date and ICS
button. The card that dies first is listed first.

**Add / edit sheet**
```
DESKTOP: list dims behind the scrim; sheet docked right    PHONE: bottom sheet, 92dvh
                     +---------------------------+         +----------------------------+
                     | Add item             (x)  |         |           ----             |
                     | [candle m] Expires in 4   |         | Add item              (x)  |
                     |  days . Fri 20 (~ Soon)   |         | [c] Expires in 4 days      |
                     | Suggested: 3-5 days (USDA)|         | Name   [______________]    |
                     | Name     [____________]   |         | Kind   [Dairy        v]    |
                     | Kind     [Dairy      v]   |         | Stored [Fridge|Freez|Pant] |
                     | Stored   [Fridge|Freezer|Pantry]    | Bought [Mon 9 Nov     cal] |
                     | Bought   [Mon 9 Nov  cal] |         | Opened [ off  ]            |
                     |                [P Save]   |         | (P Save item) sticky       |
                     +---------------------------+         +----------------------------+
```

**Import** (desktop dialog 720, phone 3-step full screen)
```
+------------------------------------------------------+
| Import                                          (x)  |
| [ Paste CSV | Upload file | Restore backup ]          |
| +--------------------------------------------------+ |
| | name,stored,bought ...                           | |
| +--------------------------------------------------+ |
| MAP COLUMNS        name -> [Name v]  stored -> [Stored v] |
| PREVIEW            [c] Milk          4 days               |
|                    [c] Rice          (! No date) skipped  |
| 24 ready . 2 skipped                  [P Import 24 items] |
+------------------------------------------------------+
```

**Launcher** (core theme). One headline, one line, one action, one strong visual.
```
DESKTOP                                                    PHONE
+-----------------------------------------------------+    +---------------------------+
| (bone) Ossuary                         GitHub  Remix|    | (bone) Ossuary            |
|                                                     |    | Everything expires.       |
|  Everything expires.          +---------+           |    | Know when.                |
|  Know when.                   | candle  |+--------+ |    | One JSON bone spec turns  |
|  One JSON bone spec turns any | Pantry  || ghost  | |    | any lifespan into a ...   |
|  lifespan into a local-first  | Reaper  || Wraith | |    | [Pantry card: tap]        |
|  countdown app.               +---------+|        | |    | [Wraith card: tap]        |
|  [P Make your own]                       +--------+ |    | (P Make your own) bottom  |
+-----------------------------------------------------+    +---------------------------+
```
The headline is `--t-display` at 64px/68px on desktop. The visual is the two app cards, each a real link
(rotated −3° / +2°, `--shadow-3`, in its own app tint and display face, with a live `xl` motif). "Make your
own" opens the remix guide.

## 8. Illustrations

- **Original inline SVG only**, drawn in code (procedural parameters, no traced or stock assets). Generic
  icons may come from Lucide (ISC licence), inlined, 24px with 1.75px stroke.
- **Style:** 2px stroke (2.5px at `xl`) in `--motif-ink`/`--text`, round caps and joins, flat fills from the
  surface, `--accent-tint`, one accent and the motif's own colours (wax cream `#f6efe3`, flame `#f59e0b`/`#fde68a`).
  No gradients or textures inside art. **Light is not art:** in the crypt, the flame halo, the ghost glow and
  the card glows are blurred light (CSS blur/drop-shadow/box-shadow), driven by tokens that are 0 in light mode. Generous negative space with a slight hand wobble (±0.5px
  path jitter baked in, not random at runtime).
- **Needed:** motifs candle/ghost/hourglass × 5 tones × 4 sizes (procedural, one component); empty states:
  unlit candle + jar + crescent moon (Pantry), ghost asleep in a parcel box (Wraith), hourglass on its side
  (core); the launcher's two card heroes (reuse the motifs at `xl`); the bone wordmark glyph (a single 20px bone
  on its side); 5 stage glyphs; an import glyph (a stacked sheet with an arrow); the recall alert glyph.

## 9. Accessibility

- **Contrast:** all text tokens and pills are ≥4.5:1 in both modes (ratios in sections 2-4). axe runs on every
  screen in the crypt (the default) and the light mode. UI boundaries (inputs, the
  selected chip ring, the focus ring) are ≥3:1. Accent focus vs canvas: Pantry 4.67, Wraith 5.44, core 5.47.
- **Focus:** `:focus-visible { outline: var(--focus); outline-offset: 2px; }` on everything interactive, never
  removed. Cards ring the whole card. Sheets and dialogs trap focus, return it on close, and close on Esc.
- **Countdown text:** each item exposes one sentence: `aria-label="Greek yogurt. Use soon. Expires in 2 days,
  Friday 20 November."` with a `<time datetime="2026-11-20">`. Visual digits are `aria-hidden` inside the
  labelled card. Countdowns are not live regions. They refresh at most once a minute silently. Stage changes
  after user actions are announced through the toast.
- **Targets:** ≥44x44px everywhere (chips, segments, icon buttons, steppers, rows). Primary pills are 52-56px.
- **Motion:** honour `prefers-reduced-motion` (section 5). No motion carries meaning on its own. Nothing
  flashes more than 3 times per second, including the urgent flicker (≤1.2Hz).
- **Semantics:** real `<button>`, `<a>`, `<input>`, `<label for>`. Segmented controls are radiogroups. The list
  uses `<section aria-labelledby>` per stage group. Use `lang` on `<html>`. Zoom to 200% without horizontal
  scroll at 390px.

## 10. Sign-off checklist (judge each UI feature)

1. The crypt is the default: a stone canvas in the app's hue, lit stone slabs at 16-20px radius, bone type. Light mode
   still works from the toggle. No bordered boxes, no flat grey admin panels, no pure black.
2. There is exactly one primary pill on the screen (bone in the crypt, near-black in light; bottom on phone). The accent is used only for links, selection, charts and focus.
3. The first thing on the screen is a title, a status headline or the primary action.
4. Countdown numbers are large, tabular and in the display face, with a muted unit beside them and the absolute date nearby.
5. Every status is a tinted pill with a word and a glyph from the five tone slots. No colour-only state.
6. Lists are grouped by stage with pill + count headers, and rows read as motif · name · kind/short line · number.
7. Both decay motifs reflect fraction and stage, always sit next to text, idle only on detail/hover, and are static under reduced motion.
8. Pantry Reaper and Warranty Wraith are recognisably different at a glance (canvas warmth, accent, display font, motif, voice) with no component forks.
9. Phone at 390px has one job per screen and no horizontal scroll, and is not a shrunk desktop table.
10. Keyboard: every action is reachable, the focus ring is visible, sheets trap and restore focus, and Esc closes.
11. Targets are ≥44px. Text contrast is ≥4.5:1 (checked with the tokens, not eyeballed).
12. Tokens come only from this file or the spec `theme` block. No hard-coded colours, radii or durations in components.
13. A judge sees a haunting at a glance: candles visibly burnt down, ghosts fading, a glow on what is about to die,
    dead items as ghost cards. Still no props (bats, skulls, cobwebs, drip fonts) and nothing cheesy.
14. Empty, loading, error and dead states exist for the feature, and each has one line + one action.
