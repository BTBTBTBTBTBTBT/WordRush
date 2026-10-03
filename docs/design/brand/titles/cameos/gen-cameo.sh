#!/bin/bash
# One cast cameo via the paid API (input fidelity high), canonical refs attached:
#   gen-cameo.sh <out name> "<ids e.g. s or o2,i>" "<character description>" "<pose>"
cd "$(dirname "$0")"
REFS=()
for id in ${2//,/ }; do REFS+=(../../cast/hero/$id.png ../../refs/$id.png); done
P="The attached images are the CANONICAL reference for our cast character(s): $3. Keep the character(s) EXACTLY on-model: the same face (eyes, brows, mouth, teeth, tongue), the same accessories, body shape, body color and the white letter on the body — do not redesign anything. Soft 3D style with gentle diffused gloss (no wet shine). Draw ONLY the character(s) in a NEW pose, NO title letters and no text anywhere: $4. Friendly and gentle. Fully transparent background, no ground shadow, the whole character visible with margin, centered, square image."
mkdir -p raw
/opt/homebrew/bin/python3 ../../openai-image.py edit "raw/$1.png" "$P" "${REFS[@]}" --size 1024x1024 --fidelity high
