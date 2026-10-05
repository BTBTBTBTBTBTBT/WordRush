# Button family — wiring spec (iOS · Android · web)

Everything that is not a primary cast button (`../cast/README.md`). Designed in ChatGPT 10-05 (raw/), keyed by
`make-family.py` into TINTABLE sprites (out/), shipped ×3 by `ship-family.py` as `art-fam-*`. Gallery: `options.html`.

**Technique: fill + light map.** `art-fam-lm-*` is the ChatGPT gloss + shading as a white-or-black overlay with alpha.
Draw the shape's plain fill (any color), then the light map on top: that color in the ChatGPT finish. One sprite serves
every game tint, pressed, dark mode and the colorblind tile palettes. No blend modes, no per-color art.

## Picks (founder 10-05: no approval round, pick like the cast buttons)
| Family | Pick | Today |
|---|---|---|
| 1 Game helpers | **A Frosted wash** | small candy pills |
| 2 Secondary / quiet | **A Lavender ghost pill** | peach candy |
| 3 Round icons | **A Bare soft 3D icon** (no bubble, founder rule) | small candy circle |
| 4 Switches | **A Candy toggles (keep) + finish the rollout** | 3 system switches, SoftSegmented |
| 5 Keys | **A Glossy keys** (state fill + `art-fam-lm-key`) | flat face + lilac lip |
| 6 VS / pocket | cast for Challenge/Rematch/Accept/Find match, quiet for Decline/See all, helper for pocket moves | candy |
| Hubbub rare words | **corner gem** `art-fam-cic-gem` | muted "BONUS" text |

## 1 Helper pill (`art-fam-lm-frost`, pressed `-pressed`) — THREE-SLICE, caps = h/2
- Height **34 pt** (an icon-only helper = a 34 × 34 circle: the three-slice at w = h).
- Tint = the screen's GAME accent (ModeCatalog `accentHex`); outside a game, the old variant: purple #7c3aed,
  pink #db2777, amber #d97706, teal #0d9488.
- Fill: light `mix(white, tint, 0.20)` (pressed 0.27) · dark `mix(#231c40, tint, 0.34)` (pressed 0.42).
- Ink (icon + label): light `mix(tint, black, 0.32)` · dark `mix(tint, white, 0.65)`.
- Icon: `art-fam-ic-*` white clay, fit in **18 pt**, tinted by MULTIPLY with the ink (iOS `colorMultiply`, Android
  `ColorFilter.tint(ink, BlendMode.Modulate)`, web mask + `mix-blend-mode: multiply`). No art → the SF Symbol /
  Material icon in the ink. Gap 5 pt.
- Label: Nunito Black **12.5 pt** UPPERCASE, tracking 0.02 em, shrink to 0.75 min; padding leading 0.34 h, trailing 0.42 h.
- Pressed: the `-pressed` light map + the pressed fill + squish 0.94 + label 1 pt down. Used / disabled: saturation 0.25,
  opacity 0.5. Light map in dark mode at 85% opacity.
- Symbol → icon: delete.left→delete · shuffle→shuffle · return→enter · lightbulb(.fill)→hint · eye(.fill)→eye ·
  flag(.fill)→flag · checkmark(.circle.fill)→check · arrow.uturn.backward / arrow.uturn.left / arrow.counterclockwise→undo ·
  arrow.right / forward.fill→next · arrow.clockwise / repeat→refresh · sparkles→sparkles · pencil→pencil · eraser→erase ·
  xmark(.circle)→xmark · play.fill→play · chart.bar.fill→chart.

## 2 Quiet pill (same light map)
- Heights: large 44 · medium 40 · small 34. Fill #ece4ff (pressed #e2d7ff) · dark #3b3163 (pressed #463a74).
- Ink #5b21b6 · dark #ddd0ff. Nunito Black 13.5 pt (small 12.5) UPPERCASE; padding 0.45 h. Text links stay text links.

## 3 Round icon button
- The bare 3D icon, **28 pt** in a 44 pt hit area, squish 0.9 on press. Close = `art-fam-cic-close`,
  info = `art-fam-cic-info`; share / back / gear / trophy / help = the existing `icon3d-*` / header icons.

## 4 Switches
- Every on/off switch uses the candy toggle (`art-toggle-*` sprites, 52 × 30); every two-way switch the candy
  segmented (frosted track + glossy purple thumb). No system switch, no SoftSegmented look.

## 5 Keys (`art-fam-lm-key`, 124 × 150 px @3x) — NINE-SLICE, corner = 31 px (10.33 pt)
- Key = rounded rect r = 10 pt filled with the state color (TilePalette, colorblind-aware; unknown = #fbfaff light /
  #3d355f dark, ink softNumber / #efe9ff), then the light map nine-sliced over it. No separate lip (the map has it).
- Quadrant keys: the per-board cells, then the same light map over the whole key.

## Hubbub rare words
- A rarer word's chip wears `art-fam-cic-gem` **13 pt** at its top-right corner (x +6, y −7 outside the chip), no text tag.
  Accessibility: "WORD, rare word". The pangram keeps its ★.

## Mapping the old candy call sites (one switch in the shared style, ×3)
`CandyButtonStyle` (iOS) / `CandyButton` (Android) / `.candy` + `CandyButton` (web) now render the family:
- `small` (not circle) → helper pill · `circle` → helper circle · `peach` at medium/large → quiet pill ·
  any other medium/large → the cast primary (`variant.cast(screen)`).
