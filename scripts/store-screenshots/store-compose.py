"""Compose App Store screenshots: caption band + phone shot on the app's lavender ground.
Outputs store-out/67/NN-name.png (1320x2868) and store-out/65/NN-name.png (1284x2778)."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'store-src')
FONT = os.path.join(HERE, '..', '..', 'apps', 'ios', 'Wordocious', 'Resources', 'Nunito.ttf')
# SET=sim composes the simulator captures (capture-sim.sh → store-src/sim-NN-<name>.png);
# the default is the founder-phone set below.
SET = os.environ.get('SET', 'sim')   # 'phone' = the founder-shot SHOTS table
# 2.8 (10-10): THEME=halloween puts the frames on the season's night ground (black → deep orange-brown, like the widgets),
# with an orange → gold headline, a soft cream subline and an ember hairline around the phone.
THEME = os.environ.get('THEME', 'day')
NIGHT = THEME == 'halloween'
HEAD_GRAD = ((0xF9, 0x73, 0x16), (0xFB, 0xBF, 0x24)) if NIGHT else ((0x7C, 0x3A, 0xED), (0xEC, 0x48, 0x99))
SUB_INK = (0xE9, 0xD5, 0xC4) if NIGHT else (0x6B, 0x67, 0x85)
EDGE = (0x7C, 0x2D, 0x12) if NIGHT else (0xDD, 0xD6, 0xFE)
SHADOW = (0xF9, 0x73, 0x16, 60) if NIGHT else (0x4C, 0x1D, 0x95, 70)

# founder order (2026-09-28): Home, More Games, Classic board, Classic answered, then ours
SHOTS = [
    ('IMG_9878.PNG', 'home',        'Eight daily word games',        'Finish them all for the Daily Sweep'),
    ('IMG_9879.PNG', 'more-games',  'Ten more games',                'One free daily each, Muddle to Starsweep'),
    ('IMG_9884.PNG', 'classic',     'Every solve is scored',         'Guesses, speed and a clean finish all count'),
    ('IMG_9883.PNG', 'victory',     'A new word with every win',     'The definition lands on your victory card'),
    ('IMG_9885.PNG', 'seven',       'Six and seven letters',         'Vowel and consonant hints when you need them'),
    ('IMG_9880.PNG', 'muddle',      'Muddle: unscramble the pun',    'Four words, circled letters, one punchline'),
    ('IMG_9889.PNG', 'leaderboard', 'Daily leaderboards',            'Every game, every day, all-time too'),
    ('IMG_9887.PNG', 'friends',     'Race your friends',             "Today's race, a weekly finish, VS challenges"),
    ('IMG_9886.PNG', 'stats-today', 'Your day at a glance',          'Sweep, More Games, VS and your standing'),
    ('IMG_9888.PNG', 'records',     'Records and a trophy shelf',    'Medals, fastest wins, fewest guesses'),
]
# Simulator set (capture-sim.sh, -storeDemo). Slot 10 composes the mascot widget renders
# from docs/design/widgets-2026-10-02 (a `None` source = compose_widgets).
SHOTS_SIM = [
    # 2.8 Halloween set (10-10): the Home board always first.
    ('sim-01-home.png',        'home',        '18 fresh puzzles every day',  'Eight dailies and ten puzzles, new each morning'),
    ('sim-02-classic.png',     'classic',     'One word, six tries',         'Every guess shows you a little more'),
    ('sim-03-octo.png',        'octoword',    'Eight boards at once',        'OctoWord: every guess plays on all eight'),
    ('sim-04-regions.png',     'starsweep',   'Ten puzzles beyond words',    'Starsweep, Crossword, Hubbub and more'),
    ('sim-05-crossword.png',   'crossword',   'A fresh crossword daily',     'Hints when you need them, points when you don\'t'),
    ('sim-06-hub.png',         'hubbub',      'Find every word',             'Hubbub: how many can you spell?'),
    ('sim-07-friends.png',     'pocket',      'Pocket games with friends',   'Tic-Tac-Tile, Ghost, Call It and more'),
    ('sim-08-friendspage.png', 'friends',     'Race your friends daily',     'A podium every day and who\'s on now'),
    ('sim-09-stats.png',       'stats',       'Your day at a glance',        'Your streak, records and every daily played'),
    ('sim-10-leaderboard.png', 'leaderboard', 'Climb the daily podium',      'See where you rank in every game today'),
]
if SET == 'sim': SHOTS = SHOTS_SIM
WIDGET_DIR = os.path.join(HERE, '..', '..', 'docs', 'design', 'widgets-2026-10-02')
SIZES = {'67': (1320, 2868), '65': (1284, 2778)}
# 2.8 (10-10): PLAY=1 also writes Google Play phone frames (9:16, within Play's 2:1 limit).
if os.environ.get('PLAY'): SIZES['play'] = (1080, 1920)

def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight)
    return f

def gradient(w, h, top, bottom):
    g = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return g.resize((w, h))

def hgradient(w, h, left, right):
    g = Image.new('RGB', (w, 1))
    for x in range(w):
        t = x / max(1, w - 1)
        g.putpixel((x, 0), tuple(int(left[i] + (right[i] - left[i]) * t) for i in range(3)))
    return g.resize((w, h))

def wrap(draw, text, f, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        trial = (cur + ' ' + w).strip()
        if draw.textlength(trial, font=f) <= maxw: cur = trial
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

HEAD_PX, SUB_PX = 88, 46   # SET=sim: one size for every frame (founder 10-03: same type, same axis)

def caption(canvas, head, sub, W, fixed):
    """Headline + subline centered on the frame's axis; returns the y below the subline."""
    s = W / 1320
    draw = ImageDraw.Draw(canvas)
    if fixed:
        # Every frame: one headline line at HEAD_PX, one subline line at SUB_PX — or fail loudly.
        hf = font(int(HEAD_PX * s), 'Black'); lines = wrap(draw, head, hf, W - int(160 * s))
        assert len(lines) == 1, f'headline wraps: {head!r}'
    else:
        # founder-phone set: one line if it fits at 96/88/80 px, else wrap at 88
        hf, lines = None, None
        for px in (96, 88, 80):
            hf = font(int(px * s), 'Black'); lines = wrap(draw, head, hf, W - int(160 * s))
            if len(lines) == 1: break
        if len(lines) > 1: hf = font(int(88 * s), 'Black'); lines = wrap(draw, head, hf, W - int(160 * s))
    y = int(150 * s)
    lh = int(hf.size * 1.12)
    for ln in lines:
        tw = draw.textlength(ln, font=hf)
        mask = Image.new('L', (int(tw) + 20, lh + 30), 0)
        ImageDraw.Draw(mask).text((10, 0), ln, font=hf, fill=255)
        grad = hgradient(mask.width, mask.height, HEAD_GRAD[0], HEAD_GRAD[1]).convert('RGBA')
        canvas.paste(grad, (int((W - tw) / 2) - 10, y), mask)
        y += lh
    sf = font(int(SUB_PX * s), 'Bold')
    y += int(18 * s)
    sublines = wrap(draw, sub, sf, W - int(200 * s))
    if fixed: assert len(sublines) == 1, f'subline wraps: {sub!r}'
    for ln in sublines:
        tw = draw.textlength(ln, font=sf)
        draw.text(((W - tw) / 2, y), ln, font=sf, fill=SUB_INK)
        y += int(sf.size * 1.3)
    return y

def ground(W, H):
    if NIGHT:
        return gradient(W, H, (0x0B, 0x07, 0x10), (0x3A, 0x1A, 0x05)).convert('RGBA')
    return gradient(W, H, (0xF5, 0xF3, 0xFF), (0xEC, 0xE8, 0xFC)).convert('RGBA')

def compose(src, head, sub, W, H):
    s = W / 1320
    canvas = ground(W, H)
    y = caption(canvas, head, sub, W, SET == 'sim')
    # phone shot: fit the remaining band, rounded corners, hairline border, soft shadow
    top = y + int(70 * s); bottom_pad = int(64 * s)
    shot = Image.open(src).convert('RGBA')
    ph = H - top - bottom_pad; pw = int(shot.width * ph / shot.height)
    if pw > W - int(120 * s): pw = W - int(120 * s); ph = int(shot.height * pw / shot.width)
    shot = shot.resize((pw, ph), Image.LANCZOS)
    r = int(72 * s)
    m = Image.new('L', (pw, ph), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, pw - 1, ph - 1), r, fill=255)
    x0 = (W - pw) // 2; y0 = top + (H - top - bottom_pad - ph) // 2
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + int(28 * s), x0 + pw, y0 + ph + int(28 * s)), r, fill=SHADOW)
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(40 * s)))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.paste(shot, (x0, y0), m)
    ImageDraw.Draw(canvas).rounded_rectangle((x0, y0, x0 + pw - 1, y0 + ph - 1), r, outline=EDGE, width=max(2, int(3 * s)))
    return canvas.convert('RGB')

def compose_widgets(head, sub, W, H):
    """The mascot widget renders (large, medium, small light + small dark) stacked in the
    same column a phone shot fills, each with the phone's soft shadow."""
    s = W / 1320
    canvas = ground(W, H)
    y = caption(canvas, head, sub, W, True)
    top = y + int(70 * s); bottom_pad = int(64 * s)
    # the same width a phone shot takes on this frame size
    cw = int(1320 * (H - top - bottom_pad) / 2868)
    gap = int(44 * s)
    half = (cw - gap) // 2
    def load(name, w):
        im = Image.open(os.path.join(WIDGET_DIR, name)).convert('RGBA')
        return im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
    large, medium = load('large-you-mid-light.png', cw), load('medium-you-mid-light.png', cw)
    sl, sd = load('small-you-swept-light.png', half), load('small-you-mid-dark.png', half)
    total = large.height + medium.height + sl.height + 2 * gap
    x0 = (W - cw) // 2; yy = top + (H - top - bottom_pad - total) // 2
    places = [(large, x0, yy), (medium, x0, yy + large.height + gap)]
    yb = yy + large.height + medium.height + 2 * gap
    places += [(sl, x0, yb), (sd, x0 + half + gap, yb)]
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for im, x, y1 in places:
        a = im.split()[3].point(lambda v: 70 if v > 128 else 0)
        tint = Image.new('RGBA', im.size, (0x4C, 0x1D, 0x95, 0)); tint.putalpha(a)
        shadow.alpha_composite(tint, (x, y1 + int(24 * s)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(36 * s)))
    canvas = Image.alpha_composite(canvas, shadow)
    for im, x, y1 in places: canvas.alpha_composite(im, (x, y1))
    return canvas.convert('RGB')

for key, (W, H) in SIZES.items():
    out = os.path.join(HERE, 'store-out', key); os.makedirs(out, exist_ok=True)
    for f in os.listdir(out): os.remove(os.path.join(out, f))
    for i, (fn, name, head, sub) in enumerate(SHOTS, 1):
        p = os.path.join(out, f'{i:02d}-{name}.png')
        if fn is None: img = compose_widgets(head, sub, W, H)
        else: img = compose(os.path.join(SRC, fn), head, sub, W, H)
        img.save(p, optimize=True)
        print(key, os.path.basename(p), img.size, os.path.getsize(p) // 1024, 'KB')
