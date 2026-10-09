# 2.8 inventory — plain surfaces (no ChatGPT title art)

Date: 2026-10-09. Read-only grep audit (no builds, no tests). Feeds the "no plain text menus" rule (FINISH_SPEC BJ16, founder 10-03): every sheet, popup, page and section heading should be drawn as the cast-colour title art (web `HeadingArt` / `heading-art.tsx` `HEADING_ART` map, iOS `ArtTitleLabels.swift` / `ArtKit.swift`, Android `HeadingArt.kt`). Paths are relative to each app root: web `apps/web/`, iOS `apps/ios/Wordocious/Sources/`, Android `apps/android/app/src/main/kotlin/com/wordocious/app/`. Admin pages (`apps/web/app/admin`) excluded.

**Method.** Web: `SectionLabel` / `SectionHeader` / `CardTitle` / `SettingsSection` call sites and uppercase JSX literals. iOS and Android: `Text("CAPS")`, `socialCaption(`, `section(`, `Section(`, `LbBoardLabel` / `LbSectionLabel`, `CardTitle(`, plus `.textCase(.uppercase)` / `.uppercase()` helpers. Empty states: plain "No …" / "Nothing …" lines outside `BrandEmptyState`.

**Reading the tables.** "Plain" means text, not art. Web `SectionLabel`/`SectionHeader` draw CSS-uppercased text, so they count as plain even though the source is title case. `HeadingArt` exists for 59 titles; any of these labels that also appear in `HEADING_ART` (e.g. "Trophy Case", "Podium", "Streak Calendar", "Head to Head", "Archetypes") are a candidate to switch to the art, not a new asset.

## Summary counts (table rows, not unique strings)

| report surface | web | iOS | Android |
|---|---|---|---|
| 1. Section labels / block headings (table below) | 34 rows | 30 rows | 20 rows |
| 2. Caps text labels, game wordmarks and captions (table below) | 24 rows | 33 rows | 2 rows (the rest of Android's caps are in section 1) |
| 3. Plain-text empty states (table below) | 11 rows | 4 rows | 2 rows |

## 1. Section labels (block headings)

| platform | file:line | current text | note |
|---|---|---|---|
| web | app/daily/page.tsx:819 | `TODAY'S BOARD` (`SECTION_LABEL` div) | plain caps div; no art. Same heading exists on iOS and Android. |
| web | app/daily/page.tsx:854 | `NO SWEEPS TODAY` (empty-state title) | plain caps title on an empty card |
| web | app/daily/page.tsx:1002 | `No results from yesterday` | plain sentence empty state |
| web | app/stats/page.tsx:642 | `Today's Games` | `SectionHeader` |
| web | app/stats/page.tsx:681 | `Today's {mode}` | `SectionHeader`, per-mode |
| web | app/stats/page.tsx:752 | `Daily Sweeps` | `SectionHeader` |
| web | app/stats/page.tsx:757 | `Daily Points` | `SectionHeader` (also at :863, duplicate label) |
| web | app/stats/page.tsx:783 | `Your Records` | `SectionHeader`; "Trophy Case" art exists, not used here |
| web | app/stats/page.tsx:797 | `Activity` | `SectionHeader` |
| web | app/stats/page.tsx:847 | `Guess Distribution` | `SectionHeader`; the founder's "GUESS DISTRIBUTION" block |
| web | app/stats/page.tsx:855 | `Solve Time Trend` | `SectionHeader` |
| web | app/stats/page.tsx:873 | `Top Words — All Time` | `SectionHeader` |
| web | app/stats/page.tsx:881 | `Opener Lab` | `SectionHeader` |
| web | app/stats/page.tsx:907 | `Weekday Form` | `SectionHeader` |
| web | app/stats/page.tsx:948 | `Insights` | `SectionHeader` |
| web | app/stats/page.tsx:964 | `Signature` | `SectionHeader` |
| web | app/stats/page.tsx:968 | `Standing Trend` | `SectionHeader` |
| web | app/stats/page.tsx:980 | `Progression` | `SectionHeader` |
| web | app/stats/page.tsx:1069 | `VS` | `SectionHeader`, a bare two-letter label |
| web | app/stats/page.tsx:1176 | `Recent Matches` | `SectionHeader` |
| web | components/profile/profile-social.tsx:587 | `TROPHY CASE` (`TappableCard title`) | plain caps card title; `HEADING_ART.trophycase` exists |
| web | components/profile/profile-social.tsx:755 | `HIGHLIGHTS` (`CardTitle`) | plain caps |
| web | components/profile/profile-social.tsx:846 | `LATELY` (`CardTitle`) | plain caps |
| web | components/profile/pro-stats.tsx:91 | `PRO STATS` | plain caps |
| web | components/profile/pro-insights-deep.tsx:93, 126, 193 | `Skill Radar`, `Rivalries`, `Deep Insights` (`SectionHeader`) | plain title case, Pro only |
| web | components/vs/vs-lobby.tsx:287, 321 | `Your challenges`, `Have a code?` (`SectionLabel`) | plain sentences as headings |
| web | components/vs/vs-friend.tsx:124 | `Friends` (`SectionLabel`) | plain |
| web | components/vs/vs-lobby.tsx:193 | mode title (caps `span` in `right`) | plain caps chip |
| web | components/ui/streak-popups.tsx:184, 194, 213 | `Sweep streaks`, `Flawless streaks`, `Streak shields` (`SectionLabel`) | plain; "Streak Calendar" art exists |
| web | components/friends/quick-play-sheet.tsx:105 | `Quick games · live while they're on` | plain sentence heading |
| web | components/friends/quick-play-sheet.tsx:152 | `Wordocious` (`SectionLabel`) | plain product name as a heading |
| web | components/friends/friendly-boards.tsx:157, 317, 339 | `Your pick`, `{THEM} calls`, `What's on the line` | plain sentences as headings |
| web | app/word/[date]/page.tsx:138, 169, 176, 197, 216 | `Meaning`, `{w} as a puzzle answer`, `{w} by the numbers`, `Near misses`, `Put it to use` | plain headings on the word page (SEO page) |
| web | components/settings-dialog.tsx:185, 201, 217, 243, 262, 282, 302 | `Theme`, `Keyboard`, `Sound & Feedback`, `Subscription`, `Account`, `Accessibility`, `Help` (`SettingsSection`) | Settings headers; the founder's THEME / KEYBOARD / SOUND & FEEDBACK labels. Settings tiles already have live previews (`lib/settings-previews.ts`), the headers do not. |
| iOS | SettingsView.swift:81 | `THEME` | `section()` caps |
| iOS | SettingsView.swift:86 | `KEYBOARD` | `section()` caps |
| iOS | SettingsView.swift:91 | `SOUND & FEEDBACK` | `section()` caps |
| iOS | SettingsView.swift:96 | `NOTIFICATIONS` | `section()` caps |
| iOS | SettingsView.swift:110 | `ACCESSIBILITY` | `section()` caps |
| iOS | SettingsView.swift:119 | `ADMIN` | caps (hidden for non-admins; not a finding for players) |
| iOS | SettingsView.swift:138 | `SUBSCRIPTION` | `section()` caps |
| iOS | SettingsView.swift:161 | `ABOUT` | `section()` caps |
| iOS | ProfileSocialViews.swift:634 | `TROPHY CASE` (`socialCaption`) | plain caps |
| iOS | ProfileSocialViews.swift:870 | `HIGHLIGHTS` (`socialCaption`) | plain caps |
| iOS | ProfileSocialViews.swift:996 | `LATELY` (`socialCaption`) | plain caps |
| iOS | ProfileSocialViews.swift:355 | `YOU vs {NAME}` (`socialCaption`) | plain caps with a name |
| iOS | ProfileSocialViews.swift:557, 787, 928 | `{NAME} · {MODE}`, `{MODE} · {DAY}`, `{NAME} · LAST 60 DAYS` | plain caps subtitles |
| iOS | RecordsTab.swift:125 | `HALL OF FAME` (`LbSectionLabel`) | plain caps; "Podium" / "Trophy Case" art exists |
| iOS | RecordsTab.swift:133 | `BY GAME MODE` (`LbSectionLabel`) | plain caps |
| iOS | RecordsTab.swift:770 | `YESTERDAY’S WINNERS` (`LbSectionLabel`) | plain caps |
| iOS | LeaderboardShare / Records (`TODAY'S BOARD`) | `TODAY'S BOARD` is the Android/web heading; iOS Leaderboard uses the same `LbSectionLabel` family | confirm on the Leaderboard tab before the swap |
| iOS | ProfileSocialViews.swift:77 | `socialCaption()` wraps `FinishLabel` | one helper drives every social caps caption (TROPHY CASE, HIGHLIGHTS, LATELY, YOU vs …) |
| iOS | StrategyKit.swift:248, 280 | `SOLVE SMARTER`, `TIP OF THE DAY` | plain caps headers |
| iOS | InfoMenu.swift:482 | `EVERY WORD OF THE DAY` | plain caps header |
| iOS | GuideSheet.swift:298, 302, 318, 319 | `How it works`, `The buttons`, `How scoring works`, `Strategy` | title-case section heads in the guide sheet |
| iOS | ProInsightsDeep.swift:507 | `HINTLESS WINS` | plain caps |
| iOS | TitleShelves.swift:75 | `PICK YOUR TITLE` | plain caps; "Make your title" art may fit |
| iOS | ProfileTab.swift:896 | `ACCOUNT` | plain caps |
| iOS | PostGameViews.swift:442 | `SCORE BREAKDOWN` | plain caps |
| iOS | GameScreen.swift:640 | `POINTS SO FAR` | plain caps in-game label |
| iOS | HeaderPopups.swift:225 | `BEST` | plain caps |
| iOS | OnboardingView.swift:793 | `DAY STREAK` | plain caps |
| iOS | MuddleView.swift:1102, 1123 | `PUNCHLINE`, `THE PUNCHLINE` | plain caps game label |
| iOS | ProView.swift:127, 187, 276 | `ACTIVE PRO`, `OR TRY IT FIRST`, `BEST VALUE` | plain caps Pro labels |
| Android | SettingsScreen.kt:167 | `THEME` (`Section`) | caps |
| Android | SettingsScreen.kt:176 | `KEYBOARD` (`Section`) | caps |
| Android | SettingsScreen.kt:186 | `SOUND & FEEDBACK` (`Section`) | caps |
| Android | SettingsScreen.kt:200 | `NOTIFICATIONS` (`Section`) | caps |
| Android | SettingsScreen.kt:243 | `ACCESSIBILITY` (`Section`) | caps |
| Android | SettingsScreen.kt:256 | `ADMIN` (`Section`) | caps (admin only) |
| Android | SettingsScreen.kt:275 | `SUBSCRIPTION` (`Section`) | caps |
| Android | SettingsScreen.kt:292 | `ABOUT` (`Section`) | caps |
| Android | SettingsScreen.kt:323 | `ACCOUNT` (`Section`) | caps |
| Android | SettingsScreen.kt:430 | `LINKED SIGN-INS` (`Section`) | caps |
| Android | LeaderboardScreen.kt:603 | `TODAY’S BOARD` (`LbBoardLabel`) | plain caps; with Everyone / Friends toggle |
| Android | LeaderboardScreen.kt:824 | `YESTERDAY’S WINNERS` (`LbSectionLabel`) | plain caps |
| Android | RecordsScreen.kt:383 | `TODAY’S BOARD` (`LbSectionLabel`) | plain caps |
| Android | RecordsScreen.kt:530 | `YESTERDAY’S WINNERS` | plain caps |
| Android | RecordsScreen.kt:640 | `HALL OF FAME` | plain caps; "Podium" / "Trophy Case" art exists |
| Android | RecordsScreen.kt:660 | `SWEEP RANKING` / `BY GAME MODE` | plain caps |
| Android | PublicProfileSocial.kt:410 | `YOU vs {NAME}` (`Text`) | plain caps |
| Android | PublicProfileSocial.kt:649 | `TROPHY CASE` (`CardTitle`) | plain caps |
| Android | PublicProfileSocial.kt:815 | `HIGHLIGHTS` (`CardTitle`) | plain caps |
| Android | PublicProfileSocial.kt:960 | `LATELY` (`CardTitle`) | plain caps |

## 2. Caps text labels on screens (JSX / `Text("…")` literals, not section heads)

Grouped by surface. Game names in caps (`HUBBUB`, `MUDDLE`, `KINDRED`, `SPYGLASS`, `CODEBREAKER`, `LETTER LADDER`, `CROSSWORDOCIOUS`, `PROPERNOUNDLE`, `SUDOCIOUS`, `STARSWEEP`) are game-header wordmarks. They are plain text where the rest of the game header uses art, so they are listed here, not as findings on their own.

| platform | file:line | current text | note |
|---|---|---|---|
| web | components/hub/hub-game.tsx:556 | `HUBBUB` | game wordmark, plain caps |
| web | components/cryptogram/cryptogram-game.tsx:355 | `CODEBREAKER` | game wordmark |
| web | components/ladder/ladder-game.tsx:285 | `LETTER LADDER` | game wordmark |
| web | components/ladder/ladder-board.tsx:114, 217 | `ONE SHORTEST ROUTE` | plain caps board caption |
| web | components/groups/groups-game.tsx:305 | `KINDRED` | game wordmark |
| web | components/scramble/muddle-game.tsx:323 | `MUDDLE` | game wordmark |
| web | components/sudoku/sudoku-game.tsx:322 | `SUDOCIOUS` | game wordmark |
| web | components/wordsearch/spyglass-game.tsx:249 | `SPYGLASS` | game wordmark |
| web | components/crossword/crossword-game.tsx:360 | `CROSSWORDOCIOUS` | game wordmark |
| web | components/game/completed-more-board.tsx:187 | `ALL WORDS` | plain caps caption |
| web | components/leaderboard/board-rows.tsx:295 | `POINTS` | column caption |
| web | components/stats/recent-matches.tsx:150 | `FORFEIT` | row tag |
| web | components/friends/friends-panel.tsx:1098 | `FRIENDS` | plain caps header |
| web | components/friends/friends-banner.tsx:92 | `ON NOW` | plain caps chip |
| web | components/friends/game-screen.tsx:307 | `LEAVE THE GAME?` | confirm sheet heading in plain caps (sheet should be art) |
| web | components/vs/vs-bots.tsx:84, 207 | `SIGN IN`, `CLEARED` | plain caps |
| web | components/vs/vs-banner.tsx:143, 173 | `TODAY`, `RECORD` | plain caps |
| web | components/vs/vs-lobby.tsx:279 | `SEE PRO` | plain caps link |
| web | components/vs/vs-queue.tsx:118 | `SEARCHING` | plain caps status |
| web | components/vs/challenge-result.tsx:35, 164, 167, 207, 211, 213 | `NO GUESSES`, `CHALLENGE BACK`, `VS HOME`, `CODE`, `SHARE LINK`, `VS HOME` | plain caps buttons/labels on a result screen |
| web | components/vs/vs-friend.tsx:110, 185 | `SEE PRO`, `SHARE A LINK` | plain caps |
| web | components/pro/pro-crown-sheet.tsx:69 | `RENEWS` | plain caps |
| web | components/modals/streak-shield-modal.tsx:152 | `STREAK` | plain caps modal caption |
| web | components/auth/daily-landing.tsx:52, mode-landing.tsx:43 | `WORDOCIOUS` | wordmark text on sign-in landings |
| iOS | HubView.swift:311 | `HUBBUB` | game wordmark |
| iOS | CodebreakerView.swift:425 | `CODEBREAKER` | game wordmark |
| iOS | LadderView.swift:310, 487 | `LETTER LADDER`, `ONE SHORTEST ROUTE` | wordmark + caption |
| iOS | KindredView.swift:403 | `KINDRED` | wordmark |
| iOS | MuddleView.swift:540 | `MUDDLE` | wordmark |
| iOS | SpyglassView.swift:292 | `SPYGLASS` | wordmark |
| iOS | CrosswordView.swift:466, 482 | `CROSSWORDOCIOUS` | wordmark |
| iOS | ProperNoundleView.swift:485, 537, 998 | `PROPERNOUNDLE` | wordmark |
| iOS | ProperNoundleView.swift:744 | `CLUE` | plain caps label |
| iOS | RegionsView.swift:290 | `STARSWEEP` | wordmark |
| iOS | Theme.swift:228, LeaderboardShare.swift:986 | `WORDOCIOUS` | wordmark text (also in share image) |
| iOS | VSGameView.swift:325, 329, 409, 580, 1089, 1127, 1618, 1623, 1832 | `SEARCHING`, `WAITING FOR YOUR FRIEND`, `PRIVATE MATCH`, `YOUR RUN`, `THIS SESSION · YOU`, `NO REMATCH`, `CLEARED`, `PLAYING`, `NEXT DAILY BATTLE IN` | plain caps VS status labels |
| iOS | VSChallengeViews.swift:467, 487 | `TIME TO BEAT`, `YOUR CHALLENGE` | plain caps |
| iOS | VSBannerView.swift:129, 148 | `TODAY`, `RECORD` | plain caps |
| iOS | VSBotsView.swift:76, 131, 193 | `BOT OF THE DAY`, `STREAK`, `BOSS` | plain caps |
| iOS | VSIntroView.swift:84 | `TAP TO SKIP` | plain caps hint |
| iOS | VSLiveTile.swift:64 | `LIVE` | plain caps chip |
| iOS | VSLobbyView.swift:418 | `GO PRO FOR ALL OF VS` | plain caps Pro banner |
| iOS | VSFriendPage.swift:208, 221 | `PLAY RIGHT NOW`, `SENDING CHALLENGES IS PRO` | plain caps |
| iOS | FriendsPanelView.swift:1347, FriendlyGameScreen.swift:287, FriendsQuickPlaySheet.swift:163 | `FRIENDS`, `TO PLAY`, `WHO ARE YOU PLAYING?` | plain caps sheet/section headers |
| iOS | StreakShieldModal.swift:80 | `STREAK AT RISK` | plain caps modal heading |
| iOS | AchievementUnlockPopup.swift:626 | `ACHIEVEMENT UNLOCKED!` | popup heading in plain caps (web uses `achievement` art) |
| iOS | WordOfTheDayView.swift:207 | `WHICH ONE IS IT?` | plain caps prompt |
| iOS | GauntletCompletedView.swift:43, 406 | `TAP A STAGE TO SEE RESULTS`, `SO CLOSE!` | plain caps |
| iOS | FinishedScreenKit.swift:370 | `KEEP PLAYING` | plain caps button label |
| iOS | PostGameEffects.swift:459 | `POINTS` | plain caps caption |
| iOS | FamilyButtons.swift:503 | `ENTER` | keycap label (keyboard, fine) |
| iOS | MascotBuilder.swift:727 | `AUTO` | plain caps chip |
| iOS | ProIdentity.swift:336, 364 | `WORDOCIOUS PRO`, `GO PRO` | plain caps Pro sheet heads |
| iOS | GuideSheet.swift:262 | `FULL GUIDE` | plain caps link |
| iOS | InvitePanelView.swift:126 | `DAYS` | plain caps unit label |
| iOS | PublicProfileView.swift:682 | `FORFEIT` | row tag |
| iOS | ProView.swift:127, 187, 276 | `ACTIVE PRO`, `OR TRY IT FIRST`, `BEST VALUE` | plain caps |
| Android | TitleShelves.kt:153 | `No title matches "{query}"` | plain-sentence empty state |
| Android | HeadingArt.kt:84 | `TROPHYCASE` art entry exists | art key is defined; Records and Profile still use the caps text (see section 1) |

## 3. Empty states that are plain text

| platform | file:line | current text | note |
|---|---|---|---|
| web | components/friends/friendly-boards.tsx:311, 580 | `No flip yet`, `No letter yet` | plain sentences in a board |
| web | components/vs/challenge-result.tsx:134 | `Nobody raced it in time.` / `Nobody has raced it yet.` | plain sentence, no scene |
| web | components/vs/result-detail.tsx:433, 490, 534, 562 | `No guesses` | 10 px caps-ish muted line; no scene |
| web | components/profile/title-shelf.tsx:119 | `No title matches "{query}"` | plain sentence |
| web | components/profile/title-shelf.tsx:100 | `No title` (placeholder ribbon) | plain text inside a ribbon |
| web | components/avatar/locked-item-card.tsx:59 | `Not available right now.` | plain sentence |
| web | components/stats/recent-matches.tsx:58 + app/stats/page.tsx:1117 | `No games yet` / `No games yet today…` | `RecentMatchesList` has a `BrandEmptyState` scene, but the stats "Win rate" line is plain |
| web | components/friends/quick-play-sheet.tsx:292 | `No friends yet` | uses `BrandEmptyState` (good), but the title is plain caps-ish sentence |
| web | components/stats/signature-card.tsx:61 | `Play a few dailies to see your standing over time.` | plain sentence empty state |
| web | components/profile/guess-distribution.tsx:34 | `Play a game` / `Win a game` to see your {title} | plain sentence |
| web | components/home/today-card.tsx:228 | `Play a daily` | plain fallback text |
| iOS | RecentMatchesList.swift:19, 102 | `No games played yet.` | `BrandEmptyState` is used, but the default line is plain |
| iOS | ProfileTab.swift:711 | `No {title} games yet today.` | plain sentence |
| iOS | VSResultDetail.swift:323, 378, 502 | `No guesses` | 10 pt muted text |
| iOS | PostGameViews.swift:834 | `No definition available for this word.` | plain sentence |
| Android | VSResultDetail.kt:430, 480, 501 | `No guesses` | 10 sp muted text |
| Android | CompletedDailyBoard.kt:443 | `No definition available for this word.` | plain sentence |

## 4. Notes for the build

- Biggest single cluster: iOS `Text("…")` caps in the VS and Friends screens (roughly 30 literals). One helper swap per screen would cover them.
- Settings: web, iOS and Android all use the same seven to ten section names. A shared title-art set (Theme, Keyboard, Sound & Feedback, Accessibility, Subscription, Account, Help, About) would cover all three platforms.
- Records / Leaderboard on Android uses `LbBoardLabel` / `LbSectionLabel`; iOS and web use separate paths. Pick one label component per platform and swap it once.
- Stats page on web has 19 `SectionHeader` labels. They are the largest block of plain headings in a single file.
- Empty states: most already use `BrandEmptyState` on the new screens; the remaining plain ones are the sentence-style lines in the table above.

Counts: section labels 84 rows (web 34 · iOS 30 · Android 20); caps labels 59 rows (web 24 · iOS 33 · Android 2); empty states 17 rows (web 11 · iOS 4 · Android 2). Rows are call sites as grepped, so a string used on two screens counts twice.
