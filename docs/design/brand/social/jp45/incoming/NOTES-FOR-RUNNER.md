# Notes from the compositor (scene.py accept)
- Frame: 3:2 scenes are center-cropped to 16:9 for X (about 80 px lost top and bottom of 1536x1024), and 2:3 scenes to 4:5 for feed (about 6% of the height lost top and bottom).
- I overlay the REAL wordmark in the top band and the footer in the bottom band. So in every prompt: keep the top 14% and the bottom 9% of the frame as calm background only (no lettering, no mascot feet, no props), and keep the headline fully inside the middle 70%.
- Do not draw a wordmark or footer text into the scene; do not add any extra words besides the headline and sub line.
- Files must be full-size (1536x1024 / 1024x1536), named incoming/full/<id>.png.
- Headline must be spelled exactly as in queue.json; series colors follow STYLE.md.

## Series colors are checked on every scene (STYLE.md has the full season x series table)
Headline lettering color is part of the strict check. Halloween (Oct 17-31): MONDAY MASTERS ghostly blue-violet (hue ~245, indigo rim); WORD OF THE DAY QUIZ slime green (hue ~100, deep green rim);
MUDDLE WEDNESDAY pumpkin orange (hue ~25, brown-orange rim); 7 LETTERS. ONE WORD. potion teal (hue ~170); FRIDAY'S FINEST blood/candy red (hue ~355); SWEEP SUNDAY witch purple;
CAST SATURDAY candy-corn (yellow, orange, red-orange letters). Standard (Nov 1-13): Monday blue, WOTD teal, Muddle gold-orange, pangram green, Friday red-pink, Cast Saturday one color per letter.
Thanksgiving (Nov 14-29): Monday deep plum, WOTD sage, Muddle burnt orange, pangram golden wheat, Friday cranberry, Sweep maple brown, Cast Saturday harvest colors.
Launch / teaser / brand one-offs keep the purple-pink house lettering; gold sub lines stay gold. See incoming/rejects.json for redo requests.
For WORD OF THE DAY QUIZ scenes: leave a calm band under the headline for the word tiles (added in code).

## Update: headline color is fixed in code
`scene.py accept --series <series> --y0 .. --y1 ..` hue-shifts the purple-pink headline to the series/season color, so you do NOT need to fight ChatGPT for the hue
(keep the house purple-pink bubble lettering). Layout is what matters: headline fully inside the middle 70% with its top below ~12% of the height; for Muddle Wednesday
leave an empty center for the day's cartoon; for Word of the Day Quiz leave an empty band for the word tiles. 2026-10-19-x-1 and 2026-10-20-x-1 were redo-requested for
the earlier (color) reason: ignore the color part, the Monday scene was otherwise fine, the WOTD scene needs the empty band.
