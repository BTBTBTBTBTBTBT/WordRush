#!/usr/bin/env python3
"""The button FAMILY (founder 10-05: "let's prioritize getting all of the buttons designed"): everything that
is not a primary cast button. ChatGPT (free, browser) drew the raw sheets in raw/; this keys them and writes
TINTABLE sprites to out/:

  LIGHT MAPS (fam-lm-*): the ChatGPT gloss + shading of a pill / key as a white-or-black overlay with alpha,
  measured against the piece's own base color. Any fill color + its light map = that color in the ChatGPT
  finish, so one sprite serves every game tint, both themes and the colorblind tile palettes, with no blend
  modes and no per-color art (a plain fill + one image on every platform).
     fam-lm-frost[-pressed]   the frosted jelly pill  (helper pills, quiet pills, round discs)   THREE-SLICE, caps = h/2
     fam-lm-pearl[-pressed]   the pearl pill          (option B)                                  THREE-SLICE, caps = h/2
     fam-lm-key / fam-lm-keyfrost                      keyboard key caps                            NINE-SLICE, corner = KEY_R
  ICONS (fam-ic-*): soft 3D white clay icons; tint by MULTIPLY (iOS colorMultiply, Android Modulate,
     web mix-blend multiply over a masked fill) so the clay shading stays.
  COLOR ICONS (fam-cic-*): close X, info, back chevron, rare-word gems, star (drawn in color).

  python3 make-family.py            # sprites → out/, previews → preview/
"""
import os, subprocess, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.path.join(HERE, '..', '..', 'key-capture.py')
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
PY = '/opt/homebrew/bin/python3'
PILL_H = 132          # 44 pt @3x — the sprite height; every pill height downsamples from it
KEY_H = 150           # 50 pt @3x
ICON_BOX = 144        # icons fit a 144 px square (48 pt @3x)


def keyed(name, key, mode='native'):
    out = os.path.join(RAW, name + '-keyed.png')
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(os.path.join(RAW, name + '.png')):
        subprocess.run([PY, KEY, os.path.join(RAW, name + '.png'), 'full', key, out, mode], check=True, capture_output=True)
    return Image.open(out).convert('RGBA')


def blobs(im, min_px=3000, row_tol=120):
    a = np.asarray(im)[..., 3] > 60
    lab, n = ndimage.label(a)
    objs = [o for i, o in enumerate(ndimage.find_objects(lab)) if (lab[o] == i + 1).sum() > min_px]
    objs.sort(key=lambda o: (round(o[0].start / row_tol), o[1].start))
    return [im.crop((o[1].start, o[0].start, o[1].stop, o[0].stop)) for o in objs]


def grid_cells(im, cols=4, rows=4, min_px=400):
    """Icons made of several parts (sparkles, the i dot): every component goes to the grid cell its center
    falls in; returns one trimmed image per cell, row by row."""
    arr = np.asarray(im)
    a = arr[..., 3] > 60
    H, W = a.shape
    lab, n = ndimage.label(a)
    cells = {}
    for i, o in enumerate(ndimage.find_objects(lab)):
        if (lab[o] == i + 1).sum() < min_px:
            continue
        cy = int((o[0].start + o[0].stop) / 2 / (H / rows)); cx = int((o[1].start + o[1].stop) / 2 / (W / cols))
        cells.setdefault((cy, cx), []).append(i + 1)
    out = []
    for k in sorted(cells):
        m = np.isin(lab, cells[k])
        m = ndimage.binary_dilation(m, iterations=3)
        crop = arr.copy()
        crop[..., 3] = np.where(m, crop[..., 3], 0)
        out.append(trim(Image.fromarray(crop)))
    return out


def trim(im):
    bb = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    return im.crop(bb) if bb else im


def symmetric(p):
    a = np.asarray(p).astype(np.float32)
    return Image.fromarray(((a + a[:, ::-1]) / 2).astype(np.uint8), 'RGBA')


def lum(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def light_map(p, strength=1.0):
    """White-or-black overlay that turns a flat fill of the piece's base color back into the piece."""
    a = np.asarray(p).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3]
    L = lum(rgb)
    h, w = L.shape
    core = L[int(h * .3):int(h * .7), int(w * .3):int(w * .7)]
    Lc = float(np.median(core))
    up = np.clip((L - Lc) / max(1e-3, 1 - Lc), 0, 1)
    dn = np.clip((Lc - L) / max(1e-3, Lc), 0, 1)
    out = np.zeros((h, w, 4), np.float32)
    white = up > dn
    out[..., :3] = np.where(white[..., None], 1.0, 0.0)
    out[..., 3] = np.where(white, up, dn) * strength * al
    return Image.fromarray((out * 255).round().astype(np.uint8), 'RGBA'), Lc


def capsule_mask(w, h, ss=4):
    m = Image.new('L', (w * ss, h * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * ss - 1, h * ss - 1), radius=h * ss // 2, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def rrect_mask(w, h, r, ss=4):
    m = Image.new('L', (w * ss, h * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * ss - 1, h * ss - 1), radius=r * ss, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def fit_h(im, h):
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def three_slice(sprite, w):
    """Stretch a pill sprite to width w: caps = h/2 drawn as is, the middle column stretched."""
    h = sprite.height
    cap = h // 2
    if w <= 2 * cap:
        return sprite.resize((max(1, w), h), Image.LANCZOS) if w < sprite.width else sprite
    out = Image.new('RGBA', (w, h))
    out.paste(sprite.crop((0, 0, cap, h)), (0, 0))
    mid = sprite.crop((sprite.width // 2, 0, sprite.width // 2 + 1, h)).resize((w - 2 * cap, h))
    out.paste(mid, (cap, 0))
    out.paste(sprite.crop((sprite.width - cap, 0, sprite.width, h)), (w - cap, 0))
    return out


def save(name, im):
    im.save(os.path.join(OUT, name + '.png'), optimize=True)


def main():
    meta = {}
    # ── pills: pearl, pearl pressed, frost, frost pressed, pearl disc, frost disc
    sk = blobs(keyed('skins-a', 'cyan'))
    assert len(sk) == 6, len(sk)
    names = ['pearl', 'pearl-pressed', 'frost', 'frost-pressed']
    for nm, p in zip(names, sk[:4]):
        p = fit_h(symmetric(trim(p)), PILL_H)
        lm, Lc = light_map(p)
        save(f'fam-lm-{nm}', lm)
        save(f'fam-src-{nm}', p)
        meta[nm] = {'w': p.width, 'h': p.height, 'baseLum': round(Lc, 3)}
    for nm, p in zip(['pearl-disc', 'frost-disc'], sk[4:]):
        save(f'fam-src-{nm}', fit_h(symmetric(trim(p)), PILL_H))
    # ── keys: row 1 glossy pearl/purple/gold/slate, row 2 frosted ×4, row 3 wide ×2
    ks = blobs(keyed('keys', 'cyan'), row_tol=300)
    assert len(ks) == 10, len(ks)
    for nm, p in [('key', ks[0]), ('keyfrost', ks[4])]:
        p = fit_h(symmetric(trim(p)), KEY_H)
        lm, Lc = light_map(p)
        save(f'fam-lm-{nm}', lm)
        save(f'fam-src-{nm}', p)
        meta[nm] = {'w': p.width, 'h': p.height, 'baseLum': round(Lc, 3), 'cornerPx': round(p.width * 0.25)}
    for i, nm in enumerate(['key-purple', 'key-gold', 'key-slate']):
        save(f'fam-src-{nm}', fit_h(symmetric(trim(ks[1 + i])), KEY_H))
    # ── white clay icons (4 × 4)
    order = ['delete', 'shuffle', 'enter', 'hint', 'eye', 'flag', 'check', 'undo',
             'next', 'refresh', 'sparkles', 'pencil', 'erase', 'xmark', 'play', 'chart']
    icons = grid_cells(keyed('icons1', 'cyan'))
    # merge_near groups by rows of 200 px; re-sort by the 4 × 4 grid of the 1412 × 1112 sheet
    assert len(icons) == 16, len(icons)
    for nm, im in zip(order, icons):
        im = trim(im)
        s = min(ICON_BOX / im.width, ICON_BOX / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        save(f'fam-ic-{nm}', im)
    # ── color icons (3 × 2, magenta key)
    cic = grid_cells(keyed('icons-color', 'magenta'), cols=3, rows=2)
    assert len(cic) == 6, len(cic)
    for nm, im in zip(['close', 'info', 'back', 'gem', 'gem-gold', 'star'], cic):
        s = min(ICON_BOX / im.width, ICON_BOX / im.height)
        save(f'fam-cic-{nm}', im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS))
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
    print('ok', meta)


if __name__ == '__main__':
    main()
