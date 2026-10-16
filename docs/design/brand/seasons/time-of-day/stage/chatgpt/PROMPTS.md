# Stage time-of-day: ChatGPT prompts (10-16)

Founder 10-16: a code color-grade was rejected ("faded copies"); ChatGPT designs each time as a custom scene; the
three floor light pools must stay in the same places; night = the existing stage untouched.
Each prompt attached two references: the night stage (`../../thanksgiving/extras/celebration-stage-thanksgiving.png`)
and the matching Home wall (`refs/wall-<time>.jpg`, the 1290x2796 wall downsized). Free ChatGPT web app, image mode.

## Common frame (all three)

> Image 1 is my harvest barn stage. Image 2 is the wallpaper the stage will sit on. Redesign and re-light the SAME
> stage as a custom <TIME> scene. Keep the SAME camera, framing and layout exactly: red curtains left and right, the
> autumn leaf garland and string lights across the top, hay bales, pumpkins and wheat sheaves on both sides, the
> wooden plank floor, and THREE round light pools on the floor in exactly the same positions and sizes as image 1
> (left, center, right, lower third). No people, no characters, no mascots, no text, no extra objects in the
> center: keep the center stage area calm and empty (a headline sits over the upper middle). Full-bleed, wide
> landscape 16:10, highly polished stylized game-art, consistent with image 1's rendering style.

## MORNING (sunrise)
> ...as a custom SUNRISE scene: peach-rose sunrise light streaming through barn windows and gaps between the boards,
> soft dawn haze, dew-fresh and cool-clean, string lights mostly off. The three floor pools are warm sunbeam patches.
> Palette rose-mauve and peach so it sits on image 2's rose-peach sunrise sky.

## DAY
> ...as a custom bright MIDDAY scene: barn doors and windows open to a blue sky, clean daylight, crisp saturated
> colors, string lights off. The three floor pools are bright sunlight patches (or white spotlights). Palette leans
> periwinkle / sky blue plus warm wood so it sits on image 2's blue sky.

## EVENING (golden hour)
> ...as a custom GOLDEN HOUR scene: a low golden-amber sun raking in from the side, string lights starting to glow,
> long warm shadows, dusk through the gaps. The three floor pools are amber spotlights. Plum-amber palette so it
> sits on image 2's dusk sky.

## Log

| time | attempt | raw | verdict |
|---|---|---|---|
| morning | 1 (common frame, MORNING) | raw/morning-v1.png (1586x992) | KEEP: same layout, peach-rose beams through the boards, three warm pools; residual 1.6 px |
| day | 1 (common frame, DAY) | raw/day-v1.png | REJECT: ChatGPT opened the barn doors onto a farm landscape + sun in the center (busy center, headline would sit on the sun); only 2 pools detectable |
| day | 2: "Good, but too different from image 1. Redo it: keep the closed wooden plank back wall and beams exactly as in image 1 (no open barn doors, no landscape view, no sun in the center). Make it bright MIDDAY instead by letting clean daylight pour in through gaps between the boards and a few small high windows, with crisp bright colors, a cool sky-blue tint in the shadows and on the beams, string lights off. The three round floor pools in exactly the same positions and sizes as image 1 must be bright white-gold sunlight patches. Same curtains, garland, hay bales, pumpkins and wheat on both sides. Calm empty center. No people, no characters, no text. Wide landscape 16:10." | raw/day-v2.png (1586x992) | GOOD look (closed wall, blue daylight through the gaps, periwinkle shadows); pools unevenly spaced (center 13 px left of the midpoint), residual 9.6 px max |
| day | 3: "Very close. One more pass, same scene and lighting: the three round floor light pools must be evenly spaced and centered exactly like image 1 (left, center, right, all on the same horizontal line, the middle one on the exact center line of the image, same size as in image 1), with the three overhead light beams above them. Keep everything else identical to your last image." | raw/day-v3.png (1586x992) | KEEP: same look as v2 with three overhead beams and evenly spaced pools; residual 1.6 px |
| evening | 1 (common frame, EVENING) | raw/evening-v1.png (1585x992) | KEEP: plum-amber, raking sun from the left, string lights glowing, three amber pools; residual 0.7 px |

Alignment: `python3 -I stage/align-stage.py --night ../thanksgiving/extras/celebration-stage-thanksgiving.png --out stage/chatgpt --walls . --sheet stage/chatgpt/stage-on-walls-v2.jpg morning=... day=... evening=...` (run from `time-of-day/`). Numbers in `align-report.json`.

Final picks: morning-v1, day-v3, evening-v1 (all <= 1.6 px max residual; target 6 px). Night = the source, byte-copied.
