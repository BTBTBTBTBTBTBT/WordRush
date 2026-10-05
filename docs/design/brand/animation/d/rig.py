# D (glasses, pencil): pencil taps. The pencil is cut from the hero (his hand stays on the body and holds it) and
# rocks about his grip. Blinks happen inside his real glasses rims.
import os, sys
import numpy as np
from scipy import ndimage
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion

r = Rig('d', HERE)
blue = (r.B > r.R + 80) & (r.lum > 60) & (r.A > 240)
pencil = r.box(735, 90, 950, 910) & (r.A > 0) & ~(r.B > r.R + 35)
lab, n = ndimage.label(pencil)
sizes = ndimage.sum(pencil, lab, range(1, n + 1))
pencil = np.isin(lab, [k + 1 for k in range(n) if sizes[k] > 400])
pencil = r.grow(pencil, 1) & (r.A > 0) & ~((r.B > r.R + 35) & (r.A > 250))
r.cut('pencil', pencil, fill='inpaint', radius=8)
pupils = [r.blob(b, thr=70) for b in ((330, 320, 470, 465), (565, 285, 705, 430))]
rim = r.largest(r.box(140, 220, 820, 510) & (r.lum < 70) & (r.A > 200))
rim = rim & ~r.grow(pupils[0] | pupils[1], 2)
eyes = []
for p in pupils:
    sc = r.grow(p, 45) & (r.lum > 175) & ~rim
    eyes.append(ndimage.binary_fill_holes(r.largest(sc | p) | p))
inside = ~r.grow(rim & ~(eyes[0] | eyes[1]), 1)
r.eye_patches(eyes, cover=r.grow(eyes[0] | eyes[1], 3) & inside & (r.A > 200), ring_ok=blue & ~r.grow(rim, 2), clip=inside.astype(np.float32),
              closed=(0.42, 0.05, 0.25), happy=(0.42, 0.05, 0.55))
mouth = r.blob((460, 420, 590, 515), thr=90)
pink = (r.R > 200) & (r.G < 160)
mouth = ndimage.binary_fill_holes(mouth | (pink & r.grow(mouth, 12)))
r.mouth_laugh(mouth, sy=1.45, ring_ok=blue)
m = motion(r, 'D', 'Pencil tap', 'Every 6 s he taps his pencil (his own, cut from the art) in a quick rhythm, rocking it in his grip. Tap: he hops and laughs.')
env = [[0, 0], [1.0, 0], [1.1, 1, 'inOut'], [2.3, 1], [2.45, 0, 'inOut']]
m['tracks'] = dict(tap=dict(osc=[3.2, 0.3, 1.0], env=env), nod=dict(osc=[0.8, 0.6, 1.0], env=env))
m['root'] = dict(rot='nod')
m['layers'] = [dict(img='base'), dict(img='pencil', pivot=[832, 552], rot='tap')]
m['patchAfter'] = 'base'
r.write(m)
