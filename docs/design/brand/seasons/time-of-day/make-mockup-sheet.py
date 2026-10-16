#!/usr/bin/env python3
"""Time-of-day mockup sheet: the real Home card stack (docs/review/thanksgiving-preview/ios-home-thanksgiving.png)
over each time-of-day wall, with the real Dailies title at its in-app spot. Morning and day get a second phone with a
light-card treatment (cards recolored to cream/lavender, dark ink). Prints the WCAG contrast of the on-wall text
(title lettering, stats-row digits) and the on-card text for each cell, and writes mockup-sheet.jpg.

  python3 make-mockup-sheet.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
SHOT = os.path.join(ROOT, 'docs', 'review', 'thanksgiving-preview', 'ios-home-thanksgiving.png')
TITLE = os.path.join(HERE, '..', 'thanksgiving', 'titles', 'dailies.png')
TODS = ['morning', 'day', 'evening', 'night']
W, H = 1170, 2532

# screen regions (px, 1170 x 2532 capture): the opaque UI we keep from the capture
HERO = (54, 600, 1116, 1420)        # the harvest stage card (+ its W tab, caught by the diff mask)
PANEL = (54, 1440, 1116, 1785)      # the Wordocious / Puzzles icon panel (translucent in the app)
CARDS = (54, 1960, 1116, 2210)      # first row of Dailies cards
DTAB = (1040, 1750, 1170, 1910)     # the green D side tab
TITLE_BAND = (300, 1800, 850, 1960) # the Dailies title lettering lives here
TAB = (0, 2210, W, H)
STATS_ROW = (60, 190, 320, 270)     # streak / shield digits, white on the wall


def lum(rgb):
    c = np.asarray(rgb, np.float64) / 255
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def contrast(fg, bg):
    a, b = lum(fg), lum(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def ui_mask(shot, night_wall):
    """where the capture differs from the shipped wall = UI (top half); rects for the card stack + tab bar"""
    d = np.abs(shot - night_wall).max(2)
    m = (d > 28).astype(np.float32)
    m[1430:] = 0                                        # below the hero card: rects only (the capture's skyline
    mi = Image.fromarray((m * 255).astype(np.uint8))    # is not a plain resize of the wall; see NOTES.md)
    mi = mi.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(5))
    m = np.asarray(mi).astype(np.float32) / 255
    for x0, y0, x1, y1 in (HERO, PANEL, CARDS, TAB, DTAB):
        m[y0:y1, x0:x1] = 1
    return m


def light_cards(px, rects):
    """cream / lavender cards with dark ink: dark purple card ground -> cream, near-white lettering -> ink,
    saturated icons / drips / pills untouched"""
    out = px.copy()
    for x0, y0, x1, y1 in rects:
        c = px[y0:y1, x0:x1]
        mx, mn = c.max(2), c.min(2)
        L = lum(c)
        sat = (mx - mn) / np.maximum(mx, 1)
        # hue: purple-ish ground (b > r > g) and dark
        wb = np.clip((0.30 - L) / 0.16, 0, 1) * np.clip((0.8 - sat) / 0.2, 0, 1)   # any dark card ground
        wt = np.clip((L - 0.42) / 0.18, 0, 1) * np.clip((0.7 - sat) / 0.25, 0, 1)  # white + lavender lettering
        wt = wt * (1 - wb)
        ty = np.linspace(0, 1, y1 - y0, dtype=np.float32)[:, None, None]
        cream = np.array([250, 243, 232], np.float32) * (1 - ty) + np.array([236, 230, 246], np.float32) * ty
        ink = np.array([44, 28, 64], np.float32)
        out[y0:y1, x0:x1] = c * (1 - wb - wt)[..., None] + cream * wb[..., None] + ink * wt[..., None]
    return out


def main():
    shot = np.asarray(Image.open(SHOT).convert('RGB')).astype(np.float32)
    walls = {t: np.asarray(Image.open(os.path.join(HERE, f'thanksgiving-home-{t}.webp')).resize((W, H), Image.LANCZOS)).astype(np.float32)
             for t in TODS}
    m = ui_mask(shot, walls['night'])[..., None]
    # the Dailies title at its in-app size / position (lettering bbox in the capture)
    band = shot[TITLE_BAND[1]:TITLE_BAND[3], TITLE_BAND[0]:TITLE_BAND[2]]
    red = (band[..., 0] > 150) & (band[..., 1] < 90) & (band[..., 2] < 90)
    ys, xs = np.where(red)
    xs = xs + TITLE_BAND[0]
    title = Image.open(TITLE).convert('RGBA')
    ta = np.asarray(title)
    tys, txs = np.where((ta[..., 0] > 150) & (ta[..., 1] < 90) & (ta[..., 2] < 90) & (ta[..., 3] > 200))
    k = (xs.max() - xs.min()) / (txs.max() - txs.min())
    tw, th = round(title.width * k), round(title.height * k)
    tx = round(xs.min() - txs.min() * k)
    ty = round(TITLE_BAND[1] + ys.min() - tys.min() * k)
    title_s = title.resize((tw, th), Image.LANCZOS)
    tfill = np.median(ta[tys, txs, :3], 0)
    dark = ta[ta[..., 3] > 240][:, :3]
    trim = np.median(dark[lum(dark) < np.percentile(lum(dark), 12)], 0)
    # on-card ink samples
    card_bg = np.median(shot[2100:2200, 60:560].reshape(-1, 3), 0)
    cells = []     # (label, image, notes)
    for t in TODS:
        for treat in (('dark', 'light') if t in ('morning', 'day') else ('dark',)):
            ui = shot if treat == 'dark' else light_cards(shot, [(54, 1965, 572, 2210), (598, 1965, 1116, 2210)])   # the icon tray stays as-is (translucent in-app)
            comp = walls[t] * (1 - m) + ui * m
            im = Image.fromarray(comp.clip(0, 255).astype(np.uint8))
            im.paste(title_s, (tx, ty), title_s)
            # local sky under the title lettering and under the stats digits
            sky_t = np.median(walls[t][ty:ty + th, tx:tx + tw].reshape(-1, 3), 0)
            sky_s = np.median(walls[t][STATS_ROW[1]:STATS_ROW[3], STATS_ROW[0]:STATS_ROW[2]].reshape(-1, 3), 0)
            c_fill, c_trim = contrast(tfill, sky_t), contrast(trim, sky_t)
            c_stats = contrast((255, 255, 255), sky_s)
            c_card = contrast((255, 255, 255), card_bg) if treat == 'dark' else contrast((44, 28, 64), (243, 236, 239))
            notes = [f'title fill {c_fill:.1f}:1  rim {c_trim:.1f}:1  ({"ok" if c_trim >= 3 else "WEAK"} large text >= 3:1)',
                     f'stats digits (white) {c_stats:.1f}:1  ({"ok" if c_stats >= 3 else "WEAK"})',
                     f'card labels {c_card:.1f}:1  ({"ok" if c_card >= 4.5 else "WEAK"} body >= 4.5:1)']
            cells.append((f'{t.upper()}  -  {"night cards as-is" if treat == "dark" else "light cards"}', im, notes))
            print(cells[-1][0]); [print('   ', n) for n in notes]
    # the sheet: one row of phones at 1/3 scale, header + contrast captions
    pw, ph = 390, 844
    gap, top, bottom = 28, 110, 150
    sheet = Image.new('RGB', (gap + len(cells) * (pw + gap), top + ph + bottom), (28, 24, 34))
    d = ImageDraw.Draw(sheet)
    try:
        f1 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
        f2 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 19)
        f0 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 34)
    except OSError:
        f0 = f1 = f2 = ImageFont.load_default()
    d.text((gap, 22), 'Thanksgiving Home wall by time of day  -  same scene, sky / light / windows swap   (mockup 10-16)', fill=(236, 228, 240), font=f0)
    for i, (label, im, notes) in enumerate(cells):
        x = gap + i * (pw + gap)
        d.text((x, 76), label, fill=(255, 214, 140), font=f1)
        sheet.paste(im.resize((pw, ph), Image.LANCZOS), (x, top))
        for j, n in enumerate(notes):
            col = (255, 120, 110) if 'WEAK' in n else (200, 220, 200)
            d.text((x, top + ph + 16 + j * 28), n, fill=col, font=f2)
    out = os.path.join(HERE, 'mockup-sheet.jpg')
    sheet.save(out, quality=90)
    print('wrote', out, sheet.size)


if __name__ == '__main__':
    main()
