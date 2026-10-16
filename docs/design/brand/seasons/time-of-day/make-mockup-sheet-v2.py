#!/usr/bin/env python3
"""Time-of-day mockup sheet v2 (founder 10-16: "the windows on all the pages are clashing now ... the pages need to
look like one finished product"): three real captures (Home, Leaderboard, the Flawless finished-game sheet) over each
time-of-day wall, with every window / panel / quiet button RE-TINTED from that time's SURFACE palette (below), and
the WCAG numbers for every text role measured on the composited pixels. Writes mockup-sheet-v2.jpg and prints the
contrast table that NOTES.md quotes.

The recolor is honest: inside each window rect the dark card ground (the season's card color composited over the
wall at cardOpacity) is shifted to the new time's composite by a per-pixel offset, so edges, shading, lettering and
icons are untouched; nothing is painted that the app would not draw from the palette.

  python3 make-mockup-sheet-v2.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
CAP = os.path.join(ROOT, 'docs', 'review', 'thanksgiving-preview')
TITLE = os.path.join(HERE, '..', 'thanksgiving', 'titles', 'dailies.png')
TODS = ['morning', 'day', 'evening', 'night']
W, H = 1170, 2532


def hx(s):
    return np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


# ---- the per-time SURFACE palette (night = the registry's shipped `surfaces`; the others override it) ----
# same keys as season-registry.json `surfaces`; values only. Cards stay in the dark family (light ink) on every
# time: the day / morning cards are lifted and tinted toward their sky so they read as that sky's glass.
SURF = {
    'night': dict(tone='dark', card='#2A1419', cardOpacity=0.92, hero='#26121A', raised='#3E2029',
                  cap=['#F7D08C', '#EA580C', '#5C1A12'], glow='#EA580C',
                  text='#FFF4E8', textMuted='#D9BFA7', textSecondary='#F1DCC6'),
    'morning': dict(tone='dark', card='#4A3049', cardOpacity=0.90, hero='#432A42', raised='#5F4260',
                    cap=['#FFE4BC', '#F08C58', '#5A2C40'], glow='#F2A070',
                    text='#FFF6EE', textMuted='#E6CED4', textSecondary='#F6E6E8'),
    'day': dict(tone='dark', card='#303C64', cardOpacity=0.88, hero='#2B365C', raised='#44538C',
                cap=['#FFF2C6', '#F6A842', '#36305E'], glow='#86ADF2',
                text='#FFFFFF', textMuted='#CDD6F0', textSecondary='#E8EDFA'),
    'evening': dict(tone='dark', card='#3A1A2C', cardOpacity=0.92, hero='#341627', raised='#553047',
                    cap=['#FFD690', '#F0762C', '#4C1622'], glow='#F28C3C',
                    text='#FFF4E8', textMuted='#E6C4B2', textSecondary='#F5DECB'),
}
# button families the sheet judges (label color on the family's own fill; the fill does not change with the wall)
BUTTONS = {
    'candy purple (DAILY toggle, VIEW BOARD)': ('#FFFFFF', '#7C3AED'),
    'candy pink (SHARE)': ('#FFFFFF', '#E0427A'),
    'candy gold (UNLIMITED idle / cap)': ('#3A1A08', '#F5C04A'),
    'quiet (CLOSE)': ('#FFF4E8', None),           # None = the time's `raised` composite
    'chip selected (Everyone)': ('#FFFFFF', '#7C3AED'),
    'chip idle (Friends)': ('#FFFFFF', None),      # the time's `raised`
}

# windows per capture (px, 1170 x 2532). 'ground' = the capture's card-ground median inside the rect (sampled)
PAGES = {
    'home': dict(shot='ios-home-thanksgiving.png', wall='home', mask_top=1430,
                 windows=[('icon tray', (54, 1440, 1116, 1785), 'card'), ('dailies cards', (54, 1960, 1116, 2210), 'card'),
                          ('tab bar', (0, 2210, W, H), 'card')],
                 keep=[(54, 600, 1116, 1420), (1040, 1750, 1170, 1910)],
                 text_probe=('dailies cards', (60, 2100, 560, 2200))),
    'leaderboard': dict(shot='ios-leaderboard-thanksgiving.png', wall='leaderboard', mask_top=1430,
                        windows=[('icon panel', (54, 860, 1116, 1240), 'card'), ('podium panel', (54, 1440, 1116, 2210), 'card'),
                                 ('chip idle', (780, 1255, 960, 1325), 'raised'), ('tab bar', (0, 2210, W, H), 'card')],
                        keep=[], text_probe=('icon panel', (60, 880, 560, 920))),
    'flawless': dict(shot='ios-flawless-thanksgiving.png', wall='home', scrim=True,
                     windows=[('stat chips', (54, 1380, 1116, 1560), 'card'), ('list panel', (54, 1600, 1116, 2010), 'card'),
                              ('close button', (3080 // 3, 2055, 3380 // 3, 2195), 'raised')],
                     keep=[], text_probe=('list panel', (60, 1640, 560, 1700))),
}


def lum(rgb):
    c = np.asarray(rgb, np.float64) / 255
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def contrast(fg, bg):
    a, b = lum(fg), lum(bg)
    hi, lo = np.maximum(a, b), np.minimum(a, b)
    return (hi + 0.05) / (lo + 0.05)


def comp_over(surf, role, wall_rgb):
    """the palette color composited over a wall color at the card opacity (raised sits on the card: opaque)"""
    if role == 'raised':
        return hx(surf['raised'])
    op = surf['cardOpacity'] if role == 'card' else surf.get('heroOpacity', surf['cardOpacity'])
    return hx(surf[role]) * op + np.asarray(wall_rgb, np.float32) * (1 - op)


def ground_weight(c):
    mx, mn = c.max(2), c.min(2)
    L = lum(c)
    sat = (mx - mn) / np.maximum(mx, 1)
    return (np.clip((0.30 - L) / 0.16, 0, 1) * np.clip((0.8 - sat) / 0.2, 0, 1)).astype(np.float32)


def retint(px, wall_new, wall_old, rect, role, s_new, s_old):
    """shift the card ground inside rect from the old time's composite to the new time's; everything else stays"""
    x0, y0, x1, y1 = rect
    c = px[y0:y1, x0:x1]
    wb = ground_weight(c)[..., None]
    old = comp_over(s_old, role, np.median(wall_old[y0:y1, x0:x1].reshape(-1, 3), 0))
    new = comp_over(s_new, role, wall_new[y0:y1, x0:x1])
    gmed = np.median(c.reshape(-1, 3)[ground_weight(c).reshape(-1) > 0.9], 0) if (ground_weight(c) > 0.9).any() else old
    out = c + (new - old + (old - gmed)) * wb      # (old - gmed) absorbs the capture's own scrim / gloss offset
    px[y0:y1, x0:x1] = out.clip(0, 255)
    return np.median(new.reshape(-1, 3), 0)


MOON = (0.74 * W, 0.072 * H, 150)      # the night moon: excluded from the diff mask (its limb is not pixel-aligned
ICONS = (955, 165, 1110, 245)          # ... but the ? / gear icons beside it are UI


def ui_mask(shot, wall, top):
    d = np.abs(shot - wall).max(2)
    m = (d > 28).astype(np.float32)
    m[top:] = 0
    yy, xx = np.ogrid[0:H, 0:W]
    x0, y0, x1, y1 = ICONS                      # the icons themselves (bright pixels), not the halo / sky around them
    c = shot[y0:y1, x0:x1]
    ic = Image.fromarray(((c.max(2) > 175) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
    m[y0:y1, x0:x1] = np.asarray(ic).astype(np.float32) / 255
    m[(((xx - MOON[0]) ** 2 + (yy - MOON[1]) ** 2) < MOON[2] ** 2) & (xx < 970)] = 0
    mi = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(5))
    return np.asarray(mi).astype(np.float32) / 255


def fit_scrim(shot, wall):
    """flawless: the capture is the night wall under a dark scrim; fit cap = wall * k + c per channel on the top band"""
    sel = np.zeros((H, W), bool)
    sel[0:260, 0:260] = True; sel[0:260, W - 260:] = True          # top corners: scrim only, no mascot glow
    A = wall[sel]; B = shot[sel]
    k, c = [], []
    for ch in range(3):
        M = np.stack([A[:, ch], np.ones(len(A))], 1)
        sol = np.linalg.lstsq(M, B[:, ch], rcond=None)[0]
        k.append(sol[0]); c.append(sol[1])
    return np.array(k, np.float32), np.array(c, np.float32)


def main():
    walls = {}
    for page in ('home', 'leaderboard'):
        for t in TODS:
            walls[page, t] = np.asarray(Image.open(os.path.join(HERE, f'thanksgiving-{page}-{t}.webp')).resize((W, H), Image.LANCZOS)).astype(np.float32)
    shots = {p: np.asarray(Image.open(os.path.join(CAP, P['shot'])).convert('RGB')).astype(np.float32) for p, P in PAGES.items()}
    # the Dailies title at its in-app spot (same recipe as v1)
    band = shots['home'][1800:1960, 300:850]
    red = (band[..., 0] > 150) & (band[..., 1] < 90) & (band[..., 2] < 90)
    ys, xs = np.where(red); xs = xs + 300
    title = Image.open(TITLE).convert('RGBA'); ta = np.asarray(title)
    tys, txs = np.where((ta[..., 0] > 150) & (ta[..., 1] < 90) & (ta[..., 2] < 90) & (ta[..., 3] > 200))
    k = (xs.max() - xs.min()) / (txs.max() - txs.min())
    tw, th = round(title.width * k), round(title.height * k)
    tx, ty = round(xs.min() - txs.min() * k), round(1800 + ys.min() - tys.min() * k)
    title_s = title.resize((tw, th), Image.LANCZOS)

    rows = {}      # (tod) -> list of caption lines
    cells = {}     # (tod, page) -> image
    table = []     # NOTES.md rows
    for t in TODS:
        S, S0 = SURF[t], SURF['night']
        rows[t] = []
        for page, P in PAGES.items():
            shot = shots[page].copy()
            wall_new, wall_old = walls[P['wall'], t], walls[P['wall'], 'night']
            if P.get('scrim'):
                kk, cc = fit_scrim(shot, wall_old)
                bg_old = wall_old * kk + cc
                resid = shot - bg_old                                  # the sheet's own pink glow (+ UI)
                glow_only = Image.fromarray(resid.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(40))
                bg_new = wall_new * kk + cc + np.asarray(glow_only).astype(np.float32) * 0.9
                d = np.abs(resid).max(2)
                m = (d > 40).astype(np.float32)
                mi = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(3))
                m = np.asarray(mi).astype(np.float32)[..., None] / 255
                for x0, y0, x1, y1 in [r for _, r, _ in P['windows']]:
                    m[y0:y1, x0:x1] = 1
                comp = bg_new * (1 - m) + shot * m
                wall_for_cards = bg_new
                wall_old_for_cards = bg_old
            else:
                m = ui_mask(shot, wall_old, P['mask_top'])
                for x0, y0, x1, y1 in [r for _, r, _ in P['windows']] + P['keep']:
                    m[y0:y1, x0:x1] = 1
                m = m[..., None]
                comp = wall_new * (1 - m) + shot * m
                wall_for_cards, wall_old_for_cards = wall_new, wall_old
            # retint every window from the palette
            probes = {}
            for name, rect, role in P['windows']:
                probes[name] = retint(comp, wall_for_cards, wall_old_for_cards, rect, role, S, S0)
            im = Image.fromarray(comp.clip(0, 255).astype(np.uint8))
            if page == 'home':
                im.paste(title_s, (tx, ty), title_s)
            cells[t, page] = im
            # numbers: on-card ink vs the composited card at the probe, on-wall white chrome vs the wall
            pname, prect = P['text_probe']
            card_px = probes[pname]
            c_text, c_muted, c_sec = (contrast(hx(S[r]), card_px) for r in ('text', 'textMuted', 'textSecondary'))
            sky_s = np.median(wall_for_cards[190:270, 60:320].reshape(-1, 3), 0)
            c_chrome = contrast(hx(S['text']), sky_s)
            tab_px = probes.get('tab bar')
            c_tab = contrast(hx(S['textMuted']), tab_px) if tab_px is not None else float('nan')
            line = f'{page}: ink {c_text:.1f} / muted {c_muted:.1f} / secondary {c_sec:.1f}  wall-chrome {c_chrome:.1f}' + (f'  tab {c_tab:.1f}' if tab_px is not None else '')
            rows[t].append(line)
            table.append((t, page, c_text, c_muted, c_sec, c_chrome, c_tab))
        # buttons (fill fixed or the time's raised)
        for fam, (ink, fill) in BUTTONS.items():
            f = hx(fill) if fill else hx(S['raised'])
            table.append((t, 'button ' + fam, contrast(hx(ink), f), float('nan'), float('nan'), float('nan'), float('nan')))
    # ---- print the NOTES table ----
    print('| time | surface | text | muted | secondary | wall chrome | tab label |')
    print('|---|---|---|---|---|---|---|')
    for t, p, a, b, c, d, e in table:
        fmt = lambda v: '-' if v != v else f'{v:.1f}'
        print(f'| {t} | {p} | {fmt(a)} | {fmt(b)} | {fmt(c)} | {fmt(d)} | {fmt(e)} |')
    # ---- the sheet: 4 rows (times) x 3 phones ----
    pw, ph = 330, 714
    gap, top, left = 22, 96, 22
    rowh = ph + 92
    sheet = Image.new('RGB', (left + 3 * (pw + gap) + 20, top + 4 * rowh + 20), (24, 20, 30))
    d = ImageDraw.Draw(sheet)
    try:
        f0 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 30)
        f1 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 22)
        f2 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 16)
    except OSError:
        f0 = f1 = f2 = ImageFont.load_default()
    d.text((left, 20), 'Thanksgiving by time of day, v2: every window + quiet button tinted from that time\'s sky   (mockup 10-16)', fill=(236, 228, 240), font=f1)
    d.text((left, 52), 'Home / Leaderboard / Flawless.  Cards stay dark-family (light ink); candy buttons keep their brand gloss.  WCAG on the composited pixels.', fill=(170, 160, 180), font=f2)
    for r, t in enumerate(TODS):
        y = top + r * rowh
        S = SURF[t]
        d.text((left, y), f'{t.upper()}   card {S["card"]} @{S["cardOpacity"]}   raised {S["raised"]}   text {S["text"]} / {S["textMuted"]}   cap {S["cap"][1]}   glow {S["glow"]}', fill=(255, 214, 140), font=f1)
        for i, page in enumerate(PAGES):
            x = left + i * (pw + gap)
            sheet.paste(cells[t, page].resize((pw, ph), Image.LANCZOS), (x, y + 32))
            ln = rows[t][i].split(': ', 1)[1]
            weak = any(float(v) < 4.5 for v in [s for s in ln.replace('/', ' ').split() if s.replace('.', '').isdigit()][:3])
            a, b = ln.split('  wall-chrome')
            d.text((x, y + 36 + ph), 'on card: ' + a, fill=(255, 120, 110) if weak else (200, 220, 200), font=f2)
            d.text((x, y + 54 + ph), 'on wall (white chrome)' + b.replace('  tab', ', tab label'), fill=(200, 220, 200), font=f2)
    out = os.path.join(HERE, 'mockup-sheet-v2.jpg')
    sheet.save(out, quality=90)
    print('wrote', out, sheet.size)


if __name__ == '__main__':
    main()
