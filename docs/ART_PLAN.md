# WORDOCIOUS art plan (founder, 2026-10-02 night: "a ton of new images for every aspect of WORDOCIOUS … one cohesive project across the board")

One look everywhere: the ten-tile cast (docs/MASCOT_SPEC.md), glossy 3D, lettering in Nunito Black
caps with the purple→pink gloss + gold rim (the day titles). Made free in ChatGPT (chat "Logo concept
sheet"), captured from the browser pane, keyed (docs/design/brand/key-capture.py; cyan #00FFFF key by
default, magenta for teal/cyan subjects, never green for green subjects), stored under docs/design/brand/.

Rules learned:
- ChatGPT can't hold ten detailed characters in one image → whole-cast pieces are COMPOSED in code
  (titles/compose-cast-title.py) from approved single-character art + ChatGPT lettering-only images.
- One character per prompt, with its full checklist (below), keeps details exact.
- Compositions: put SOME characters in front of the letters (where the word stays legible), others
  behind/peeking, so it reads natural, not a title pasted over a crowd (founder).
- GAME titles use that game's own accent color for the lettering (not the menu purple→pink) and its
  host mascot (MASCOT_SPEC §5) (founder).
- Every drawing of a character gets a DIFFERENT facial expression within its personality (W smug →
  determined → laughing, etc.) so poses never look copy-pasted (founder).
- Leave wide margins; ChatGPT's Edit/share buttons sit over the bottom corners of the card.

Character checklist (paste into every prompt that draws one):
W purple tile, white W, small red cape, confident smirk · O1 amber, white O, FOUR arms with purple
pom-poms, big open smile · R slate grey, white R, light-blue striped nightcap w/ white pom-pom, sleepy ·
D bright blue, white D, big round black glasses, yellow pencil · O2 hot pink, white O, purple heart
sunglasses pushed up, one eye winking · C teal, two big eyes, NO separate mouth: the white C IS the
mouth with 1–2 rounded snaggleteeth hanging from its top inner edge · I tall narrow green, white I,
two-leaf sprout, rosy cheeks, shy · O3 orange, CYCLOPS: the O's hole is one big eye, small pink tongue ·
U purple, white U, closed calm eyes, floats, no feet · S golden yellow, white S, purple/white sweatband
+ sneakers, determined.

## Status

| # | Piece | Where it goes | Status |
|---|---|---|---|
| A | Day titles ×7 (Mon D … Sun O3) | Leaderboard banner title | DONE titles/<day>-keyed.png |
| B | Pose sheets ×10 (sit / cheer / lean) | whole-cast compositions | in progress (C first) |
| C | Whole-cast page titles: FRIENDS, STATS, ALL-TIME RECORDS, VS BATTLE, PUZZLES, WORD OF THE DAY, SETTINGS, GO PRO, HOW TO PLAY, MORE GAMES | top of each page | lettering FRIENDS + STATS done; compose with poses |
| D | Game icons ×18 + VS + More, 3D glossy versions of today's glyphs (no faces) | game tiles / cards / selectors | todo |
| E | W / L completion badges (+ ✓) | home game cards | todo |
| F | Moment lettering: VICTORY!, SO CLOSE!, SWEEP!, FLAWLESS!, YOU WIN!, YOU LOSE, DRAW, NEW RECORD!, STREAK! | result + celebration screens | todo |
| G | Scenes: R asleep (empty), R unplugged (offline), U zen (all done), O3 peeking (404), I waving (add a friend), D with clipboard (no stats yet) | empty / error states | todo |
| H | Welcome hero: whole cast waving + WELCOME lettering | sign-in / onboarding | todo |
| I | Pro hero: crowned W + cast, GO PRO | Pro page | todo |
| J | Holiday title: <HOLIDAY> HEROES stays code text + W hero | Leaderboard on holidays | decide |
| L | Game title art ×18: game name lettering in the game's accent color + its host (pose from B) | game screen header, guide sheet, Leaderboard Play card | todo |
| K | Share card / store art with the cast | share images, store listing | later |
