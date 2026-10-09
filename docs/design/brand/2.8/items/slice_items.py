#!/usr/bin/env python3
"""slice_items.py [pack ...]: key + slice <pack>/raw/sheet.png into <pack>/out/<id>.png (transparent, trimmed), build the contact sheet
and README.md from packs.py. Pieces are ~200-300 px (12 per sheet): fine for fit trials and drafts; regenerate the ones shipped one-per-image."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
import numpy as np
from PIL import Image
import slice_grid as sg
from packs import PACKS
import subprocess

def run(pack):
    cols, rows, items = PACKS[pack]
    sheet = f'{HERE}/{pack}/raw/sheet.png'
    out = f'{HERE}/{pack}/out'; os.makedirs(out, exist_ok=True)
    rgba = sg.key_sheet(sheet, all_pockets=True, decyan=False, crop=True)
    alpha = np.asarray(rgba.getchannel('A'))
    names = [i[0] for i in items]
    parts = sg.split_cells(rgba, names, cols, rows)
    for n, (bb, mk) in parts.items():
        p = rgba.copy(); p.putalpha(Image.fromarray((alpha * mk).astype(np.uint8))); p.crop(bb).save(f'{out}/{n}.png')
    missing = [n for n in names if n not in parts]
    subprocess.run(['/opt/homebrew/bin/python3', f'{HERE}/../tools/contact.py', out, f'{HERE}/{pack}/contact-sheet.png', '4', '300'], check=True, stdout=subprocess.DEVNULL)
    with open(f'{HERE}/{pack}/README.md', 'w') as f:
        f.write(f'# {pack} pack (FRIDAY-QUEUE 5b / 51)\n\nDrawn by the free ChatGPT in the shipped accessory style (glossy 3D toy, lit top-left, flat cyan key), keyed + split from `raw/sheet.png` by `../slice_items.py`. '
                'Pieces are ~200-300 px (drafts for fit trials); regenerate shipped ones one-per-image. No brands / logos / weapons / hate or religious symbols. '
                '"Colorable" = neutral white-grey clay: code tints it (hair color, team/primary color).\n\n| piece | slot | colorable parts |\n|---|---|---|\n')
        for n, slot, col in items:
            f.write(f'| `out/{n}.png` | {slot} | {col} |\n')
        if missing: f.write(f'\nNOT FOUND in the sheet: {missing}\n')
    print(pack, len(parts), 'pieces', 'missing' if missing else '', missing)

for p in (sys.argv[1:] or PACKS):
    if os.path.exists(f'{HERE}/{p}/raw/sheet.png'): run(p)
