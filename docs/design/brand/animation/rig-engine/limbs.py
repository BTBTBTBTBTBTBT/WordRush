# Shared helpers for the ChatGPT limbs (10-05): a keyed ChatGPT limb is color-matched in Lab to the hero's own
# limb pixels (L mean/std, hue rotation, chroma scale), cleaned to its largest component and scaled.
# The limb is the only non-hero pixel set in a rig; the face, letter and body stay the canonical hero pixels.
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage


def lab(x):
    return cv2.cvtColor(np.clip(x / 255, 0, 1).astype(np.float32), cv2.COLOR_RGB2LAB)


def match_limb(keyed_path, ref_rgb, scale, lift=0.0, chroma=1.0, crop_box=None):
    """keyed_path: RGBA limb on transparent. ref_rgb: (N,3) hero pixels of the same limb. Returns RGBA float array."""
    im = Image.open(keyed_path).convert('RGBA')
    if crop_box:
        im = im.crop(crop_box)
    a = np.asarray(im).astype(np.float32)
    al = a[..., 3]
    m = al > 20
    lb, n = ndimage.label(m)
    if n > 1:
        big = lb == (1 + int(np.argmax(ndimage.sum(m, lb, range(1, n + 1)))))
        al = np.where(ndimage.binary_dilation(big, iterations=2), al, 0)
    L = lab(a[..., :3])
    solid = al > 240
    src = L[solid]
    ref = lab(ref_rgb[None].astype(np.float32))[0]
    L[..., 0] = (L[..., 0] - src[:, 0].mean()) * (ref[:, 0].std() / (src[:, 0].std() + 1e-6)) + ref[:, 0].mean() + lift
    hs = np.arctan2(src[:, 2], src[:, 1]).mean(); hr = np.arctan2(ref[:, 2], ref[:, 1]).mean()
    cs = np.hypot(src[:, 1], src[:, 2]).mean(); cr = np.hypot(ref[:, 1], ref[:, 2]).mean()
    C = np.hypot(L[..., 1], L[..., 2]) * (cr / cs) * chroma
    hh = np.arctan2(L[..., 2], L[..., 1]) + (hr - hs)
    L[..., 1] = C * np.cos(hh); L[..., 2] = C * np.sin(hh)
    rgb = np.clip(cv2.cvtColor(L, cv2.COLOR_LAB2RGB) * 255, 0, 255)
    out = Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')
    out = out.crop(out.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox())
    if scale != 1:
        out = out.resize((round(out.width * scale), round(out.height * scale)), Image.LANCZOS)
    return np.asarray(out).astype(np.float32)


def edge_fill(r, hole, side, fit_rows, band=45, ring_ok=None, rows=None, ring_w=16, feather=0):
    """Fill `hole` in r.base where a limb sat over the body's left/right silhouette edge.
    The silhouette continues the hero's own edge (quadratic through fit_rows); within `band` px of the edge each
    row clones the edge band at the same depth from the rows just above and below the hole (interpolated), and
    deeper in it blends into a quadratic color surface fitted around the hole. Outside the edge goes transparent."""
    A = r.A
    def ex(y):
        xs = np.where(A[y] > 128)[0]
        return xs.max() if side == 'right' else xs.min()
    ys = list(fit_rows)
    coef = np.polyfit(ys, [ex(y) for y in ys], 2)
    edge = lambda y: np.polyval(coef, y)
    hy, hx = np.where(hole)
    y0, y1 = hy.min(), hy.max()
    ra, rb = rows or (y0 - 4, y1 + 4)
    surf = r.surface(hole, ring_w=ring_w, ring_ok=ring_ok, area_grow=2)
    base = r.base
    old = base.copy()
    outside = np.zeros_like(hole)
    for y, x in zip(hy, hx):
        e = edge(y)
        d = (e - x) if side == 'right' else (x - e)
        if d < -0.5:
            base[y, x] = 0
            outside[y, x] = True
            continue
        t = (y - ra) / (rb - ra)
        def at(row, dd):
            xx = int(round(edge(row) - dd)) if side == 'right' else int(round(edge(row) + dd))
            return r.H[row, xx, :3]
        cb = at(ra, max(d, 2)) * (1 - t) + at(rb, max(d, 2)) * t
        t = float(np.clip(t, 0, 1))
        w = float(np.clip((band - d) / 12, 0, 1))
        c = cb * w + surf[y, x, :3] * (1 - w)
        base[y, x, :3] = c
        base[y, x, 3] = 255 * float(np.clip(d + 0.5, 0, 1))
    if feather:
        # blend into the untouched hero over the outer `feather` px of the hole (no step at the hole's border)
        w = np.clip(ndimage.distance_transform_edt(hole) / feather, 0, 1)[..., None]
        base[:] = base * w + old * (1 - w)
        base[outside] = 0
    return edge
