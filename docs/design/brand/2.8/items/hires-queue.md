# Hires (one-per-image, ~780 px) regeneration queue

Done (goth/hires, keyed): lace-choker, velvet-cape. Single images come back at 1448 px and capture at ~780 px: much cleaner than the 12-up sheets.

Recipe per item (tab with a style reference attached): "Now ONE single item per image (not a sheet). Square 1:1 image, same glossy 3D toy style as the reference,
the item centered and filling about 85 percent of the image, on ONE flat solid cyan #00FFFF background edge to edge, no gradient, no shadow, no floor,
NO text, logos or brands. Item: <name + description from packs.py>." Then key with tools/slice_grid.key_sheet(edge_px=3, all_pockets=True, crop=True) as in
the goth example, save to <pack>/hires/<piece>.png.

Order (founder list): goth (10 left), emo (12), punk (12), baseball (8), football (8), soccer (8), hockey (8), basketball-golf (12), careers (12, incl. police cap +
firefighter helmet), pets (12), music (12), gaming (8). ~130 images, ~1 min each in 4 parallel tabs.

Composite splits done in code from the sheets: careers pilot-cap + aviator-shades + safety-goggles; basketball-golf headband + wristbands; metal studded-cuff +
fingerless-glove. Two overlapping composites could not be cut cleanly (beret + palette, detective cap + magnifier): regenerate those four singles; the
scientist coat+flask also needs two singles.

## Progress (2026-10-09)
Done one-per-image (63 of 258): goth 12, emo 12, punk 12, baseball 8, football 8 (eye-black reused from baseball), soccer 8, hockey 4 (helmet, stick, puck, skates, gloves).
Remaining list: items/hires-remaining.txt (195). Stopped when the founder's ChatGPT Plus image limit was reached ("resets in 22 hours"); resume when it resets. No paid API used.
