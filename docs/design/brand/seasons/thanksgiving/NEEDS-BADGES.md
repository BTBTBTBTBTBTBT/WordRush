# Thanksgiving — songs + achievements: what still needs art and notation (10-16)

Founder 10-16: "Don't forget about seasonal song easter eggs and achievements, as well. We need a new batch in the
same style added and songs should be a natural part of the seasonality roadmap." This is the Thanksgiving batch, in
Halloween's style (item 49): the code is wired ×3 (core `musical-cast.ts` THANKSGIVING_MELODIES / THANKSGIVING_TUNES_TODO,
`achievement-rules.ts` harvest_feast + tune_simple_gifts, Swift MusicalCast/AchievementRules, Kotlin MusicalCast,
parity fixtures). Everything below is ART or CHECKED NOTATION; missing art falls back like every other season slot
(badges → the category icon, voices → the normal cast voices).

## 1. Badge art (art-ach-<key>, 256², same style as the other badges in docs/design/brand/badges/)

Each badge is `art-ach-<key>`; until it ships the grid shows the category icon (`calendar` / `sparkles`). Ship with the
main `ship-art.py` run and add the size row to `apps/web/lib/art.ts` ART_SIZE + the line to
`docs/design/brand/badges/achievements-new.txt` (the night-art wiring test then checks it ships).

| key | name | description (in the catalog) | shows |
|---|---|---|---|
| harvest_feast | Harvest Feast | Finish a daily during the Thanksgiving season | always (seasonal category) |
| tune_simple_gifts | Simple Gifts | Played Simple Gifts on the cast | secret: only once unlocked |
| tune_we_gather | We Gather Together | Played We Gather Together on the cast | secret: only once unlocked |
| tune_thankful_people | Thankful People | Played Come, Ye Thankful People, Come on the cast | secret: only once unlocked |
| tune_now_thank | Now Thank We | Played Now Thank We All Our God on the cast | secret: only once unlocked |

Wired 10-16 (rows above): tune_we_gather, tune_thankful_people, tune_now_thank. Pending tunes (one secret badge each,
add the row when the tune is wired): tune_over_the_river "Over the River", tune_sheaves "Bringing in the Sheaves",
tune_beauty_of_earth "Beauty of the Earth".

### Ready ChatGPT prompts (free ChatGPT in the browser, per the image-gen rule; attach a shipped badge, e.g.
art-ach-spooky_season, as the style reference; never click Share)

- **harvest_feast:** "A round achievement badge in the exact style of the attached badge (same rim, same glossy
  enamel, same 256×256 framing, transparent background). Center: a warm harvest feast — a golden roast-turkey-shaped
  pie-and-cornucopia silhouette with a slice of pumpkin pie and two ears of corn, cranberry red + wheat gold + burnt
  orange + sage enamel, soft highlights, no text, no letters, no faces, no bordered box."
- **tune_simple_gifts:** "A round achievement badge in the exact style of the attached badge (same rim, glossy enamel,
  256×256, transparent background). Center: a single gold music note resting on a simple folded gift box tied with a
  wheat-colored ribbon, with three small autumn leaves, cranberry red + wheat gold enamel, soft highlights, no text, no
  letters."
- **tune_we_gather:** "A round achievement badge in the exact style of the attached badge (same rim, glossy enamel,
  256x256, transparent background). Center: two clasped hands holding up a round loaf of bread, a small gold music note
  floating above, three tiny autumn leaves, cranberry red + wheat gold + sage enamel, soft highlights, no text, no
  letters, no faces."
- **tune_thankful_people:** "A round achievement badge in the exact style of the attached badge (same rim, glossy
  enamel, 256x256, transparent background). Center: a tied sheaf of wheat with a plum-purple ribbon bow, a small gold
  music note beside it, wheat gold + plum + burnt orange enamel, soft highlights, no text, no letters, no faces."
- **tune_now_thank:** "A round achievement badge in the exact style of the attached badge (same rim, glossy enamel,
  256x256, transparent background). Center: a little brass bell with a gold music note ringing out of it and a sprig of
  cranberries and two leaves at its base, brass gold + cranberry red + sage enamel, soft highlights, no text, no
  letters, no faces."
- **The pending tune badges (make when wired):** same prompt skeleton, swapping the center: a sleigh crossing a
  wooden bridge over a river (Over the River); clasped hands over a loaf of bread (We Gather Together); a sheaf of
  wheat tied with ribbon (Thankful People / Sheaves — give each a different ribbon color); a sun over rolling fields
  (Beauty of the Earth); a bell with a music note (Now Thank We All). Always a music note somewhere on a tune badge.

## 2. Checked notation for the pending tunes (THANKSGIVING_TUNES_TODO)

Status 10-16 (second pass): We Gather Together, Come Ye Thankful People and Now Thank We All Our God are WIRED (scores
checked: Open Hymnal ABC, hymnary.org incipits, Wikipedia LilyPond, Mutopia BWV 657; URLs in the musical-cast.ts comment).
Left in the TODO: Over the River (no public-domain score found, only modern arrangements), Bringing in the Sheaves (only
hymnary's octave-less incipit found; no second score), For the Beauty of the Earth (score checked, but in C it needs A3
or F5, outside the cast's C4-E5 keys). The table below is the original plan.

Rule (from Halloween): never wire a tune from memory. Each needs its letter notation checked against a score (Mutopia,
IMSLP, hymnary.org's PDF scans, or a lettered beginner edition), realized on the cast's white keys C4–E5 by interval
shape, and then: core notes/song/beats → Swift + Kotlin twins → fixtures → one secret achievement (`secret(...)` in
achievement-rules.ts) → badge row above. Public-domain status, verified 10-16:

| tune | why it is PD | key to realize on the cast |
|---|---|---|
| Over the River and Through the Wood | words Lydia Maria Child 1844; tune traditional (19th c.) | C (one octave; riffspot/musicandtheory beginner editions are in C) |
| We Gather Together | Dutch tune 1626 ("Kremser", arr. Eduard Kremser 1877); words Theodore Baker 1894 | C (hymnals print D; shift down a step) |
| Come, Ye Thankful People, Come | words Henry Alford 1844; tune St. George's Windsor, George Elvey 1858 | G or F per the hymnal — pick whichever lands on white keys |
| Now Thank We All Our God | tune Nun danket alle Gott, Johann Crüger 1647; words Rinkart 1636 / Winkworth 1858 | F (hymnals) → shift to C |
| Bringing in the Sheaves | words Knowles Shaw 1874; tune George Minor 1880 | C (hymnary lists C) |
| For the Beauty of the Earth | tune Dix, Conrad Kocher 1838; words Pierpoint 1864 | G → shift to C |

Left out on purpose: **Turkey in the Straw** (PD, 19th-century folk) — its minstrel-show history and lyric variants make
it a poor fit; the founder said prefer the others if there's any doubt. Also NOT allowed (copyrighted): "The
Thanksgiving Song" (Adam Sandler), "Alice's Restaurant", any Charlie Brown Thanksgiving cue, "Thankful" (Kelly Clarkson),
any Peanuts music.

## 3. Optional: a harvest voicing (registry `slots.sounds`)

Halloween layers an instrument under each cast voice (`note-h-<id>`, item 49). Thanksgiving ships with the NORMAL
voices (no `SEASON_NOTE_PREFIX` entry, no registry `sounds` slot) so nothing is missing at runtime. If the founder wants a
harvest voicing (banjo / fiddle / warm wooden marimba under each voice, same voice per character) cut the ten samples
with `docs/design/brand/sounds/make-notes.py` as `sfx-note-t-<id>.m4a`, add `"sounds": { "note": "note-t-{id}" }` to the
registry entry, `thanksgiving: 'note-t-'` to SEASON_NOTE_PREFIX ×3, and the iOS test
(MusicalCastTests.testRegistrySoundSlotsMatchTheCoreAndShip) checks every sample ships. Same for an intro jingle
(`intro-thanksgiving`): founder listens in the Sound Library before it ships.
