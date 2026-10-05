#!/usr/bin/env python3
"""Halloween cast header, rebuilt by LAYERING (10-04). The shipped header (cast/halloween/<id>.png, the 10-02
ChatGPT redraws) drifted off-model (C's mouth under the letter, amber O with two arms, I without his sprout...).

Here every figure IS the canonical header art (cast/app/<id>.png); only the costume is added. The costume comes
from the approved night-1 costume art (seasons/halloween/cast/<id>.png):

  1. align the night-1 figure to the hero (body-color masks, bbox fit + a small IoU search);
  2. costume pixels = night-1 pixels that are NOT body-colored and differ from the hero (or lie outside it);
  3. protect the hero's own features: every non-body-colored hero pixel (eyes, mouth, teeth, letter, glasses,
     pencil, sprout, nightcap, headband, pom-poms) is never covered, so a hat sits UNDER the sprout or the heart
     sunglasses, and nothing touches the face or letter;
  4. per-character keep-regions (a hat above the head line, a cape only outside the body = behind it, bandages
     only on the arms, legs and edges...), small fragments dropped, edges feathered;
  5. face-region score: mean RGB difference vs the hero over the eyes/mouth/letter box (same box as
     layer-costume.py; 0 = untouched), logged in header.json.

  python3 build-header.py   → <id>.png, strip-normal.png, strip-halloween.png, compare.png, header.json
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(BRAND, 'seasons'))
import importlib.util
spec = importlib.util.spec_from_file_location('lc', os.path.join(BRAND, 'seasons', 'layer-costume.py'))
lc = importlib.util.module_from_spec(spec); spec.loader.exec_module(lc)
CAST = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
S = 1400      # working canvas: the 1024 art padded so tall hats don't clip
PADC = (1400 - 1024) // 2


def lab(rgb):
    """sRGB uint8 (..., 3) → CIE Lab float."""
    c = rgb.astype(np.float32) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], np.float32)
    xyz = c @ M.T / np.array([0.9505, 1.0, 1.089], np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def body_model(L, sil):
    """Body color model from the hero: median chroma + L range of the dominant color cluster."""
    ab = L[..., 1:][sil]
    med = np.median(ab, 0)
    d = np.linalg.norm(ab - med, axis=1)
    core = d < np.percentile(d, 60)
    Ls = L[..., 0][sil][core]
    return med, np.percentile(Ls, 1) - 12, np.percentile(Ls, 99.5) + 4, max(10.0, float(np.percentile(d[core], 95)) * 1.6)


def bodylike(L, model):
    med, lo, hi, tc = model
    return (np.linalg.norm(L[..., 1:] - med, axis=-1) < tc) & (L[..., 0] > lo) & (L[..., 0] < hi)


def align(hero_body, cos_body):
    """Scale + translate the costume art so its body mask lands on the hero's."""
    def bb(m):
        ys, xs = np.nonzero(m)
        return xs.min(), ys.min(), xs.max(), ys.max()
    hx0, hy0, hx1, hy1 = bb(hero_body)
    cx0, cy0, cx1, cy1 = bb(cos_body)
    s0 = ((hy1 - hy0) / (cy1 - cy0) + (hx1 - hx0) / (cx1 - cx0)) / 2
    best = None
    small_h = hero_body[::4, ::4]
    for s in s0 * np.array([0.94, 0.97, 1.0, 1.03, 1.06]):
        for dx in range(-24, 25, 8):
            for dy in range(-24, 25, 8):
                tx = (hx0 + hx1) / 2 - s * (cx0 + cx1) / 2 + dx
                ty = (hy0 + hy1) / 2 - s * (cy0 + cy1) / 2 + dy
                m = warp(cos_body.astype(np.uint8) * 255, s, tx, ty)[::4, ::4] > 127
                iou = (m & small_h).sum() / max(1, (m | small_h).sum())
                if best is None or iou > best[0]:
                    best = (iou, s, tx, ty)
    return best


def warp(a, s, tx, ty):
    im = Image.fromarray(a)
    return np.asarray(im.transform((S, S), Image.AFFINE, (1 / s, 0, -tx / s, 0, 1 / s, -ty / s), Image.BICUBIC))


# keep-regions per character, in hero-geometry terms:
#   above   rows above the head line + `a` head widths (hats, antennae, stems)
#   behind  pixels outside the hero silhouette (capes, wings, sheets, collars): drawn BEHIND the hero
#   ring    inside the silhouette but off the face/letter box (bandages, bones, cuffs)
#   low     inside, below the letter box (skirt hems, boots)
#   neck    a small box between the mouth and the letter (clasps, gems)
SPEC = {
    'w': dict(keep=['behind', 'neck', 'above'], caption='Vampire: black cape with red lining and stand-up collar BEHIND him, a red gem clasp at the neck.'),
    'o1': dict(mode='box', keep=[], caption='Pumpkin: green stem + curly vine on top of his head; his own purple pom-poms and four arms untouched.'),
    'r': dict(mode='box', keep=[], caption='Ghost: the sheet drapes around him from behind; his nightcap and sleepy face stay on top.'),
    'd': dict(mode='box', keep=[], caption='Wizard: starry hat with a gold band, starry robe behind him; glasses, pencil and face untouched.'),
    'o2': dict(mode='box', keep=[], caption='Witch: black witch hat UNDER her heart sunglasses, purple-lined cape behind her.'),
    'c': dict(mode='box', keep=[], caption='Space explorer: antennae headband with glowing green bulbs; the C mouth and snaggleteeth untouched.'),
    'i': dict(mode='box', keep=[], caption='Scarecrow: patched straw hat with his sprout poking through it.'),
    'o3': dict(mode='box', keep=[], caption='Mummy: the night-1 bandages fitted onto the canonical O, clipped to his body; the cyclops eye and tongue untouched.'),
    'u': dict(mode='piece', pieces=['behind'], keep=[], caption='Fairy: translucent wings behind him (from the night-1 art); still floating cross-legged, eyes closed.'),
    's': dict(mode='layered', keep=[], layers=[dict(piece='cat-ears-pink', z='behind', anchor='top', w=1.0, dx=0.0, dy=0.5),
                                              dict(piece='cat-tail', z='behind', anchor='center', w=0.42, dx=-0.62, dy=0.12, rot=18)],
              caption='Black cat (the approved layered alternate, swapped in for the skeleton: a bone suit has to cover his body, which breaks the face/letter rule): cat-ear headband above his own headband, curly tail with an orange bow.'),
}


def refine_model(model, L, alpha_mask):
    """The redraw's body color drifts from the hero's: re-center the model on the redraw's own body pixels."""
    med, lo, hi, tc = model
    near = (np.linalg.norm(L[..., 1:] - med, axis=-1) < tc * 2.2) & alpha_mask
    if near.sum() < 2000:
        return model
    ab = L[..., 1:][near]
    med2 = np.median(ab, 0)
    d = np.linalg.norm(ab - med2, axis=1)
    core = d < np.percentile(d, 70)
    Ls = L[..., 0][near][core]
    return med2, np.percentile(Ls, 1) - 12, np.percentile(Ls, 99.5) + 4, max(10.0, float(np.percentile(d[core], 95)) * 1.6)


def body_sil(L, model, a):
    cb = bodylike(L, model) & a
    cb = ndimage.binary_opening(cb, iterations=2)
    lab_, n = ndimage.label(cb)
    if n:
        sizes = ndimage.sum(cb, lab_, range(1, n + 1))
        cb = lab_ == (1 + int(np.argmax(sizes)))
    return ndimage.binary_fill_holes(ndimage.binary_closing(np.pad(cb, 12), iterations=10))[12:-12, 12:-12]


def night1_pieces(C, model, regions_wanted, hero_sil, hsil_f):
    """Costume pieces cut from the night-1 art in its OWN frame (its body silhouette), then re-anchored on the
    hero: scaled by body height, hats by the body top-center, capes/wings/sheets by the body center."""
    CL = lab(C[..., :3])
    ca = C[..., 3] > 100
    m1 = refine_model(model, CL, ca)
    sil = body_sil(CL, m1, ca)
    cos = ca & ~bodylike(CL, m1)
    def box(m):
        ys, xs = np.nonzero(m)
        return xs.min(), ys.min(), xs.max(), ys.max()
    nx0, ny0, nx1, ny1 = box(sil)
    hx0, hy0, hx1, hy1 = box(hero_sil)
    sc = ((hy1 - hy0) / (ny1 - ny0) + (hx1 - hx0) / (nx1 - nx0)) / 2
    yy, xx = np.mgrid[0:S, 0:S]
    out = []
    for reg in regions_wanted:
        if reg == 'above':
            m = cos & (yy < ny0 + (ny1 - ny0) * 0.16)
            src, dst = ((nx0 + nx1) / 2, ny0), ((hx0 + hx1) / 2, hy0)
        elif reg == 'behind':
            m = cos & ~ndimage.binary_dilation(sil, iterations=4)
            src, dst = ((nx0 + nx1) / 2, (ny0 + ny1) / 2), ((hx0 + hx1) / 2, (hy0 + hy1) / 2)
        else:
            continue
        m = ndimage.binary_opening(m, iterations=2)
        lab2, n2 = ndimage.label(m)
        if n2:
            sz = ndimage.sum(m, lab2, range(1, n2 + 1))
            m = np.isin(lab2, 1 + np.nonzero(sz >= 300)[0])
        P = C.copy()
        soft = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255
        P[..., 3] = (C[..., 3] * soft).astype(np.uint8)
        tx, ty = dst[0] - src[0] * sc, dst[1] - src[1] * sc
        layer = np.stack([warp(np.ascontiguousarray(P[..., k]), sc, tx, ty) for k in range(4)], -1)
        out.append((reg, layer))
    return out


# Pieces cut from the night-1 art by box (300-px tile coords of the 1024 art), costume pixels only (the body
# color keyed out), then placed like layer-costume.py: 'top' = bottom-center on the hero's head line, width w x
# head width, dy in head widths (+ = down, i.e. overlap); 'fit' = the night-1 figure's bbox mapped onto the
# hero's bbox (form-fitting wraps), clipped to the hero's silhouette.
BOX = {
    'o1': [dict(box=(135, 38, 210, 88), anchor='top', w=0.30, dy=0.06, z='front')],
    'r': [dict(box=(10, 95, 290, 292), anchor='fit', z='behind', scale=1.12, white=True)],
    'd': [dict(box=(35, 15, 230, 122), anchor='top', w=1.05, dy=0.13, z='front'),
          dict(box=(15, 150, 290, 290), anchor='fit', z='behind')],
    'o2': [dict(box=(25, 12, 250, 112), anchor='top', w=1.12, dy=0.12, z='front'),
           dict(box=(10, 140, 295, 295), anchor='fit', z='behind')],
    'c': [dict(box=(70, 12, 230, 66), anchor='top', w=0.78, dy=0.05, z='behind', all=True)],
    'i': [dict(box=(75, 45, 225, 102), anchor='top', w=1.75, dy=0.52, z='front')],
    'o3': [dict(box=(0, 10, 300, 295), anchor='fit', z='front')],
}


def box_pieces(cid, C, model, H, hsil_f, g):
    CL = lab(C[..., :3])
    ca = C[..., 3] > 100
    m1 = refine_model(model, CL, ca) if cid in ('i',) else model
    cos = ca & ~bodylike(CL, m1)
    k = 1024 / 300
    out = []
    def bbox(a):
        ys, xs = np.nonzero(a)
        return xs.min(), ys.min(), xs.max(), ys.max()
    for p in BOX.get(cid, []):
        x0, y0, x1, y1 = [round(v * k) + PADC for v in p['box']]
        m = np.zeros_like(cos)
        src_m = (ca & (CL[..., 0] > 84) & (np.linalg.norm(CL[..., 1:], axis=-1) < 10)) if p.get('white') else (ca if p.get('all') else cos)
        m[y0:y1, x0:x1] = src_m[y0:y1, x0:x1]
        m = ndimage.binary_opening(m, iterations=1)
        lab2, n2 = ndimage.label(m)
        if n2:
            sz = ndimage.sum(m, lab2, range(1, n2 + 1))
            m = np.isin(lab2, 1 + np.nonzero(sz >= 150)[0])
        P = C.copy()
        soft = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
        P[..., 3] = (C[..., 3] * soft).astype(np.uint8)
        if p['anchor'] == 'top':
            px0, py0, px1, py1 = bbox(P[..., 3] > 40)
            sc = g['W'] * p['w'] / (px1 - px0)
            src = ((px0 + px1) / 2, py1)
            dst = (g['top'][0], g['top'][1] + p['dy'] * g['W'])
        else:
            nx0, ny0, nx1, ny1 = bbox(C[..., 3] > 128)
            hx0, hy0, hx1, hy1 = bbox(H[..., 3] > 128)
            sc = ((hy1 - hy0) / (ny1 - ny0) + (hx1 - hx0) / (nx1 - nx0)) / 2 * p.get('scale', 1)
            src, dst = ((nx0 + nx1) / 2, (ny0 + ny1) / 2), ((hx0 + hx1) / 2, (hy0 + hy1) / 2)
        tx, ty = dst[0] - src[0] * sc, dst[1] - src[1] * sc
        layer = np.stack([warp(np.ascontiguousarray(P[..., c]), sc, tx, ty) for c in range(4)], -1)
        out.append((p, layer))
    return out


def code_costume(cid, H, hbody, hsil_f, g, protect):
    """Code-drawn wraps on the hero's own limbs/edges (mummy bandages, skeleton suit + bones)."""
    yy, xx = np.mgrid[0:S, 0:S]
    W = g['W']
    Ht = g['y1'] - g['y0']
    fx0, fx1 = g['top'][0] - W * 0.40, g['top'][0] + W * 0.40
    fy0, fy1 = g['top'][1] + (g['y1'] - g['top'][1]) * 0.12, g['y0'] + Ht * 0.82
    facebox = (xx > fx0) & (xx < fx1) & (yy > fy0) & (yy < fy1)
    lay = np.zeros((S, S, 4), np.float32)
    if cid == 'o3':
        # bandage strips: diagonal bands across the body, cream with soft folds, only off the face box
        for (a, off, wid) in [(-24, -0.30, 0.075), (-24, -0.18, 0.06), (18, 0.36, 0.07), (-14, 0.50, 0.08), (30, -0.52, 0.065), (-20, 0.66, 0.06)]:
            t = np.radians(a)
            d = (-(xx - g['center'][0]) * np.sin(t) + (yy - g['center'][1]) * np.cos(t)) / W - off
            band = np.abs(d) < wid / 2
            prof = np.clip(1 - (2 * d / wid) ** 2, 0, 1)
            shade = 0.80 + 0.2 * prof
            m = band & hsil_f & ~facebox & ~protect
            col = np.array([243, 231, 205], np.float32)
            lay[m, :3] = col * shade[m, None]
            lay[m, 3] = 255
        # wraps on arms/legs: any body pixel outside the face box gets a stripe pattern
        limbs = hbody & ~facebox & ~protect & (np.sin((xx * 0.5 + yy) / W * 38) > 0.15)
        lay[limbs, :3] = np.array([238, 226, 198], np.float32) * (0.85 + 0.15 * np.cos((xx[limbs] * 0.5 + yy[limbs]) / W * 38))[:, None]
        lay[limbs, 3] = 255
    if cid == 's':
        # black suit: recolor the limbs (body-colored pixels off the torso box), keep the shading
        HL = H[..., :3].astype(np.float32)
        lum = HL.mean(-1) / 255
        limbs = hbody & ~facebox & ~protect
        limbs = ndimage.binary_opening(limbs, iterations=2)
        lay[limbs, :3] = (np.array([28, 24, 36], np.float32)[None] + 70 * (lum[limbs, None] - 0.5))
        lay[limbs, 3] = 255
        # a bone along each limb blob
        lab_, n = ndimage.label(limbs)
        img = Image.fromarray(np.zeros((S, S, 4), np.uint8))
        from PIL import ImageDraw
        d = ImageDraw.Draw(img)
        for i in range(1, n + 1):
            ys, xs = np.nonzero(lab_ == i)
            if len(ys) < 1500:
                continue
            cx, cy = xs.mean(), ys.mean()
            cov = np.cov(np.vstack([xs - cx, ys - cy]))
            ev, evec = np.linalg.eigh(cov)
            vx, vy = evec[:, -1]
            L = np.sqrt(ev[-1]) * 1.5
            r = max(5, np.sqrt(ev[0]) * 0.32)
            p0, p1 = (cx - vx * L, cy - vy * L), (cx + vx * L, cy + vy * L)
            d.line([p0, p1], fill=(250, 248, 240, 255), width=int(r * 1.4))
            for p in (p0, p1):
                for s2 in (-1, 1):
                    d.ellipse([p[0] - vy * r * 0.8 * s2 - r * 0.75, p[1] + vx * r * 0.8 * s2 - r * 0.75,
                               p[0] - vy * r * 0.8 * s2 + r * 0.75, p[1] + vx * r * 0.8 * s2 + r * 0.75], fill=(250, 248, 240, 255))
        bone = np.asarray(img).astype(np.float32)
        bm = (bone[..., 3] > 0) & limbs
        lay[bm, :3] = bone[bm, :3]
    return lay.astype(np.uint8)


def build_one(cid):
    def padded(p):
        im = Image.open(p).convert('RGBA').resize((1024, 1024), Image.LANCZOS)
        c = Image.new('RGBA', (S, S), (0, 0, 0, 0)); c.alpha_composite(im, (PADC, PADC))
        return c
    hero = padded(os.path.join(BRAND, 'cast', 'app', f'{cid}.png'))
    cos = padded(os.path.join(BRAND, 'seasons', 'halloween', 'cast', f'{cid}.png'))
    H = np.asarray(hero)
    C = np.asarray(cos)
    hsil = H[..., 3] > 128
    hsil_f = ndimage.binary_fill_holes(hsil)
    HL = lab(H[..., :3])
    model = body_model(HL, hsil)
    hbody = bodylike(HL, model) & hsil
    hbody = ndimage.binary_opening(hbody, iterations=2)
    CL = lab(C[..., :3])
    cbody = bodylike(CL, model) & (C[..., 3] > 128)
    cbody = ndimage.binary_opening(cbody, iterations=2)
    iou, s, tx, ty = align(hbody, cbody)
    Cw = np.stack([warp(np.ascontiguousarray(C[..., k]), s, tx, ty) for k in range(4)], -1)
    CwL = lab(Cw[..., :3])
    ca = Cw[..., 3] > 100
    diff = np.linalg.norm(CwL - HL, axis=-1)
    costume = ca & ~bodylike(CwL, model) & (~hsil | (diff > 22))
    # the hero's own features are protected
    feat = hsil & ~ndimage.binary_dilation(hbody, iterations=1)
    feat = ndimage.binary_opening(feat, iterations=1)
    protect = ndimage.binary_dilation(feat, iterations=7)
    # geometry
    g = lc.tile_geometry(H[..., 3])
    W = g['W']
    yy, xx = np.mgrid[0:S, 0:S]
    k = np.tan(np.radians(g['angle']))
    head = g['top'][1] + k * (xx - g['top'][0])
    fx0, fx1 = g['top'][0] - W * 0.40, g['top'][0] + W * 0.40
    Ht = g['y1'] - g['y0']
    fy0, fy1 = g['top'][1] + (g['y1'] - g['top'][1]) * 0.12, g['y0'] + Ht * 0.82
    facebox = (xx > fx0) & (xx < fx1) & (yy > fy0) & (yy < fy1)
    regions = {
        'above': yy < head + W * 0.16,
        'behind': ~ndimage.binary_dilation(hsil_f, iterations=2),
        'ring': hsil & ~facebox,
        'low': hsil & (yy > fy1 - Ht * 0.06),
        'neck': (np.abs(xx - g['top'][0]) < W * 0.12) & (yy > fy0 + (fy1 - fy0) * 0.30) & (yy < fy0 + (fy1 - fy0) * 0.55),
    }
    keep = np.zeros_like(costume)
    for r in SPEC[cid]['keep']:
        keep |= regions[r]
    if 'above' in SPEC[cid]['keep']:
        keep |= regions['above'] & ~hsil   # a hat's brim beyond the head
    m = costume & keep & ~protect
    if 'neck' not in SPEC[cid]['keep']:
        m &= ~facebox | ~hsil
    m = ndimage.binary_opening(m, iterations=2)
    lab_, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, lab_, range(1, n + 1))
        m = np.isin(lab_, 1 + np.nonzero(sizes >= 220)[0])
    m = ndimage.binary_closing(m, iterations=2) & ca
    mode = SPEC[cid].get('mode', 'transfer')
    if mode not in ('transfer', 'mixed'):
        m[:] = False
    soft = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32) / 255
    piece = Cw.copy()
    piece[..., 3] = (Cw[..., 3].astype(np.float32) * soft).astype(np.uint8)
    behind = piece.copy(); behind[..., 3] = np.where(hsil_f, 0, behind[..., 3])
    front = piece.copy(); front[..., 3] = np.where(hsil_f, front[..., 3], 0)
    def over(dst, src):
        a = src[..., 3:4].astype(np.float32) / 255
        o = dst.astype(np.float32)
        o[..., :3] = o[..., :3] * (1 - a) + src[..., :3] * a
        o[..., 3:4] = np.maximum(o[..., 3:4], src[..., 3:4])
        return o.astype(np.uint8)
    chroma = np.linalg.norm(HL[..., 1:], axis=-1)
    gloss = feat & (HL[..., 0] > 80) & (chroma < 18) & (yy < head + W * 0.35)
    protect_hat = ndimage.binary_dilation(feat & ~ndimage.binary_dilation(gloss, iterations=3), iterations=7)
    if mode == 'layered':   # the approved layer-costume alternate (pieces on the hero), re-run on the header art
        for L in SPEC[cid]['layers']:
            pc = Image.open(os.path.join(BRAND, 'seasons', 'halloween', 'pieces', L['piece'] + '.png')).convert('RGBA')
            wpx = g['W'] * L['w']
            pc = pc.resize((max(1, round(wpx)), max(1, round(pc.height * wpx / pc.width))), Image.LANCZOS)
            ax, ay = g[L['anchor']]
            ax += L.get('dx', 0) * g['W']; ay += L.get('dy', 0) * g['W']
            pivot = (pc.width / 2, pc.height) if L['anchor'] in ('top', 'feet') else (pc.width / 2, pc.height / 2)
            big = Image.new('RGBA', (pc.width * 3, pc.height * 3), (0, 0, 0, 0))
            big.alpha_composite(pc, (pc.width, pc.height))
            ang = (g['angle'] if L['anchor'] == 'top' else 0) + L.get('rot', 0)
            big = big.rotate(-ang, Image.BICUBIC, center=(pc.width + pivot[0], pc.height + pivot[1]))
            lay = Image.new('RGBA', (S, S), (0, 0, 0, 0))
            lc._paste_clip(lay, big, (round(ax - pc.width - pivot[0]), round(ay - pc.height - pivot[1])))
            P = np.asarray(lay).copy()
            if L['z'] == 'behind':
                P[..., 3] = np.where(hsil_f, 0, P[..., 3]); behind = over(behind, P)
            else:
                P[..., 3] = np.where(protect_hat, 0, P[..., 3]); front = over(front, P)
    if mode == 'box':
        for p, P in box_pieces(cid, C, model, H, hsil_f, g):
            P = P.copy()
            if p['z'] == 'behind':
                P[..., 3] = np.where(hsil_f, 0, P[..., 3]); behind = over(behind, P)
            elif p['anchor'] == 'fit':
                P[..., 3] = np.where(hsil_f & ~protect & ~facebox, P[..., 3], 0); front = over(front, P)
            else:
                f = P.copy(); f[..., 3] = np.where(hsil_f & ~protect_hat, f[..., 3], 0); front = over(front, f)
                b2 = P.copy(); b2[..., 3] = np.where(hsil_f, 0, b2[..., 3]); behind = over(behind, b2)
    if mode in ('piece', 'mixed'):
        for reg, P in night1_pieces(C, model, SPEC[cid].get('pieces', ['above', 'behind']), body_sil(HL, model, hsil), hsil_f):
            P = P.copy()
            if reg == 'behind':
                P[..., 3] = np.where(hsil_f, 0, P[..., 3]); behind = over(behind, P)
            else:
                f = P.copy(); f[..., 3] = np.where(hsil_f & ~protect & ~(facebox & ~regions['above']), f[..., 3], 0); front = over(front, f)
                b2 = P.copy(); b2[..., 3] = np.where(hsil_f, 0, b2[..., 3]); behind = over(behind, b2)
    if mode in ('code', 'mixed') and SPEC[cid].get('code'):
        front = over(front, code_costume(cid, H, hbody, hsil_f, g, protect))
    # contact shadow of front pieces on the hero (soft, down-right)
    fa = front[..., 3].astype(np.float32) / 255
    sh = np.roll(np.roll(fa, 6, 0), 3, 1)
    sh = np.asarray(Image.fromarray((sh * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32) / 255
    Hs = H.astype(np.float32).copy()
    Hs[..., :3] *= (1 - 0.28 * sh * (~protect))[..., None]
    # AO on the back pieces where they go behind the hero
    dist = ndimage.distance_transform_edt(~hsil_f)
    ao = 1 - 0.45 * np.exp(-dist / 18)
    bk = behind.astype(np.float32); bk[..., :3] *= ao[..., None]
    out = Image.fromarray(bk.astype(np.uint8), 'RGBA')
    out.alpha_composite(Image.fromarray(np.clip(Hs, 0, 255).astype(np.uint8), 'RGBA'))
    out.alpha_composite(Image.fromarray(front, 'RGBA'))
    O = np.asarray(out).astype(np.float32)
    box = facebox & (H[..., 3] > 200)
    face = float(np.abs(O[..., :3] - H[..., :3].astype(np.float32))[box].mean())
    feat_kept = float((np.abs(O[..., :3] - H[..., :3].astype(np.float32)).sum(-1)[feat] < 30).mean())
    fig = trim(out); fig.thumbnail((900, 900), Image.LANCZOS); fig.save(os.path.join(HERE, f'{cid}.png'), optimize=True)
    return dict(faceRegionDiff=round(face, 3), featuresUntouched=round(feat_kept, 4), alignIoU=round(float(iou), 3),
                costumePx=int(m.sum()), method='layered on cast/app (costume pixels transferred from night-1, features protected)',
                caption=SPEC[cid]['caption'])


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())


def strip(figs, Wd=1179, h=250):
    """compose-home-header.py option A (the live cast row): edge to edge, slight overlap, alternate lift."""
    figs = [trim(f) for f in figs]
    ov = 0.14
    r = [im.width / im.height for im in figs]
    ch = min((Wd - 24) / (sum(r) * (1 - ov) + r[-1] * ov), h * 0.86)
    out = Image.new('RGBA', (Wd, h), (0, 0, 0, 0))
    ws = [x * ch for x in r]
    x = (Wd - (sum(ws) * (1 - ov) + ws[-1] * ov)) / 2
    for k, (im, w) in enumerate(zip(figs, ws)):
        im = im.resize((round(w), round(ch)), Image.LANCZOS)
        out.alpha_composite(im, (round(x), round(h - ch - ch * 0.1 * (k % 2) - 4)))
        x += w * (1 - ov)
    return out


if __name__ == '__main__':
    rep = {}
    for cid in CAST:
        rep[cid] = build_one(cid)
        print(cid, rep[cid]['faceRegionDiff'], rep[cid]['featuresUntouched'], rep[cid]['alignIoU'])
    json.dump(rep, open(os.path.join(HERE, 'header.json'), 'w'), indent=1)
    normal = strip([Image.open(os.path.join(BRAND, 'cast', 'app', f'{c}.png')).convert('RGBA') for c in CAST])
    shipped = strip([Image.open(os.path.join(BRAND, 'cast', 'halloween', f'{c}.png')).convert('RGBA') for c in CAST])
    new = strip([Image.open(os.path.join(HERE, f'{c}.png')).convert('RGBA') for c in CAST])
    for nm, im in (('strip-normal', normal), ('strip-shipped', shipped), ('strip-halloween', new)):
        im.save(os.path.join(HERE, nm + '.png'))
    bg = (30, 22, 48, 255)
    cmp = Image.new('RGBA', (1179, 3 * 270 + 20), bg)
    for i, im in enumerate((normal, shipped, new)):
        cmp.alpha_composite(im, (0, 10 + i * 270))
    cmp.convert('RGB').save(os.path.join(HERE, 'compare.webp'), quality=90)
