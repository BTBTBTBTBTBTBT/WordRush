#!/usr/bin/env python3
"""Bolt-on audit (10-04): every shipped accessory on 4 bodies, through the CORE layout (dump-layout.ts),
rendered with the apps' recipe (avatar_draw.render). Writes audit-<group>.png.
  python3 integration/audit.py
"""
import json, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
AV = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(AV, '..', '..', '..', '..'))
sys.path.insert(0, AV)
from avatar_draw import render  # noqa: E402

BODIES = [('classic', 'purple'), ('tall', 'teal'), ('blob', 'amber'), ('star', 'pink')]


def catalogs():
    src = open(os.path.join(REPO, 'packages', 'core', 'src', 'avatar-config.ts')).read()
    def arr(name):
        m = re.search(r'export const ' + name + r' = \[(.*?)\] as const', src, re.S)
        return [x for x in re.findall(r"'([^']+)'", m.group(1)) if x != 'none']
    return {k: arr(v) for k, v in dict(heads='AVATAR_HEADS', faces='AVATAR_FACES', necks='AVATAR_NECKS').items()}


def dump(cfgs):
    r = subprocess.run([REPO + '/apps/server/node_modules/.bin/tsx', os.path.join(AV, 'dump-layout.ts')],
                       input=json.dumps(cfgs), capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def sheet(field, ids, out, T=170):
    cfgs, labels = [], []
    for i in ids:
        for b, c in BODIES:
            cfg = dict(body=b, color=c, head='none', face='none', neck='none', eyes='beady', mouth='smile')
            cfg[field] = i
            cfgs.append(cfg); labels.append(f'{i} / {b}')
    d = dump(cfgs)
    cols = 8
    rows = (len(cfgs) + cols - 1) // cols
    img = Image.new('RGB', (cols * (T + 6) + 6, rows * (T + 20) + 6), (250, 250, 252))
    f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 11)
    dr = ImageDraw.Draw(img)
    for k, e in enumerate(d['out']):
        im = render(e, T, bg=(241, 239, 250, 255), letter='A').convert('RGB')
        x, y = 6 + (k % cols) * (T + 6), 6 + (k // cols) * (T + 20)
        img.paste(im, (x, y)); dr.text((x + 2, y + T + 3), labels[k], fill=(50, 40, 80), font=f)
    img.save(out, optimize=True)
    print(out, len(cfgs))


if __name__ == '__main__':
    C = catalogs()
    sheet('neck', C['necks'], os.path.join(HERE, 'audit-neck.png'))
    sheet('face', C['faces'], os.path.join(HERE, 'audit-face.png'))
    sheet('head', C['heads'], os.path.join(HERE, 'audit-head.png'), T=130)
