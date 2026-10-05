# Wordocious puppet rig engine (cutting side). Every character rig is cut from the CANONICAL hero art
# (cast/hero/<id>.png). Founder rule 10-04: animate the real approved pixels and never redraw a character.
# A per-character rig.py (animation/<id>/rig.py) uses this module to:
#   - cut moving parts (arms, props, mouth) out of the hero into layers that keep the exact hero pixels,
#   - fill the hole each part leaves in the base layer in code (inpaint from the neighboring hero pixels,
#     or a smooth color surface fitted to the face around a feature),
#   - paint face patches (blink lids, happy ^ ^ eyes, a laughing mouth) over the real face,
#   - check the rest pose: composite the structural layers and diff against the hero (target < 2/255 mean).
# Layers are saved as full-canvas PNGs in <id>/layers/; build.py crops them to WebP data URIs.
import json, os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ENGINE = os.path.dirname(os.path.abspath(__file__))
ANIM = os.path.dirname(ENGINE)
BRAND = os.path.dirname(ANIM)


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


class Rig:
    def __init__(self, cid, here=None):
        self.cid = cid
        self.here = here or os.path.join(ANIM, cid)
        self.out = os.path.join(self.here, 'layers')
        os.makedirs(self.out, exist_ok=True)
        self.hero = Image.open(os.path.join(BRAND, 'cast/hero', f'{cid}.png')).convert('RGBA')
        self.H = np.asarray(self.hero).astype(np.float32)
        self.A = self.H[..., 3]
        self.R, self.G, self.B = self.H[..., 0], self.H[..., 1], self.H[..., 2]
        self.lum = self.H[..., :3].mean(2)
        self.sat = self.H[..., :3].max(2) - self.H[..., :3].min(2)
        self.h, self.w = self.A.shape
        self.yy, self.xx = np.mgrid[0:self.h, 0:self.w]
        self.base = self.H.copy()
        self.front = []      # structural layers drawn over the base, in order: (name, array)
        self.back = []       # structural layers drawn under the base
        self.patches = {}    # face patches (not part of the rest pose)
        self.info = {}

    # ---------------------------------------------------------------- masks
    def box(self, x0, y0, x1, y1):
        m = np.zeros((self.h, self.w), bool)
        m[y0:y1, x0:x1] = True
        return m

    def poly(self, pts):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
        return np.asarray(im) > 0

    @staticmethod
    def largest(m, k=1):
        lab, n = ndimage.label(m)
        if n == 0:
            return m
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = np.argsort(sizes)[::-1][:k] + 1
        return np.isin(lab, keep)

    def blob(self, box, thr=70, cond=None, k=1):
        """Largest dark (lum < thr) connected component inside box, or `cond` if given."""
        m = self.box(*box) & (self.A > 200)
        m &= cond if cond is not None else (self.lum < thr)
        return self.largest(m, k)

    @staticmethod
    def grow(m, n):
        return ndimage.binary_dilation(m, iterations=n) if n > 0 else (ndimage.binary_erosion(m, iterations=-n) if n < 0 else m)

    # ---------------------------------------------------------------- fills
    def inpaint(self, arr, hole, radius=10):
        """Fill `hole` in an RGBA float array from its surroundings (Telea, premultiplied color + alpha)."""
        a = arr[..., 3:4] / 255
        pm = np.clip(arr[..., :3] * a, 0, 255).astype(np.uint8)
        al = np.clip(arr[..., 3], 0, 255).astype(np.uint8)
        hm = hole.astype(np.uint8) * 255
        pm2 = cv2.inpaint(pm, hm, radius, cv2.INPAINT_TELEA).astype(np.float32)
        al2 = cv2.inpaint(al, hm, radius, cv2.INPAINT_TELEA).astype(np.float32)
        out = arr.copy()
        aa = np.maximum(al2, 1e-3)[..., None] / 255
        col = np.clip(pm2 / aa, 0, 255)
        out[hole, :3] = col[hole]
        out[hole, 3] = al2[hole]
        return out

    def surface(self, mask, ring_w=10, ring_ok=None, area_grow=3, ring_gap=3):
        """RGBA patch covering `mask`: a quadratic color surface fitted to the ring of pixels around it."""
        ring = self.grow(mask, ring_w) & ~self.grow(mask, ring_gap) & (self.A > 240)
        if ring_ok is not None:
            ring &= ring_ok
        ys, xs = np.where(ring)
        X = np.stack([np.ones_like(xs), xs, ys, xs * xs, ys * ys, xs * ys], 1).astype(np.float64)
        area = self.grow(mask, area_grow)
        py, px = np.where(area)
        Xp = np.stack([np.ones_like(px), px, py, px * px, py * py, px * py], 1).astype(np.float64)
        patch = np.zeros_like(self.H)
        for c in range(3):
            k, *_ = np.linalg.lstsq(X, self.H[ys, xs, c].astype(np.float64), rcond=None)
            patch[py, px, c] = Xp @ k
        d = ndimage.distance_transform_edt(~mask)
        alpha = np.clip((area_grow + 0.5 - d) / max(1, area_grow), 0, 1)
        patch[..., 3] = np.where(area, 255 * alpha, 0)
        patch[..., 3] = np.where(self.A > 0, patch[..., 3], 0)   # opaque over semi-transparent seams inside the art
        return patch

    # ---------------------------------------------------------------- cutting
    def cut(self, name, mask, fill='inpaint', radius=10, back=False, ring_ok=None, hole_grow=0):
        """Move the hero pixels under `mask` into their own layer and fill the hole left in the base."""
        layer = np.zeros_like(self.H)
        layer[mask] = self.H[mask]
        hole = self.grow(mask, hole_grow) & (self.base[..., 3] > 0) if hole_grow else mask
        if fill == 'inpaint':
            self.base = self.inpaint(self.base, hole, radius)
        elif fill == 'surface':
            s = self.surface(mask, ring_w=14, ring_ok=ring_ok, area_grow=hole_grow + 2)
            a = s[..., 3:4] / 255
            self.base[..., :3] = np.where(a > 0, s[..., :3] * a + self.base[..., :3] * (1 - a), self.base[..., :3])
        elif fill == 'clear':
            self.base[mask] = 0
        (self.back if back else self.front).append((name, layer))
        return layer

    def shadow(self, y0, name='shadow', amax=235, satmax=60, keep_edge=0):
        """Soft ground shadow (semi-transparent, low-saturation pixels below y0) as a static floor layer.
        keep_edge: pixels within this many px of the opaque body stay in the body (its anti-aliased edge), so y0 can
        sit higher and catch the shadow's faint top rows without cutting the feet."""
        m = (self.yy >= y0) & (self.A > 0) & (self.A < amax) & (self.sat < satmax)
        if keep_edge:
            m &= ~self.grow(self.A >= amax, keep_edge)
        m = ndimage.binary_closing(m, iterations=2) & (self.A > 0) & (self.A < amax)
        if keep_edge:
            m &= ~self.grow(self.A >= amax, keep_edge)
        layer = np.zeros_like(self.H)
        layer[m] = self.H[m]
        self.base[m] = 0
        if keep_edge:
            # the feet hid part of the shadow: fill those foot-shaped gaps row by row, interpolating between the
            # shadow on either side (premultiplied), so the floor shadow stays whole when the character hops
            hole = self.grow(self.A >= amax, keep_edge + 1) & (self.yy >= y0) & ~m
            pm = layer[..., :3] * layer[..., 3:] / 255
            filled = 0
            for y in np.where(hole.any(1))[0]:
                xs = np.where(hole[y])[0]
                runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
                for run in runs:
                    a, b = run[0] - 1, run[-1] + 1
                    if a < 0 or b >= self.w or layer[y, a, 3] <= 0 or layer[y, b, 3] <= 0:
                        continue
                    t = (run - a) / (b - a)
                    al = layer[y, a, 3] * (1 - t) + layer[y, b, 3] * t
                    c = pm[y, a][None] * (1 - t)[:, None] + pm[y, b][None] * t[:, None]
                    layer[y, run, 3] = al
                    layer[y, run, :3] = c / np.maximum(al, 1e-3)[:, None] * 255
                    filled += len(run)
            self.info['shadowHoleFilled'] = int(filled)
        self.back.insert(0, (name, layer))
        return m

    # ---------------------------------------------------------------- face patches
    def inpaint_fill(self, cover, radius=14, blur=2.5, feather=2.5, also=None, plain=None, halo=0, limit=None):
        """RGBA patch over `cover`: Telea inpaint of the hero from the pixels around it, smoothed inside. Unlike the
        quadratic surface it meets the real face exactly at the border, so no disc edge or eye 'socket' shows."""
        # `also`: other features to inpaint away at the same time (so a nearby mouth or eye can't bleed into the fill)
        # `halo`: a feature's soft glow around it is inpainted too and faded back in over `halo` px, so the fill
        # isn't lit by the glow (which reads as a lighter disc once the feature is gone)
        core = cover
        if halo:
            cover = self.grow(cover, halo) & (self.A > 0)
        if limit is not None:            # e.g. the face only: other areas (a headband) neither get painted nor bleed in
            cover = cover & limit
            core = core & limit
            also = (also if also is not None else np.zeros_like(cover)) | (self.grow(cover, radius + 2) & ~limit)
        hm = ((cover | (also if also is not None else False)) & (self.A > 0)).astype(np.uint8) * 255
        rgb = np.clip(self.H[..., :3], 0, 255).astype(np.uint8)
        f = cv2.inpaint(rgb, hm, radius, cv2.INPAINT_TELEA).astype(np.float32)
        if blur:
            fb = np.stack([ndimage.gaussian_filter(f[..., c], blur) for c in range(3)], -1)
            inner = ndimage.distance_transform_edt(cover)
            w = np.clip(inner / 6, 0, 1)[..., None]       # keep the exact border, smooth only inside
            f = fb * w + f * (1 - w)
        if plain is not None:
            # put the face's own fine texture back (the fill is otherwise too smooth and reads as a disc): the
            # high-frequency part of a nearby featureless face area with the same shape as the cover
            hf = self.H[..., :3] - np.stack([ndimage.gaussian_filter(self.H[..., c], 4) for c in range(3)], -1)
            lab, n = ndimage.label(cover)
            inner = np.clip(ndimage.distance_transform_edt(cover) / 4, 0, 1)
            for i in range(1, n + 1):
                ys, xs = np.where(lab == i)
                best = None
                for dy in range(-400, 401, 8):
                    for dx in range(-400, 401, 8):
                        if best is not None and dx * dx + dy * dy >= best[0]:
                            continue
                        y2, x2 = ys + dy, xs + dx
                        if y2.min() < 0 or x2.min() < 0 or y2.max() >= self.h or x2.max() >= self.w:
                            continue
                        if plain[y2[::3], x2[::3]].mean() > 0.95:
                            best = (dx * dx + dy * dy, dy, dx)
                if best:
                    _, dy, dx = best
                    f[ys, xs] += hf[ys + dy, xs + dx] * inner[ys, xs, None]
                    self.info.setdefault('textureFrom', []).append([int(dx), int(dy)])
        out = np.zeros_like(self.H)
        out[..., :3] = f
        if halo:
            d = ndimage.distance_transform_edt(~core)
            out[..., 3] = np.where((self.A > 0) & cover, 255 * np.clip(1 - d / halo, 0, 1) ** 0.8, 0)
        else:
            d = ndimage.distance_transform_edt(~cover)
            out[..., 3] = np.where(self.A > 0, 255 * np.clip((feather + 0.5 - d) / max(feather, 1e-3), 0, 1), 0)
        return out

    def stroke(self, im, pts, ink, lw):
        """Rounded stroke through `pts` (hero px) drawn into the RGBA PIL image `im` (supersampled)."""
        S = 4
        big = Image.new('RGBA', (self.w * S, self.h * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(big)
        P = [(x * S, y * S) for x, y in pts]
        d.line(P, fill=tuple(ink) + (255,), width=int(lw * S), joint='curve')
        for x, y in (P[0], P[-1]):
            d.ellipse([x - lw * S / 2, y - lw * S / 2, x + lw * S / 2, y + lw * S / 2], fill=tuple(ink) + (255,))
        im.alpha_composite(big.resize((self.w, self.h), Image.LANCZOS))

    def eye_info(self, eyes):
        out = []
        for m in eyes:
            ys, xs = np.where(m)
            out.append(dict(cx=float(xs.mean()), cy=float(ys.mean()), w=int(np.ptp(xs) + 1), h=int(np.ptp(ys) + 1)))
        return out

    def eye_patches(self, eyes, cover=None, ring_ok=None, ring_w=22, ink=None, lw=None, clip=None,
                    closed=(0.46, 0.30, 0.22), happy=(0.46, 0.18, 0.55), half=0.45, kinds=('half', 'closed', 'happy'),
                    prefix='eyes', ring_gap=3, feather=3, fillmode='surface', brows=None, also=None, plain=None, ifeather=4, halo=0, limit=None):
        """Blink and laugh face patches over the real eyes.
        cover: area painted with the fitted face fill (default: eyes grown by 8 px).
        closed/happy: (half width, top, bottom) of the lid arc box, as fractions of each eye's size."""
        allm = np.zeros_like(self.A, bool)
        for m in eyes:
            allm |= m
        if cover is None:
            cover = self.grow(allm, 8) & (self.A > 200)
        cover = ndimage.binary_fill_holes(cover) & (self.A > 0)   # the art has semi-transparent seams around features
        fill = (self.inpaint_fill(cover, also=also, plain=plain, feather=ifeather, halo=halo, limit=limit) if fillmode == 'inpaint' else
                self.surface(cover, ring_w=ring_w, ring_ok=ring_ok, ring_gap=ring_gap, area_grow=feather))
        if ink is None:
            dark = allm & (self.lum < 70)
            ink = tuple(int(v) for v in np.median(self.H[dark if dark.any() else allm][:, :3], 0))
        info = self.eye_info(eyes)
        res = {}
        for kind in kinds:
            im = Image.fromarray(np.clip(fill, 0, 255).astype(np.uint8), 'RGBA')
            S = 4
            big = Image.new('RGBA', (self.w * S, self.h * S), (0, 0, 0, 0))
            d = ImageDraw.Draw(big)
            for e in info:
                w, h, cx, cy = e['w'], e['h'], e['cx'], e['cy']
                lwi = lw or int(np.clip(round(min(w, h) * 0.17), 6, 18))
                if kind == 'closed':
                    hw, top, bot = closed
                    d.arc([v * S for v in [cx - w * hw, cy - h * top, cx + w * hw, cy + h * bot]], 20, 160, fill=ink + (255,), width=lwi * S)
                elif kind == 'happy':
                    hw, top, bot = happy
                    d.arc([v * S for v in [cx - w * hw, cy - h * top, cx + w * hw, cy + h * bot]], 200, 340, fill=ink + (255,), width=lwi * S)
            big = big.resize((self.w, self.h), Image.LANCZOS)
            im.alpha_composite(big)
            if brows and kind in brows and brows[kind][0] == 'hero':   # ('hero', mask): keep the real brows on top
                bm = Image.fromarray((brows[kind][1] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
                hb = self.hero.copy(); hb.putalpha(Image.fromarray(np.minimum(np.asarray(bm), np.asarray(self.hero)[..., 3])))
                im.alpha_composite(hb)
            elif brows and kind in brows:        # ([stroke pts...], ink, lw): paint brows for this face (cover them first)
                strokes, bink, blw = brows[kind]
                for pts in strokes:
                    self.stroke(im, pts, bink, blw)
            if kind == 'half':
                for m, e in zip(eyes, info):
                    bx = (int(e['cx'] - e['w'] * 0.75), int(e['cy'] - e['h'] * 0.75), int(e['cx'] + e['w'] * 0.75), int(e['cy'] + e['h'] * 0.75))
                    src = self.hero.crop(bx)
                    mm = Image.fromarray((self.grow(m, 3)[bx[1]:bx[3], bx[0]:bx[2]] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))
                    src.putalpha(mm)
                    sq = src.resize((src.width, max(1, round(src.height * half))), Image.LANCZOS)
                    im.alpha_composite(sq, (bx[0], int(round(e['cy'] - sq.height / 2))))
            arr = np.asarray(im).astype(np.float32)
            if clip is not None:
                arr[..., 3] *= clip
            self.patches[f'{prefix}-{kind}'] = arr
            res[kind] = arr
        self.info[prefix] = info
        return res

    def mouth_laugh(self, mouth, sy=1.55, sx=1.08, ring_ok=None, name='mouth-laugh', ring_w=12, fillmode='surface', also=None, grow=3, soft=0.8, plain=None, halo=0, limit=None):
        """The real mouth stretched open (top edge fixed) over a fitted face fill."""
        cover = ndimage.binary_fill_holes(self.grow(mouth, grow) & (self.A > 200)) & (self.A > 0)
        fill = (self.inpaint_fill(self.grow(cover, 2), also=also, plain=plain, feather=4, halo=halo, limit=limit) if fillmode == 'inpaint' else self.surface(cover, ring_w=ring_w, ring_ok=ring_ok))
        ys, xs = np.where(cover)
        bx = (int(xs.min()) - 2, int(ys.min()) - 2, int(xs.max()) + 3, int(ys.max()) + 3)
        src = self.hero.crop(bx)
        src.putalpha(Image.fromarray((cover[bx[1]:bx[3], bx[0]:bx[2]] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(soft)))
        big = src.resize((round(src.width * sx), round(src.height * sy)), Image.LANCZOS)
        im = Image.fromarray(np.clip(fill, 0, 255).astype(np.uint8), 'RGBA')
        im.alpha_composite(big, (bx[0] - round(src.width * (sx - 1) / 2), bx[1]))
        self.patches[name] = np.asarray(im).astype(np.float32)
        return self.patches[name]

    def painted_mouth(self, smile, ink=None, tongue=(236, 96, 128), depth=0.62, widen=1.12, ring_ok=None, name='mouth-laugh'):
        """For a line smile: an open laughing mouth painted in the smile's own ink over a fitted face fill.
        The top edge is a flat chord across the smile's ends, the bottom follows the smile curve, deepened."""
        cover = self.grow(smile, 4) & (self.A > 200)
        fill = self.surface(cover, ring_w=12, ring_ok=ring_ok)
        if ink is None:
            ink = tuple(int(v) for v in np.median(self.H[smile & (self.lum < 90)][:, :3], 0))
        ys, xs = np.where(smile)
        x0, x1 = xs.min(), xs.max()
        cx = (x0 + x1) / 2
        hw = (x1 - x0) / 2 * widen
        ytop = float(np.percentile(ys, 8))
        dep = (x1 - x0) * depth * 0.5
        S = 4
        big = Image.new('RGBA', (self.w * S, self.h * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(big)
        pts = []
        for i in range(41):
            a = np.pi * i / 40
            pts.append(((cx + hw * np.cos(a)) * S, (ytop + dep * np.sin(a)) * S))
        d.polygon(pts, fill=ink + (255,))
        tg = Image.new('RGBA', big.size, (0, 0, 0, 0))
        ImageDraw.Draw(tg).ellipse([(cx - hw * 0.55) * S, (ytop + dep * 0.45) * S, (cx + hw * 0.55) * S, (ytop + dep * 1.35) * S], fill=tuple(tongue) + (255,))
        mask = Image.new('L', big.size, 0)
        ImageDraw.Draw(mask).polygon(pts, fill=255)
        mask = mask.filter(ImageFilter.MinFilter(9))
        tg.putalpha(Image.fromarray(np.minimum(np.asarray(tg)[..., 3], np.asarray(mask))))
        big.alpha_composite(tg)
        big = big.resize((self.w, self.h), Image.LANCZOS)
        im = Image.fromarray(np.clip(fill, 0, 255).astype(np.uint8), 'RGBA')
        im.alpha_composite(big)
        self.patches[name] = np.asarray(im).astype(np.float32)
        return self.patches[name]

    def patch(self, name, arr):
        self.patches[name] = arr

    # ---------------------------------------------------------------- output
    def save(self):
        def sv(arr, name):
            Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(self.out, name + '.png'))
        for f in os.listdir(self.out):
            if f.endswith('.png'):
                os.remove(os.path.join(self.out, f))
        sv(self.base, 'base')
        for n, a in self.back + self.front:
            sv(a, n)
        for n, a in self.patches.items():
            sv(a, n)

    def rest_diff(self, extra=None):
        """Composite back layers, base, front layers at rest and compare with the hero (premultiplied color)."""
        comp = Image.new('RGBA', self.hero.size, (0, 0, 0, 0))
        stack = [a for _, a in self.back] + [self.base] + [a for _, a in self.front] + (extra or [])
        for a in stack:
            comp.alpha_composite(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA'))
        C = np.asarray(comp).astype(np.float32)
        H = self.H
        pc = C[..., :3] * C[..., 3:] / 255
        ph = H[..., :3] * H[..., 3:] / 255
        char = self.A > 0
        diff = np.abs(pc - ph).mean(2)
        dA = np.abs(C[..., 3] - self.A)
        vis = np.clip(np.maximum(diff, dA) * 8, 0, 255).astype(np.uint8)
        Image.fromarray(vis).save(os.path.join(self.here, 'diff.png'))
        return dict(meanAbsRGB=round(float(diff[char].mean()), 3), meanAbsAlpha=round(float(dA[char].mean()), 3),
                    p99RGB=round(float(np.percentile(diff[char], 99)), 1), pixels=int(char.sum()),
                    note='premultiplied, over the hero character area (alpha>0)')

    def write(self, motion):
        """Save layers, run the rest check, and write rig.json = motion spec + layer names + rest diff."""
        self.save()
        d = self.rest_diff()
        rig = dict(id=self.cid, source=f'cast/hero/{self.cid}.png', canvas=[self.w, self.h], restDiff=d, info=self.info)
        rig.update(motion)
        names = ['base'] + [n for n, _ in self.back + self.front]
        rig.setdefault('layers', [])
        # structural layers missing from the motion list are drawn statically in their cut order
        listed = {L['img'] for L in rig['layers']}
        if 'base' not in listed:
            pos = len([n for n, _ in self.back if n in listed])
            rig['layers'].insert(pos, dict(img='base'))
        for n in names:
            if n not in {L['img'] for L in rig['layers']}:
                rig['layers'].append(dict(img=n))
        json.dump(rig, open(os.path.join(self.here, 'rig.json'), 'w'), indent=1)
        print(self.cid, 'rest diff', d)
        return rig


def motion(rig, name, gesture, caption, cycle=6.0, laugh=('eyes-happy', 'mouth-laugh'), blink=True, **kw):
    """Motion defaults shared by the cast: breathing about the feet, 3 to 5 s blinks, tap to hop and laugh."""
    ys, xs = np.where(rig.A > 200)
    m = dict(name=name, gesture=gesture, caption=caption, cycle=cycle,
             breath=dict(origin=[int(np.median(xs)), int(ys.max())], period=3.4, sy=0.012, sx=0.006),
             laugh=list(laugh), tracks={}, layers=[])
    if blink:
        m['blink'] = dict(half='eyes-half', closed='eyes-closed')
    m.update(kw)
    return m
