#!/usr/bin/env python3
"""demagenta.py <png...>: remove magenta-key spill from soft glows (fireflies, fog, moon halo).
Pixels that lean magenta (min(r,b) well above g) lose alpha in proportion and have their red/blue pulled to g; detached specks drop."""
import sys
import numpy as np
from PIL import Image
for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGBA')).astype(np.float32)
    r, g, b, al = [a[..., i].copy() for i in range(4)]
    m = np.clip((np.minimum(r, b) - g - 30) / 80, 0, 1)
    # glow-to-transparent: purple fog keeps its colour (r,b both high AND g much lower) only where it is dense (alpha high)
    al2 = al * (1 - m * 0.95)
    a[..., 0] = np.where(m > 0, r * (1 - m) + np.maximum(g, r * 0.55) * m, r)
    a[..., 2] = np.where(m > 0, b * (1 - m) + np.maximum(g, b * 0.55) * m, b)
    a[..., 3] = al2
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    im.crop(bb).save(f)
