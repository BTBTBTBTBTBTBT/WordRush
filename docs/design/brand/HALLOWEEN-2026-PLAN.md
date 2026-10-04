# Halloween 2026 — design queue (founder 10-03 night)

Founder: "work with the free ChatGPT on more of the main character Halloween build… custom main character
mascots and more orange and black themed wallpapers, even custom Halloween title headers for the games that
we can show for the last 2 weeks at least before Halloween. The mascots should be in costumes like the one you
built for me to sample (admin toggle) — that one looked great, other than the characters not being accurate up
close… come up with a ton of Halloween stuff… feel free to try and see if I like it."

Starts AFTER 2.7 (242/198) is submitted. ChatGPT in the browser (free plan; resets ~1:56 AM daily) — the paid
API only if the founder says so. Nothing ships until the founder picks from the gallery.

## Season window
- Today: `currentSeason` = Oct 24 – Nov 1 (FINISH_SPEC §X). Founder wants **at least the last 2 weeks** →
  change to **Oct 17 – Nov 1** (core fixture + all 3 platforms). Needs a release live before Oct 17.

## Rules for every piece
- Cast accuracy is the hard rule: attach `cast/hero/<id>.png` + `refs/<id>.png` (+ poses) to every prompt; the
  costume goes ON the character without changing face, mouth/teeth, eyes, friendly brows, letter, body color/shape.
  Side-by-side check; reject drift. (The 10-02 set read well but drifted up close — redo all 10.)
- ChatGPT = characters, lettering, small props only. Full-screen art (wallpapers) is drawn in code at full
  resolution from ChatGPT motifs (pane captures top out ~800 px — never upscale).
- Backgrounds never distract (few, small, faint motifs; nothing behind boards/text).
- American spelling, no emoji, no bordered boxes, cast colors kept recognizable under the costumes.

## Queue (in order)
1. **Costumed cast, accurate** — redo all 10 (W vampire, O1 pumpkin cheerleader, R ghost, D wizard, O2 witch,
   C alien astronaut, I scarecrow, O3 mummy, U fairy-ghost + lantern, S skeleton onesie), plus 2–3 alternate
   costumes each to choose from.
2. **Halloween game title headers** — all 18 game titles in a spooky-soft variant (orange/black/purple, drips,
   tiny bats/cobwebs as part of the lettering), + DAILIES / PUZZLES / HAPPY HALLOWEEN.
3. **Orange & black wallpapers** — code-drawn full-res set per page (Home, games, Stats, Friends, Leaderboard)
   using ChatGPT-made small motifs (pumpkins, bats, candy corn, moons, stars) placed faint in the margins.
4. **Extras to try (founder: "see if I like it")**
   - Home hero: "HAPPY HALLOWEEN, <NAME>!" + a costumed host; night-sky banner.
   - Orange/black cast button skins + Halloween label set (TRICK OR TREAT, SPOOKY, BOO!).
   - Jack-o'-lantern streak flame + candy streak shield.
   - Halloween tile theme (pumpkin-orange / midnight-purple tiles) as a seasonal board theme.
   - Halloween achievement badges (e.g. "Trick or Treat: play all dailies on Oct 31").
   - Costumed podium + spooky Leaderboard title, haunted share card, Halloween widgets.
   - Loading screen / cold-start intro with the costumed cast parade.
5. **Gallery artifact** for the founder to pick from (one page, grouped, light/dark).
