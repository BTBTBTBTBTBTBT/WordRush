# O (pink, heart sunglasses): she opens her winking eye, looks, then re-winks with a sassy tilt and bob.
# The open right eye is a code clone of her own open left eye (her pixels, moved, not redrawn).
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
m = motion(r, 'O (pink)', 'Wink', 'Every 6 s she opens her winking eye for a look around, then snaps the wink back with a sassy tilt and a bob. Tap: she hops and laughs.')
m['tracks'] = dict(open=dict(kf=[[0, 0], [1.0, 0], [1.08, 1, 'linear'], [2.4, 1], [2.46, 0, 'linear']]),
                   tilt=dict(kf=[[0, 0], [2.35, 0], [2.55, -3.5, 'out'], [3.2, -3.5], [3.7, 0, 'sine']]),
                   bob=dict(kf=[[0, 0], [2.4, 0], [2.55, -16, 'out'], [2.75, 0, 'in'], [2.85, -4, 'out'], [2.95, 0, 'in']]))
m['root'] = dict(rot='tilt', dy='bob')
m['layers'] = [dict(img='base'), dict(img='eye-open', alpha='open', when='nolaugh')]
r.write(m)
