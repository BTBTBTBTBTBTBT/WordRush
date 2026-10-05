# O (orange cyclops): a big slow blink and a tongue wiggle; his raised arm gives a small wave at the same time.
# Tongue and arm are cut from the hero.
import os, sys
import numpy as np
from scipy import ndimage
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion

r = Rig('o3', HERE)
orange = (r.R > 190) & (r.G > 90) & (r.B < 120) & (r.A > 240)
tongue = r.box(460, 495, 640, 650) & (r.R > 190) & (r.G < 150) & (r.B > 90) & (r.A > 0)
tongue = r.grow(r.largest(tongue), 2) & (r.A > 0) & r.box(455, 495, 645, 655)
ty, tx = np.where(tongue)
r.cut('tongue', tongue, fill='inpaint', radius=6)
arm = r.box(800, 190, 970, 460) & (r.A > 0) & ~((r.xx < 845) & (r.yy > 330))
r.cut('arm', arm, fill='inpaint', radius=10)
pupil = r.blob((410, 290, 600, 480), thr=70)
eye = ndimage.binary_fill_holes(r.largest((r.grow(pupil, 130) & (r.lum > 185) & (r.A > 200)) | pupil) | pupil)
r.eye_patches([eye], cover=r.grow(eye, 9) & (r.A > 200), feather=12, ring_ok=orange & ~r.grow(r.lum < 80, 4), ring_w=80, ring_gap=26, closed=(0.4, 0.0, 0.22), happy=(0.36, 0.05, 0.5), lw=18)
mouth = r.blob((430, 460, 640, 590), thr=70)
r.mouth_laugh(ndimage.binary_fill_holes(mouth | (r.grow(mouth, 20) & (r.R > 190) & (r.G < 150) & (r.B > 90))), sy=1.25, ring_ok=orange)
m = motion(r, 'O (orange)', 'Big blink + tongue wiggle', 'Every 6 s one huge slow blink of his single eye, then a tongue wiggle and a small wave of his raised arm. Tap: he hops and laughs.')
env = [[0, 0], [1.9, 0], [2.0, 1, 'inOut'], [3.1, 1], [3.3, 0, 'inOut']]
m['tracks'] = dict(eyes=dict(kf=[[0, 0], [1.0, 0], [1.12, 1, 'linear'], [1.24, 2, 'linear'], [1.6, 2], [1.72, 1, 'linear'], [1.84, 0, 'linear']]),
                   wig=dict(osc=[11, 0.34, 1.9], env=env), wave=dict(osc=[-7, 0.68, 1.9], env=env), idle=dict(osc=[1.5, 2.2, 0]))
m['eyesTrack'] = 'eyes'
m['layers'] = [dict(img='base'), dict(img='tongue', pivot=[int(tx.mean()), int(ty.min()) + 6], rot='wig'), dict(img='arm', pivot=[858, 425], rot=['wave', 'idle'])]
r.write(m)
