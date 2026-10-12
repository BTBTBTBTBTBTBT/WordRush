"""3:4 contact sheet (founder 10-12: iMessage crops anything taller than 3:4).
Each card is drawn at 1/3 scale on a 1080 x 1440 (3:4) frame with a red outline; a card taller than the
frame would poke out and be labelled red. Usage: python3 contact34.py  -> docs/design/review/share-3x4-contact.png"""
import os
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'out')
review = os.path.join(here, '..', 'review')
cards = [
    ('webhero-classic-4of6', 'Classic (hero)'), ('web-classic-4of6', 'Classic (guest)'), ('webhero-octoword', 'Octo (hero)'),
    ('webhero-quadword', 'Quad (hero)'), ('webhero-gauntlet', 'Gauntlet (hero)'), ('webhero-sudocious', 'Sudocious (hero)'),
    ('webhero-crosswordocious', 'Crossword (hero)'), ('webhero-puzzles-sweep', 'Puzzles sweep, 10 rows (hero)'),
    ('webhero-daily-sweep', 'Daily Sweep (hero)'), ('webhero-six', 'Six (hero)'), ('webhero-profile', 'Profile (hero)'),
    ('webhero-leaderboard', 'Leaderboard (hero)'), ('webhero-vs-classic', 'VS'), ('webhero-moment-levelup', 'Moment (hero)'),
]
S = 1 / 3
FW, FH = round(1080 * S), round(1440 * S)
cols = 5
pad, lab = 14, 34
rows = (len(cards) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (FW + pad) + pad, rows * (FH + lab + pad) + pad), (36, 34, 46))
d = ImageDraw.Draw(sheet)
for i, (cid, label) in enumerate(cards):
    im = Image.open(os.path.join(out, cid + '.png')).convert('RGB')
    k = 1080 / im.width            # VS renders at 2x
    h = im.height * k
    im = im.resize((FW, round(h * S)))
    x = pad + (i % cols) * (FW + pad)
    y = pad + (i // cols) * (FH + lab + pad)
    d.rectangle([x, y, x + FW - 1, y + FH - 1], fill=(20, 18, 28))
    sheet.paste(im, (x, y))
    over = h > 1440.5
    d.rectangle([x - 1, y - 1, x + FW, y + FH], outline=(255, 70, 70) if over else (250, 204, 21), width=2)
    d.text((x, y + FH + 8), f'{label}  1080x{round(h)}' + ('  OVER 1440' if over else ''), fill=(255, 120, 120) if over else (235, 235, 235))
os.makedirs(review, exist_ok=True)
dst = os.path.join(review, 'share-3x4-contact.png')
sheet.save(dst)
print(dst, sheet.size)
