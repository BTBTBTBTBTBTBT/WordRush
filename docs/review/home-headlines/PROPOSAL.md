# Home headlines: a fresh, seasonal, personal headline system (PROPOSAL)

**Status:** design + core prototype, 2026-10-16. Not wired into any app, no fixtures generated, nothing committed. Founder ask (10-16): "adjust and expand on the verbiage shown with the custom letters on the main screen … seasonality touches … different time of day sayings that will not feel stale … Double Flawless, and more responsiveness to the last games played or next games up … fresh and pleasantly surprising … but it can't have any negative impact on loads or choppiness."

Prototype: `packages/core/src/home-headline-pool.ts` (+ `home-headline-pool.test.ts`, 15 tests green). The copy bank below is generated from that file: it is the single source.

---

## 1. What the headline says today

`bannerHeadline()` in `packages/core/src/home-banner.ts` (Swift `HomeBanner.bannerHeadline`, Kotlin `bannerHeadline`, pinned by `home-banner-fixtures.json`). Every string it can produce:

| State | Line(s) |
|---|---|
| Unlimited mode | `UNLIMITED PLAY` |
| Nothing played, 0–4 h | `UP LATE, {NAME}?` / `UP LATE?` |
| Nothing played, otherwise | `GOOD MORNING, {NAME}!` (<12), `GOOD AFTERNOON, {NAME}!` (<17), `GOOD EVENING, {NAME}!` (guest: no name) |
| 1–5 played | `WARMING UP · {n} DOWN` |
| 6–11 played | `ON A ROLL · {n} OF 18` |
| 12+ played, no row done | `HOME STRETCH · {left} LEFT` |
| One row done | `WORDOCIOUS FLAWLESS! 4 PUZZLES LEFT`, `PUZZLES SWEPT! 1 PUZZLE LEFT` … or that row's streak line |
| Both rows done | `DOUBLE FLAWLESS!`, `DOUBLE SWEEP!`, `FLAWLESS + SWEEP!`, `SWEEP + FLAWLESS!` … or the Wordocious row's streak line |
| Streak line (`streak-headline.ts`) | milestone pools at 2/3/4/5/6/7/10/14/30 (`FLAWLESS 3-PEAT!`, `A WHOLE WEEK OF SWEEPS!` …), `NEW BEST! {n} FLAWLESS DAYS`, generic `{n} FLAWLESS DAYS!`, restarts `BACK ON TRACK! FLAWLESS TODAY` — 3 variants each, picked by a date hash |

So a daily player sees exactly the same four greetings forever, and the same three progress lines every day; only a finished row varies (by date). That is the staleness the founder named.

## 2. What Home already holds in memory (no new network calls)

Everything below is read at Home render today on all three platforms; the headline system only needs it passed in.

| Input | Web | iOS | Android |
|---|---|---|---|
| Per-row progress (played / won / total) | `progressOf(cards, todayDailies)` in `app/page.tsx` | `bannerProgress` in `HomeView.swift` | `HomeBannerView.kt` `word.progress` |
| Row streaks (sweep / flawless, best) | `sweepStreaks`, `puzzleStreaks` (`useDailyCompletions` + stats cache) | `wordStreaks` / `puzzleStreaks` (cached at launch, founder 10-09) | `DayStreaks` + `bestFlawless` |
| Per-game result today (won, guesses, timeSeconds, score, `savedAt`) | `todayDailies: Map<dbKey, DailyCompletion>` + local pending cache with `savedAt` | the completions store | Room completions |
| Player's own game order (next unplayed) | `useGameOrder` + `nextCard` (already computed for the Today card) | same (item 35) | same |
| Name | `profile.username` | profile | profile |
| Local hour / date key | `new Date().getHours()`, `getTodayLocal()` | `Calendar.current` | `LocalDate` |
| Season | `currentSeason(date)` (core) | same | same |
| Holiday | `holidayKeyForDay(day, HOLIDAY_TABLE)` (core + bundled `holiday-days.json`) | bundled table | bundled asset |
| Weekday | from the date key (core `weekdayOf`) | same | same |
| Unlimited mode | `playMode` | `playMode` | `unlimited` |
| Slot width | `useSlotWidth` (one ResizeObserver) | GeometryReader once | `onSizeChanged` once |

Not needed for v1 (available but deferred): friends online / activity (Friends tab data, loaded on Home for the strip), level / achievements, records table. A **personal record** flag (`lastGame.record`) is the one new bit: the game's finish screen already knows "new best" (it shows the badge); it writes a tiny local `lastGame {title, won, finishedAt, record}` on finish, which Home reads. No server call.

## 3. The system

### 3.1 Context triggers, ranked

The state picks ONE context; each context has a pool. Celebrations first, then reactions, then greetings.

| # | Context | Trigger | Pool |
|---|---|---|---|
| 0 | `unlimited` | Unlimited mode | 6 lines |
| 1 | `doubleFlawless` | both rows flawless | 12 + season flavors (12) |
| 2 | `newRecord` | the last game (≤ 20 min ago) set a personal best | 10 |
| 3 | `streak` | a finished row has streak news (the EXISTING `streakHeadline` lines) | ~70 existing |
| 4 | `flawlessRow` | one row flawless, the other open | 10 + flavors (6) |
| 5 | `allDone` | all 18 done (double sweep / sweep + flawless) | 10 + flavors (8) |
| 6 | `rowDone` | one row swept, the other open | 8 |
| – | `surprise` | 1 in 12 picks, only below this line (never over a celebration) | 16 |
| 7 | `lastPlayed` | a game finished ≤ 20 min ago (won / lost pools; the lost pool is kind) | 12 + 10 |
| 8 | `nextUp` | something played, nothing finished: the next unplayed game in the player's own order | 16 + flavors (12) |
| 9 | `holiday` | nothing played, today is a holiday in `holiday-days.json` | 28 keys, 85 lines |
| 10 | `pack` | nothing played, inside a season pack window (2 of 3 picks) | 8 packs, 58 lines |
| 11 | `weekday` | nothing played, 1 in 3 picks | 7 × 4 |
| 12 | `timeOfDay` | nothing played | 7 buckets × 10 |
| 13 | `legacy` | nothing in the chosen pool fits the slot → today's `bannerHeadline` line (always fits) | existing |

Streak vs pool: the streak line leads two buckets in three on a flawless/sweep-row day and one in three on a Double Flawless day, so both the milestone ("FLAWLESS 3-PEAT!") and the fresh line show across the day instead of one line parked for nine hours.

### 3.2 Time-of-day buckets

`lateNight` 0–4 · `earlyMorning` 5–7 · `morning` 8–11 · `midday` 12–13 · `afternoon` 14–16 · `evening` 17–20 · `night` 21–23. Ten lines each. The bucket is part of the seed, so the line changes at most seven times a day and never inside a bucket.

### 3.3 Season packs and holidays

Packs are calendar windows for COPY, independent of the art seasons (so winter copy runs even though no winter art ships): halloween Oct 9–31, thanksgiving Nov 14–29, winter Dec 1–30 (inclusive: "HAPPY HOLIDAYS", "SEASON'S GREETINGS", cocoa and snow; Christmas, Hanukkah and Kwanzaa lines appear only on their own days from the holiday table), newyear Dec 31–Jan 6, valentines Feb 7–14, spring Mar 20–Apr 15, summer Jun 21–Jul 10, fall Sep 22–Oct 8. Inside a pack, seasonal flavor takes 2 of 3 picks in the greeting contexts and in the celebration pools that have flavors, so the season never saturates. The holiday day itself always greets with the holiday (28 keys covered, every one in `holiday-days.json`; MLK Day, Memorial Day, Veterans Day are reflective, not jokey).

### 3.4 Personalization slots

`{name}` (the gold hero line, stacked by the existing BJ6 layout), `{next}` (next unplayed game title in the player's order), `{last}` (the game just played), `{left}` / `{played}` / `{total}`, `{n}` (streak, used by the existing streak lines). A line whose slot is empty (guest, no next game) is skipped, so guests get name-free lines from the same pools.

Rule learned writing the bank: a `{name}` line stacks cleanly only when the words before the name are no wider than the sizing line "GOOD AFTERNOON," and the name ends the line (with optional `!`/`?`). Every name line in the bank follows that shape; the fit test enforces it.

### 3.5 Freshness

- **Deterministic:** seed = FNV hash of `user | date | bucket | context` (the existing `dayHash`). Same inputs → same line on every platform and every re-render. Two players at the same table read different lines.
- **No repeats:** the caller keeps the ids of the lines it SHOWED (the template string) for the last 10 days in local storage (web `localStorage`, iOS `UserDefaults`, Android `SharedPreferences`; ~14 × 30 bytes). The picker skips any id in that history; when a pool is exhausted it falls back to the full fitted pool, never to nothing. Ten mornings in a row produce ten different greetings (see §4).
- **Surprise:** 1 in 12 non-celebration picks is a "surprise" line ("THE LETTERS MISSED YOU", "A WILD PUZZLER APPEARS"). Never over a celebration.
- Pools are append-only; ids are the template strings, so reordering never breaks history.

### 3.6 Fit

`headlineFitsSlot(text, name, slotWidth)`: a line passes when it sits on one full-size line, or on a balanced two-line wrap, at ≥ 85% of the device's full lettering size (`headlineFontSize`), or when only the player's name overflows (BJ6 stacking, unchanged). The picker filters the pool by fit for the actual slot width, so a {next} line with "Crosswordocious" is simply skipped on a 220 px slot instead of shrinking. The fallback is today's `bannerHeadline`, which already fits by the existing bubble-text tests. **Wiring note:** the renderer's `homeHeadlineFit` shrinks before it wraps (down to 72%); when wiring, pass `minSize = 0.85 × full, maxLines = 2` for pool lines so they render as two full-size lines, not one small one. The slot already reserves two lines (`headlineReserveHeight`), so no layout jumps.

## 4. A full day for three player types (generated by the prototype)


#### Player A: "BMT", sweeps every day, Halloween (Sat Oct 31), 390 phone

| Local time | State | Headline | Context |
|---|---|---|---|
| 06:00 | nothing played | BOO, BMT! | holiday |
| 08:00 | nothing played | FANGS A LOT, BMT | holiday |
| 09:00 | W 2/8 won 2 · P 0/10 won 0 · last Classic W 2m | ONE MORE LIKE THAT | lastPlayed |
| 10:00 | W 5/8 won 5 · P 0/10 won 0 | KEEP IT ROLLING, BMT | nextUp |
| 12:00 | W 8/8 won 8 · P 0/10 won 0 | BACK-TO-BACK FLAWLESS! | streak |
| 15:00 | W 8/8 won 8 · P 6/10 won 6 · last Muddle W (record) 1m | FASTEST MUDDLE YET! | newRecord |
| 18:00 | W 8/8 won 8 · P 9/10 won 9 | BACK-TO-BACK FLAWLESS! | streak |
| 21:00 | W 8/8 won 8 · P 10/10 won 10 | A FRIGHTFULLY PERFECT DAY | doubleFlawless |
| 23:00 | W 8/8 won 8 · P 10/10 won 10 | SCARY GOOD, BMT! | doubleFlawless |

#### Player B: "doug", a few games a day, winter holidays (Wed Dec 16), small phone

| Local time | State | Headline | Context |
|---|---|---|---|
| 07:00 | nothing played | A HEAD START ON TODAY | timeOfDay |
| 12:00 | nothing played | HALFWAY THROUGH THE DAY | timeOfDay |
| 13:00 | W 1/8 won 0 · P 0/10 won 0 · last Six L 1m | A TRICKY ONE, DOUG | lastPlayed |
| 17:00 | W 1/8 won 0 · P 0/10 won 0 | HOW ABOUT SEVEN? | nextUp |
| 20:00 | W 2/8 won 1 · P 1/10 won 1 · last Hubbub W 5m | ON A ROLL, DOUG! | lastPlayed |
| 22:00 | W 2/8 won 1 · P 1/10 won 1 | UNWRAP KINDRED NEXT | nextUp |

#### Player C: guest (no name), plain Tuesday in August, finishes the Puzzles row

| Local time | State | Headline | Context |
|---|---|---|---|
| 10:00 | nothing played | MORNING! THE BOARDS ARE SET | timeOfDay |
| 14:00 | W 0/8 won 0 · P 4/10 won 3 | YOU'RE KIND OF A BIG DEAL | surprise |
| 19:00 | W 0/8 won 0 · P 10/10 won 8 | SWEPT A ROW! 8 TO GO | rowDone |
| 22:00 | W 8/8 won 6 · P 10/10 won 8 | EVERY BOARD, DONE | allDone |

#### One player, the 8 am greeting for ten days in a row (history carried day to day)

- Nov 1: SUNDAY FUNDAY, BMT (weekday)
- Nov 2: LET'S BEGIN, BMT! (timeOfDay)
- Nov 3: GOOD MORNING, BMT! (timeOfDay)
- Nov 4: WIZARD HOURS, BMT (weekday)
- Nov 5: TOP O' THE DAY, BMT (timeOfDay)
- Nov 6: A NEW DAY, BMT! (timeOfDay)
- Nov 7: COFFEE'S ON, BMT (timeOfDay)
- Nov 8: BRIGHT-EYED, BMT? (timeOfDay)
- Nov 9: GOOD MORNING! ALL NEW TODAY (timeOfDay)
- Nov 10: MORNING BRAIN, MEET PUZZLES (timeOfDay)

## 5. Parity and fixtures

- Port `home-headline-pool.ts` 1:1 to Swift (`HomeHeadlinePool.swift`) and Kotlin (`HomeHeadlinePool.kt`), bank included (the bank is data: generate the three copies from the TS source with a script so the words are byte-equal, like `season-registry.json`).
- Add to `packages/core/scripts/gen-parity-fixtures.ts` → `home-headline-pool-fixtures.json`: (a) `timeBucket` for 0–23, (b) `headlinePack` and `weekdayOf` for a year of dates, (c) `selectHomeHeadline` for a grid of {user seed × 3, date × 6 (one per pack + plain), bucket × 7, state × 10 (each context), name ∈ {'', 'BMT', 'Maximillian_The_Great'}, slot ∈ {285, 334, 358}, history ∈ {[], [first pick]}} → ~1,100 cases with `text`, `id`, `context`. Swift/Kotlin tests assert byte-equal output (same pattern as `HomeBannerFixtureTests.swift` / `HomeBannerFixtureTest.kt`).
- The bank's own test (`home-headline-pool.test.ts`): 250+ lines, unique, American spelling, no emoji, no shaming words, every line fits 285/334/358 for guest / short / long names.

## 6. Performance

- Pure string work: one pool (≤ 20 lines) filtered by a fit check that is a few hundred float adds. Measured in vitest: the whole 384-line bank × 3 names × 3 slots fits in well under a second; one `selectHomeHeadline` call is microseconds. Nothing allocates per frame.
- Recompute triggers only: bucket change (a 60 s timer compares `timeBucket(hour)` and re-runs only on change — at most 7/day), progress or streak change (already re-renders the banner), a game finishing (writes `lastGame`), history change (once per shown line). The `lastPlayed` reaction expiring after 20 min needs no timer: the next bucket tick or state change re-evaluates it.
- Web: `useMemo` on `[dateKey, bucket, word, puzzles, streaks, nextGame, lastGame, slotWidth, name]`. iOS/Android: compute in the existing banner view-model when those inputs change; the result is a plain string the current LiveHeadline / bubble renderer already draws, so no new drawing cost and the slot height is unchanged (two reserved lines).
- Storage: the history list is read once at Home mount and written when a line is first shown; no Supabase.

## 7. Rollout

1. Flag `home_headline_pool` (remote config, default off) → core returns `legacy` when off, so nothing changes.
2. Ship the core + ports + fixtures behind the flag in the next build; turn on for admins/TestFlight first.
3. Founder review of the bank (this doc, §8) — lines get cut or added before the flag goes public; the bank is append-only after that.
4. Public on, both stores + web together (fix-parity rule).
5. Later: friends-aware lines ("3 FRIENDS ON NOW"), level / achievement reactions, a "{name}'s weekday title" pull from the leaderboard title.

## 8. The copy bank (generated from `home-headline-pool.ts`)

Tags: `time/<bucket>`, `weekday/<0=Sun..6>`, `holiday/<key>`, `pack/<pack>`, `<context>` and `<context>/<pack>` flavors, `surprise`, `unlimited`. Slots as in §3.4.

Total: 384 lines in 74 pools (plus the ~70 existing streak lines in streak-headline.ts, unchanged).

#### time/lateNight (10)

- `UP LATE, {name}?`
- `NIGHT OWL, {name}?`
- `MOONLIT WORDS, {name}`
- `ONE MORE BEFORE BED?`
- `QUIET HOURS, SHARP MIND`
- `MIDNIGHT WORDS HIT DIFFERENT`
- `STILL UP? SO ARE THE PUZZLES`
- `A LITTLE LATE-NIGHT WORDPLAY`
- `THE LETTERS ARE UP TOO`
- `INSOMNIA LOVES A GOOD PUZZLE`

#### time/earlyMorning (10)

- `EARLY BIRD, {name}!`
- `UP WITH THE SUN, {name}`
- `FIRST LIGHT, FIRST WORD`
- `COFFEE FIRST OR PUZZLE FIRST?`
- `DAWN PATROL, {name}`
- `THE DAY IS BRAND NEW`
- `RISE AND SOLVE, {name}!`
- `BEAT THE SUN TO IT`
- `SUNRISE SOLVE, {name}`
- `A HEAD START ON TODAY`

#### time/morning (12)

- `GOOD MORNING, {name}!`
- `FRESH PUZZLES, {name}!`
- `A NEW DAY, {name}!`
- `BRIGHT-EYED, {name}?`
- `TOP O' THE DAY, {name}`
- `MORNING BRAIN, MEET PUZZLES`
- `LET'S BEGIN, {name}!`
- `18 FRESH PUZZLES, {name}`
- `MORNING! THE BOARDS ARE SET`
- `COFFEE'S ON, {name}`
- `RISE AND SHINE, {name}`
- `GOOD MORNING! ALL NEW TODAY`

#### time/midday (10)

- `HAPPY LUNCHTIME, {name}!`
- `HIGH NOON, {name}`
- `A MIDDAY PUZZLE BREAK?`
- `LUNCH BREAK, {name}?`
- `HALFWAY THROUGH THE DAY`
- `NOON ALREADY, {name}?`
- `PERFECT TIME FOR A ROUND`
- `GAME ON, {name}`
- `BREAK TIME, BRAIN TIME`
- `SANDWICH IN ONE HAND?`

#### time/afternoon (10)

- `GOOD AFTERNOON, {name}!`
- `READY, {name}?`
- `THE AFTERNOON IS YOURS`
- `A LITTLE 3 PM BRAIN BOOST`
- `HELLO AGAIN, {name}`
- `SUNNY SIDE UP, {name}`
- `AFTERNOON SLUMP? NOT HERE`
- `TEA TIME, {name}?`
- `BOARDS AWAIT, {name}`
- `MID-AFTERNOON, MID-GENIUS`

#### time/evening (10)

- `GOOD EVENING, {name}!`
- `WIND DOWN, {name}`
- `DINNER'S DONE? PUZZLE TIME`
- `GOLDEN HOUR, {name}`
- `EVENING WORDS, {name}`
- `SLIPPERS ON, PUZZLES OPEN`
- `SETTLE IN, {name}`
- `A COZY EVENING ROUND`
- `LIGHTS LOW, LETTERS BRIGHT`
- `YOUR MOVE, {name}`

#### time/night (10)

- `STARRY NIGHT, {name}`
- `ONE LAST ROUND, {name}?`
- `BEFORE BED, A PUZZLE`
- `STARS ARE OUT, {name}`
- `A NIGHTCAP OF WORDS`
- `LATE SHIFT, {name}`
- `THE DAY ISN'T OVER YET`
- `PAJAMA PUZZLES, {name}`
- `NIGHT MODE: ON`
- `UNWIND, {name}`

#### weekday/0 (4)

- `SUNDAY, {name}!`
- `SLOW SUNDAY, SHARP WORDS`
- `NO RUSH TODAY, {name}`
- `SUNDAY FUNDAY, {name}`

#### weekday/1 (4)

- `MONDAY MASTER, {name}`
- `MONDAY? PUZZLES FIX THAT`
- `NEW WEEK, {name}!`
- `OWN MONDAY, {name}`

#### weekday/2 (4)

- `TUESDAY TITAN, {name}`
- `TERRIFIC TUESDAY, {name}`
- `TUESDAY: THE SLEEPER HIT`
- `GAME FACE, {name}`

#### weekday/3 (4)

- `WIZARD HOURS, {name}`
- `HUMP DAY, {name}!`
- `MIDWEEK MAGIC, {name}`
- `WEDNESDAY WORDS AWAIT`

#### weekday/4 (4)

- `THUNDER TIME, {name}!`
- `ALMOST FRIDAY, {name}`
- `FRIDAY EVE, {name}`
- `THUNDER AHEAD, {name}`

#### weekday/5 (4)

- `FRIDAY'S FINEST, {name}!`
- `HAPPY FRIDAY, {name}!`
- `FRIDAY FEELING, {name}`
- `TGIF, {name}!`

#### weekday/6 (4)

- `SATURDAY STAR, {name}!`
- `ALL YOURS, {name}`
- `WEEKEND WORDS, {name}`
- `SLOW SATURDAY, QUICK WINS`

#### holiday/newyear (4)

- `HAPPY NEW YEAR, {name}!`
- `NEW YEAR, NEW WORDS`
- `FRESH YEAR, FRESH PUZZLES`
- `A CLEAN SLATE, {name}`

#### holiday/mlkday (2)

- `A DAY TO REFLECT, {name}`
- `WORDS CAN MOVE THE WORLD`

#### holiday/groundhog (3)

- `SIX MORE WEEKS OF PUZZLES`
- `DID THE GROUNDHOG SEE IT?`
- `SAME DAY AGAIN? NEW PUZZLES`

#### holiday/valentines (4)

- `BE MINE, {name}?`
- `WORDS FROM THE HEART`
- `LOVE AT FIRST LETTER`
- `ROSES ARE RED, {name}`

#### holiday/presidents (2)

- `HAIL TO THE CHIEF, {name}`
- `A PRESIDENTIAL PUZZLE DAY`

#### holiday/lunarnewyear (3)

- `HAPPY LUNAR NEW YEAR!`
- `GOOD FORTUNE, {name}`
- `LUCKY YEAR, {name}`

#### holiday/mardigras (3)

- `LAISSEZ LES MOTS ROULER`
- `MARDI GRAS, {name}!`
- `FAT TUESDAY, FULL BOARDS`

#### holiday/stpatricks (4)

- `LUCKY DAY, {name}!`
- `GREEN ALL OVER, {name}`
- `FOUR-LEAF LETTERS TODAY`
- `SLÁINTE, {name}!`

#### holiday/aprilfools (3)

- `NO TRICKS, JUST PUZZLES`
- `APRIL FOOLS, {name}!`
- `TRUST NO WORD TODAY`

#### holiday/passover (2)

- `CHAG SAMEACH, {name}`
- `A STORY WORTH RETELLING`

#### holiday/easter (3)

- `HAPPY EASTER, {name}!`
- `WORDS HIDDEN LIKE EGGS`
- `HOPPY SOLVING, {name}`

#### holiday/earthday (3)

- `HAPPY EARTH DAY, {name}`
- `GREEN LETTERS, BLUE PLANET`
- `EARTH DAY, {name}!`

#### holiday/cincodemayo (3)

- `FELIZ CINCO DE MAYO!`
- `FIESTA TIME, {name}`
- `CINCO LETRAS, {name}?`

#### holiday/mothersday (3)

- `HAPPY MOTHER'S DAY!`
- `CALL YOUR MOM, {name}`
- `MOMS KNOW ALL THE WORDS`

#### holiday/memorial (2)

- `IN REMEMBRANCE, {name}`
- `A DAY TO HONOR AND REST`

#### holiday/juneteenth (3)

- `JUNETEENTH, {name}`
- `FREEDOM DAY, {name}`
- `CELEBRATE AND REFLECT`

#### holiday/fathersday (3)

- `HAPPY FATHER'S DAY!`
- `DAD JOKES NOT INCLUDED`
- `CALL YOUR DAD, {name}`

#### holiday/july4 (4)

- `HAPPY FOURTH, {name}!`
- `STARS, STRIPES AND LETTERS`
- `FIREWORKS LATER. PUZZLES NOW`
- `RED, WHITE AND WORDS`

#### holiday/labor (3)

- `HAPPY LABOR DAY, {name}`
- `REST, THEN PUZZLE`
- `A DAY OFF WELL EARNED`

#### holiday/indigenous (3)

- `HARVEST MOON, {name}`
- `A BRIGHT MOON, BRIGHT MIND`
- `UNDER THE HARVEST MOON`

#### holiday/halloween (5)

- `HAPPY HALLOWEEN!`
- `BOO, {name}!`
- `TRICK OR TREAT? PUZZLE`
- `SPOOKY SOLVING, {name}`
- `FANGS A LOT, {name}`

#### holiday/veterans (2)

- `THANK YOU, VETERANS`
- `HONOR AND THANKS`

#### holiday/diwali (3)

- `HAPPY DIWALI, {name}!`
- `LIGHT WINS, {name}`
- `A FESTIVAL OF LIGHT`

#### holiday/thanksgiving (5)

- `HAPPY THANKSGIVING!`
- `GRATEFUL, {name}`
- `PASS THE PIE, {name}`
- `FEAST ON WORDS, {name}`
- `THANKFUL AND FULL`

#### holiday/hanukkah (3)

- `HAPPY HANUKKAH, {name}!`
- `EIGHT NIGHTS OF LIGHT`
- `FESTIVAL OF LIGHTS!`

#### holiday/christmas (4)

- `MERRY CHRISTMAS!`
- `MERRY, {name}!`
- `HO HO HO, {name}`
- `UNWRAP TODAY'S PUZZLES`

#### holiday/kwanzaa (2)

- `HAPPY KWANZAA, {name}!`
- `JOYOUS KWANZAA, {name}`

#### pack/halloween (10)

- `SOMETHING WICKED THIS WAY WORDS`
- `BOO-TIFUL DAY, {name}`
- `SPOOKY SEASON, {name}`
- `CREEP IT REAL, {name}`
- `WITCHING HOUR WORDS`
- `NO GHOSTS, JUST PUZZLES`
- `PUMPKIN TIME, {name}`
- `EERIE GOOD PUZZLES TODAY`
- `A HAUNTINGLY GOOD DAY`
- `GOBLIN MODE, {name}?`

#### pack/thanksgiving (8)

- `GRATEFUL FOR PUZZLES`
- `GOBBLE UP A PUZZLE`
- `HARVEST SEASON, {name}`
- `PIE LATER. PUZZLE NOW`
- `THANKFUL FOR YOU`
- `A CORNUCOPIA OF WORDS`
- `LEFTOVERS AND LETTERS`
- `COZY SEASON, {name}`

#### pack/winter (12)

- `HAPPY HOLIDAYS, {name}!`
- `SEASON'S GREETINGS!`
- `WARM WISHES, {name}`
- `COCOA AND CROSSWORDS?`
- `LET IT SNOW, LET IT SOLVE`
- `COZY UP, {name}`
- `FESTIVE PUZZLES AWAIT`
- `TWINKLY SEASON, {name}`
- `SNOW DAY VIBES, {name}`
- `BUNDLE UP, {name}`
- `MERRY EVERYTHING!`
- `HOLIDAY HOURS: ALWAYS OPEN`

#### pack/newyear (6)

- `NEW YEAR, SAME GENIUS`
- `RESOLUTION: MORE PUZZLES`
- `A FRESH YEAR OF WORDS`
- `CHEERS, {name}!`
- `DAY ONE, {name}!`
- `OUT WITH THE OLD WORDS`

#### pack/valentines (4)

- `PUZZLES ARE OUR LOVE LANGUAGE`
- `YOU'RE A CATCH, {name}`
- `SWEET ON WORDS, {name}`
- `HEARTS AND LETTERS`

#### pack/spring (4)

- `SPRING HAS SPRUNG!`
- `FRESH AS SPRING, {name}`
- `BLOOMING GOOD PUZZLES`
- `APRIL SHOWERS, WORD POWERS`

#### pack/summer (4)

- `SUMMER WORDS, {name}`
- `SUNSCREEN AND SUDOKU?`
- `LONG DAYS, LONG WORDS`
- `BEACH BRAIN? NOT YOU`

#### pack/fall (4)

- `SWEATER WEATHER!`
- `CRISP AIR, CRISP MIND`
- `FALLING FOR PUZZLES`
- `PUMPKIN SPICE AND PUZZLES`

#### doubleFlawless (12)

- `DOUBLE FLAWLESS!`
- `DOUBLE GOLD, {name}!`
- `FLAWLESS TIMES TWO!`
- `18 FOR 18. UNREAL, {name}!`
- `A PERFECT DAY, {name}!`
- `NOT ONE MISS. DOUBLE FLAWLESS!`
- `TAKE A BOW, {name}!`
- `FLAWLESS. BOTH ROWS. WOW`
- `THE WHOLE BOARD GLOWS GOLD`
- `ZERO MISSES, {name}!`
- `A GOLDEN DAY, {name}!`
- `FRAME THIS ONE, {name}`

#### doubleFlawless/halloween (4)

- `SCARY GOOD, {name}!`
- `A FRIGHTFULLY PERFECT DAY`
- `DOUBLE FLAWLESS! NO TRICKS`
- `PERFECT TO THE BONE`

#### doubleFlawless/thanksgiving (3)

- `A FEAST OF FLAWLESS`
- `DOUBLE FLAWLESS! GRATEFUL`
- `STUFFED WITH WINS`

#### doubleFlawless/winter (3)

- `DOUBLE FLAWLESS! A GIFT`
- `PERFECT AS FRESH SNOW`
- `A FLAWLESS HOLIDAY`

#### doubleFlawless/newyear (2)

- `A PERFECT START, {name}!`
- `DOUBLE FLAWLESS! WHAT A YEAR`

#### flawlessRow (10)

- `WORDOCIOUS FLAWLESS! {left} LEFT`
- `FLAWLESS ROW! {left} TO GO`
- `ONE ROW GOLD. {left} MORE`
- `HALF THE DAY, ALL PERFECT`
- `GOLD ROW, {name}!`
- `NO MISSES YET, {name}`
- `FLAWLESS SO FAR, {name}!`
- `A ROW OF GOLD, {left} LEFT`
- `PERFECT ROW! NOW {next}?`
- `FLAWLESS! {next} IS NEXT`

#### flawlessRow/halloween (2)

- `SPOOKY PERFECT, {name}!`
- `A FLAWLESS FRIGHT, {left} LEFT`

#### flawlessRow/thanksgiving (2)

- `FLAWLESS! SAVE ROOM FOR {left}`
- `A GOLDEN HARVEST`

#### flawlessRow/winter (2)

- `FLAWLESS! {left} GIFTS LEFT`
- `A ROW OF GOLD, {name}!`

#### newRecord (10)

- `NEW RECORD IN {last}!`
- `PERSONAL BEST, {name}!`
- `A NEW BEST IN {last}!`
- `RECORD BREAKER, {name}!`
- `FASTEST {last} YET!`
- `YOUR BEST {last} EVER`
- `A NEW HIGH MARK, {name}`
- `A RECORD, {name}!`
- `NEW BEST! {left} LEFT TODAY`
- `BEST EVER, {name}!`

#### allDone (10)

- `ALL 18 DONE, {name}!`
- `DOUBLE SWEEP, {name}!`
- `THAT'S A WRAP, {name}!`
- `EVERY BOARD, DONE`
- `CLEAN SWEEP, {name}!`
- `NOTHING LEFT BUT BRAGGING`
- `FULL HOUSE, {name}!`
- `DAY COMPLETE. NICELY DONE`
- `TABLE CLEARED, {name}`
- `SEE YOU TOMORROW!`

#### allDone/halloween (2)

- `ALL TREATS, NO TRICKS LEFT`
- `THE CRYPT IS EMPTY`

#### allDone/thanksgiving (2)

- `PLATE CLEAN, {name}!`
- `ALL GOBBLED UP, {name}`

#### allDone/winter (2)

- `EVERY GIFT UNWRAPPED`
- `COCOA TIME, {name}`

#### allDone/newyear (2)

- `A COMPLETE DAY, {name}!`
- `DONE AND DUSTED!`

#### rowDone (8)

- `ROW ONE DONE! {left} LEFT`
- `SWEPT A ROW! {left} TO GO`
- `HALFWAY HOME, {name}`
- `ONE ROW DOWN, {left} LEFT`
- `SWEEP! NOW {next}?`
- `KEEP THE BROOM OUT`
- `ROW SWEPT! {left} MORE`
- `NICE SWEEP, {name}!`

#### lastPlayed/won (12)

- `NICE {last}, {name}!`
- `{last}: CONQUERED`
- `THAT {last} WAS CLEAN`
- `STILL WARM FROM {last}`
- `ONE MORE LIKE THAT`
- `WELL PLAYED, {name}!`
- `{last} DOWN. {left} LEFT`
- `SMOOTH {last}!`
- `{last} LOOKED EASY`
- `ON A ROLL, {name}!`
- `NEXT UP: {next}?`
- `{last} DONE. {next} NEXT?`

#### lastPlayed/lost (10)

- `TOUGH {last}. YOU'VE GOT THIS`
- `A TRICKY ONE, {name}`
- `SHAKE IT OFF, {name}`
- `ON TO THE NEXT, {name}`
- `THAT {last} WAS A BEAST`
- `REGROUP. {next} AWAITS`
- `EVERYONE MISSES ONE`
- `FRESH START WITH {next}?`
- `NO SWEAT, {name}`
- `THE NEXT ONE IS YOURS`

#### nextUp (16)

- `NEXT UP: {next}`
- `{next} IS CALLING`
- `{next} AWAITS`
- `WARMING UP · {played} DOWN`
- `ON A ROLL · {played} OF {total}`
- `HOME STRETCH · {left} LEFT`
- `HOW ABOUT {next}?`
- `{left} TO GO. {next} NEXT?`
- `TRY {next} NEXT`
- `KEEP IT ROLLING, {name}`
- `{next} IS WAITING`
- `STRETCH GOAL: {next}`
- `ALMOST THERE, {name}`
- `YOU'RE CRUISING, {name}`
- `{left} LEFT. YOU'VE GOT TIME`
- `THE DAY ISN'T DONE YET`

#### nextUp/halloween (4)

- `{next} LURKS NEXT`
- `DARE TO TRY {next}?`
- `SPOOKY GOOD PACE`
- `THE CAULDRON HAS {left} LEFT`

#### nextUp/thanksgiving (3)

- `SECOND HELPING: {next}`
- `ROOM FOR {left} MORE?`
- `GRAVY ON TOP: {next}`

#### nextUp/winter (3)

- `UNWRAP {next} NEXT`
- `{left} STOCKINGS TO FILL`
- `NEXT GIFT: {next}`

#### nextUp/newyear (2)

- `RESOLUTION: {next}`
- `A NEW YEAR, {left} LEFT TODAY`

#### surprise (16)

- `YOU'RE KIND OF A BIG DEAL`
- `THE LETTERS MISSED YOU`
- `PLOT TWIST: MORE PUZZLES`
- `A WILD PUZZLER APPEARS`
- `WE SAVED YOUR SEAT`
- `FUN FACT: YOU'RE GREAT`
- `LOOK WHO'S HERE!`
- `TODAY FEELS LUCKY`
- `VOWELS ARE OVERRATED`
- `YOU AGAIN? WONDERFUL`
- `MAIN CHARACTER ENERGY`
- `THE BOARD WHISPERS YOUR NAME`
- `CERTIFIED WORD NERD`
- `SPELLING: 10/10`
- `NO NOTES, {name}`
- `SMALL STEPS, BIG WORDS`

#### unlimited (6)

- `UNLIMITED PLAY`
- `ENDLESS PUZZLES, {name}`
- `NO LIMITS TODAY`
- `PLAY TILL YOU DROP`
- `FRESH SEED EVERY TAP`
- `UNLIMITED MODE, {name}`
