#!/usr/bin/env python3
"""POSE CONTACT SHEET (10-09): bodies (rows) x poses (columns), drawn from the SHIPPED rig layers
(rigs/<body>/layers/{feet,base,armL,armR}.png) + the SHIPPED avatar-poses.json through rig-body.py's pose_mats
(the reference of core avatarPoseMatrices), so what you see is what the apps draw.

    /opt/homebrew/bin/python3.12 integration/pose-sheet.py out/poses/before-1.jpg star classic tall bean ...
    options: --cell 150  --poses-json <path>  --color '#7c3aed'  --code-poses (adds the podium 'clap')
"""
import argparse, importlib.util, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
spec = importlib.util.spec_from_file_location('rigbody', os.path.join(HERE, 'rig-body.py'))
RB = importlib.util.module_from_spec(spec); spec.loader.exec_module(RB)
M, U, CW = RB.M, RB.U, RB.CW

CLAP = {'arms': {'L': {'rot': -66, 'dx': -0.1, 'dy': 0.01}, 'R': {'rot': -66, 'dx': -0.1, 'dy': 0.01}}, 'body': {'sx': 0.985}}


def load_layers(body, layers_dir=None):
    d = os.path.join(layers_dir or RB.OUT, body, 'layers')
    out = {}
    for n in ('feet', 'base', 'armL', 'armR'):
        im = np.asarray(Image.open(os.path.join(d, n + '.png')).convert('RGBA')).astype(np.float32)
        c = np.zeros((CW, CW, 4), np.float32)
        c[M:M + U, M:M + U] = im
        out[n] = c
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out'); ap.add_argument('bodies', nargs='+')
    ap.add_argument('--cell', type=int, default=150)
    ap.add_argument('--poses-json', default=RB.POSES_JSON)
    ap.add_argument('--layers-dir', default=None)
    ap.add_argument('--color', default='#7c3aed')
    ap.add_argument('--code-poses', action='store_true')
    a = ap.parse_args()
    data = json.load(open(a.poses_json))
    P = dict(data['poses'])
    if a.code_poses:
        P['clap'] = CLAP
    names = ['rest'] + list(P)
    T_ = a.cell
    lab = 70
    im = Image.new('RGB', (lab + T_ * len(names), 20 + T_ * len(a.bodies)), (40, 38, 64))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(RB.rig.NUNITO, 14)
    for i, n in enumerate(names):
        d.text((lab + i * T_ + 6, 2), n, fill=(230, 226, 255), font=f)
    for r, b in enumerate(a.bodies):
        d.text((4, 20 + r * T_ + T_ // 2 - 8), b, fill=(255, 220, 120), font=f)
        R = dict(layers=load_layers(b, a.layers_dir), rig=data['rigs'][b])
        for i, n in enumerate(names):
            arr = RB.render_pose(R, {} if n == 'rest' else P[n], a.color)
            t = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA').crop((M - U // 5, M - U // 5, M + U + U // 5, M + U + U // 8))
            t.thumbnail((T_ - 6, T_ - 6), Image.LANCZOS)
            bg = Image.new('RGBA', t.size, (250, 246, 255, 255))
            bg.alpha_composite(t)
            im.paste(bg.convert('RGB'), (lab + i * T_ + 3, 20 + r * T_ + 3))
    im.save(a.out, quality=88)
    print('wrote', a.out)


if __name__ == '__main__':
    main()
