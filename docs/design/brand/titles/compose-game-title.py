# Game titles (founder: "the custom titles with the mascots should be in the color of the
# game's color"; "put some of them in front of the letters"): the game's name lettered in
# its accent (ChatGPT, keyed: titles/gt-<mode id>-lettering-keyed.png) + its host
# (MASCOT_SPEC §5) in a pose that fits the game, either standing in front of the
# word's end ('end') or perched on its top-right letters ('perch').
#   python3 compose-game-title.py [mode ids…]
import os, sys
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
POSES = os.path.join(HERE, '..', 'poses')

GAMES = {  # mode id: (host, pose, placement)
    'practice': ('w', 'wave', 'end'), 'gauntlet': ('s', 'slide', 'end'),
    'quordle': ('o1', 'cheer', 'end'), 'octordle': ('d', 'lean', 'end'),
    'sequence': ('i', 'cheer', 'end'), 'rescue': ('c', 'lean', 'end'),
    'six': ('o2', 'cheer', 'end'), 'seven': ('u', 'meditate', 'end'),
    'propernoundle': ('w', 'point', 'end'), 'sudoku': ('u', 'spin', 'perch'),
    'scramble': ('r', 'lean', 'end'), 'hub': ('o1', 'lean', 'end'),
    'crossword': ('d', 'sit', 'perch'), 'groups': ('o2', 'lean', 'end'),
    'ladder': ('i', 'lean', 'end'), 'cryptogram': ('c', 'cheer', 'end'),
    'wordsearch': ('o3', 'sneak', 'end'), 'regions': ('s', 'flex', 'end'),
}


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def shadow(im, op=0.3):
    s = Image.new('RGBA', im.size, (40, 20, 60, 0))
    s.putalpha(im.getchannel('A').point(lambda v: int(v * op)).filter(ImageFilter.GaussianBlur(5)))
    return s


def compose(mode):
    host, pose, place = GAMES[mode]
    # 10-03: hi-res re-letters (full-size ChatGPT downloads, titles/hires/) win over the old pane captures.
    hires = os.path.join(HERE, 'hires', f'gt-{mode}-lettering.png')
    src = hires if os.path.exists(hires) else os.path.join(HERE, f'gt-{mode}-lettering-keyed.png')
    word = trim(Image.open(src).convert('RGBA'))
    a = np.array(word.getchannel('A')) > 128
    rows = a[:, ::2].sum(axis=1)
    band = np.nonzero(rows > rows.max() * 0.45)[0]
    ltop, lbot = band[0], band[-1]
    lh = lbot - ltop
    hhost = os.path.join(HERE, 'hires', 'hosts', f'{mode}.png')   # 10-03 full-res host drawn for this title
    ch = trim(Image.open(hhost if os.path.exists(hhost) else os.path.join(POSES, f'{host}-{pose}.png')).convert('RGBA'))
    if place == 'end':
        h = int(lh * 1.75)
        ch = ch.resize((round(ch.width * h / ch.height), h), Image.LANCZOS)
        # Overlap the last letter a little; leaning poses reach left with an arm, so
        # they only touch it (the letter must stay readable).
        ov = int(ch.width * (0.04 if pose == 'lean' else 0.14))
        W = word.width + ch.width - ov
        top_extra = max(0, h - (word.height - int(lh * 0.02)))
        H = word.height + top_extra
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        canvas.alpha_composite(word, (0, top_extra))
        x, y = word.width - ov, top_extra + lbot + int(lh * 0.1) - h
        y = max(0, y)
    else:  # perch on top of the last letters
        h = int(lh * 1.35)
        ch = ch.resize((round(ch.width * h / ch.height), h), Image.LANCZOS)
        sink = int(lh * 0.22)
        top_extra = max(0, h - sink - ltop)
        W, H = word.width, word.height + top_extra
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        canvas.alpha_composite(word, (0, top_extra))
        x = int(word.width * 0.78 - ch.width / 2)
        y = top_extra + ltop + sink - h
    sc = max(1, word.height // 150)
    canvas.alpha_composite(shadow(ch), (x + 3 * sc, y + 5 * sc))
    canvas.alpha_composite(ch, (x, y))
    out = trim(canvas)
    out.save(os.path.join(HERE, f'gt-{mode}-title.png'))
    return out


for m in (sys.argv[1:] or GAMES):
    compose(m)
print('composed', len(sys.argv[1:] or GAMES))
