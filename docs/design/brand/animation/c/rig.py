# C (teal): happy wiggle; laugh = ^ ^ eyes + his C mouth stretched open (the teeth part). All hero pixels.
import os, sys
import numpy as np
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion

r = Rig('c', HERE)
teal = (r.B > r.R + 60) & (r.lum < 200)
pupils = [r.blob(b, thr=70) for b in ((400, 300, 540, 445), (615, 290, 760, 435))]
eyes = []
for p in pupils:
    ring = r.grow(p, 45) & (r.A > 200)
    sclera = ring & (r.lum > 190) & (r.yy < 455)
    eyes.append(ndimage.binary_fill_holes(r.largest(r.grow(sclera, 1) | p)))
r.eye_patches(eyes, cover=r.grow(eyes[0] | eyes[1], 14) & (r.A > 200), ring_ok=teal, ring_w=18, closed=(0.44, 0.10, 0.18), happy=(0.44, 0.05, 0.6))
letter = r.largest(r.box(370, 400, 770, 830) & (r.lum > 200) & (r.A > 200) & ~r.grow(eyes[0] | eyes[1], 6))
r.mouth_laugh(r.grow(letter, 2), sy=1.16, sx=1.0, ring_ok=teal)
m = motion(r, 'C', 'Happy wiggle', 'Rocks side to side on his feet with a little squash, then settles. Tap: ^ ^ eyes and his C mouth stretches open so the teeth part.')
o = m['breath']['origin']
env = [[0, 0], [1.0, 0], [1.25, 1, 'inOut'], [2.5, 1], [2.9, 0, 'inOut']]
m['tracks'] = dict(wig=dict(osc=[4.5, 0.55, 1.0], env=env), bob=dict(osc=[-12, 0.275, 1.0, 1], env=env))
m['root'] = dict(origin=o, rot='wig', dy='bob')
r.write(m)
