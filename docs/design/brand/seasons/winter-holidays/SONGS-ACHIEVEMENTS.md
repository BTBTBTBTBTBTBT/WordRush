# Winter holidays (Dec 1 – 26) — song easter eggs + achievements: the plan (10-16, no code yet)

Founder 10-16: songs are "a natural part of the seasonality roadmap". This is the plan for the winter-holidays batch,
built the Halloween/Thanksgiving way (core `musical-cast.ts` SEASON_MELODIES + `achievement-rules.ts`, Swift + Kotlin
twins, parity fixtures, badges). Inclusive like the season itself (README "Winter holidays are inclusive"): Christmas +
a real share of Hanukkah + Kwanzaa sprinkled in. Timeline: D − 5 weeks = Oct 27 (PLAYBOOK §1 "Songs + achievements").

## 1. Candidate tunes — public-domain status (checked 10-16; re-check the arrangement you take the notes from)

A tune is only usable when BOTH the melody and the words (if any are shown anywhere) are public domain, and the notes
we store are our own realization on the cast's white keys (no recording, no copyrighted arrangement).

| tune | status | notes for the cast |
|---|---|---|
| Jingle Bells (James Lord Pierpont, 1857) | PD | chorus "Jingle bells, jingle bells, jingle all the way": E E E, E E E, E G C D E — all white keys; the obvious first one |
| Deck the Halls (Welsh "Nos Galan", 16th c.; English words Thomas Oliphant 1862) | PD | "Deck the halls with boughs of holly": G F E D C D E C … fa-la-las fit the cast's range in C |
| We Wish You a Merry Christmas (English traditional, West Country, 16th c.) | PD | C F F G F E D D … (one F# in some harmonizations; melody is white keys in C) |
| Joy to the World (Handel/Mason 1839; Watts 1719) | PD | C B A G F E D C — a descending scale, very playable |
| Good King Wenceslas (tune "Tempus adest floridum" 1582; words Neale 1853) | PD | all white keys in C |
| O Christmas Tree / O Tannenbaum (German folk, 1824 words) | PD | starts C F F F G A A A — fits |
| Silent Night (Gruber 1818) | PD | in C: G A G E … needs no sharps; gentle 6/8 |
| Up on the Housetop (Benjamin Hanby, 1864) | PD | playful; fits C |
| Hanukkah, O Hanukkah (Yiddish folk "Oy Chanukah", 19th c.; English words traditional) | PD melody; use the folk words only | minor key: realize in A minor on the white keys (same trick as the Halloween set) |
| Ma'oz Tzur / Rock of Ages (13th-c. text; the common tune is a 15th-c. German melody) | PD | major; fits C |
| Sevivon, Sov Sov Sov (Hebrew folk, words Levin Kipnis ~1920s) | melody traditional/PD; words: Kipnis died 1990 — do NOT show the words; tune only, name it "Sevivon" | minor; A minor on the cast |
| I Have a Little Dreidel | **NOT safe** — words Samuel S. Grossman + music Samuel E. Goldfarb, published 1927 (US PD as a 1927 publication only if the copyright was not renewed; the Hebrew version is also 1920s). Treat as copyrighted until a counsel-level check says otherwise; keep it OUT | — |
| Kwanzaa | there is no public-domain Kwanzaa song (the holiday dates from 1966; every Kwanzaa song is modern and copyrighted). Represent Kwanzaa with an achievement, not a tune (below) | — |
| Auld Lang Syne (Scottish folk; Burns 1788) | PD | for the New Year window (Dec 27 – Jan 2), not this one |

NOT allowed (copyrighted; the test should name them like the Halloween list): Rudolph the Red-Nosed Reindeer (1949),
Frosty the Snowman (1950), Santa Claus Is Comin' to Town (1934), Let It Snow (1945), White Christmas (1942), Jingle
Bell Rock (1957), Rockin' Around the Christmas Tree (1958), All I Want for Christmas Is You, Last Christmas, The
Chanukah Song (Adam Sandler), Light One Candle (Peter Yarrow), any Mariah / Wham / Peanuts cue.

Pick 7 (Halloween's scale): Jingle Bells, Deck the Halls, We Wish You a Merry Christmas, Joy to the World, Good King
Wenceslas, Hanukkah O Hanukkah, Ma'oz Tzur — two Hanukkah tunes out of seven is "a real share"; Sevivon as the eighth
if the range fits. Each one: letter notation checked against a score (Mutopia has most of these), realized on
C4–E5, no tune's shape a prefix of another's (the test pins it), `song`/`beats` for the sung-back jingle.

## 2. Discovery hints (same as Halloween)

Same mechanics: long-press a cast puppet → musical mode; the season's tunes only count in the window; the rare idle
"humming" note hums the season's first tune's opening (Jingle Bells); a seasonal voicing is optional (sleigh bells /
celesta under each voice → `note-x-<id>` samples + registry `sounds.note` + SEASON_NOTE_PREFIX ×3; the iOS test checks
every sample ships). Intro jingle variant (`intro-winter-holidays`) → founder listens in the Sound Library first.

## 3. Achievement ideas (same shape as Halloween: one seasonal moment badge + one secret per tune)

- `winter_wonder` "Winter Wonder" — Finish a daily during the winter holidays (category seasonal, `momentAchievements`
  season gate, `ready` respected, admin preview sees it).
- Secrets, one per wired tune: tune_jingle_bells "Jingle Bells", tune_deck_the_halls "Deck the Halls",
  tune_merry_christmas "Merry Christmas", tune_joy "Joy to the World", tune_wenceslas "Good King Wenceslas",
  tune_hanukkah "Hanukkah, O Hanukkah", tune_maoz_tzur "Ma'oz Tzur".
- Kwanzaa, without a tune: `seven_days` "Seven Days" — Finish a daily on each of the seven days Dec 26 – Jan 1 (the
  Kwanzaa week; needs a per-day record, so it lands in the New Year window's rules — reachable only if the window is
  live; otherwise hold it).
- Optional stretch (needs new tracking; mark `hidden` until it ships): `eight_nights` "Eight Nights" — Play on all eight
  nights of Hanukkah (dates move every year: 2026 starts the evening of Dec 4; the rule takes the year's dates as data).

Copy in the game's voice, American spelling, no religious garments on the badges (candles, dreidels, kinara, snow,
sleigh, tree, lights). Badge art per key (`art-ach-<key>`), falls back to the category icon until it ships.
