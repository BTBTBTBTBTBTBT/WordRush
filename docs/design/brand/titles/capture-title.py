# Cut a ChatGPT day-title capture (browser pane screenshot, 800x945 frame) out of
# its green background: crop the image card, paint over ChatGPT's Edit/share
# overlay buttons with the key color, then key it (key-capture.py).
#   python3 titles/capture-title.py <screenshot.jpg> auto <out-name> [green|magenta|cyan]
# (the card is found automatically: the bright rectangle on the near-black page)
import os, subprocess, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
src, name = sys.argv[1], sys.argv[3]
key = sys.argv[4] if len(sys.argv) > 4 else 'green'
shot = Image.open(src).convert('RGB')
def run(vals):
    best, start, n = (0, 0), 0, 0
    for i, b in enumerate(vals + [False]):
        if b:
            start, n = (i, n + 1) if n == 0 else (start, n + 1)
        else:
            if n > best[1] - best[0]:
                best = (start, start + n)
            n = 0
    return best
ys = run([sum(shot.getpixel((60, y))) > 180 for y in range(shot.height)])
mid = (ys[0] + ys[1]) // 2
xs = run([sum(shot.getpixel((x, ys[0] + 10))) > 180 for x in range(shot.width)])
im = shot.crop((xs[0] + 6, ys[0] + 6, xs[1] - 6, ys[1] - 12))
# ChatGPT darkens the bottom of its image card with a gradient overlay: undo it
# per row by scaling each row so its left edge matches the clean top color.
px = im.load()
top = [sum(px[2, y][i] for y in range(2, 12)) / 10 for i in range(3)]
for y in range(im.height):
    edge = px[2, y]
    f = [top[i] / max(edge[i], 1) for i in range(3)]
    if max(abs(v - 1) for v in f) < 0.02:
        continue
    for x in range(im.width):
        p = px[x, y]
        px[x, y] = tuple(min(255, round(p[i] * f[i])) for i in range(3))
# Paint over the Edit / share buttons with the row's own background.
# ChatGPT's Edit / share buttons (and their soft shadows) sit over the bottom
# corners: in those zones, anything close to the row's background color becomes
# background; character pixels (far from it) are left alone.
for y in range(max(0, im.height - 64), im.height):
    ref_l, ref_r = px[min(96, im.width // 3), y], px[max(im.width - 96, 2 * im.width // 3), y]
    for x0, x1, ref in ((0, 84, ref_l), (im.width - 84, im.width, ref_r)):
        for x in range(x0, x1):
            p = px[x, y]
            if sum((p[i] - ref[i]) ** 2 for i in range(3)) ** 0.5 < 120:
                px[x, y] = ref
cap = os.path.join(HERE, f'{name}-capture.png'); im.save(cap)
subprocess.run(['python3', os.path.join(HERE, '..', 'key-capture.py'), cap, f'0,0,{im.width},{im.height}', key, os.path.join(HERE, f'{name}-keyed.png')], check=True)
