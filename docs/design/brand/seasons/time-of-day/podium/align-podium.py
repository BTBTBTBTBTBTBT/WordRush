#!/usr/bin/env python3
"""Align ChatGPT-made time-of-day podium stages onto the night stage (1536 x 1024) so the three steps and the three satin
text panels land on the SAME pixels (the app prints scores in the panels and plants mascots on the step tops).

Landmarks (6): the top-surface center of each step and the center of each satin panel, defined on the night source
(PODIUM_ART feet + measured panel boxes). In each new image they are located by normalized cross-correlation of an edge
map (Sobel magnitude of luma, so the lighting change doesn't matter) of a patch around the landmark, searched +/-SEARCH px
with sub-pixel refinement. A similarity (uniform scale + translation, no rotation) is fitted, the new image is warped +
cropped to the source size, and the per-landmark residuals are reported (target <= 4 px at 1536 wide).

usage: align-podium.py --night SRC.png --out DIR [--override lm.json] [--sheet FILE] tod=raw.png ...
lm.json (optional manual override): {"morning": [[x,y] x6, in the order below], ...}
"""
import argparse, json, os
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

SIZE = (1536, 1024)
# (name, cx, cy, patch_w, patch_h) in night-source pixels. Order: top silver, top gold, top bronze, panel silver, gold, bronze
LANDMARKS = [
    ('top-silver', 337, 445, 440, 110),
    ('top-gold', 768, 375, 470, 110),
    ('top-bronze', 1203, 466, 440, 110),
    ('panel-silver', 337, 721, 380, 220),
    ('panel-gold', 768, 706, 390, 240),
    ('panel-bronze', 1201, 724, 380, 220),
]
SEARCH = 60
TARGET = 4.0

def edges(img):
    g = cv2.cvtColor(np.asarray(img.convert('RGB')), cv2.COLOR_RGB2GRAY).astype(np.float32)
    g = cv2.GaussianBlur(g, (0, 0), 1.2)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1)
    m = cv2.magnitude(gx, gy)
    return m / (m.max() + 1e-6)

def locate(src_e, new_e):
    pts, scores = [], []
    for (_, cx, cy, w, h) in LANDMARKS:
        x0, y0 = int(cx - w / 2), int(cy - h / 2)
        tpl = src_e[y0:y0 + h, x0:x0 + w]
        sx0, sy0 = max(0, x0 - SEARCH), max(0, y0 - SEARCH)
        sx1, sy1 = min(new_e.shape[1], x0 + w + SEARCH), min(new_e.shape[0], y0 + h + SEARCH)
        win = new_e[sy0:sy1, sx0:sx1]
        r = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
        _, mx, _, loc = cv2.minMaxLoc(r)
        lx, ly = loc
        dx = dy = 0.0
        if 0 < lx < r.shape[1] - 1:
            a, b, c = r[ly, lx - 1], r[ly, lx], r[ly, lx + 1]
            dx = 0.5 * (a - c) / (a - 2 * b + c + 1e-9)
        if 0 < ly < r.shape[0] - 1:
            a, b, c = r[ly - 1, lx], r[ly, lx], r[ly + 1, lx]
            dy = 0.5 * (a - c) / (a - 2 * b + c + 1e-9)
        # landmark = patch center in the new image
        pts.append((sx0 + lx + dx + w / 2, sy0 + ly + dy + h / 2)); scores.append(float(mx))
    return pts, scores

def fit(src, dst):
    P, Q = np.array(src, float), np.array(dst, float)
    pm, qm = P.mean(0), Q.mean(0)
    Pc, Qc = P - pm, Q - qm
    s = (Pc * Qc).sum() / (Pc * Pc).sum()
    t = qm - s * pm
    return s, t, np.linalg.norm(s * P + t - Q, axis=1)

def warp(img, s, t):
    a = np.asarray(img.convert('RGB'))
    M = np.array([[1 / s, 0, -t[0] / s], [0, 1 / s, -t[1] / s]], np.float32)  # out(X) = new((X - t)/s)
    out = cv2.warpAffine(a, M, SIZE, flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    return Image.fromarray(out)

PODIUM_ART = [  # (place, feetx, feety, panel x0 x1 y0 y1) fractions from packages/core/src/podium-layout.ts
    (2, .220, .435, .103, .335, .605, .810), (1, .500, .366, .383, .620, .581, .799), (3, .783, .455, .667, .902, .615, .810)]

def mock(img, night_pts):
    im = img.copy(); d = ImageDraw.Draw(im, 'RGBA')
    try: f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 56)
    except Exception: f = ImageFont.load_default()
    W, H = im.size
    for (pl, fx, fy, x0, x1, y0, y1), txt in zip(PODIUM_ART, ('942', '980', '902')):
        # NOTE order in PODIUM_ART is silver, gold, bronze
        d.text(((x0 + x1) / 2 * W, (y0 + y1) / 2 * H - 18), txt, fill=(70, 30, 100), font=f, anchor='mm')
        d.text(((x0 + x1) / 2 * W, (y0 + y1) / 2 * H + 34), '3 GUESSES', fill=(70, 30, 100), font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 28) if f else None, anchor='mm')
        d.rectangle([x0 * W, y0 * H, x1 * W, y1 * H], outline=(255, 0, 80, 200), width=2)
        d.ellipse([fx * W - 7, fy * H - 7, fx * W + 7, fy * H + 7], fill=(0, 255, 120, 220))  # mascot feet point
    return im

def cross(img, pts, col=(0, 255, 160)):
    im = img.copy(); d = ImageDraw.Draw(im)
    for (x, y) in pts:
        d.ellipse([x - 12, y - 12, x + 12, y + 12], outline=col, width=3)
        d.line([x - 26, y, x + 26, y], fill=col, width=2); d.line([x, y - 26, x, y + 26], fill=col, width=2)
    return im

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--night', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--override'); ap.add_argument('--sheet'); ap.add_argument('--stem', default='podium-stage')
    ap.add_argument('pairs', nargs='+')
    a = ap.parse_args()
    ov = json.load(open(a.override)) if a.override else {}
    os.makedirs(a.out, exist_ok=True)
    night = Image.open(a.night).convert('RGB'); assert night.size == SIZE, night.size
    src_e = edges(night)
    npts = [(cx, cy) for (_, cx, cy, _, _) in LANDMARKS]
    finals = {'night': night}; report = {}
    for pair in a.pairs:
        tod, path = pair.split('=', 1)
        raw = Image.open(path).convert('RGB')
        if tod in ov: pts, sc = [tuple(p) for p in ov[tod]], [None] * 6
        else: pts, sc = locate(src_e, edges(raw.resize(SIZE, Image.LANCZOS) if raw.size != SIZE else raw))
        # if raw was resized for matching, scale points back to raw coords
        if raw.size != SIZE and tod not in ov:
            k = raw.width / SIZE[0]; pts = [(x * k, y * k) for x, y in pts]
        s, t, res = fit(pts, npts)
        out = warp(raw, s, t)
        # verify: re-detect on the warped result
        vp, vs = locate(src_e, edges(out))
        vres = np.linalg.norm(np.array(vp) - np.array(npts), axis=1)
        out.save(os.path.join(a.out, f'{a.stem}-{tod}.png')); finals[tod] = out
        report[tod] = dict(raw=raw.size, landmarks=[(LANDMARKS[i][0], round(float(pts[i][0]), 1), round(float(pts[i][1]), 1)) for i in range(6)],
                           ncc=[None if v is None else round(v, 3) for v in sc], scale=round(float(s), 4),
                           translate=[round(float(v), 1) for v in t], fit_residual_px=[round(float(r), 1) for r in res],
                           max_fit_residual_px=round(float(res.max()), 1), verify_residual_px=[round(float(r), 1) for r in vres],
                           max_verify_residual_px=round(float(vres.max()), 1))
        print(tod, 'scale %.4f t (%.1f, %.1f)' % (s, t[0], t[1]), 'fit res', np.round(res, 1).tolist(), 'max %.1f' % res.max(),
              '| verify', np.round(vres, 1).tolist(), '->', 'OK' if res.max() <= TARGET else 'OVER %.0f px' % TARGET)
    json.dump(dict(night_landmarks=npts, results=report), open(os.path.join(a.out, 'align-report.json'), 'w'), indent=1)
    if a.sheet:
        tods = [t for t in ('morning', 'day', 'evening', 'night') if t in finals]
        tw = 640; th = int(tw * 1024 / 1536)
        sheet = Image.new('RGB', (tw * len(tods) + 8 * (len(tods) + 1), th * 2 + 24), (20, 20, 24))
        for i, t in enumerate(tods):
            x = 8 + i * (tw + 8)
            sheet.paste(cross(finals[t], npts).resize((tw, th), Image.LANCZOS), (x, 8))
            sheet.paste(mock(finals[t], npts).resize((tw, th), Image.LANCZOS), (x, th + 16))
        sheet.save(a.sheet, quality=90); print('sheet', a.sheet, sheet.size)

if __name__ == '__main__':
    main()
