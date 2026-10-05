# U (purple, eyes already closed): no blink; a slow float and breathe, with a bigger lift-off as his gesture.
# Laugh = ^ ^ eyes painted over his closed ones + an open laughing mouth painted in his own smile ink.
import os, sys
import numpy as np
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion

r = Rig('u', HERE)
purple = (r.B > r.R + 30) & (r.lum > 60)
eyes = [r.blob(b, thr=80) for b in ((350, 245, 497, 335), (570, 245, 720, 338))]
r.eye_patches(eyes, ring_ok=purple, kinds=('happy',), happy=(0.40, 0.2, 1.6))
smile = r.blob((462, 318, 600, 385), thr=80)
r.painted_mouth(smile, ring_ok=purple)
m = motion(r, 'U', 'Gentle float', 'Hovers cross-legged, bobbing slowly and breathing deep; every 6 s he drifts a little higher, then settles back down. Tap: he hops and laughs.', blink=False)
m['breath'].update(period=4.2, sy=0.016, sx=0.008)
m['tracks'] = dict(float=dict(osc=[-12, 3.0, 0]), lift=dict(kf=[[0, 0], [1.2, 0], [2.4, -44, 'sine'], [3.4, -44], [4.8, 0, 'sine']]), sway=dict(osc=[1.2, 6.0, 0]))
m['root'] = dict(origin=[512, 600], dy=['float', 'lift'], rot='sway')
r.write(m)
