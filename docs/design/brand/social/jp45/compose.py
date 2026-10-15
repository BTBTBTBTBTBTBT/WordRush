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

_c = {}


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())


def lettering(name):
    if name not in _c:
        _c[name] = Image.open(os.path.join(HERE, 'lettering', name + '.png')).convert('RGBA')
    return _c[name]


def hero(cid, season):
    k = (cid, season)
    if k not in _c:
        folder = os.path.join(BRAND, 'seasons', 'halloween', 'cast') if season == 'halloween' else os.path.join(BRAND, 'cast', 'hero')
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
    if season == 'halloween':
        wall = Image.open(os.path.join(BRAND, 'seasons', 'halloween', 'walls', 'wall-home-wide.webp')).convert('RGBA')
        box = {'landscape': (0, 75, 2400, 1425), 'portrait': (1200, 0, 2400, 1500), 'pin': (1400, 0, 2400, 1500)}[fmt]
        c = wall.crop(box).resize((W, H), Image.LANCZOS)
        glow = Image.new('L', (W, H), 0)
        ImageDraw.Draw(glow).ellipse((W * 0.12, L['head_y'][0] - 60, W * 0.88, L['head_y'][1] + 120), fill=120)
        c.paste(Image.new('RGBA', (W, H), (110, 50, 170, 255)), (0, 0), glow.filter(ImageFilter.GaussianBlur(W * 0.06)))
        cols = ['#F0782C', '#8B2CF5', '#FF9F1A', '#9B3DF3']
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
    parts = [lettering(n) for n in names]
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
    drop_shadow(layer, hl, hx, hy, dark=(20, 5, 50) if season == 'halloween' else (80, 30, 120), a=110)
    layer.alpha_composite(hl, (hx, hy))
    bottom = hy + hl.height
    # sub line
    if sub:
        s0, s1 = L['sub_y']
        if sub[0] == 'lettering':
            si = fit(lettering(sub[1]), W * 0.74, s1 - s0, cap=1.3)
            sx, sy = (W - si.width) // 2, s0 + (s1 - s0 - si.height) // 2
            drop_shadow(layer, si, sx, sy, dark=(20, 5, 50) if season == 'halloween' else (110, 50, 20), a=100)
            layer.alpha_composite(si, (sx, sy))
            bottom = sy + si.height
        else:
            sz = L['sub_size']
            text(layer, sub[1], W / 2, (s0 + s1) / 2, sz, fill=(255, 255, 255), stroke=STROKE, sw=max(3, sz // 9))
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
    col = (236, 224, 255) if season == 'halloween' else PURPLE_DEEP
    text(layer, foot, W / 2, L['foot_y'], L['foot_size'], fill=col, weight='ExtraBold', shadow=season == 'halloween')
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
        ref = hero(cid, season)
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


POSTS = {}


def post(key, date, slot, title_match, caption, mascot, aesthetic, raw, season='standard', notes='', hint='hint: none'):
    def deco(fn):
        POSTS[key] = dict(fn=fn, date=date, slot=slot, title_match=title_match, caption=caption, mascot=mascot,
                          aesthetic=aesthetic, raw=raw, season=season, notes=notes, hint=hint)
        return fn
    return deco


FULL = CAST


@post('2026-10-15-x', '2026-10-15', 'x', 'X: Teaser 3',
      'TOMORROW. in house lettering over the ten cast silhouettes lit at the edge, with 18 unlit grey tiles above them (teaser 3).',
      'pass (hero composite; silhouettes cut from the real hero alpha)', 'pass', ['sheet1-launch-capture.png'])
def p_teaser():
    imgs, pl = {}, {}
    tiles = tiles_grid([[''] * 9, [''] * 9], LAYOUT['landscape']['tile'], ['#8E96A8'])
    imgs['landscape'], pl['landscape'] = build('landscape', 'standard', 'x', 'tomorrow', content=tiles, cast=FULL, cast_mode='silhouette')
    return imgs, pl


@post('2026-10-16-x', '2026-10-16', 'x', 'X: Launch thread (family origin story)',
      'Launch day: 18 DAILY GAMES. ONE SCORE. with the whole cast and Bring your family. (landscape for X).',
      'pass (hero composite)', 'pass', ['sheet1-launch-capture.png'])
def p_launch_x():
    imgs, pl = {}, {}
    imgs['landscape'], pl['landscape'] = build('landscape', 'standard', 'x', ['daily-games', 'one-score'], sub=('lettering', 'bring-your-family-b'), cast=FULL)
    return imgs, pl


@post('2026-10-16-feed', '2026-10-16', 'feed', 'Feed: trailer + carousel slide 1',
      'Launch day feed card: 18 DAILY GAMES. ONE SCORE. with the whole cast and Bring your family. (portrait for IG and Facebook).',
      'pass (hero composite)', 'pass', ['sheet1-launch-capture.png'])
def p_launch_feed():
    imgs, pl = {}, {}
    imgs['portrait'], pl['portrait'] = build('portrait', 'standard', 'feed', ['daily-games', 'one-score'], sub=('lettering', 'bring-your-family-b'), cast=FULL)
    return imgs, pl


PALETTE = ['#8B2CF5', '#F5A623', '#8E96A8']      # purple / gold / grey tile family


def text_img(s, size, fill=(255, 255, 255), stroke=STROKE, weight='Black', pad=None):
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


def steps_card(tile, lines):
    scr = tiles_row(list('GCRERO'), tile, PALETTE[:2], gap=0.1)
    arrow = arrow_img(round(tile * 0.9))
    sol = tiles_row(list('GROCER'), tile, ['#F5A623'], gap=0.1)
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


H_CAST = 'pass (hero composite; shipped Halloween costume art)'
HAL_ALL = 'halloween'


@post('2026-10-15-pin-1', '2026-10-15', 'pin', 'Game explainer pin',
      'Pinterest explainer pin: HOW MUDDLE WORKS with a scramble-to-solved tile demo (GCRERO to GROCER, from the already-played Oct 13 Muddle) and the three steps.',
      'pass (hero composite)', 'pass', ['sheet4-7letters-muddleworks-capture.png'],
      hint='hint: none (demo word GROCER comes from the already-played Oct 13 Muddle; bank checked)')
def p_pin_explainer():
    t = LAYOUT['pin']['tile']
    c = steps_card(round(t * 0.6), ['Unscramble four words', 'Ringed letters spell the punchline', 'Finish the cartoon caption'])
    im, pl = build('pin', 'standard', 'pin', 'how-muddle-works', sub=('text', 'A new cartoon puzzle every day.'), content=c, cast=['o3', 'd'])
    return {'pin': im}, {'pin': pl}


@post('2026-10-15-pin-2', '2026-10-15', 'pin', 'Word card pin',
      'Pinterest word card pin: WORD OF THE DAY with JUBILANT in glossy tiles and its meaning (an evergreen word checked against every daily bank: not an answer anywhere).',
      'pass (hero composite)', 'pass', ['sheet6-wotd-capture.png'],
      hint='hint: none (JUBILANT is in no daily bank: checked solutions 5/6/7, scramble, hub, ladder, crossword, cryptogram, wordsearch, groups)')
def p_pin_word():
    c = wotd_card('JUBILANT', 80, definition='Feeling or showing great happiness and triumph.', pos='adjective')
    im, pl = build('pin', 'standard', 'pin', 'word-of-the-day', sub=('text', 'Learn one new word a day.'), content=c, cast=['c', 'd'])
    return {'pin': im}, {'pin': pl}


@post('2026-10-15-pin-3', '2026-10-15', 'pin', 'Cast art pin',
      'Pinterest cast art pin: MEET THE CAST with all ten heroes and Bring your family.',
      'pass (hero composite)', 'pass', ['sheet5-meet-cast-capture.png'])
def p_pin_cast():
    im, pl = build('pin', 'standard', 'pin', 'meet-the-cast', sub=('lettering', 'bring-your-family-b'), cast=FULL, head_cap=0.95)
    return {'pin': im}, {'pin': pl}


@post('2026-10-17-x', '2026-10-17', 'x', 'X: "The app got dressed."',
      'Halloween reveal: THE APP GOT DRESSED. over the Halloween wall with the whole costumed cast (landscape for X, portrait alongside).',
      H_CAST, 'pass', ['sheet2-halloween-dressed-capture.png'], season='halloween')
def p_halloween():
    imgs, pl = {}, {}
    for fmt in ('landscape', 'portrait'):
        imgs[fmt], pl[fmt] = build(fmt, 'halloween', 'x', 'app-got-dressed', sub=('text', 'Halloween is live through Oct 31.'), cast=FULL)
    return imgs, pl


def sweep(fmt, slot):
    t = LAYOUT[fmt]['tile']
    if fmt == 'landscape':
        tiles = tiles_row([str(i) for i in range(1, 19)], round(t * 1.12), PALETTE, gap=0.1)
        cast = ['w', 's', 'd']
    else:
        tiles = tiles_grid([[str(i) for i in range(r * 6 + 1, r * 6 + 7)] for r in range(3)], round(t * 0.84), PALETTE, gap=0.1)
        cast = ['s', 'w']
    return build(fmt, 'halloween', slot, 'sweep-sunday', sub=('text', 'All 18 dailies. One day.'), content=tiles, cast=cast)


@post('2026-10-18-x', '2026-10-18', 'x', 'X: Sweep board + challenge',
      'SWEEP SUNDAY: 18 numbered glossy tiles (the sweep board idea) under the headline with the leader and the speedster.',
      H_CAST, 'pass', ['sheet3-sweep-muddle-capture.png'], season='halloween')
def p_sweep_x():
    im, pl = sweep('landscape', 'x')
    return {'landscape': im}, {'landscape': pl}


@post('2026-10-18-fb', '2026-10-18', 'fb', 'Facebook: Sweep post',
      'SWEEP SUNDAY (portrait for Facebook): 18 numbered glossy tiles under the headline with the speedster and the leader.',
      H_CAST, 'pass', ['sheet3-sweep-muddle-capture.png'], season='halloween')
def p_sweep_fb():
    im, pl = sweep('portrait', 'fb')
    return {'portrait': im}, {'portrait': pl}


@post('2026-10-19-x', '2026-10-19', 'x', 'X: Race-reset post + last week champion',
      'MONDAY MASTERS: New week. Zero points. The crown is open. with the leader, the brain and the speedster.',
      H_CAST, 'pass', ['sheet3-monday-wotd-capture.png', 'sheet4-newweek-crown-caption-capture.png'], season='halloween')
def p_monday():
    t = text_img('New week. Zero points.', LAYOUT['landscape']['sub_size'])
    im, pl = build('landscape', 'halloween', 'x', 'monday-masters', sub=('lettering', 'the-crown-is-open'), content=t, cast=['w', 'd', 's'])
    return {'landscape': im}, {'landscape': pl}


@post('2026-10-20-x', '2026-10-20', 'x', 'X: WOTD quiz debut',
      'WORD OF THE DAY QUIZ card for Oct 20: the day\'s real word PUNCH in glossy tiles on a soft card, definition hidden for the quiz.',
      H_CAST, 'pass', ['sheet3-monday-wotd-capture.png'], season='halloween',
      notes='Word = PUNCH (Oct 20 Word of the Day, computed by the Studio-post agent). Template: wotd_card(WORD, tile_px) in compose.py renders any other day.',
      hint='hint: the day\'s own word PUNCH is shown as the quiz subject; its definition is hidden (founder-approved quiz format)')
def p_wotd():
    c = wotd_card('PUNCH', 90, note='Pick the real definition.')
    im, pl = build('landscape', 'halloween', 'x', 'word-of-the-day-quiz', sub=None, content=c, cast=['d', 'c'])
    return {'landscape': im}, {'landscape': pl}


def muddle(fmt, slot):
    cart = os.path.join(REPO, 'apps', 'web', 'public', 'muddle', 'md-7jpkkq-2de281017b.webp')
    w = 400 if fmt == 'landscape' else 560
    fr = cartoon_frame(cart, w)
    return build(fmt, 'halloween', slot, 'muddle-wednesday', sub=('lettering', 'caption-this'), content=fr, cast=['o3', 'd'], cast_mode='sides')


@post('2026-10-21-x', '2026-10-21', 'x', 'X: Yesterday',
      'MUDDLE WEDNESDAY: the Oct 20 Muddle cartoon in a paper frame with Caption this. and the prankster and the brain at the sides.',
      H_CAST, 'pass', ['sheet3-sweep-muddle-capture.png', 'sheet4-newweek-crown-caption-capture.png'], season='halloween',
      notes='Cartoon = daily Muddle of 2026-10-20 (md-7jpkkq), shown only on Oct 21 when it is yesterday. Caption text not shown, so no answer on the image.',
      hint='hint: none (Oct 20 Muddle cartoon, already played by Oct 21; caption and answer not shown)')
def p_muddle_x():
    im, pl = muddle('landscape', 'x')
    return {'landscape': im}, {'landscape': pl}


@post('2026-10-21-feed', '2026-10-21', 'feed', 'Feed: cartoon + reveal thread',
      'MUDDLE WEDNESDAY (portrait for IG and Facebook): the Oct 20 Muddle cartoon in a paper frame with Caption this.',
      H_CAST, 'pass', ['sheet3-sweep-muddle-capture.png', 'sheet4-newweek-crown-caption-capture.png'], season='halloween',
      notes='Same cartoon note as the X post.',
      hint='hint: none (Oct 20 Muddle cartoon, already played by Oct 21; caption and answer not shown)')
def p_muddle_feed():
    im, pl = muddle('portrait', 'feed')
    return {'portrait': im}, {'portrait': pl}


@post('2026-10-22-x', '2026-10-22', 'x', 'X: WOTD quiz + pangram tease',
      'Hubbub pangram tease: 7 LETTERS. ONE WORD. with seven mystery tiles and the explorer, the sprout and the speedster.',
      H_CAST, 'pass', ['sheet4-7letters-muddleworks-capture.png'], season='halloween')
def p_pangram():
    t = LAYOUT['landscape']['tile']
    tiles = tiles_row(['?'] * 7, round(t * 1.2), PALETTE, gap=0.12)
    im, pl = build('landscape', 'halloween', 'x', '7-letters-one-word', sub=('text', 'Today’s letters hide a seven-letter word.'), content=tiles, cast=['c', 'i', 's'])
    return {'landscape': im}, {'landscape': pl}


if __name__ == '__main__':
    only = sys.argv[1:]
    spec = json.load(open(SPEC))
    mpath = os.path.join(HERE, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else []
    byid = {m['key']: m for m in manifest}
    for key, p in POSTS.items():
        if only and key not in only:
            continue
        imgs, pl = p['fn']()
        files = finish(key, imgs, pl, p['season'], p['raw'])
        cands = [x for x in spec['posts'] if x['date'] == p['date'] and x['slot'] == p['slot'] and p['title_match'] in x['title']]
        pid = cands[0]['id'] if cands else None
        byid[key] = dict(key=key, post_id=pid, date=p['date'], slot=p['slot'], title=cands[0]['title'] if cands else p['title_match'],
                         files=files, caption=p['caption'], mascot_check=p['mascot'], aesthetic_check=p['aesthetic'], hint=p['hint'], notes=p['notes'])
        print('built', key, list(files))
    manifest = sorted(byid.values(), key=lambda m: (m['date'], m['slot'], m['key']))
    json.dump(manifest, open(mpath, 'w'), indent=2)
    # contact sheet of every final, side by side (one-family check)
    thumbs = []
    for m in manifest:
        for fmt in ('landscape', 'portrait', 'pin'):
            f = m['files'].get(fmt)
            if f:
                im = Image.open(os.path.join(HERE, f)).convert('RGB')
                th = 300
                thumbs.append((m['date'], im.resize((round(im.width * th / im.height), th), Image.LANCZOS)))
    cols_w = 1900; x = y = 10; rowh = 0
    sheet = Image.new('RGB', (cols_w, 4000), (36, 30, 52))
    for d, im in thumbs:
        if x + im.width > cols_w - 10:
            x = 10; y += rowh + 10; rowh = 0
        sheet.paste(im, (x, y)); x += im.width + 10; rowh = max(rowh, im.height)
    sheet.crop((0, 0, cols_w, y + rowh + 10)).save(os.path.join(HERE, 'contact-sheet.png'), optimize=True)
