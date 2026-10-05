# S (gold, sweatband, sneakers): jog in place; his speed lines (hero pixels) stream past. Fists are not cut.
import os, sys
import numpy as np
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion

r = Rig('s', HERE)
lab, n = ndimage.label(r.A > 0)
sizes = ndimage.sum(r.A > 0, lab, range(1, n + 1))
main = 1 + int(np.argmax(sizes))
lines = (lab != main) & (lab > 0)
lines = r.grow(lines, 2) & (r.A > 0) & (lab != main)
r.cut('speed', lines, fill='clear')
gold = (r.R > 180) & (r.G > 120) & (r.B < 120)
eyes = [r.blob(b, thr=60) for b in ((545, 300, 652, 382), (702, 318, 800, 422))]
# his left eye touches its brow in the art: keep only the round eye (center and size from the right eye)
eyes[0] &= (r.xx - 596) ** 2 + (r.yy - 338) ** 2 < 41 ** 2
disc = np.zeros_like(eyes[0])
for e in r.eye_info(eyes):
    disc |= (r.xx - e['cx']) ** 2 + (r.yy - e['cy']) ** 2 < (max(e['w'], e['h']) / 2 + 9) ** 2
r.eye_patches(eyes, cover=disc & (r.A > 0), ring_ok=gold, closed=(0.46, 0.15, 0.25))
mouth = r.blob((605, 355, 712, 432), thr=90)
pink = (r.R > 200) & (r.G < 160) & (r.B > 110)
mouth = ndimage.binary_fill_holes(mouth | (pink & r.grow(mouth, 10) & r.box(605, 355, 712, 440)))
r.mouth_laugh(mouth, sy=1.45, ring_ok=gold)
m = motion(r, 'S', 'Jog in place', 'Always on the move: his speed lines stream past, and every 6 s he breaks into a bouncing jog in place. Tap: he hops and laughs.')
o = m['breath']['origin']
env = [[0, 0], [0.8, 0], [1.0, 1, 'inOut'], [3.6, 1], [3.9, 0, 'inOut']]
m['tracks'] = dict(jog=dict(osc=[16, 0.36, 0.8, 1], env=env), lean=dict(osc=[1.6, 0.72, 0.8], env=env),
                   lineDx=dict(kf=[[0, 0], [0.3, -46, 'out'], [0.36, 30, 'step'], [0.6, 0, 'out']], period=0.6),
                   lineA=dict(kf=[[0, 1], [0.3, 0, 'in'], [0.36, 0], [0.6, 1, 'out']], period=0.6))
m['root'] = dict(origin=o, dy='jog', rot='lean')
m['layers'] = [dict(img='speed', dx='lineDx', alpha='lineA'), dict(img='base')]
r.write(m)
