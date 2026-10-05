"""Integration rig (10-04): the body-aware compositor behind INTEGRATION.md.

Everything is drawn in the body square (U px, the same body units as avatar-parts.json) on a canvas with a
margin, in this order:

    back      pack bodies, cape bodies, tails, wings: clipped OUTSIDE the body silhouette, with ambient
              occlusion where they disappear behind the body (the body shades them)
    body      the shipped white body art, multiplied by the body color
    letter    the white initial (letterBox)
    face      eyes / mouth from parts/ at the manifest slots
    front     straps, wraps, held items: masked off the face + letter (never covers them), contact shadow
              baked onto the body under them, light matched to the body's top-left gloss
    handover  the body's own hands, cut from the body art and drawn again ON TOP, so straps tuck under the
              arms and held items are gripped

Body rig measured from the art (no new hand data needed): torso = morphological opening of the body alpha,
arms = what the opening removes in the hand band; hand center = the arm blob's centroid.
"""
import json, math, os
from functools import lru_cache
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
AV = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(AV, '..', '..', '..', '..'))
PARTS = os.path.join(AV, 'parts')
MAN = json.load(open(os.path.join(REPO, 'packages', 'core', 'src', 'avatar-parts.json')))
U = 640                 # body square px
M = int(U * 0.5)        # margin around the body square
CW = U + 2 * M
FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
COLORS = {'purple': '#7c3aed', 'teal': '#0d9488', 'amber': '#f5a524', 'pink': '#ec4899', 'sky': '#0ea5e9',
          'green': '#22c55e', 'orange': '#f97316', 'red': '#ef4444', 'slate': '#64748b', 'blue': '#2563eb',
          'mint': '#86efac', 'lilac': '#c4b5fd', 'navy': '#1e3a8a', 'yellow': '#eab308', 'white': '#f8fafc',
          'cream': '#fef3c7', 'chocolate': '#78350f', 'charcoal': '#374151', 'gold': '#f5b82e'}
LIGHT = (-0.55, -0.83)  # light comes from the top-left (the body gloss); shadows fall down-right


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def P(v):
    """body units → canvas px"""
    return M + v * U


def load(path):
    return Image.open(path).convert('RGBA')


def trim(im, t=12):
    bb = im.getchannel('A').point(lambda v: 255 if v > t else 0).getbbox()
    return im.crop(bb) if bb else im


@lru_cache(None)
def body_art(body):
    im = load(os.path.join(PARTS, f'art-av-body-{body}.png')).resize((U, U), Image.LANCZOS)
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    c.alpha_composite(im, (M, M))
    return c


def _sym(cx, cy, rx=0.075, ry=0.11):
    return {'L': (cx, cy, rx, ry), 'R': (1 - cx, cy, rx, ry)}


HANDS = {   # (center x, center y, radius x, radius y) in body units; L/R = the viewer's left/right
    'classic': _sym(0.09, 0.575), 'tall': _sym(0.275, 0.59, 0.08, 0.12), 'wide': _sym(0.09, 0.645, 0.075, 0.105),
    'blob': _sym(0.095, 0.60, 0.08), 'star': _sym(0.125, 0.595, 0.075, 0.105), 'drop': _sym(0.17, 0.605, 0.078, 0.105),
    'pear': _sym(0.18, 0.605, 0.078, 0.105), 'cloud': _sym(0.10, 0.645, 0.075, 0.105), 'chunky': _sym(0.09, 0.56),
    'mini': _sym(0.225, 0.69, 0.08), 'hex': _sym(0.09, 0.61),
    'bean': {'L': (0.225, 0.51, 0.08, 0.11), 'R': (0.735, 0.535, 0.068, 0.105)},
}


@lru_cache(None)
def rig(body):
    """Silhouette, torso, arm masks (canvas px) and hand centers for a body."""
    b = MAN['bodies'][body]
    A = np.asarray(body_art(body).getchannel('A')) > 128
    ys = np.nonzero(A.any(1))[0]
    top, bot = ys.min(), ys.max()
    H = bot - top
    feet_y = bot - H * (0.09 if body == 'star' else 0.115)
    # hands: per-body ellipses measured off the body art (body units) — the hand-over layer
    yy, xx = np.mgrid[0:CW, 0:CW]
    arms = {}
    for side, (cx, cy, rx, ry) in HANDS[body].items():
        e = ((xx - P(cx)) / (rx * U)) ** 2 + ((yy - P(cy)) / (ry * U)) ** 2 <= 1
        arms[side] = dict(mask=e & A, c=(P(cx), P(cy)), rx=rx, ry=ry, cu=(cx, cy))
    torso = A
    # silhouette spans
    def span(y):
        row = np.nonzero(A[int(y)])[0]
        return (row.min(), row.max()) if len(row) else (CW / 2, CW / 2)

    def tspan(y):
        row = np.nonzero(torso[int(y)])[0]
        return (row.min(), row.max()) if len(row) else span(y)
    return dict(A=A, torso=torso, arms=arms, top=top, bot=bot, feet_y=feet_y, span=span, tspan=tspan, b=b)


def tint(im, color, keep_white=False):
    rgb = hexrgb(COLORS.get(color, color))
    m = ImageChops.multiply(im.convert('RGB'), Image.new('RGB', im.size, rgb)).convert('RGBA')
    m.putalpha(im.getchannel('A'))
    return m


def slot_point(b, slot):
    if slot in ('eyes', 'glasses', 'nose', 'cheeks'):
        y = b['eyeY'] if slot in ('eyes', 'glasses') else b['cheekY']
        return b['face']['x'], y, b['face']['w']
    if slot == 'mouth':
        return b['face']['x'], b['mouthY'], b['face']['w']
    if slot == 'mustache':
        return b['face']['x'], b['mustacheY'], b['face']['w']
    if slot == 'head':
        return b['headTop']['x'], b['headTop']['y'], b['headTop']['w']
    if slot == 'neck':
        return b['face']['x'], b['neckY'], b['shoulderW']
    if slot == 'cape':
        return b['back']['x'], b['cape']['y'], b['back']['w']
    return b['back']['x'], b['back']['y'], b['back']['w']


def place_part(canvas, key, b):
    """Draw a shipped part exactly like the core layout (anchor at the slot point)."""
    kind, pid = key.split(':')
    m = MAN['items'][key]
    x, y, base = slot_point(b, m['slot'])
    w = base * m['w']
    h = w * m['aspect']
    im = load(os.path.join(PARTS, f'art-av-{kind}-{pid}.png')).resize((max(1, round(w * U)), max(1, round(h * U))), Image.LANCZOS)
    canvas.alpha_composite(im, (round(P(x - m['anchor'][0] * w)), round(P(y - m['anchor'][1] * h))))
    return im


def face_letter_mask(body, eyes='beady', mouth='smile', letter='A', pad=0.012):
    """Pixels that must never be covered: the eyes, the mouth and the letter (dilated by pad)."""
    b = MAN['bodies'][body]
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    place_part(c, f'eyes:{eyes}', b)
    place_part(c, f'mouth:{mouth}', b)
    draw_letter(c, b, letter, fill=(255, 255, 255, 255))
    m = np.asarray(c.getchannel('A')) > 40
    return ndimage.binary_dilation(m, iterations=max(1, int(pad * U)))


def draw_letter(c, b, letter, fill='white'):
    lx, ly, lw, lh = b['letterBox']
    f = ImageFont.truetype(FONT, max(6, int(lh * U * 1.05)))
    ImageDraw.Draw(c).text((P(lx + lw / 2), P(ly + lh / 2)), letter, font=f, fill=fill, anchor='mm')


def soft(mask, r):
    im = Image.fromarray((mask.astype(np.uint8) * 255) if mask.dtype == bool else mask)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def shade(im, mul):
    """multiply an RGBA image's RGB by a float map (alpha kept)."""
    a = np.asarray(im).astype(np.float32)
    a[..., :3] *= mul[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def light_match(im, strength=0.10):
    """Re-light a piece to the body's gloss: brighter toward the top-left, darker bottom-right."""
    a = np.asarray(im).astype(np.float32)
    al = a[..., 3] > 10
    if not al.any():
        return im
    ys, xs = np.nonzero(al)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    t = ((xx - x0) / max(1, x1 - x0) * 0.4 + (yy - y0) / max(1, y1 - y0) * 0.6)
    mul = 1 + strength * (0.5 - t) * 2
    a[..., :3] = np.clip(a[..., :3] * mul[..., None], 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def contact_shadow(body_layer_alpha, piece_alpha, strength=0.38, blur=0.012, off=0.012):
    """A soft shadow map (0..1 darkening) the piece casts on the body: blurred, nudged down-right."""
    sh = np.roll(np.roll(piece_alpha.astype(np.float32), int(off * U * -LIGHT[1]), 0), int(off * U * -LIGHT[0]), 1)
    sh = soft((sh * 255).astype(np.uint8), blur * U)
    return np.clip(sh * strength, 0, 1) * body_layer_alpha


def back_ao(piece, A, strength=0.55, reach=0.05):
    """Clip a back piece to outside the body and darken it where it disappears behind the body."""
    dist = ndimage.distance_transform_edt(~A) / U
    occl = 1 - strength * np.exp(-dist / reach)
    p = shade(piece, occl * 0.94)
    a = np.asarray(p).copy()
    a[..., 3] = np.where(A, 0, a[..., 3])
    return Image.fromarray(a, 'RGBA')


def place(im, cx, cy, w, anchor=(0.5, 0.5), rot=0):
    """A canvas-sized layer with `im` scaled to width w (body units), anchor at (cx, cy) body units."""
    s = w * U / im.width
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    big = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    px, py = P(cx) - anchor[0] * im.width, P(cy) - anchor[1] * im.height
    if rot:
        pad = Image.new('RGBA', (im.width * 3, im.height * 3), (0, 0, 0, 0))
        pad.alpha_composite(im, (im.width, im.height))
        piv = (im.width + anchor[0] * im.width, im.height + anchor[1] * im.height)
        pad = pad.rotate(rot, Image.BICUBIC, center=piv)
        _clip_paste(big, pad, round(px - im.width), round(py - im.height))
    else:
        _clip_paste(big, im, round(px), round(py))
    return big


def _clip_paste(dst, src, x, y):
    cx, cy = max(0, -x), max(0, -y)
    src = src.crop((cx, cy, min(src.width, CW - x), min(src.height, CW - y)))
    if src.width > 0 and src.height > 0:
        dst.alpha_composite(src, (max(0, x), max(0, y)))


def alpha(im):
    return np.asarray(im.getchannel('A')).astype(np.float32) / 255


def mask_out(im, keep):
    a = np.asarray(im).copy()
    a[..., 3] = (a[..., 3].astype(np.float32) * keep).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def compose(body, color='purple', letter='A', eyes='beady', mouth='smile', back=(), front=(), held=(),
            head=None, handover=('L', 'R'), shadows=True, extra_face=()):
    """Compose a mascot with integrated layers. back/front/held: canvas-sized RGBA layers (from place())."""
    R = rig(body)
    b = R['b']
    A = R['A']
    out = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    for L in back:
        out.alpha_composite(back_ao(L, A))
    bt = tint(body_art(body), color)
    # contact shadows of front + held pieces onto the body
    if shadows and (front or held):
        darken = np.zeros((CW, CW), np.float32)
        Af = A.astype(np.float32)
        for L in list(front) + list(held):
            darken = np.maximum(darken, contact_shadow(Af, alpha(L)))
        bt = shade(bt, 1 - darken)
    out.alpha_composite(bt)
    draw_letter(out, b, letter)
    place_part(out, f'eyes:{eyes}', b)
    place_part(out, f'mouth:{mouth}', b)
    for k in extra_face:
        place_part(out, k, b)
    guard = face_letter_mask(body, eyes, mouth, letter)
    for L in front:
        out.alpha_composite(mask_out(L, 1 - guard))
    for L in held:
        out.alpha_composite(L)
    if handover and (held or front):
        hb = bt.copy()
        hm = np.zeros((CW, CW), np.float32)
        for s in handover:
            if s in R['arms']:
                hm = np.maximum(hm, soft(R['arms'][s]['mask'], 1.2) * R['arms'][s]['mask'])
        out.alpha_composite(mask_out(hb, hm))
    if head is not None:
        out.alpha_composite(head)
    return out


def tile(img, size=260, pad=0.06, bg=None):
    bb = img.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    crop = img.crop(bb)
    side = max(crop.width, crop.height) / (1 - 2 * pad)
    sq = Image.new('RGBA', (round(side), round(side)), (0, 0, 0, 0))
    sq.alpha_composite(crop, (round((side - crop.width) / 2), round((side - crop.height) / 2)))
    sq = sq.resize((size, size), Image.LANCZOS)
    if bg:
        t = Image.new('RGBA', (size, size), bg)
        t.alpha_composite(sq)
        return t
    return sq
