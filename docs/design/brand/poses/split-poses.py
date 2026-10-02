# Split a ChatGPT pose sheet (browser-pane screenshot, 800x945 frame) into one
# transparent PNG per pose, left to right: undo the card's bottom shading, paint
# over the Edit/share buttons, key the flat background, then keep the largest
# blobs (one per pose).
#   python3 poses/split-poses.py <shot.jpg> <key> <id> <pose1,pose2,...>
import os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
src, key, cid, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(',')
# Find the image card: the longest run of bright rows down column x=50 (the page is near-black).
shot = Image.open(src).convert('RGB')
bright = [sum(shot.getpixel((50, y))) > 180 for y in range(shot.height)]
best, run, start = (0, 0), 0, 0
for y, b in enumerate(bright + [False]):
    if b:
        if run == 0:
            start = y
        run += 1
    else:
        if run > best[1] - best[0]:
            best = (start, start + run)
        run = 0
top, bot = best
midy = top + 10
xb = [sum(shot.getpixel((x, midy))) > 180 for x in range(shot.width)]
bx, run, start = (0, 0), 0, 0
for x, b in enumerate(xb + [False]):
    if b:
        if run == 0:
            start = x
        run += 1
    else:
        if run > bx[1] - bx[0]:
            bx = (start, start + run)
        run = 0
im = shot.crop((bx[0] + 6, top + 6, bx[1] - 6, bot - 12))
px = im.load()
ref = [sum(px[2, y][i] for y in range(2, 12)) / 10 for i in range(3)]
for y in range(im.height):
    e = px[2, y]
    f = [ref[i] / max(e[i], 1) for i in range(3)]
    if max(abs(v - 1) for v in f) > 0.02:
        for x in range(im.width):
            p = px[x, y]
            px[x, y] = tuple(min(255, round(p[i] * f[i])) for i in range(3))
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
tmp = tempfile.mktemp(suffix='.png'); im.save(tmp)
keyed = tempfile.mktemp(suffix='.png')
# key-capture centers into 1024; we only want its alpha + despill, so run then undo the fit.
subprocess.run(['python3', os.path.join(HERE, '..', 'key-capture.py'), tmp, f'0,0,{im.width},{im.height}', key, keyed], check=True, capture_output=True)
k = Image.open(keyed).convert("RGBA"); k.save("/private/tmp/claude-501/-Users-brianterchin-Developer-WordRush--claude-worktrees-word-definitions-failing-c540b6/3d60503d-ed25-4482-ad22-5271a6c2134b/scratchpad/last-keyed.png")
a = np.array(k.getchannel('A')) > 40
# The N biggest blobs are the poses (no dilation, so near-touching poses stay
# apart); small bits (speed lines, props, hearts) join the nearest pose.
lab, n = ndimage.label(ndimage.binary_opening(a, iterations=1))
sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
big = list(np.argsort(sizes)[::-1][:len(names)] + 1)
cent = {i: ndimage.center_of_mass(lab == i) for i in big}
owner = np.zeros_like(lab)
objs = ndimage.find_objects(lab)
for i in range(1, n + 1):
    if i in big:
        owner[lab == i] = i
    elif sizes[i - 1] > 30 and objs[i - 1][0].stop - objs[i - 1][0].start >= 8:
        cy, cx = ndimage.center_of_mass(lab == i)
        j = min(big, key=lambda b: (cent[b][0] - cy) ** 2 + (cent[b][1] - cx) ** 2)
        owner[lab == i] = j
big.sort(key=lambda b: cent[b][1])
arr = np.array(k)
for name, b in zip(names, big):
    m = ndimage.binary_dilation(owner == b, iterations=2) & (np.array(k.getchannel('A')) > 0)
    # Drop hairline horizontal streaks (the card's shading seam): anything under
    # 5 px tall that a vertical opening removes, unless it's inside the body.
    thick = ndimage.binary_opening(m, structure=np.ones((5, 1)))
    m = m & ndimage.binary_dilation(thick, iterations=2)
    piece = arr.copy()
    piece[..., 3] = np.where(m, piece[..., 3], 0)
    im2 = Image.fromarray(piece)
    im2 = im2.crop(im2.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox())
    out = os.path.join(HERE, f'{cid}-{name}.png')
    im2.save(out)
    print(out, im2.size)
