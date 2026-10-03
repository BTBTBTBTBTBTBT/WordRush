#!/usr/bin/env python3
"""FINISH_SPEC BJ8: calm wallpaper bases — the page / game wallpapers WITHOUT the baked
3D letter tiles. The founder: "I don't ever want the backgrounds to be a distraction."

For each wallpaper the base keeps its own colors: the vertical gradient is the per-row
median of the original (the tiles cover well under half of any row, so the median is
the backdrop), lightly smoothed, plus the soft bokeh glow of the original's upper band
re-drawn as a few pre-blurred light discs (deterministic per file). The few small
tiles the apps still draw come from ONE runtime config per platform
(iOS BackdropTiles.swift, Android BackdropTiles.kt, web lib/backdrop-tiles.ts).

  python3 docs/design/brand/walls/calm-walls.py            # rewrite all three platforms
  python3 docs/design/brand/walls/calm-walls.py --preview out/   # write PNG previews only

Idempotent: a base run through it again comes out the same.
"""
import glob, hashlib, os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
IOS = os.path.join(ROOT, 'apps/ios/Wordocious/Resources/Wallpapers.xcassets')
AND = os.path.join(ROOT, 'apps/android/app/src/main/res/drawable-nodpi')
WEB = os.path.join(ROOT, 'apps/web/public/art')


def calm(im: Image.Image, name: str) -> Image.Image:
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    # The backdrop color of every row: tiles are deeper than the pastel backdrop, so
    # take the median of the row's LIGHTER 60% (bokeh highlights are smoothed below).
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    order = np.argsort(lum, axis=1)[:, int(w * 0.4):]
    lighter = np.take_along_axis(rgb, order[:, :, None], axis=1)
    rows = np.median(lighter, axis=1)                              # (h, 3)
    k = max(3, h // 10) | 1                                        # a smooth gradient
    pad = np.pad(rows, ((k, k), (0, 0)), mode='edge')
    ker = np.ones(k) / k
    rows = np.stack([np.convolve(pad[:, c], ker, mode='same')[k:-k] for c in range(3)], axis=1)
    base = np.repeat(rows[:, None, :], w, axis=1)
    # Bokeh: a few soft light discs over the upper band (the original's glow), pre-blurred.
    seed = int(hashlib.md5(name.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    # The glow is drawn as an alpha mask and blurred ALONE, then laid over the base in
    # its light tones (blurring color + alpha together drew dark rims).
    from PIL import ImageDraw
    s = min(w, h)
    out = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB')
    for tone in [(255, 255, 255), (238, 228, 255), (255, 234, 216), (255, 224, 242)]:
        mask = Image.new('L', (w, h), 0)
        d = ImageDraw.Draw(mask)
        for _ in range(4):
            r = s * rng.uniform(0.035, 0.09)
            cx, cy = rng.uniform(0, w), rng.uniform(0, h * 0.42)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(rng.uniform(50, 90)))
        mask = mask.filter(ImageFilter.GaussianBlur(s * 0.03))
        out = Image.composite(Image.new('RGB', (w, h), tone), out, mask)
    return out


def targets():
    for p in sorted(glob.glob(os.path.join(IOS, 'art-wall-*.imageset/*.jpg'))):
        yield p, 'jpg'
    for p in sorted(glob.glob(os.path.join(AND, 'art_wall_*.webp'))):
        yield p, 'webp'
    for p in sorted(glob.glob(os.path.join(WEB, 'art-wall-*.webp'))):
        yield p, 'webp'


def main():
    preview = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == '--preview' else None
    if preview:
        os.makedirs(preview, exist_ok=True)
    n = 0
    for path, fmt in targets():
        name = os.path.basename(path).rsplit('.', 1)[0].replace('_', '-')
        im = Image.open(path)
        out = calm(im, name)
        if preview:
            out.resize((out.width // 3, out.height // 3)).save(os.path.join(preview, f'{os.path.basename(os.path.dirname(path))}-{name}.png'))
        elif fmt == 'jpg':
            out.save(path, 'JPEG', quality=86, optimize=True, progressive=True)
        else:
            out.save(path, 'WEBP', quality=82, method=6)
        n += 1
    print(f'{n} wallpapers {"previewed" if preview else "rewritten"}')


if __name__ == '__main__':
    main()
