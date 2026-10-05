# Cast puppets (10-04 night)

Open `cast.html`, which is self-contained (2.4 MB). It has W polished next to W v1 at the top, then all ten
characters animating live. Tap any of them to make them hop and laugh. Each character also has its own
`<id>/preview.html`, with light and dark stages side by side. The same grid is at the top of
`../seasons/gallery.html`.

## How it is built
`rig-engine/` is the reusable engine.
- **`engine.py` (cutting):**
  - cuts the moving parts out of `cast/hero/<id>.png` into layers that keep the exact hero pixels;
  - fills the hole each part leaves in code, using either a Telea inpaint from the neighboring hero pixels or a
    color surface fitted to the face around a feature;
  - paints the face patches: blink lids, ^ ^ happy eyes, and a laughing mouth (the real mouth stretched open);
  - checks the rest pose against the hero (`diff.png` in each folder).
- **`player.js`:** one small canvas player. It handles keyframe and sine tracks, layer pivots, breathing, the
  blink schedule, the tap hop and laugh, a ground shadow that stays on the floor, and the cloth ripple. It pauses
  canvases that are off screen. With `prefers-reduced-motion` the characters hold still and a tap only switches on
  the laughing face. To freeze a frame, add `?t=` (seconds) and `&tap=` (seconds since the tap).
- **`build.py`:** writes the previews, `cast.html` and `cast-embed.html`. The layers are WebP data URIs.

Each character is `<id>/rig.py`, which writes `<id>/rig.json`, `layers/` and `diff.png`.

To rebuild everything:
```
for c in w o1 r d o2 c i o3 u s; do python3 docs/design/brand/animation/$c/rig.py; done
python3 docs/design/brand/animation/rig-engine/build.py
python3 docs/design/brand/seasons/build-gallery.py
```

## W, polished (`w/`)
- **No crossfade between two arms any more.**
  - The hip fist pulls back and tucks behind his hip. It is drawn behind the body, and it turns 60 deg about a
    point inside him.
  - Only then does the raised arm swing out from behind the same edge: 0.45 s, ease-out-back. It starts from an
    angle where it was checked numerically to be 0 px outside the body.
  - On the way down, the raised arm swings back behind him and the fist slides out to his hip with a soft overshoot
    and settle (about 0.5 s).
  - No paused frame shows two arms. For about 50 ms at each end, no arm shows on that side, and in motion that
    reads as the wind-up.
- **Raised hand color:** it is now matched in Lab to the hero fist's own hue and chroma (chroma x0.94, L +4 for the
  lit side), so it is no longer hotter than the hero.
- **Tap to laugh** is unchanged: the same patches and the same hop.
- **Seam fix:** the fist is split at the body edge into a behind layer (the whole fist) and a front layer (the part
  pressing on his body). The two overlap, so a scaled-down canvas shows no seam.
- **Rest diff:** 0.014/255. The v1 pilot is untouched in `w-wave/`.

## Per character
The rest diff is the mean absolute difference, premultiplied RGB, over the character's pixels; the target is under
2/255. A diff of 0.000 means nothing structural was cut, so all the motion is root motion plus face patches.

| id | gesture | rest diff | honest note |
|---|---|---|---|
| w | wave (tuck, swing out, two waves, swing back, settle) | 0.014 | Cape sway and ripple as in v1. The raised hand is still the one non-hero part (pilot's ChatGPT sheet). |
| o1 | pom-pom cheer: all 4 pom-poms (cut from the hero) shake about her grip points, and she bounces on the beat | 0.024 | Only the pom-poms move, not the arms. A gentle idle shake runs all the time. Her eyes are already happy arcs, so her blink is a squeeze (her real arcs squashed), and her laugh uses that same squeeze. The ground shadow stays down when she hops. |
| r | slow yawn: his real mouth stretches open (up to 1.32x), his eyes close, his head tips back, and the nightcap pom-pom droops and sways | 0.015 | Works well. With his eyes closed the lid bulges stay, which reads as sleepy. A very faint line under his feet is left by the shadow cut during a hop. |
| d | pencil tap: the pencil (cut, with his hand left in place) rocks in his grip plus a tiny nod | 0.010 | The best of the set. Blinks happen inside his real glasses rims. The glasses push was not done. |
| o2 | wink: her winking eye opens (a code clone of her own left eye), she looks around, then snaps the wink back with a sassy tilt and a bob | 0.000 | The sunglasses bob was not done: the frames are the same pink as her head, so they can't be cut cleanly. The open eye fades in over 80 ms. |
| c | happy wiggle: rocks on his feet with a squash bounce | 0.000 | He has no antennae. Laugh: ^ ^ eyes, and his C mouth stretches 1.16x so the teeth part. The stretch is subtle. Closed eyes leave a faint socket shape. |
| i | sprout sway (always) + shy sway, with a sprout bob and cheeks that warm up | 0.017 | The wave was not done: both hands hold his I, so a waving arm would need new art. His laugh mouth is painted (a D shape in his own smile ink with a pink tongue), because his mouth is a line. |
| o3 | big slow blink of his single eye, then a tongue wiggle and a small wave of his raised arm | 0.013 | The tongue and arm are cut, and the gaps are inpainted. The closed eye is a flat lid over a fitted fill: the eye's bulge is not kept. |
| u | gentle float: always bobbing, and every 6 s he drifts about 44 px higher; slow, deep breaths | 0.000 | No blink, because his eyes are already closed. His laugh paints ^ ^ over his closed eyes and an open mouth in his own ink. |
| s | jog in place: bouncing jog with a lean; his speed lines (hero pixels) stream past all the time | 0.000 | The fist pump was not done (the fists are not cut). On his laugh, his angry brows stay and a faint ring of his eye outline shows through. |

## Verification
Frames were checked across each cycle and through each tap with headless Chrome contact sheets (frozen canvases).
The W transitions were checked frame by frame at about 50 ms steps. No JS errors were found and all 11 canvases
load on `cast.html`. The pages were not watched live on a phone.

## ChatGPT
None was used this session. Every gesture above is built from hero pixels and code. The only non-hero piece in the
whole cast is still W's raised hand from the pilot's parts sheet. Next limbs to ask ChatGPT for, color-matched to
each hero:
- a waving arm for I;
- a pumping fist arm for S;
- a separate sunglasses piece for pink O, so her glasses can bob.
