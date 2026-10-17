# Whole-scene pipeline (founder 10-14): ChatGPT draws the scene (background + lettering + 1-3 mascots);
# this script frames it to the post size and overlays the REAL wordmark (top band) and the footer
# (bottom band) so those stay exact.
#
#   python3 scene.py compare <id> <cast ids...>        crop-free side-by-side prep sheet of the candidate vs hero art
#   python3 scene.py accept  <id> [season] [slot]      write the final for incoming/full/<id>.png into <date>-<slot>/
#   python3 scene.py reject  <id> "<why>"              delete the candidate and log it in manifest.json
import json, os, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import compose as C      # noqa: E402  (importing compose runs nothing; its main is guarded)
from compose import LAYOUT, Image as _I, ImageFilter as _F  # noqa: E402,F401

FULL = os.path.join(HERE, 'incoming', 'full')
FMT_OF = {'landscape': (1600, 900), 'portrait': (1080, 1350), 'pin': (1000, 1500)}
MAX_UP = 1.12
PAD_MODE = os.environ.get('SCENE_PAD', 'reflect')    # 'edge' gave hard color streaks; reflect + heavy blur stays the default


def frame(im, fmt):
    """Center-crop to the target aspect, then resize; refuses to upscale more than ~1.1x."""
    W, H = FMT_OF[fmt]
    ar = W / H
    w, h = im.size
    if w / h > ar:
        nw = round(h * ar); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = round(w / ar); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    up = W / im.width
    if up > MAX_UP:
        print(f'WARNING: needs {up:.2f}x upscale (> {MAX_UP}); scene is too small for {fmt}')
    return im.resize((W, H), Image.LANCZOS)


def recolor_headline(im, season, series, y0, y1, nl=None, x0=None, x1=None, dil=14, smin=0.4, ex=None, hmax=345):
    """Hue-shift the purple-pink headline lettering of a scene (rows y0..y1 of the native scene) to the series color for this season.
    Only bright saturated purple/pink pixels (plus a thin rim halo) inside the band are touched, never mascots or the sub line."""
    import numpy as np
    from scipy import ndimage
    sp = C.SERIES_COLORS.get(season, C.SERIES_COLORS['standard']).get(series)
    if sp is None:
        return im
    hsv = np.asarray(im.convert('HSV')).astype(np.float32)
    H = hsv[..., 0] * 360 / 255; S = hsv[..., 1] / 255; V = hsv[..., 2] / 255
    band = np.zeros(H.shape, bool); band[y0:y1, (x0 or 0):(x1 or H.shape[1])] = True
    for r in (ex or []):                      # exclusion rects (x0,y0,x1,y1) in native scene px: same-hue props beside the headline (purple floating tiles)
        band[r[1]:r[3], r[0]:r[2]] = False
    letters = band & (H > 255) & (H < hmax) & (S > smin) & (V > 0.62)   # hmax 358: deep-pink letter bottoms
    letters = ndimage.binary_closing(letters, iterations=3)
    area = ndimage.binary_dilation(letters, iterations=dil) & band & (H > 240) & (H < max(350, hmax + 2)) & (S > 0.3)
    t = np.clip((H - 272) / 53, 0, 1)
    if sp[0] == 'multi':
        # letters touch in bubble lettering, so no per-letter labeling: hues sweep left to right across the headline
        # (smooth through the hue list; nl = number of letters -> stepped bands instead of a smooth sweep)
        cols = np.where(letters.any(axis=0))[0]
        x0, x1 = cols.min(), cols.max()
        u = np.clip((np.arange(H.shape[1]) - x0) / max(1, x1 - x0), 0, 1)
        hl = list(sp[1]); k = len(hl) - 1
        if nl:
            u = (np.floor(u * nl).clip(0, nl - 1) + 0.5) / nl
            pos = u * len(hl)
            hrow = np.array([hl[int(p) % len(hl)] for p in pos], np.float32)
        else:
            pos = u * k
            i0 = np.minimum(pos.astype(int), k - 1) if k else np.zeros_like(pos, int)
            f = pos - i0
            hrow = np.array([hl[i] + (hl[min(i + 1, k)] - hl[i]) * ff for i, ff in zip(i0, f)], np.float32)
        nh = hrow[None, :] + (t - 0.5) * 10
        sm = vm = 1
        area = ndimage.binary_dilation(letters, iterations=7) & band & (H > 240) & (H < 350) & (S > 0.3)
    else:
        _, top, bot, sm, vm = sp if sp[0] == 'grad' else ('grad', sp[1][0], sp[1][0], 1, 1)
        nh = top + (bot - top) * t
    nS = np.clip(S * sm, 0, 1); nV = np.clip(V * vm, 0, 1)
    out = np.dstack([(nh % 360) * 255 / 360, nS * 255, nV * 255]).astype(np.uint8)
    rgb = np.asarray(Image.fromarray(out, 'HSV').convert('RGB')).astype(np.float32)
    base = np.asarray(im.convert('RGB')).astype(np.float32)
    w = ndimage.gaussian_filter(area.astype(np.float32), 1.2)[..., None]
    return Image.fromarray((rgb * w + base * (1 - w)).clip(0, 255).astype(np.uint8))


def fit_scene(im, fmt, scale, top):
    """Place the whole scene at `scale` (native pixel multiplier) with its top at `top` px; the margin around it is the scene's
    own edge reflected and blurred (continues trees, bokeh and floor), with a wide feather so no seam shows.
    Used when the scene has no calm top band for the wordmark."""
    import numpy as np
    W, H = FMT_OF[fmt]
    s = float(scale)
    sc = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x0 = (W - sc.width) // 2
    a = np.asarray(sc)
    pl, pr, pt = max(x0, 0), max(W - sc.width - x0, 0), max(top, 0)
    pb = max(H - top - sc.height, 0)
    big = np.pad(a, ((pt, pb), (pl, pr), (0, 0)), mode=PAD_MODE)
    canvas = Image.fromarray(big)
    blur = canvas.filter(ImageFilter.GaussianBlur(28))
    # crop to the canvas (scene may overhang the bottom)
    oy = pt - top if top < 0 else 0
    canvas = canvas.crop((0, 0, W, H)); blur = blur.crop((0, 0, W, H))
    f = 110
    xs_ = np.minimum(np.arange(W) - x0, W - (x0 + sc.width) - (np.arange(W) - W + 1) * 0 - 1 + (x0 + sc.width) - np.arange(W)) if False else None
    xx = np.arange(W); yy = np.arange(H)
    dx = np.minimum(xx - x0, x0 + sc.width - 1 - xx)           # distance inside the scene from its left/right edge (negative outside)
    dy = np.minimum(yy - top, 10 ** 6) if top > 0 else np.full(H, 10 ** 6)
    inside = np.clip(np.minimum(dx[None, :], dy[:, None]) / f, 0, 1)       # 0 at/after the scene edge .. 1 deep inside
    out = np.asarray(blur).astype(np.float32) * (1 - inside[..., None]) + np.asarray(canvas).astype(np.float32) * inside[..., None]
    # sharp scene in the interior
    res = Image.fromarray(out.clip(0, 255).astype(np.uint8))
    return res


def add_content(im, fmt, spec, at, season, series):
    """Overlay the post's content block in code on a scene's empty center. spec: 'wotd|WORD|note' | 'mystery|7' | 'cartoon|file.webp|width_px'.
    at = 'cx,cy' as fractions of the post. Uses compose.ctx so tile colors follow the series/season."""
    C.ctx(series or 'default', season)
    kind, *a = spec.split('|')
    L = LAYOUT[fmt]
    if kind == 'wotd':
        blk = C.wotd_card(a[0], int(L['tile'] * (float(a[2]) if len(a) > 2 else 1.4)), note=a[1] if len(a) > 1 else None)   # optional 3rd arg = card scale (default 1.4)
    elif kind == 'mystery':
        blk = C.tiles_row(['?'] * int(a[0]), round(L['tile'] * 1.2), C.pal_rot(0), gap=0.12)
    elif kind == 'cartoon':
        blk = C.cartoon_frame(os.path.join(C.REPO, 'apps', 'web', 'public', 'muddle', a[0]), int(a[1]))
    else:
        raise SystemExit('unknown content ' + kind)
    cx, cy = (float(v) for v in at.split(','))
    W, H = im.size
    base = im.convert('RGBA')
    x, y = round(cx * W - blk.width / 2), round(cy * H - blk.height / 2)
    if kind != 'wotd':
        C.drop_shadow(base, blk, x, y, dark=(30, 10, 60), a=140, blur=0.04, dy=0.04)
    base.alpha_composite(blk, (x, y))
    return base.convert('RGB')


def fill_scene(im, fmt, top):
    """Scale the scene to the full post width (no margins) and crop to the post height, scene top at `top` px (negative = crop it off)."""
    W, H = FMT_OF[fmt]
    s = W / im.width
    if s > MAX_UP:
        print(f'WARNING: needs {s:.2f}x upscale (> {MAX_UP})')
    sc = im.resize((W, round(im.height * s)), Image.LANCZOS)
    canvas = Image.new('RGB', (W, H))
    canvas.paste(sc, (0, int(top)))
    return canvas


def overlay(im, fmt, slot, season):
    """Real wordmark in the top band + footer (handle . wordocious.com) in the bottom band."""
    L = LAYOUT[fmt]
    W, H = im.size
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    wm = C.wordmark(); wmw = L['wm_w']; wmh = round(wmw * wm.height / wm.width)
    wmi = wm.resize((wmw, wmh), Image.LANCZOS)
    hm = Image.new('L', im.size, 0)
    hm.paste(wmi.getchannel('A').filter(ImageFilter.MaxFilter(13)), ((W - wmw) // 2, L['wm_top']))
    layer.paste(Image.new('RGBA', im.size, (255, 244, 255, 255)), (0, 0), hm.filter(ImageFilter.GaussianBlur(wmh * 0.22)).point(lambda v: min(255, int(v * 0.9))))
    C.drop_shadow(layer, wmi, (W - wmw) / 2, L['wm_top'], dark=(40, 10, 80), a=150, blur=0.05, dy=0.08)
    layer.alpha_composite(wmi, ((W - wmw) // 2, L['wm_top']))
    hslot = 'feed' if (fmt == 'portrait' and slot == 'x') else slot
    foot = ' · '.join(v for v in (C.HANDLE[hslot], 'wordocious.com') if v)
    dark = season in C.DARK
    if not dark:        # a dark scene on a light-season day (Dia de los Muertos night, Veterans night sky): light footer text
        import numpy as np
        band = np.asarray(im.convert('L').crop((W // 4, L['foot_y'] - 24, 3 * W // 4, L['foot_y'] + 24)), dtype=np.float32)
        dark = float(band.mean()) < 120
    C.text(layer, foot, W / 2, L['foot_y'], L['foot_size'], fill=(236, 224, 255) if dark else C.PURPLE_DEEP, weight='ExtraBold', shadow=dark)
    base = im.convert('RGBA'); base.alpha_composite(layer)
    return base.convert('RGB')


def accept(cid, season=None, slot=None, scale=None, top=None, series=None, y0=None, y1=None, kw_nl=None, content=None, at=None, x0=None, x1=None, dil=None, smin=None, ex=None, hmax=None):
    q = json.load(open(os.path.join(FULL, 'queue.json')))['queue']
    item = next(x for x in q if x['id'] == cid)
    fmt = item['fmt']; slot = slot or item['slot']; season = season or item['season']
    slot = {'extra': 'feed', 'holiday-feed': 'feed', 'holiday-x': 'x'}.get(slot, slot)                     # extras (TikTok/Reels covers) carry the @playwordocious footer
    season = 'thanksgiving' if season == 'harvest' else season      # queue.json says 'harvest' for Nov 14-29
    src = os.path.join(FULL, cid + '.png')
    if not os.path.exists(src):
        src = os.path.join('/private/tmp/claude-501/-Users-brianterchin-Developer-WordRush--claude-worktrees-new-session-38fb01/c71b5614-4332-4087-96d2-47d25779769a/scratchpad', 'accepted', cid + '.png')
    raw = Image.open(src).convert('RGB')
    if series:
        raw = recolor_headline(raw, season, series, int(y0), int(y1), int(kw_nl) if kw_nl else None, int(x0) if x0 else None, int(x1) if x1 else None, int(dil) if dil else 14, float(smin) if smin else 0.4, [tuple(int(v) for v in r.split(',')) for r in ex.split(';')] if ex else None, int(hmax) if hmax else 345)
    if scale == 'crop':
        im = frame(raw, fmt)
    elif scale == 'fill':
        im = fill_scene(raw, fmt, int(top or 0))
    elif scale:
        im = fit_scene(raw, fmt, float(scale), int(top))
    elif fmt == 'landscape':
        im = fit_scene(raw, fmt, 0.87, 28)      # default: whole 3:2 scene, margins reflected, wordmark band clear
    elif fmt == 'portrait':
        im = fit_scene(raw, fmt, 0.88, 0)
    else:
        im = frame(raw, fmt)
    if content:
        im = add_content(im, fmt, content, at, season, series)
    out = overlay(im, fmt, slot, season)
    key = cid.rsplit('-', 1)[0] if item['slot'] != 'pin' else cid
    key = key.replace('-holiday-feed', '-holiday').replace('-holiday-x', '-holiday')   # holiday greetings: one post, portrait + landscape share a folder
    key = key.replace('-land', '')       # extras: <date>-family-land-1 shares <date>-family with the portrait
    d = C.out_dir(key)
    fn = {'landscape': 'landscape.png', 'portrait': 'portrait.png', 'pin': 'pin.png'}[fmt]
    out.save(os.path.join(d, fn), optimize=True)
    review(cid, os.path.join(d, 'raw', f'compare-{fmt}.jpg'), src)
    _old = os.path.join(d, 'raw', f'compare-{fmt}.png')
    if os.path.exists(_old):
        os.remove(_old)
    # accepted: drop the superseded composite's lettering captures and the candidate itself (founder: delete what is not needed)
    for f in os.listdir(os.path.join(d, 'raw')):
        if f.endswith('-capture.png'):
            os.remove(os.path.join(d, 'raw', f))
    keep = os.path.join('/private/tmp/claude-501/-Users-brianterchin-Developer-WordRush--claude-worktrees-new-session-38fb01/c71b5614-4332-4087-96d2-47d25779769a/scratchpad', 'accepted'); os.makedirs(keep, exist_ok=True)
    if os.path.dirname(src) != keep:
        os.replace(src, os.path.join(keep, cid + '.png'))
    mp = os.path.join(HERE, 'manifest.json'); m = json.load(open(mp))
    for r in m:
        if r['key'] == key:
            r['source'] = 'chatgpt-scene'; r['mascot_check'] = 'pass (checked vs hero)'
    json.dump(m, open(mp, 'w'), indent=2)
    print('accepted ->', os.path.join(key, fn))
    return key, fn


def reject(cid, why):
    src = os.path.join(FULL, cid + '.png')
    if os.path.exists(src):
        os.remove(src)
    mp = os.path.join(HERE, 'manifest.json')
    m = json.load(open(mp))
    key = cid.rsplit('-', 1)[0].replace('-holiday-feed', '-holiday').replace('-holiday-x', '-holiday')
    for r in m:
        if r['key'] == key or r['key'] == cid:
            r.setdefault('rejected', []).append(f'{cid}: {why}')
    json.dump(m, open(mp, 'w'), indent=2)
    rp = os.path.join(HERE, 'incoming', 'rejects.json')
    rj = json.load(open(rp)) if os.path.exists(rp) else []
    rj.append({'id': cid, 'why': why, 'status': 'redo'})
    json.dump(rj, open(rp, 'w'), indent=2)
    print('rejected', cid, why)


def review(cid, out_dir_=None, src=None):
    """Review sheet: the candidate on top, the real hero (or in-season costume) art of every cast member listed in the queue below it."""
    q = json.load(open(os.path.join(FULL, 'queue.json')))['queue']
    item = next(x for x in q if x['id'] == cid)
    sc = Image.open(src or os.path.join(FULL, cid + '.png')).convert('RGB')
    season = item['season']
    season = 'thanksgiving' if season == 'harvest' else season
    refs = []
    for c in item['cast']:
        base = c.split('|')[0]
        if season in ('halloween', 'thanksgiving', 'winter'):
            folder = os.path.join(C.BRAND, 'seasons', 'winter-holidays' if season == 'winter' else season, 'cast')
            fs = [f for f in sorted(os.listdir(folder)) if f == base + '.png' or f.startswith(base + '-alt')]
            fs.sort(key=lambda f: (f != base + '.png', f))      # base costume first, then the alts
            if season == 'winter':      # winter -alt1 files are old duplicates: compare against the hero + the 10-16 costume only
                refs.append(Image.open(os.path.join(C.BRAND, 'cast', 'hero', base + '.png')).convert('RGBA'))
                refs[-1] = refs[-1].crop(refs[-1].getchannel('A').getbbox()); fs = [base + '.png']
        else:
            folder = os.path.join(C.BRAND, 'cast', 'hero'); fs = [base + '.png']
        for f in fs[:4]:
            im = Image.open(os.path.join(folder, f)).convert('RGBA'); im = im.crop(im.getchannel('A').getbbox())
            refs.append(im)
    # reference strip: every ref at one height, scaled down so the whole row fits the sheet width (nothing cut off)
    h = 260
    tot = sum(round(im.width * h / im.height) + 14 for im in refs) + 6
    if tot > sc.width:
        h = int(h * sc.width / tot)
    strip = Image.new('RGB', (sc.width, h + 10), (200, 190, 230)); x = 6
    for im in refs:
        im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
        strip.paste(im, (x, 5), im); x += im.width + 14
    sheet = Image.new('RGB', (sc.width, sc.height + strip.height))
    sheet.paste(sc, (0, 0)); sheet.paste(strip, (0, sc.height))
    p = out_dir_ or os.path.join('/private/tmp/claude-501/-Users-brianterchin-Developer-WordRush--claude-worktrees-new-session-38fb01/c71b5614-4332-4087-96d2-47d25779769a/scratchpad', f'review-{cid}.jpg')
    sheet.save(p, quality=80)    # JPEG q80 keeps the compare sheets small
    return p


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'accept':
        a = sys.argv[2:]
        kw = {}
        pos = [x for x in a if not x.startswith('--')]
        i = 0
        while i < len(a):
            if a[i].startswith('--'):
                kw[a[i][2:]] = a[i + 1]; i += 2
            else:
                i += 1
        accept(pos[0], None, None, kw.get('scale'), kw.get('top'), kw.get('series'), kw.get('y0'), kw.get('y1'), kw.get('nl'), kw.get('content'), kw.get('at'), kw.get('x0'), kw.get('x1'), kw.get('dil'), kw.get('smin'), kw.get('ex'), kw.get('hmax'))
    elif cmd == 'review':
        print(review(sys.argv[2]))
    elif cmd == 'reject':
        reject(sys.argv[2], sys.argv[3])

