# I (green, sprout): sprout sway + shy sway with a blush that warms up. The sprout is cut from the hero at the top of
# his head. A wave was NOT attempted: both hands hold his I, so a waving arm would need new art.
import os, sys
import numpy as np
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion

r = Rig('i', HERE)
green = (r.G > r.R + 40) & (r.A > 240)
cols = [x for x in range(340, 680) if not 420 <= x <= 505]
top = int(min(np.argmax(r.A[:, x] > 200) for x in cols))
sprout = (r.A > 0) & (r.yy < top - 1)
sprout |= (r.A > 0) & (r.yy < top + 8) & (r.xx > 420) & (r.xx < 505) & ~r.grow(r.box(0, top + 8, 1024, 1024), 0)
sprout = r.largest(sprout) | ((r.A > 0) & (r.yy < top - 1))
r.cut('sprout', r.grow(sprout, 1) & (r.yy < top + 9) & (r.A > 0), fill='inpaint', radius=6)
eyes = [r.blob(b, thr=70) for b in ((400, 342, 478, 420), (524, 318, 602, 392))]
r.eye_patches(eyes, ring_ok=green)
smile = r.blob((462, 380, 552, 432), thr=80)
r.painted_mouth(smile, ring_ok=green)
blush = (r.box(372, 395, 462, 472) | r.box(558, 362, 648, 442)) & (r.R > r.G * 0.82) & (r.A > 200)
blush = r.grow(ndimage.binary_opening(blush, iterations=2), 3)
d = ndimage.distance_transform_edt(blush)
a = np.clip(d / 8, 0, 1) * 0.55
bl = r.H.copy(); bl[..., :3] = bl[..., :3] * (1 - a[..., None]) + np.array([238, 120, 140]) * a[..., None]; bl[..., 3] = np.where(blush, 255 * np.clip(d / 4, 0, 1), 0)
r.patch('blush', bl)
m = motion(r, 'I', 'Sprout sway + shy sway', 'His sprout sways all the time; every 6 s he sways shyly, the sprout bobs and his cheeks warm up. Tap: he hops and laughs.')
o = m['breath']['origin']
env = [[0, 0], [1.0, 0], [1.4, 1, 'inOut'], [3.4, 1], [3.9, 0, 'inOut']]
m['tracks'] = dict(sproutSway=dict(osc=[5, 2.2, 0]), sproutBoing=dict(osc=[7, 0.7, 1.0], env=env), shy=dict(osc=[2.5, 1.25, 1.0], env=env),
                   blushA=dict(kf=[[0, 0], [1.0, 0], [1.5, 1, 'inOut'], [3.4, 1], [4.0, 0, 'inOut']]))
m['root'] = dict(origin=o, rot='shy')
m['layers'] = [dict(img='base'), dict(img='blush', alpha='blushA'), dict(img='sprout', pivot=[460, top + 4], rot=['sproutSway', 'sproutBoing'])]
m['patchAfter'] = 'blush'
r.write(m)
