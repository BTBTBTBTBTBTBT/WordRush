# Contact sheet of composed mascots using the avatar-parts.json rules (native layout), for eyeballing the art.
#   python3 preview-avatars.py out.png
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops
HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, 'parts')
M = json.load(open(os.path.join(HERE, '..', '..', '..', '..', 'packages', 'core', 'src', 'avatar-parts.json')))
U = 300


def art(n):
    return Image.open(os.path.join(P, n + '.png')).convert('RGBA')


def draw(c, name, cx, cy, w, mode='center'):
    a = art(name); h = w * a.height / a.width
    a = a.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    if mode == 'center':
        c.alpha_composite(a, (round(cx - w / 2), round(cy - h / 2)))
    else:  # hat: bottom 18% below cy
        c.alpha_composite(a, (round(cx - w / 2), round(cy - h * 0.82)))


def mascot(body, color, eyes, mouth, nose='none', head='none', face='none', neck='none', letter='A'):
    a = M['bodies'][body]; sc = {k: v['scale'] for k, v in M['parts'].items()}
    c = Image.new('RGBA', (U, U), (0, 0, 0, 0))
    if neck in ('cape', 'wings'):
        c.alpha_composite(art(f'art-av-acc-{neck}').resize((U, U), Image.LANCZOS))
    b = art(f'art-av-body-{body}').resize((U, U), Image.LANCZOS)
    tint = Image.new('RGBA', (U, U), color)
    mul = ImageChops.multiply(b.convert('RGB'), tint.convert('RGB')).convert('RGBA'); mul.putalpha(b.getchannel('A'))
    c.alpha_composite(mul)
    lx, ly, lw, lh = [v * U for v in a['letterBox']]
    d = ImageDraw.Draw(c)
    try:
        f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Black.ttf', int(lh * 1.05))
    except Exception:
        f = ImageFont.load_default()
    d.text((lx + lw / 2, ly + lh / 2), letter, font=f, fill='white', anchor='mm')
    fx = a['faceCenter'][0] * U
    if neck not in ('none', 'cape', 'wings'):
        draw(c, f'art-av-acc-{neck}', fx, a['neckY'] * U, sc['neck'] * U)
    if nose != 'none':
        draw(c, f'art-av-nose-{nose}', fx, a['cheekY'] * U, sc['nose'] * U)
    draw(c, f'art-av-eyes-{eyes}', fx, a['eyeY'] * U, sc['eyes'] * U)
    draw(c, f'art-av-mouth-{mouth}', fx, a['mouthY'] * U, sc['mouth'] * U)
    if face != 'none':
        draw(c, f'art-av-acc-{face}', fx, a['eyeY'] * U, sc['face'] * U)
    if head != 'none':
        draw(c, f'art-av-acc-{head}', a['headTop']['x'] * U, a['headTop']['y'] * U, a['headTop']['w'] * sc['head'] * U, 'hat')
    return c


CFG = [
    ('classic', '#7c3aed', 'beady', 'smile', 'none', 'crown', 'none', 'cape', 'W'),
    ('tall', '#22c55e', 'happy', 'grin', 'blush', 'sprout', 'none', 'none', 'I'),
    ('wide', '#f97316', 'sparkly', 'tongue', 'freckles', 'cowboy', 'none', 'bowtie', 'B'),
    ('blob', '#ec4899', 'wink', 'cat', 'button', 'bow', 'heart-glasses', 'none', 'O'),
    ('bean', '#0ea5e9', 'sleepy', 'tiny', 'none', 'nightcap', 'none', 'scarf', 'R'),
    ('star', '#eab308', 'stars', 'toothy', 'red', 'party', 'none', 'none', 'S'),
    ('classic', '#64748b', 'glasses', 'smirk', 'none', 'grad', 'mustache', 'chain', 'D'),
    ('blob', '#2563eb', 'cyclops', 'gasp', 'none', 'halo', 'none', 'wings', 'C'),
    ('wide', '#ef4444', 'hearts', 'o', 'blush', 'headphones', 'monocle', 'none', 'E'),
    ('tall', '#8b5cf6', 'beady', 'smile', 'none', 'wizard', 'none', 'none', 'T'),
    ('classic', '#f5a524', 'happy', 'grin', 'none', 'bunnyears', 'none', 'none', 'Q'),
    ('bean', '#10b981', 'beady', 'tongue', 'none', 'viking', 'none', 'none', 'V'),
]
cols = 6
sheet = Image.new('RGBA', (cols * (U + 20) + 20, ((len(CFG) + cols - 1) // cols) * (U + 20) + 20), (237, 233, 254, 255))
for i, cfg in enumerate(CFG):
    m = mascot(*cfg)
    sheet.alpha_composite(m, (20 + (i % cols) * (U + 20), 20 + (i // cols) * (U + 20)))
sheet.convert('RGB').save(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'preview.png'))
