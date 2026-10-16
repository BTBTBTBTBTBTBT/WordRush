# Time-of-day wallpapers (mockup, 10-16)

## BUILT (10-16 pm): core + registry + art + web (iOS / Android per their reports)

- Core: `timeOfDay(hour)`, `timeOfDayAt(date)`, `nextTimeOfDayChange(date)` in packages/core/src/time-of-day.ts (+ Swift `TimeOfDay`, Kotlin `TimeOfDay`, fixture time-of-day-fixtures.json via gen-parity-fixtures.ts).
- Registry: `slots.walls.<name>` and `slots.stage` take a string OR `{night, morning, day, evening}` (night = base + fallback); `surfaces.tod.<morning|day|evening>` = partial override of the base (night); `tod.<t>.tone: "light"` flips only the on-wall ink (`wallInk`), never the card tone. Art names: `<name>-<time>` (night = `<name>`).
- Art: Thanksgiving + Halloween walls for every page x 3 times (`walls/make-<season>-walls-tod.py`, shipped by `ship-art.py --seasons`), stages per time from `stage/chatgpt*/`.
- Web: `lib/time-of-day.ts` (one store, one timer to the next boundary, `?tod=` / Settings > Time of day admin override), `SeasonWallLayer` crossfade + next-wall prewarm, `StageFrame` stage crossfade, surfaces as REGISTERED custom properties that ease over 600 ms (`html[data-tod-fade]`), launch screen wall by clock, share-sheet glass + idle key face + tab idle ink on palette roles.
- Not done (web): on-wall chrome ink (`--season-wall-ink` / `html[data-wall-ink]` are set, nothing reads them yet), softMix pills / Leaderboard your-row mix over `card`, Friends/family sheets in light seasons.

## v2 (10-16 pm): every window, every button tinted from the same sky — `mockup-sheet-v2.jpg`

Founder 10-16: "the windows on all the pages are clashing now, can we change the color to blend in seamlessly as
the day screens change keeping the readability intact" / "the pages need to look like one finished product" /
buttons too: "if they need to change color based on the color of the screens and aesthetic, don't leave those behind".

`mockup-sheet-v2.jpg` = 4 rows (morning / day / evening / night) x 3 real captures (Home, Leaderboard, the Flawless
finished-game sheet) over that time's wall, with every window re-tinted from the per-time SURFACE palette below
(`make-mockup-sheet-v2.py`; the recolor shifts only the dark card ground inside each window by the palette delta, so
lettering, icons, drips and gloss are the app's own pixels). New walls here: `thanksgiving-leaderboard-*.webp`
(same `tod` parameter; `render-walls.py [page ...] [tod ...]`). Night is still byte-identical to the shipped wall
(max pixel diff 0 after the sun fix).

### The per-time surface palette (same keys as registry `surfaces`; night = the shipped values)

| key | NIGHT (base) | MORNING | DAY | EVENING |
|---|---|---|---|---|
| tone | dark | dark | dark | dark |
| card @ cardOpacity | #2A1419 @ .92 | #4A3049 @ .90 | #303C64 @ .88 | #3A1A2C @ .92 |
| hero | #26121A | #432A42 | #2B365C | #341627 |
| raised (chips, quiet buttons, idle chips, tray) | #3E2029 | #5F4260 | #44538C | #553047 |
| cap (game-card drip top / mid / base) | #F7D08C / #EA580C / #5C1A12 | #FFE4BC / #F08C58 / #5A2C40 | #FFF2C6 / #F6A842 / #36305E | #FFD690 / #F0762C / #4C1622 |
| glow (card lift) | #EA580C | #F2A070 | #86ADF2 | #F28C3C |
| text / textMuted / textSecondary | #FFF4E8 / #D9BFA7 / #F1DCC6 | #FFF6EE / #E6CED4 / #F6E6E8 | #FFFFFF / #CDD6F0 / #E8EDFA | #FFF4E8 / #E6C4B2 / #F5DECB |
| headline, bannerGlow, capTint | unchanged | unchanged | unchanged | unchanged |

Why dark cards everywhere (decided by eye + numbers): a light cream card by day fixed nothing (v1 numbers: 13.4 vs
16.4) and split the product into two card systems. Instead the night card is LIFTED and HUE-SHIFTED toward each sky:
morning = dusty rose-mauve glass under the peach/rose horizon, day = deep periwinkle glass under the blue sky (the
same hue family as the sky, two stops darker, so it reads as the sky seen through tinted glass), evening = plum-amber
glass (close to night; the sky is already warm). Every window on the app is one of card / hero / raised, so the tint
reaches the Home stage card + icon tray, game cards, tab bar, chips, Leaderboard / Stats / Friends panels and rows,
sheets and dialogs, Settings rows, finished-game chips and score panels, the board tray and toasts, in one move.
`cap` keeps the game cards' drip trim warm (gold -> each game's color -> a base that matches the card), `glow` takes
the sky's light (blue by day, peach at sunrise).

### Buttons (per family, judged against each time's wall + card)

| family | per-time? | why | label contrast |
|---|---|---|---|
| candy purple (DAILY/UNLIMITED toggle, VIEW BOARD, selected chip) | NO | glossy brand purple reads on all four skies; day's periwinkle card makes it a sibling, morning/evening it is the one cool accent (good) | white on #7C3AED 6.4:1 |
| candy pink (SHARE) and gold (UNLIMITED idle cap) | NO | brand candies; the pink sits on the Flawless scrim, not the wall; gold label is dark ink | white on #E0427A 4.6:1; #3A1A08 on #F5C04A 9.8:1 |
| quiet buttons (CLOSE, Friends quiet buttons, share/close docks) | YES = `raised` | they are card-family; today's hard night-plum would clash by day | see table (raised) |
| idle chips / pills (Friends toggle idle, stat chips, tray) | YES = `raised` / `card` | card-family | see table |
| tab bar + selected state | YES bar = `raised`->`card`; selected ink stays the season orange (#F97316 / #FDBA74) | the orange reads on every tinted bar (>= 4.5 on all four) and is the season's accent | #FDBA74 on tab composite, see table |
| ghost / outline buttons on the wall | ink = `text` | they inherit the on-wall ink | wall-chrome column |

### Readability gate (WCAG, measured on the composited pixels: card over the real wall at cardOpacity)

Pass = body >= 4.5:1, large / bold >= 3:1. "wall chrome" = the time's `text` (white) on the bare sky at the stats row;
"tab" = `textMuted` on the tinted tab bar.

| time | page | text on card | textMuted on card | textSecondary on card | white chrome on wall | textMuted on tab bar |
|---|---|---|---|---|---|---|
| morning | Home | 9.2 | 6.6 | 8.1 | 3.4 (large only) | 7.0 |
| morning | Leaderboard | 9.1 | 6.5 | 8.0 | 3.4 (large only) | 7.0 |
| morning | Flawless sheet | 10.9 | 7.8 | 9.6 | 15.2 (scrim) | - |
| day | Home | 9.0 | 6.2 | 7.7 | 3.9 (large only) | 6.6 |
| day | Leaderboard | 8.8 | 6.1 | 7.5 | 3.9 (large only) | 6.6 |
| day | Flawless sheet | 10.9 | 7.5 | 9.3 | 16.3 (scrim) | - |
| evening | Home | 13.5 | 9.0 | 11.3 | 12.2 | 9.3 |
| evening | Leaderboard | 13.5 | 9.0 | 11.3 | 12.2 | 9.3 |
| evening | Flawless sheet | 13.9 | 9.3 | 11.6 | 15.3 | - |
| night | Home | 16.0 | 9.9 | 13.1 | 16.2 | 10.0 |
| night | Leaderboard | 16.0 | 9.9 | 13.1 | 16.2 | 10.0 |
| night | Flawless sheet | 15.6 | 9.6 | 12.7 | 15.3 | - |

Button labels (fill fixed, so the same at every time unless `raised`): candy purple white 5.7; candy pink (SHARE)
white 4.0 on a flat #E0427A sample (the real gloss gradient is lighter at the top: re-measure on the device; if it
is under 4.5 the label gets the existing dark rim, not a new fill); candy gold dark ink 9.4; quiet CLOSE on `raised`
8.0 / 6.8 / 10.2 / 13.4 (morning / day / evening / night); idle chip on `raised` 8.6 / 7.3 / 11.1 / 14.5; selected
chip white 5.7.

Reading: every on-card role passes body AA at every time (lowest: day textMuted on the lifted periwinkle card, 6.1).
The only sub-4.5 cells are the on-WALL white chrome at morning / day (3.4-3.9: passes large-text 3:1, since the
streak / shield digits are bold 17 pt+, but not body): the fix stays the v1 one — those on-wall labels get a dark
ink twin by day (`surfaces.tod.day.tone = "light"` flips only the on-wall ink; the cards keep their light ink), which
this mockup does not draw. Nothing else needs a scrim.

### Surface inventory (what follows the palette today vs hard-coded; code change needed before the per-time tint lands)

Follows `card` / `hero` / `raised` already (x3): Home hero + icon tray, game cards (+ cap, glow), Leaderboard panels,
Stats panels, Friends panels (dark seasons), family confirm sheet (dark), Pro sheet, generic dialogs / SoftSheet,
Settings rows (web, Android), board tray, finished-game cards. Hard-coded today, so they will NOT follow the tint
until fixed (file list in the inventory, 10-16 agent):
1. Tab-bar inks + selected pill: fixed orange on all three (web globals.css ~953, iOS RootTabView.swift ~639-691,
   Android MainScreen.kt ~212-231) — keep orange but read it from a new `surfaces.tabInk` so a season can override.
2. Share sheet: its own night gradient on all three (web share-sheet.tsx ~202, iOS ShareKit.swift ~29, Android
   ShareSheetV2.kt ~146) -> `card`/`raised`.
3. Keyboard key faces (web globals.css ~1340, iOS KeyboardView.swift ~314, Android KeyboardView.kt ~178) -> `raised`.
4. iOS / Android pill, toast and Settings-row helpers are not season-aware (TintedPill FinishKit.swift ~530,
   FeedbackToastKit.swift ~179, SettingsView.swift ~415; Android FinishKit.kt ~95-100, FeedbackToast.kt ~387) ->
   `raised` at the card opacity.
5. Web `softMix` pills mix toward #fff (soft-surface.ts ~57); Leaderboard your-row gold mix and Stats bars; finished
   score-breakdown washes — brand accents, keep, but mix over `card` not white.
6. Friends panel / sheet and family sheet only follow the season in dark tones — fine for Thanksgiving, note for a
   light season.

### Data shape + crossfade (proposal, no code)

```json
"surfaces": {
  "tone": "dark", "card": "#2A1419", "cardOpacity": 0.92, "...": "night = the base, as today",
  "tod": {
    "morning": { "card": "#4A3049", "cardOpacity": 0.90, "hero": "#432A42", "raised": "#5F4260",
                 "cap": ["#FFE4BC", "#F08C58", "#5A2C40"], "glow": "#F2A070",
                 "text": "#FFF6EE", "textMuted": "#E6CED4", "textSecondary": "#F6E6E8" },
    "day":     { "card": "#303C64", "cardOpacity": 0.88, "hero": "#2B365C", "raised": "#44538C",
                 "cap": ["#FFF2C6", "#F6A842", "#36305E"], "glow": "#86ADF2",
                 "text": "#FFFFFF", "textMuted": "#CDD6F0", "textSecondary": "#E8EDFA" },
    "evening": { "card": "#3A1A2C", "hero": "#341627", "raised": "#553047",
                 "cap": ["#FFD690", "#F0762C", "#4C1622"], "glow": "#F28C3C",
                 "textMuted": "#E6C4B2", "textSecondary": "#F5DECB" }
  }
}
```

- `surfaces.tod.<slot>` is a partial override of the base (= night); any missing key keeps the base. Resolved once per
  slot change by a pure core function `surfacesFor(season, slot)` (TS + Swift + Kotlin ports, parity fixture of the
  resolved object for all four slots), next to `wallFor(page, hour)` from v1.
- Crossfade: the surfaces change at the same moment as the wall, with the same 600 ms curve. Web: the resolved
  values go into the same CSS custom properties `surfaceCssVars` sets today, with `transition: background-color,
  color 600ms` on the card / text roles (no transition on layout). iOS: the `Look` object becomes `@Published`;
  `withAnimation(.easeInOut(duration: 0.6))` on the swap animates every `Color` that reads it (SwiftUI interpolates
  colors; the two-layer `Image` crossfade from v1 runs under the same animation). Android: `WTheme.season` becomes
  `State`; `animateColorAsState(600 ms)` wrappers on `cardFill` / `heroFill` / `surfaceAlt` / text colors so every
  Composable that reads them tweens. Never mid-scroll (same idle rule as the wall swap); never per-frame work after
  the 600 ms.
- Debug: the v1 key `debug-wall-tod` (web `?tod=`) flips surfaces and wall together.
- Code plan (one batch, x3): (1) registry: `tod` under `surfaces` + loader types; (2) core `surfacesFor` + fixtures;
  (3) the hard-coded surfaces above moved onto roles (tab ink, share sheet, keys, pills/toasts/settings); (4)
  crossfade; (5) sim captures of every page at all four slots through the readability gate.

Mockup caveats: the Home hero stage card is a night-lit scene in every row (a daytime stage is a separate art ask);
the Flawless sheet keeps its own pink glow (the app draws it) over the dimmed time-of-day wall; the Leaderboard
podium panel's scene art takes the panel tint with it (in the app only the panel ground would).

### Morning sun fix

The v1 morning sun rendered as an empty ring: the horizon haze band was painted AFTER the disc in nearly the disc's
own color, so only the limb survived. Now the haze goes down first, then the halos (warmer, larger: amber 0.62 x 4.8r,
gold 0.72 x 2.1r), then a disc with a bright core (`sun_disc(..., core=)`), so it reads as a low sunrise ball with a
soft glow over the left field. The random stream is untouched (hills, corn, fence, geese identical); night is byte-
identical to the shipped wall.

---

## v1 (10-16 noon): the walls — `mockup-sheet.jpg`

Founder 10-16: "Why aren't any of the wallpapers daytime? Can we do different wallpapers to match the time of day?"
This folder is the approved MOCKUP only: no app code, nothing wired. Judge `mockup-sheet.jpg` first.

## What is here

- `thanksgiving-home-{morning,day,evening,night}.webp` — the Thanksgiving HOME wall (phone 1290 x 2796) in four
  times of day, the SAME scene (barn + silo, corn, split-rail fence, two field hills, geese). Rendered by the v2
  engine `../thanksgiving/walls/make-thanksgiving-walls-v2.py`, which gained a `tod` parameter on `harvest()`
  (`night` = the shipped look, byte-identical to `wall-home.webp`; verified max pixel diff 0). The scene uses the
  same random stream in every time of day, so hills, corn, fence and geese never move between variants.
  - MORNING: pale peach / rose horizon under a soft blue sky, low hazy sun over the left field, no stars, five
    birds, pink-lit wisps, barn windows off, grey-violet silhouettes, strong pale mist.
  - DAY: clear blue with soft cumulus, the sun high where the harvest moon sits, no stars, golden stubble fields,
    windows off.
  - EVENING: golden-hour dusk (plum -> amber -> gold), a big low sun on the right with a wide warm halo, amber
    cloud streaks, a few faint stars at the very top, windows warming up (75%).
  - NIGHT: today's v2 harvest dusk, untouched.
- `render-walls.py` — renders the four walls (one line each, `python3 render-walls.py [tod ...]`).
- `make-mockup-sheet.py` + `mockup-sheet.jpg` — the real Home capture (`docs/review/thanksgiving-preview/
  ios-home-thanksgiving.png`, harvest-stage build, 12:27) laid over each wall, with the real `titles/dailies.png`
  re-placed at its in-app size and spot. MORNING and DAY get two phones: today's night cards as-is, and a
  light-card treatment (the Dailies cards recolored to cream -> lavender with dark ink; the icon tray and hero
  stage are left alone).

## Contrast check (WCAG, text color vs the local wall under it; large lettering >= 3:1, body >= 4.5:1)

| | title fill (red) | title rim (dark) | stats digits (white) | card labels |
|---|---|---|---|---|
| Morning, dark cards | 3.2 | 13.9 | 3.6 | 16.4 |
| Morning, light cards | 3.2 | 13.9 | 3.6 | 13.4 |
| Day, dark cards | 3.0 | 13.2 | 3.9 | 16.4 |
| Day, light cards | 3.0 | 13.2 | 3.9 | 13.4 |
| Evening | 1.9 | 8.5 | 13.3 | 16.4 |
| Night (today) | 1.2 | 3.8 | 17.6 | 16.4 |

Reading: the Thanksgiving titles carry a dark rim, so they hold on every sky (the rim is what gives the edge; the
red fill alone is marginal everywhere, as it is today). The weak spot by day is the WHITE on-wall chrome: streak /
shield digits sit at 3.6-3.9:1 over a morning / day sky (passes large-text 3:1, fails body 4.5:1) versus 13-18:1
at dusk and night. The cards themselves are fine either way; the light treatment is a feel choice, not a
readability fix. Recommendation: keep the dark cards (one card system, no light-twin art) and give the on-wall
white chrome (stats row, "WORDOCIOUS 0/8" labels, status bar) a dark-ink twin by day, i.e. the registry's
existing `surfaces.tone` flipping to `light` for morning / day. This is the same mechanism light mode uses.

Mockup caveats: the app composites the wall with its own scrim and the capture's skyline is not a plain resize of
the wall file, so the band around the icon tray shows a sliver of the night capture; the hero stage card is a
night-lit scene in every column (a daytime stage would be a separate art ask).

## Schedule proposal

Local device time, evaluated when a page appears and on a 60 s timer / foreground:

| slot | hours (local) |
|---|---|
| morning | 05:00 - 09:59 |
| day | 10:00 - 15:59 |
| evening | 16:00 - 18:59 |
| night | 19:00 - 04:59 |

- Crossfade on change: 600 ms opacity crossfade between the two static images (two `Image` / `ImageView` /
  `<img>` layers, old fades out over new). Never animate mid-scroll: the swap waits until the scroll view is idle.
- Perf: static image swap ONLY. No live sky, no particle layers, no per-frame work (perf gate 10-10 stands). Four
  webp walls per page = +~90 KB each (home: 71-92 KB); the night wall is the one already shipped.
- Wall selection is a pure function `wallFor(page, hour)` in core (TS) with Swift / Kotlin ports and a parity
  fixture (hour -> slot, plus the boundary minutes), like SEASON_WINDOWS.
- Debug: `debug-wall-tod = morning|day|evening|night|auto` (web `?tod=`) so Brian can flip through on a device.

## Registry shape

Today `walls.<normal-name>` maps to one seasonal wall. The time-of-day variant adds an optional object form:

```json
"walls": {
  "art-wall-home": {
    "night":   "art-wall-thanksgiving-home",
    "morning": "art-wall-thanksgiving-home-morning",
    "day":     "art-wall-thanksgiving-home-day",
    "evening": "art-wall-thanksgiving-home-evening"
  },
  "art-wall-leaderboard": "art-wall-thanksgiving-leaderboard"
}
```

- A string value keeps today's behavior (one wall, all day). An object is read as `walls.<page>.<time>`; `night`
  is required and is the fallback for any missing or unshipped slot, so a season can ship one or two daytime
  walls first. `-light` twins stay a separate axis (`<name>-light` still wins in light mode).
- `surfaces` gets the same optional per-time override (`surfaces.tod.day = { tone: "light", ... }`) so the on-wall
  chrome can flip ink with the sky; absent = today's dark-tone surfaces.
- Non-seasonal (normal) walls can use the same object form later; nothing about this is Thanksgiving-specific.

## Next if approved

1. Founder picks: light cards or dark cards by day; whether evening stays close to today's look (it does here).
2. Render the other four pages (games, leaderboard, stats, friends) x three new times with the same `tod`
   parameter (~25 s per page); wide walls too.
3. Core `wallFor` + fixtures, registry object form in the three loaders, crossfade, debug key, parity ×3.
