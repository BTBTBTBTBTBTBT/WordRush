#!/usr/bin/env python3
"""Give the rigged mittens an ARM (10-09, founder: "arms read as small detached mittens / pasted flaps").

The rig cut (rig-body.py) leaves each arm layer as the mitten alone, so a raised arm is a hand floating away from the
body. This post-step grows the layer with a SHOULDER-TO-HAND LIMB: the body's own art (pixels, shading, tint) inside a
soft capsule from the shoulder pivot to the hand center. At rest the capsule lies over the same art in the base layer
(identical pixels), so the rest pose is unchanged; in a pose the limb swings out with the hand, a body-colored arm
joined to the body at the shoulder.

    /opt/homebrew/bin/python3.12 integration/limb-extend.py <out_dir> body [body ...] [--radius 0.034] [--ship]

Reads rigs/<body>/layers/arm{L,R}.png (+ avatar-poses.json rigs), writes <out_dir>/<body>/layers/arm{L,R}.png.
--ship also writes the web / iOS / Android art (like rig-body.py --ship) and rigs/<body>/layers.
"""
import argparse, importlib.util, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np
from PIL import Image
from scipy import ndimage
spec = importlib.util.spec_from_file_location('rigbody', os.path.join(HERE, 'rig-body.py'))
RB = importlib.util.module_from_spec(spec); spec.loader.exec_module(RB)
M, U = RB.M, RB.U
FEATHER = 5.0


def capsule(p, q, r, n=U):
    """soft capsule mask (0..1) in the body square, p/q/r in px."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    p = np.array(p, np.float32); q = np.array(q, np.float32)
    d = q - p
    t = np.clip(((xx - p[0]) * d[0] + (yy - p[1]) * d[1]) / max(float(d @ d), 1e-6), 0, 1)
    dist = np.hypot(xx - (p[0] + t * d[0]), yy - (p[1] + t * d[1]))
    # fades in over the first 45% from the shoulder: a raised arm still leaves the body edge solid, an arm swung IN over
    # the chest (hug / hips / clap) leaves only a short stub beside the hand, never a band across the letter or face
    return np.clip((r - dist) / FEATHER, 0, 1) * np.clip(t / 0.45, 0, 1)


def extend(body, rg, art_sq, layers_dir, radius):
    out = {}
    for s in 'LR':
        arm = np.asarray(Image.open(os.path.join(layers_dir, body, 'layers', f'arm{s}.png')).convert('RGBA')).astype(np.float32)
        r = rg[f'arm{s}']
        pv = np.array(r['pivot']) * U
        hd = np.array(r['hand']) * U
        cap = capsule(pv, hd, radius * U)
        # the limb: the body art under the capsule, over the mitten where the mitten has no pixel
        lim = art_sq.copy()
        lim[..., 3] = art_sq[..., 3] * cap
        ma = arm[..., 3:4] / 255
        la = lim[..., 3:4] / 255
        oa = ma + la * (1 - ma)
        rgb = np.where(oa > 0, (arm[..., :3] * ma + lim[..., :3] * la * (1 - ma)) / np.maximum(oa, 1e-6), 0)
        out[s] = np.concatenate([rgb, oa * 255], -1)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out'); ap.add_argument('bodies', nargs='+')
    ap.add_argument('--radius', type=float, default=0.034)
    ap.add_argument('--ship', action='store_true')
    ap.add_argument('--src', default=RB.OUT, help='dir holding <body>/layers (default rigs/)')
    a = ap.parse_args()
    data = json.load(open(RB.POSES_JSON))
    for b in a.bodies:
        art = np.asarray(RB.rig.body_art(b)).astype(np.float32)[M:M + U, M:M + U]
        res = extend(b, data['rigs'][b], art, a.src, a.radius)
        d = os.path.join(a.out, b, 'layers')
        os.makedirs(d, exist_ok=True)
        for s in 'LR':
            im = Image.fromarray(np.clip(res[s], 0, 255).astype(np.uint8), 'RGBA')
            im.save(os.path.join(d, f'arm{s}.png'), optimize=True)
            for n in ('base', 'feet'):
                src = os.path.join(a.src, b, 'layers', n + '.png')
                dst = os.path.join(d, n + '.png')
                if src != dst:
                    Image.open(src).save(dst)
            if a.ship:
                RB.ship_art(f'art-av-body-{b}-arm{s}', im)
        print(b, flush=True)


if __name__ == '__main__':
    main()
