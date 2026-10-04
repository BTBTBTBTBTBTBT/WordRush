# W wave puppet rig, cut from the CANONICAL hero art (cast/hero/w.png). Founder 10-04: animate the real approved
# pixels, never a re-drawn character. Run:  python3 docs/design/brand/animation/w-wave/rig.py
#
# Layers (all on the hero's 1024 canvas, same framing, offsets 0 unless noted in rig.json):
#   cape.png      hero cape pixels + a hidden extension under the body (cape color cloned from the nearest cape pixel),
#                 so a sway never opens a gap at the collar
#   body.png      hero minus cape and minus the hip arm; the body's right edge where the arm sat is rebuilt by
#                 continuing the hero's own edge curve and cloning the adjacent edge pixels
#   arm-rest.png  the hero's hip arm, exact pixels (shown at rest)
#   arm-wave.png  the ONLY non-hero part: a raised open hand (ChatGPT parts sheet, raw/chatgpt-parts-sheet.webp),
#                 color-matched in Lab to the hero's own arm; hidden behind the body edge at the shoulder
#   eyes-half.png / eyes-closed.png / eyes-happy.png   face patches: the real eyes squashed, or closed arcs painted
#                 in code over a face fill fitted to the ring of face pixels around each eye
#   mouth-laugh.png  the real mouth stretched open (top edge fixed) over the same fitted face fill
# Check: rest composite (cape, body, arm-rest) vs hero -> diff.png + mean abs diff in rig.json.
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, 'layers')
os.makedirs(OUT, exist_ok=True)
hero = Image.open(os.path.join(BRAND, 'cast/hero/w.png')).convert('RGBA')
H = np.asarray(hero).astype(np.float32)
A = H[..., 3]
R, G, B = H[..., 0], H[..., 1], H[..., 2]
Hh, Ww = A.shape
yy, xx = np.mgrid[0:Hh, 0:Ww]


def save(arr, name):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, name))


# ---------- cape: magenta pixels (blue not much above red, almost no green), left of the body + strip behind the legs
cand = (A > 0) & (B < 1.25 * R + 8) & (G < 40)
lab, n = ndimage.label(cand)
cape = np.zeros_like(cand)
for i in range(1, n + 1):
    m = lab == i
    if m.sum() < 300:
        continue
    cy, cx = ndimage.center_of_mass(m)
    if cx < 400:              # only the flap on the left moves; the hem strip behind the legs stays in the body layer
        cape |= m
cape = ndimage.binary_closing(cape, iterations=2) & (A > 0)
# swallow the thin anti-aliased fringe of the cape against the transparent background
fringe = ndimage.binary_dilation(cape, iterations=2) & (A > 0) & (A < 250) & ~cape
fringe &= (B < 1.4 * R + 10) & (R > G + 40)
cape |= fringe

# ---------- right body edge across the hip arm rows: continue the hero's own edge curve
def right_edge(y):
    xs = np.where(A[y, :900] > 128)[0]
    return xs.max()

ys_fit = list(range(330, 421, 6)) + list(range(642, 701, 6))
xs_fit = [right_edge(y) for y in ys_fit]
coef = np.polyfit(ys_fit, xs_fit, 3)
edge = lambda y: np.polyval(coef, y)
Y0, Y1 = 421, 641  # rows where the arm sits
rows = np.arange(Hh)[:, None]
e_rows = np.where((rows >= Y0) & (rows <= Y1), edge(rows), 1e9)
arm = (xx > e_rows - 0.5) & (A > 0) & (yy >= Y0 - 4) & (yy <= Y1 + 4) & (xx > 800)
# the fist overlaps the body edge a little: purple (blue well above red) pixels just inside the edge, connected to it
inner = (xx > e_rows - 45) & (A > 0) & (B > 1.25 * R) & (yy >= Y0 - 4) & (yy <= Y1 + 4)
lab_i, _ = ndimage.label(inner | arm)
arm_ids = set(np.unique(lab_i[arm])) - {0}
arm_in = np.isin(lab_i, list(arm_ids)) & ~arm
arm_in = ndimage.binary_dilation(arm_in, iterations=2) & (xx > e_rows - 48) & (A > 0) & (yy >= Y0 - 4) & (yy <= Y1 + 4)
arm |= arm_in

# ---------- body = hero - cape - arm, edge rebuilt with 1 px anti-aliasing and the neighbouring edge color
body = H.copy()
body[cape] = 0
body[arm] = 0
for y in range(Y0 - 4, Y1 + 5):
    ex = edge(y)
    xi = int(np.floor(ex))
    src = body[y, xi - 2, :3].copy() if body[y, xi - 2, 3] > 0 else H[y, xi - 3, :3]
    for x in range(xi - 1, xi + 2):
        cov = float(np.clip(ex - x + 0.5, 0, 1))
        if body[y, x, 3] == 0 and cov > 0:
            body[y, x, :3] = src
            body[y, x, 3] = 255 * cov
# rebuild a 40 px band inside the edge across the arm rows (the fist and its contact shadow sat there): clone the
# edge band from the rows just above and below, interpolated, blended back into the hero over the inner 10 px.
# The rest-arm layer carries the hero's own band pixels, so the rest pose is still pixel-exact.
ra, rb = Y0 - 8, Y1 + 8
band = np.zeros_like(A, bool)
for y in range(Y0 - 4, Y1 + 5):
    t = (y - ra) / (rb - ra)
    ex = edge(y)
    for x in range(int(ex - 40), int(np.floor(ex)) + 1):
        d = ex - x
        if d < 0.5:
            continue
        ca = H[ra, int(round(edge(ra) - d)), :3]
        cb = H[rb, int(round(edge(rb) - d)), :3]
        c = ca * (1 - t) + cb * t
        w = float(np.clip((40 - d) / 10, 0, 1))
        base = H[y, x, :3] if not arm[y, x] else c
        body[y, x, :3] = c * w + base * (1 - w)
        body[y, x, 3] = 255
        band[y, x] = True
save(body, 'body.png')

restarm = np.zeros_like(H)
restarm[arm | band] = H[arm | band]
save(restarm, 'arm-rest.png')

# cape layer + hidden extension under the body (cloned from the nearest cape pixel)
capeL = np.zeros_like(H)
capeL[cape] = H[cape]
# hidden extension under the body: each cape row continues to the right under the body with its own edge color,
# then a vertical blur so it reads as cloth if a sway ever shows a sliver of it
ext = np.zeros_like(A, bool)
for y in range(Hh):
    if y > 822:               # below the tile the legs start; never paint cape into a leg
        break
    xs = np.where(cape[y] & (A[y] > 200))[0]
    if len(xs) == 0:
        continue
    xr = xs.max()
    if not (A[y, xr + 1:xr + 4] >= 250).all():
        continue
    col = H[y, max(0, xr - 6):xr + 1, :3].mean(0)
    for x in range(xr + 1, min(Ww, xr + 90)):
        if A[y, x] >= 250 and not cape[y, x]:
            capeL[y, x, :3] = col; capeL[y, x, 3] = 255; ext[y, x] = True
blur = ndimage.gaussian_filter1d(capeL[..., :3], 4, axis=0)
capeL[ext, :3] = blur[ext]
save(capeL, 'cape.png')

# ---------- face patches: fit a quadratic color surface to a ring around each feature and paint over it
lum = H[..., :3].mean(2)


def blob(x0, x1, y0, y1, thr=70):
    m = np.zeros_like(A, bool)
    m[y0:y1, x0:x1] = (lum[y0:y1, x0:x1] < thr) & (A[y0:y1, x0:x1] > 200)
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


def fit_fill(mask, ring_w=10):
    """Return an RGBA patch covering `mask` with a quadratic surface fitted to the face ring around it."""
    ring = ndimage.binary_dilation(mask, iterations=ring_w) & ~ndimage.binary_dilation(mask, iterations=3)
    ys, xs = np.where(ring)
    X = np.stack([np.ones_like(xs), xs, ys, xs * xs, ys * ys, xs * ys], 1).astype(np.float64)
    patch = np.zeros_like(H)
    area = ndimage.binary_dilation(mask, iterations=3)
    py, px = np.where(area)
    Xp = np.stack([np.ones_like(px), px, py, px * px, py * py, px * py], 1).astype(np.float64)
    for c in range(3):
        k, *_ = np.linalg.lstsq(X, H[ys, xs, c].astype(np.float64), rcond=None)
        patch[py, px, c] = Xp @ k
    # feathered alpha: solid over the feature, soft 3 px edge
    d = ndimage.distance_transform_edt(~mask)
    alpha = np.clip((ring_w * 0.7 - d) / (ring_w * 0.7 - 1), 0, 1) ** 0.7
    patch[..., 3] = np.where(area, 255 * alpha, 0)
    return patch


eyeR = blob(640, 745, 300, 400)          # viewer's right eye
eyeL = blob(415, 520, 340, 445)          # viewer's left eye
# include the glossy white catch-light and the soft rim around the pupil
eyes_all = ndimage.binary_dilation(eyeR | eyeL, iterations=8) & (A > 200)
eye_fill = fit_fill(eyes_all, ring_w=22)
EYE_INK = tuple(int(v) for v in np.median(H[eyeR | eyeL][:, :3], 0))

info = {}
for nm, m in (('R', eyeR), ('L', eyeL)):
    ys, xs = np.where(m)
    info[nm] = dict(cx=float(xs.mean()), cy=float(ys.mean()), w=int(np.ptp(xs) + 1), h=int(np.ptp(ys) + 1))


def eyes_patch(kind):
    p = eye_fill.copy()
    im = Image.fromarray(np.clip(p, 0, 255).astype(np.uint8), 'RGBA')
    S = 4  # supersample the strokes
    big = Image.new('RGBA', (Ww * S, Hh * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    for nm, m in (('R', eyeR), ('L', eyeL)):
        e = info[nm]
        w, h, cx, cy = e['w'], e['h'], e['cx'], e['cy']
        lw = max(6, round(w * 0.17))
        if kind == 'closed':      # gentle downward lid line (blink)
            box = [cx - w * 0.46, cy - h * 0.30, cx + w * 0.46, cy + h * 0.22]
            d.arc([v * S for v in box], 20, 160, fill=EYE_INK + (255,), width=lw * S)
        elif kind == 'happy':     # ^ ^ arcs (laugh)
            box = [cx - w * 0.46, cy - h * 0.18, cx + w * 0.46, cy + h * 0.55]
            d.arc([v * S for v in box], 200, 340, fill=EYE_INK + (255,), width=lw * S)
    big = big.resize((Ww, Hh), Image.LANCZOS)
    im.alpha_composite(big)
    if kind == 'half':        # the real eyes squashed to 45 % height about their centers
        for nm, m in (('R', eyeR), ('L', eyeL)):
            e = info[nm]
            box = (int(e['cx'] - e['w'] * 0.75), int(e['cy'] - e['h'] * 0.75), int(e['cx'] + e['w'] * 0.75), int(e['cy'] + e['h'] * 0.75))
            src = hero.crop(box)
            mm = Image.fromarray((ndimage.binary_dilation(m, iterations=3)[box[1]:box[3], box[0]:box[2]] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))
            src.putalpha(mm)
            sq = src.resize((src.width, max(1, round(src.height * 0.45))), Image.LANCZOS)
            im.alpha_composite(sq, (box[0], int(e['cy'] - sq.height / 2)))
    return np.asarray(im).astype(np.float32)


for k in ('half', 'closed', 'happy'):
    save(eyes_patch(k), f'eyes-{k}.png')

# mouth: dark mouth + pink tongue; stretch it open 1.55x downward (top lip fixed), over a fitted face fill
mouth_dark = blob(520, 650, 365, 440)
pinkish = (R > 200) & (G < 150) & (B < 190) & (A > 200)
mz = np.zeros_like(A, bool); mz[370:450, 520:650] = True
mouth = ndimage.binary_fill_holes(mouth_dark | (pinkish & mz & ndimage.binary_dilation(mouth_dark, iterations=14)))
mouth_all = ndimage.binary_dilation(mouth, iterations=3) & (A > 200)
mfill = fit_fill(mouth_all, ring_w=12)
ys, xs = np.where(mouth_all)
box = (int(xs.min()) - 2, int(ys.min()) - 2, int(xs.max()) + 3, int(ys.max()) + 3)
src = hero.crop(box)
src.putalpha(Image.fromarray((mouth_all[box[1]:box[3], box[0]:box[2]] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)))
big = src.resize((round(src.width * 1.08), round(src.height * 1.55)), Image.LANCZOS)
mim = Image.fromarray(np.clip(mfill, 0, 255).astype(np.uint8), 'RGBA')
mim.alpha_composite(big, (box[0] - round(src.width * 0.04), box[1]))
save(np.asarray(mim).astype(np.float32), 'mouth-laugh.png')

# ---------- wave arm from the ChatGPT parts sheet, keyed, cropped, Lab color-matched to the hero's own arms
import cv2
class skc:
    rgb2lab = staticmethod(lambda x: cv2.cvtColor(x.astype(np.float32), cv2.COLOR_RGB2LAB))
    lab2rgb = staticmethod(lambda x: cv2.cvtColor(x.astype(np.float32), cv2.COLOR_LAB2RGB))
sheet = np.asarray(Image.open(os.path.join(HERE, 'raw/chatgpt-parts-sheet.webp')).convert('RGB')).astype(np.float32)
sx0, sy0, sx1, sy1 = 715, 140, 1020, 470
crop = sheet[sy0:sy1, sx0:sx1]
key = np.array([0, 255, 255], np.float32)
dk = np.sqrt(((crop - key) ** 2).sum(2))
alpha = np.clip((dk - 60) / 90, 0, 1)
# remove the cyan spill on the edges
sp = crop.copy()
spill = np.clip(np.minimum(sp[..., 1], sp[..., 2]) - sp[..., 0], 0, None) * (1 - alpha)
sp[..., 1] -= spill; sp[..., 2] -= spill
lab_arm = skc.rgb2lab(np.clip(sp / 255, 0, 1))
solid = alpha > 0.95
heroarm = arm & (A > 250)
lefist = np.zeros_like(A, bool); lefist[505:705, 195:375] = True
lefist &= (A > 250) & (B > 1.3 * R)
ref = skc.rgb2lab(np.concatenate([H[heroarm][:, :3], H[lefist][:, :3]])[None] / 255)[0]  # both of W's own arms
ref_w = os.environ.get('ARM_REF', 'hip')
if ref_w == 'hip': ref = skc.rgb2lab(H[heroarm][:, :3][None] / 255)[0]
src_px = lab_arm[solid]
for c in range(3):
    mu_s, sd_s = src_px[:, c].mean(), src_px[:, c].std() + 1e-6
    mu_r, sd_r = ref[:, c].mean(), ref[:, c].std()
    lab_arm[..., c] = (lab_arm[..., c] - mu_s) * (sd_r / sd_s) * 0.85 + mu_r + (lab_arm[..., c] - mu_s) * 0.15
rgb = np.clip(skc.lab2rgb(lab_arm) * 255, 0, 255)
armw = np.dstack([rgb, alpha * 255]).astype(np.uint8)
aim = Image.fromarray(armw, 'RGBA')
# drop specks: keep only the largest opaque component
_a = np.asarray(aim)[..., 3] > 20
_l, _n = ndimage.label(_a)
_big = _l == (1 + int(np.argmax(ndimage.sum(_a, _l, range(1, _n + 1)))))
_keep = ndimage.binary_dilation(_big, iterations=3)
_arr = np.asarray(aim).copy(); _arr[..., 3] = np.where(_keep, _arr[..., 3], 0); aim = Image.fromarray(_arr, 'RGBA')
aim = aim.crop(aim.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
SCALE = float(os.environ.get('ARM_SCALE', '1.0'))
aim = aim.resize((round(aim.width * SCALE), round(aim.height * SCALE)), Image.LANCZOS)
aim.save(os.path.join(OUT, 'arm-wave.png'))

# ---------- rest composite vs hero
comp = Image.new('RGBA', hero.size, (0, 0, 0, 0))
for nm in ('cape.png', 'body.png', 'arm-rest.png'):
    comp.alpha_composite(Image.open(os.path.join(OUT, nm)))
C = np.asarray(comp).astype(np.float32)
# compare premultiplied color so fully transparent pixels don't count
pc = C[..., :3] * C[..., 3:] / 255
ph = H[..., :3] * H[..., 3:] / 255
char = A > 0
diff = np.abs(pc - ph).mean(2)
dA = np.abs(C[..., 3] - A)
mean_rgb = float(diff[char].mean())
mean_a = float(dA[char].mean())
vis = np.clip(np.maximum(diff, dA) * 8, 0, 255).astype(np.uint8)
Image.fromarray(vis).save(os.path.join(HERE, 'diff.png'))
rig = json.load(open(os.path.join(HERE, 'rig.json'))) if os.path.exists(os.path.join(HERE, 'rig.json')) else {}
rig.update(dict(canvas=[Ww, Hh], source='cast/hero/w.png', eyes=info, armWaveSize=list(aim.size),
                restDiff=dict(meanAbsRGB=round(mean_rgb, 3), meanAbsAlpha=round(mean_a, 3), maxRGB=round(float(diff[char].max()), 1),
                              pixels=int(char.sum()), note='premultiplied, over the hero character area (alpha>0)')))
json.dump(rig, open(os.path.join(HERE, 'rig.json'), 'w'), indent=1)
print('rest diff mean RGB', mean_rgb, 'alpha', mean_a, 'arm', aim.size)
