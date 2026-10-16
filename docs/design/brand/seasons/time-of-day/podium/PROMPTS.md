# Podium time-of-day (10-16)

Source: `docs/design/brand/2.8/wallpapers-1015/final/podium-stage.png` (1536x1024, the night stadium; `podium-stage-night.png` is a byte copy).
Free ChatGPT web app, new chat per time, image mode ("Create an image."). Attached: refs/source-night.jpg (image 1) +
refs/screen-<time>.jpg (image 2, the matching ios-leaderboard screenshot). Outputs 1536x1024.

## Common frame
> Image 1 is my podium stage (stadium with a crowd of mascot silhouettes and three steps). Image 2 is the phone screen where it will sit, with <SKY>. Redesign and re-light the SAME stage as a custom <TIME> scene. Keep the SAME camera, framing and layout exactly, pixel for pixel in position: the same curved crowd stands with the same mascot-silhouette crowd, the same THREE cylinder steps (gold 1 in the center and tallest, silver 2 on the left, bronze 3 on the right) with the SAME shapes, sizes and positions, the same cream numerals 1, 2, 3 on the step fronts, the same BLANK satin text panels on each step (no text, no numbers in the panels), the same base platform, same gold trim. Only the sky, light and atmosphere change: <LOOK>. Keep the steps looking like the same glossy gold, silver and bronze. No characters standing on the steps, no moon, no extra text. Wide landscape, 3:2 (1536 x 1024), highly polished stylized game art, same rendering style as image 1.

- MORNING: SKY = a soft dawn sky. LOOK = soft dawn, lavender-peach sky behind the stands, misty haze, the crowd silhouettes lit pale gold, string lights nearly off, soft pastel morning glow and warm sunrise reflections on the floor.
- DAY: SKY = a bright blue daytime sky. LOOK = a bright open-air daytime stadium, clear blue sky above the stands, sunlit stands, crisp clean daylight, the crowd silhouettes in soft sunlit lavender-blue, no stage lights glowing, bright white-gold sun reflections on the polished floor.
- EVENING: a variant of the frame with explicit geometry ("do NOT change the camera, framing, zoom or the size and position of anything ... steps span roughly 8% to 93% of the width, gold top ring at about 33% of the height, base platform ending at about 87% ... two curved rows of crowd stands in the top third"); LOOK = golden-to-magenta sunset sky behind the stands, floodlights and string lights just coming on, warm amber rim light on steps and crowd, magenta and orange floor reflections.

## Log
| time | attempt | raw | verdict |
|---|---|---|---|
| morning | 1 | raw/morning-v1.png | KEEP, max residual 0.4 px |
| day | 1 | raw/day-v1.png | KEEP (sun top-right, flags on the rim), max residual 0.2 px |
| evening | 1 | raw/evening-v1.png | KEEP (dusk, lights on), max residual 0.1 px |

## Alignment
`python3 -I align-podium.py --night ../../../2.8/wallpapers-1015/final/podium-stage.png --out . --sheet podium-sheet.jpg morning=raw/morning-v1.png day=raw/day-v1.png evening=raw/evening-v1.png` (run from this folder).
6 landmarks (3 step-top centers from PODIUM_ART feet, 3 satin panel centers), located in each new image by edge-map
template matching (+/-60 px, sub-pixel), similarity fit (scale + translation), warp to 1536x1024; numbers in `align-report.json`
(scales 0.9998-0.9999, translations <0.5 px: ChatGPT reproduced the geometry almost exactly). The night source keeps the cream
numerals 1/2/3 on the step fronts above the panels (as drawn in the source); the panels are blank.
