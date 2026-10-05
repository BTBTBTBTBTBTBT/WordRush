# S (gold, sweatband, sneakers): jog in place, and (10-05) a FIST PUMP. His right fist (viewer's right, cut from the
# hero; body edge rebuilt in code) tucks behind his side, then the raised fist-pump arm (the one non-hero piece: a
# ChatGPT limb, raw/, Lab-matched to his own fist) swings up from behind him, pumps three times and swings back while
# the fist slides out to his side with a soft settle. Never two right arms in a frame.
# Laugh (10-05): his determined brows soften into friendly raised arcs painted in his own brow ink, and the eye and
# brow areas are filled by inpainting from his face (no disc edge, no ring of eye outline).
import os, sys
import numpy as np
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion
from limbs import match_limb, edge_fill

r = Rig('s', HERE)
lab, n = ndimage.label(r.A > 0)
sizes = ndimage.sum(r.A > 0, lab, range(1, n + 1))
main = 1 + int(np.argmax(sizes))
lines = (lab != main) & (lab > 0)
lines = r.grow(lines, 2) & (r.A > 0) & (lab != main)
r.cut('speed', lines, fill='clear')
gold = (r.R > 180) & (r.G > 120) & (r.B < 120)

# ---- right fist (viewer's right) over the body edge
FIT = list(range(380, 440, 4)) + list(range(652, 700, 4))
ex = lambda y: np.where(r.A[y, 600:] > 128)[0].max() + 600
coef = np.polyfit(FIT, [ex(y) for y in FIT], 2)
edge = lambda y: np.polyval(coef, y)
rows = np.arange(r.h)[:, None]
er = np.where((rows >= 436) & (rows <= 652), edge(rows), 1e9)
fist = (r.A > 0) & (r.xx > er - 8) & (r.yy >= 436) & (r.yy <= 652)
fist = r.largest(ndimage.binary_opening(fist, iterations=1)) | (fist & (r.xx > er + 1))
ring = r.grow(fist, 18) & ~fist & (r.A > 0) & (r.yy > 400)
band = np.zeros_like(r.H); band[ring] = r.H[ring]
fin = np.zeros_like(r.H); m_in = fist & (r.xx < er + 2); fin[m_in] = r.H[m_in]
fout = np.zeros_like(r.H); fout[fist] = r.H[fist]
edge_fill(r, fist | ring, 'right', FIT, ring_ok=gold & ~r.grow(fist, 20), rows=(430, 660), ring_w=22, band=40, feather=10)
r.back.append(('fist-out', fout))
r.front += [('fist-band', band), ('fist-in', fin)]
ref = r.H[fist & (r.A > 250) & gold][:, :3]
pump = match_limb(os.path.join(HERE, 'raw', 'pump-arm-keyed.png'), ref, scale=0.27, lift=1.0)
r.patch('arm-pump', pump)
PPIV = [round(300 * 0.27), round(865 * 0.27)]

# ---- face
mouth = r.blob((605, 355, 712, 432), thr=90)
pink = (r.R > 200) & (r.G < 160) & (r.B > 110)
mouth = ndimage.binary_fill_holes(mouth | (pink & r.grow(mouth, 10) & r.box(605, 355, 712, 440)))
eyes = [r.blob(b, thr=60) for b in ((545, 300, 652, 382), (702, 318, 800, 422))]
# his left eye touches its brow in the art: keep only the round eye (center and size from the right eye)
eyes[0] &= (r.xx - 596) ** 2 + (r.yy - 338) ** 2 < 41 ** 2
eyes[1] &= (r.xx - 745) ** 2 + (r.yy - 385) ** 2 < 41 ** 2
plain = gold & (r.A > 250) & ~r.grow(r.lum < 120, 10) & ~r.grow((r.sat < 60) & (r.lum > 200), 10)
face = ~r.grow(r.largest(((r.B > r.R + 30) | ((r.sat < 70) & (r.lum > 190))) & (r.yy < 340) & (r.A > 0), 2), 4)   # minus the headband
disc = np.zeros_like(eyes[0])
for e in r.eye_info(eyes):
    disc |= (r.xx - e['cx']) ** 2 + (r.yy - e['cy']) ** 2 < (max(e['w'], e['h']) / 2 + 15) ** 2
brow_l = r.box(560, 262, 652, 322) & (r.lum < 115) & ((r.xx - 596) ** 2 + (r.yy - 338) ** 2 > 43 ** 2) & (r.A > 200)
brow_r = r.box(700, 318, 800, 352) & (r.lum < 115) & ((r.xx - 745) ** 2 + (r.yy - 385) ** 2 > 43 ** 2) & (r.A > 200)
r.eye_patches(eyes, cover=disc & (r.A > 0), ring_ok=gold, closed=(0.46, 0.15, 0.25), kinds=('half', 'closed'), fillmode='inpaint', also=r.grow(mouth, 4), plain=plain, halo=14, limit=face, brows=dict(half=('hero', r.grow(brow_l | brow_r, 1)), closed=('hero', r.grow(brow_l | brow_r, 1))))
ink = tuple(int(v) for v in np.median(r.H[brow_l | brow_r][:, :3], 0))
info = r.eye_info(eyes)
soft = []
for e, lift in zip(info, (0.0, 0.0)):
    cx, top = e['cx'], e['cy'] - e['h'] / 2
    hw = e['w'] * 0.36
    soft.append([(cx - hw + 2 * k * hw / 8, top - 16 - 10 * np.sin(np.pi * k / 8)) for k in range(9)])
r.eye_patches(eyes, cover=r.grow(disc | brow_l | brow_r, 5) & (r.A > 0), kinds=('happy',), fillmode='inpaint',
              happy=(0.46, 0.18, 0.55), brows=dict(happy=(soft, ink, 10)), also=r.grow(mouth, 4), plain=plain, halo=14, limit=face)
r.mouth_laugh(mouth, sy=1.45, fillmode='inpaint', also=r.grow(disc | brow_l | brow_r, 5), grow=1, soft=1.2, plain=plain)

m = motion(r, 'S', 'Jog in place + fist pump',
           'Always on the move: his speed lines stream past, he breaks into a bouncing jog, then tucks his fist and '
           'pumps it overhead three times. Tap: he hops and laughs, and his brows soften.', cycle=8.0)
o = m['breath']['origin']
env = [[0, 0], [0.8, 0], [1.0, 1, 'inOut'], [3.2, 1], [3.5, 0, 'inOut']]
P0 = 4.1                     # fist pump starts
T1 = P0 + 0.15               # fist tucked
UP = T1 + 0.45               # raised arm up (ease-out-back)
DN0, DN1 = P0 + 2.0, P0 + 2.35
F0, F1 = DN1 - 0.03, DN1 + 0.5
HID, HDX, FDX = -38, -130, -115
FP = [800, 540]
m['tracks'] = dict(
    jog=dict(osc=[16, 0.36, 0.8, 1], env=env), lean=dict(osc=[1.6, 0.72, 0.8], env=env),
    lineDx=dict(kf=[[0, 0], [0.3, -46, 'out'], [0.36, 30, 'step'], [0.6, 0, 'out']], period=0.6),
    lineA=dict(kf=[[0, 1], [0.3, 0, 'in'], [0.36, 0], [0.6, 1, 'out']], period=0.6),
    fistDx=dict(kf=[[0, 0], [P0, 0], [T1, FDX, 'in'], [F0, FDX], [F1, 0, 'outBackSoft']]),
    fistInA=dict(kf=[[0, 1], [P0, 1], [P0 + 0.05, 0, 'linear'], [F1 - 0.12, 0], [F1 - 0.02, 1, 'linear']]),
    bandA=dict(kf=[[0, 1], [P0, 1], [P0 + 0.1, 0, 'inOut'], [F1 - 0.15, 0], [F1 + 0.05, 1, 'inOut']]),
    armTheta=dict(kf=[[0, HID], [T1 - 0.03, HID], [UP, 0, 'outBack'], [DN0, 0], [DN1, HID, 'in']]),
    armS=dict(kf=[[0, 0.9], [T1 - 0.03, 0.9], [UP, 1.0, 'out'], [DN0, 1.0], [DN1, 0.9, 'in']]),
    armDx=dict(kf=[[0, HDX], [T1 - 0.03, HDX], [UP - 0.1, 0, 'out'], [DN0 + 0.1, 0], [DN1, HDX, 'in']]),
    pumpDy=dict(osc=[22, 0.36, UP, 1], env=[[0, 0], [UP - 0.05, 0], [UP + 0.05, 1, 'inOut'], [UP + 1.05, 1], [UP + 1.1, 0, 'inOut']]),
    pumpRot=dict(osc=[-4, 0.36, UP, 1], env=[[0, 0], [UP - 0.05, 0], [UP + 0.05, 1, 'inOut'], [UP + 1.05, 1], [UP + 1.1, 0, 'inOut']]),
    hop=dict(osc=[8, 0.36, UP, 1], env=[[0, 0], [UP - 0.05, 0], [UP + 0.05, 1, 'inOut'], [UP + 1.05, 1], [UP + 1.1, 0, 'inOut']]),
)
m['root'] = dict(origin=o, dy=['jog', 'hop'], rot='lean')
m['layers'] = [dict(img='speed', dx='lineDx', alpha='lineA'),
               dict(img='arm-pump', at=[858, 480], pivotInImg=PPIV, rot=[38, 'armTheta', 'pumpRot'], s='armS', dx='armDx', dy='pumpDy'),
               dict(img='fist-out', dx='fistDx'),
               dict(img='base'), dict(img='fist-band', alpha='bandA'),
               dict(img='fist-in', dx='fistDx', alpha='fistInA')]
m['checkTimes'] = [4.1, 4.15, 4.2, 4.25, 4.3, 4.4, 4.5, 4.75, 4.9, 5.1, 6.0, 6.1, 6.2, 6.3, 6.45, 6.6, 6.8, 7.0]
r.write(m)
