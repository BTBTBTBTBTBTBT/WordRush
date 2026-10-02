# Split an API pose sheet (poses/api/<id>-vs-sheet.png, transparent 2x2) into
# poses/<id>-ready|victory|goodgame|waiting.png. Every connected piece goes to the quadrant of its
# centroid (props may cross the midline), then each quadrant is trimmed.
#   python3 poses/split-api.py d i o2 ...
import os, sys
import cv2
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ['ready', 'victory', 'goodgame', 'waiting']
for cid in sys.argv[1:]:
    im = Image.open(os.path.join(HERE, 'api', f'{cid}-vs-sheet.png')).convert('RGBA')
    a = np.asarray(im).copy(); W, H = im.size
    n, lab, st, cen = cv2.connectedComponentsWithStats((a[..., 3] > 40).astype(np.uint8))
    for k in range(4):
        ids = [i for i in range(1, n) if ((1 if cen[i][0] >= W / 2 else 0) + (2 if cen[i][1] >= H / 2 else 0)) == k]
        if not ids:
            continue
        big = max(st[i, 4] for i in ids)
        keep = np.isin(lab, [i for i in ids if st[i, 4] > big * 0.004])
        keep = cv2.dilate(keep.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0   # keep soft edges
        q = a.copy(); q[~keep, 3] = 0
        out = Image.fromarray(q)
        out = out.crop(out.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox())
        out.save(os.path.join(HERE, f'{cid}-{NAMES[k]}.png'))
        print(cid, NAMES[k], out.size)
