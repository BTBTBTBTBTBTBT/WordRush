# Cast-color buttons — wiring spec (iOS · Android · web)

Skins: `art-btn-<color>-<s|m|l>[-pressed][-dark]` (shipped ×3; sources in `out/`, made by `make-skins.py`).
Colors: `purple` (primary), `teal`, `green`, `blue`, `gold`, `slate`, `orange`, `pink` (rare).
Heights: s = 32 pt, m = 44 pt, l = 56 pt (images are @3x). Text-free.

## Skin: three-slice
- End caps = height / 2 on each side, drawn as is; only a 1-px middle column stretches.
- Pressed: swap to the `-pressed` skin and drop the label `pressedDropPt` (1 pt). Dark mode: the `-dark` skins.

## Label (labels.json → `rules` + per-color `labels`)
- Font: **Nunito Black** (the Brand font), white fill, centered at 47% of the height.
- Size: start at 0.39 × height, shrink to fit, never below **11 pt**.
- Fit: the label lives in the flat middle only, inset from each end by max(0.6 × height, 14 pt at 44 pt).
  If it still doesn't fit at 11 pt, the button grows wider. Text never touches the caps.
- Stroke: one outline, **~1.1 pt**, in the color's `stroke` (a deeper shade of the same hue), under the white fill.
  No grey, no white edge, no second or offset outline.
- Shadow: same color, **35%**, 1 pt down, 2 pt blur.

Reference renderer: `button_render.py` (`preview-1x.png`, `preview-3x.png`).

## Label ART (preferred) — buttons/labels/<slug>.png
- The cream soft-bubble labels (no rim) are drawn on the skin instead of live text wherever the label is fixed.
- **Same cap height everywhere:** the label image is drawn at **0.42 × button height** (image height = cap height).
  The button **widens** to fit: width = label width + 2 × max(0.6 × height, 14 pt @ 44). Only in a fixed-width slot
  does the label shrink (keeping the inset). Never scale a label up to fill the button.
- Shadow: the label's alpha tinted in the color's `shadow`, 1 pt down, blurred 2 pt, 35% × 1.6.
- **Gold only:** an extra deeper-amber halo (`labels.gold.artHalo`: #9a5a00, 55%, 0.75 pt spread, 1.75 pt blur) behind the label.
- Dynamic labels (names, counts, prices, loading states) use the live-text fallback above.
