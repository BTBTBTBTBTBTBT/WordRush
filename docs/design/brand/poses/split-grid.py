# VS pose sheets (founder 10-02: "make new and exciting images of the mascots" for every VS screen):
# ChatGPT draws one character per prompt as a SQUARE 2x2 grid of four poses on flat cyan
# (ready / victory / goodgame / waiting). The pane shows it in several scroll frames.
#   python3 poses/split-grid.py <id> <shot1> <shot2> [...]
# Stitches the frames (stitch.py logic), finds the cyan card, paints out ChatGPT's Edit / share
# buttons and the scroll arrow, keys the cyan out, splits the four quadrants and writes
# poses/<id>-ready.png, -victory.png, -goodgame.png, -waiting.png (trimmed, transparent).
import os, subprocess, sys
import cv2
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
cid, shots = sys.argv[1], sys.argv[2:]
KEY = os.environ.get('KEY', 'cyan')


def wide_frame(path):
    # The pane alternates between two layouts; keep only the wide one (image card reaches past x=540).
    a = cv2.imread(path).astype(int); b_, g_, r_ = a[..., 0], a[..., 1], a[..., 2]
    k = ((g_ > 180) & (b_ > 180) & (r_ < 170)) if KEY == 'cyan' else ((r_ > 180) & (b_ > 180) & (g_ < 170))
    xs = np.nonzero(k.any(axis=0))[0]
    return len(xs) and xs.max() > 540


shots = [p for p in shots if wide_frame(p)]
print('frames kept', len(shots))
tmp = f'/tmp/grid-{cid}'
subprocess.run(['python3', os.path.join(BRAND, 'stitch.py'), tmp + '-stitched.png', *shots], check=True,  # stitch.py keeps the LOWER frame's half of each overlap
               capture_output=True, env={**os.environ, 'STITCH_BOT': os.environ.get('STITCH_BOT', '116')})
im = cv2.imread(tmp + '-stitched.png')
b, g, r = [im[..., i].astype(int) for i in range(3)]
cyan = ((g > 180) & (b > 180) & (r < 170)) if KEY == 'cyan' else ((r > 180) & (b > 180) & (g < 170))
ys, xs = np.nonzero(cyan)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
# overlays: Edit pill bottom-left, share circle bottom-right, scroll arrow bottom-center
m = np.zeros(im.shape[:2], np.uint8)
cv2.rectangle(m, (x0 + 8, y1 - 52), (x0 + 72, y1 - 8), 255, -1)
cv2.circle(m, (x1 - 32, y1 - 30), 24, 255, -1)
dark = (im.max(axis=2) < 60).astype(np.uint8) * 255          # the black arrow button wherever it sat
dark[:y0] = 0; dark[y1:] = 0; dark[:, :x0] = 0; dark[:, x1:] = 0
n, lab, stats, _ = cv2.connectedComponentsWithStats(dark)
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if 20 < w < 46 and 20 < h < 46 and area > 250 and 375 < x + w / 2 < 425:   # the pane's arrow column only (not a dark mouth)
        cv2.circle(m, (x + w // 2, y + h // 2), max(w, h) // 2 + 4, 255, -1)
im = cv2.inpaint(im, m, 7, cv2.INPAINT_TELEA)
# inside the painted-out areas keep only saturated character colors; washed-out fill becomes key cyan
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
wash = (cv2.dilate(m, np.ones((9, 9), np.uint8)) > 0) & (hsv[..., 1] < 110)
bgc = np.median(im[y0 + 6:y0 + 26, x0 + 6:x0 + 60].reshape(-1, 3), axis=0)   # the capture's real key shade
im[wash] = bgc
cv2.imwrite(tmp + '-clean.png', im)
box = f'{x0 + 4},{y0 + 4},{x1 - 4},{y1 - 4}'
subprocess.run(['python3', os.path.join(BRAND, 'key-capture.py'), tmp + '-clean.png', box, KEY, tmp + '-keyed.png'], check=True,
               capture_output=True)
key = Image.open(tmp + '-keyed.png').convert('RGBA')
a = np.asarray(key.getchannel('A'))
bx = Image.fromarray(a).point(lambda v: 255 if v > 24 else 0).getbbox()
key = key.crop(bx); W, H = key.size
names = ['ready', 'victory', 'goodgame', 'waiting']
# Assign every connected piece to a quadrant by its centroid (props like an hourglass or trophy can
# reach across the midline, so never cut at a fixed half), then crop each quadrant's union of pieces.
full = np.asarray(key).copy()
al_full = full[..., 3] > 40
nn, lab, st, cen = cv2.connectedComponentsWithStats(al_full.astype(np.uint8))
quad = np.zeros(nn, int)
for i in range(1, nn):
    cx, cy = cen[i]
    quad[i] = (1 if cx >= W / 2 else 0) + (2 if cy >= H / 2 else 0)
for k in range(4):
    ids = [i for i in range(1, nn) if quad[i] == k]
    if not ids:
        continue
    big = max(ids, key=lambda i: st[i, 4])
    keep_ids = [i for i in ids if st[i, 4] > st[big, 4] * 0.02]
    keep = np.isin(lab, keep_ids)
    arr = full.copy(); arr[~keep, 3] = 0
    q = Image.fromarray(arr)
    # cyan-ish smears left where ChatGPT's buttons / scroll arrow were painted out
    arr = np.asarray(q).copy().astype(int)
    r_, g_, b_ = arr[..., 0], arr[..., 1], arr[..., 2]
    teal = (((g_ > r_ + 25) & (b_ > r_ + 25) & (abs(g_ - b_) < 45)) if os.environ.get('TEALKILL', '1') == '1' else np.zeros(g_.shape, bool)) if KEY == 'cyan' else ((r_ > g_ + 60) & (b_ > g_ + 60) & (abs(r_ - b_) < 50))
    if KEY == 'cyan' and os.environ.get('BLUEKILL', '1') == '1':   # the darkened cyan fade; off for blue/teal characters (D, C)
        teal |= (g_ > r_ + 25) & (b_ > r_ + 40)
    arr[teal, 3] = 0
    if os.environ.get('DESMEAR', '1') == '1':   # off for the grey R (it would eat him)
        mx = arr[..., :3].max(axis=2); mn = arr[..., :3].min(axis=2)
        sat = (mx - mn) / np.maximum(mx, 1)
        band = np.zeros(sat.shape, bool); band[int(sat.shape[0] * 0.8):] = True
        arr[band & (sat < 0.3) & (mx < 215), 3] = 0
    # leftover pure key color in the bottom strip (where ChatGPT's Edit / share buttons were)
    hh = arr.shape[0]; low = np.zeros(arr.shape[:2], bool); low[int(hh * 0.82):] = True
    if KEY == 'cyan':
        pure = (arr[..., 1] > 170) & (arr[..., 2] > 170) & (arr[..., 0] < 150)
    else:
        pure = (arr[..., 0] > 170) & (arr[..., 2] > 170) & (arr[..., 1] < 150)
    arr[low & pure, 3] = 0
    q = Image.fromarray(arr.astype('uint8'))
    q = q.crop(q.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
    q.save(os.path.join(HERE, f'{cid}-{names[k]}.png'))
    print(cid, names[k], q.size)
