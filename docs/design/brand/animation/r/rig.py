# R (sleepy, nightcap): a slow yawn. His real mouth stretches open, his eyes close, his head tips back a little and
# the nightcap pom-pom (cut from the hero) droops and sways. The pom-pom also sways gently all the time.
import os, sys
import numpy as np
from scipy import ndimage
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion

r = Rig('r', HERE)
feet = int(np.where((r.A > 250).any(1))[0].max())
r.shadow(feet - 30, amax=200)
gray = (r.sat < 40) & (r.lum > 110) & (r.lum < 230) & (r.A > 240)
cap = (r.B > r.R + 25) & (r.A > 0)
pom = r.largest(r.box(70, 320, 250, 500) & (r.lum > 195) & (r.A > 0))
pom = r.grow(pom, 2) & (r.A > 0) & ~r.grow(cap, 0) & r.box(70, 320, 250, 500)
ys, xs = np.where(r.grow(pom, 3) & cap)
pom_piv = [int(xs.mean()), int(ys.mean())]
r.cut('pom', pom, fill='inpaint', radius=8)
mouth = r.blob((515, 455, 610, 550), thr=70)
pink = (r.R > 190) & (r.G < 170) & (r.B > 110)
mouth = ndimage.binary_fill_holes(mouth | (pink & r.grow(mouth, 12)))
mouth = r.grow(mouth, 2) & (r.A > 200)
ys, xs = np.where(mouth)
mouth_top = [int(xs.mean()), int(ys.min())]
r.cut('mouth', mouth, fill='surface', ring_ok=gray)
pupils = [r.blob(b, thr=70) for b in ((425, 425, 520, 490), (585, 405, 675, 465))]
eyes = [ndimage.binary_fill_holes(r.grow(p, 2) | (r.grow(p, 12) & (r.lum > 200))) for p in pupils]
r.eye_patches(eyes, cover=r.grow(eyes[0] | eyes[1], 6) & (r.A > 200), ring_ok=gray, closed=(0.5, 0.0, 0.35), happy=(0.46, 0.3, 0.7))
r.mouth_laugh(mouth, sy=1.3, ring_ok=gray)
m = motion(r, 'R', 'Slow yawn', 'Every 6 s a big slow yawn: his own mouth stretches open, his eyes close, his head tips back and the nightcap pom-pom droops and sways. Tap: he hops and laughs.')
m['tracks'] = dict(
    yawn=dict(kf=[[0, 1], [1.0, 1], [1.7, 1.32, 'sine'], [2.5, 1.32], [3.0, 1, 'sine']]),
    eyes=dict(kf=[[0, 0], [1.05, 0], [1.15, 1, 'linear'], [1.25, 2, 'linear'], [2.6, 2], [2.75, 1, 'linear'], [2.9, 0, 'linear']]),
    tilt=dict(kf=[[0, 0], [1.0, 0], [1.7, -2.5, 'sine'], [2.5, -2.5], [3.1, 0, 'sine']]),
    pomSway=dict(osc=[5, 2.4, 0]), pomDroop=dict(kf=[[0, 0], [1.2, 0], [1.9, 12, 'sine'], [2.6, 12], [3.4, 0, 'sine']]))
m['eyesTrack'] = 'eyes'
m['root'] = dict(rot='tilt')
m['layers'] = [dict(img='shadow', shadow=True), dict(img='base'), dict(img='mouth', pivot=mouth_top, sy='yawn', when='nolaugh'),
               dict(img='pom', pivot=pom_piv, rot=['pomSway', 'pomDroop'])]
m['patchAfter'] = 'mouth'
r.write(m)
