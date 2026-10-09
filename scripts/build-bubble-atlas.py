#!/usr/bin/env python3
"""Bubble glyph atlas -> shippable assets + metrics (2.8 item 6).

Reads docs/design/brand/2.8/glyphs/out (48 keyed glyph PNGs + atlas.json, cap height 218 px) and writes
  - web      apps/web/public/art/bubble/<stem>.png
  - iOS      apps/ios/Wordocious/Resources/Assets.xcassets/bubble-<stem>.imageset
  - Android  apps/android/app/src/main/res/drawable-nodpi/bubble_<stem>.png
  - metrics  packages/core/src/bubble-atlas-metrics.ts, apps/ios/Sources/Core/BubbleAtlasMetrics.swift,
             apps/android/core/src/main/kotlin/com/wordocious/core/BubbleAtlasMetrics.kt
  - sheet    docs/design/brand/2.8/glyphs/acceptance-wired.png (the side-by-side acceptance check)

The shipped glyph is NOT the colored sprite: it is a three-channel TINT MAP (decoded at runtime on every platform
with the same per-pixel rule, then cached as one bitmap per word):
    R = A   tint multiplier  (body shading x 1.06, the dark inner line x 0.32)        stored / 1.10
    G = Wh  additive white   (highlights: the specular band, so they stay white)       stored / 0.90
    B = Rm  rim shade        (the rim's luma over the mean rim luma; x rim color)      stored / 1.40
    out = clamp(tint(y) * A + Wh + rimColor * Rm)
Splitting body / line / rim follows docs/design/brand/2.8/glyphs/bubble_text.py (the reference renderer). The rim
is recolored in code to the SHIPPED title art's cream-gold (RIM_HEX) instead of the raw glyphs' lemon yellow.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'docs/design/brand/2.8/glyphs/out')
CAP_SRC = 218
CAP_OUT = 140                 # shipped cap height in px (~2x a 70 pt cap on a 1x screen; 3x screens up to ~47 pt cap)
K_A, K_W, K_R = 1.10, 0.90, 1.40
RIM_HEX = '#F0C878'           # the shipped title art's cream-gold rim (single constant; tune here, no asset rebuild)
GAP, SPACE = -0.045, 0.38     # fractions of the cap height (reference renderer)

NAMES = {'★': 'star', '!': 'excl', '?': 'quest', ',': 'comma', "'": 'apos', '’': 'apos', '·': 'dot',
         '-': 'hyphen', '&': 'amp', '.': 'period', ':': 'colon', '+': 'plus', '%': 'percent'}
ALIGN = {'baseline': 0, 'comma': 1, 'top': 2, 'mid': 3}


def stem_of(key):
    """atlas key (A, 7, star, excl ...) -> asset stem (a, 7, star, excl ...)."""
    return key.lower() if len(key) == 1 and key.isalpha() else key


def weights(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    luma = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    body = np.clip((0.30 - sat) / 0.16, 0, 1)
    line = np.clip((0.55 - luma) / 0.2, 0, 1) * (1 - body)
    rimw = np.clip(1 - body - line, 0, 1)
    return luma, body, line, rimw


def load_down(key):
    im = Image.open(f'{SRC}/{key}.png').convert('RGBA')
    k = CAP_OUT / CAP_SRC
    size = (max(1, round(im.width * k)), max(1, round(im.height * k)))
    return Image.fromarray(np.asarray(im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')))


def main():
    atlas = json.load(open(f'{SRC}/atlas.json'))
    glyphs = atlas['glyphs']
    down = {k: load_down(k) for k in glyphs}

    # the mean rim luma over every glyph's solid rim pixels
    acc, n = 0.0, 0
    for im in down.values():
        a = np.asarray(im).astype(np.float32)
        rgb, al = a[..., :3] / 255.0, a[..., 3]
        luma, body, line, rimw = weights(rgb)
        m = (rimw > 0.5) & (al > 250)
        acc += float(luma[m].sum())
        n += int(m.sum())
    rim_mean = acc / max(n, 1)

    out_dirs = {
        'web': os.path.join(ROOT, 'apps/web/public/art/bubble'),
        'android': os.path.join(ROOT, 'apps/android/app/src/main/res/drawable-nodpi'),
        'ios': os.path.join(ROOT, 'apps/ios/Wordocious/Resources/Assets.xcassets'),
    }
    os.makedirs(out_dirs['web'], exist_ok=True)

    metrics = {}
    for key, g in glyphs.items():
        stem = stem_of(key)
        a = np.asarray(down[key]).astype(np.float32)
        rgb, al = a[..., :3] / 255.0, a[..., 3]
        luma, body, line, rimw = weights(rgb)
        L = np.clip(luma / 0.90, 0, 1.3)
        m_body = 1.06 * np.minimum(L, 1.0) ** 1.35
        h = np.clip(L - 1.0, 0, 0.25) * 4.0 * 0.85
        A = body * m_body * (1 - h) + line * 0.32
        Wh = body * h
        Rm = rimw * (luma / rim_mean)
        enc = np.dstack([
            np.clip(A / K_A, 0, 1) * 255, np.clip(Wh / K_W, 0, 1) * 255, np.clip(Rm / K_R, 0, 1) * 255, al,
        ]).round().astype(np.uint8)
        # fully transparent pixels carry no data (keeps PNGs small and premultiply-safe)
        enc[al < 1] = 0
        im = Image.fromarray(enc, 'RGBA')
        im.save(os.path.join(out_dirs['web'], f'{stem}.png'), optimize=True)
        im.save(os.path.join(out_dirs['android'], f'bubble_{stem}.png'), optimize=True)
        d = os.path.join(out_dirs['ios'], f'bubble-{stem}.imageset')
        os.makedirs(d, exist_ok=True)
        im.save(os.path.join(d, f'bubble-{stem}.png'), optimize=True)
        json.dump({'images': [{'filename': f'bubble-{stem}.png', 'idiom': 'universal'}], 'info': {'author': 'xcode', 'version': 1}},
                  open(os.path.join(d, 'Contents.json'), 'w'), indent=2)
        metrics[stem] = {
            'w': round(g['w'] / CAP_SRC, 4), 'h': round(g['h'] / CAP_SRC, 4),
            'b': round(g['baseline'] / CAP_SRC, 4), 'a': ALIGN[g['align']],
            'px': [im.width, im.height],
        }

    # the shared line box (cap units): ascent over the cap line, descent under the baseline
    asc = desc = 0.0
    for stem, m in metrics.items():
        a = m['a']
        top = -m['b'] if a in (0, 1) else (-1.0 if a == 2 else -0.5 - m['h'] / 2)
        asc = max(asc, -top)
        desc = max(desc, top + m['h'])
    asc, desc = round(asc, 4), round(desc, 4)
    emit_metrics(metrics, rim_mean, asc, desc)
    make_sheet(down, metrics, glyphs, rim_mean)
    print(f'{len(metrics)} glyphs; rim mean luma {rim_mean:.3f}; asc {asc} desc {desc}')


def emit_metrics(metrics, rim_mean, asc, desc):
    rows = sorted(metrics.items())
    ts = ['// GENERATED by scripts/build-bubble-atlas.py from docs/design/brand/2.8/glyphs/out/atlas.json — do not edit.',
          '// Per-glyph metrics in CAP-HEIGHT units (the atlas cap height = 1): w, h, b = the baseline measured from the glyph top,',
          '// a = align (0 baseline, 1 comma, 2 top, 3 mid).',
          f'export const BUBBLE_ATLAS_CAP_PX = {CAP_OUT};', f'export const BUBBLE_ATLAS_GAP = {GAP};',
          f'export const BUBBLE_ATLAS_SPACE = {SPACE};', f'export const BUBBLE_ATLAS_ASC = {asc};',
          f'export const BUBBLE_ATLAS_DESC = {desc};', f"export const BUBBLE_ATLAS_RIM_HEX = '{RIM_HEX}';",
          'export const BUBBLE_ATLAS_K = { a: %s, w: %s, r: %s } as const;' % (K_A, K_W, K_R),
          'export const BUBBLE_ATLAS_METRICS: Readonly<Record<string, readonly [number, number, number, number]>> = {']
    for s, m in rows:
        ts.append(f"  '{s}': [{m['w']}, {m['h']}, {m['b']}, {m['a']}],")
    ts.append('};')
    open(os.path.join(ROOT, 'packages/core/src/bubble-atlas-metrics.ts'), 'w').write('\n'.join(ts) + '\n')

    sw = ['// GENERATED by scripts/build-bubble-atlas.py from docs/design/brand/2.8/glyphs/out/atlas.json — do not edit.',
          '// Per-glyph metrics in CAP-HEIGHT units: w, h, baseline-from-top, align (0 baseline, 1 comma, 2 top, 3 mid).',
          'public enum BubbleAtlasMetrics {',
          f'    public static let capPx = {CAP_OUT}', f'    public static let gap = {GAP}', f'    public static let space = {SPACE}',
          f'    public static let asc = {asc}', f'    public static let desc = {desc}', f'    public static let rimHex: UInt32 = 0x{RIM_HEX[1:]}',
          f'    public static let kA = {K_A}', f'    public static let kW = {K_W}', f'    public static let kR = {K_R}',
          '    public static let glyphs: [String: (w: Double, h: Double, b: Double, a: Int)] = [']
    for s, m in rows:
        sw.append(f'        "{s}": ({m["w"]}, {m["h"]}, {m["b"]}, {m["a"]}),')
    sw += ['    ]', '}']
    open(os.path.join(ROOT, 'apps/ios/Sources/Core/BubbleAtlasMetrics.swift'), 'w').write('\n'.join(sw) + '\n')

    kt = ['package com.wordocious.core', '',
          '// GENERATED by scripts/build-bubble-atlas.py from docs/design/brand/2.8/glyphs/out/atlas.json — do not edit.',
          '// Per-glyph metrics in CAP-HEIGHT units: w, h, baseline-from-top, align (0 baseline, 1 comma, 2 top, 3 mid).',
          'class BubbleGlyphMetric(val w: Double, val h: Double, val b: Double, val a: Int)', '',
          'object BubbleAtlasMetrics {',
          f'    const val CAP_PX = {CAP_OUT}', f'    const val GAP = {GAP}', f'    const val SPACE = {SPACE}',
          f'    const val ASC = {asc}', f'    const val DESC = {desc}', f'    const val RIM_HEX = 0xFF{RIM_HEX[1:]}.toInt()',
          f'    const val K_A = {K_A}', f'    const val K_W = {K_W}', f'    const val K_R = {K_R}',
          '    val glyphs: Map<String, BubbleGlyphMetric> = mapOf(']
    for s, m in rows:
        kt.append(f'        "{s}" to BubbleGlyphMetric({m["w"]}, {m["h"]}, {m["b"]}, {m["a"]}),')
    kt += ['    )', '}']
    open(os.path.join(ROOT, 'apps/android/core/src/main/kotlin/com/wordocious/core/BubbleAtlasMetrics.kt'), 'w').write('\n'.join(kt) + '\n')


# ---- the acceptance sheet: the runtime decode, in Python (same rule the three ports implement) -------------------------
def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


def decode(enc_img, top, bottom, y0, y1, rim):
    e = np.asarray(enc_img).astype(np.float32) / 255.0
    A, Wh, Rm, al = e[..., 0] * K_A, e[..., 1] * K_W, e[..., 2] * K_R, e[..., 3]
    ty = np.linspace(y0, y1, e.shape[0], dtype=np.float32)[:, None, None]
    t = np.array(top, np.float32) * (1 - ty) + np.array(bottom, np.float32) * ty
    rgb = np.clip(t * A[..., None] + Wh[..., None] + np.array(rim, np.float32) * Rm[..., None], 0, 1)
    return Image.fromarray(np.dstack([rgb * 255, al * 255]).astype(np.uint8), 'RGBA')


def compose(text, top, bottom, rim, enc):
    """Lay out `text` exactly like the runtime (cap units -> px at CAP_OUT) and tint it with the vertical gradient."""
    capk = CAP_OUT
    items, x = [], 0.0
    for ch in text:
        if ch == ' ':
            x += SPACE * capk
            continue
        stem = NAMES.get(ch.upper(), ch.upper())
        stem = stem_of(stem)
        if stem not in enc:
            continue
        im, m = enc[stem]
        top_y = -m['b'] if m['a'] in (0, 1) else (-1.0 if m['a'] == 2 else -0.5 - m['h'] / 2)
        items.append((im, x, top_y * capk))
        x += m['w'] * capk + GAP * capk
    width = int(x - GAP * capk) + 8
    asc = max(-t for _, _, t in items)
    desc = max(t + im.height for im, _, t in items)
    total = asc + desc
    canvas = Image.new('RGBA', (width, int(total) + 8), (0, 0, 0, 0))
    for im, gx, ty in items:
        y_in = asc + ty
        canvas.alpha_composite(decode(im, top, bottom, y_in / total, (y_in + im.height) / total, rim), (int(gx) + 4, int(y_in) + 4))
    return canvas


def make_sheet(down, metrics, glyphs, rim_mean):
    enc = {}
    for key in glyphs:
        stem = stem_of(key)
        e = Image.open(os.path.join(ROOT, 'apps/web/public/art/bubble', f'{stem}.png')).convert('RGBA')
        enc[stem] = (e, metrics[stem])
    rim = hexrgb(RIM_HEX)
    rows = [
        ('DAILIES purple to pink', 'DAILIES', '#A855F7', '#DB2777'),
        ('PUZZLES teal', 'PUZZLES', '#0891B2', '#0E7490'),
        ('ON A ROLL ★ 7 OF 18', 'ON A ROLL ★ 7 OF 18', '#F5B800', '#D98A00'),
        ("GOOD MORNING, BMT!", "GOOD MORNING, BMT!", '#4F6BFF', '#3A40E0'),
        ('WORDOCIOUS FLAWLESS! 3 PUZZLES LEFT', 'WORDOCIOUS FLAWLESS!', '#FDE68A', '#F59E0B'),
        ('symbols', "0123456789 ★ ! ? , ' · - & . : + %", '#A855F7', '#DB2777'),
    ]
    imgs = [compose(t, hexrgb(a), hexrgb(b), rim, enc) for _, t, a, b in rows]
    # side by side with today's title art when it exists
    art = {}
    for name, f in (('DAILIES', 'art-titlecast-dailies.webp'), ('PUZZLES', 'art-titlecast-puzzles.webp')):
        p = os.path.join(ROOT, 'apps/web/public/art', f)
        if os.path.exists(p):
            art[name] = Image.open(p).convert('RGBA')
    W = max(i.width for i in imgs) + 40
    H = sum(i.height + 28 for i in imgs) + 20 + (200 if art else 0)
    sheet = Image.new('RGBA', (W + (800 if art else 0), H), (245, 241, 252, 255))
    y = 10
    for i, (label, *_), in zip(imgs, rows):
        sheet.alpha_composite(i, (20, y + 14))
        y += i.height + 28
    if art:
        ax = W + 10
        ay = 10
        for name, a in art.items():
            a2 = a.resize((780, int(a.height * 780 / a.width)), Image.LANCZOS)
            sheet.alpha_composite(a2, (ax, ay))
            ay += a2.height + 10
    out = os.path.join(ROOT, 'docs/design/brand/2.8/glyphs/acceptance-wired.png')
    sheet.convert('RGB').save(out, optimize=True)


if __name__ == '__main__':
    sys.exit(main())
