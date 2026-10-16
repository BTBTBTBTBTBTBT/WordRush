# Halloween stage time-of-day: ChatGPT prompts, v2 (10-16 pm)

Founder: v1 "all still look like copies of one another ... more distinction and more matching to the wallpapers". v1 files are kept
in `raw/` as `rejected-v1-*` (morning-v1 / day-v1 / day-v2 / evening-v1). Night = `docs/design/brand/2.8/wallpapers-1015/final/celebration-stage-halloween.png`
(byte copy = `-night.png`, untouched).

Each prompt attached TWO refs: `refs/stage-night.jpg` (image 1, the source stage) and `refs/wall-halloween-<time>.jpg` (image 2, the NEW Halloween
time wall from `../../render-walls.py halloween`, 692x1500). Free ChatGPT web app, image mode ("Create an image." prefix). Every prompt says: may change
lighting, color grading, atmosphere and small seasonal dressing, NOT the layout; same camera, closed back curtain, cobwebs, steps, three overhead beams and
three floor pools on one line (middle on the center line); calm empty center; no people/text; 16:10.

| time | try | time-specific text (after the common frame) | raw | verdict |
|---|---|---|---|---|
| morning | 1 | curtains soft lavender/dusty plum (lighter + cooler than image 1), cool pale-gold sunrise light raking from one side across the folds, low white-lavender mist carpet on the floor, jack-o'-lanterns UNLIT with dew, candles out, dew-glinting cobwebs, string lights off, palette lavender/peach/pale gold from the wall; beams + pools = pale gold sunbeams | raw/morning-v2.png | KEEP: lavender stage, window-light raking from the left, mist on the floor, unlit pumpkins; residual 0.4 px |
| day | 1 | bright daytime Halloween fair: fully sunlit, orange + purple + lime accents, vivid violet curtains, bright orange pumpkins, crisp hard shadows, orange/purple/lime paper bunting instead of string lights, leaves on the floor, sky-blue shadow tint, no fog, no candles, no glowing lights; pools = warm white sun patches | raw/day-v3.png | KEEP: vivid violet + bunting + dappled window shadows, reads midday at a glance; residual 0.2 px |
| evening | 1 | strong hot-orange sunset rim light, long deep shadows, wine-magenta back curtain, jack-o'-lanterns just lit, first string lights, orange/magenta floor haze, amber pools | raw/rejected-evening-v2-too-close-to-night.png | REJECT: red-magenta but still dark and near the night frame |
| evening | 2 (follow-up in the same chat) | "still reads too close to the night version": brighter, golden-orange low sun pouring in from the right raking across the whole stage, right curtain folds glow hot orange, curtains magenta-rose + violet (lighter, not near-black), long soft orange-gold floor shadows, warm gold-orange haze, jack-o'-lanterns just lit, only a few string lights; same beams/pools | raw/evening-v3.png | KEEP: sunlit magenta-orange stage with window shapes raking in from the right; residual 0.2 px |

Align (run from `time-of-day/stage/`; `--season halloween` picks the Halloween time walls for the sheet):
`python3 -I align-stage.py --night ../../../2.8/wallpapers-1015/final/celebration-stage-halloween.png --out chatgpt-halloween --walls .. --season halloween --stem celebration-stage-halloween --sheet chatgpt-halloween/stage-on-walls-v2.jpg morning=chatgpt-halloween/raw/morning-v2.png day=chatgpt-halloween/raw/day-v3.png evening=chatgpt-halloween/raw/evening-v3.png`
Numbers in `align-report.json` (max residual 0.4 px, target 6). Review sheet `stage-on-walls-v2.jpg`: each stage on its OWN Halloween time wall (`../halloween-home-<tod>.webp`), green crosshairs = night pool centers.
Frame coverage 0.97-0.99 (edges clamped, a few px at the border; day scale 0.987).
