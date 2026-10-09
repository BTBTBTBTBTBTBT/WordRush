# 2.8 inventory — buttons not on the family style

Date: 2026-10-09. Feeds Friday-queue item 23 ("Every button in the app on the ChatGPT family style"). Read-only grep audit of the three apps (web `apps/web/components` + `apps/web/app` minus admin; iOS `apps/ios/Wordocious/Sources`; Android `apps/android/app/src/main/kotlin`), paths below are relative to those roots.

**Method.** Every tappable was paired with the thing that draws it. iOS: each `Button(`/`Button {` was matched to its `.buttonStyle(...)` (340 Buttons, 342 styles — every Button carries a style). Android: `Button(`/`OutlinedButton(`/`TextButton(`/`IconButton(` (all 0 raw Material uses) plus the two tap modifiers `.squishClickable(` (121) and raw `.clickable`/`combinedClickable`/`pressScale` (~16 outside the family files). Web: every `<button` (154 outside `family-button.tsx`) plus the custom wrapper components. Repetitive sites (keyboards, chip grids) are one row per file with a count.

**What counts as "family".** The three family files and whatever routes into them:
- iOS `FamilyButtons.swift`: `HelperButtonStyle`, `QuietButtonStyle`, `RoundIconButtonStyle`, `FamilyCloseButton`. `CandyButtonStyle` (FinishKit.swift:159) is a *router* (`FamilyRouterBody`, FamilyButtons.swift:381): small → helper, circle → helper circle, peach → quiet, other medium/large → `CastButtonStyle` (the cast PRIMARY, CastButton.swift:185). So `CandyButtonStyle` (77 sites) and `CastButtonStyle` (78) are counted as family/primary, not as findings.
- Android `FamilyButtons.kt`: `HelperButton`, `QuietButton`, `RoundIconButton`, `FamCloseGlyph`. `CandyButton` (FinishKit.kt:523) and `CandyRoundButton` (:582) route the same way (one `when` → Quiet/Helper/Cast); `HintCandy` → HelperButton; `PinkButton` → CandyButton; `VsTealButton`/`UnlimitedMiniButton`/`ShareResultsCandy` → `CastButton`. All counted as family/primary.
- Web `family-button.tsx`: `HelperButton`, `QuietButton`, `RoundIconButton`, `FamCloseGlyph`. The family look lives on the `.candy` CSS classes (`candy candy-sm` = helper, `candy-round` = circle, `candy-peach` = quiet, `.fam-round` = round icon), so `CandyButton`/`CandyLink` (candy-button.tsx) and a raw `<button className={candyClass(...)}>` already render the family skin. They are listed below only as "family skin via class" (migration to the component is optional; the guard test should allow them). `CastButton` (cast-button.tsx:178) is the primary.

Non-family therefore means: iOS `.squish` / `.squishIcon` / `.squishCard` / `KeyPressStyle` / (dead) `PressableStyle`, `InstantButtonStyle`; Android `squishClickable` / raw `clickable` / `pressScale` / `HeaderCircle`; web a raw `<button>` with hand-rolled classes, `hdr-glyph`, `kkey`, `gtile`, etc.

## Summary

| platform | family call sites | routed into family (candy/cast) | non-family call sites | custom button-like wrappers |
|---|---|---|---|---|
| iOS | 16 styled (`Helper` 10 · `Quiet` 5 · `RoundIcon` 1) + `FamilyCloseButton` ≈ 9 | `CandyButtonStyle` 77 · `CastButtonStyle` 78 | **169** (`.squish` 135 · `.squishIcon` 19 · `KeyPressStyle` 12 · `.squishCard` 4; two matches are doc comments) | 16 structs + 1 modifier (`tintedPill`, 63 uses) |
| Android | ≈ 26 refs (`HelperButton` 9 · `QuietButton` 5 · `RoundIconButton` 9 · `FamCloseGlyph` 3; ~5 of these are inside the routers) | `CandyButton` 97 · `CandyRoundButton` 8 · `HintCandy` 6 · `PinkButton` 3 · `CastButton` 72 (+`VsTealButton` 12) | **≈ 133** (`squishClickable` 121 · raw `clickable`/`combinedClickable`/`pressScale` ≈ 12 real, rest are scrims/defs) | 12 composables |
| Web | 17 (`HelperButton` 1 · `QuietButton` 2 · `RoundIconButton` 6 · `FamCloseGlyph` 8) | `CandyButton` 100 · `CandyLink` 31 · raw `<button>` with `candyClass()`/`className="candy …"` ≈ 38 · `CastButton` 88 (+`TealButton` 5, `SoftPill` 2) | **≈ 112** raw `<button>` (of 154 total; `hdr-glyph` round icons 10 · keycaps 7 · tiles/cells ≈ 10 · the rest rows, cards, chips) | 19 components |

Game-helper rows (Delete · Shuffle · Hint · Check …) are already on the family on all three platforms (iOS `PuzCandyAction`/`CandyButtonStyle`, Android `HintCandy`/`CandyButton`, web `capsule()` → `candyClass`). The remaining work is: header/round icons, rows and cards that squish, chips/segmented pickers, keycaps, close X's, share icons, text links, and the three toggle styles.

Kinds used below: primary · quiet · icon · chip · toggle-seg · keycap · close X · share-copy · menu · tile · row/card · text-link.

## Home

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | HomeView.swift:881 | tile | game card (`cardBody(mode…)`) | `.squishCard`; keep as game card, not a pill |
| iOS | HomeBannerView.swift:431 | toggle-seg | Daily/Unlimited thumb (`CandyPill(sprite: .thumbOn)`) | old candy toggle sprite — twin Android HomeBannerView.kt:675, web play-mode-toggle.tsx:46/55 |
| iOS | HomeBannerView.swift:534 | tile | banner game card | `.squish` |
| iOS | HomeHostMascot.swift:90, :134 | tile / chip | host mascot tap · "dress up" invite bubble | `.squish`; Android HomeHost.kt:215, DressUp.kt:510 |
| iOS | TodayCard.swift:155, :198, :222, :266 | row / tile / chip | jump-to-moment · daily tile (`GameArtImage`) · stat chip (`.tintedPill`) | `.squish`; chip → HelperButton; Android TodayCard.kt:214/271/299, web today-card.tsx:102/186 |
| iOS | TodaysRace.swift:101 | icon | friend avatar → profile | `.squish`; Android TodaysRace.kt:170 |
| iOS | CompletedDailyCard.swift:92 | row | expand/collapse (chevron.down) | `.squish`; Android CompletedDailyBoard.kt:323/587, web collapsible-completed-card.tsx:62, completed-mini-board.tsx:313 |
| iOS | WordOfTheDayView.swift:86, :212 | card / row | WOTD card (`.squishCard`) · quiz choice rows | Android WordOfTheDayQuiz.kt:117/321, web word-of-the-day.tsx:114 |
| iOS | VSLiveTile.swift:58 · VSBannerView.swift:222 · FriendsBannerView.swift:121, :190 | tile / icon | VS live tile · VS banner tile · friend faces · race row | `.squish`; Android VSLiveTile.kt:106/111, VSBanner.kt:194, FriendsBanner.kt:155/171; web vs-live-tile.tsx:67/81, vs-banner.tsx:58, friends-banner.tsx:98/117 |
| iOS | VSBannerView.swift:105 | share-copy | `ShareLink` share icon | `.squishIcon` → RoundIconButtonStyle; web friends-panel.tsx:546 (`hdr-glyph`) |
| iOS | MoreGamesSheet.swift:22 | row | game row (`row(m)`) | `.squish`; Android MoreGamesSheet.kt:148 |
| iOS | InAppNotice.swift:147 | chip | notice action (gold-stroked capsule) | hand-drawn capsule → HelperButton/QuietButton |
| iOS | RootTabView.swift:622 | icon | tab-bar item (capsule indicator) | `.squishIcon`; keep (tab bar) |
| iOS | AppHeaderView.swift:138 · HeaderKit.swift:227 (`HeaderCircleButton`, 33 sites) | icon | header circle controls (bell, settings, back, home, help…) | `.squishIcon` + `HeaderCircleLabel` — this *is* the bare round icon; map to `RoundIconButtonStyle` (Android `HeaderCircle` 13 sites, web `hdr-glyph` 10) |
| Android | ModeCardView.kt:243, :296 | tile | home game cards | `squishClickable(card = true)` |
| Android | HomeBannerView.kt:530, :675 · HomeHost.kt:215 | tile / toggle / icon | banner card · Daily/Unlimited toggle (`CandyToggle.kt:118`, role Tab) · host mascot | — |
| Android | TodayCard.kt:214, :271, :299 · TodaysRace.kt:170 · CompletedDailyBoard.kt:323, :587 · WordOfTheDayQuiz.kt:117, :321 | row / chip / tile | see iOS twins | — |
| Android | VSLiveTile.kt:106, :111 · VSBanner.kt:194 · FriendsBanner.kt:155, :171 · LeaderboardBanner.kt:167 | tile | the four home banners' tap targets | — |
| Android | MoreGamesSheet.kt:148 · MainScreen.kt:173 (`.clickable`) · HeaderKit.kt:150 (`HeaderCircle`) | row / scrim / icon | — | `HeaderCircle` → RoundIconButton |
| web | ui/game-tile.tsx:105, :147 | tile | home game tiles | raw `<button>` + inline look; keep as tile |
| web | home/home-banner.tsx:125 (`data-squish="card"`), :277 (Unlimited switch), :515 (mascot) | tile / toggle / icon | banner card · Daily/Unlimited · "Your mascot" | toggle twin of iOS CandyPill |
| web | home/vs-live-tile.tsx:67, :81 · vs/vs-banner.tsx:58 · friends/friends-banner.tsx:98, :117 | tile | banner tap targets | — |
| web | home/word-of-the-day.tsx:114 · stats/today-card.tsx:102, :186 | row / chip | quiz choices · daily stat chips | — |
| web | ui/game-picker.tsx:57 · game/completed-mini-board.tsx:313 · game/collapsible-completed-card.tsx:62 | tile / row | — | — |
| web | ui/page-header.tsx:78 · ui/header-glyph.tsx:59 · ui/cast-header.tsx:270 | icon | `hdr-glyph` header circle (bell, settings, Pro gem…) | `.hdr-glyph` (globals.css:1208) ≈ `.fam-round`; fold into `RoundIconButton` (`fam-round` has 0 direct uses) |
| web | ui/play-mode-toggle.tsx:46, :55 | toggle-seg | Daily / Unlimited | hand-rolled rounded-full pair |

## Game boards / keyboards

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | KeyboardView.swift:153, :196, :222, :273 (×4) | keycap | space · ENTER/BACK · letters · fill letters | `KeyPressStyle` + `KeyCap` (FinishKit.swift:959) — family "keys" tier; keep, add to allow-list |
| iOS | LetterKeyboard.swift:92, :109, :124 (×3) · ProperNoundleView.swift:908, :927, :938, :946 (×4) · SudokuView.swift:541 | keycap | pocket/Noundle/Sudoku keys | `KeyPressStyle`; same |
| iOS | SudokuView.swift:508, :639 | icon / row | notes mode · guess-stat expander | `.squish` |
| iOS | CrosswordView.swift:664, :714, :751, :775 | tile / row / toggle | cell · clue row · dir toggle · Grid/Clues toggle | `.squish`; web crossword-game.tsx:397/404 are the same two toggles |
| iOS | CodebreakerView.swift:738, :771 | keycap / chip | code key · plaintext chip (hand capsule) | `.squish` |
| iOS | MuddleView.swift:917 · KindredView.swift:570 · RegionsView.swift:496 · HubView.swift:659 | tile | letter tiles / hex / region cells | `.squish`; Android MuddleScreen.kt:742/956/1075, KindredScreen.kt:613, StarsweepBoard.kt:225, PiecesKit.kt:152, CodebreakerScreen.kt:615; web hub-game.tsx:374, muddle-board.tsx:164, regions-board.tsx:130 (`ss-cell`), sudoku-board.tsx:62 (`gtile`), crossword-board.tsx:107/161, cipher-board.tsx:99/187, groups-board.tsx:96 |
| iOS | HeaderKit.swift:276 `GameCornerButton` (44 sites) | icon | in-game Home / Help corners | → `HeaderCircleButton` → `.squishIcon`; map to `RoundIconButtonStyle`. Web `game-home-button.tsx:55`, `game-guide-button.tsx:45`, `sound-toggle.tsx:30` (`hdr-glyph`) |
| iOS | GuideSheet.swift:288 | chip | guide link chip (`.tintedPill`) | → HelperButton; Android GuideSheet.kt:430 |
| Android | game/KeyboardView.kt:205, :246, :299, :345 · friends/FriendlyGameScreen.kt KeyCap ×5 (:725/729/847/936/945, private `KeyCap` :747) | keycap | keys | `squishClickable`; keep (keys tier) |
| Android | game/CrosswordScreen.kt:714, :842 (`CluesToggle`) · game/PadKit.kt:85 | tile / toggle / icon | — | — |
| web | game/keyboard.tsx:117, :187, :201, :222, :250 (×5) · sudoku/number-pad.tsx:50 | keycap | `kkey` keys | keep; allow-list `kkey` |
| web | crossword/crossword-game.tsx:397, :404 | toggle / icon | Across/Down · Clues | raw rounded buttons |
| web | *helper rows* spyglass-game 281/284/289 · cryptogram-game 398/403/406/411 · regions-pad 34/37/40/45 · ladder-game 314/318 · groups-game 361–376 · crossword-game 411–420 · muddle-game 417/420 · hub-game 459–465 (29) + hub-game 482/483 (`candyClass`) | chip | Delete/Shuffle/Hint/Check… | **family skin via class** (`capsule()` → `candyClass`); optional swap to `<HelperButton>` |

## Finished-game

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | FinishPages.swift:188 | toggle-seg | result toggle (`CandyPill(.thumbOn)` + `matchedGeometryEffect`) | old candy thumb sprite |
| iOS | FinishPages.swift:282, :302 | tile | next-game picker (`GameArtImage`, Sweep broom) | `.squish` |
| iOS | FinishPages.swift:500, :502 · :513 | row / icon | podium rows · bell | `.squish` / `.squishIcon` |
| iOS | FinishPages.swift:757 (`CandySwitchStyle`) | toggle | settings-row switch (`Toggle(` ×16 app-wide) | custom ToggleStyle; Android `CandySwitch` ×3, web `candy-switch.tsx:20` |
| iOS | FinishedScreenKit.swift:407 · PostGameViews.swift:160 · GauntletCompletedView.swift:98 | text-link / icon / chip | "Other games" · share icon · stage chip | `TextLinkLabel`, `.squishIcon`, `.tintedPill` |
| iOS | ShareVariantSheet.swift:26, :31 | row | share variant pick | `.squish`; web share-variant-modal.tsx:113 |
| Android | FinishPages.kt:313, :410 · BoardPodium.kt:233 · StatsFinish.kt:202, :316 · PopupFinish.kt:204 · FinishKit.kt:376 · VsFinish.kt:381 · InviteFinish.kt:346 | tile / row / icon | picker · podium · popup close (44 dp) | PopupFinish/FinishKit closes → `RoundIconButton(FamChrome.CLOSE)` |
| web | game/result-line.tsx:50 | share-copy | Share / Copied (`hdr-glyph`) | → RoundIconButton; `ShareResultsCandy` (finished-kit.tsx:354) is already Cast |
| web | share/share-variant-modal.tsx:113 · gauntlet/gauntlet-results.tsx:370 · leaderboard/podium.tsx:123 | row / icon | — | — |

## VS

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | VSLobbyView.swift:209, :270, :313, :327, :339, :364, :446 | tile / row | play tiles (Live / Bots / Friends) · next bot · challenge rows | `.squish`; Android VSLobbyScreen.kt:273/464, web vs-lobby.tsx:360 |
| iOS | VSFriendPage.swift:95 | toggle-seg | mode toggle (`CandyPill(.thumbOn)`) | third copy of the candy thumb |
| iOS | VSFriendPage.swift:154, :174 · VSBotsView.swift:216, :267 | row | friend rows · bot rungs ("Race it" via decorative `VSCandyTag`) | `.squish`; Android VSFriendPage.kt:104/208, VSBotsPage.kt:154/249; web vs-friend.tsx:140/159, vs-bots.tsx:162, vs-game.tsx:1493 |
| iOS | VSChallengeViews.swift:150 · InvitePanelView.swift:202 | share-copy | `ShareLink` / share code | `.squishIcon` → RoundIconButtonStyle |
| iOS | RecentMatchesList.swift:151 · InviteSheet.swift:75, :127 | row / menu | expand match · mode picker (chevron.down) · check row | `.squish`; Android RecentMatches.kt:301, InviteSheet.kt:152/174/303; web recent-matches.tsx:197, invite-modal.tsx:229 |
| iOS | VsLobbyKit.swift:559 `VSPrimaryButton` (15) | primary | VS CTAs | wraps `CastButtonStyle` — already primary; fold the struct away |
| Android | VSLiveSearch.kt:225 (role Switch) · VSPlayLimit.kt:89, :95 · VSIntro.kt:104 | toggle / scrim / text-link | "looking" switch · scrim close · Skip | Skip → QuietButton |
| web | vs/vs-game.tsx:1513, :1526, :1553, :1706 · vs-queue.tsx:178 · vs-notice.tsx:34 | row / card | opponent rows · notice card | raw |

## Friends

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | FriendsPanelView.swift:299, :334, :409, :452, :648, :765, :827, :867, :951 | row / tile | game rows · kind cards · race rows · friend rows · requests (`FriendsGlossyPill("Pending")` decorative) · taunt rows | `.squish` |
| iOS | FriendsPanelView.swift:373 | icon | share weekly race | `.squishIcon` → RoundIconButtonStyle |
| iOS | FriendsPanelView.swift:1364 | chip | red capsule action (decline/remove) | hand `Capsule().fill(0xDC2626)` → QuietButton/HelperButton pink |
| iOS | FriendsQuickPlaySheet.swift:195, :243, :262, :318 | row / chip | friend cells · stake chips | stake chips → HelperButton; Android QuickPlaySheet.kt:202/342/384; web quick-play-sheet.tsx:131/154/167/300 |
| iOS | ActivityFeedView.swift:344, :379 | chip | reaction chips (`softNumber` + capsule) | → HelperButton `on:`; Android ReactionArt.kt:104/175, ActivityFeed.kt:340; web activity-feed.tsx:300/366 |
| iOS | FriendlyGameScreen.swift:456, :490 | tile | pocket-game cells | keep (tile) |
| Android | FriendsPanel.kt:273, :489, :529, :662, :706, :945, :1085, :1171, :1264 · :830 (`combinedClickableNoRipple`) · FriendsNotice.kt:107 | row / tile / text-link | — | — |
| web | friends/friends-panel.tsx:478, :577, :890, :1006 | row / text-link | — | raw |
| web | friends/friends-panel.tsx:546 | share-copy | Share weekly race (`hdr-glyph`) | → RoundIconButton |
| web | friends/friends-panel.tsx:717 | menu | "More options" ⋯ | **family skin via class** (`candyClass peach sm`) |
| web | friends/friends-ui.tsx:211 (`Pill`, 3 sites) · friendly-boards.tsx:163, :243, :483 · notification-prefs.tsx:54, :74 | card / tile / icon | kind card · pocket cells · bell + pref rows | `Pill` is a card, misnamed |

## Leaderboard / Records

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | LeaderboardTab.swift:290 · RecordsTab.swift:779 | row | "Yesterday's winners" expander (`.tintedPill(gold)`) | `.squish`; Android RecordsScreen.kt:526 |
| iOS | LeaderboardTab.swift:786, :827, :1343 · LeaderboardKit.swift:139 (`LbShareButton`, 3) | icon / share-copy | taunt · share | `.squishIcon` → RoundIconButtonStyle |
| iOS | LeaderboardTab.swift:876 · RecordsTab.swift:312 · YourRecords.swift:443, :498 · LeaderboardKit.swift:359 | row / chip | taunt rows · record holder · Hall of Fame link · dress-up | — |
| iOS | LeaderboardTab.swift:1282 `InstantButtonStyle` | — | **defined, 0 uses** | delete |
| Android | LeaderboardScreen.kt:814 · RecordsScreen.kt:746 · YourRecords.kt:488 · BadgeKit.kt:541 | row | — | — |
| web | leaderboard/board-rows.tsx:193 (mascot), :330 (expander) · app/stats/page.tsx:482 | icon / row | — | `SegmentedPill` (board-rows.tsx:234) wraps `CandySegment` |

## Stats / Profile / Mascot

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | ProfileTab.swift:762, :794, :1072, :1136, :1164, :1410 | chip / row | Play/Open chip (`.tintedPill`) · mode rows · Dress up · "Private" lock pill · DEV·PRO pill (dashed capsule) · achievement | `.squish`; Android ProfileScreen.kt:868/903/1081/1158 |
| iOS | ProfileTab.swift:903, :922 | row | Sign Out · Delete Account (red) | → QuietButton (Sign out is a named quiet case) |
| iOS | ProfileTab.swift:1094 · ProIdentity.swift:83 · DressUp.swift:383 (`StageCloseButton`, 3) | share-copy / icon / close X | share profile · Pro badge · stage close | StageCloseButton already draws `art-fam-cic-close` — make it `FamilyCloseButton` |
| iOS | EditProfileView.swift:203, :227, :291, :300, :326, :391, :431, :483, :491 | row / icon / chip / menu | title row · dice (randomize) · backdrop swatches · ⋯ more · frame swatches · accent swatches · section card (`.squishCard`) · favorite None/mode chips | chips → HelperButton; ⋯ → RoundIcon; Android EditProfileScreen.kt:434/456/464/477/540/646/720; web profile-edit-modal.tsx:243/291/297/308/312/318/329/348/381 |
| iOS | MascotBuilder.swift:359, :393, :483, :670, :826 | icon / chip / tile | header icons (white glyph) · tab chips · option tiles (`MascotProPill` decorative) · tier rows | Android MascotBuilder.kt:264/324/396/441/456/531, DressingRoom.kt:122/201/220; web mascot-builder.tsx:148/222/264/297/310 (role=tab) |
| iOS | ProfileSocialViews.swift:209, :398, :663, :729, :807, :876, :1023 | chip / row / card | archetype pill · today-vs row · section card · nemesis rows · calendar | — |
| iOS | PublicProfileView.swift:540 · ProfileCharts.swift:233 · TitleShelves.swift:225 · AvatarCast.swift:275, :332 · AchievementService.swift:438 · AchievementUnlockPopup.swift:528 · Mascots.swift:543 | row / tile / share / text-link | — | AchievementUnlockPopup share → RoundIcon; Mascots "Play without an account" → QuietButton |
| iOS | StatKit.swift:326 `PressableStyle` | — | **defined, 0 uses** (doc comment only) | delete |
| Android | PublicProfileSocial.kt:123 · TitleShelves.kt:177 · StatKit.kt:351 (`pressScale`) · GameTile.kt:118 (`combinedClickable`) · OnboardingMascot.kt:209 | row / tile | — | — |
| web | profile/dress-up.tsx:189, :235 (`data-squish`), :407 | icon / row | mascot hop · stage controls · host nudge | dress-up.tsx:349, :397 are **family skin via class** (`candy candy-pink candy-sm`) |
| web | profile/title-shelves.tsx:62 · stat-kit.tsx:156 · collapsible-section.tsx:18 · badges/achievement-grid.tsx:130 · app/profile/[id]/page.tsx:652 · stats/tint-segment.tsx:40 | chip / row / toggle-seg | title chips · stat card · section expander · badge · profile chip · tint segment | `TintSegment` is a second segmented control beside `CandySegment` |

## Settings / Help / Strategy

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | SettingsView.swift:156, :169, :171, :184, :187, :400 | row | link rows (Help & Support, Privacy, Ad Privacy, Terms…) | `.squish` `linkRow`; Android SettingsScreen.kt:574/692 (`LinkRow`); web settings-kit.tsx:63, settings-dialog.tsx:262 |
| iOS | InfoMenu.swift:217, :268, :499, :650 | row / chip | dictionary/mode/word rows · dest chips | Android InfoNavScreens.kt:158/382, InfoPageKit.kt:199/247 (`InfoLinkChip`), HelpInfoScreens.kt:94 (`HelpTabChip`, role Tab) |
| iOS | StrategyKit.swift:255, :268, :417 | card | featured article · tiles · neighbor | Android StrategyKit.kt:416/448/554 |
| iOS | NotificationPrefsView.swift:39 (`NotificationPrefsButton`) | icon | bell (muted variant) | `.squishIcon` → RoundIconButtonStyle; web notification-toggle.tsx:71 |
| Android | SoftSheet.kt:163 · Components.kt:83 · SweepCelebration.kt:105 · ColdStartIntro.kt:179 | scrim | sheet scrims / dismiss | not buttons; allow-list |
| web | game/sound-toggle.tsx:30 | icon | sound on/off (`hdr-glyph`) | → RoundIconButton |

## Auth / Onboarding

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | AuthView.swift:98 | primary | "Continue with Google" (white row + logo) | brand button; keep but restyle to family quiet with logo? founder call |
| iOS | AuthView.swift:154, :174, :217 · OnboardingView.swift:281 | text-link | Sign up / Sign in · "Play without an account" · forgot | `TextLinkLabel` (CastButton.swift:356) — a quiet text style outside the family; web `TextLink` (cast-button.tsx:211, `cast-text-link`, 12 uses) is the twin |
| iOS | AuthView.swift:234 | icon | show/hide password (eye) | → RoundIconButtonStyle; Android AuthScreen.kt:357, web login-screen.tsx:221 |
| iOS | OnboardingView.swift:405 | chip | name suggestion chips | → HelperButton; Android OnboardingProfile.kt:254, web username-step.tsx:154 |
| Android | AuthScreen.kt:395 (Google) · Onboarding.kt:328 (block) | primary / scrim | — | — |
| web | onboarding/first-run-tour.tsx:607 | chip | tour dots | keep (pager dots) |

## Go Pro

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | ProIdentity.swift:83 · StatKit.swift:317 (Cast) | icon / primary | Pro badge · Go Pro | fine |
| Android | ProScreen.kt:402 (role RadioButton) · ProWelcome.kt:526 (`GiftLinkChip`) · ModeLimitModal.kt:132 | chip / card | plan cards · gift chip · Unlimited nudge | gift chip → HelperButton |
| web | pro/go-pro-popup.tsx:136 · pro/manage-subscription.tsx:78 · app/pro/page.tsx:254 · ui/cast-header.tsx:270 | row / card / icon | plan rows · portal row · Pro gem | — |

## Modals / Sheets / Other

| platform | file:line | kind | label / usage | note |
|---|---|---|---|---|
| iOS | FamilyActionMenu.swift:130 | menu | action-menu rows | `.squish`; Android FamilyActionMenu.kt:186/222, web family-action-menu.tsx:138 |
| iOS | `FamilyCloseButton` ≈ 9 uses | close X | — | already family |
| Android | PopupFinish.kt:204 · FinishKit.kt:376 · DressUp.kt:200 (`StageCloseButton`) | close X | popup / stage close | all draw `FamChrome.CLOSE` art in a `squishClickable` — use `RoundIconButton(FamChrome.CLOSE)` |
| web | app/global-error.tsx:77 | primary | Reload | raw; → CastButton |

## Custom button-like wrappers

### iOS (apps/ios/Wordocious/Sources)

| name | defined | call sites | renders | verdict |
|---|---|---|---|---|
| `CandyLabel` | FinishKit.swift:352 | 169 | label (title + symbol) for Cast/Candy styles | keep — it is the label, routed by the style |
| `CandyButtonStyle` | FinishKit.swift:159 | 77 styled | router → family | keep (router); eventually rename call sites |
| `SquishButtonStyle` (`.squish`/`.squishIcon`/`.squishCard`) | FinishKit.swift:96, :143–147 | 158 | press feedback only; label decides look | keep for tiles/rows/cards; every *pill/icon/chip* under it moves to Helper/Quiet/RoundIcon |
| `KeyPressStyle` + `KeyCap` | FinishKit.swift:1011, :959 | 12 / 16 | keycap | keep (family "keys" tier) |
| `PressableStyle` | StatKit.swift:326 | 0 | — | delete (dead) |
| `InstantButtonStyle` | LeaderboardTab.swift:1282 | 0 | — | delete (dead) |
| `HeaderCircleButton` / `HeaderCircleLabel` | HeaderKit.swift:198, :233 | 33 / 2 | bare 3D icon, `.squishIcon` | fold → `RoundIconButtonStyle` (same geometry) |
| `GameCornerButton` | HeaderKit.swift:276 | 44 | → HeaderCircleButton | fold with the above |
| `StageCloseButton` | DressUp.swift:356 | 3 | family close art, custom tinting | fold → `FamilyCloseButton(onStage:)` |
| `LbShareButton` | LeaderboardKit.swift:130 | 3 | `Icon3D(.share)` `.squishIcon` | fold → RoundIconButtonStyle |
| `NotificationPrefsButton` | NotificationPrefsView.swift:27 | 1 | HeaderCircleLabel bell | fold with HeaderCircleButton |
| `TextLinkLabel` | CastButton.swift:356 | 6 | purple text link | add a family `TextLinkStyle` (or QuietButton) ×3 |
| `VSPrimaryButton` | VsLobbyKit.swift:559 | 15 | wraps `CastButtonStyle` | fold away (use Cast directly) |
| `VSSoftPill` / `VSCandyTag` | VsLobbyKit.swift:588, :309 | 0 / 4 | decorative tag (hit-testing off) | VSSoftPill dead → delete; VSCandyTag keep as badge |
| `PuzCandyAction` | PuzGameKit.swift:180 | 14 | `CandyButtonStyle` + hint badge | keep (routed) |
| `TintPill` / `.tintedPill()` | FinishKit.swift:539, :510 | 3 / 63 | tinted capsule label (often inside `.squish` Buttons) | chips used as buttons → HelperButton; pure labels keep |
| `FriendsGlossyPill` · `MascotProPill` · `CandyPill` (toggle thumb) · `CandySwitchStyle` | FriendsFinish.swift:222 · MascotBuilder.swift:982 · FinishPages.swift:723, :767 | 2 · 1 · 8 · 16 Toggles | badges / toggle sprites | badges keep; the three thumb toggles + switch need one family toggle ×3 |

### Android (…/com/wordocious/app/ui)

| name | defined | call sites | renders | verdict |
|---|---|---|---|---|
| `CandyButton` / `CandyRoundButton` | FinishKit.kt:523, :582 | 97 / 8 | router → family | keep |
| `HintCandy` · `PinkButton` · `VsTealButton` · `UnlimitedMiniButton` · `ShareResultsCandy` | game/PadKit.kt:222 · friends/FriendsKit.kt:193 · vs/VSKit.kt:169 · game/FinishedScreen.kt:738, :561 | 6 · 3 · 12 · 1 · 2 | → Helper / Candy / Cast | keep (thin aliases) or fold |
| `Modifier.squishClickable` (+ `squish`, `pressSquish`, `pressScale`) | FinishKit.kt:328, :321 · StatKit.kt:327 | 121 | press feedback only | keep for tiles/rows/cards; pills/icons under it → family |
| `HeaderCircle` / `HeaderIconButton` / `HeaderBackButton` | HeaderKit.kt:141, :158, :174 | 1 / 1 / 12 | bare icon in 44 dp, `squishClickable(icon=true)` | fold → `RoundIconButton` (same thing) |
| `StageCloseButton` | DressUp.kt:189 | 3 | `FamChrome.CLOSE` bitmap, custom filter | fold → `RoundIconButton(FamChrome.CLOSE)` with an `onStage` tint |
| `CandySwitch` / `CandyToggle` | CandyToggle.kt:140, :118 | 3 / 1 | toggle sprites | family toggle ×3 |
| `KeyCap` (FriendlyGameScreen, private) · `LetterKey` (KeyboardView) | friends/FriendlyGameScreen.kt:747 · game/KeyboardView.kt | 5 / 2 | keycaps | keep (keys tier); consider one shared KeyCap |
| `GlossyPill` / `PendingPill` · `ProPill` · `CandyMessagePill` | InviteFinish.kt:171, :212 · game/FinishedScreen.kt:757 · game/FeedbackToast.kt:384 | 1+2 · 5 · 4 | decorative badge / toast | not buttons; keep |

### Web (apps/web/components)

| name | defined | call sites | renders | verdict |
|---|---|---|---|---|
| `CandyButton` / `CandyLink` / `candyClass()` | ui/candy-button.tsx:123, :142, :75 | 100 / 31 / 20 | `.candy` classes = family skin | keep (router); optional rename |
| `CastButton` / `TealButton` / `SoftPill` / `PlayAgainButton` / `EditProfileButton` / `ShareResultsCandy` | ui/cast-button.tsx:178 · vs/vs-ui.tsx:254, :261 · game/result-line.tsx:86 · profile/profile-edit-modal.tsx:454 · game/finished-kit.tsx:354 | 88 / 5 / 2 / 0 / 0 / 1 | primary | keep; PlayAgainButton & EditProfileButton have 0 uses → delete |
| `TextLink` | ui/cast-button.tsx:211 | 12 | `cast-text-link` | twin of iOS TextLinkLabel — one family text-link ×3 |
| `HeaderGlyph` (header-glyph.tsx) · `PageHeader` circle (page-header.tsx:54) · `GameHomeButton` · `GameGuideButton` · `SoundToggle` | ui/header-glyph.tsx:59 · ui/page-header.tsx:78 · game/game-home-button.tsx:44 · game/game-guide-button.tsx:26 · game/sound-toggle.tsx:30 | 10 `hdr-glyph` | bare 3D icon, 44 px | fold → `RoundIconButton` / `.fam-round` (0 direct uses today) |
| `Pill` (friends-ui.tsx:183) | 3 | a kind *card*, not a pill | rename, keep as card |
| `CandySegment` / `SegmentedPill` / `TintSegment` / `PlayModeToggle` | ui/candy-segment.tsx:14 · leaderboard/board-rows.tsx:234 · stats/tint-segment.tsx · ui/play-mode-toggle.tsx | 7 / 3 / 1 / 1 | three different segmented looks | one family segmented control ×3 |
| `CandySwitch` | ui/candy-switch.tsx:10 | 2 | role=switch | family toggle ×3 |
| `GlossyPill` / `PendingPill` / `ProPill` / `FeedbackPill` | friends/invite-screens.tsx:93, :127 · game/finished-kit.tsx:184 · game/feedback-toast.tsx:141 | 2 / 2 / 3 / 6 | decorative / toast | not buttons; keep |

## Suggested guard test (×3)

1. **iOS** (`swift` test or a shell test in CI): fail on any `.buttonStyle(.squish)` / `.squishIcon` whose label subtree contains `Capsule()`, `.tintedPill(`, `Icon3D(`, `HeaderCircleLabel`, `TextLinkLabel` or an `Image(systemName:` alone (a pill/icon drawn by hand); allow-list `KeyPressStyle`, `.squishCard`, and `.squish` around `GameArtImage`/tiles/rows. Also fail on `struct … : ButtonStyle` outside FamilyButtons.swift / CastButton.swift / FinishKit.swift (catches new ad-hoc styles; delete `PressableStyle`, `InstantButtonStyle` first).
2. **Android** (`spelling-copy`-style grep test): fail on `squishClickable(` with `icon = true` outside FamilyButtons.kt (header circles → `RoundIconButton`), on any `Box(…).squishClickable(` that also calls `.clip(RoundedCornerShape(50))`/`CircleShape` + `background(` (hand pill), and on raw Material `Button(`/`IconButton(`/`TextButton(`/`OutlinedButton(` anywhere under `ui/`.
3. **Web** (vitest over `components/**` + `app/**` minus admin): a `<button` must either be inside `family-button.tsx`/`candy-button.tsx`/`cast-button.tsx` or carry one of the allowed class tokens `candy`, `cast-`, `fam-round`, `kkey`, `gtile`, `ss-cell`, `mud-chip`, or `data-squish`/`data-tile` (tiles, rows, cards); `hdr-glyph` is allowed only until the RoundIconButton fold lands, then removed from the list. Lint `rounded-full` + `font-black` on a raw `<button` as a hand-made pill.
4. All three: a parity fixture listing the family tiers (helper · quiet · round icon · close X · text link · segmented · switch · keycap) with the one component name per platform; the test reads it so a new tier is added in all three or none.
