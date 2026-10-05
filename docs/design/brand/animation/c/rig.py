# C (teal): happy wiggle; laugh = ^ ^ eyes + his C mouth stretched open (the teeth part). All hero pixels.
# 10-05: the closed and ^ ^ eyes sit on an inpainted fill (with the eye glow faded in), so no eye "socket" ghost
# shows, and the C's top-right is protected. The laugh reads more: the C stretches further (1.24x) and the opening
# of the C between his teeth gets a mouth interior painted in his own pupil ink with a little tongue.
import os, sys
import numpy as np
import cv2
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFilter
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
letter = r.largest(r.box(370, 400, 770, 830) & (r.lum > 185) & (r.A > 200) & ~r.grow(eyes[0] | eyes[1], 6), 3)
letter = ndimage.binary_fill_holes(r.grow(letter, 1)) & (r.A > 0)
face = ~r.grow(letter, 3)
ink = tuple(int(v) for v in np.median(r.H[pupils[0] | pupils[1]][:, :3], 0))
r.eye_patches(eyes, cover=r.grow(eyes[0] | eyes[1], 6) & (r.A > 200), ring_ok=teal, ring_w=18, closed=(0.44, 0.10, 0.18),
              happy=(0.44, 0.05, 0.6), fillmode='inpaint', halo=14, limit=face, also=letter)
r.mouth_laugh(r.grow(letter, 1), sy=1.24, sx=1.0, fillmode='inpaint', halo=10, limit=None, also=r.grow(eyes[0] | eyes[1], 6))

# mouth interior in the opening of the stretched C (between the teeth), under the letter
P = r.patches['mouth-laugh']
L2 = (P[..., 3] > 200) & (P[..., :3].mean(2) > 200)
W2 = L2 & r.box(300, 380, 900, 900)          # letter + teeth
L2 = r.largest(L2)
hull = np.zeros_like(r.A, np.uint8)
ys, xs = np.where(L2)
cv2.fillPoly(hull, [cv2.convexHull(np.stack([xs, ys], 1).astype(np.int32))], 1)
bowl = r.largest((hull > 0) & ~r.grow(L2, 1))
bowl &= ~r.grow(W2, 1)
bowl = ndimage.binary_opening(bowl, iterations=3)
dist = ndimage.distance_transform_edt(bowl)
a = np.clip(dist / 4, 0, 1) * 0.88
cav = np.array(ink, np.float32) * 0.9 + np.array([30, 10, 30], np.float32) * 0.1
by, bx = np.where(bowl)
col = np.zeros_like(r.H[..., :3]); col[...] = cav
# a soft pink tongue low in the opening
tg = Image.new('L', (r.w, r.h), 0)
cx, cy = bx.mean(), np.percentile(by, 82)
tw, th = (bx.max() - bx.min()) * 0.32, (by.max() - by.min()) * 0.16
ImageDraw.Draw(tg).ellipse([cx - tw, cy - th, cx + tw, cy + th * 1.6], fill=255)
tgm = (np.asarray(tg.filter(ImageFilter.GaussianBlur(2))) / 255.0) * np.clip(dist / 6, 0, 1)
col = col * (1 - tgm[..., None]) + np.array([232, 102, 140], np.float32) * tgm[..., None]
out = P.copy()
out[..., :3] = np.where(bowl[..., None], col * a[..., None] + P[..., :3] * (1 - a[..., None]), P[..., :3])
out[..., 3] = np.where(bowl, np.maximum(P[..., 3], 255 * a), P[..., 3])
# the letter (teeth) stays on top: re-composite the stretched letter pixels
out[W2] = P[W2]
r.patch('mouth-laugh', out)
r.info['laughBowlPx'] = int(bowl.sum())

m = motion(r, 'C', 'Happy wiggle', 'Rocks side to side on his feet with a little squash, then settles. Tap: ^ ^ eyes and his C mouth stretches open so the teeth part, showing his mouth and tongue.')
o = m['breath']['origin']
env = [[0, 0], [1.0, 0], [1.25, 1, 'inOut'], [2.5, 1], [2.9, 0, 'inOut']]
m['tracks'] = dict(wig=dict(osc=[4.5, 0.55, 1.0], env=env), bob=dict(osc=[-12, 0.275, 1.0, 1], env=env))
m['root'] = dict(origin=o, rot='wig', dy='bob')
r.write(m)
