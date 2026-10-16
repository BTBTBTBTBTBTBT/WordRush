#!/usr/bin/env python3
"""Align ChatGPT-made time-of-day stages onto the night stage's spotlight geometry (founder 10-16: "the spotlights in
the exact same places so the animated guys still look appropriate").

For the night source and each new image: find the three floor light pools (the brightest blobs in the lower ~35%
of the frame, central ~70% of the width), fit a similarity transform (uniform scale + translation, no rotation)
that maps the new image's pool centers onto the night's, warp + crop to exactly the night frame (1586 x 992), and
report the residual per pool in px (target <= 6 px at 1586 wide).

usage:
  align-stage.py --night <night.png> --out <dir> [--override pools.json] [--sheet stage-on-walls-v2.jpg
                 --walls <dir-with-<season>-home-<tod>.webp> --season halloween] <tod>=<raw.png> [<tod>=<raw.png> ...]

pools.json (manual override, optional): {"night": [[x,y],[x,y],[x,y]], "morning": [[x,y],...], ...} in each image's
own pixel coordinates; a key that is present replaces detection for that image.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

NIGHT_SIZE = (1586, 992)
STAGE_W_FRAC = 0.92      # app: stage card width = 92% of the wall
STAGE_TOP_FRAC = 0.255   # app: stage card top at 25.5% of the wall height
TARGET_PX = 6.0


def luma(img):
    a = np.asarray(img.convert('RGB'), dtype=np.float32) / 255.0
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def find_pools(img, y_from=0.65, x_from=0.15, x_to=0.85, n=3):
    """Centers of the n brightest floor blobs: blur, threshold at the 99.3rd percentile of the band, split by
    x-projection gaps, brightness-weighted centroid per blob. Returns a list of n (x, y) sorted left to right."""
    w, h = img.size
    L = luma(img.filter(ImageFilter.GaussianBlur(w / 200)))
    y0, x0, x1 = int(h * y_from), int(w * x_from), int(w * x_to)
    band = L[y0:, x0:x1]
    thr = np.percentile(band, 99.3)
    mask = band >= thr
    cols = mask.any(axis=0)
    # runs of columns with mask pixels = candidate blobs
    runs, start = [], None
    for x, on in enumerate(cols):
        if on and start is None:
            start = x
        if not on and start is not None:
            runs.append((start, x))
            start = None
    if start is not None:
        runs.append((start, len(cols)))
    # merge runs separated by tiny gaps (< 2% of width)
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < w * 0.02:
            merged[-1] = (merged[-1][0], r[1])
        else:
            merged.append(r)
    blobs = []
    for (a, b) in merged:
        sub = mask[:, a:b]
        wts = np.where(sub, band[:, a:b] - thr + 1e-3, 0.0)
        tot = wts.sum()
        if tot <= 0:
            continue
        ys, xs = np.mgrid[0:sub.shape[0], 0:sub.shape[1]]
        cx = (wts * xs).sum() / tot + a + x0
        cy = (wts * ys).sum() / tot + y0
        blobs.append((tot, cx, cy))
    blobs.sort(reverse=True)
    pts = sorted([(cx, cy) for _, cx, cy in blobs[:n]])
    if len(pts) < n:
        raise SystemExit(f'found only {len(pts)} pools; pass --override')
    return pts


def fit_similarity(src_pts, dst_pts):
    """Uniform scale s + translation t minimizing sum |s*p + t - q|^2 (no rotation)."""
    P, Q = np.array(src_pts, float), np.array(dst_pts, float)
    pm, qm = P.mean(0), Q.mean(0)
    Pc, Qc = P - pm, Q - qm
    s = (Pc * Qc).sum() / (Pc * Pc).sum()
    t = qm - s * pm
    res = np.linalg.norm(s * P + t - Q, axis=1)
    return s, t, res


def warp(img, s, t, size):
    """Output pixel (X, Y) in the night frame samples the new image at ((X, Y) - t) / s, bilinear, edge-clamped."""
    W, H = size
    a = np.asarray(img.convert('RGB'), dtype=np.float32)
    h, w = a.shape[:2]
    X, Y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    xs = (X - t[0]) / s
    ys = (Y - t[1]) / s
    covered = ((xs >= 0) & (xs <= w - 1) & (ys >= 0) & (ys <= h - 1)).mean()
    xs = np.clip(xs, 0, w - 1)
    ys = np.clip(ys, 0, h - 1)
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int)
    x1 = np.minimum(x0 + 1, w - 1); y1 = np.minimum(y0 + 1, h - 1)
    fx = (xs - x0)[..., None]; fy = (ys - y0)[..., None]
    out = (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x1] * fx * (1 - fy)
           + a[y1, x0] * (1 - fx) * fy + a[y1, x1] * fx * fy)
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), 'RGB'), covered


def panel(wall_path, stage_img, night_pools, crop_h=1700):
    wall = Image.open(wall_path).convert('RGB')
    ww, wh = wall.size
    sw = int(round(ww * STAGE_W_FRAC))
    sh = int(round(sw * stage_img.height / stage_img.width))
    sx, sy = (ww - sw) // 2, int(round(wh * STAGE_TOP_FRAC))
    wall.paste(stage_img.resize((sw, sh), Image.LANCZOS), (sx, sy))
    d = ImageDraw.Draw(wall)
    k = sw / stage_img.width
    for (px, py) in night_pools:
        cx, cy = sx + px * k, sy + py * k
        r = 14
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0, 255, 180), width=4)
        d.line([cx - 2 * r, cy, cx + 2 * r, cy], fill=(0, 255, 180), width=2)
        d.line([cx, cy - 2 * r, cx, cy + 2 * r], fill=(0, 255, 180), width=2)
    top = max(0, sy - 350)
    return wall.crop((0, top, ww, min(wh, top + crop_h)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--night', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--override')
    ap.add_argument('--sheet')
    ap.add_argument('--walls')
    ap.add_argument('--stem', default='celebration-stage-thanksgiving')
    ap.add_argument('--season', default='thanksgiving', help='wall file prefix <season>-home-<tod>.webp (halloween walls exist since 10-16 pm)')
    ap.add_argument('pairs', nargs='+', help='tod=raw.png')
    args = ap.parse_args()
    override = json.load(open(args.override)) if args.override else {}
    os.makedirs(args.out, exist_ok=True)

    night = Image.open(args.night).convert('RGB')
    assert night.size == NIGHT_SIZE, night.size
    night_pools = override.get('night') or find_pools(night)
    print('night pools:', [(round(x), round(y)) for x, y in night_pools])
    night.save(os.path.join(args.out, f'{args.stem}-night.png'))
    finals = {'night': night}
    report = {}
    for pair in args.pairs:
        tod, path = pair.split('=', 1)
        raw = Image.open(path).convert('RGB')
        pools = override.get(tod) or find_pools(raw)
        s, t, res = fit_similarity(pools, night_pools)
        out, covered = warp(raw, s, t, NIGHT_SIZE)
        out.save(os.path.join(args.out, f'{args.stem}-{tod}.png'))
        finals[tod] = out
        verdict = 'OK' if res.max() <= TARGET_PX else f'OVER target {TARGET_PX:.0f} px'
        report[tod] = dict(raw=raw.size, pools=[(round(x), round(y)) for x, y in pools], scale=round(float(s), 4),
                           translate=[round(float(v), 1) for v in t], residual_px=[round(float(r), 1) for r in res],
                           max_residual_px=round(float(res.max()), 1), coverage=round(float(covered), 3))
        print(f'{tod}: raw {raw.size} pools {report[tod]["pools"]} scale {s:.4f} t ({t[0]:.1f}, {t[1]:.1f}) '
              f'residual {np.round(res, 1).tolist()} px max {res.max():.1f} -> {verdict}; frame coverage {covered:.3f}'
              + ('' if covered > 0.999 else ' (edges clamped)'))
    json.dump(dict(night_pools=night_pools, results=report), open(os.path.join(args.out, 'align-report.json'), 'w'),
              indent=1)

    if args.sheet:
        panels = []
        for tod in ('morning', 'day', 'evening', 'night'):
            if tod not in finals:
                continue
            wall = os.path.join(args.walls, f'{args.season}-home-{tod}.webp')
            panels.append(panel(wall, finals[tod], night_pools))
        pw, ph = panels[0].size
        scale = 480 / pw
        sheet = Image.new('RGB', (int(pw * scale) * len(panels) + 8 * (len(panels) + 1), int(ph * scale) + 16), (20, 20, 24))
        x = 8
        for p in panels:
            q = p.resize((int(pw * scale), int(ph * scale)), Image.LANCZOS)
            sheet.paste(q, (x, 8))
            x += q.width + 8
        sheet.save(args.sheet, quality=90)
        print('sheet', args.sheet, sheet.size)


if __name__ == '__main__':
    main()
