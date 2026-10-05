# Cast puppets (10-04 night, limbs added 10-05)

## 10-05: ChatGPT limbs + fixes
Three new pieces came from ChatGPT (free, in the browser). Each was drawn on its own on a flat key color, keyed, and
then composited onto the real hero art in code. The raw captures are in `<id>/raw/`. No character was redrawn.
- **I waves** (`i/`). His viewer's-right hand, cut from the hero, lets go of his cheek and swings up and out about
  his shoulder (36 deg, 0.22 s). It then hands over to the ChatGPT raised arm, which waves twice and hands back the
  same way, so no frame shows two arms on that side. The raised arm is Lab-matched to his own arm pixels
  (`rig-engine/limbs.py`). Under the hand, the body is rebuilt in code: his own silhouette edge continues through
  the gap, the edge band is cloned from the rows above and below, and the inside is a fitted surface feathered into
  the hero. His letter's corner is protected. The arm's contact shadow fades out as the hand leaves.
- **S pumps his fist** (`s/`, cycle now 8 s: jog, then pump). His right fist slides in behind his side. The ChatGPT
  fist-pump arm swings up from behind him (ease-out-back), pumps three times with a little body bounce, and swings
  back while the fist slides out with a soft settle.
- **Pink O's sunglasses bob** (`o2/`). Her frames are the same pink as her head, so the ChatGPT drawing of the pair is
  used only as the cut-out SHAPE. Each heart is registered onto her real lenses (centroid, lens-area scale and the
  pair's tilt, -7.7 deg), and the moving layer is her own hero pixels. The glasses hop when she opens her eye, then
  lift and land a beat after her head on the sassy bob. The head under the frames is inpainted from her pink.
- **C:** the closed and ^ ^ eyes now sit on an inpainted fill, with the eye glow faded back in over 14 px, so the
  eye "socket" ghost is gone. His letter is protected (the old patch clipped the C's top-right). His laugh is more
  visible: the C stretches 1.24x and the opening between his teeth gets a mouth in his own pupil ink with a small
  tongue. Both teeth stay on top.
- **S's laugh:** his brows soften into raised friendly arcs, painted in his own brow ink. The eye and brow areas are
  inpainted (with the headband kept out of the fill), so the old light discs and the ring of eye outline are gone.
  His blink keeps his real brows.
- **R's hop:** the floor shadow starts higher and keeps the feet's own edge, and the gaps the feet left in it are
  filled row by row. The faint line under his feet during the hop is gone.
- Engine additions: `Rig.inpaint_fill` (Telea inpaint plus halo fade, `limit` and `also` masks, and an optional
  face-texture transfer), `eye_patches(fillmode='inpaint', brows=...)`, `Rig.stroke`, `shadow(keep_edge=)`, and
  `limbs.py` (`match_limb`, `edge_fill`).

**Honest read.**
- I's handover is a hard swap at the swing's fastest point. It reads as one motion, but a paused frame at 1.12 s
  shows the raised arm at 82% scale.
- The rotated hero arm at 36 deg shows its flat cut end for about 0.1 s.
- S's pump arm is a hair slimmer than his own fist arm.
- O's glasses lift at most 14 px. A bigger lift would show the inpainted head top, which is soft.
- R's filled shadow is a little streaky under the feet. It is only seen mid-hop, and it fades.

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
| r | slow yawn: his real mouth stretches open (up to 1.32x), his eyes close, his head tips back, and the nightcap pom-pom droops and sways | 0.039 | Works well. With his eyes closed the lid bulges stay, which reads as sleepy. 10-05: the line under his feet during a hop is fixed. |
| d | pencil tap: the pencil (cut, with his hand left in place) rocks in his grip plus a tiny nod | 0.010 | The best of the set. Blinks happen inside his real glasses rims. The glasses push was not done. |
| o2 | wink + sunglasses bob: her winking eye opens (a code clone of her own left eye), the glasses hop, then she snaps the wink back with a sassy tilt and the glasses land a beat late | 0.015 | 10-05: the glasses are her own pixels, cut with a ChatGPT-drawn outline registered to her lenses. The open eye fades in over 80 ms. |
| c | happy wiggle: rocks on his feet with a squash bounce | 0.000 | Laugh (10-05): ^ ^ eyes, the C stretches 1.24x and the opening shows a mouth and tongue. No socket ghost. |
| i | wave hello (10-05) + sprout sway, with cheeks that warm up | 0.032 | The raised arm is the one ChatGPT piece. His laugh mouth is painted (a D shape in his own smile ink with a pink tongue), because his mouth is a line. |
| o3 | big slow blink of his single eye, then a tongue wiggle and a small wave of his raised arm | 0.013 | The tongue and arm are cut, and the gaps are inpainted. The closed eye is a flat lid over a fitted fill: the eye's bulge is not kept. |
| u | gentle float: always bobbing, and every 6 s he drifts about 44 px higher; slow, deep breaths | 0.000 | No blink, because his eyes are already closed. His laugh paints ^ ^ over his closed eyes and an open mouth in his own ink. |
| s | jog in place, then a fist pump (10-05); his speed lines (hero pixels) stream past all the time | 0.054 | The pump arm is the one ChatGPT piece. Laugh: friendly brows and a clean eye fill. |

## Verification
Frames were checked across each cycle and through each tap with headless Chrome contact sheets (frozen canvases).
The W transitions were checked frame by frame at about 50 ms steps. No JS errors were found and all 11 canvases
load on `cast.html`. The pages were not watched live on a phone.

## ChatGPT (10-04)
None was used on 10-04: every 10-04 gesture was built from hero pixels and code, and the only non-hero piece in the whole cast
was W's raised hand from the pilot's parts sheet. The limbs listed for next time (I's waving arm, S's
fist-pump arm and pink O's sunglasses) were drawn on 10-05; see the top of this file.
