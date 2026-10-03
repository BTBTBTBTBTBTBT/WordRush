#!/bin/bash
# Cast-color title sheet via the paid API (../../openai-image.py), style ref = dailies.png (+ the color's own title):
#   gen-titles.sh <sheet name> "<TITLE (color #hex) / TITLE (color #hex) / ...>" [ref2.png]
# Landscape 1536x1024, up to 4 titles stacked, transparent; split with split-sheet.py <png> none slugs.
cd "$(dirname "$0")"
N=$(echo "$2" | awk -F' / ' '{print NF}')
P="Create a NEW image using images 1 and 2 as the exact STYLE reference (image 2 shows three approved titles on lavender only for visibility): the same soft, puffy, rounded bubble title lettering with the same tall, slightly CONDENSED letter proportions, tightly spaced letters and a clearly visible thick darker outline rim around every letter with a soft vertical gradient of ONE color per title, a DEEPER SAME-COLOR rim, gentle diffused gloss and soft inner shade. No cream rim, no sparkles, hearts, flourishes, characters or any other shapes. Fully transparent background, no drop shadow onto the background. Exactly $N titles stacked vertically, centered. EACH TITLE STAYS ON ONE SINGLE LINE — never wrap; make the letters smaller if needed. Same letter height for all, large empty gaps between rows, wide empty margins so nothing touches an edge; nothing else in the image; exact spelling (keep apostrophes, hyphens and exclamation marks): $2"
mkdir -p raw
/opt/homebrew/bin/python3 ../../openai-image.py edit "raw/$1.png" "$P" dailies.png raw/ref-titles.png ${3:-} --size 1536x1024 ${FID:+--fidelity $FID}
