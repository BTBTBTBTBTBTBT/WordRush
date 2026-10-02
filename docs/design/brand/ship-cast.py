# Ship the cast art to the three apps (docs/MASCOT_SPEC.md §0): trim the
# transparent padding, fit into 512 px (keeping a small even margin), then copy
# to web public/mascots, an iOS image set per character, and Android
# drawable-nodpi. Also writes a contact sheet for review.
import json
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC = os.path.join(HERE, 'cast', 'hero')
APP = os.path.join(HERE, 'cast', 'app')
IDS = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
SIZE = 512
os.makedirs(APP, exist_ok=True)

web = os.path.join(REPO, 'apps', 'web', 'public', 'mascots')
ios = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
android = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
os.makedirs(web, exist_ok=True)

sheet = Image.new('RGBA', (SIZE * 5 // 2, SIZE * 2 // 2), (248, 247, 255, 255))
for k, cid in enumerate(IDS):
    im = Image.open(os.path.join(SRC, f'{cid}.png')).convert('RGBA')
    # Trim to visible pixels (ignore near-transparent haze from the soft shadow).
    alpha = im.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    im = im.crop(alpha.getbbox())
    # Fit into SIZE with a 4% margin, bottom-aligned so every character stands on the same line.
    inner = int(SIZE * 0.92)
    scale = min(inner / im.width, inner / im.height)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(im, ((SIZE - im.width) // 2, SIZE - int(SIZE * 0.04) - im.height))
    out.save(os.path.join(APP, f'{cid}.png'), optimize=True)
    out.save(os.path.join(web, f'{cid}.png'), optimize=True)
    out.save(os.path.join(android, f'mascot_{cid}.png'), optimize=True)
    iset = os.path.join(ios, f'mascot-{cid}.imageset')
    os.makedirs(iset, exist_ok=True)
    out.save(os.path.join(iset, f'mascot-{cid}.png'), optimize=True)
    with open(os.path.join(iset, 'Contents.json'), 'w') as f:
        json.dump({'images': [{'filename': f'mascot-{cid}.png', 'idiom': 'universal'}], 'info': {'author': 'xcode', 'version': 1}}, f, indent=2)
    r, c = divmod(k, 5)
    sheet.alpha_composite(out.resize((SIZE // 2, SIZE // 2), Image.LANCZOS), (c * SIZE // 2, r * SIZE // 2))
sheet.convert('RGB').save(os.path.join(HERE, 'cast', 'contact-sheet.png'))
print('shipped', len(IDS))
