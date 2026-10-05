# O (pink, heart sunglasses): she opens her winking eye, looks, then re-winks with a sassy tilt and bob.
# The open right eye is a code clone of her own open left eye (her pixels, moved, not redrawn).
# 10-05: the SUNGLASSES BOB. Her frames are the same pink as her head, so they can't be cut by color. A ChatGPT
# drawing of the pair (raw/) gives the SHAPE only: each heart is registered onto her real lenses (centroid,
# lens-area scale, the pair's tilt), its outline becomes the cut mask, and the moving layer is her own hero pixels.
# The head under the frames is inpainted from her own pink.
import cv2
import os, sys
import numpy as np
from scipy import ndimage
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "rig-engine"))
from engine import Rig, motion

r = Rig('o2', HERE)
pinkb = (r.R > 200) & (r.G < 120) & (r.B > 80) & (r.B < 200) & (r.A > 240)
eyeL = r.blob((318, 343, 420, 447), thr=70)
eyeL_full = ndimage.binary_fill_holes(r.grow(eyeL, 2) | (r.grow(eyeL, 9) & (r.lum > 190)))
wink = r.blob((510, 290, 625, 385), thr=70)
r.eye_patches([eyeL_full], cover=r.grow(eyeL_full, 6) & (r.A > 200), ring_ok=pinkb)
# open-eye patch over the wink
cover = r.grow(wink, 7) & (r.A > 200)
fill = r.surface(cover, ring_w=16, ring_ok=pinkb)
im = Image.fromarray(np.clip(fill, 0, 255).astype(np.uint8), 'RGBA')
ys, xs = np.where(r.grow(eyeL_full, 3)); bx = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
src = r.hero.crop(bx); src.putalpha(Image.fromarray((r.grow(eyeL_full, 3)[bx[1]:bx[3], bx[0]:bx[2]] * 255).astype(np.uint8)))
wy, wx = np.where(wink)
im.alpha_composite(src, (int(wx.mean() - (bx[2] - bx[0]) / 2), int(wy.mean() - (bx[3] - bx[1]) / 2 + 8)))
r.patch('eye-open', np.asarray(im).astype(np.float32))
mouth = r.blob((420, 375, 535, 455), thr=80)
mouth = ndimage.binary_fill_holes(mouth | (r.grow(mouth, 10) & (r.R > 200) & (r.G > 80) & (r.lum > 120) & ~pinkb))
r.mouth_laugh(mouth, sy=1.4, ring_ok=pinkb)
# ---- sunglasses: register the ChatGPT pair's hearts onto her lenses, cut her own pixels with that outline
def lenses(R, G, B, A, ymax=None):
    m = (R < 170) & (G < 90) & (B > 50) & (A > 200)
    if ymax is not None:
        m &= np.arange(m.shape[0])[:, None] < ymax
    lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1)); k = np.argsort(sz)[::-1][:2] + 1
    out = [(lab == i) for i in k]
    return sorted(out, key=lambda q: np.where(q)[1].mean())
hl = lenses(r.R, r.G, r.B, r.A, 330)
g = np.asarray(Image.open(os.path.join(HERE, 'raw', 'glasses-keyed.png')).convert('RGBA')).astype(np.float32)
gl = lenses(g[..., 0], g[..., 1], g[..., 2], g[..., 3])
c_h = [np.array(ndimage.center_of_mass(q))[::-1] for q in hl]
c_g = [np.array(ndimage.center_of_mass(q))[::-1] for q in gl]
ang = np.degrees(np.arctan2(*(c_h[1] - c_h[0])[::-1]) - np.arctan2(*(c_g[1] - c_g[0])[::-1]))
split = (c_g[0][0] + c_g[1][0]) / 2
mask = np.zeros_like(r.A, bool)
for i in range(2):
    s_i = np.sqrt(hl[i].sum() / gl[i].sum())
    M = cv2.getRotationMatrix2D(tuple(map(float, c_g[i])), -ang, s_i)
    M[:, 2] += c_h[i] - c_g[i]
    half = g[..., 3].copy()
    half[:, int(split):] = 0 if i == 0 else half[:, int(split):]
    if i == 1:
        half[:, :int(split)] = 0
    w = cv2.warpAffine(half, M, (r.w, r.h), flags=cv2.INTER_LINEAR)
    mask |= w > 110
mask = ndimage.binary_fill_holes(mask)
# bridge between the hearts: her own pink pixels on the line between the two frames
bridge = r.poly([tuple(c_h[0] + [60, -40]), tuple(c_h[1] + [-60, -30]), tuple(c_h[1] + [-60, 30]), tuple(c_h[0] + [60, 20])])
mask |= bridge & r.grow(mask, 18) & (r.yy < 260) & (r.A > 0)
glasses = mask & (r.A > 0) & (r.yy < 340)
glasses = r.grow(glasses, 1) & (r.A > 0) & (r.yy < 340)
r.info['glasses'] = dict(rotation=round(float(ang), 2), lensCenters=[list(map(float, c)) for c in c_h])
r.cut('glasses', glasses, fill='inpaint', radius=12)
gy, gx = np.where(glasses)
GPIV = [int(gx.mean()), int(gy.max())]

m = motion(r, 'O (pink)', 'Wink + sunglasses bob', 'Every 6 s she opens her winking eye for a look around (her sunglasses hop), then snaps the wink back with a sassy tilt; the glasses lift and land a beat after her head. Tap: she hops and laughs.')
m['tracks'] = dict(open=dict(kf=[[0, 0], [1.0, 0], [1.08, 1, 'linear'], [2.4, 1], [2.46, 0, 'linear']]),
                   tilt=dict(kf=[[0, 0], [2.35, 0], [2.55, -3.5, 'out'], [3.2, -3.5], [3.7, 0, 'sine']]),
                   bob=dict(kf=[[0, 0], [2.4, 0], [2.55, -16, 'out'], [2.75, 0, 'in'], [2.85, -4, 'out'], [2.95, 0, 'in']]),
                   # the glasses lag the head: they lift on her bob, land a beat later with a tiny bounce, and do a
                   # little double hop of their own when she opens her eye for a look
                   glassDy=dict(kf=[[0, 0], [1.0, 0], [1.1, -10, 'out'], [1.22, 0, 'in'], [1.3, -4, 'out'], [1.38, 0, 'in'],
                                    [2.45, 0], [2.62, -14, 'out'], [2.86, 0, 'in'], [2.95, -3, 'out'], [3.03, 0, 'in']]),
                   glassRot=dict(kf=[[0, 0], [1.0, 0], [1.1, 2.5, 'out'], [1.38, 0, 'inOut'], [2.45, 0], [2.62, -3, 'out'], [3.03, 0, 'inOut']]))
m['root'] = dict(rot='tilt', dy='bob')
m['layers'] = [dict(img='base'), dict(img='eye-open', alpha='open', when='nolaugh'),
               dict(img='glasses', pivot=GPIV, dy='glassDy', rot='glassRot')]
m['patchAfter'] = 'eye-open'
r.write(m)
