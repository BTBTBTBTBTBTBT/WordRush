#!/bin/bash
# Generate one label sheet through the paid API (openai-image.py):
#   gen-labels.sh <sheet name> <portrait|landscape> "<WORD / WORD / ...>"
# Portrait 1024x1536 = 5 short words; landscape 1536x1024 = 3 long phrases (wide rows so nothing wraps).
cd "$(dirname "$0")/../.."
N=$(echo "$3" | awk -F' / ' '{print NF}')
if [ "$2" = landscape ]; then SIZE=1536x1024; else SIZE=1024x1536; fi
P="Create a NEW image using image 1 only as the STYLE reference for the letterforms: the same soft, puffy, rounded, chunky bubble letters with gentle diffused gloss and soft inner shading. Render ONLY freestanding 3D LETTERS — absolutely NO plaques, NO pill or box shapes, NO backing panels, NO background shapes behind or around the words. Letter color: CREAM-WHITE (#FFF9F0) with a soft pale-lavender shade toward the bottom of each letter and a gentle soft top gloss. No colored rim or outline, no drop shadow, soft and subtle, not heavy. Fully transparent background. Exactly $N labels, stacked vertically, centered. EACH LABEL STAYS ON ONE SINGLE LINE — never wrap a label onto two lines; make the letters smaller if needed. Same letter height for all, large empty gaps between rows, the whole stack inside the middle 80% of the image with wide empty margins so nothing touches an edge; nothing else in the image; exact spelling: $3"
/opt/homebrew/bin/python3 openai-image.py edit "buttons/labels/raw/$1.png" "$P" titles/cast-colors/dailies.png --size $SIZE
