# Stitch overlapping browser-pane screenshots (taken top to bottom while scrolling)
# into one tall image, so an image card taller than the pane can be captured whole.
# The vertical offset between consecutive shots is found by matching rows in the
# middle band (the pane's header/composer overlays are excluded).
#   python3 stitch.py <out.png> <shot1> <shot2> [...]
import sys
import numpy as np
from PIL import Image
TOP, BOT = int(__import__("os").environ.get("STITCH_TOP", 64)), int(__import__("os").environ.get("STITCH_BOT", 160))
out_path, shots = sys.argv[1], [np.asarray(Image.open(p).convert('RGB')).astype(np.int16) for p in sys.argv[2:]]
h, w = shots[0].shape[:2]
canvas = shots[0][: h - BOT].copy()
for prev, cur in zip(shots, shots[1:]):
    # Find dy (scroll distance): cur[y] == prev[y + dy] over the trusted band.
    band = slice(TOP, h - BOT)
    best, best_dy = None, 0
    for dy in range(4, h - TOP - BOT - 40):
        a = prev[TOP + dy: h - BOT, 40: w - 40]
        b = cur[TOP: h - BOT - dy, 40: w - 40]
        if a.shape[0] < 40:
            break
        err = np.abs(a[::3, ::4] - b[::3, ::4]).mean()
        if best is None or err < best:
            best, best_dy = err, dy
    # cur row (h - BOT - 1) maps to canvas row (offset + h - BOT - 1); append the new rows.
    offset = canvas.shape[0] - (h - BOT) + best_dy
    new_rows = cur[h - BOT - best_dy: h - BOT] if best_dy > 0 else cur[:0]
    # Where both shots overlap, take the later one (the pane's scroll arrow floats near
    # the bottom of each shot, so the next shot shows those rows clean).
    ov = (h - BOT) - TOP - best_dy
    if ov > 0:
        # Both shots fade at their edges (header above, composer below): split the
        # overlap in half — prev keeps the top half, cur supplies the bottom half.
        half = ov // 2
        canvas[canvas.shape[0] - (ov - half):] = cur[TOP + half: TOP + ov]
        # The pane's round scroll arrow (dark, ~34 px, centered near x=400) sits over the image at a
        # fixed screen spot, so it lands on different image rows in each shot. Wherever the merged
        # overlap still shows a dark arrow-sized blob, take those rows from the other shot.
        reg_top = canvas.shape[0] - ov
        for y in range(reg_top, canvas.shape[0]):
            row = canvas[y, 360:440]
            if (row.max(axis=1) < 60).sum() > 18:            # dark run across the arrow column
                src_prev = y - (canvas.shape[0] - (h - BOT)) - best_dy   # this canvas row in prev...
                cy = y - offset                                        # ...and in cur
                for cand in ((prev, src_prev + best_dy if False else None), ):
                    pass
                pr = prev[(y - (canvas.shape[0] - ov)) + TOP + best_dy] if 0 <= (y - (canvas.shape[0] - ov)) + TOP + best_dy < h else None
                cr = cur[(y - (canvas.shape[0] - ov)) + TOP] if 0 <= (y - (canvas.shape[0] - ov)) + TOP < h else None
                for cand in (pr, cr):
                    if cand is not None and (cand[360:440].max(axis=1) < 60).sum() <= 18:
                        canvas[y, 360:440] = cand[360:440]
                        break
    canvas = np.concatenate([canvas, new_rows], axis=0)
    print('dy', best_dy, 'err', round(float(best), 2))
Image.fromarray(canvas.clip(0, 255).astype('uint8')).save(out_path)
print('saved', out_path, canvas.shape[1], 'x', canvas.shape[0])
