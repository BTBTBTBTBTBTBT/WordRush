# JP social plan, block 2: Mon Nov 30 - Sun Dec 27, 2026

Founder 10-16: continue the social calendar with newly designed custom posts, building on the days already started and on the strategy in `apps/web/lib/admin/social-plan.ts`. Block 1 (Oct 13 - Nov 29) is in `apps/web/lib/admin/jp45-posts.json` / `docs/sql/20261014-jp45-posts.sql`. This block is a PLAN: nothing here is generated, applied or posted.

**Generated from** `docs/marketing/jp45/b2_data.py` by `build-block2.py` (re-run it after any edit; it also validates the brand rules and caption budgets). Outputs: `apps/web/lib/admin/jp45-block2-posts.json`, `docs/sql/20261016-jp45-block2-posts.sql` (NOT applied), `docs/design/brand/social/jp45/incoming/full/queue-block2.json`, `docs/design/brand/social/jp45/manifest-block2.json` (stubs).

**Totals:** {{N}} posts ({{COUNTS}}), {{TARGETS}} platform targets with tracked links, {{IMG}} images for the ChatGPT runner. Videos are `[Needs capture]` drafts (paused), like block 1; their covers are cut by `make-video.py`, so they add no scene images.

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
