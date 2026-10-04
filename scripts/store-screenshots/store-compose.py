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
# Simulator set (capture-sim.sh, -storeDemo). Slot 10 reuses the composed widgets frame
# from the last version (a `None` source = copy docs/store/screenshots-2.7/10-widgets-<size>.png).
SHOTS_SIM = [
    ('sim-01-home.png',        'home',        '19 fresh puzzles every day',  'Sweep all eight dailies for a Daily Sweep'),
    ('sim-02-classic.png',     'classic',     'One word, six tries',         'Every guess shows you a little more'),
    ('sim-03-octo.png',        'octoword',    'Eight boards at once',        'OctoWord: every guess plays on all eight'),
    ('sim-04-finish.png',      'victory',     'Every solve is scored',       'Guesses, speed and a clean finish all count'),
    ('sim-05-stats.png',       'stats',       'Your day at a glance',        'Streaks, levels and every daily you played'),
    ('sim-06-leaderboard.png', 'leaderboard', 'Climb the daily podium',      'Every game, every day, all-time too'),
    ('sim-07-friends.png',     'friends',     'Play with your friends',      "Today's race, who's on now, pocket games"),
    ('sim-08-vs.png',          'vs',          'VS battles, head to head',    'Race a friend live or take on the cast'),
    ('sim-09-mascot.png',      'mascot',      'Build your own mascot',       'Bodies, colors, hats and a backdrop to match'),
    (None,                     'widgets',     None,                          None),
]
if SET == 'sim': SHOTS = SHOTS_SIM
WIDGETS = os.path.join(HERE, '..', '..', 'docs', 'store', 'screenshots-2.7', '10-widgets-{}.png')
SIZES = {'67': (1320, 2868), '65': (1284, 2778)}

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

def compose(src, head, sub, W, H):
    s = W / 1320
    canvas = gradient(W, H, (0xF5, 0xF3, 0xFF), (0xEC, 0xE8, 0xFC)).convert('RGBA')
    draw = ImageDraw.Draw(canvas)
    # headline: Nunito Black, purple→pink like the app's titles
    # one line if it fits at 96/88/80 px, else wrap at 88 (never an orphan word on line two)
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
        grad = hgradient(mask.width, mask.height, (0x7C, 0x3A, 0xED), (0xEC, 0x48, 0x99)).convert('RGBA')
        canvas.paste(grad, (int((W - tw) / 2) - 10, y), mask)
        y += lh
    # subline: muted, bold
    sf = font(int(46 * s), 'Bold')
    y += int(18 * s)
    for ln in wrap(draw, sub, sf, W - int(200 * s)):
        tw = draw.textlength(ln, font=sf)
        draw.text(((W - tw) / 2, y), ln, font=sf, fill=(0x6B, 0x67, 0x85))
        y += int(sf.size * 1.3)
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
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + int(28 * s), x0 + pw, y0 + ph + int(28 * s)), r, fill=(0x4C, 0x1D, 0x95, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(40 * s)))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.paste(shot, (x0, y0), m)
    ImageDraw.Draw(canvas).rounded_rectangle((x0, y0, x0 + pw - 1, y0 + ph - 1), r, outline=(0xDD, 0xD6, 0xFE), width=max(2, int(3 * s)))
    return canvas.convert('RGB')

for key, (W, H) in SIZES.items():
    out = os.path.join(HERE, 'store-out', key); os.makedirs(out, exist_ok=True)
    for f in os.listdir(out): os.remove(os.path.join(out, f))
    for i, (fn, name, head, sub) in enumerate(SHOTS, 1):
        p = os.path.join(out, f'{i:02d}-{name}.png')
        if fn is None: img = Image.open(WIDGETS.format(key)).convert('RGB')
        else: img = compose(os.path.join(SRC, fn), head, sub, W, H)
        img.save(p, optimize=True)
        print(key, os.path.basename(p), img.size, os.path.getsize(p) // 1024, 'KB')
