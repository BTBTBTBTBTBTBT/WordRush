# JP social plan, block 2: Mon Nov 30 - Sun Dec 27, 2026

Founder 10-16: continue the social calendar with newly designed custom posts, building on the days already started and on the strategy in `apps/web/lib/admin/social-plan.ts`. Block 1 (Oct 13 - Nov 29) is in `apps/web/lib/admin/jp45-posts.json` / `docs/sql/20261014-jp45-posts.sql`. This block is a PLAN: nothing here is generated, applied or posted.

**Generated from** `docs/marketing/jp45/b2_data.py` by `build-block2.py` (re-run it after any edit; it also validates the brand rules and caption budgets). Outputs: `apps/web/lib/admin/jp45-block2-posts.json`, `docs/sql/20261016-jp45-block2-posts.sql` (NOT applied), `docs/design/brand/social/jp45/incoming/full/queue-block2.json`, `docs/design/brand/social/jp45/manifest-block2.json` (stubs).

**Totals:** 74 posts (fb 3, feed 12, holiday 3, pin 12, video 16, x 28), 151 platform targets with tracked links, 61 images for the ChatGPT runner. Videos are `[Needs capture]` drafts (paused), like block 1; their covers are cut by `make-video.py`, so they add no scene images.

## How block 1 worked (what this block copies)
- **Slots per day:** `x` 08:00 every day (X + Threads); `feed` 11:30 (Instagram + Facebook + Threads, portrait) on Wed (Muddle), Fri (Friday's Finest) and special days; `fb` 11:30 Sunday (Facebook only, Sweep Sunday); `pin` x3 on Thursdays at 13:00, 15:00, 17:00 (Pinterest: explainer, word card, cast art); `video` 18:00 (TikTok + Instagram, paused until Brian captures it); `holiday` 07:00 for every real holiday (X, Threads, Instagram, Facebook; portrait + landscape, own image).
- **Weekly series:** Mon MONDAY MASTERS, Tue WOTD quiz (or a special), Wed MUDDLE WEDNESDAY, Thu WOTD quiz + Hubbub pangram tease + pins, Fri FRIDAY'S FINEST, Sat CAST SATURDAY (bot-ladder lore), Sun SWEEP SUNDAY.
- **Caption shapes:** X is a short caps title line, a blank line, then one or two sentences (the tracked link is added by the Studio; budget 260 with the link counted as 23). Threads repeats it a little longer. Instagram adds "Play free: link in bio." (never the link). Facebook is one paragraph. Pinterest is one descriptive paragraph (about 250 characters) with the link in the pin field. Videos: TikTok and Instagram share one caption ending "Play free: link in bio." Hashtags live on the post (wordgames, dailypuzzle, wordocious plus puzzlegames off X), appended by the Studio.
- **Tracked links:** every target gets `marketing_links` slug `p-<last 8 hex of the post id>-<platform>` (served at `/go/<slug>`), created by the same SQL.
- **Images:** one ChatGPT whole scene per post and format (landscape 3:2 for X, portrait 2:3 for feed/fb/holiday, 2:3 for pins), finished by `scene.py accept` (real wordmark top, footer bottom, headline hue-shifted to the series color), logged in `manifest.json`. Brief format = an item in `incoming/full/queue.json` (id, headline, sub, cast, refs, layout, notes); this block adds a ready-to-paste `prompt` and a `tab_group` per item.
- **Studio load:** a JSON of posts, a generator, an idempotent SQL file with `social_posts`, `marketing_links`, `social_post_targets`; media attached later with `social-attach.mjs`.

## Block 2 decisions
1. **Season colors.** Nov 30 = standard look. Dec 1-26 = WINTER HOLIDAYS (Christmas + a real share of Hanukkah + Kwanzaa; objects, food, light and color, never religious garments). Dec 27 = New Year (no costume art built yet: the teaser uses the winter cast with gold confetti).
2. **Holiday greetings (own 7 AM post with its own image, plus the day's posts):** Hanukkah **Fri Dec 4**, Christmas **Fri Dec 25**, Kwanzaa **Sat Dec 26**. Hanukkah is posted the MORNING OF Dec 4 because it begins at sundown that evening, so the post lands before the first candle ("the first candle is lit tonight"); a Dec 5 post would arrive after night one is over. The app's Hanukkah themed-puzzle day is Dec 5, so the greeting does not claim themed puzzles. Christmas Eve is not a greeting (the rule is actual holidays); Dec 24 gets a themed-puzzle mention inside the WOTD post instead.
3. **Winter Solstice (Dec 21): no greeting.** The plan's holiday rule is "every actual holiday" (cultural holidays with a themed puzzle day: Halloween, Day of the Dead, Diwali, Veterans Day, Thanksgiving). The solstice is an astronomical observance, so it gets a one-line nod inside Monday Masters ("the longest night ... a long streak") and nothing more.
4. **Giving Tuesday (Dec 1): skipped.** It is a donation drive and Wordocious has no charity program; a post would be off-brand or an unfunded claim. Dec 1 is the winter reveal instead.
5. **Thanksgiving recap (Nov 30)** is the feed post "DISHES ARE DONE" (no real data) that also teases tomorrow with one snowflake at the edge of the image (subtle hint rule).
6. **Release tie-ins.** 2.9 (time-of-day walls, shipped in the stores for Halloween/Thanksgiving) becomes a winter video on Dec 17 ("the app changes with the time of day"); it is paused until the winter walls' time-of-day variants are confirmed (they were "night v2 only" in the season PLAYBOOK table). The winter reveal posts are paused until the winter build is live and core `SEASON_WINDOWS` has the winter-holidays row (`ready: true`).
7. **WOTD quiz words** were computed with `wordOfDay()` and checked against all nine daily-mode answers for the same date: CHILI (Dec 3), HONOR (Dec 8), VOTED (Dec 10), BLEAK (Dec 15), EXTRA (Dec 17), HASTE (Dec 24). Dec 1 (ACTED) and Dec 22 (CASTE) are deliberately not quiz days: Dec 1 is the winter reveal (same as Nov 17 swapped the quiz), Dec 22 is the gift-a-shield post. The correct choice letter is stored in `wotd.answer`, never in a caption. Pin word cards use PAST words (BLISS Oct 19, SCORE Nov 26, NOBLE Nov 8, SKIES Oct 23).
8. **Pin rotation.** Explainers not yet used: Spyglass, Sudocious, QuadWord, Crosswordocious. Cast pins: Opal, W in the Santa hat, Ollie in antlers, and a group "Happy Holidays" pin (all in winter costumes).
9. **18 Days of Wordocious** finishes in this block (eps 15-18: ProperNoundle, Classic Six, Classic Seven, Classic on Dec 15).
10. **Cast Saturdays** rotate the remaining ladder bots: Dewey (Dec 5), Ozzy (Dec 12), Ivy (Dec 19), Rip (Dec 26). Lineups, group sizes and poses rotate per post (no fixed hosts).
11. **Wordocious Wrapped:** only a teaser on Dec 27 ("Your year in Wordocious is almost here"), no numbers and no feature claim; PAUSED until the founder confirms a year-in-review actually ships.

## Series headline colors for winter (proposal; add to `compose.py` SERIES_COLORS['winter'] and the STYLE.md table, hue in degrees)
| Series | Winter holidays (Dec 1-26) |
|---|---|
| MONDAY MASTERS | frost blue 205-192 |
| WORD OF THE DAY QUIZ (+ word pins) | pine green 145-128 |
| MUDDLE WEDNESDAY (+ explainer pins) | candlelight gold 48-38 |
| 7 LETTERS. ONE WORD. | northern-lights teal 172-160 |
| FRIDAY'S FINEST | holly red 358-348 |
| SWEEP SUNDAY | midnight indigo 238-226 |
| CAST SATURDAY | one sweep: red 355, green 140, gold 45, ice blue 210, plum 300 |
| GIFT A SHIELD / WINTER IS HERE / DISHES ARE DONE / YOUR YEAR IN WORDS | house purple-pink (brand one-offs) |
| HAPPY HANUKKAH | blue to silver 222-205 |
| MERRY CHRISTMAS | red and green sweep (355, 140, 355) |
| HAPPY KWANZAA | red and green sweep (350, 130, 350, 130) |
Nov 30 uses the Standard column (Monday blue 225-210). Gold sub lines stay gold.

## Pipeline patches needed before the first accept (small, not done in this plan pass)
- `compose.py`: add the `winter` season to `SERIES_COLORS` (table above) and to `DARK`; `scene.py`: map season `winter` to `seasons/winter-holidays/cast` in `review()` (it only knows halloween/thanksgiving) and keep the footer auto-light rule.
- `scene.py` reads ONLY `incoming/full/queue.json`: append `queue-block2.json` first (command in that file's `note`). Merge `manifest-block2.json` into `manifest.json` the same way before accepting.
- Winter cast art: `seasons/winter-holidays/cast/*.png` is the 10-16 redo set; `o2-v2.png` was saved aside (bow overlaps the O ring slightly): lead decides which Opal to attach. The `-alt1` files are old duplicates, do not attach them.

## Founder / lead calls
1. **Kwanzaa themed-puzzle date:** `apps/web/data/holiday-days.json` maps Dec 27 to Kwanzaa (and Dec 26 to Christmas), while Kwanzaa begins Dec 26. The greeting is on Dec 26 (the real first day, Umoja) and does not promise puzzles; consider moving the app's Kwanzaa day to Dec 26.
2. **Wrapped:** does a year-in-review ship? Until yes, the Dec 27 feed post and video stay paused.
3. **Winter build date:** the Dec 1 reveal posts need the winter season live in both stores; if it slips, move them to the ship date.
4. **New Year art:** Dec 27-Jan 2 season has no costume art yet; confirm the teaser may use winter costumes with confetti.
5. **Gift a shield:** Dec 22 posts reuse the Nov 24 claim; confirm the gifting flow before capture of the how-to video.


## Week 1: Mon Nov 30 - Sun Dec 6 (Thanksgiving recap, winter begins, Hanukkah)


### Mon 2026-11-30  |  Monday review #8; Thanksgiving is over, standard look / Thanksgiving recap + one-day tease

**08:00 CT | X | ritual | series `monday`**: Monday Masters: race reset  
`68a35930-ad99-5df9-9fb0-f54e06fe58bf`

- Hook / image text: **MONDAY MASTERS** / THE CROWN IS OPEN.
- x (`/go/p-06fe58bf-x`): MONDAY MASTERS. ¶ New week. Zero points. The crown is open, and the leftovers do not count. Last week's champion is on the Leaderboard. Come take it.
- threads (`/go/p-06fe58bf-threads`): MONDAY MASTERS. ¶ New week. Zero points. The weekly race just reset and everyone starts level, even the cousin who won the turkey argument. Last week's champion is on the Leaderboard tab. Come take the crown.
- Image brief (landscape, standard): cast Umi, Scoot, Rip; plain lilac-to-pink kit sky (standard look, Thanksgiving is over), soft bokeh, the three standing in a relaxed row
- Spoiler / hint note: hint: none

**11:30 CT | FEED | post | series `thanks-recap`**: Thanksgiving is over: who did the dishes? (and tomorrow)  
`303f4125-5264-5e87-a892-81f38c34a060`

- Hook / image text: **DISHES ARE DONE** / REMATCH STARTS NOW.
- instagram (`/go/p-8c34a060-instagram`): The turkey is gone. The dishes are done (by somebody). The family league has a winner. ¶ Who lost at your table? Tell us below, then get your rematch started. ¶ Something is changing in the app tomorrow. Look closely at the cast. ¶ Play free: link in bio.
- facebook (`/go/p-8c34a060-facebook`): The turkey is gone, the dishes are done by somebody, and the family league has a winner. Who lost at your table? Tell us in the comments and start the rematch. Something is changing in the app tomorrow: look closely at the cast.
- threads (`/go/p-8c34a060-threads`): The turkey is gone and the dishes are done by somebody. Who lost your family league? Rematch starts today. Something changes in the app tomorrow.
- Image brief (portrait, standard): cast Webster, Dewey, Ollie; a kitchen-counter scene after the feast: a tidy stack of plates and a dish towel, the cast relaxed; ONE tiny snowflake drifting at the very edge of a window (the subtle hint for tomorrow)
- Spoiler / hint note: hint: a single snowflake at the edge (subtle nod to tomorrow's winter season, not a giveaway)


### Tue 2026-12-01  |  WINTER SEASON ON (Dec 1-26): the social reveal of a look players already have / Winter season reveal / Winter reveal

**08:00 CT | X | season | series `winter` (PAUSED)**: Winter reveal: the app put on a coat  
`70988d94-13bf-5207-bc28-9835db67e770`

- Hook / image text: **WINTER IS HERE** / THE WHOLE APP PUT ON A COAT.
- x (`/go/p-db67e770-x`): WINTER IS HERE. ¶ The cast got dressed again: Christmas, Hanukkah and Kwanzaa, plus snow on every screen. Open the app and see who is wearing what.
- threads (`/go/p-db67e770-threads`): WINTER IS HERE. ¶ The cast got dressed again. Christmas, Hanukkah and Kwanzaa are all in the closet this time, and every screen has snow on it. Open the app and see who is wearing what.
- Image brief (landscape, winter): cast Webster, Dewey, Umi, Ollie; snowy winter-night home wall with warm string lights, a lit window glow, the four standing in a group, soft snowfall
- Spoiler / hint note: hint: none
- Note: Tied to the winter build going live Dec 1 (core SEASON_WINDOWS must have the winter-holidays row, ready: true, and the store build approved). If the build slips, move to the ship date and keep it paused until then.

**11:30 CT | FEED | season | series `winter` (PAUSED)**: Winter reveal: wallpaper and costumes  
`a18da268-6b5b-5652-ab83-a92e1d884181`

- Hook / image text: **WINTER IS HERE** / SNOW ON EVERY SCREEN.
- instagram (`/go/p-1d884181-instagram`): WINTER IS HERE. ¶ Snow on every screen, warm lights on the home wall, and the whole cast in costume: Christmas hats, a Hanukkah sweater, a Kwanzaa wrap and more. ¶ The daily games are the same. The outfits are not. Play free: link in bio.
- facebook (`/go/p-1d884181-facebook`): WINTER IS HERE. The whole Wordocious app dressed for the season: snow on every screen, warm lights and a cast in Christmas, Hanukkah and Kwanzaa costumes. The daily games are the same; the outfits are not.
- threads (`/go/p-1d884181-threads`): WINTER IS HERE. Snow on every screen and the whole cast in costume. Same daily games, new outfits.
- Image brief (portrait, winter): cast Rip, Cosmo, Scoot, Ozzy, Ivy; a cozy snow-globe feel: frosted window frame, string lights, five cast members standing in a relaxed arc
- Spoiler / hint note: hint: none
- Note: Same release gate as the X reveal.

**18:00 CT | VIDEO | video | series `winter` (PAUSED)**: [Needs capture] Winter transformation reveal  
`c2d30c8c-fa6f-5a78-bd2a-a13b5ef29178`

- tiktok (`/go/p-5ef29178-tiktok`): The app got dressed again. ¶ Snow, lights, and a cast in Christmas, Hanukkah and Kwanzaa costumes. Open Wordocious and look. ¶ Play free: link in bio.
- instagram (`/go/p-5ef29178-instagram`): The app got dressed again. ¶ Snow, lights, and a cast in Christmas, Hanukkah and Kwanzaa costumes. Open Wordocious and look. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none
- Note: Capture the season flip in the iPhone simulator demo mode; paused until captured and the build is live.


### Wed 2026-12-02  |  MUDDLE WEDNESDAY

**08:00 CT | X | muddle | series `muddle`**: Muddle Wednesday  
`7248ca63-3882-5f5b-a614-ec21bc5d5b44`

- Hook / image text: **MUDDLE WEDNESDAY** / FOUR WORDS. ONE PUNCHLINE.
- x (`/go/p-bc5d5b44-x`): MUDDLE WEDNESDAY. ¶ Yesterday's Muddle: four words, one punchline, one cartoon. Caption it before you scroll.
- threads (`/go/p-bc5d5b44-threads`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon is up. Four scrambled words, one punchline. Caption it in the replies, then go solve today's Muddle.
- Image brief (landscape, winter): cast Opal, Ivy; two mascots standing low at the far left and far right, cozy snowy wall, calm empty center for the cartoon; layout: only TWO mascots, far left and far right, low; leave the center (about 30 percent of the width, sub line down to the floor) empty for a cartoon added in code; content added in code: `cartoon|<yesterday Muddle cartoon file>|520`
- Spoiler / hint note: hint: none (yesterday's, already-played cartoon; caption and answer not shown)

**11:30 CT | FEED | muddle | series `muddle`**: Muddle Wednesday: caption this  
`6b7e1a5d-f53f-5ff8-a5a9-d0705a6d4dbe`

- Hook / image text: **MUDDLE WEDNESDAY** / CAPTION THIS.
- instagram (`/go/p-5a6d4dbe-instagram`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll. ¶ Today's Muddle is live. Play free: link in bio.
- facebook (`/go/p-5a6d4dbe-facebook`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll. Today's Muddle is live.
- threads (`/go/p-5a6d4dbe-threads`): MUDDLE WEDNESDAY. Yesterday's cartoon is up. Caption it before you scroll.
- Image brief (portrait, winter): cast Dewey, Scoot; two mascots standing low under a calm empty rectangle (70% width x 28% height) for the cartoon, frosty wall; layout: calm empty rectangle ~70% x 28% between the sub line and the mascots' heads, mascots standing low (heads below 68% of the height), headline in the top 33%; content added in code: `cartoon|<yesterday Muddle cartoon file>|700`
- Spoiler / hint note: hint: none (yesterday's, already-played cartoon)


### Thu 2026-12-03  |  WOTD + Hubbub pangram tease / WOTD + pangram tease; pins day / 18 Days

**08:00 CT | X | wotd | series `wotd`**: WOTD quiz CHILI + Hubbub pangram tease  
`0e295a4d-1c08-56dd-aaf8-078ea7d60a53`

- Hook / image text: **WORD OF THE DAY QUIZ**
- x (`/go/p-a7d60a53-x`): Word of the Day: CHILI (noun) ¶ (a) A frozen dessert on a stick / (b) The spicy fruit of a pepper plant / (c) A narrow pass between mountains ¶ No lookups. Answer tonight. Hubbub today: seven letters, one pangram.
- threads (`/go/p-a7d60a53-threads`): Word of the Day: CHILI (noun) ¶ (a) A frozen dessert on a stick / (b) The spicy fruit of a pepper plant / (c) A narrow pass between mountains ¶ No lookups. Answer in the replies tonight. ¶ And today's Hubbub has seven letters and a pangram that uses them all. Find it.
- Image brief (landscape, winter): cast Cosmo, Ozzy; two mascots low and small at the sides, cocoa-steam and snow, calm empty band (28% of height / center 30% of width) for the word tiles; layout: leave a completely empty calm band (about 20 percent of the height, nothing in it) directly under the headline for the word card added in code; heads no higher than 62 percent of the height; content added in code: `wotd|CHILI|WORD OF THE DAY|1.2`
- Spoiler / hint note: hint: the word card shows the day's Word of the Day only (not a puzzle answer)

**13:00 CT | PIN-1 | pin | series `pin-explainer`**: Pin: How to play Spyglass  
`c0a37eb8-962f-579d-bcad-1217e9a6fcbd`

- Hook / image text: **HOW TO PLAY SPYGLASS** / A NEW PUZZLE EVERY DAY.
- pinterest (`/go/p-e9a6fcbd-pinterest`): How to play Spyglass, the daily word search on Wordocious: ten themed words hide in a 10 by 10 grid, the word list starts hidden too, and you find them from the theme alone. Words run across, down and diagonal, always forwards. A free daily puzzle for pattern spotters.
- Image brief (pin, winter): cast Umi, Rip; a winter-night scene with a magnifying lens motif and a frosted grid of letter tiles at the edge (decor only)
- Spoiler / hint note: hint: none

**15:00 CT | PIN-2 | pin | series `pin-word`**: Pin: Word card, BLISS  
`2ee9add2-4bc1-5c39-8985-a2ee2865800c`

- Hook / image text: **BLISS** / WORD OF THE DAY
- pinterest (`/go/p-2865800c-pinterest`): Word of the Day: BLISS (noun). Perfect happiness. A new word every morning on Wordocious, with the archive of every past word.
- Image brief (pin, winter): cast Opal; cocoa steam and soft snow, one mascot centered
- Spoiler / hint note: hint: none (BLISS was the Oct 19 Word of the Day: a past word)

**17:00 CT | PIN-3 | pin | series `pin-cast`**: Pin: Cast art, Opal  
`be5daba2-f7fd-543e-a138-da3b2bbc52a6`

- Hook / image text: **MEET OPAL.** / BRING YOUR FAMILY.
- pinterest (`/go/p-2bbc52a6-pinterest`): Meet Opal, the dramatic O in the Wordocious cast, rung four on the VS bot ladder. Every win is a standing ovation and every loss is a tragedy. Ten letter characters host every corner of the free daily puzzle app.
- Image brief (pin, winter): cast Opal; Opal in her winter cape and muff, glowing string lights
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `18days` (PAUSED)**: [Needs capture] 18 Days ep.15: ProperNoundle  
`d3c37ebf-c796-5982-b8fb-56c88418d9e9`

- tiktok (`/go/p-8418d9e9-tiktok`): 18 Days of Wordocious, episode 15: ProperNoundle. ¶ A daily name-guessing puzzle: places, people and things, and every guess teaches you something. ¶ Free daily: link in bio.
- instagram (`/go/p-8418d9e9-instagram`): 18 Days of Wordocious, episode 15: ProperNoundle. ¶ A daily name-guessing puzzle: places, people and things, and every guess teaches you something. ¶ Free daily: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none
- Note: Check the one-line description against the live ProperNoundle rules before capture.


### Fri 2026-12-04  |  HANUKKAH begins at sundown (Dec 4-12) / FRIDAY'S FINEST / Hanukkah night one

**07:00 CT | HOLIDAY | season | series `holiday-hanukkah` (PAUSED)**: Happy Hanukkah (morning greeting)  
`0052e048-4361-5ea1-8c1b-31a43a413269`

- Hook / image text: **HAPPY HANUKKAH** / LIGHT UP THE NIGHT.
- x (`/go/p-3a413269-x`): Happy Hanukkah from the whole cast. ¶ The first candle is lit tonight. Wishing you light, latkes and a little friendly competition.
- threads (`/go/p-3a413269-threads`): Happy Hanukkah from the whole cast. ¶ The first candle is lit tonight. Wishing you light, latkes, gelt and a little friendly competition around the table.
- instagram (`/go/p-3a413269-instagram`): Happy Hanukkah from the whole cast. ¶ The first candle is lit tonight. Wishing you eight nights of light, latkes, gelt and a little friendly competition around the table. ¶ Play free: link in bio.
- facebook (`/go/p-3a413269-facebook`): Happy Hanukkah from the whole Wordocious cast. The first candle is lit tonight. Wishing you and your family eight nights of light, latkes and a little friendly competition around the table.
- Image brief (portrait + landscape, winter): cast Dewey, Cosmo, Rip; a warm blue-and-silver winter evening: a hanukkiah (nine holders: four, the raised center shamash, four) with night one set (shamash plus ONE candle at the far right, both lit, the other seven holders empty), a dreidel (nun, gimel), gelt, a plate of latkes, soft snow
- Spoiler / hint note: hint: none
- Note: Greeting at 7 AM CT on Dec 4: Hanukkah begins at sundown tonight, so a morning-of post lets people see it before lighting. Themed puzzles in the app are on Dec 5 (data/holiday-days.json), so do NOT say "today's themed puzzles".

**08:00 CT | X | ritual | series `friday`**: Friday's Finest  
`f24bdf56-21c1-5c0b-84b4-9efc4a198558`

- Hook / image text: **FRIDAY'S FINEST** / BEST BOARD OF THE WEEK.
- x (`/go/p-4a198558-x`): FRIDAY'S FINEST. ¶ The best board of the week. Think yours beats it? Post it and make your case.
- threads (`/go/p-4a198558-threads`): FRIDAY'S FINEST. ¶ The best board of the week goes here. Think yours beats it? Share your board in the replies and make your case.
- Image brief (landscape, winter): cast Scoot, Webster; a podium-free scene: two mascots in winter costume with a gold ribbon rosette between them, string lights
- Spoiler / hint note: hint: none

**11:30 CT | FEED | ritual | series `friday`**: Friday's Finest  
`691b0f15-0b9d-5c48-9b52-351ef5f0ca74`

- Hook / image text: **FRIDAY'S FINEST** / BEST BOARD OF THE WEEK.
- instagram (`/go/p-f5f0ca74-instagram`): FRIDAY'S FINEST. ¶ The best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments. ¶ Play today's puzzles free: link in bio.
- facebook (`/go/p-f5f0ca74-facebook`): FRIDAY'S FINEST. ¶ The best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.
- threads (`/go/p-f5f0ca74-threads`): FRIDAY'S FINEST. The best board of the week. Think yours beats it? Make your case.
- Image brief (portrait, winter): cast Ollie, Umi, Ivy; three mascots cheering around a small gold trophy, snowy window behind
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `cast` (PAUSED)**: [Needs capture] Hanukkah night one: cast clip  
`145647f4-f976-57fd-a758-d5d132cd2961`

- tiktok (`/go/p-32cd2961-tiktok`): Night one. ¶ The cast is lighting up the daily board. Happy Hanukkah. ¶ Play free: link in bio.
- instagram (`/go/p-32cd2961-instagram`): Night one. ¶ The cast is lighting up the daily board. Happy Hanukkah. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none
- Note: Cast-led clip (cast-scene.py): D and C with the dreidel and gelt. Paused until captured.


### Sat 2026-12-05  |  CAST SATURDAY

**08:00 CT | X | cast | series `cast`**: Cast Saturday: Dewey studies every letter  
`53b8af85-c812-57a8-902e-ff30a3368911`

- Hook / image text: **DEWEY STUDIES EVERY LETTER** / CAST SATURDAY
- x (`/go/p-a3368911-x`): Meet Dewey, rung eight on the bot ladder. ¶ He studies every letter. Today's themed puzzles are live for Hanukkah. Beat him if you can.
- threads (`/go/p-a3368911-threads`): Meet Dewey, rung eight on the bot ladder. ¶ He studies every letter and wears the Hanukkah sweater well. Today's themed puzzles are live. Beat Dewey, then tell us which rung is next.
- Image brief (landscape, winter): cast Dewey; D alone in the Hanukkah dreidel sweater and beanie holding gelt, blue and silver night, snow, one hanukkiah glowing softly behind
- Spoiler / hint note: hint: none
- Note: Themed puzzles: Dec 5 is the app's Hanukkah day. Verify the live app before approving.

**18:00 CT | VIDEO | video | series `cast` (PAUSED)**: [Needs capture] Cast Saturday video: Dewey  
`d26ae27f-d7f8-5cb4-99cc-42ec5fd70f5c`

- tiktok (`/go/p-5fd70f5c-tiktok`): Meet Dewey, rung eight on the bot ladder. ¶ He studies every letter. Beat him if you can. ¶ Play free: link in bio.
- instagram (`/go/p-5fd70f5c-instagram`): Meet Dewey, rung eight on the bot ladder. ¶ He studies every letter. Beat him if you can. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none


### Sun 2026-12-06  |  SWEEP SUNDAY

**08:00 CT | X | ritual | series `sweep`**: Sweep Sunday  
`b57ac629-90ed-55fb-bf9d-2864c56bb238`

- Hook / image text: **SWEEP SUNDAY** / ALL 18 DAILIES. ONE DAY.
- x (`/go/p-c56bb238-x`): SWEEP SUNDAY. ¶ Can you sweep all 18? One day, every daily, one board to prove it. Post yours.
- threads (`/go/p-c56bb238-threads`): SWEEP SUNDAY. ¶ Can you sweep all 18? One day, every daily, one board to prove it. Post your sweep board and see who in the family cracks first.
- Image brief (landscape, winter): cast Rip; R alone in the quilt wrap and striped nightcap holding a cocoa mug, soft snow, midnight-indigo glow
- Spoiler / hint note: hint: none

**11:30 CT | FB | ritual | series `sweep`**: Sweep Sunday (Facebook)  
`882d5658-086c-55fb-9ef9-9c6d80675b74`

- Hook / image text: **SWEEP SUNDAY** / ALL 18 DAILIES. ONE DAY.
- facebook (`/go/p-80675b74-facebook`): SWEEP SUNDAY. ¶ Can you sweep all 18 dailies today? Hanukkah is on and the cold is in, so there is no better afternoon for it. Share your sweep board in the comments.
- Image brief (portrait, winter): cast Cosmo, Ollie, Webster; three mascots with a tall stack of colorful game tiles and a mug of cocoa, snowy window
- Spoiler / hint note: hint: none


## Week 2: Mon Dec 7 - Sun Dec 13 (Hanukkah nights, 18 Days finale)


### Mon 2026-12-07  |  MONDAY MASTERS

**08:00 CT | X | ritual | series `monday`**: Monday Masters: race reset  
`91a8f869-03d4-5bea-adc6-f1f31cd3676d`

- Hook / image text: **MONDAY MASTERS** / THE CROWN IS OPEN.
- x (`/go/p-1cd3676d-x`): MONDAY MASTERS. ¶ New week. Zero points. The crown is open. Last week's champion is on the Leaderboard. Come take it.
- threads (`/go/p-1cd3676d-threads`): MONDAY MASTERS. ¶ New week. Zero points. The weekly race just reset and everyone starts level. Last week's champion is on the Leaderboard tab. Come take the crown.
- Image brief (landscape, winter): cast Ozzy, Ivy, Dewey; frosty blue-silver night, a gold crown resting on a snowdrift in the middle distance
- Spoiler / hint note: hint: none


### Tue 2026-12-08  |  WOTD quiz / 18 Days

**08:00 CT | X | wotd | series `wotd`**: Word of the Day quiz: HONOR  
`aadaf18a-c2c4-5d00-b262-503f2c4a8ea8`

- Hook / image text: **WORD OF THE DAY QUIZ**
- x (`/go/p-2c4a8ea8-x`): Word of the Day: HONOR (noun) ¶ (a) A small, sharp pain / (b) A thick, low fog / (c) Respect or recognition for someone's worth ¶ No lookups. Answer tonight.
- threads (`/go/p-2c4a8ea8-threads`): Word of the Day: HONOR (noun) ¶ (a) A small, sharp pain / (b) A thick, low fog / (c) Respect or recognition for someone's worth ¶ No lookups. Answer in the replies tonight.
- Image brief (landscape, winter): cast Umi, Webster; two mascots low at the sides, pine branches and snow, calm empty band for the word card; layout: leave a completely empty calm band (about 20 percent of the height) directly under the headline for the word card added in code; content added in code: `wotd|HONOR|WORD OF THE DAY|1.2`
- Spoiler / hint note: hint: word card shows the day's Word of the Day only

**18:00 CT | VIDEO | video | series `18days` (PAUSED)**: [Needs capture] 18 Days ep.16: Classic Six  
`3f51583a-fa9e-5d31-9477-feba8f58ea56`

- tiktok (`/go/p-8f58ea56-tiktok`): 18 Days of Wordocious, episode 16: Classic Six. ¶ The same daily word puzzle with a six-letter word. One more letter changes everything. ¶ Free daily: link in bio.
- instagram (`/go/p-8f58ea56-instagram`): 18 Days of Wordocious, episode 16: Classic Six. ¶ The same daily word puzzle with a six-letter word. One more letter changes everything. ¶ Free daily: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none


### Wed 2026-12-09  |  MUDDLE WEDNESDAY

**08:00 CT | X | muddle | series `muddle`**: Muddle Wednesday  
`93a7ca4f-caf7-57a0-9cc1-269004b1fe44`

- Hook / image text: **MUDDLE WEDNESDAY** / FOUR WORDS. ONE PUNCHLINE.
- x (`/go/p-04b1fe44-x`): MUDDLE WEDNESDAY. ¶ Yesterday's Muddle is up: four scrambled words and one punchline. Caption the cartoon before you scroll.
- threads (`/go/p-04b1fe44-threads`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon is up. Four scrambled words, one punchline. Caption it in the replies, then go solve today's Muddle.
- Image brief (landscape, winter): cast Cosmo, Ollie; two mascots far left and far right, low, with a calm empty center; layout: only TWO mascots, far left and far right, low; the center 30 percent of the width empty for a cartoon added in code; content added in code: `cartoon|<yesterday Muddle cartoon file>|520`
- Spoiler / hint note: hint: none (yesterday's cartoon)

**11:30 CT | FEED | muddle | series `muddle`**: Muddle Wednesday: caption this  
`87d9f720-5397-5f56-95ac-a683daf1154f`

- Hook / image text: **MUDDLE WEDNESDAY** / CAPTION THIS.
- instagram (`/go/p-daf1154f-instagram`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon is up. Four scrambled words, one punchline, and you have until you scroll to caption it. ¶ Today's Muddle is live. Play free: link in bio.
- facebook (`/go/p-daf1154f-facebook`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon is up: four scrambled words and one punchline. Caption it in the comments before you scroll. Today's Muddle is live.
- threads (`/go/p-daf1154f-threads`): MUDDLE WEDNESDAY. Yesterday's cartoon is up. Caption it before you scroll.
- Image brief (portrait, winter): cast Rip, Umi; two mascots low under a calm empty rectangle for the cartoon, cozy snow-lit wall; layout: calm empty rectangle ~70% x 28% between the sub line and the mascots' heads; mascots low; content added in code: `cartoon|<yesterday Muddle cartoon file>|700`
- Spoiler / hint note: hint: none (yesterday's cartoon)


### Thu 2026-12-10  |  WOTD + Hubbub pangram tease / pins day / 18 Days

**08:00 CT | X | wotd | series `wotd`**: WOTD quiz VOTED + Hubbub pangram tease  
`4d3fa44e-6c13-5ed7-aed0-8054176da17a`

- Hook / image text: **WORD OF THE DAY QUIZ**
- x (`/go/p-176da17a-x`): Word of the Day: VOTED (adjective) ¶ (a) Chosen or decided by ballots or a show of hands / (b) Covered in fine dust / (c) Too tired to continue ¶ No lookups. Answer tonight. Hubbub today: seven letters, one pangram.
- threads (`/go/p-176da17a-threads`): Word of the Day: VOTED (adjective) ¶ (a) Chosen or decided by ballots or a show of hands / (b) Covered in fine dust / (c) Too tired to continue ¶ No lookups. Answer in the replies tonight. ¶ And today's Hubbub has seven letters and a pangram that uses them all. Find it.
- Image brief (landscape, winter): cast Rip, Dewey; two mascots low at the sides, string lights across the top, snow, calm empty band for the word card; layout: completely empty calm band (about 20 percent of the height) under the headline for the word card added in code; content added in code: `wotd|VOTED|WORD OF THE DAY|1.2`
- Spoiler / hint note: hint: Word of the Day on the card only

**13:00 CT | PIN-1 | pin | series `pin-explainer`**: Pin: How to play Sudocious  
`77ad1640-fa46-5a65-a733-a48b145ea43a`

- Hook / image text: **HOW TO PLAY SUDOCIOUS** / A NEW PUZZLE EVERY DAY.
- pinterest (`/go/p-145ea43a-pinterest`): How to play Sudocious, the daily number grid on Wordocious: one Medium puzzle a day on a 9 by 9 board, pencil notes to keep track, and the third mistake ends the game. A free daily puzzle for logic fans.
- Image brief (pin, winter): cast Dewey, Ivy; frosty winter study, a few glossy number tiles floating at the edges (decor only, no solved grid)
- Spoiler / hint note: hint: none

**15:00 CT | PIN-2 | pin | series `pin-word`**: Pin: Word card, SCORE  
`3bbf229e-9562-56d2-9e6c-540654ce0ba9`

- Hook / image text: **SCORE** / WORD OF THE DAY
- pinterest (`/go/p-54ce0ba9-pinterest`): Word of the Day: SCORE (noun). The total number of goals, points, runs, etc. earned by a participant in a game. A new word every morning on Wordocious, with the archive of every past word.
- Image brief (pin, winter): cast Ozzy, Cosmo; snow and gold confetti sparkle
- Spoiler / hint note: hint: none (SCORE was the Nov 26 Word of the Day)

**17:00 CT | PIN-3 | pin | series `pin-cast`**: Pin: Cast art, W (Santa)  
`56cd3a6a-a53c-5f74-8936-e6603a623993`

- Hook / image text: **MEET W.** / BRING YOUR FAMILY.
- pinterest (`/go/p-3a623993-pinterest`): Meet W, the leader of the Wordocious cast, in a Santa hat for the season. Ten letter characters spell WORDOCIOUS, and each one hosts a corner of the free daily puzzle app. W is Webster, rung ten on the VS bot ladder, and runs Classic.
- Image brief (pin, winter): cast Webster; W alone in the Santa hat, belt and mittens, snowy village glow
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `18days` (PAUSED)**: [Needs capture] 18 Days ep.17: Classic Seven  
`d7b2e774-edc6-55e2-9923-1fac8b7b41d3`

- tiktok (`/go/p-8b7b41d3-tiktok`): 18 Days of Wordocious, episode 17: Classic Seven. ¶ Seven letters, one daily word, and a lot of second-guessing. ¶ Free daily: link in bio.
- instagram (`/go/p-8b7b41d3-instagram`): 18 Days of Wordocious, episode 17: Classic Seven. ¶ Seven letters, one daily word, and a lot of second-guessing. ¶ Free daily: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none


### Fri 2026-12-11  |  FRIDAY'S FINEST (last night of Hanukkah) / FRIDAY'S FINEST / FRIDAY video

**08:00 CT | X | ritual | series `friday`**: Friday's Finest  
`cc7e74a6-bdcf-5158-ab3c-93ded2cf4a7a`

- Hook / image text: **FRIDAY'S FINEST** / BEST BOARD OF THE WEEK.
- x (`/go/p-d2cf4a7a-x`): FRIDAY'S FINEST. ¶ The best board of the week. The last Hanukkah candle is tonight, so bring your best. Post yours and make your case.
- threads (`/go/p-d2cf4a7a-threads`): FRIDAY'S FINEST. ¶ The best board of the week goes here. The last Hanukkah candle is lit tonight, so bring your best board. Share it in the replies and make your case.
- Image brief (landscape, winter): cast Ivy, Opal, Cosmo; three mascots in a row with a gold ribbon rosette, warm window light, snow
- Spoiler / hint note: hint: none

**11:30 CT | FEED | ritual | series `friday`**: Friday's Finest  
`8e0ddbc4-828e-575d-b362-685e73162d52`

- Hook / image text: **FRIDAY'S FINEST** / BEST BOARD OF THE WEEK.
- instagram (`/go/p-73162d52-instagram`): FRIDAY'S FINEST. ¶ The best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments. ¶ Play today's puzzles free: link in bio.
- facebook (`/go/p-73162d52-facebook`): FRIDAY'S FINEST. ¶ The best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.
- threads (`/go/p-73162d52-threads`): FRIDAY'S FINEST. The best board of the week. Think yours beats it? Make your case.
- Image brief (portrait, winter): cast Scoot; S alone with a determined look in the Kwanzaa kente sash, holding the corn baton like a trophy, snow
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `friday` (PAUSED)**: [Needs capture] Winter boards montage  
`8e8e2c2f-2d3d-57d0-8aa8-ec0c6dd8d58c`

- tiktok (`/go/p-6dd8d58c-tiktok`): Winter boards, wall to wall. ¶ Snow on every screen and 18 daily games underneath it. Pick one. ¶ Play free: link in bio.
- instagram (`/go/p-6dd8d58c-instagram`): Winter boards, wall to wall. ¶ Snow on every screen and 18 daily games underneath it. Pick one. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none


### Sat 2026-12-12  |  CAST SATURDAY

**08:00 CT | X | cast | series `cast`**: Cast Saturday: Ozzy guesses tricky  
`8f4e3391-97fa-5439-8860-32a7564a5b5d`

- Hook / image text: **OZZY GUESSES TRICKY** / CAST SATURDAY
- x (`/go/p-564a5b5d-x`): Meet Ozzy, rung seven on the bot ladder. ¶ Tricky guesses and an ugly sweater he is proud of. Beat him anyway.
- threads (`/go/p-564a5b5d-threads`): Meet Ozzy, rung seven on the bot ladder. ¶ Tricky guesses, an ugly sweater he is very proud of, and zero fear. Beat Ozzy and the boss is only three rungs up.
- Image brief (landscape, winter): cast Ozzy; O3 alone in the knit ugly sweater and pom beanie with red mittens, warm string lights, snow
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `cast` (PAUSED)**: [Needs capture] Cast Saturday video: Ollie the reindeer  
`eb238a7a-c2ff-5e0f-8945-8cca1bca4424`

- tiktok (`/go/p-1bca4424-tiktok`): Ollie cheers every guess. Even the wrong ones. ¶ Now with antlers. ¶ Play free: link in bio.
- instagram (`/go/p-1bca4424-instagram`): Ollie cheers every guess. Even the wrong ones. ¶ Now with antlers. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none


### Sun 2026-12-13  |  SWEEP SUNDAY

**08:00 CT | X | ritual | series `sweep`**: Sweep Sunday  
`0c771add-a13b-5611-82b2-002ae4ea2d61`

- Hook / image text: **SWEEP SUNDAY** / ALL 18 DAILIES. ONE DAY.
- x (`/go/p-e4ea2d61-x`): SWEEP SUNDAY. ¶ Can you sweep all 18? One day, every daily, one board to prove it. Post yours.
- threads (`/go/p-e4ea2d61-threads`): SWEEP SUNDAY. ¶ Can you sweep all 18? One day, every daily, one board to prove it. Post your sweep board and see who in the family cracks first.
- Image brief (landscape, winter): cast Ollie, Cosmo; two mascots, one on a sled-like sweep motif of colored tiles, snowy hill, midnight-indigo glow
- Spoiler / hint note: hint: none

**11:30 CT | FB | ritual | series `sweep`**: Sweep Sunday (Facebook)  
`cdc8b62e-0d1d-5d00-b3bb-9b843e76fc9b`

- Hook / image text: **SWEEP SUNDAY** / ALL 18 DAILIES. ONE DAY.
- facebook (`/go/p-3e76fc9b-facebook`): SWEEP SUNDAY. ¶ Can you sweep all 18 dailies today? Twelve days to Christmas is plenty of time to settle the family bragging rights. Share your sweep board in the comments.
- Image brief (portrait, winter): cast Webster, Ivy, Rip; three mascots around a glowing hearth-colored tile board, snowy window
- Spoiler / hint note: hint: none


## Week 3: Mon Dec 14 - Sun Dec 20 (gift season)


### Mon 2026-12-14  |  MONDAY MASTERS

**08:00 CT | X | ritual | series `monday`**: Monday Masters: race reset  
`180af578-1619-5e75-bbb6-1e7b341f3932`

- Hook / image text: **MONDAY MASTERS** / THE CROWN IS OPEN.
- x (`/go/p-341f3932-x`): MONDAY MASTERS. ¶ New week. Zero points. The crown is open. Last week's champion is on the Leaderboard. Come take it.
- threads (`/go/p-341f3932-threads`): MONDAY MASTERS. ¶ New week. Zero points. The weekly race just reset and everyone starts level. Last week's champion is on the Leaderboard tab. Come take the crown.
- Image brief (landscape, winter): cast Scoot, Opal; icy blue night, snow-capped gold crown on a pedestal of snow, two mascots at the sides
- Spoiler / hint note: hint: none


### Tue 2026-12-15  |  WOTD quiz / 18 Days finale

**08:00 CT | X | wotd | series `wotd`**: Word of the Day quiz: BLEAK  
`63487875-53dc-51e0-be78-181532b96119`

- Hook / image text: **WORD OF THE DAY QUIZ**
- x (`/go/p-32b96119-x`): Word of the Day: BLEAK (adjective) ¶ (a) Bright and cheerful / (b) Bare and cold, without comfort / (c) Quick to anger ¶ No lookups. Answer tonight.
- threads (`/go/p-32b96119-threads`): Word of the Day: BLEAK (adjective) ¶ (a) Bright and cheerful / (b) Bare and cold, without comfort / (c) Quick to anger ¶ No lookups. Answer in the replies tonight.
- Image brief (landscape, winter): cast Ivy, Ollie; two mascots low at the sides, evergreen branches, soft snow, calm empty band for the word card; layout: completely empty calm band (about 20 percent of the height) under the headline for the word card added in code; content added in code: `wotd|BLEAK|WORD OF THE DAY|1.2`
- Spoiler / hint note: hint: Word of the Day on the card only

**18:00 CT | VIDEO | video | series `18days` (PAUSED)**: [Needs capture] 18 Days ep.18: Classic  
`1279104b-c1e5-5333-bd91-16db0c0b02fd`

- tiktok (`/go/p-0c0b02fd-tiktok`): 18 Days of Wordocious, episode 18: Classic. ¶ Where it started. One five-letter word, six guesses, and a cast that has opinions about all of them. ¶ Free daily: link in bio.
- instagram (`/go/p-0c0b02fd-instagram`): 18 Days of Wordocious, episode 18: Classic. ¶ Where it started. One five-letter word, six guesses, and a cast that has opinions about all of them. ¶ Free daily: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none
- Note: Series finale: show all 18 title cards at the end.


### Wed 2026-12-16  |  MUDDLE WEDNESDAY

**08:00 CT | X | muddle | series `muddle`**: Muddle Wednesday  
`38f0426e-59b6-5d8f-8d49-eb85537f07fd`

- Hook / image text: **MUDDLE WEDNESDAY** / FOUR WORDS. ONE PUNCHLINE.
- x (`/go/p-537f07fd-x`): MUDDLE WEDNESDAY. ¶ Yesterday's Muddle: four words, one punchline, one cartoon. Caption it before you scroll.
- threads (`/go/p-537f07fd-threads`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon is up. Four scrambled words, one punchline. Caption it in the replies, then go solve today's Muddle.
- Image brief (landscape, winter): cast Ozzy, Webster; two mascots far left and far right, low, frosty wall, calm empty center; layout: only TWO mascots, far left and far right, low; the center 30 percent of the width empty for a cartoon added in code; content added in code: `cartoon|<yesterday Muddle cartoon file>|520`
- Spoiler / hint note: hint: none (yesterday's cartoon)

**11:30 CT | FEED | muddle | series `muddle`**: Muddle Wednesday: caption this  
`b09da60f-16a8-568b-9b3f-7d5ed3719121`

- Hook / image text: **MUDDLE WEDNESDAY** / CAPTION THIS.
- instagram (`/go/p-d3719121-instagram`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll. ¶ Today's Muddle is live. Play free: link in bio.
- facebook (`/go/p-d3719121-facebook`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll. Today's Muddle is live.
- threads (`/go/p-d3719121-threads`): MUDDLE WEDNESDAY. Yesterday's cartoon is up. Caption it before you scroll.
- Image brief (portrait, winter): cast Umi, Cosmo; two mascots low under a calm empty rectangle for the cartoon, warm lights on a frosted wall; layout: calm empty rectangle ~70% x 28% between the sub line and the mascots' heads; mascots low; content added in code: `cartoon|<yesterday Muddle cartoon file>|700`
- Spoiler / hint note: hint: none (yesterday's cartoon)


### Thu 2026-12-17  |  WOTD + Hubbub pangram tease / pins day / 2.9 time-of-day tease

**08:00 CT | X | wotd | series `wotd`**: WOTD quiz EXTRA + Hubbub pangram tease  
`dfed1694-f768-5850-a3d2-3c72d5402574`

- Hook / image text: **WORD OF THE DAY QUIZ**
- x (`/go/p-d5402574-x`): Word of the Day: EXTRA (adjective) ¶ (a) More than is usual or needed / (b) Out of sight / (c) Slightly damaged ¶ No lookups. Answer tonight. Hubbub today: seven letters, one pangram.
- threads (`/go/p-d5402574-threads`): Word of the Day: EXTRA (adjective) ¶ (a) More than is usual or needed / (b) Out of sight / (c) Slightly damaged ¶ No lookups. Answer in the replies tonight. ¶ And today's Hubbub has seven letters and a pangram that uses them all. Find it.
- Image brief (landscape, winter): cast Scoot, Opal; two mascots low at the sides, gift boxes and ribbon at the edges, calm empty band for the word card; layout: completely empty calm band (about 20 percent of the height) under the headline for the word card added in code; content added in code: `wotd|EXTRA|WORD OF THE DAY|1.2`
- Spoiler / hint note: hint: Word of the Day on the card only

**13:00 CT | PIN-1 | pin | series `pin-explainer`**: Pin: How to play QuadWord  
`5a9be3b6-2057-5ea6-bae2-4eb25dfc3819`

- Hook / image text: **HOW TO PLAY QUADWORD** / A NEW PUZZLE EVERY DAY.
- pinterest (`/go/p-5dfc3819-pinterest`): How to play QuadWord, the four-board daily word puzzle on Wordocious: every word you type lands on all four boards at once, and nine guesses are shared across them. A free daily brain workout for multitaskers.
- Image brief (pin, winter): cast Ollie, Umi; four frosted board-shaped windows glowing at the edges (decor only, no letters)
- Spoiler / hint note: hint: none

**15:00 CT | PIN-2 | pin | series `pin-word`**: Pin: Word card, NOBLE  
`71d585ac-9b1e-504b-9a3a-1a5024e8b7bf`

- Hook / image text: **NOBLE** / WORD OF THE DAY
- pinterest (`/go/p-24e8b7bf-pinterest`): Word of the Day: NOBLE (noun). An aristocrat; one of aristocratic blood. A new word every morning on Wordocious, with the archive of every past word.
- Image brief (pin, winter): cast Rip; soft snow and a gold crown sparkle
- Spoiler / hint note: hint: none (NOBLE was the Nov 8 Word of the Day)

**17:00 CT | PIN-3 | pin | series `pin-cast`**: Pin: Cast art, Ollie (reindeer)  
`1e7eaa26-5c11-5537-9b61-0bbb94bc6716`

- Hook / image text: **MEET OLLIE.** / BRING YOUR FAMILY.
- pinterest (`/go/p-94bc6716-pinterest`): Meet Ollie, the cheerful O in the Wordocious cast, now with reindeer antlers. Ollie hosts QuadWord and Hubbub, cheers every guess and is the third rung on the bot ladder in VS Battle. Ten letter characters, one free daily puzzle app.
- Image brief (pin, winter): cast Ollie; Ollie alone in the reindeer antlers and bell collar, string lights, snow
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `winter` (PAUSED)**: [Needs capture] Time of day: the app changes color with the sun  
`7b292e4e-b58f-5df1-8f4c-28df32889753`

- tiktok (`/go/p-32889753-tiktok`): The app changes with the time of day. ¶ Morning, day, evening and night each get their own wall. Open Wordocious at different hours and watch. ¶ Play free: link in bio.
- instagram (`/go/p-32889753-instagram`): The app changes with the time of day. ¶ Morning, day, evening and night each get their own wall. Open Wordocious at different hours and watch. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none
- Note: 2.9 feature (time-of-day walls). Confirm 2.9 is live in both stores and the winter walls have the time-of-day variants before capture.


### Fri 2026-12-18  |  FRIDAY'S FINEST

**08:00 CT | X | ritual | series `friday`**: Friday's Finest  
`ce101181-d0a2-5a35-ac58-0d09b1a4174c`

- Hook / image text: **FRIDAY'S FINEST** / BEST BOARD OF THE WEEK.
- x (`/go/p-b1a4174c-x`): FRIDAY'S FINEST. ¶ The best board of the week. One week to Christmas and you still have time to earn the title. Post yours.
- threads (`/go/p-b1a4174c-threads`): FRIDAY'S FINEST. ¶ The best board of the week goes here. One week to Christmas, so there is still time to earn the title. Share your board in the replies and make your case.
- Image brief (landscape, winter): cast Dewey, Ozzy; two mascots with a gold ribbon rosette between them, wrapped gifts at the edge
- Spoiler / hint note: hint: none

**11:30 CT | FEED | ritual | series `friday`**: Friday's Finest  
`069d244e-adbf-54af-afee-b68d4d0d814c`

- Hook / image text: **FRIDAY'S FINEST** / BEST BOARD OF THE WEEK.
- instagram (`/go/p-4d0d814c-instagram`): FRIDAY'S FINEST. ¶ The best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments. ¶ Play today's puzzles free: link in bio.
- facebook (`/go/p-4d0d814c-facebook`): FRIDAY'S FINEST. ¶ The best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.
- threads (`/go/p-4d0d814c-threads`): FRIDAY'S FINEST. The best board of the week. Think yours beats it? Make your case.
- Image brief (portrait, winter): cast Rip, Umi, Webster; three mascots cheering with a small gold trophy, twinkling lights, snow
- Spoiler / hint note: hint: none


### Sat 2026-12-19  |  CAST SATURDAY

**08:00 CT | X | cast | series `cast`**: Cast Saturday: Ivy is shy but steady  
`4c70139b-e0b5-5f3c-8c05-9d72c026a4f6`

- Hook / image text: **IVY IS SHY BUT STEADY** / CAST SATURDAY
- x (`/go/p-c026a4f6-x`): Meet Ivy, rung two on the bot ladder. ¶ Shy, steady and wrapped in a very long scarf. Do not underestimate her.
- threads (`/go/p-c026a4f6-threads`): Meet Ivy, rung two on the bot ladder. ¶ Shy but steady, and wrapped in a very long scarf and earmuffs. Do not underestimate her. Beat Ivy, then climb.
- Image brief (landscape, winter): cast Ivy; I alone in the striped scarf, earmuffs and white mittens, soft snow, warm string lights
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `cast` (PAUSED)**: [Needs capture] Cast Saturday video: the gift swap  
`3c0baac7-cbaa-5f39-9527-87d863e274b6`

- tiktok (`/go/p-63e274b6-tiktok`): Gift swap, cast edition. ¶ Someone gets a streak shield. Someone gets a rematch. Nobody gets the last word. ¶ Play free: link in bio.
- instagram (`/go/p-63e274b6-instagram`): Gift swap, cast edition. ¶ Someone gets a streak shield. Someone gets a rematch. Nobody gets the last word. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none


### Sun 2026-12-20  |  SWEEP SUNDAY

**08:00 CT | X | ritual | series `sweep`**: Sweep Sunday  
`070d0e61-dfea-5cb8-9f35-51856726b11c`

- Hook / image text: **SWEEP SUNDAY** / ALL 18 DAILIES. ONE DAY.
- x (`/go/p-6726b11c-x`): SWEEP SUNDAY. ¶ Can you sweep all 18? One day, every daily, one board to prove it. Post yours.
- threads (`/go/p-6726b11c-threads`): SWEEP SUNDAY. ¶ Can you sweep all 18? One day, every daily, one board to prove it. Post your sweep board and see who in the family cracks first.
- Image brief (landscape, winter): cast Umi, Dewey, Opal; three mascots with colored game tiles tumbling like snowflakes, midnight-indigo glow
- Spoiler / hint note: hint: none

**11:30 CT | FB | ritual | series `sweep`**: Sweep Sunday (Facebook)  
`1eb22411-c5c4-5537-a4e7-fadc61626b7f`

- Hook / image text: **SWEEP SUNDAY** / ALL 18 DAILIES. ONE DAY.
- facebook (`/go/p-61626b7f-facebook`): SWEEP SUNDAY. ¶ Can you sweep all 18 dailies today? It is the last Sunday before Christmas, so the family is probably already under one roof. Share your sweep board in the comments.
- Image brief (portrait, winter): cast Scoot, Cosmo, Ivy; three mascots on a cozy rug with a stack of glossy tiles and a mug of cocoa
- Spoiler / hint note: hint: none


## Week 4: Mon Dec 21 - Sun Dec 27 (solstice, Christmas, Kwanzaa, New Year teaser)


### Mon 2026-12-21  |  MONDAY MASTERS (solstice nod)

**08:00 CT | X | ritual | series `monday`**: Monday Masters: the longest night  
`358513d0-f7c7-5922-9395-183c2587ad8e`

- Hook / image text: **MONDAY MASTERS** / THE CROWN IS OPEN.
- x (`/go/p-2587ad8e-x`): MONDAY MASTERS. ¶ The longest night of the year is a fine night for a long streak. New week, zero points, crown open. Come take it.
- threads (`/go/p-2587ad8e-threads`): MONDAY MASTERS. ¶ The longest night of the year is a fine night for a long streak. The weekly race just reset and everyone starts level. Last week's champion is on the Leaderboard tab. Come take the crown.
- Image brief (landscape, winter): cast Webster, Ollie, Rip; deep midnight-blue sky full of stars and a low glowing horizon, snow, three mascots in a relaxed row
- Spoiler / hint note: hint: none
- Note: Winter solstice nod only. Not a holiday greeting: the greeting rule covers real holidays, and the solstice is an astronomical observance with no themed puzzle day.


### Tue 2026-12-22  |  Gift a shield (job: share/invite) / Gift a shield

**08:00 CT | X | post | series `gift`**: Last-minute gift: a streak shield  
`3f7103d5-a2f8-5ba7-bb6d-a25c60769c74`

- Hook / image text: **GIFT A SHIELD** / THEN BEAT THEM ANYWAY.
- x (`/go/p-60769c74-x`): Still need a gift for the cousin who always forgets? ¶ Gift a streak shield, then beat them anyway. Invites are one link.
- threads (`/go/p-60769c74-threads`): Still need a gift for the cousin who always forgets their streak? ¶ Gift a streak shield, then beat them anyway. Add your family as friends and race the same daily puzzles. Invites are one link.
- Image brief (landscape, winter): cast Dewey, Cosmo, Scoot; a gift box with a glowing shield emblem on the ribbon, three mascots around it, ribbons and snow
- Spoiler / hint note: hint: none

**11:30 CT | FEED | post | series `gift`**: Gift a streak shield  
`a2dd80b1-9b17-540c-876e-49fdc3f09097`

- Hook / image text: **GIFT A SHIELD** / THEN BEAT THEM ANYWAY.
- instagram (`/go/p-c3f09097-instagram`): Still shopping for the cousin who always forgets? ¶ Gift a streak shield, then beat them anyway. Add your family as friends, race the same daily puzzles and let the scoreboard settle it. Invites are one link. ¶ Play free: link in bio.
- facebook (`/go/p-c3f09097-facebook`): Still shopping for the cousin who always forgets their streak? Gift a streak shield, then beat them anyway. Add your family as friends, race the same daily puzzles and let the scoreboard settle it.
- threads (`/go/p-c3f09097-threads`): Gift a streak shield to the cousin who always forgets, then beat them anyway. Invites are one link.
- Image brief (portrait, winter): cast Ozzy, Webster; two mascots holding a big wrapped gift together, glowing shield emblem on the ribbon
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `gift` (PAUSED)**: [Needs capture] How to gift a streak shield  
`eecb93b6-33ae-52b0-8d66-f17dcb37bb98`

- tiktok (`/go/p-cb37bb98-tiktok`): How to gift a streak shield in 10 seconds. ¶ Add a friend, open their card, send it. Done. ¶ Play free: link in bio.
- instagram (`/go/p-cb37bb98-instagram`): How to gift a streak shield in 10 seconds. ¶ Add a friend, open their card, send it. Done. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none
- Note: Verify the actual gifting flow in the live app before capture; fix the steps in the caption if they differ.


### Wed 2026-12-23  |  MUDDLE WEDNESDAY

**08:00 CT | X | muddle | series `muddle`**: Muddle Wednesday  
`7e53b99f-6b0f-5181-8b03-d0ba65a21626`

- Hook / image text: **MUDDLE WEDNESDAY** / FOUR WORDS. ONE PUNCHLINE.
- x (`/go/p-65a21626-x`): MUDDLE WEDNESDAY. ¶ Yesterday's Muddle: four words, one punchline, one cartoon. Caption it between the wrapping and the baking.
- threads (`/go/p-65a21626-threads`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon is up. Four scrambled words, one punchline. Caption it in the replies, then go solve today's Muddle.
- Image brief (landscape, winter): cast Rip, Opal; two mascots far left and far right, low, with a calm empty center, ribbon and snow; layout: only TWO mascots, far left and far right, low; the center 30 percent of the width empty for a cartoon added in code; content added in code: `cartoon|<yesterday Muddle cartoon file>|520`
- Spoiler / hint note: hint: none (yesterday's cartoon)

**11:30 CT | FEED | muddle | series `muddle`**: Muddle Wednesday: caption this  
`1bd5f1a8-99c5-5684-be8d-92269001dd14`

- Hook / image text: **MUDDLE WEDNESDAY** / CAPTION THIS.
- instagram (`/go/p-9001dd14-instagram`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll. ¶ Today's Muddle is live. Play free: link in bio.
- facebook (`/go/p-9001dd14-facebook`): MUDDLE WEDNESDAY. ¶ Yesterday's cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll. Today's Muddle is live.
- threads (`/go/p-9001dd14-threads`): MUDDLE WEDNESDAY. Yesterday's cartoon is up. Caption it before you scroll.
- Image brief (portrait, winter): cast Ivy, Ollie; two mascots low under a calm empty rectangle for the cartoon, string lights on a frosted wall; layout: calm empty rectangle ~70% x 28% between the sub line and the mascots' heads; mascots low; content added in code: `cartoon|<yesterday Muddle cartoon file>|700`
- Spoiler / hint note: hint: none (yesterday's cartoon)


### Thu 2026-12-24  |  WOTD + Hubbub pangram tease (Christmas Eve) / pins day / Christmas Eve gag

**08:00 CT | X | wotd | series `wotd`**: WOTD quiz HASTE + Hubbub pangram tease  
`9746fc56-cdb3-5cd3-b3e2-7f64122f6b15`

- Hook / image text: **WORD OF THE DAY QUIZ**
- x (`/go/p-122f6b15-x`): Word of the Day: HASTE (noun) ¶ (a) A small cottage by the sea / (b) A feeling of regret / (c) Speed or hurry in doing something ¶ No lookups. Answer tonight. Hubbub today: seven letters, one pangram.
- threads (`/go/p-122f6b15-threads`): Word of the Day: HASTE (noun) ¶ (a) A small cottage by the sea / (b) A feeling of regret / (c) Speed or hurry in doing something ¶ No lookups. Answer in the replies tonight. ¶ And today's Hubbub has seven letters and a pangram that uses them all. Find it.
- Image brief (landscape, winter): cast Webster, Rip; two mascots low at the sides, stockings and string lights, soft snow, calm empty band for the word card; layout: completely empty calm band (about 20 percent of the height) under the headline for the word card added in code; content added in code: `wotd|HASTE|WORD OF THE DAY|1.2`
- Spoiler / hint note: hint: Word of the Day on the card only
- Note: Christmas Eve themed puzzles are live in the app (data/holiday-days.json); an optional extra sentence is fine, but the quiz stays the lead.

**13:00 CT | PIN-1 | pin | series `pin-explainer`**: Pin: How to play Crosswordocious  
`55a1aa80-a904-5240-8452-22927b8afe0a`

- Hook / image text: **HOW TO PLAY CROSSWORDOCIOUS** / A NEW PUZZLE EVERY DAY.
- pinterest (`/go/p-7b8afe0a-pinterest`): How to play Crosswordocious, the daily sayings crossword on Wordocious: every clue is a familiar saying with one word missing, most answers fit the day's title, and letters are free to change. A free daily puzzle for word lovers.
- Image brief (pin, winter): cast Dewey, Ozzy; cozy winter library with frosted crossword-shaped windows (decor only, no letters in the cells)
- Spoiler / hint note: hint: none

**15:00 CT | PIN-2 | pin | series `pin-word`**: Pin: Word card, SKIES  
`dd28d28c-28b5-5c9f-a653-ed2317233c7a`

- Hook / image text: **SKIES** / WORD OF THE DAY
- pinterest (`/go/p-17233c7a-pinterest`): Word of the Day: SKIES (noun). Plural of sky: the heavens, the firmament, the atmosphere. A new word every morning on Wordocious, with the archive of every past word.
- Image brief (pin, winter): cast Ollie, Cosmo; night sky, stars and gentle snowfall
- Spoiler / hint note: hint: none (SKIES was the Oct 23 Word of the Day)

**17:00 CT | PIN-3 | pin | series `pin-cast`**: Pin: Cast art, happy holidays  
`89e916fe-dc91-5755-b611-0431e6eedf9a`

- Hook / image text: **HAPPY HOLIDAYS** / FROM THE WHOLE CAST.
- pinterest (`/go/p-e6eedf9a-pinterest`): Happy holidays from the Wordocious cast. Christmas, Hanukkah and Kwanzaa costumes, ten letter characters, and one free daily puzzle app that hosts them all. Bring your family.
- Image brief (pin, winter): cast Webster, Dewey, Umi, Ollie, Rip; five cast members together under string lights, a mix of costumes, snow
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `cast` (PAUSED)**: [Needs capture] Christmas Eve cast gag: one more round  
`17e88208-d19a-5729-8ded-c57b56464032`

- tiktok (`/go/p-56464032-tiktok`): Christmas Eve, 11 PM. Nobody is asleep. ¶ One more round. ¶ Play free: link in bio.
- instagram (`/go/p-56464032-instagram`): Christmas Eve, 11 PM. Nobody is asleep. ¶ One more round. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none


### Fri 2026-12-25  |  CHRISTMAS (Dec 25) / FRIDAY'S FINEST (Christmas) / FRIDAY'S FINEST / Christmas clip

**07:00 CT | HOLIDAY | season | series `holiday-christmas` (PAUSED)**: Merry Christmas (morning greeting)  
`62c7af3e-5ea9-5023-b5c3-76ee02424c9e`

- Hook / image text: **MERRY CHRISTMAS** / FROM THE WHOLE CAST.
- x (`/go/p-02424c9e-x`): Merry Christmas from the whole cast. ¶ Wishing you a warm table, a full house and one more round after dessert.
- threads (`/go/p-02424c9e-threads`): Merry Christmas from the whole cast. ¶ Wishing you a warm table, a full house, great company and one more round after dessert. Today's themed puzzles are live whenever you are ready.
- instagram (`/go/p-02424c9e-instagram`): Merry Christmas from the whole cast. ¶ Wishing you a warm table, a full house and one more round after dessert. Today's themed puzzles are live. ¶ Play free: link in bio.
- facebook (`/go/p-02424c9e-facebook`): Merry Christmas from the whole Wordocious cast. Wishing you and your family a warm table and one more round after dessert. Today's themed puzzles are live in the daily games.
- Image brief (portrait + landscape, winter): cast Webster, Ollie, Ozzy, Rip, Ivy; a warm living-room scene: a decorated tree with glowing ornaments, wrapped gifts, stockings, string lights, snow in the window, the cast together
- Spoiler / hint note: hint: none
- Note: 7 AM CT. Themed puzzles are live Dec 24-26 per data/holiday-days.json. Cast: Santa W, reindeer Ollie, ugly sweater Ozzy, R cocoa, Ivy scarf; no one else.

**08:00 CT | X | ritual | series `friday`**: Friday's Finest: Christmas edition  
`9705eec7-aa0d-55cf-9f31-b60d2cbe5e2c`

- Hook / image text: **FRIDAY'S FINEST** / BEST BOARD OF THE WEEK.
- x (`/go/p-2cbe5e2c-x`): FRIDAY'S FINEST. ¶ The best board of the week, now with wrapping paper. Open the presents, then open your daily. Post yours.
- threads (`/go/p-2cbe5e2c-threads`): FRIDAY'S FINEST. ¶ The best board of the week, now with wrapping paper everywhere. Open the presents, then open your daily, and share your board in the replies.
- Image brief (landscape, winter): cast Cosmo, Scoot; two mascots with a gold ribbon rosette, a few wrapped gifts and a glowing window
- Spoiler / hint note: hint: none

**11:30 CT | FEED | ritual | series `friday`**: Friday's Finest  
`34877938-a806-5c12-8553-f53979feb92c`

- Hook / image text: **FRIDAY'S FINEST** / BEST BOARD OF THE WEEK.
- instagram (`/go/p-79feb92c-instagram`): FRIDAY'S FINEST. ¶ The best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments. ¶ Play today's puzzles free: link in bio.
- facebook (`/go/p-79feb92c-facebook`): FRIDAY'S FINEST. ¶ The best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.
- threads (`/go/p-79feb92c-threads`): FRIDAY'S FINEST. The best board of the week. Think yours beats it? Make your case.
- Image brief (portrait, winter): cast Umi, Dewey; two mascots with a small gold trophy among gift boxes, warm light
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `cast` (PAUSED)**: [Needs capture] Christmas cast clip  
`db7bdf9a-453c-5137-84ca-99beb778cd5d`

- tiktok (`/go/p-b778cd5d-tiktok`): Merry Christmas from the cast. ¶ Gifts are open. The board is not. ¶ Play free: link in bio.
- instagram (`/go/p-b778cd5d-instagram`): Merry Christmas from the cast. ¶ Gifts are open. The board is not. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none


### Sat 2026-12-26  |  KWANZAA begins (Dec 26) / CAST SATURDAY

**07:00 CT | HOLIDAY | season | series `holiday-kwanzaa` (PAUSED)**: Happy Kwanzaa (morning greeting)  
`683701ff-2302-5d99-b78a-3e4bae1c0373`

- Hook / image text: **HAPPY KWANZAA** / UMOJA. UNITY.
- x (`/go/p-ae1c0373-x`): Happy Kwanzaa from all of us at Wordocious. ¶ Today is Umoja: unity. Wishing you family, community and a little friendly competition.
- threads (`/go/p-ae1c0373-threads`): Happy Kwanzaa from all of us at Wordocious. ¶ The first day is Umoja, unity. Wishing you family, community and a little friendly competition around the table.
- instagram (`/go/p-ae1c0373-instagram`): Happy Kwanzaa from all of us at Wordocious. ¶ The first day is Umoja, unity. Wishing you family, community and a little friendly competition around the table. ¶ Play free: link in bio.
- facebook (`/go/p-ae1c0373-facebook`): Happy Kwanzaa from all of us at Wordocious. The first day is Umoja, unity. Wishing you and your family a week of community, reflection and a little friendly competition.
- Image brief (portrait + landscape, winter): cast Umi, Scoot; a warm table scene in red, black and green: a kinara with SEVEN candle positions (three red left, one black center, three green right) with only the black center candle lit for day one, a woven mkeka mat, ears of corn (muhindi), the unity cup (kikombe), kente-inspired trim, soft snow
- Spoiler / hint note: hint: none
- Note: 7 AM CT, Dec 26 = the first day (Umoja). The app's Kwanzaa themed-puzzle day is Dec 27, so do NOT say "today's themed puzzles" (see lead notes). Respect: objects, light, color only; no religious garments; cast wearing the kente wrap (U) and sash (S).

**08:00 CT | X | cast | series `cast`**: Cast Saturday: Rip takes it easy  
`7e36551d-9b4a-54dc-b89b-55c6d2d133e4`

- Hook / image text: **RIP TAKES IT EASY** / CAST SATURDAY
- x (`/go/p-d2d133e4-x`): Meet Rip, rung one on the bot ladder. ¶ Easygoing, cozy and wrapped in a quilt. The perfect place to start. Beat Rip, then climb.
- threads (`/go/p-d2d133e4-threads`): Meet Rip, rung one on the bot ladder. ¶ Easygoing, cozy and wrapped in a quilt with a mug of cocoa. The perfect place to start. Beat Rip, then climb all ten rungs.
- Image brief (landscape, winter): cast Rip; R alone in the patchwork quilt wrap, striped nightcap with holly and a cocoa mug, soft snow, warm window glow
- Spoiler / hint note: hint: none

**18:00 CT | VIDEO | video | series `cast` (PAUSED)**: [Needs capture] Cast Saturday video: Rip  
`84a18ac5-cdd1-5cb0-9adf-52f364a9ed87`

- tiktok (`/go/p-64a9ed87-tiktok`): Meet Rip, rung one on the bot ladder. ¶ Easygoing and cozy. Beat Rip, then climb. ¶ Play free: link in bio.
- instagram (`/go/p-64a9ed87-instagram`): Meet Rip, rung one on the bot ladder. ¶ Easygoing and cozy. Beat Rip, then climb. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none


### Sun 2026-12-27  |  SWEEP SUNDAY / New Year teaser + Wrapped tease / New Year teaser

**08:00 CT | X | ritual | series `sweep`**: Sweep Sunday + Kwanzaa themed puzzles  
`1124337c-a489-578a-9f7c-8694c70ba7c0`

- Hook / image text: **SWEEP SUNDAY** / ALL 18 DAILIES. ONE DAY.
- x (`/go/p-c70ba7c0-x`): SWEEP SUNDAY. ¶ Can you sweep all 18? One day, every daily, one board to prove it. Kwanzaa themed puzzles are live too. Post yours.
- threads (`/go/p-c70ba7c0-threads`): SWEEP SUNDAY. ¶ Can you sweep all 18? One day, every daily, one board to prove it. Kwanzaa themed puzzles are live today. Post your sweep board and see who in the family cracks first.
- Image brief (landscape, winter): cast Scoot, Umi, Ivy; three mascots with colored game tiles drifting like snow, red-black-green accents in the trim, midnight-indigo glow
- Spoiler / hint note: hint: none
- Note: Kwanzaa themed puzzles per data/holiday-days.json: Dec 27. Verify in the live app.

**11:30 CT | FEED | season | series `wrapped` (PAUSED)**: Your year in Wordocious: coming soon (founder call)  
`49a7ac62-825b-5d94-b3a7-667fd1152cea`

- Hook / image text: **YOUR YEAR IN WORDS** / COMING SOON.
- instagram (`/go/p-d1152cea-instagram`): Your year in Wordocious is almost here. ¶ The streaks you saved, the games you could not stop playing, the boards you bragged about. We are counting them up. ¶ Check back before New Year's Eve. Play free: link in bio.
- facebook (`/go/p-d1152cea-facebook`): Your year in Wordocious is almost here: the streaks you saved, the games you could not stop playing, the boards you bragged about. Check back before New Year's Eve.
- threads (`/go/p-d1152cea-threads`): Your year in Wordocious is almost here. Streaks, favorite games, best days. Check back before New Year's Eve.
- Image brief (portrait, newyear): cast Webster, Opal, Cosmo, Umi; a midnight-blue sky with gold confetti and a softly glowing countdown clock face that shows no readable time, the four together, snow melting into sparkle
- Spoiler / hint note: hint: none (teaser only, no stats)
- Note: FOUNDER CALL: only approve if a year-in-review feature really ships (or this stays a pure teaser with no feature claim). No real user data anywhere. New Year season art (Dec 27-Jan 2) is not built yet, so the scene uses the winter cast with gold confetti. Paused until decided.

**18:00 CT | VIDEO | video | series `wrapped` (PAUSED)**: [Needs capture] New Year teaser  
`a72bc4a3-5df3-5d15-a8e7-b32b3f1fe537`

- tiktok (`/go/p-3f1fe537-tiktok`): Four more days. ¶ The cast is counting down. Your year in Wordocious is coming. ¶ Play free: link in bio.
- instagram (`/go/p-3f1fe537-instagram`): Four more days. ¶ The cast is counting down. Your year in Wordocious is coming. ¶ Play free: link in bio.
- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.
- Spoiler / hint note: hint: none
- Note: Same founder call as the Wrapped feed post. Paused.
