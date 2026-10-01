# Home redesign: build spec (founder-approved 2026-10-01)

Mockups (final boards: Y = home, U = every banner state, V = widgets, K = Word of the Day flow, X = Daily/Unlimited options, option 2 chosen):
https://claude.ai/artifact/BfztPSQamgzqbbGC83RKzz

Web is the reference implementation (`apps/web/app/page.tsx`, `apps/web/components/home/home-banner.tsx`, `apps/web/components/home/word-of-the-day.tsx`). iOS and Android match it. All copy is American English.

## 1. Page order (top to bottom)

1. App header (unchanged).
2. **The banner** (section 2). Replaces the old Pro Daily/Unlimited pill, the Daily Challenge / Unlimited / Sweep heroes, and the old Word of the Day card at the top.
3. Section header **WORDOCIOUS DAILIES**, then the 8 sweep mode cards in 2 columns (existing cards and states, unchanged).
4. Section header **PUZZLES**, then the 10 More Games dailies as the same mode cards in 2 columns, catalog order (ProperNoundle, Sudocious, Muddle, Hubbub, Crosswordocious, Kindred, Letter Ladder, Codebreaker, Spyglass, Starsweep), honoring remote flags. Same lock/badge rules as the More Games sheet used.
5. **Word of the Day** card (section 4).
6. **VS Battle** tile, as it is today.
7. (Web only) sign out + footer links, as today.

Removed: the More Games band and the More Games sheet. Anything that opened the sheet (web `/?more=1`, native "More Games" deep links or buttons) scrolls the home page to the PUZZLES section instead.
Kept: the Daily Sweep celebration modal and the More Games sweep celebration modal, exactly as today.

## 2. The banner

One rounded card (radius 16, clipped, NO border). It is one window: one background, one shimmer.

### Structure
- **Frosted headline strip** (full width, background white at 50% over the banner color, padding 12 top / 8 right / 10 bottom / 12 left):
  - Line 1: [trophy icon, only on Double Flawless] + **headline** (16pt, weight 900, letter-spacing 0.4, line-height 1.2, may wrap to 2 lines) + **share button** on the right (icon only, no background, 36pt touch target, 19pt share glyph). Unlimited: an infinity icon before the headline and NO share button.
  - Line 2: **clock line** (10.5pt, weight 800, letter-spacing 0.4) + on the right, **Pro only**, the DAILY | UNLIMITED switch.
- **Wordocious row** (padding 10 top / 12 sides / 6 bottom): label row "WORDOCIOUS" (10pt 900, tracking 1) + status text + streak (flame icon + number, no background), then 8 tiles 32x32, radius 9, gap 7, icon 16.
- **Puzzles row** (padding 8 top / 12 sides / 12 bottom): label row "PUZZLES" + status + streak, then 10 tiles 28x28, radius 8, gap 4, icon 14.

Tiles use each game's real home icon. Tapping a tile opens that game (daily in Daily mode, a fresh puzzle in Unlimited), with the same lock rules as its card.

### Colors
- Row tier colors: none = top `#ece8ff`, bottom `#e2e6ff`; sweep = `#ebd6fd`; flawless = `#fde68a`.
- Background (Daily): two layers. Top layer: `linear-gradient(135deg, rgba(255,255,255,0.35), transparent 55%)`. Under it a vertical blend: the Wordocious tier color from 0% to 52%, blending to the Puzzles tier color by 72%, through 100%.
- Background (Unlimited): `linear-gradient(135deg, #fce7f3, #ede9fe)`.
- Text colors: headline `#4c1d95` (Double Flawless: `#78350f`); strip line-2 / share icon `#6d28d9` (Double Flawless: `#92400e`). Row label/status color by that row's tier: none `#6d28d9`, sweep `#7e22ce`, flawless `#92400e`. Streak number `#c2410c`, flame fill `#f59e0b`, stroke `#c2410c`.
- Shadow: normal `0 4px 14px rgba(76,29,149,0.08)`; Double Flawless `0 0 26px rgba(245,158,11,0.8)` (a gold glow around the whole banner).
- Tile states: won = accent fill, white icon, glow `0 0 9px accent@70%`; lost = `#9ca3af` fill, white icon; unplayed = white 85% fill, 1.5pt DASHED border accent@55%, accent icon; Unlimited = white 90% fill, no border, shadow `0 1px 3px rgba(76,29,149,0.12)`, accent icon.

### Shimmer
Exactly ONE diagonal light band across the WHOLE banner (both rows), only in Daily mode and only when at least one row is swept or flawless. Band: 38% of the banner width, white 0 → 55% → 0, skewed about -18 degrees, sweeping left to right; one pass takes about 2.2s, then rests, repeating every 4s. Honor reduce-motion (no shimmer).

### Switch (Pro only)
Track: pill, `rgba(124,58,237,0.12)`, padding 2. Two segments "DAILY" and "UNLIMITED": height 26, horizontal padding 10, 10.5pt weight 900, tracking 0.6. Selected segment: white fill; ink `#4c1d95` (DAILY) or `#6d28d9` (UNLIMITED; never pink/red, founder veto). Unselected: transparent, ink `#7c3aed`. The app still opens on Daily every launch (existing rule, keep it).

Unlimited mode: banner background as above; headline "UNLIMITED PLAY"; clock line "FRESH PUZZLE EVERY TAP · ALL STATS COUNT"; row status "N PLAYED TODAY" (that row's unlimited games finished today); streaks and the share button hide; tiles use the Unlimited tile state; cards show no W/L badges and a small infinity mark (top right, accent) and open fresh puzzles.

### Words (all from the shared core; never hand-write these)
`packages/core/src/home-banner.ts` (web), ports: iOS `apps/ios/Sources/Core/HomeBanner.swift`, Android `apps/android/core/.../HomeBanner.kt`, all checked against `home-banner-fixtures.json`.
- `bannerHeadline(word, puzzles, {hour, name, unlimited})`: `word`/`puzzles` = `{played, won, total}` for today (total 8 and 10, or the visible count). `name` = the player's username (guest: empty → "GOOD MORNING!"). `hour` = local hour.
- `bannerClockLine(word, puzzles, clock, unlimited)`, `clock` = live `HH:MM:SS` to local midnight.
- `groupTier`, `groupStatus`, `unlimitedGroupStatus`, `groupStreak`, `dayStreaks`, `shiftDay`.

### Streaks
- Header flame (top of the app): unchanged, the day streak.
- Wordocious row: `groupStreak(tier, {sweep: currentSweepStreak, flawless: currentFlawlessStreak})` from the existing Daily Sweep stats.
- Puzzles row (new): `dayStreaks(days, total, today)` where `days[day] = {played: distinct More Games dailies finished that day, won: distinct ones won}` from the player's solo `daily_results` rows for the More Games modes (last ~400 days), `total` = number of visible More Games dailies (10). Show `groupStreak(tier, result)`.
- Hide a row's flame when its number is 0.

### Share button
Shares today's progress: the existing "all dailies" card for the Wordocious games played so far, titled with the headline. If any Puzzles were played, also the existing More Games card for those, in the same share action when the platform can share several images at once; otherwise the Wordocious card. (A single 18-row card is too cramped.)

## 3. Section cards
Unchanged card component and states. Unlimited adds an infinity mark top-right and drops badges (see above).

## 4. Word of the Day quiz

API: `GET https://wordocious.com/api/wotd?date=YYYY-MM-DD` (local date) returns `{word, phonetic, partOfSpeech, definition, choices: string[3] | null, answer: 0|1|2 | null, quizPartOfSpeech: string | null}`. `choices` is null on the few days with no usable quiz: show today's plain card.

Saved answer: signed in → table `word_quiz_answers (user_id, day date, word, picked smallint 0-2, correct bool)`, insert only (RLS: own rows; the primary key stops a second answer). Guest → local storage key `wordocious-wotd-quiz-<YYYY-MM-DD>` = `{picked, correct}`.

Card (same chrome as today's card: book icon, "WORD OF THE DAY", "Past words" link):
1. **Not answered, quiz available**: word line (word, phonetic, part of speech), then "Which one is it?", then 3 buttons (letter A/B/C in a small circle + the definition; min height 44; border 1.5 `#ddd6fe`; radius 10). The definition is hidden.
2. **Just answered** (about 2.2 seconds): right → green panel (`#dcfce7`, ink `#15803d`) "Nice! You knew it." + "Word streak: N"; wrong → red panel (`#fee2e2`, ink `#b91c1c`) "Not this time." + "You picked A. It's B: <definition>".
3. **Rest of the day**: today's card exactly, showing the quiz's correct definition (`choices[answer]`, part of speech `quizPartOfSpeech`). After a right answer only: a small flame + the word streak number at the right of the word line. After a miss: nothing extra. The wrong choices never show again that day.

Word streak = `dayStreaks(days, 1, today).flawless` where `days[day] = {played: 1, won: correct ? 1 : 0}` from the player's last ~400 answers.

## 5. Widgets (iOS WidgetKit + Android home-screen widget)
Keep today's widget style (frame, footer strip, chip look). Add the Puzzles group. No animation (widgets can't run the shimmer).
- Snapshot gains the 10 Puzzles dailies (same per-mode fields as the 8), the username, and both rows' streaks.
- Background: the same one-window vertical blend as the banner (top = Wordocious tier color, bottom = Puzzles tier color) with the white sheen. Double Flawless: gold frame + gold glow.
- **Medium**: frosted header strip (headline from `bannerHeadline`, day-streak flame on the right); a row of 8 chips (28pt) + its status tag; a row of 10 chips (25pt) + its tag; the footer strip (wordmark · "N/18 · points" · live countdown). Chips: won = accent + white check; lost = gray + white X; unplayed = white 72% + dashed accent border + the game's icon. Tapping a chip deep-links to that daily as today.
- **Small**: frosted header (wordmark + flame), big "N/18", the headline (10pt caps), two dot rows (8 then 10), live countdown.
- **Lock screen (rectangular)**: "WORDOCIOUS", the headline, "Word N/8 · Puzzles N/10".
- The old fresh / at-risk / sweep / flawless widget themes are replaced by these tier colors (after 8 pm the headline stays the evening greeting).

## 6. Stats rail
VS is the last chip, after Starsweep (done on all three platforms).
