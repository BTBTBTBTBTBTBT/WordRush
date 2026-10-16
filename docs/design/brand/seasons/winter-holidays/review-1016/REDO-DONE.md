# Winter holidays redo, round 1 (2026-10-16, free ChatGPT web, MacBook Chrome)

Method: each cast member = full on-model redraw from `cast/hero/<id>.png` (one attached ref), costume fitted on the body, letter kept visible. Cyan-key prompts came back with transparent backgrounds (no keying needed); magenta-key ones were cut with `key-capture.py ... magenta ... native-all`. Raw downloads in `raw/redo-1016/`. Old drafts moved to `cast/prev-1016/`.

## Cast (cast/<id>.png overwritten; mix = Christmas x6, Hanukkah x2, Kwanzaa x2)
| File | Costume | Verdict |
|---|---|---|
| w | Christmas: Santa hat, black belt + gold buckle, fur-cuffed mittens, fur boots; cape kept | PASS (on-model, W clear) |
| d | Hanukkah: blue/silver knit sweater with dreidel + snowflake pattern (round opening on D), beanie, holds gelt (menorah stamped coin) | PASS |
| c | Hanukkah: blue/silver scarf + beanie, dreidel (gimel), gelt at feet | PASS (gimel reads correctly; C matches hero) |
| o3 | Christmas ugly sweater, pom beanie, red mittens | PASS |
| u | Kwanzaa: red/black/green kente-trim wrap + beanie, kinara 3 red / 1 black / 3 green | PASS (counted; face on-model; body slightly rounder than hero under the wrap) |
| s | Kwanzaa: kente sash, scarf, ear of corn baton | PASS (angled brows kept) |
| i | Christmas: striped scarf, earmuffs, white mittens | PASS |
| o1 | Christmas reindeer: antlers + holly, jingle-bell collar, tan belly bib, pom-poms kept | PASS |
| r | Christmas: patchwork quilt wrap, striped nightcap + holly, cocoa mug | PASS |
| o2 | Christmas cape + bow, muff, gift, heart sunglasses | SAVED AS `cast/o2-v2.png` (not overwritten): the bow overlaps the top of the O ring slightly; lead decides / retry |

## Props (props/)
hanukkiah.png (9 holders, 4 + raised shamash + 4, PASS), dreidel.png (nun + gimel, PASS), kinara.png (3 red, 1 black, 3 green, PASS; use raw transparent, cyan keying damaged it).

## Scenes (extras/)
scene-flawless-star.png (O2 on pink gem, red cape + muff, snowfall, no hat, PASS), scene-sweep-broom.png (S on one broom, scarf, navy vest, red mittens, snowflakes, PASS). Both transparent RGBA.

## Not done (time box)
Props: gelt, latkes, sufganiyot, mkeka, unity cup, ornaments. Titles lettering redos. Alts (w/o3/d/c/u/s -alt1 old duplicates still in cast/ and should be dropped).

## Incident
Blind clicks at the lightbox download position hit the chat "Share" button in several ChatGPT chats (possibly the u, i, r, o2 chats), which copies a public link. Nothing sensitive in them (mascot images) but the links should be revoked: ChatGPT Settings > Data controls > Shared links > Manage (not done by me, settings are off limits).

# Round 2 (2026-10-16 afternoon, free ChatGPT web, MacBook Chrome; raw in `raw/redo-1016-r2/`)

Method: same as round 1; title prompts attached a ref sheet (winter happy-holidays + puzzles + the Halloween/Thanksgiving counterpart) and asked for the Halloween proportions + one garnish. Cut with `key-capture.py ... native-all` (cyan, or magenta for blue/green/teal). One download per tab, via the viewer's "Download" button found by name; Share never touched. Old files kept in `titles/prev-1016/` and `cast/prev-1016/`.

## Cast
| File | Result | Verdict |
|---|---|---|
| cast/i.png | earmuffs on, striped scarf worn BEHIND the body (tails out at the sides), white I fully visible top to bottom, hero pose and face | PASS (round-1 version with the scarf over the letter saved as `cast/prev-1016/i-r1-scarf-over-letter.png`) |
| cast/o2.png | cape + fur collar + red bow at the NECK above the ring, fur muff in one hand, heart sunglasses on head, wink, white O ring fully visible | PASS (replaces the draft; the bow-on-ring v2 moved to `cast/prev-1016/o2-v2-bow-on-ring.png`) |

## Props (props/)
gelt.png (gold-foil coins, star of David embossed, one half-unwrapped; photographic foil look, accurate), latkes.png (3 latkes on a plate, sour cream, applesauce), sufganiyot.png (two powdered-sugar jelly doughnuts, one bitten), mkeka.png (woven mat, red / black / green bands, fringe), unity-cup.png (carved wood kikombe, red/black/green geometric band), ornaments-set.png (six ornaments on one sheet, slice if single files are needed). All PASS. They are more photographic than the draft toy props; same material family as the Thanksgiving food props.

## Titles (titles/<name>.png overwritten; 25 of the 25 flagged)
Lettering redos (15, Halloween proportions, stacked where long): game-classic (candy cane), game-classicseven (stacked, dreidel nun), game-codebreaker (stacked, red/black/green candles), game-crosswordocious (stacked CROSSWOR / DOCIOUS, gold star), game-deliverance (candy cane), game-letterladder (stacked, candy cane), game-muddle (candles), game-octoword (first O = red ornament), game-propernoundle (stacked PROPER / NOUNDLE, O = gold star), game-spyglass (candles), game-starsweep (star on P), label-snow-day (O = snowball with eyes, gold star on Y), label-warm-wishes (stacked, holly), page-leaderboard (gold star), page-wordoftheday (stacked WORD OF THE / DAY, dreidel gimel).
Garnish-only redos (10): dailies (holly), game-classicsix (holly), game-gauntlet (dreidel hei), game-kindred (holly), game-quadword (holly), game-succession (O = dreidel shin), game-sudocious (candy cane), page-friends (holly), page-stats (red/black/green candles), winter (candy cane).
Mix across the 25 + the 4 keepers: holly x6, candy cane x6, Hanukkah dreidel x4 (nun, gimel, hei, shin), Kwanzaa candle trios x4, star x4, ornament x1, snowball x1. Spelling checked on every file. All PASS.
Retry: page-friends came back with a ragged/missing top rim (ChatGPT's own transparent cut); one retry with an opaque cyan fill fixed it (navy rim share now matches the rest).
Not redone: game-hubbub (optional holly), the keepers (happy-holidays, let-it-snow, puzzles).

## Still open
Greeting labels (HAPPY HANUKKAH / HAPPY KWANZAA / MERRY CHRISTMAS), pieces, extras, walls (code), the six -alt1 duplicates still in cast/ (drop), muhindi corn prop, celebration stage.
Reminder: revoke any shared links from round 1 (ChatGPT Settings > Data controls > Shared links > Manage); none created this round.
