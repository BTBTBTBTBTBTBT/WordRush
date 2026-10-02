# Wallpapers (founder, 2026-10-02: "I love the background … of the layout targets. That
# wallpaper specifically … on the main page and subtle variations and color versions of it
# for the other menus and backgrounds for the games … match the games main color").
# Source: ChatGPT wallpaper capture (home-wallpaper-capture.png, lilac). Color versions are a
# hue rotation of the whole image so the dominant lilac lands on the target hue (tile variety
# is kept), then a light lift toward white so content stays readable.
import colorsys, os, re
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
src = Image.open(os.path.join(HERE, 'home-wallpaper-capture.png')).convert('RGB')
src = src.crop((0, 0, src.width, 600))                      # drop ChatGPT's bottom shading
W = 1080; H = round(src.height * W / src.width)
base = src.resize((W, H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
a = np.asarray(base).astype(np.float32) / 255
# vectorized RGB→HSV
mx = a.max(axis=2); mn = a.min(axis=2); d = mx - mn
hue = np.zeros_like(mx)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
m = d > 1e-6
rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
hue[rm] = ((g - b)[rm] / d[rm]) % 6
hue[gm] = ((b - r)[gm] / d[gm]) + 2
hue[bm] = ((r - g)[bm] / d[bm]) + 4
hue = hue / 6
sat = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0); val = mx
# dominant hue of the source (weighted by saturation)
hist, edges = np.histogram(hue[sat > 0.15], bins=72, range=(0, 1), weights=sat[sat > 0.15])
src_h = (edges[np.argmax(hist)] + edges[np.argmax(hist) + 1]) / 2


def hsv2rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    out = np.zeros(h.shape + (3,), np.float32)
    for k, (x, y, z) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        sel = i == k
        out[sel] = np.stack([x[sel], y[sel], z[sel]], -1)
    return out


def variant(target_hex, lift=0.0, sat_scale=1.0):
    th = colorsys.rgb_to_hsv(*[int(target_hex[i:i + 2], 16) / 255 for i in (1, 3, 5)])[0]
    h2 = (hue + (th - src_h)) % 1
    rgb = hsv2rgb(h2, np.clip(sat * sat_scale, 0, 1), val)
    rgb = rgb * (1 - lift) + lift
    return Image.fromarray((rgb.clip(0, 1) * 255).astype('uint8'))


OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
base.save(os.path.join(OUT, 'wall-home.png'))
PAGES = {'leaderboard': '#f59e0b', 'stats': '#3b82f6', 'friends': '#ec4899', 'vs': '#14b8a6'}
for n, hx in PAGES.items():
    variant(hx, 0.04).save(os.path.join(OUT, f'wall-{n}.png'))
# one per game, from the catalog accents
s = open(os.path.join(REPO, 'apps', 'web', 'lib', 'modes.generated.ts')).read()
for blk in re.findall(r'\{\s*"id":.*?\n  \}', s, re.S):
    mid = re.search(r'"id":\s*"([^"]+)"', blk).group(1)
    acc = re.search(r'"accentHex":\s*"([^"]+)"', blk).group(1)
    if mid in ('vs', 'more'):
        continue
    # games: a touch lighter + calmer so boards read clearly
    variant(acc, 0.12, 0.85).save(os.path.join(OUT, f'wall-game-{mid}.png'))
print('wallpapers', len(os.listdir(OUT)), W, H)
