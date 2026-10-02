# Stitch a ChatGPT wallpaper from browser-pane shots (top to bottom), crop the image card,
# paint out the Edit/share buttons and drop ChatGPT's bottom shading.
#   python3 wallpapers/capture-wallpaper.py <out-name> <shot1.jpg> <shot2.jpg> ...
import os, subprocess, sys
import numpy as np, cv2
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
name, shots = sys.argv[1], sys.argv[2:]
raw = os.path.join(HERE, f'{name}-raw.png')
subprocess.run(['python3', os.path.join(HERE, '..', 'stitch.py'), raw, *shots], check=True,
               env={**os.environ, 'STITCH_BOT': '140'}, capture_output=True)
im = np.array(Image.open(raw).convert('RGB'))
col = im[:, 260].sum(axis=1) > 150
runs, s = [], None
for y in range(len(col)):
    if col[y] and s is None: s = y
    if not col[y] and s is not None: runs.append((s, y)); s = None
if s is not None: runs.append((s, len(col)))
top, bot = max(runs, key=lambda r: r[1] - r[0])
row = im[(top + bot) // 2].sum(axis=1) > 150
xs = np.nonzero(row)[0]; x0, x1 = xs[0], xs[-1]
card = im[top + 12:bot - 12, x0 + 10:x1 - 10].copy()
h, w = card.shape[:2]
mask = np.zeros((h, w), np.uint8)
cv2.rectangle(mask, (0, h - 68), (80, h - 1), 255, -1); cv2.rectangle(mask, (w - 72, h - 68), (w - 1, h - 1), 255, -1)
out = cv2.inpaint(card, mask, 25, cv2.INPAINT_TELEA)
blur = cv2.GaussianBlur(out, (0, 0), 9); m3 = cv2.GaussianBlur(mask, (0, 0), 6)[..., None] / 255.0
out = (out * (1 - m3) + blur * m3).astype('uint8')
# drop the darkened bottom band (rows darker than 92% of the median brightness)
b = out.reshape(h, -1).mean(axis=1); med = np.median(b)
cut = h
while cut > h * 0.8 and b[cut - 1] < med * 0.92:
    cut -= 1
Image.fromarray(out[:cut]).save(os.path.join(HERE, f'{name}-capture.png'))
print(name, w, cut)
