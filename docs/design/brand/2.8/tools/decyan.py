#!/usr/bin/env python3
"""decyan.py <png...>: remove cyan-key glow spill (aura pixels that are cyan/teal) and stray slivers from neighboring cells.
Cyan-ish pixels become soft transparent; tiny detached components (< 4% of the largest) are dropped."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA'); a = np.asarray(im).astype(np.float32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    cy = np.clip((np.minimum(g, b) - r - 6) / 45, 0, 1)          # 1 = clearly cyan
    al2 = al * (1 - cy)
    # pull remaining edge pixels away from cyan
    a[..., 0] = np.maximum(r, np.minimum(g, b) - 20 * (1 - cy))
    a[..., 3] = al2
    m = al2 > 24
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=3))
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1)); big = max(sizes)
        H_, W_ = m.shape
        good = []
        for i, s in enumerate(sizes):
            ys, xs = np.nonzero((lab == i + 1) & m)
            edge = xs.min() <= 1 or ys.min() <= 1 or xs.max() >= W_ - 2 or ys.max() >= H_ - 2
            if s >= 0.04 * big and not (edge and s < 0.25 * big):
                good.append(i + 1)
        keep = np.isin(lab, good)
        a[..., 3] = np.where(keep, a[..., 3], 0)
    out = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    out = out.crop(out.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
    out.save(f)
