# O (amber, cheerleader): pom-pom cheer shake. The four purple pom-poms are cut from the hero and shaken about the
# point where each hand grips it; the body bounces on the beat. Her eyes are already happy arcs, so her blink is a
# quick squeeze (the real arcs squashed) and her laugh uses the same squeeze with her real mouth stretched open.
import os, sys
import numpy as np
from scipy import ndimage
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion

r = Rig('o1', HERE)
r.shadow(935)
amber = (r.R > 200) & (r.G > 110) & (r.B < 90) & (r.A > 200)
purple = (r.B > r.R + 20) & (r.A > 0)
lab, n = ndimage.label(r.grow(purple, 1) & (r.A > 0))
sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
poms = []
for k in np.argsort(sizes)[::-1][:4] + 1:
    m = lab == k
    contact = r.grow(m, 3) & amber & ~m
    ys, xs = np.where(contact)
    piv = [int(xs.mean()), int(ys.mean())]
    ys2, xs2 = np.where(m)
    poms.append((float(ys2.mean()), float(xs2.mean()), m, piv))
poms.sort(key=lambda p: (p[0] > 450, p[1]))      # upper-left, upper-right, lower-left, lower-right
names = ['pom-ul', 'pom-ur', 'pom-ll', 'pom-lr']
for nm, (_, _, m, piv) in zip(names, poms):
    r.cut(nm, m, fill='inpaint', radius=8)
eyes = [r.blob(b, thr=70) for b in ((380, 300, 495, 380), (588, 330, 700, 410))]
r.eye_patches(eyes, cover=r.grow(eyes[0] | eyes[1], 7) & (r.A > 200), ring_ok=amber, kinds=('half',), half=0.5)
mouth = r.blob((475, 360, 600, 440), thr=70)
pink = (r.R > 200) & (r.G < 170) & (r.B > 110)
mouth = ndimage.binary_fill_holes(mouth | (pink & r.grow(mouth, 12)))
r.mouth_laugh(mouth, sy=1.45, ring_ok=amber)
m = motion(r, 'O (amber)', 'Pom-pom cheer', 'Every 6 s she shakes all four pom-poms (her own, cut from the art) and bounces on the beat. Tap: she hops and laughs.',
           laugh=('eyes-half', 'mouth-laugh'))
m['blink'] = dict(half='eyes-half', closed='eyes-half')
env = [[0, 0], [1.0, 0], [1.15, 1, 'inOut'], [2.6, 1], [2.8, 0, 'inOut']]
m['tracks'] = dict(shakeA=dict(osc=[10, 0.3, 1.0], env=env), shakeB=dict(osc=[-10, 0.3, 1.0], env=env),
                   bounce=dict(osc=[14, 0.3, 1.0, 1], env=env), idle=dict(osc=[2.5, 1.7, 0]))
m['root'] = dict(dy='bounce')
m['layers'] = [dict(img='shadow', shadow=True), dict(img='base')] + [
    dict(img=nm, pivot=p[3], rot=['shakeA' if i in (0, 3) else 'shakeB', 'idle']) for i, (nm, p) in enumerate(zip(names, poms))]
r.write(m)
