# Gauntlet header (FINISH_SPEC AU6, night art 10-03): the hi-res GAUNTLET lettering over a five-medallion
# track (ChatGPT, keyed). Writes header.png + header-slots.json: each socket's center + diameter in 0–1 header
# coords, so the apps can drop medal-current / medal-cleared sprites onto the sockets as stages clear.
#   python3 compose-header.py
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


word = trim(Image.open(os.path.join(HERE, '..', 'titles', 'hires', 'gt-gauntlet-lettering.png')).convert('RGBA'))
track = trim(Image.open(os.path.join(HERE, 'track.png')).convert('RGBA'))
# the track spans 92% of the word's width
s = word.width * 0.92 / track.width
track = track.resize((round(track.width * s), round(track.height * s)), Image.LANCZOS)
gap = -int(word.height * 0.04)
W = word.width
H = word.height + gap + track.height
out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
tx, ty = (W - track.width) // 2, word.height + gap
out.alpha_composite(track, (tx, ty))
out.alpha_composite(word, (0, 0))
out.save(os.path.join(HERE, 'header.png'))
# sockets = the five big low-saturation (silver) blobs in the track
a = np.asarray(track).astype(int)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
grey = (al > 200) & (np.max(a[..., :3], axis=2) - np.min(a[..., :3], axis=2) < 40)
lab, n = ndimage.label(ndimage.binary_closing(grey, iterations=3))
sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
big = sorted([i + 1 for i in np.argsort(sizes)[-5:]], key=lambda i: ndimage.center_of_mass(lab == i)[1])
slots = []
for i in big:
    ys, xs = np.nonzero(lab == i)
    cx, cy = (xs.min() + xs.max()) / 2 + tx, (ys.min() + ys.max()) / 2 + ty
    d = max(xs.max() - xs.min(), ys.max() - ys.min())
    slots.append({'x': round(cx / W, 4), 'y': round(cy / H, 4), 'd': round(d / W, 4)})
json.dump({'size': [W, H], 'slots': slots,
           'note': 'socket centers + inner silver diameter as fractions of the header WIDTH (d) and width/height (x/y); '
                   'draw art-gauntlet-medal-current / -cleared at ~1.18 x d centered on a socket'},
          open(os.path.join(HERE, 'header-slots.json'), 'w'), indent=2)
print(W, H, slots)
