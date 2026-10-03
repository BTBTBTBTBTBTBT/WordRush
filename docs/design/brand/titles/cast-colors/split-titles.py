#!/usr/bin/env python3
"""Cast-color titles (founder 10-03: "same colors as the WORDOCIOUS characters"; style-A letterforms, deeper same-color rim): key the ChatGPT sheets (raw/) and split each into its
four stacked titles → <name>.png (keyed, trimmed). Color per title = the proposed menu mapping."""
import os, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.path.join(HERE, '..', '..', 'key-capture.py')
SHEETS = {   # sheet: (key color, titles top → bottom)
    'c-1': ('magenta', ['puzzles', 'wotd', 'vsbattle', 'stats']),
    'c-2': ('magenta', ['leaderboard', 'gopro', 'guides', 'settings']),
    'c-3': ('cyan', ['dailies', 'menu', 'friends', 'strategy']),
    'c-4': ('cyan', ['welcome', 'howto', 'words', 'moregames']),
    'c-5': ('cyan', ['faq', 'privacy', 'terms', 'records']),
}
# title → the cast member whose body color it wears (founder mapping 10-03)
COLOR = {'dailies': 'W purple', 'menu': 'W purple', 'puzzles': 'C teal', 'wotd': 'I green', 'vsbattle': 'D blue', 'vs': 'D blue',
         'stats': 'R slate', 'settings': 'R slate', 'leaderboard': 'S gold', 'gopro': 'S gold', 'guides': 'O orange',
         'friends': 'O pink', 'strategy': 'U violet', 'welcome': 'W purple', 'howto': 'W purple', 'words': 'W purple',
         'moregames': 'W purple', 'faq': 'W purple', 'privacy': 'W purple', 'terms': 'W purple', 'records': 'W purple'}
for sheet, (key, names) in SHEETS.items():
    keyed = os.path.join(HERE, 'raw', sheet + '-keyed.png')
    subprocess.run(['/opt/homebrew/bin/python3', KEY, os.path.join(HERE, 'raw', sheet + '.png'), 'full', key, keyed, 'native-all'], check=True, capture_output=True)
    im = Image.open(keyed).convert('RGBA')
    a = np.asarray(im)[..., 3] > 40
    lab, n = ndimage.label(ndimage.binary_dilation(a.any(1), iterations=6))
    bands = sorted([s[0] for s in ndimage.find_objects(lab)], key=lambda s: s.start)
    bands = sorted(bands, key=lambda b: -(b.stop - b.start))[:4]
    bands = sorted(bands, key=lambda b: b.start)
    assert len(bands) == 4, (sheet, len(bands))
    for name, b in zip(names, bands):
        t = im.crop((0, b.start, im.width, b.stop))
        t = t.crop(t.getbbox())
        t.save(os.path.join(HERE, name + '.png'))
        print(name, COLOR[name], t.size)
Image.open(os.path.join(HERE, 'vsbattle.png')).save(os.path.join(HERE, 'vs.png'))
