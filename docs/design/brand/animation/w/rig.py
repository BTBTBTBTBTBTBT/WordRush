# W, polished (v2). Same cuts as the v1 pilot (../w-wave/rig.py), all from the CANONICAL hero (cast/hero/w.png),
# with two changes for the start and end of the wave (founder 10-04: "the open and close is kind of sudden"):
#   - no crossfade between two arms any more. The hip fist pulls back and tucks behind his hip (it is drawn behind
#     the body), and only then does the raised arm swing out from behind the same edge with an ease-out-back.
#     On the way down the raised arm swings back behind him and the fist slides out to his hip with a soft
#     overshoot and settle. The two are never both in view, so no paused frame shows two arms.
#   - the raised hand (the one non-hero part, ChatGPT parts sheet in ../w-wave/raw/) is matched to the hero fist's
#     hue and chroma in Lab, so it is no longer more saturated than the hero.
# Run:  python3 docs/design/brand/animation/w/rig.py
import json, os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'rig-engine'))
from engine import Rig

rig = Rig('w', HERE)
hero = rig.hero
H = rig.H
A = H[..., 3]
R, G, B = H[..., 0], H[..., 1], H[..., 2]
Hh, Ww = A.shape
yy, xx = np.mgrid[0:Hh, 0:Ww]
LAYERS = {}
LIFT = 4.0      # the raised hand catches more light than the hip fist, which is on the shadow side
CHROMA = 0.94   # a touch under the fist's chroma: lighter purples read hotter at the same chroma


def save(arr, name):
    LAYERS[name.replace('.png', '')] = arr.astype(np.float32)


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

# v2: the fist and its contact band are separate, so the fist can lift on its own while the band (body pixels with
# the fist's soft shadow) fades to the rebuilt edge underneath.
# The fist is split at the body edge: the part outside the edge is drawn BEHIND the body (so it can tuck away behind
# the hip), the part pressing on the body (plus the 2 px anti-aliased edge) stays in front.
inner = arm & (xx < e_rows + 2)
fin = np.zeros_like(H); fin[inner] = H[inner]
# the behind layer keeps the WHOLE fist, so the two overlap and a scaled-down canvas shows no seam between them
fout = np.zeros_like(H); fout[arm] = H[arm]
save(fin, 'arm-fist-in.png')
save(fout, 'arm-fist-out.png')
bandL = np.zeros_like(H)
bandL[band & ~arm] = H[band & ~arm]
save(bandL, 'arm-band.png')

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
sheet = np.asarray(Image.open(os.path.join(HERE, '..', 'w-wave', 'raw', 'chatgpt-parts-sheet.webp')).convert('RGB')).astype(np.float32)
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
# v2 match: the hero fist's own purple pixels set the target. L keeps the source shading (mean/std matched),
# hue is rotated to the fist's mean hue and chroma scaled to the fist's mean chroma (v1 left it a little hotter).
ref = skc.rgb2lab(H[heroarm & (B > 1.25 * R)][:, :3][None] / 255)[0]
src_px = lab_arm[solid]
L = lab_arm[..., 0]
lab_arm[..., 0] = (L - src_px[:, 0].mean()) * (ref[:, 0].std() / (src_px[:, 0].std() + 1e-6)) + ref[:, 0].mean() + LIFT
hs = np.arctan2(src_px[:, 2], src_px[:, 1]).mean(); hr = np.arctan2(ref[:, 2], ref[:, 1]).mean()
cs = np.hypot(src_px[:, 1], src_px[:, 2]).mean(); cr = np.hypot(ref[:, 1], ref[:, 2]).mean()
C = np.hypot(lab_arm[..., 1], lab_arm[..., 2]) * (cr / cs) * CHROMA
hh = np.arctan2(lab_arm[..., 2], lab_arm[..., 1]) + (hr - hs)
lab_arm[..., 1] = C * np.cos(hh); lab_arm[..., 2] = C * np.sin(hh)
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
LAYERS['arm-wave'] = np.asarray(aim).astype(np.float32)

# ---------- hand the pieces to the engine: structural layers (rest pose) vs patches/extras
rig.base = LAYERS['body']
rig.back = [('cape', LAYERS['cape']), ('arm-fist-out', LAYERS['arm-fist-out'])]
rig.front = [('arm-band', LAYERS['arm-band']), ('arm-fist-in', LAYERS['arm-fist-in'])]
for k in ('eyes-half', 'eyes-closed', 'eyes-happy', 'mouth-laugh', 'arm-wave'):
    rig.patches[k] = LAYERS[k]
rig.info['eyes'] = info

T0, T1 = 0.9, 1.05      # fist tucks behind the hip
UP1 = 1.5               # raised arm swings out from behind the edge (0.45 s, ease-out-back)
DN0, DN1 = 3.6, 3.98    # raised arm swings back behind him
F0, F1 = 3.95, 4.45     # fist slides back out to the hip, overshoots a little and settles
HID = 170               # raised-arm angle offset at which it is fully behind the body (with the pivot
HDX = -70               # pulled 70 px inside the edge); checked numerically: 0 pixels outside the body
FT = 60                 # fist tuck rotation (deg) about FP: 0 pixels left outside the body
FP = [760, 450]
motion = dict(
    name='W', gesture='Wave hello (twice every 6 s)', cycle=6.0, stage=dict(w=1300, h=1160, heroX=40, heroY=100),
    caption='Breathes, blinks, cape sways. The fist tucks behind his hip, then the hand swings up from behind him; the wave ends the same way in reverse with a soft settle.',
    breath=dict(origin=[530, 955], period=3.4, sy=0.012, sx=0.006),
    blink=dict(half='eyes-half', closed='eyes-closed'), laugh=['eyes-happy', 'mouth-laugh'],
    tracks=dict(
        capeSway=dict(osc=[3.5, 2.6, -0.455]),
        fistRot=dict(kf=[[0, 0], [T0, 0], [T1, FT, 'in'], [F0, FT], [F1, 0, 'outBackSoft']]),
        fistInAlpha=dict(kf=[[0, 1], [T0, 1], [T0 + 0.05, 0, 'linear'], [F1 - 0.12, 0], [F1 - 0.02, 1, 'linear']]),
        bandAlpha=dict(kf=[[0, 1], [T0, 1], [T0 + 0.1, 0, 'inOut'], [F1 - 0.15, 0], [F1 + 0.05, 1, 'inOut']]),
        armTheta=dict(kf=[[0, HID], [T1 - 0.03, HID], [UP1, 0, 'outBack'], [DN0, 0], [DN1, HID, 'in']]),
        armScale=dict(kf=[[0, 0.9], [T1 - 0.03, 0.9], [UP1, 1.15, 'out'], [DN0, 1.15], [DN1, 0.9, 'in']]),
        armDx=dict(kf=[[0, HDX], [T1 - 0.03, HDX], [T1 + 0.2, 0, 'out'], [DN0 + 0.15, 0], [DN1, HDX, 'in']]),
        armWave=dict(osc=[-25, 1.05, UP1], env=[[0, 0], [UP1 - 0.05, 0], [UP1 + 0.2, 1, 'inOut'], [DN0 - 0.25, 1], [DN0, 0, 'inOut']]),
    ),
    layers=[
        dict(img='cape', pivot=[330, 470], rot='capeSway', ripple=dict(top=430, hem=905, amp=6, period=1.8)),
        dict(img='arm-wave', at=[858, 520], pivotInImg=[60, 245], rot=[10, 'armTheta', 'armWave'], s='armScale', dx='armDx'),
        dict(img='arm-fist-out', pivot=FP, rot='fistRot'),
        dict(img='base'),
        dict(img='arm-band', alpha='bandAlpha'),
        dict(img='arm-fist-in', pivot=FP, rot='fistRot', alpha='fistInAlpha'),
    ],
    checkTimes=[0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.3, 1.4, 1.5, 3.6, 3.7, 3.8, 3.9, 3.98, 4.1, 4.25, 4.42],
)
rig.write(motion)
