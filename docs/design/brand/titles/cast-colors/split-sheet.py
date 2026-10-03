#!/usr/bin/env python3
"""Key one ChatGPT title sheet and split its stacked titles (top → bottom) into <slug>.png here.
  python3 split-sheet.py raw/<sheet>.png <cyan|magenta|none> slug1,slug2,... [outdir]
(none = already transparent, e.g. the OpenAI API with background "transparent")
Titles are separated by empty rows; the N tallest bands are kept (N = number of slugs)."""
import os, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.path.join(HERE, '..', '..', 'key-capture.py')
src, key, slugs = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
OUT = os.path.abspath(sys.argv[4]) if len(sys.argv) > 4 else HERE
if key == 'none':
    im = Image.open(src).convert('RGBA')
else:
    keyed = os.path.splitext(src)[0] + '-keyed.png'
    subprocess.run(['/opt/homebrew/bin/python3', KEY, src, 'full', key, keyed, 'native-all'], check=True, capture_output=True)
    im = Image.open(keyed).convert('RGBA')
a = np.asarray(im)[..., 3] > 40
lab, n = ndimage.label(ndimage.binary_dilation(a.any(1), iterations=4))
bands = [s[0] for s in ndimage.find_objects(lab)]
bands = sorted(sorted(bands, key=lambda b: -(b.stop - b.start))[:len(slugs)], key=lambda b: b.start)
if len(bands) != len(slugs):
    sys.exit(f'{src}: found {len(bands)} bands for {len(slugs)} slugs')
for slug, b in zip(slugs, bands):
    t = im.crop((0, b.start, im.width, b.stop))
    t = t.crop(t.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
    t.save(os.path.join(OUT, slug + '.png'))
    print(slug, t.size)
