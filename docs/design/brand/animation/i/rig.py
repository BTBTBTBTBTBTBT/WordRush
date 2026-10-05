# I (green, sprout): sprout sway, blush, and (10-05) a WAVE. His own right-side hand (viewer's right) lets go of his
# cheek: the hero arm (cut from the hero, edge and body under it rebuilt in code) swings up and out about his
# shoulder, then hands over to the raised waving arm (the one non-hero piece: a ChatGPT limb, raw/, Lab-matched to
# his own arm) which swings out from behind his body edge, waves twice, and hands back. Never two arms in a frame.
import os, sys
import numpy as np
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion
from limbs import match_limb, edge_fill

r = Rig('i', HERE)
green = (r.G > r.R + 40) & (r.A > 240)
cols = [x for x in range(340, 680) if not 420 <= x <= 505]
top = int(min(np.argmax(r.A[:, x] > 200) for x in cols))
sprout = (r.A > 0) & (r.yy < top - 1)
sprout |= (r.A > 0) & (r.yy < top + 8) & (r.xx > 420) & (r.xx < 505) & ~r.grow(r.box(0, top + 8, 1024, 1024), 0)
sprout = r.largest(sprout) | ((r.A > 0) & (r.yy < top - 1))
r.cut('sprout', r.grow(sprout, 1) & (r.yy < top + 9) & (r.A > 0), fill='inpaint', radius=6)

blush = (r.box(372, 395, 462, 472) | r.box(558, 362, 648, 442)) & (r.R > r.G * 0.82) & (r.A > 200)
blush = r.grow(ndimage.binary_opening(blush, iterations=2), 3)

# ---- the right arm (viewer's right): hand at his cheek + forearm over the body edge
ARM = [(567, 455), (610, 445), (670, 450), (687, 475), (710, 505), (722, 545), (715, 575), (690, 600), (650, 607),
       (620, 590), (595, 560), (570, 525), (559, 485)]
arm = r.poly(ARM) & (r.A > 0)
arm |= (r.A > 0) & r.box(660, 470, 760, 612) & ~r.grow(r.box(0, 0, 1024, 470), 0) & (r.xx > 690)
arm = ndimage.binary_fill_holes(arm)
ring = (r.grow(arm, 30) | (r.grow(arm, 50) & (r.yy > 560))) & ~arm & (r.A > 0)          # the arm's soft contact shadow on his body
letter = r.grow(r.largest((r.lum > 200) & (r.sat < 40) & r.box(470, 480, 600, 800) & (r.A > 200)), 6)
ring &= ~letter
hole = arm | ring
band = np.zeros_like(r.H); band[ring] = r.H[ring]
rest = np.zeros_like(r.H); rest[arm] = r.H[arm]
edge_fill(r, hole & (r.yy >= 418) & ~r.grow(blush, 2), 'right', list(range(380, 432, 4)) + list(range(620, 700, 4)), ring_ok=green & (r.lum > 128) & ~r.grow(arm, 32),
          rows=(412, 672), ring_w=24, band=40, feather=14)
r.front += [('arm-band', band), ('arm-rest', rest)]

# raised waving arm: ChatGPT limb (raw/chatgpt-wave-arm.webp), Lab-matched to his own arm pixels
ref = r.H[arm & (r.A > 250) & green][:, :3]
wave = match_limb(os.path.join(HERE, 'raw', 'wave-arm-keyed.png'), ref, scale=0.29, lift=2.0)
r.patch('arm-wave', wave)
WPIV = [round(95 * 0.29), round(652 * 0.29)]   # the shoulder stub's center, in the scaled limb

eyes = [r.blob(b, thr=70) for b in ((400, 342, 478, 420), (524, 318, 602, 392))]
r.eye_patches(eyes, ring_ok=green)
smile = r.blob((462, 380, 552, 432), thr=80)
r.painted_mouth(smile, ring_ok=green)
d = ndimage.distance_transform_edt(blush)
a = np.clip(d / 8, 0, 1) * 0.55
bl = r.H.copy(); bl[..., :3] = bl[..., :3] * (1 - a[..., None]) + np.array([238, 120, 140]) * a[..., None]; bl[..., 3] = np.where(blush, 255 * np.clip(d / 4, 0, 1), 0)
r.patch('blush', bl)
m = motion(r, 'I', 'Wave hello + sprout sway',
           'His sprout sways all the time. Every 6 s his hand lets go of his cheek and swings up into a two-wave hello '
           '(the raised arm swings out from behind his side), his cheeks warm up, then it swings back. Tap: he hops and laughs.')
o = m['breath']['origin']
SH = [706, 560]          # hero shoulder (rest arm pivot)
UP = 36                  # rest arm swing at the handover
T0, T1, D1, D2 = 0.9, 1.12, 3.32, 3.6
m['tracks'] = dict(
    sproutSway=dict(osc=[5, 2.2, 0]),
    sproutBoing=dict(osc=[7, 0.7, 1.0], env=[[0, 0], [1.1, 0], [1.5, 1, 'inOut'], [3.3, 1], [3.8, 0, 'inOut']]),
    tilt=dict(kf=[[0, 0], [1.0, 0], [1.5, -2.2, 'inOut'], [3.3, -2.2], [3.9, 0, 'inOut']]),
    blushA=dict(kf=[[0, 0], [1.2, 0], [1.7, 1, 'inOut'], [3.3, 1], [4.0, 0, 'inOut']]),
    restRot=dict(kf=[[0, 0], [T0, 0], [T1, UP, 'in'], [D2, UP], [D2 + 0.45, 0, 'outBackSoft']]),
    restA=dict(kf=[[0, 1], [T1 - 0.005, 1], [T1, 0, 'step'], [D2 - 0.005, 0], [D2, 1, 'step']]),
    bandA=dict(kf=[[0, 1], [T0, 1], [T0 + 0.12, 0, 'inOut'], [D2 + 0.2, 0], [D2 + 0.45, 1, 'inOut']]),
    waveA=dict(kf=[[0, 0], [T1 - 0.005, 0], [T1, 1, 'step'], [D2 - 0.005, 1], [D2, 0, 'step']]),
    waveTheta=dict(kf=[[0, -40], [T1, -40], [T1 + 0.4, -6, 'outBack'], [D1, -6], [D2, -40, 'in']]),
    waveS=dict(kf=[[0, 0.82], [T1, 0.82], [T1 + 0.4, 1.0, 'out'], [D1, 1.0], [D2, 0.82, 'in']]),
    waveOsc=dict(osc=[13, 0.9, T1 + 0.4], env=[[0, 0], [T1 + 0.3, 0], [T1 + 0.5, 1, 'inOut'], [D1 - 0.2, 1], [D1, 0, 'inOut']]),
)
m['root'] = dict(origin=o, rot='tilt')
m['layers'] = [dict(img='arm-wave', at=[688, 548], pivotInImg=WPIV, rot=['waveTheta', 'waveOsc'], s='waveS', alpha='waveA'),
               dict(img='base'), dict(img='blush', alpha='blushA'), dict(img='arm-band', alpha='bandA'),
               dict(img='arm-rest', pivot=SH, rot='restRot', alpha='restA'),
               dict(img='sprout', pivot=[460, top + 4], rot=['sproutSway', 'sproutBoing'])]
m['patchAfter'] = 'blush'
m['checkTimes'] = [0.9, 1.0, 1.08, 1.12, 1.16, 1.25, 1.4, 1.55, 2.0, 2.45, 3.0, 3.32, 3.45, 3.58, 3.62, 3.75, 3.9, 4.1]
r.write(m)
