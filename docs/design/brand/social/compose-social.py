# Social media creative package (founder, 2026-10-02): every image for the social channels,
# drawn at full resolution from the brand kit — code-drawn sky + glossy letter tiles (kit.py,
# same tile as the ART_SPEC §20 avatars), the cast hero art (cast/hero, 1024 px), the
# WORDOCIOUS wordmark lettering (ChatGPT, keyed) and Nunito Black for copy.
#   python3 docs/design/brand/social/compose-social.py   → social/out/<channel>/*.png
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
from kit import BRAND, CAST, place, text, sky, scatter_tiles, letter_tile, hex2rgb, shade

OUT = os.path.join(kit.HERE, 'out')
WORDMARK = os.path.join(kit.HERE, 'wordmark-keyed.png')
TAGLINE = 'DAILY WORD GAMES'
SUBLINE = 'Same puzzles for everyone  ·  iPhone, Android & web'
URL = 'wordocious.com'
CAST_COLORS = {'w': '#8B2CF5', 'o1': '#FF9F1A', 'r': '#8E96A8', 'd': '#0A6CFF', 'o2': '#FF2F91',
               'c': '#00B4BE', 'i': '#4CC77A', 'o3': '#F0782C', 'u': '#9B3DF3', 's': '#F5A623'}
ROLES = {'w': ('THE LEADER', 'Cape on, chin up, first to every puzzle.'),
         'o1': ('THE CHEERLEADER', 'Four arms, two pom-poms, zero chill.'),
         'r': ('THE NAPPER', 'Solves puzzles in their sleep. Literally.'),
         'd': ('THE BRAIN', 'Glasses on, pencil out, answer found.'),
         'o2': ('THE STAR', 'Every win deserves a spotlight.'),
         'c': ('THE EXPLORER', 'Curious about every word out there.'),
         'i': ('THE SPROUT', 'Shy at first. Then unstoppable.'),
         'o3': ('THE PRANKSTER', 'One big eye on mischief.'),
         'u': ('THE ZEN ONE', 'Calm streaks, perfect focus.'),
         's': ('THE SPEEDSTER', 'Fastest solve in the room.')}
_cache = {}


def hero(cid):
    if cid not in _cache:
        im = Image.open(os.path.join(BRAND, 'cast', 'hero', f'{cid}.png')).convert('RGBA')
        _cache[cid] = im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
    return _cache[cid]


def wordmark():
    if 'wm' not in _cache:
        im = Image.open(WORDMARK).convert('RGBA')
        _cache['wm'] = im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
    return _cache['wm']


def contact_shadow(c, cx, by, w):
    m = Image.new('L', c.size, 0)
    ImageDraw.Draw(m).ellipse((cx - w / 2, by - w * 0.06, cx + w / 2, by + w * 0.06), fill=70)
    c.paste(Image.new('RGBA', c.size, (70, 30, 110, 255)), (0, 0), m.filter(ImageFilter.GaussianBlur(w * 0.05)))


def cast_row(c, x0, x1, base_y, h, bounce=0.08, overlap=0.12, order=CAST):
    """The ten heroes standing in WORDOCIOUS order between x0 and x1, feet on base_y."""
    ims = [hero(cid) for cid in order]
    ws = [im.width * h / im.height for im in ims]
    total = sum(ws) * (1 - overlap) + ws[-1] * overlap
    scale = min(1.0, (x1 - x0) / total)
    hh = h * scale; ws = [w * scale for w in ws]
    total = sum(ws) * (1 - overlap) + ws[-1] * overlap
    x = x0 + ((x1 - x0) - total) / 2
    for k, (im, w) in enumerate(zip(ims, ws)):
        cx = x + w / 2
        lift = hh * bounce * (1 if k % 2 else 0)
        contact_shadow(c, cx, base_y, w * 0.8)
        place(c, im, cx, base_y - lift - hh / 2, height=hh)
        x += w * (1 - overlap)


def lockup(c, cx, top, width, tag=True, sub=False, tag_scale=1.0):
    """Wordmark + tagline block; returns the y below it."""
    wm = wordmark()
    _, h = place(c, wm, cx, top + width * wm.height / wm.width / 2, width=width)
    y = top + h
    if tag:
        ts = round(width * 0.062 * tag_scale)
        text(c, TAGLINE, cx, y + ts * 0.9, ts, fill=(255, 255, 255), stroke=(124, 58, 237), sw=max(2, ts // 9))
        y += ts * 1.7
    if sub:
        ss = round(width * 0.034 * tag_scale)
        text(c, SUBLINE, cx, y + ss * 0.8, ss, fill=(74, 32, 120), weight='ExtraBold', shadow=False)
        y += ss * 1.6
    return y


def row_fit_height(x0, x1, overlap=0.12, order=CAST):
    """Tallest cast row that fits between x0 and x1."""
    r = [hero(cid).width / hero(cid).height for cid in order]
    return (x1 - x0) / (sum(r) * (1 - overlap) + r[-1] * overlap)


def lockup_height(width, tag=True, sub=False, tag_scale=1.0):
    wm = wordmark(); h = width * wm.height / wm.width
    if tag: h += round(width * 0.062 * tag_scale) * 1.7
    if sub: h += round(width * 0.034 * tag_scale) * 1.6
    return h


def hero_block(c, cx, x0, x1, y0, y1, wm_w, sub=False, gap=0.06, max_cast=None, tag_scale=1.0):
    """Wordmark + tagline + cast row as one block, vertically centered in y0..y1."""
    lh = lockup_height(wm_w, sub=sub, tag_scale=tag_scale)
    g = (y1 - y0) * gap
    ch = min(row_fit_height(x0, x1), (y1 - y0) - lh - g, max_cast or 1e9)
    top = y0 + ((y1 - y0) - (lh + g + ch)) / 2
    lockup(c, cx, top, wm_w, sub=sub, tag_scale=tag_scale)
    cast_row(c, x0, x1, top + lh + g + ch, ch / 1.08)  # /1.08: the bounce lifts every other one


_pending = {}


def bg(w, h, seed=1, clear=None, letters='WORDOCIOUS', count=None, max_size=0.16, tint=None):
    """Returns a transparent CONTENT layer; save() lays the sky + floating tiles under it,
    keeping every tile clear of the content's actual pixels."""
    content = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    _pending[id(content)] = (seed, letters, count, max_size, tint)
    return content


def sky_with_tiles(content):
    w, h = content.size
    seed, letters, count, max_size, tint = _pending.pop(id(content))
    if tint:
        base = hex2rgb(tint)
        c = sky(w, h, top='#%02x%02x%02x' % shade(base, 0.45), mid='#%02x%02x%02x' % shade(base, 0.68),
                bottom='#%02x%02x%02x' % shade(base, 0.82), seed=seed)
    else:
        c = sky(w, h, seed=seed)
    a = np.asarray(content.getchannel('A').filter(ImageFilter.MaxFilter(9))) > 10
    if count != 0:
        scatter_tiles(c, list(letters), seed=seed, count=count or 10, max_size=max_size, avoid=a)
    c.alpha_composite(content)
    return c


def save(c, folder, name):
    if id(c) in _pending:
        c = sky_with_tiles(c)
    d = os.path.join(OUT, folder); os.makedirs(d, exist_ok=True)
    c.convert('RGB').save(os.path.join(d, name + '.png'), optimize=True)
    print(folder, name, c.size)


# ---------------------------------------------------------------- banners / covers
def x_header():                       # X (Twitter) 1500×500; avatar overlaps bottom-left
    w, h = 1500, 500
    c = bg(w, h, seed=3, clear=[(0.22, 0.0, 0.98, 1.0), (0.0, 0.55, 0.28, 1.0)], count=7, max_size=0.24)
    hero_block(c, 930, 380, 1480, 24, h - 18, 700, gap=0.03)
    save(c, 'x-twitter', 'header-1500x500')


def facebook_cover():                 # 1640×624 (desktop 820×312 @2x; mobile crops the sides)
    w, h = 1640, 624
    c = bg(w, h, seed=5, clear=[(0.16, 0.0, 0.84, 1.0)], count=8, max_size=0.24)
    hero_block(c, w / 2, 260, 1380, 30, h - 24, 820, gap=0.03)
    save(c, 'facebook', 'cover-1640x624')


def linkedin():
    w, h = 1128, 191                  # company page cover
    c = bg(w, h, seed=7, count=6, max_size=0.3)
    lockup(c, 290, (h - lockup_height(440, tag_scale=1.1)) / 2, 440, tag=True, tag_scale=1.1)
    ch = min(row_fit_height(560, 1110), h - 24)
    cast_row(c, 560, 1110, h - 10, ch / 1.08)
    save(c, 'linkedin', 'company-cover-1128x191')
    w, h = 1584, 396                  # personal profile background (photo bottom-left)
    c = bg(w, h, seed=8, clear=[(0.25, 0.0, 0.98, 1.0), (0.0, 0.45, 0.25, 1.0)], count=6, max_size=0.26)
    hero_block(c, 990, 430, 1550, 20, h - 14, 620, gap=0.03)
    save(c, 'linkedin', 'personal-cover-1584x396')


def youtube():                        # 2560×1440; safe area 1546×423 centered
    w, h = 2560, 1440
    c = bg(w, h, seed=9, clear=[(0.19, 0.34, 0.81, 0.66)], count=22, max_size=0.14)
    sx0, sy0 = (w - 1546) / 2, (h - 423) / 2
    hero_block(c, w / 2, sx0 + 40, sx0 + 1546 - 40, sy0, sy0 + 423, 820, gap=0.03)
    save(c, 'youtube', 'banner-2560x1440')


def og_image():                       # link previews (web, iMessage, Slack, Discord) 1200×630
    w, h = 1200, 630
    c = bg(w, h, seed=11, clear=[(0.1, 0.0, 0.9, 1.0)], count=8, max_size=0.22)
    hero_block(c, w / 2, 70, 1130, 36, h - 30, 820, sub=True, gap=0.04)
    save(c, 'web', 'og-image-1200x630')


def discord():                        # server banner 960×540 + invite splash 1920×1080
    for (w, h, name, seed) in [(960, 540, 'server-banner-960x540', 13), (1920, 1080, 'invite-splash-1920x1080', 14)]:
        c = bg(w, h, seed=seed, clear=[(0.12, 0.05, 0.88, 0.95)], count=10, max_size=0.2)
        hero_block(c, w / 2, w * 0.06, w * 0.94, h * 0.08, h * 0.94, w * 0.7, gap=0.05)
        save(c, 'discord', name)


# ---------------------------------------------------------------- feed posts
def cast_rows(c, groups, spans, cx, y0, y1, overlap=0.03, gap_frac=0.06):
    """Stack cast rows (e.g. 5+5 or 3+4+3), same character height, vertically centered."""
    fits = [row_fit_height(cx - sp / 2, cx + sp / 2, overlap, ids) for ids, sp in zip(groups, spans)]
    n = len(groups); gap = (y1 - y0) * gap_frac
    rh = min(min(fits), ((y1 - y0) - gap * (n - 1)) / n)
    top = y0 + ((y1 - y0) - (rh * n + gap * (n - 1))) / 2
    for k, (ids, sp) in enumerate(zip(groups, spans)):
        cast_row(c, cx - sp / 2, cx + sp / 2, top + rh * (k + 1) + gap * k, rh / 1.06, overlap=overlap, order=ids, bounce=0.06)


def post_cast(w, h, folder, name, seed):
    c = bg(w, h, seed=seed, count=10, max_size=0.14)
    y = lockup(c, w / 2, h * 0.06, w * 0.8, sub=False, tag_scale=1.05)
    if h / w > 1.15:   # tall formats: 3-4-3 rows fill the height
        cast_rows(c, [CAST[:3], CAST[3:7], CAST[7:]], [w * 0.72, w * 0.94, w * 0.72], w / 2, y + h * 0.02, h * 0.89, gap_frac=0.035)
    else:
        cast_rows(c, [CAST[:5], CAST[5:]], [w * 0.92, w * 0.92], w / 2, y + h * 0.02, h * 0.89)
    text(c, URL, w / 2, h * 0.94, round(w * 0.05), fill=(255, 255, 255), stroke=(124, 58, 237), sw=4)
    save(c, folder, name)


def story(w, h, folder, name, seed, tint=None):
    c = bg(w, h, seed=seed, count=12, max_size=0.12, tint=tint)
    y = lockup(c, w / 2, h * 0.08, w * 0.9, sub=False, tag_scale=1.1)
    cast_rows(c, [CAST[:3], CAST[3:7], CAST[7:]], [w * 0.74, w * 0.96, w * 0.74], w / 2, y + h * 0.02, h * 0.8, gap_frac=0.04)
    ss = round(w * 0.075)
    text(c, 'Play today\u2019s puzzles', w / 2, h * 0.86, ss, fill=(255, 255, 255), stroke=(124, 58, 237), sw=6)
    text(c, URL, w / 2, h * 0.86 + ss * 1.35, round(ss * 0.72), fill=(74, 32, 120), weight='ExtraBold', shadow=False)
    save(c, folder, name)


def character_cards():                # "Meet the cast" carousel, 1080×1350 each
    for k, cid in enumerate(CAST):
        w, h = 1080, 1350
        col = CAST_COLORS[cid]
        letter = 'WORDOCIOUS'[k]
        c = bg(w, h, seed=40 + k, clear=[(0.08, 0.1, 0.92, 0.9)], count=9, max_size=0.13, letters=letter * 3 + 'WORDOCIOUS', tint=col)
        text(c, 'MEET THE CAST', w / 2, 92, 54, fill=(255, 255, 255), stroke=shade(hex2rgb(col), -0.3), sw=5)
        contact_shadow(c, w / 2, 980, 560)
        place(c, hero(cid), w / 2, 590, height=760)
        role, line = ROLES[cid]
        text(c, role, w / 2, 1080, 96, fill=(255, 255, 255), stroke=shade(hex2rgb(col), -0.35), sw=8)
        text(c, line, w / 2, 1170, 44, fill=shade(hex2rgb(col), -0.55), weight='ExtraBold', shadow=False)
        place(c, wordmark(), w / 2, 1270, width=360)
        save(c, 'instagram/cast-carousel', f'{k + 1:02d}-{cid}-1080x1350')


def highlight_covers():               # Instagram story highlight covers: center circle matters
    sets = [('daily', 'w', 'D'), ('games', 'c', 'G'), ('vs', 's', 'V'), ('friends', 'o1', 'F'),
            ('tips', 'd', 'T'), ('news', 'o2', 'N'), ('wins', 'o3', 'W'), ('zen', 'u', 'Z')]
    for name, cid, _ in sets:
        w, h = 1080, 1920
        base = hex2rgb(CAST_COLORS[cid])
        c = kit.vgrad(w, h, [(0, shade(base, 0.35)), (1, shade(base, -0.1))]).convert('RGBA')
        m = Image.new('L', (w, h), 0)
        ImageDraw.Draw(m).ellipse((w / 2 - 470, h / 2 - 470, w / 2 + 470, h / 2 + 470), fill=60)
        c.paste(Image.new('RGBA', (w, h), (255, 255, 255, 255)), (0, 0), m.filter(ImageFilter.GaussianBlur(40)))
        place(c, hero(cid), w / 2, h / 2, height=760)
        save(c, 'instagram/highlight-covers', f'{name}-1080x1920')


def profile_pictures():
    logo = os.path.join(BRAND, 'logo')
    cur = Image.open(os.path.join(logo, 'app-icon-1024.png')).convert('RGBA').resize((1080, 1080), Image.LANCZOS)
    save(cur, 'profile-pictures', 'current-app-icon-1080')
    nb = Image.open(os.path.join(logo, 'option-B-w-mascot.png')).convert('RGBA')
    # option B is drawn with rounded corners; fill a square so circle crops never show corners
    # sample its own gradient just inside the rounded corners so the square fill matches
    rgb = nb.convert('RGB')
    top, bot = rgb.getpixel((512, 30)), rgb.getpixel((512, 994))
    sq = kit.vgrad(1080, 1080, [(0, top), (1, bot)]).convert('RGBA')
    place(sq, nb, 540, 540, height=1080)
    save(sq, 'profile-pictures', 'icon-B-w-mascot-1080-USE-WHEN-APP-ICON-SWITCHES')
    t = kit.vgrad(1080, 1080, [(0, (184, 166, 247)), (1, (255, 211, 230))]).convert('RGBA')
    t.alpha_composite(letter_tile('W', 700, '#8B2CF5'), (106, 110))
    save(t, 'profile-pictures', 'w-letter-tile-1080')


if __name__ == '__main__':
    profile_pictures()
    x_header(); facebook_cover(); linkedin(); youtube(); og_image(); discord()
    post_cast(1080, 1080, 'instagram', 'post-cast-1080x1080', 21)
    post_cast(1080, 1350, 'instagram', 'post-cast-1080x1350', 22)
    post_cast(1200, 1200, 'facebook', 'post-cast-1200x1200', 23)
    story(1080, 1920, 'instagram', 'story-1080x1920', 31)
    story(1080, 1920, 'tiktok', 'cover-1080x1920', 32, tint='#FF2F91')
    post_cast(1000, 1500, 'pinterest', 'pin-1000x1500', 24)
    character_cards(); highlight_covers()
