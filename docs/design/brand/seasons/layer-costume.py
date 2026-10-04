#!/usr/bin/env python3
"""LAYERED costumes (founder 10-04): the cast member stays the canonical approved pixels (cast/hero/<id>.png).
ChatGPT draws only the costume PIECES (hats, wings, ears, tails, capes, props) on flat cyan; this script keys them,
splits a sheet into pieces, and composites them onto the hero at anchors measured from the hero itself.

  python3 layer-costume.py split <capture.png> <season> <sheet-name> <piece1> <piece2> ...
      raw capture -> <season>/raw/<sheet-name>.webp ; pieces (row-major order) -> <season>/pieces/<piece>.png
  python3 layer-costume.py build [<season>]
      every SPEC -> <season>/cast/<out>.png (1024 canvas, 900 max, like night 1) + <season>/layered.json
      with a face-region check (eyes, mouth and letter box vs the hero; 0 = untouched).
"""
import json, math, os, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(ROOT)

# anchors: 'top' = bottom-center of the piece on the head line (fitted on the tile's shoulders, so a sprout or a
# cap in the middle doesn't skew it), rotated with the tile; 'center' = tile center; 'feet' = bottom center.
# w = piece width as a fraction of the tile width; dx/dy in tile widths; z = 'behind' | 'front'.
SPECS = {
    'halloween': {
        'u-alt3': dict(hero='u', caption='Alternate: U as a bat (right side up this time): scalloped bat wings behind him, bat-ear headband.', layers=[
            dict(piece='bat-wings', z='behind', anchor='center', w=2.1, dx=0, dy=-0.22),
            dict(piece="bat-ears", z="front", anchor="top", w=1.0, dx=0, dy=0.52)]),
        'i-alt2': dict(hero='i', geom=dict(top=(472, 197), angle=-2, center=(472, 540)), caption='Alternate: I as a little witch: black witch hat with an orange band, his sprout still on top, jack-o\'-lantern candy pail.', keep_top=True, layers=[
            dict(piece='witch-hat', z='front', anchor='top', w=1.6, dx=0.0, dy=0.30, rot=-4),
            dict(piece='candy-pail', z='front', anchor='feet', w=0.75, dx=0.85, dy=-0.15)]),
        's-alt2': dict(hero='s', caption='Alternate: S as a black cat: cat-ear headband above his own headband, curly tail with an orange bow.', layers=[
            dict(piece="cat-ears-pink", z="behind", anchor="top", w=1.0, dx=0.0, dy=0.5),
            dict(piece='cat-tail', z='behind', anchor='center', w=0.42, dx=-0.62, dy=0.12, rot=18)]),
    },
    'thanksgiving': {},   # filled below once its sheets exist
}


def load_specs_extra():
    p = os.path.join(ROOT, 'thanksgiving', 'specs.json')
    if os.path.exists(p):
        SPECS['thanksgiving'].update(json.load(open(p)))


def split(capture, season, sheet, names):
    sd = os.path.join(ROOT, season)
    os.makedirs(os.path.join(sd, 'raw'), exist_ok=True)
    DEST = os.environ.get('DEST', 'pieces')
    os.makedirs(os.path.join(sd, DEST), exist_ok=True)
    Image.open(capture).convert('RGB').save(os.path.join(sd, 'raw', sheet + '.webp'), quality=92)
    keyed = os.path.join('/tmp' if not os.environ.get('TMPDIR') else os.environ['TMPDIR'], f'keyed-{sheet}.png')
    subprocess.run([sys.executable, os.path.join(BRAND, 'key-capture.py'), capture, 'full', os.environ.get('KEY', 'cyan'), keyed, 'native-all'], check=True)
    im = Image.open(keyed).convert('RGBA')
    A = np.asarray(im)
    solid = A[..., 3] > 30
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=int(os.environ.get('MERGE', '8'))))
    blobs = []
    for i in range(1, n + 1):
        ys, xs = np.where((lab == i) & solid)
        if len(ys) < 400:
            continue
        blobs.append((ys.min(), ys.max(), xs.min(), xs.max(), i))
    # row-major: cluster by vertical center
    blobs.sort(key=lambda b: (b[0] + b[1]) / 2)
    rows, cur = [], []
    for b in blobs:
        if cur and (b[0] + b[1]) / 2 - (cur[-1][0] + cur[-1][1]) / 2 > (b[1] - b[0]) * 0.6:
            rows.append(cur); cur = []
        cur.append(b)
    rows.append(cur)
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
    if len(ordered) != len(names):
        print('WARNING: found', len(ordered), 'pieces for', len(names), 'names')
    for b, nm in zip(ordered, names):
        P = A.copy(); P[..., 3] = np.where(lab == b[4], P[..., 3], 0)
        piece = Image.fromarray(P, 'RGBA').crop((b[2], b[0], b[3] + 1, b[1] + 1))
        piece.save(os.path.join(sd, DEST, nm + '.png')); print(nm, piece.size)


def tile_geometry(A):
    """Head line (angle, point), head width W (the unit for every spec), tile center and feet, from the hero's alpha.
    W is the width of the head itself (the solid run through the center a little below the top), so arms, motion
    lines or held props don't inflate it."""
    solid = A > 128
    ys, xs = np.where(solid)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    # topmost body rows: skip thin things on top (sprout, cap tip) by looking for a row that is wide
    xc = (x0 + x1) / 2
    def longest(y):
        e = np.diff(np.concatenate([[0], solid[y].astype(np.int8), [0]]))
        st, en = np.where(e == 1)[0], np.where(e == -1)[0]
        return int((en - st).max()) if len(st) else 0
    for y in range(y0, y1 - 40):
        if longest(y) > (x1 - x0) * 0.45 and longest(y + 30) >= longest(y):
            break
    yh = int(y + (y1 - y0) * 0.08)
    row = solid[yh].astype(np.int8)
    edges = np.diff(np.concatenate([[0], row, [0]]))
    starts, ends = np.where(edges == 1)[0], np.where(edges == -1)[0] - 1
    j = int(np.argmax(ends - starts))
    l, r = starts[j], ends[j]
    W, xh = r - l, (l + r) / 2
    pts = []
    for fr in list(np.linspace(-0.36, -0.2, 8)) + list(np.linspace(0.2, 0.36, 8)):
        x = int(xh + W * fr)
        col = np.where(solid[:, x])[0]
        if len(col):
            pts.append((x, col.min()))
    pts = np.array(pts, float)
    k, b = np.polyfit(pts[:, 0], pts[:, 1], 1)
    return dict(x0=x0, x1=x1, y0=y0, y1=y1, W=W, angle=math.degrees(math.atan(k)), top=(xh, k * xh + b),
                center=(xh, (y0 + y1) / 2), feet=(xh, y1))


def build(season):
    load_specs_extra()
    sd = os.path.join(ROOT, season)
    report = {}
    for out, spec in SPECS[season].items():
        hero = Image.open(os.path.join(BRAND, 'cast/hero', spec['hero'] + '.png')).convert('RGBA')
        A = np.asarray(hero)[..., 3]
        g = tile_geometry(A)
        g.update({k: tuple(v) if isinstance(v, list) else v for k, v in spec.get('geom', {}).items()})
        PAD = 420
        canvas_size = (hero.width + 2 * PAD, hero.height + 2 * PAD)
        back = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
        front = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
        for L in spec['layers']:
            p = Image.open(os.path.join(sd, 'pieces', L['piece'] + '.png')).convert('RGBA')
            if L.get('flip'):
                p = p.transpose(Image.FLIP_LEFT_RIGHT)
            wpx = g['W'] * L['w']
            p = p.resize((max(1, round(wpx)), max(1, round(p.height * wpx / p.width))), Image.LANCZOS)
            ax, ay = g[L['anchor']]
            ax += L.get('dx', 0) * g['W']; ay += L.get('dy', 0) * g['W']
            ang = (g['angle'] if L['anchor'] == 'top' else 0) + L.get('rot', 0)
            # rotate about the piece's anchor point: bottom-center for 'top'/'feet', center otherwise
            if L['anchor'] in ('top', 'feet'):
                pivot = (p.width / 2, p.height)
            else:
                pivot = (p.width / 2, p.height / 2)
            big = Image.new('RGBA', (p.width * 3, p.height * 3), (0, 0, 0, 0))
            big.alpha_composite(p, (p.width, p.height))
            big = big.rotate(-ang, Image.BICUBIC, center=(p.width + pivot[0], p.height + pivot[1]))
            pos = (round(ax + PAD - p.width - pivot[0]), round(ay + PAD - p.height - pivot[1]))
            _paste_clip(back if L['z'] == 'behind' else front, big, pos)
        # behind-pieces never show THROUGH the character (some heroes have soft, part-transparent eyes or lids):
        # clear the back layer inside the hero's filled silhouette
        sil = ndimage.binary_fill_holes(np.asarray(hero)[..., 3] > 8)
        bk = np.asarray(back).copy()
        sub = bk[PAD:PAD + hero.height, PAD:PAD + hero.width]
        sub[..., 3] = np.where(sil, 0, sub[..., 3])
        back = Image.fromarray(bk, 'RGBA')
        comp = back.copy()
        comp.alpha_composite(hero, (PAD, PAD))
        comp.alpha_composite(front)
        if spec.get('keep_top'):   # put the hero's own top feature (sprout, nightcap tip) back in front of a hat
            top_mask = _top_feature(hero, g)
            feat = hero.copy(); feat.putalpha(Image.fromarray(np.minimum(np.asarray(hero)[..., 3], top_mask)))
            comp.alpha_composite(feat, (PAD, PAD))
        # face/letter check: box over eyes, mouth and letter (central 56 % x, 22..82 % y of the tile)
        H = np.asarray(hero).astype(np.float32)
        C = np.asarray(comp).astype(np.float32)[PAD:PAD + hero.height, PAD:PAD + hero.width]
        fx0, fx1 = int(g['top'][0] - g['W'] * 0.40), int(g['top'][0] + g['W'] * 0.40)
        Ht = g['y1'] - g['y0']
        fy0, fy1 = int(g['top'][1] + (g['y1'] - g['top'][1]) * 0.12), int(g['y0'] + Ht * 0.82)
        box = (slice(fy0, fy1), slice(fx0, fx1))
        m = H[box][..., 3] > 200
        face = float(np.abs(C[box][..., :3] - H[box][..., :3])[m].mean())
        # final: crop, fit 900 max into 1024 (night-1 framing)
        bb = comp.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        comp = comp.crop(bb)
        s = 900 / max(comp.size)
        comp = comp.resize((round(comp.width * s), round(comp.height * s)), Image.LANCZOS)
        final = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
        final.alpha_composite(comp, ((1024 - comp.width) // 2, (1024 - comp.height) // 2))
        os.makedirs(os.path.join(sd, 'cast'), exist_ok=True)
        final.save(os.path.join(sd, 'cast', out + '.png'))
        report[f'{season}/cast/{out}.png'] = dict(method='layered', hero=spec['hero'], faceRegionDiff=round(face, 3),
                                                  pieces=[L['piece'] for L in spec['layers']], caption=spec.get('caption', ''))
        print(out, 'face diff', round(face, 3))
    p = os.path.join(sd, 'layered.json')
    old = json.load(open(p)) if os.path.exists(p) else {}
    old.update(report)
    json.dump(old, open(p, 'w'), indent=1)


def _paste_clip(dst, src, pos):
    x, y = pos
    cx0, cy0 = max(0, -x), max(0, -y)
    src = src.crop((cx0, cy0, src.width, src.height))
    dst.alpha_composite(src, (max(0, x), max(0, y)))


def _top_feature(hero, g):
    """Mask of whatever rises above the head line (sprout, cap tip), so it can go back in front of a hat."""
    A = np.asarray(hero)[..., 3]
    yy, xx = np.mgrid[0:A.shape[0], 0:A.shape[1]]
    k = math.tan(math.radians(g['angle']))
    line = g['top'][1] + k * (xx - g['top'][0])
    m = (yy < line - 4) & (A > 0)
    return (ndimage.binary_dilation(m, iterations=1) * 255).astype(np.uint8)


if __name__ == '__main__':
    if sys.argv[1] == 'split':
        split(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5:])
    else:
        build(sys.argv[2] if len(sys.argv) > 2 else 'halloween')
