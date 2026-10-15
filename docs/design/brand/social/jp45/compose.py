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
    'landscape': dict(W=1600, H=900, wm_top=34, wm_w=320, head_y=(108, 380), head_w=980, sub_y=(394, 470), sub_size=50,
                      content_top=486, base=824, foot_y=868, foot_size=26, tile=64),
    'portrait': dict(W=1080, H=1350, wm_top=52, wm_w=400, head_y=(166, 556), head_w=900, sub_y=(580, 680), sub_size=58,
                     content_top=702, base=1262, foot_y=1310, foot_size=30, tile=104),
    'pin': dict(W=1000, H=1500, wm_top=60, wm_w=400, head_y=(188, 650), head_w=860, sub_y=(676, 776), sub_size=58,
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
    drop_shadow(layer, wmi, (W - wmw) / 2, L['wm_top'], dark=(40, 10, 80) if season == 'halloween' else (80, 30, 120), a=80)
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
    if cast:
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


def post(key, date, slot, title_match, caption, mascot, aesthetic, raw, season='standard', notes=''):
    def deco(fn):
        POSTS[key] = dict(fn=fn, date=date, slot=slot, title_match=title_match, caption=caption, mascot=mascot,
                          aesthetic=aesthetic, raw=raw, season=season, notes=notes)
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
                         files=files, caption=p['caption'], mascot_check=p['mascot'], aesthetic_check=p['aesthetic'], notes=p['notes'])
        print('built', key, list(files))
    manifest = sorted(byid.values(), key=lambda m: (m['date'], m['slot'], m['key']))
    json.dump(manifest, open(mpath, 'w'), indent=2)
