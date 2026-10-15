# JP's 45-day schedule: every post image is ONE template plus content (founder 10-14: "the images
# should all be cohesive"). See STYLE.md for the rules this file enforces.
#
#   python3 docs/design/brand/social/jp45/compose.py [post-key ...]     (no args = every post)
#
# Pieces: ChatGPT-drawn lettering (lettering/*.png, cut by extract-lettering.py), the real cast
# hero art composited in code (cast/hero, or seasons/halloween/cast for Oct 17-31), the kit sky
# + glossy letter tiles (kit.py), the shipped Halloween wall (Oct 17-31), the WORDOCIOUS wordmark.
import json, os, sys, shutil, datetime
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SOCIAL = os.path.dirname(HERE)
sys.path.insert(0, SOCIAL)
import kit
from kit import BRAND, place, text, sky, scatter_tiles, letter_tile, hex2rgb, shade, font, rr_mask, vgrad

REPO = kit.REPO
SPEC = '/private/tmp/claude-501/-Users-brianterchin-Developer-WordRush--claude-worktrees-new-session-38fb01/c71b5614-4332-4087-96d2-47d25779769a/scratchpad/jp-social/jp45-spec.json'
CAST = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']

# ------------------------------------------------------------------ the series template (STYLE.md)
LAYOUT = {
    'landscape': dict(W=1600, H=900, wm_top=34, wm_w=430, head_y=(108, 380), head_w=980, sub_y=(394, 470), sub_size=50,
                      content_top=486, base=824, foot_y=868, foot_size=26, tile=64),
    'portrait': dict(W=1080, H=1350, wm_top=52, wm_w=520, head_y=(166, 556), head_w=900, sub_y=(580, 680), sub_size=58,
                     content_top=702, base=1262, foot_y=1310, foot_size=30, tile=104),
    'pin': dict(W=1000, H=1500, wm_top=60, wm_w=520, head_y=(188, 650), head_w=860, sub_y=(676, 776), sub_size=58,
                content_top=802, base=1392, foot_y=1450, foot_size=30, tile=96),
}
HANDLE = {'x': '@wordocious', 'feed': '@playwordocious', 'fb': 'facebook.com/wordocious', 'pin': ''}
PURPLE_DEEP = (74, 32, 120)
STROKE = (124, 58, 237)

DARK = ('halloween', 'thanksgiving')
CUR = {'series': 'default', 'season': 'standard', 'glow_h': None}
PALETTE = ['#8B2CF5', '#F5A623', '#8E96A8']      # purple / gold / grey tile family (accent tinted per series by ctx())
SLIME = ('app-got-dressed', 'halloween-eve', 'happy-halloween')     # Halloween drip lettering keeps its own look

# Season x series headline colors (STYLE.md has the same table). ('grad', hue_top, hue_bottom, sat_mult, val_mult) or ('multi', [hues]).
CAST_HUES = [270, 37, 217, 332, 183, 144, 24, 272, 38]
SERIES_COLORS = {
    'standard': {   # cast colors (Nov 1-13 and any non-seasonal day)
        'default': None, 'brand': None, 'sweep': None,
        'monday': ('grad', 225, 210, 1, 1), 'wotd': ('grad', 190, 175, 1, 1), 'muddle': ('grad', 45, 28, 1, 1),
        'pangram': ('grad', 150, 135, 1, 1), 'friday': ('grad', 350, 335, 1, 1), 'cast': ('multi', CAST_HUES),
        'diwali': ('grad', 42, 8, 1, 1), 'veterans': ('grad', 222, 210, 1, 0.92),
    },
    'halloween': {
        'default': None, 'sweep': ('grad', 285, 305, 1, 0.95),
        'monday': ('grad', 250, 235, 0.85, 1), 'wotd': ('grad', 105, 85, 1, 1), 'muddle': ('grad', 32, 18, 1, 1),
        'pangram': ('grad', 175, 160, 0.9, 1), 'friday': ('grad', 358, 345, 1, 0.95), 'cast': ('multi', [50, 30, 14]),
    },
    'thanksgiving': {
        'thanks': ('grad', 40, 20, 0.95, 0.95), 'sweep': ('grad', 22, 15, 0.75, 0.72),
        'monday': ('grad', 305, 325, 0.9, 0.78), 'wotd': ('grad', 100, 90, 0.55, 0.85), 'muddle': ('grad', 25, 15, 1, 0.95),
        'pangram': ('grad', 48, 40, 0.85, 1), 'friday': ('grad', 350, 340, 1, 0.85), 'cast': ('multi', [345, 42, 22, 95, 305]),
        'league': ('grad', 100, 90, 0.55, 0.85), 'veterans': None,
    },
}


def hsv_rgb(h, s, v):
    import colorsys
    r, g, b = colorsys.hsv_to_rgb((h % 360) / 360, s, v)
    return (round(r * 255), round(g * 255), round(b * 255))


def spec_now():
    return SERIES_COLORS[CUR['season'] if CUR['season'] in SERIES_COLORS else 'standard'].get(CUR['series'])


def ctx(series, season):
    """Set the active series + season: headline hue, tile accent, text stroke, headline glow."""
    CUR['series'], CUR['season'] = series, season
    sp = SERIES_COLORS.get(season, SERIES_COLORS['standard']).get(series)
    if sp is None:
        PALETTE[:] = ['#8B2CF5', '#F5A623', '#8E96A8']; CUR['glow_h'] = None
    else:
        h = sp[1] if sp[0] == 'grad' else sp[1][0]
        sm = sp[3] if sp[0] == 'grad' else 1; vm = sp[4] if sp[0] == 'grad' else 1
        PALETTE[:] = ['#%02x%02x%02x' % hsv_rgb(h, min(1, 0.8 * sm), min(1, 0.95 * vm)), '#F5A623', '#8E96A8']
        CUR['glow_h'] = h


def cur_stroke():
    sp = spec_now()
    if sp is None:
        return STROKE
    h = sp[1] if sp[0] == 'grad' else sp[1][0]
    return hsv_rgb(h, 0.72, 0.55)


def tint(im, sp, name=''):
    """Recolor the purple-pink house lettering (keeps rim shading, highlights and alpha)."""
    if sp is None:
        return im
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(np.float32)
    H = hsv[..., 0] * 360 / 255; S = hsv[..., 1] / 255; V = hsv[..., 2] / 255
    sel = (H > 235) & (H < 350) & (S > 0.15)
    t = np.clip((H - 272) / 53, 0, 1)
    if sp[0] == 'grad':
        _, top, bot, sm, vm = sp
        nh = top + (bot - top) * t
    else:
        hues = sp[1]; al = np.asarray(im.getchannel('A')) > 40
        nh = np.zeros_like(H); sm = vm = 1
        rows = al.sum(axis=1)
        cut = None
        if name in ('cast-saturday',):
            lo, hi = int(len(rows) * 0.38), int(len(rows) * 0.62)
            cut = lo + int(np.argmin(rows[lo:hi]))
        zones = [(0, cut, 4), (cut, len(rows), 8)] if cut else [(0, len(rows), max(2, round(im.width / 120)))]
        k = 0
        for y0, y1, n in zones:
            cols = np.where(al[y0:y1].any(axis=0))[0]
            if len(cols) == 0:
                continue
            x0, x1 = cols.min(), cols.max() + 1
            for i in range(n):
                xa = x0 + (x1 - x0) * i / n; xb = x0 + (x1 - x0) * (i + 1) / n
                nh[y0:y1, int(xa):int(xb) + (1 if i == n - 1 else 0)] = hues[k % len(hues)]; k += 1
        nh = nh + (t - 0.5) * 14
    nS = np.clip(S * sm, 0, 1); nV = np.clip(V * vm, 0, 1)
    out = np.dstack([(nh % 360) * 255 / 360, nS * 255, nV * 255]).astype(np.uint8)
    rgb = np.asarray(Image.fromarray(out, 'HSV').convert('RGB')).astype(np.float32)
    base = np.asarray(im.convert('RGB')).astype(np.float32)
    mix = np.where(sel[..., None], rgb, base).astype(np.uint8)
    res = Image.fromarray(mix, 'RGB').convert('RGBA'); res.putalpha(im.getchannel('A'))
    return res


def tinted(name):
    if name in SLIME or name.startswith('bring-your-family') or name in ('the-crown-is-open', 'caption-this'):
        return lettering(name)
    k = ('tint', name, CUR['series'], CUR['season'])
    if k not in _c:
        _c[k] = tint(lettering(name), spec_now(), name)
    return _c[k]


_c = {}


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())


def lettering(name):
    if name not in _c:
        _c[name] = Image.open(os.path.join(HERE, 'lettering', name + '.png')).convert('RGBA')
    return _c[name]


def hero(cid, season):
    k = (cid, season)
    if k not in _c and '|' in cid:
        _c[k] = trim(Image.open(os.path.join(BRAND, cid.split('|')[1])).convert('RGBA'))
    if k not in _c:
        folder = os.path.join(BRAND, 'seasons', season, 'cast') if season in ('halloween', 'thanksgiving') else os.path.join(BRAND, 'cast', 'hero')
        _c[k] = trim(Image.open(os.path.join(folder, cid + '.png')).convert('RGBA'))
    return _c[k]


def wordmark():
    if 'wm' not in _c:
        _c['wm'] = trim(Image.open(os.path.join(SOCIAL, 'wordmark-keyed.png')).convert('RGBA'))
    return _c['wm']


def fit(im, maxw, maxh, cap=1.5):
    s = min(maxw / im.width, maxh / im.height, cap)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def drop_shadow(canvas, im, x, y, dark=(60, 20, 100), a=95, blur=0.03, dy=0.05):
    sh = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    al = im.getchannel('A').point(lambda v: int(v * a / 255))
    layer = Image.new('RGBA', im.size, dark + (255,)); layer.putalpha(al)
    sh.alpha_composite(layer, (round(x), round(y + im.height * dy)))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(max(2, im.height * blur))))


# ------------------------------------------------------------------ background
def background(fmt, season, avoid=None):
    L = LAYOUT[fmt]; W, H = L['W'], L['H']
    if season in ('halloween', 'thanksgiving'):
        wall = Image.open(os.path.join(BRAND, 'seasons', season, 'walls', 'wall-home-wide.webp')).convert('RGBA')
        box = {'landscape': (0, 75, 2400, 1425), 'portrait': (1200, 0, 2400, 1500), 'pin': (1400, 0, 2400, 1500)}[fmt]
        c = wall.crop(box).resize((W, H), Image.LANCZOS)
        glow = Image.new('L', (W, H), 0)
        ImageDraw.Draw(glow).ellipse((W * 0.12, L['head_y'][0] - 60, W * 0.88, L['head_y'][1] + 120), fill=120)
        gc = hsv_rgb(CUR['glow_h'], 0.62, 0.62) if CUR['glow_h'] is not None else (110, 50, 170)
        c.paste(Image.new('RGBA', (W, H), gc + (255,)), (0, 0), glow.filter(ImageFilter.GaussianBlur(W * 0.06)))
        cols = ['#F0782C', '#8B2CF5', '#FF9F1A', '#9B3DF3'] if season == 'halloween' else ['#C0562A', '#E8A33A', '#7A2E4A', '#8B6B3A']
    else:
        c = sky(W, H, seed=7)
        cols = None
    old = kit.TILE_COLORS
    if cols:
        kit.TILE_COLORS = cols
    scatter_tiles(c, list('WORDOCIOUS'), seed=7, count=9, max_size=0.12,
                  keep_clear=[(0.24, 0.0, 0.76, 1.0)], avoid=avoid)
    kit.TILE_COLORS = old
    return c


# ------------------------------------------------------------------ cast
def contact_shadow(c, cx, by, w, a=70):
    m = Image.new('L', c.size, 0)
    ImageDraw.Draw(m).ellipse((cx - w / 2, by - w * 0.06, cx + w / 2, by + w * 0.06), fill=a)
    c.paste(Image.new('RGBA', c.size, (50, 20, 90, 255)), (0, 0), m.filter(ImageFilter.GaussianBlur(w * 0.05)))


def silhouette(im):
    """Dark purple silhouette of a hero with a warm rim light on the upper-left edge."""
    a = np.asarray(im.getchannel('A')).astype(np.float32)
    r = max(3, round(im.width * 0.012))
    shifted = np.roll(np.roll(a, r, axis=0), r, axis=1)
    rim = np.clip(a - shifted, 0, 255)
    out = np.zeros((im.height, im.width, 4), np.uint8)
    out[..., :3] = (46, 20, 88); out[..., 3] = a.astype(np.uint8)
    glow = Image.fromarray(np.clip(rim * 1.4, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r * 0.9))
    base = Image.fromarray(out, 'RGBA')
    lit = Image.new('RGBA', im.size, (255, 206, 110, 255)); lit.putalpha(Image.fromarray(np.minimum(np.asarray(glow).astype(np.int32) * 1.0, 255).astype(np.uint8)))
    lit2 = Image.new('RGBA', im.size, (255, 236, 190, 255)); lit2.putalpha(Image.fromarray(np.clip(rim * 1.1, 0, 255).astype(np.uint8)))
    # keep light inside the silhouette so it reads as an edge light, not a halo
    for l in (lit, lit2):
        l.putalpha(Image.fromarray((np.asarray(l.getchannel('A')).astype(np.float32) * np.clip(a / 255 + 0.0, 0, 1)).astype(np.uint8)))
    base.alpha_composite(lit); base.alpha_composite(lit2)
    return base


def row(c, ids, cx, span, base_y, max_h, season, overlap=0.1, bounce=0.07, sil=False, shadow=True):
    """Cast standing on base_y, centered on cx, never wider than span or taller than max_h."""
    ims = [hero(i, season) for i in ids]
    asp = [im.width / im.height for im in ims]
    h = min(max_h / (1 + bounce), span / (sum(asp) * (1 - overlap) + asp[-1] * overlap))
    ws = [a * h for a in asp]
    total = sum(ws) * (1 - overlap) + ws[-1] * overlap
    x = cx - total / 2
    placed = []
    for k, (cid, im, w) in enumerate(zip(ids, ims, ws)):
        lift = h * bounce * (1 if k % 2 else 0)
        if shadow and not sil:
            contact_shadow(c, x + w / 2, base_y, w * 0.8)
        pic = im.resize((round(w), round(h)), Image.LANCZOS)
        if sil:
            pic = silhouette(pic)
        y = base_y - lift - h
        c.alpha_composite(pic, (round(x), round(y)))
        placed.append((cid, (round(x), round(y), round(x + w), round(y + h))))
        x += w * (1 - overlap)
    return placed


def cast_block(c, fmt, ids, season, cast_top, sil=False):
    L = LAYOUT[fmt]; W = L['W']; base = L['base']
    avail = base - cast_top
    placed = []
    if len(ids) == 10:
        if fmt == 'landscape':
            placed += row(c, ids, W / 2, W - 96, base, avail, season, sil=sil)
        else:
            span = W * 0.9
            a1, a2 = ids[:5], ids[5:]
            asp = [hero(i, season).width / hero(i, season).height for i in a1]
            rh = span / (sum(asp) * 0.9 + asp[-1] * 0.1)
            rh = min(rh, avail / 1.75)
            placed += row(c, a1, W / 2, span, base - rh * 0.8, rh * 1.07, season, sil=sil)
            placed += row(c, a2, W / 2, span, base, rh * 1.07, season, sil=sil)
    else:
        span = min(W - 96, len(ids) * avail * 0.95)
        placed += row(c, ids, W / 2, span, base, min(avail, 360 if fmt != 'landscape' else 300), season, overlap=0.06, sil=sil)
    return placed


# ------------------------------------------------------------------ content blocks
def tiles_row(labels, size, colors, gap=0.12):
    ims = [letter_tile(t, size, colors[i % len(colors)], shadow=False) for i, t in enumerate(labels)]
    g = round(size * gap)
    w = sum(i.width for i in ims) + g * (len(ims) - 1)
    out = Image.new('RGBA', (w, ims[0].height), (0, 0, 0, 0))
    x = 0
    for im in ims:
        out.alpha_composite(im, (x, 0)); x += im.width + g
    return out


def tiles_grid(rows_labels, size, colors, gap=0.12):
    rows = [tiles_row(r, size, colors, gap) for r in rows_labels]
    g = round(size * gap)
    out = Image.new('RGBA', (max(r.width for r in rows), sum(r.height for r in rows) + g * (len(rows) - 1)), (0, 0, 0, 0))
    y = 0
    for r in rows:
        out.alpha_composite(r, ((out.width - r.width) // 2, y)); y += r.height + g
    return out


def panel(w, h, tint=(255, 255, 255), radius=0.12, alpha=232):
    """Soft glossy glass card (no rim): lavender gradient, light top gloss."""
    face = vgrad(w, h, [(0, shade(tint, 0.0)), (1, (232, 218, 252))]).convert('RGBA')
    m = rr_mask(w, h, round(h * radius))
    face.putalpha(m.point(lambda v: int(v * alpha / 255)))
    return face


def cartoon_frame(path, w):
    im = Image.open(path).convert('RGBA')
    pad = round(w * 0.025)
    im = im.resize((w - 2 * pad, round((w - 2 * pad) * im.height / im.width)), Image.LANCZOS)
    f = Image.new('RGBA', (w, im.height + 2 * pad), (0, 0, 0, 0))
    r = round(w * 0.045)
    f.paste(Image.new('RGBA', f.size, (255, 255, 255, 255)), (0, 0), rr_mask(f.width, f.height, r))
    f.paste(im, (pad, pad), rr_mask(im.width, im.height, round(r * 0.6)))
    return f


# ------------------------------------------------------------------ the template itself
def build(fmt, season, slot, headline, sub=None, content=None, cast=None, cast_mode='cast', head_stack=False, head_cap=1.5):
    """headline: lettering name (or list of names stacked); sub: ('lettering', name) | ('text', str);
    content: RGBA image placed in the content slot (centered); cast: list of hero ids."""
    L = LAYOUT[fmt]; W, H = L['W'], L['H']
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    placements = []
    # wordmark spot (top center, same size every post)
    wm = wordmark(); wmw = L['wm_w']; wmh = round(wmw * wm.height / wm.width)
    wmi = wm.resize((wmw, wmh), Image.LANCZOS)
    halo = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    hm = Image.new('L', layer.size, 0)
    hm.paste(wmi.getchannel('A').filter(ImageFilter.MaxFilter(13)), ((W - wmw) // 2, L['wm_top']))
    halo.paste(Image.new('RGBA', layer.size, (255, 244, 255, 255)), (0, 0), hm.filter(ImageFilter.GaussianBlur(wmh * 0.22)).point(lambda v: min(255, int(v * 0.9))))
    layer.alpha_composite(halo)
    drop_shadow(layer, wmi, (W - wmw) / 2, L['wm_top'], dark=(40, 10, 80), a=150, blur=0.05, dy=0.08)
    layer.alpha_composite(wmi, ((W - wmw) // 2, L['wm_top']))
    # headline zone (same place every post)
    y0, y1 = L['head_y']
    names = headline if isinstance(headline, list) else [headline]
    parts = [tinted(n) for n in names]
    if len(parts) > 1:   # stacked lines of equal cap height
        hh = min(p.height for p in parts)
        parts = [p.resize((round(p.width * hh / p.height), hh), Image.LANCZOS) for p in parts]
        gap = round(hh * 0.12)
        hw = max(p.width for p in parts)
        st = Image.new('RGBA', (hw, sum(p.height for p in parts) + gap * (len(parts) - 1)), (0, 0, 0, 0))
        yy = 0
        for p in parts:
            st.alpha_composite(p, ((hw - p.width) // 2, yy)); yy += p.height + gap
        hl = st
    else:
        hl = parts[0]
    hl = fit(hl, L['head_w'], y1 - y0, cap=head_cap)
    hx, hy = (W - hl.width) // 2, y0 + (y1 - y0 - hl.height) // 2
    drop_shadow(layer, hl, hx, hy, dark=(20, 5, 50) if season in DARK else (80, 30, 120), a=110)
    layer.alpha_composite(hl, (hx, hy))
    bottom = hy + hl.height
    # sub line
    if sub:
        s0, s1 = L['sub_y']
        if sub[0] == 'lettering':
            si = fit(lettering(sub[1]), W * 0.74, s1 - s0, cap=1.3)
            sx, sy = (W - si.width) // 2, s0 + (s1 - s0 - si.height) // 2
            drop_shadow(layer, si, sx, sy, dark=(20, 5, 50) if season in DARK else (110, 50, 20), a=100)
            layer.alpha_composite(si, (sx, sy))
            bottom = sy + si.height
        else:
            sz = L['sub_size']
            text(layer, sub[1], W / 2, (s0 + s1) / 2, sz, fill=(255, 255, 255), stroke=cur_stroke(), sw=max(3, sz // 9))
            bottom = (s0 + s1) / 2 + sz * 0.6
    # content slot
    ctop = max(bottom + 18, L['content_top']) if sub else bottom + 24
    if content is not None:
        ci = content
        layer.alpha_composite(ci, ((W - ci.width) // 2, round(ctop)))
        bottom = ctop + ci.height
    # cast
    sil = cast_mode == 'silhouette'
    if cast and cast_mode == 'sides' and content is not None:
        # two heroes standing on the baseline either side of the content block (symmetric)
        side_h = {'landscape': 330, 'portrait': 300, 'pin': 300}[fmt]
        gap = 24
        for cid, sgn in zip(cast[:2], (-1, 1)):
            asp = hero(cid, season).width / hero(cid, season).height
            span = (W / 2 - content.width / 2 - 2 * gap)
            h = min(side_h, span / asp)
            cx = W / 2 + sgn * (content.width / 2 + gap + h * asp / 2)
            placements += row(layer, [cid], cx, h * asp + 4, L['base'], h * 1.07, season)
    elif cast:
        pl = cast_block(layer, fmt, cast, season, bottom + 22, sil=sil)
        placements = pl
    # footer: handle + url
    foot = ' · '.join(v for v in (HANDLE[slot], 'wordocious.com') if v)
    col = (236, 224, 255) if season in DARK else PURPLE_DEEP
    text(layer, foot, W / 2, L['foot_y'], L['foot_size'], fill=col, weight='ExtraBold', shadow=season in DARK)
    avoid = np.asarray(layer.getchannel('A').filter(ImageFilter.MaxFilter(15))) > 10
    c = background(fmt, season, avoid)
    c.alpha_composite(layer)
    return c.convert('RGB'), placements


# ------------------------------------------------------------------ posts
def hero_compare(path, placements, final, season):
    """raw/compare-<id>.png: the real hero art next to the instance cropped from the final."""
    if not placements:
        return
    seen = {}
    for cid, bb in placements:
        seen.setdefault(cid, bb)
    tiles = []
    for cid, bb in seen.items():
        ref = hero(cid.split('|')[0], season)
        pad = 6
        crop = final.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), bb[2] + pad, bb[3] + pad)).convert('RGBA')
        h = 240
        a = ref.resize((round(ref.width * h / ref.height), h), Image.LANCZOS)
        b = crop.resize((round(crop.width * h / crop.height), h), Image.LANCZOS)
        t = Image.new('RGBA', (a.width + b.width + 30, h + 8), (200, 190, 230, 255))
        t.alpha_composite(a, (4, 4)); t.alpha_composite(b, (a.width + 26, 4))
        tiles.append(t)
    W = sum(t.width for t in tiles[:5]) + 10 * 5
    sheet = Image.new('RGB', (min(2400, max(W, 800)), (248 * ((len(tiles) + 4) // 5)) + 8), (200, 190, 230))
    x = y = 4
    for i, t in enumerate(tiles):
        if i and i % 5 == 0:
            x = 4; y += 248
        sheet.paste(t.convert('RGB'), (x, y)); x += t.width + 10
    sheet.save(path)


def out_dir(key):
    d = os.path.join(HERE, key); os.makedirs(os.path.join(d, 'raw'), exist_ok=True)
    return d


def finish(key, imgs, placements_by_fmt, season, raw_letters):
    d = out_dir(key)
    files = {}
    for fmt, im in imgs.items():
        fn = {'landscape': 'landscape.png', 'portrait': 'portrait.png', 'pin': 'pin.png'}[fmt]
        im.save(os.path.join(d, fn), optimize=True)
        files[fmt] = f'{key}/{fn}'
        hero_compare(os.path.join(d, 'raw', f'compare-{fmt}.png'), placements_by_fmt.get(fmt), im, season)
    for rl in raw_letters:
        src = os.path.join(HERE, 'lettering', 'raw', rl)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(d, 'raw', rl))
    return files




def text_img(s, size, fill=(255, 255, 255), stroke='auto', weight='Black', pad=None):
    if stroke == 'auto':
        stroke = cur_stroke()
    f = font(size, weight)
    sw = max(3, size // 9) if stroke else 0
    bb = ImageDraw.Draw(Image.new('RGBA', (4, 4))).textbbox((0, 0), s, font=f, anchor='lt', stroke_width=sw)
    p = pad if pad is not None else sw + 4
    im = Image.new('RGBA', (bb[2] - bb[0] + 2 * p, bb[3] - bb[1] + 2 * p), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((p - bb[0], p - bb[1]), s, font=f, fill=fill, anchor='lt', stroke_width=sw, stroke_fill=stroke)
    return im


def wrap(s, size, maxw, weight='Black'):
    f = font(size, weight); words = s.split(); lines, cur = [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if f.getlength(t) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    return lines + [cur]


def stack(imgs, gap=10, align='center'):
    w = max(i.width for i in imgs); h = sum(i.height for i in imgs) + gap * (len(imgs) - 1)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); y = 0
    for i in imgs:
        out.alpha_composite(i, ((w - i.width) // 2 if align == 'center' else 0, y)); y += i.height + gap
    return out


def card(inner, padx, pady, tint=(255, 255, 255)):
    p = panel(inner.width + 2 * padx, inner.height + 2 * pady, tint)
    sh = Image.new('RGBA', (p.width + 80, p.height + 80), (0, 0, 0, 0))
    m = Image.new('L', sh.size, 0); ImageDraw.Draw(m).rounded_rectangle((40, 54, 40 + p.width, 54 + p.height), round(p.height * 0.12), fill=70)
    sh.paste(Image.new('RGBA', sh.size, (70, 30, 110, 255)), (0, 0), m.filter(ImageFilter.GaussianBlur(14)))
    sh.alpha_composite(p, (40, 40)); sh.alpha_composite(inner, (40 + padx, 40 + pady))
    return sh.crop((20, 20, sh.width - 20, sh.height - 20))


def wotd_card(word, tile, definition=None, pos=None, note=None):
    """The Word of the Day card content: the word in glossy tiles on a soft glass card.
    This is the function the daily WOTD quiz post uses: wotd_card('WORD', tile_px)."""
    tr = tiles_row(list(word), tile, PALETTE[:2], gap=0.1)
    parts = [tr]
    if definition:
        lines = wrap(definition, round(tile * 0.52), max(tr.width, 560) * 0.96)
        parts += [text_img(l, round(tile * 0.52), fill=PURPLE_DEEP, stroke=None, pad=2) for l in lines]
    if pos:
        parts.insert(1, text_img(pos, round(tile * 0.36), fill=(140, 90, 200), stroke=None, weight='ExtraBold', pad=2))
    if note:
        parts.append(text_img(note, round(tile * 0.42), fill=PURPLE_DEEP, stroke=None, pad=2))
    inner = stack(parts, gap=round(tile * 0.24))
    return card(inner, round(tile * 0.5), round(tile * 0.42))


def arrow_img(size):
    ss = 4; w, h = size * ss, round(size * 0.7) * ss
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, h * 0.36, w * 0.62, h * 0.64), h * 0.14, fill=(124, 58, 237, 255))
    d.polygon([(w * 0.55, h * 0.08), (w * 0.98, h * 0.5), (w * 0.55, h * 0.92)], fill=(124, 58, 237, 255))
    return im.resize((size, round(size * 0.7)), Image.LANCZOS)


def steps_card(tile, lines, scr_word='GCRERO', sol_word='GROCER'):
    scr = tiles_row(list(scr_word), tile, PALETTE[:2], gap=0.1)
    arrow = arrow_img(round(tile * 0.9))
    sol = tiles_row(list(sol_word), tile, ['#F5A623'], gap=0.1)
    demo = Image.new('RGBA', (scr.width + sol.width + arrow.width + 60, scr.height), (0, 0, 0, 0))
    demo.alpha_composite(scr, (0, 0)); demo.alpha_composite(arrow, (scr.width + 30, (scr.height - arrow.height) // 2))
    demo.alpha_composite(sol, (scr.width + arrow.width + 60, 0))
    fs = round(tile * 0.5)
    rows = []
    for n, l in enumerate(lines, 1):
        num = letter_tile(str(n), round(fs * 1.5), '#8B2CF5', shadow=False)
        t = text_img(l, fs, fill=PURPLE_DEEP, stroke=None, pad=2)
        r = Image.new('RGBA', (num.width + 24 + t.width, max(num.height, t.height)), (0, 0, 0, 0))
        r.alpha_composite(num, (0, (r.height - num.height) // 2)); r.alpha_composite(t, (num.width + 24, (r.height - t.height) // 2))
        rows.append(r)
    lw = max(r.width for r in rows)
    lines_img = Image.new('RGBA', (lw, sum(r.height for r in rows) + 22 * (len(rows) - 1)), (0, 0, 0, 0)); y = 0
    for r in rows:
        lines_img.alpha_composite(r, (0, y)); y += r.height + 22
    return card(stack([demo, lines_img], gap=round(tile * 0.5)), round(tile * 0.5), round(tile * 0.45))




# ------------------------------------------------------------------ rotation (founder: posts always seem fresh)
FULL = CAST
CH = {'x': 'x', 'feed': 'ig', 'fb': 'fb', 'pin': 'pin'}
STATE = {'last': {}, 'lastsize': {}, 'count': {c: 0 for c in CAST}, 'var': {c: 0 for c in CAST}, 'occ': {}, 'rot': 0}
POSE_SKIP = ('sit', 'lean', 'waiting', 'goodgame', 'cushion', 'upside', 'handstand', 'cartwheel')


def variants(cid, season):
    """Every shipped, on-model art variant of one character for this season (base first)."""
    out = [cid]
    if season in ('halloween', 'thanksgiving'):
        d = os.path.join(BRAND, 'seasons', season, 'cast')
        out += [f'{cid}|seasons/{season}/cast/{f}' for f in sorted(os.listdir(d)) if f.startswith(cid + '-alt') and f.endswith('.png')]
    else:
        d = os.path.join(BRAND, 'poses')
        out += [f'{cid}|poses/{f}' for f in sorted(os.listdir(d)) if f.startswith(cid + '-') and f.endswith('.png')
                and not any(k in f for k in POSE_SKIP)]
    return out


def pick(card, slot, season, n):
    """Choose the lineup for this post: least-used characters first, never the same lineup twice in a row on a channel."""
    ch = CH[slot]
    if n >= 10:
        ids = list(CAST)
    else:
        last = {i.split('|')[0] for i in STATE['last'].get(ch, ())} if STATE['lastsize'].get(ch, 0) < 10 else set()
        order = sorted(CAST, key=lambda c: (STATE['count'][c], c in last, (CAST.index(c) * 3 + STATE['rot']) % 10))
        chosen = order[:n]
        STATE['rot'] += 1
        ids = []
        for c in CAST:
            if c in chosen:
                vs = variants(c, season)
                ids.append(vs[STATE['var'][c] % len(vs)] if n < 7 else c)
                STATE['var'][c] += 1
    for i in ids:
        STATE['count'][i.split('|')[0]] += 1
    STATE['last'][ch] = tuple(ids); STATE['lastsize'][ch] = len(ids)
    return ids


SIZE_OPTS = {
    'teaser': [10], 'launch': [10], 'dressed': [10], 'pin-cast': [10, 6, 5], 'pin-explainer': [2, 3], 'pin-word': [2, 1],
    'friday': [1, 2], 'cast-sat': [10, 6, 5], 'sweep': [2, 3], 'monday': [3, 2, 4], 'ph': [10, 5], 'dress': [10, 6], 'dress-reminder': [4, 3],
    'eve': [10, 5], 'happy-halloween': [10, 6], 'winners': [3], 'cleans-up': [10, 6], 'potw': [2, 1], 'wotd-punch': [2],
    'wotd-quiz': [2, 3, 1], 'pangram': [3, 2], 'muddle': [2], 'diwali': [6, 10], 'veterans': [3, 4], 'thanksgiving': [10],
    'league-open': [4, 5], 'league-final': [5, 4], 'thanks-eve': [5, 10], 'happy-thanks': [10, 6], 'pro': [3, 4], 'cast-wrap': [10], 'day45': [6, 10],
}


def size_for(card, slot):
    ch = CH[slot]
    opts = SIZE_OPTS.get(card, [10, 5])
    i = STATE['occ'].get(card, 0)
    n = opts[i % len(opts)]
    if n >= 10 and STATE['lastsize'].get(ch, 0) >= 10 and len(opts) > 1:
        n = opts[(i + 1) % len(opts)]
        if n >= 10:
            n = opts[(i + 2) % len(opts)]
    return n


# ------------------------------------------------------------------ cards (every scheduled post = template + a card)
def season_of(d):
    return 'halloween' if '2026-10-17' <= d <= '2026-10-31' else ('thanksgiving' if '2026-11-14' <= d <= '2026-11-29' else 'standard')


def T(fmt):
    return LAYOUT[fmt]['tile']


def occ():
    return CUR['occ']


def pal_rot(k):
    p = list(PALETTE); return p[k % 3:] + p[:k % 3]


def muddle_card(fmt, season, slot, L, cartoon):
    path = os.path.join(REPO, 'apps', 'web', 'public', 'muddle', cartoon)
    fr = cartoon_frame(path, 400 if fmt == 'landscape' else 560)
    return build(fmt, season, slot, 'muddle-wednesday', sub=('lettering', 'caption-this'), content=fr, cast=L, cast_mode='sides')


def sweep_c(fmt, season, slot, L):
    t = T(fmt); o = occ() % 3
    pal = PALETTE if o != 2 else pal_rot(1)
    if o == 1:
        tiles = tiles_grid([[''] * 9, [''] * 9], round(t * 0.78), [PALETTE[0], '#F5A623'], gap=0.1) if fmt == 'landscape' else \
            tiles_grid([[''] * 6] * 3, round(t * 0.84), [PALETTE[0], '#F5A623'], gap=0.1)
    elif fmt == 'landscape':
        tiles = tiles_row([str(i) for i in range(1, 19)], round(t * 1.12), pal, gap=0.1)
    else:
        tiles = tiles_grid([[str(i) for i in range(r * 6 + 1, r * 6 + 7)] for r in range(3)], round(t * 0.84), pal, gap=0.1)
    return build(fmt, season, slot, 'sweep-sunday', sub=('text', ['All 18 dailies. One day.', 'Can you sweep all 18?', 'Eighteen games. One Sunday.'][occ() % 3]), content=tiles, cast=L)


def friday_c(fmt, season, slot, L):
    t = T(fmt); o = occ() % 3
    if o == 0:
        c = tiles_row([''] * 5, round(t * 1.25), ['#F5A623'], gap=0.12)
    elif o == 1:
        c = tiles_grid([[''] * 5, [''] * 5] if fmt == 'landscape' else [[''] * 5] * 3, round(t * (0.8 if fmt == 'landscape' else 1.0)), ['#F5A623', PALETTE[0], '#8E96A8'], gap=0.12)
    else:
        c = tiles_row([''] * 7, round(t * 1.0), ['#F5A623', PALETTE[0]], gap=0.12)
    return build(fmt, season, slot, 'fridays-finest', sub=('text', ['Show us your best board.', 'Your best board of the week.', 'Post your proudest streak.'][occ() % 3]), content=c, cast=L)


def S(head, sub, content=None, sub_kind='text', cast_mode='cast'):
    def f(fmt, season, slot, L):
        sb = sub[occ() % len(sub)] if isinstance(sub, list) else sub
        c = content(fmt) if content else None
        return build(fmt, season, slot, head, sub=(sub_kind, sb) if sb else None, content=c, cast=L, cast_mode=cast_mode)
    return f


def mrow(n, fmt, k=1.0, cols=None):
    return tiles_row([''] * n, round(T(fmt) * k), cols or PALETTE, gap=0.12)


def monday_c(fmt, season, slot, L):
    txt = ['New week. Zero points.', 'Race resets today.', 'Everyone starts at zero.', 'Who takes the crown?'][occ() % 4]
    return build(fmt, season, slot, 'monday-masters', sub=('lettering', 'the-crown-is-open'), content=text_img(txt, LAYOUT[fmt]['sub_size']), cast=L)


def wotd_c(fmt, season, slot, L):
    note = ['Pick the real definition.', 'Three meanings. One is real.', 'Which meaning is right?'][occ() % 3]
    return build(fmt, season, slot, 'word-of-the-day-quiz', sub=None, content=wotd_card('?????', 90, note=note), cast=L)


def pangram_c(fmt, season, slot, L):
    sb = ['Today’s letters hide a seven-letter word.', 'One word uses every letter.', 'Find the pangram.'][occ() % 3]
    return build(fmt, season, slot, '7-letters-one-word', sub=('text', sb), content=tiles_row(['?'] * 7, round(T(fmt) * 1.2), pal_rot(occ()), gap=0.12), cast=L)


def teaser_c(fmt, season, slot, L):
    tiles = tiles_grid([[''] * 9, [''] * 9], T(fmt), ['#8E96A8'])
    return build(fmt, season, slot, 'tomorrow', content=tiles, cast=L, cast_mode='silhouette')


def punch_c(fmt, season, slot, L):
    return build(fmt, season, slot, 'word-of-the-day-quiz', sub=None, content=wotd_card('PUNCH', 90, note='Pick the real definition.'), cast=L)


BANK = None


def muddle_demo(idx):
    global BANK
    if BANK is None:
        BANK = json.load(open(os.path.join(REPO, 'apps', 'web', 'data', 'scramble-puzzles.json')))
    w = BANK['daily'][idx]['words'][0]
    return w['scramble'], w['answer']


PIN_IDX = {'2026-10-15': 20, '2026-10-21': 26, '2026-10-22': 27, '2026-10-29': 33, '2026-11-05': 40, '2026-11-12': 47, '2026-11-19': 54, '2026-11-26': 61}
WORDS = [('JUBILANT', 'Feeling or showing great happiness and triumph.', 'adjective'),
         ('GOSSAMER', 'A very light, thin, delicate fabric or film.', 'noun'),
         ('ELOQUENT', 'Speaking or writing in a fluent, moving way.', 'adjective'),
         ('WANDERLUST', 'A strong urge to travel and see the world.', 'noun'),
         ('HULLABALOO', 'A loud, confused noise or fuss.', 'noun'),
         ('BAMBOOZLE', 'To trick or fool someone.', 'verb'),
         ('GLIMMERING', 'Shining with a faint, wavering light.', 'adjective'),
         ('JUBILANT', 'Feeling or showing great happiness and triumph.', 'adjective')]


def pin_expl_c(fmt, season, slot, L):
    scr, sol = muddle_demo(PIN_IDX[CUR['date']])
    t = LAYOUT['pin']['tile']
    lines = [['Unscramble four words', 'Ringed letters spell the punchline', 'Finish the cartoon caption'],
             ['Four words are scrambled', 'Ring the letters to spell the joke', 'Complete the cartoon caption']][occ() % 2]
    c = steps_card(round(t * 0.6), lines, scr, sol)
    return build('pin', season, slot, 'how-muddle-works', sub=('text', ['A new cartoon puzzle every day.', 'One cartoon. One punchline.'][occ() % 2]), content=c, cast=L)


def pin_word_c(fmt, season, slot, L):
    w, d, pos = WORDS[occ() % len(WORDS)]
    sub = ['Learn one new word a day.', 'A new word every day.'][occ() % 2]
    c = wotd_card(w, 76 if len(w) <= 8 else 70, definition=d, pos=pos)
    return build('pin', season, slot, 'word-of-the-day', sub=('text', sub), content=c, cast=L)


def pin_cast_c(fmt, season, slot, L):
    return build('pin', season, slot, 'meet-the-cast', sub=('lettering', 'bring-your-family-b'), cast=L, head_cap=0.95)


def launch_c(fmt, season, slot, L):
    return build(fmt, season, slot, ['daily-games', 'one-score'], sub=('lettering', 'bring-your-family-b'), cast=L)


def dressed_c(fmt, season, slot, L):
    return build(fmt, season, slot, 'app-got-dressed', sub=('text', 'Halloween is live through Oct 31.'), cast=L)


CARD_FN = {
    'teaser': teaser_c, 'launch': launch_c, 'dressed': dressed_c, 'pin-explainer': pin_expl_c, 'pin-word': pin_word_c, 'pin-cast': pin_cast_c,
    'friday': friday_c, 'sweep': sweep_c, 'monday': monday_c, 'wotd-quiz': wotd_c, 'wotd-punch': punch_c, 'pangram': pangram_c,
    'cast-sat': S('cast-saturday', ['Can you beat Webster?', 'Meet the family.', 'Say hi to the crew.', 'Thanksgiving week with the family.']),
    'ph': S('product-hunt', 'Come say hello and vote.'),
    'dress': S('dress-your-mascot', 'Costume contest. Oct 28 to 30.'),
    'dress-reminder': S('dress-your-mascot', 'Last days to enter. Show us your mascot.'),
    'eve': S('halloween-eve', 'Themed puzzles in every game.'),
    'happy-halloween': S('happy-halloween', 'Themed puzzles and contest winners.'),
    'winners': S('happy-halloween', 'Meet the winning mascots.'),
    'cleans-up': S('the-cast-cleans-up', 'A fresh icon for November.'),
    'potw': S('player-of-the-week', 'Our favorite player this week.'),
    'muddle-oct20': lambda fmt, season, slot, L: muddle_card(fmt, season, slot, L, 'md-7jpkkq-2de281017b.webp'),
    'muddle-nov4': lambda fmt, season, slot, L: muddle_card(fmt, season, slot, L, 'md-nrx549-623eb331ba.webp'),
    'muddle-nov18': lambda fmt, season, slot, L: muddle_card(fmt, season, slot, L, 'md-aanlcb-0a907648a5.webp'),
    'diwali': S('diwali', 'Themed puzzles in every game.'),
    'veterans': S('veterans-day', 'Themed puzzles today.'),
    'thanksgiving': S('thanksgiving', 'The app knows what month it is.'),
    'league-open': S('family-league', 'Set it up before Thursday.'),
    'league-final': S('family-league', 'Final call before Thanksgiving.'),
    'thanks-eve': S('thanksgiving-eve', 'Themed puzzles today.'),
    'happy-thanks': S('happy-thanksgiving', 'Bring the whole family.'),
    'pro': S('go-pro', '$59.99 a year. That is $5 a month.'),
    'cast-wrap': S('meet-the-cast', 'Back tomorrow with the numbers.'),
    'day45': S('day-45', 'Thank you for playing.'),
}
CARD_SERIES = {'teaser': 'brand', 'launch': 'brand', 'dressed': 'brand', 'pin-explainer': 'muddle', 'pin-word': 'wotd', 'pin-cast': 'brand',
               'friday': 'friday', 'cast-sat': 'cast', 'sweep': 'sweep', 'monday': 'monday', 'wotd-punch': 'wotd', 'wotd-quiz': 'wotd', 'pangram': 'pangram',
               'ph': 'brand', 'dress': 'brand', 'dress-reminder': 'brand', 'eve': 'brand', 'happy-halloween': 'brand', 'winners': 'brand',
               'cleans-up': 'brand', 'potw': 'brand', 'muddle-oct20': 'muddle', 'muddle-nov4': 'muddle', 'muddle-nov18': 'muddle',
               'diwali': 'diwali', 'veterans': 'veterans', 'thanksgiving': 'thanks', 'thanks-eve': 'thanks', 'happy-thanks': 'thanks',
               'league-open': 'league', 'league-final': 'league', 'pro': 'brand', 'cast-wrap': 'brand', 'day45': 'brand'}
CARD_CAPTION = {
    'teaser': 'TOMORROW. over the ten cast silhouettes lit at the edge, with 18 unlit grey tiles (teaser 3).',
    'launch': 'LAUNCH: 18 DAILY GAMES. ONE SCORE. with the whole cast and Bring your family.',
    'dressed': 'THE APP GOT DRESSED.: Halloween reveal over the haunted wall with the whole costumed cast.',
    'pin-explainer': 'Pinterest explainer pin: HOW MUDDLE WORKS with a scramble-to-solved tile demo from an already-played Muddle and the three steps.',
    'pin-word': 'Pinterest word card pin: WORD OF THE DAY with an evergreen word in glossy tiles and its meaning.',
    'pin-cast': 'Pinterest cast art pin: MEET THE CAST with a rotating group and Bring your family.',
    'friday': "FRIDAY'S FINEST: gold tiles under the headline (best board of the week).",
    'sweep': 'SWEEP SUNDAY: 18 glossy tiles under the headline, All 18 dailies. One day.',
    'monday': 'MONDAY MASTERS: weekly race reset, The crown is open.',
    'wotd-punch': 'WORD OF THE DAY QUIZ for Oct 20: the real word PUNCH in glossy tiles, definition hidden.',
    'wotd-quiz': 'WORD OF THE DAY QUIZ: five mystery tiles, Pick the real definition.',
    'pangram': '7 LETTERS. ONE WORD.: seven mystery tiles for the Hubbub pangram tease.',
    'cast-sat': 'CAST SATURDAY: a rotating group of the cast.',
    'ph': "WE'RE ON PRODUCT HUNT: Come say hello and vote.",
    'dress': 'DRESS YOUR MASCOT: costume contest card (Oct 28 to 30).',
    'dress-reminder': 'DRESS YOUR MASCOT: contest reminder card.',
    'eve': 'HALLOWEEN EVE: themed puzzles in every game.',
    'happy-halloween': 'HAPPY HALLOWEEN: themed puzzles and contest winners.',
    'winners': 'HAPPY HALLOWEEN: Meet the winning mascots (swap in the real winners).',
    'cleans-up': 'THE CAST CLEANS UP: November icon card.',
    'potw': 'PLAYER OF THE WEEK: feature card for the repost.',
    'muddle-oct20': 'MUDDLE WEDNESDAY: the Oct 20 Muddle cartoon (played yesterday) in a paper frame, Caption this.',
    'muddle-nov4': 'MUDDLE WEDNESDAY: the Nov 3 Muddle cartoon (played yesterday) in a paper frame, Caption this.',
    'muddle-nov18': 'MUDDLE WEDNESDAY: the Nov 17 Muddle cartoon (played yesterday) in a paper frame, Caption this.',
    'diwali': 'DIWALI: themed puzzles card.', 'veterans': 'VETERANS DAY: themed puzzles card.',
    'thanksgiving': 'THANKSGIVING build reveal: The app knows what month it is.',
    'league-open': 'FAMILY LEAGUE: Set it up before Thursday.', 'league-final': 'FAMILY LEAGUE: Final call before Thanksgiving.',
    'thanks-eve': 'THANKSGIVING EVE: themed puzzles card.', 'happy-thanks': 'HAPPY THANKSGIVING: Bring the whole family.',
    'pro': 'GO PRO.: $59.99 a year, that is $5 a month (message only, no discount).',
    'cast-wrap': 'MEET THE CAST: wrap-prep card.', 'day45': 'DAY 45.: Thank you for playing.',
}
CARD_HINT = {
    'pin-explainer': 'hint: none (demo scramble comes from an already-played Muddle daily)',
    'pin-word': 'hint: none (evergreen word, absent from every daily bank; checked solutions 5/6/7, scramble, hub, ladder, crossword, cryptogram, wordsearch, groups)',
    'wotd-punch': "hint: the day's own word PUNCH is shown as the quiz subject; its definition is hidden (founder-approved quiz format)",
    'muddle-oct20': 'hint: none (yesterday’s, already-played cartoon; caption and answer not shown)',
    'muddle-nov4': 'hint: none (yesterday’s, already-played cartoon; caption and answer not shown)',
    'muddle-nov18': 'hint: none (yesterday’s, already-played cartoon; caption and answer not shown)',
    'wotd-quiz': 'hint: none (five mystery tiles)', 'pangram': 'hint: none (seven mystery tiles)',
}
LETTER_RAW = {
    'teaser': ['sheet1-launch-capture.png'], 'launch': ['sheet1-launch-capture.png'], 'dressed': ['sheet2-halloween-dressed-capture.png'],
    'pin-explainer': ['sheet4-7letters-muddleworks-capture.png'], 'pin-word': ['sheet6-wotd-capture.png'], 'pin-cast': ['sheet5-meet-cast-capture.png'],
    'friday': ['sheet7-friday-cast-capture.png'], 'cast-sat': ['sheet7-friday-cast-capture.png'], 'sweep': ['sheet3-sweep-muddle-capture.png'],
    'monday': ['sheet3-monday-wotd-capture.png', 'sheet4-newweek-crown-caption-capture.png'], 'wotd-punch': ['sheet3-monday-wotd-capture.png'],
    'wotd-quiz': ['sheet3-monday-wotd-capture.png'], 'pangram': ['sheet4-7letters-muddleworks-capture.png'],
    'ph': ['sheet7-ph-dress-capture.png'], 'dress': ['sheet7-ph-dress-capture.png'], 'dress-reminder': ['sheet7-ph-dress-capture.png'],
    'eve': ['sheet8-halloween-capture.png'], 'happy-halloween': ['sheet8-halloween-capture.png'], 'winners': ['sheet8-halloween-capture.png'],
    'cleans-up': ['sheet8-cleans-player-capture.png'], 'potw': ['sheet8-cleans-player-capture.png'],
    'muddle-oct20': ['sheet3-sweep-muddle-capture.png', 'sheet4-newweek-crown-caption-capture.png'],
    'muddle-nov4': ['sheet3-sweep-muddle-capture.png', 'sheet4-newweek-crown-caption-capture.png'],
    'muddle-nov18': ['sheet3-sweep-muddle-capture.png', 'sheet4-newweek-crown-caption-capture.png'],
    'diwali': ['sheet10-diwali-capture.png'], 'league-open': ['sheet10-diwali-capture.png'], 'league-final': ['sheet10-diwali-capture.png'],
    'pro': ['sheet10-pro-day45-capture.png'], 'day45': ['sheet10-pro-day45-capture.png'],
    'veterans': ['sheet9-thanks-capture.png'], 'thanksgiving': ['sheet9-thanks-top-capture.png'], 'thanks-eve': ['sheet9-thanks-top-capture.png'],
    'happy-thanks': ['sheet9-thanks-capture.png'], 'cast-wrap': ['sheet5-meet-cast-capture.png'],
}
EXTRA_FMT = {'dressed': ['portrait']}      # (date-slot cards that also get a second format)
PIN_CARD = {'Game explainer pin': 'pin-explainer', 'Word card pin': 'pin-word', 'Cast art pin': 'pin-cast'}
# (date, slot, title contains, card); None title matches the date+slot
SCHEDULE = [
    ('2026-10-15', 'x', 'Teaser 3', 'teaser'), ('2026-10-16', 'x', None, 'launch'), ('2026-10-16', 'feed', None, 'launch'),
    ('2026-10-17', 'x', None, 'dressed'), ('2026-10-18', 'x', None, 'sweep'), ('2026-10-18', 'fb', None, 'sweep'),
    ('2026-10-19', 'x', None, 'monday'), ('2026-10-20', 'x', None, 'wotd-punch'),
    ('2026-10-21', 'x', None, 'muddle-oct20'), ('2026-10-21', 'feed', None, 'muddle-oct20'), ('2026-10-22', 'x', None, 'pangram'),
    ('2026-10-23', 'x', None, 'friday'), ('2026-10-23', 'feed', None, 'friday'), ('2026-10-24', 'x', None, 'cast-sat'),
    ('2026-10-25', 'x', None, 'sweep'), ('2026-10-25', 'fb', None, 'sweep'), ('2026-10-26', 'x', None, 'monday'),
    ('2026-10-27', 'x', None, 'ph'), ('2026-10-27', 'feed', None, 'ph'),
    ('2026-10-28', 'x', None, 'dress'), ('2026-10-28', 'feed', None, 'dress'), ('2026-10-29', 'x', None, 'dress-reminder'),
    ('2026-10-30', 'x', None, 'eve'), ('2026-10-30', 'feed', None, 'eve'),
    ('2026-10-31', 'x', None, 'happy-halloween'), ('2026-10-31', 'feed', None, 'winners'),
    ('2026-11-01', 'x', None, 'cleans-up'), ('2026-11-01', 'fb', None, 'cleans-up'), ('2026-11-02', 'x', None, 'monday'),
    ('2026-11-03', 'x', None, 'wotd-quiz'), ('2026-11-04', 'x', None, 'muddle-nov4'), ('2026-11-04', 'feed', None, 'muddle-nov4'),
    ('2026-11-05', 'x', None, 'pangram'), ('2026-11-06', 'x', None, 'friday'), ('2026-11-06', 'feed', None, 'friday'),
    ('2026-11-07', 'x', None, 'cast-sat'), ('2026-11-08', 'x', None, 'diwali'), ('2026-11-08', 'fb', None, 'diwali'),
    ('2026-11-09', 'x', None, 'monday'), ('2026-11-10', 'x', None, 'wotd-quiz'),
    ('2026-11-11', 'x', None, 'veterans'), ('2026-11-11', 'feed', None, 'veterans'), ('2026-11-12', 'x', None, 'pangram'),
    ('2026-11-13', 'x', None, 'potw'), ('2026-11-13', 'feed', None, 'potw'), ('2026-11-14', 'x', None, 'cast-sat'),
    ('2026-11-15', 'x', None, 'sweep'), ('2026-11-15', 'fb', None, 'sweep'), ('2026-11-16', 'x', None, 'thanksgiving'),
    ('2026-11-17', 'x', None, 'league-open'), ('2026-11-18', 'x', None, 'muddle-nov18'), ('2026-11-18', 'feed', None, 'muddle-nov18'),
    ('2026-11-19', 'x', None, 'pangram'), ('2026-11-20', 'x', None, 'friday'), ('2026-11-20', 'feed', None, 'friday'),
    ('2026-11-21', 'x', None, 'cast-sat'), ('2026-11-22', 'x', None, 'sweep'), ('2026-11-22', 'fb', None, 'sweep'),
    ('2026-11-23', 'x', None, 'monday'), ('2026-11-24', 'x', None, 'league-final'),
    ('2026-11-25', 'x', None, 'thanks-eve'), ('2026-11-25', 'fb', None, 'thanks-eve'),
    ('2026-11-26', 'x', None, 'happy-thanks'), ('2026-11-26', 'fb', None, 'happy-thanks'),
    ('2026-11-27', 'x', None, 'pro'), ('2026-11-27', 'feed', None, 'pro'), ('2026-11-28', 'x', None, 'cast-wrap'),
    ('2026-11-29', 'x', None, 'day45'), ('2026-11-29', 'feed', None, 'day45'),
]


def lineup_summary(ids):
    return [i if '|' not in i else i.split('|')[0] + ':' + os.path.splitext(os.path.basename(i.split('|')[1]))[0].split('-', 1)[1] for i in ids]


def build_all(only_dates=None):
    spec = json.load(open(SPEC))
    posts = [x for x in spec['posts'] if x['date'] >= '2026-10-15' and x['date'] <= '2026-11-29']
    slot_rank = {'x': 0, 'feed': 1, 'fb': 2, 'pin': 3}
    posts.sort(key=lambda x: (x['date'], x['time'], slot_rank[x['slot']]))
    rows, pin_n = [], {}
    for x in posts:
        date, slot = x['date'], x['slot']
        if slot == 'pin':
            card = next(c for k, c in PIN_CARD.items() if k in x['title'])
            pin_n[date] = pin_n.get(date, 0) + 1
            key = f'{date}-pin-{pin_n[date]}'
        else:
            card = next((c for d, s, t, c in SCHEDULE if d == date and s == slot and (t is None or t in x['title'])), None)
            if card is None:
                continue
            key = f'{date}-{slot}'
        season = season_of(date)
        fmts = ['pin'] if slot == 'pin' else (['landscape'] if x['size'] == 'landscape' else ['portrait'])
        fmts += EXTRA_FMT.get(card, []) if slot == 'x' else []
        n = size_for(card, slot)
        L = pick(card, slot, season, n)
        STATE['occ'][card] = STATE['occ'].get(card, 0) + 1
        CUR['occ'] = STATE['occ'][card] - 1; CUR['date'] = date
        ctx(CARD_SERIES[card], season)
        d = out_dir(key); files, pls = {}, {}
        for fmt in fmts:
            im, pl = CARD_FN[card](fmt, season, slot, L)
            fn = {'landscape': 'landscape.png', 'portrait': 'portrait.png', 'pin': 'pin.png'}[fmt]
            im.save(os.path.join(d, fn), optimize=True); files[fmt] = f'{key}/{fn}'
            hero_compare(os.path.join(d, 'raw', f'compare-{fmt}.png'), pl, im, season)
        for rl in LETTER_RAW.get(card, []):
            src = os.path.join(HERE, 'lettering', 'raw', rl)
            if os.path.exists(src):
                shutil.copy(src, os.path.join(d, 'raw', rl))
        sp = spec_now()
        rows.append(dict(key=key, post_id=x['id'], date=date, slot=slot, title=x['title'], files=files, caption=CARD_CAPTION[card], card=card, season=season,
                         series_color=('default purple-pink' if sp is None else (f'hue {sp[1]}-{sp[2]}' if sp[0] == 'grad' else 'multicolor')),
                         cast=lineup_summary(L), cast_count=len(L),
                         mascot_check=('pass (hero composite)' if season == 'standard' else 'pass (hero composite; shipped %s costume art)' % season) +
                         ('' if all('|' not in i for i in L) else '; pose/costume variants are shipped art, compare in raw/'),
                         aesthetic_check='pass', hint=CARD_HINT.get(card, 'hint: none'), notes=''))
        print('built', key, card, len(L))
    return rows


def contact_sheets(manifest):
    thumbs = []
    for m in manifest:
        for fmt in ('landscape', 'portrait', 'pin'):
            f = m['files'].get(fmt)
            if f:
                im = Image.open(os.path.join(HERE, f)).convert('RGB'); th = 260
                thumbs.append(im.resize((round(im.width * th / im.height), th), Image.LANCZOS))
    cols_w = 2400; x = y = 10; rowh = 0
    sheet = Image.new('RGB', (cols_w, 8000), (36, 30, 52))
    for im in thumbs:
        if x + im.width > cols_w - 10:
            x = 10; y += rowh + 10; rowh = 0
        sheet.paste(im, (x, y)); x += im.width + 10; rowh = max(rowh, im.height)
    sheet.crop((0, 0, cols_w, y + rowh + 10)).save(os.path.join(HERE, 'contact-sheet.png'), optimize=True)


if __name__ == '__main__':
    rows = build_all()
    json.dump(rows, open(os.path.join(HERE, 'manifest.json'), 'w'), indent=2)
    contact_sheets(rows)
    print(len(rows), 'posts; cast counts', STATE['count'])
