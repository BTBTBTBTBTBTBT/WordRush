# Split a transparent API sheet into a cols x rows grid of pieces by connected-component centroid.
#   python3 split-grid-api.py <sheet.png> <cols> <rows> <outdir> name1 name2 ...   (row-major; '-' skips a cell)
import os, sys
import cv2
import numpy as np
from PIL import Image
src, cols, rows, outdir, names = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5:]
os.makedirs(outdir, exist_ok=True)
im = Image.open(src).convert('RGBA'); a = np.asarray(im).copy(); W, H = im.size
n, lab, st, cen = cv2.connectedComponentsWithStats((a[..., 3] > 40).astype(np.uint8))
for k, name in enumerate(names):
    if name == '-': continue
    cx, cy = k % cols, k // cols
    ids = [i for i in range(1, n) if min(int(cen[i][0] * cols / W), cols - 1) == cx and min(int(cen[i][1] * rows / H), rows - 1) == cy]
    if not ids: print('EMPTY', name); continue
    big = max(st[i, 4] for i in ids)
    keep = np.isin(lab, [i for i in ids if st[i, 4] > big * 0.004])
    keep = cv2.dilate(keep.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    q = a.copy(); q[~keep, 3] = 0
    out = Image.fromarray(q); out = out.crop(out.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox())
    out.save(os.path.join(outdir, f'{name}.png')); print(name, out.size)
