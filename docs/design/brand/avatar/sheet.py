# Contact sheet of composed mascots from the core layout:  python3 sheet.py configs.json out.png [cols] [size]
import json, sys, subprocess, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from avatar_draw import render
from PIL import Image
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))


def layouts(cfgs):
    r = subprocess.run([REPO + '/apps/server/node_modules/.bin/tsx', os.path.join(HERE, 'dump-layout.ts')],
                       input=json.dumps(cfgs), capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def sheet(cfgs, out, cols=6, S=220, labels=None, bounds=True):
    d = layouts(cfgs)
    rows = (len(cfgs) + cols - 1) // cols
    img = Image.new('RGBA', (cols * (S + 10) + 10, rows * (S + 10) + 10), (255, 255, 255, 255))
    for i, e in enumerate(d['out']):
        im = render(e, S, show_bounds=bounds, pad_frame=d['fit']['pad'] if bounds else None)
        img.alpha_composite(im, (10 + (i % cols) * (S + 10), 10 + (i // cols) * (S + 10)))
    img.convert('RGB').save(out, quality=88)
    return d


if __name__ == '__main__':
    sheet(json.load(open(sys.argv[1])), sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 6, int(sys.argv[4]) if len(sys.argv) > 4 else 220)
