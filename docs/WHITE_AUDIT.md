# Plain-white surface audit (2026-10-02)

Founder: "We should check across the site how many remaining white background things we have and
polish them all accordingly." Rule for the build: no plain-white card, tile, pill, chip, popover,
sheet or row anywhere — every surface takes a soft wash of its accent (or the page's accent) with
the game-card treatment (tint + border + top bar where it is a card). Counts are from grep (not rendered).

## Fastest levers (change once, fixes most screens)
1. The surface palette token: web `apps/web/app/globals.css` `--color-surface: #ffffff` (:root, Ocean, Forest; ~180 uses);
   iOS `ThemeManager.swift` `surface: 0xFFFFFF` → `Theme.surface` (115 uses); Android `ui/theme/Theme.kt` `surface`
   (131 uses) which also feeds the Material scheme (`surface`, `surfaceContainer*` → every M3 Card, AlertDialog,
   ModalBottomSheet, TextField, DropdownMenu). Web shadcn `--card`/`--popover` are white too (mostly admin).
2. VS / Friends card helpers: web `vsCardStyle` (`components/vs/vs-ui.tsx`), `RESULT_CARD` (`vs-result-detail.tsx`),
   `cardStyle` (`components/friends/friends-ui.tsx`); iOS `vsCard()` (`VsLobbyKit.swift`, ~40 uses);
   Android `Modifier.friendsCard()` (`ui/friends/FriendsKit.kt`) + `Modifier.vsCard()` (`ui/vs/VSKit.kt`), ~40 uses.
3. Header circles / pills: web `page-header.tsx` `circleStyle`, `app-header.tsx:39,54` (#fff), game header buttons
   (`game-home-button.tsx`, `game-guide-button.tsx`, `sound-toggle.tsx`); iOS `HeaderKit.swift`, `AppHeaderView.swift`;
   Android `Modifier.softWhite()` (`ui/HeaderKit.kt`). (These become the bubble-free soft 3D icons anyway.)
4. Light game-tile tone: web `TONE.light` (`components/ui/game-tile.tsx`); iOS `GameTile.swift` `base: .white`;
   Android `VsModeTile` / `surface = Color.White` callers — used by the VS lobby, Leaderboard mode picker, Friends
   panel and quick-play sheet. → tint with the game's accent + top bar.
5. Web post-game "definition" rows: `bg-white rounded-xl p-3` in ~13 game files (regions, spyglass, crossword,
   ladder, cryptogram, groups, sudoku, muddle, hub, propernoundle ×3, completed-custom-daily).

## By screen (W web · I iOS · A Android)
- Home: mode / WOTD / VS cards (shared helpers: W `modeCardSurface()`, I `ModeCardView.swift`, A `ModeCardView.kt`);
  banner chips + segmented toggle (W `home-banner.tsx`, I `HomeBannerView.swift`, A `HomeBannerView.kt`);
  floating tab bar (W `.tab-pill`, I `RootTabView.swift`, A `MainScreen.kt`); `.banner-frost` (W globals.css).
- Game screens: empty board tiles (W `board.tsx`, mini/multi/completed boards, ladder; I `BoardView.swift`
  incl. active board `.white`; A `TileView.kt`, `MuddleScreen.kt`, `GauntletViews.kt`, `MultiBoardLayout.kt`),
  web `lib/tile-theme.ts` empty tile `#ffffff`; board panels in Sudoku, Regions, Cipher, Spyglass, Groups, Hub,
  Crossword (surface). Keyboard keys are already lilac (#e8e5f0), not white.
- Post-game: definition rows (above), Gauntlet results modal, next-daily CTA, celebrations (white @0.7).
- Leaderboard / Records: mode-picker icon tiles forced white (W `leaderboard-banner.tsx`, I
  `LeaderboardBannerView.swift`, A `LeaderboardBanner.kt`), segmented "on" pill, rows/cards (surface).
- Stats / Profile: all via surface (~30 W components, ~10 I views, ~8 A screens).
- Friends: `cardStyle` + popovers / modals / reaction popover / quick-play pills (W ~15 spots, I ~12, A ~12).
- VS: `vsCard` everywhere (W ~15 hard-coded, I ~25, A ~30) incl. queue, HUD, intro, results, challenges, bots.
- Settings / Edit profile, Pro sheet, modals (welcome, limits, streak shield `Color.white`, menu, auth, invite,
  share sheets, confirm, stat popover): surface + M3 containers.
- Info / footer pages: surface on all; WOTD letter tiles hard white (W `app/word/[date]`, I `InfoMenu.swift`,
  A `InfoNavScreens.kt`); W `lib/portal-html.ts` `--surface`.
- Share images: W `lib/share-image.ts` (`EMPTY = '#ffffff'`, stat tiles, leaderboard date chip + panel), OG card
  (`app/api/og/route.tsx`); I `ShareCardView`, `DailySweepShare`, `LeaderboardShare`; A `ShareImage.kt`,
  `DailySweepShare.kt`, `LeaderboardShare.kt`.
- Widgets: I `WordociousWidget.swift` unplayed chip (white @0.72); A `DailyWidgetProvider.kt` + `widget_chip_*.xml`.
- Web admin pages: ~70 `bg-white` — out of scope.

## Rough counts
| | token uses | hard-coded white | white helper uses |
|---|---|---|---|
| Web (excl. admin) | ~180 | ~80 | — |
| iOS | 115 | ~40 | ~40 (`vsCard`) |
| Android | 131 + M3 | ~45 | ~43 (`friendsCard`/`vsCard`/`softWhite`) |
