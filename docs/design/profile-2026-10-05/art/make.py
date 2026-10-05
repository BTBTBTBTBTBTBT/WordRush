# ChatGPT art for the Stage / Dressing Room / Title Shelves (founder 10-05: "utilize ChatGPT for the design
# of the stages"). Captures: the generated image shown 1:1 in a page overlay at 0.5 CSS scale and grabbed in
# 1000-px device tiles (no downloads); raw/<sheet>-t<i>.png + the CSS x/y offset of each tile below.
#   python3 docs/design/profile-2026-10-05/art/make.py <sheet>
# Writes keyed pieces <sheet>-<n>.png (sorted left→right, or top→bottom with --rows) next to this file.
import os, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
KEYER = os.path.join(HERE, '..', '..', 'brand', 'key-capture.py')
# sheet: (tiles [(file, css_x, css_y)], key color, piece order)
SHEETS = {
    'podiums': ([('podiums-t0', 0, 0), ('podiums-t1', 471, 0)], 'cyan', 'x'),
    'ribbons': ([('ribbons-t0', 0, 0), ('ribbons-t1', 388, 0)], 'cyan', 'y'),
    'room': ([('room-t0', 0, 0), ('room-t1', 268, 0)], 'cyan', 'yx'),
    'shelf': ([('shelf-t0', 0, 0), ('shelf-t1', 471, 0)], 'cyan', 'boxes'),
    'host': ([('host-t0', 0, 0), ('host-t1', 477, 0)], 'cyan', 'boxes'),
    'none': ([('none-t0', 0, 0)], 'green', 'boxes'),
    'tabs': ([('tabs-t0', 0, 0), ('tabs-t1', 387, 0)], 'green', 'yx', 22, 400),
}

# explicit piece boxes (stitched sheet px) for 'boxes' sheets
BOXES = {
    'none': [(330, 150, 830, 650)],
    'host': [(40, 100, 715, 560), (735, 220, 1395, 430), (1410, 90, 1930, 570)],
    'shelf': [(150, 80, 1800, 320), (60, 350, 1880, 540, (560, 470, 1460, 540)), (590, 520, 1110, 740), (1200, 480, 1430, 760)],
}


def stitch(tiles):
    ims = [(Image.open(os.path.join(HERE, 'raw', f + '.png')).convert('RGB'), x * 2, y * 2) for f, x, y in tiles]
    W = max(x + im.width for im, x, y in ims); H = max(y + im.height for im, x, y in ims)
    out = Image.new('RGB', (W, H), ims[0][0].getpixel((4, 4)))
    for im, x, y in ims:
        out.paste(im.crop((0, 0, im.width, im.height - 2)), (x, y))   # the last device row can be black
    return out.crop((0, 0, W, H - 2))


def pieces(name):
    tiles, key, order, *rest = SHEETS[name]
    grow, bucket = (rest + [6, 200])[:2] if rest else (6, 200)
    sheet = stitch(tiles)
    src = os.path.join(HERE, 'raw', name + '-sheet.png'); sheet.save(src)
    keyed = os.path.join(HERE, 'raw', name + '-keyed.png')
    subprocess.run(['python3', KEYER, src, 'full', key, keyed, 'native-all' if name in ('tabs', 'shelf', 'none') else 'native'], check=True)
    im = Image.open(keyed); a = np.asarray(im)[..., 3] > 40
    if order == 'boxes':   # explicit pieces (sheet px, before the keyer's trim): mixed sizes on one sheet
        # the keyer trims to the content bbox: recover its offset from the sheet
        full = np.asarray(Image.open(src).convert('RGB')).astype(int)
        k = full[4, 4]; d = np.abs(full - k).sum(2) > 120
        ys, xs = np.nonzero(d); ox, oy = xs.min(), ys.min()
        for i, (x0, y0, x1, y1, *erase) in enumerate(BOXES[name]):
            piece = im.crop((x0 - ox, y0 - oy, x1 - ox, y1 - oy))
            for ex0, ey0, ex1, ey1 in erase:   # neighbours poking into the box
                piece.paste((0, 0, 0, 0), (ex0 - x0, ey0 - y0, ex1 - x0, ey1 - y0))
            piece = piece.crop(piece.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
            out = os.path.join(HERE, f'{name}-{i + 1}.png'); piece.save(out); print(out, piece.size)
        return
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=grow))
    objs = [s for s in ndimage.find_objects(lab) if s is not None]
    big = [s for s in objs if (s[0].stop - s[0].start) * (s[1].stop - s[1].start) > a.size * 0.01]
    big.sort(key=lambda s: s[1].start if order == 'x' else s[0].start if order == 'y' else (s[0].start // bucket, s[1].start))
    for i, s in enumerate(big):
        piece = im.crop((s[1].start, s[0].start, s[1].stop, s[0].stop))
        piece = piece.crop(piece.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
        out = os.path.join(HERE, f'{name}-{i + 1}.png'); piece.save(out); print(out, piece.size)


if __name__ == '__main__':
    for n in sys.argv[1:]:
        pieces(n)
