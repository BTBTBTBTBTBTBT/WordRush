#!/usr/bin/env python3
"""The living-wallpaper goose (founder 10-16: "animate that V of ducks like we do with the bats"): ONE goose from the
wall engine's goose() silhouette (make-thanksgiving-walls-v2.py), wings raised, in the wall's flyer ink
(16, 7, 16) at the wall's 0.92 alpha, on transparency. The app builds the V in code (theme registry
`seasonal.thanksgiving.ambient.flock`: lead + two trailing arms, the same 0.92 L step / 0.30 spread as geese_v) and
beats each goose's wings with the bats' scaleY squash, so a single pose is all the sprite needs.

192 x 96 px = 3x the largest on-screen goose (registry size max 48 pt wide, aspect 2:1), like ambient-bat.
Ships like ambient-bat: web public/ambient/goose.webp, Android drawable-nodpi/ambient_goose.webp,
iOS Assets.xcassets/ambient-goose.imageset (PNG, lossy asset compression per the season playbook).

  python3 make-goose-sprite.py          -> writes the three app copies + goose.png beside this script
"""
import importlib.util, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, *(['..'] * 6)))
spec = importlib.util.spec_from_file_location('walls', os.path.join(HERE, 'make-thanksgiving-walls-v2.py'))
walls = importlib.util.module_from_spec(spec)
spec.loader.exec_module(walls)

W, H = 192, 96
L = 108                      # goose length unit: the body spans x -0.70 L .. 1.00 L, y -0.70 L (raised wing tip) .. 0.12 L
PAD = 3
INK = (16, 7, 16)
ALPHA = 0.92


def goose_sprite():
    m, d = walls.mask_layer(W, H)
    walls.goose(d, PAD + 0.70 * L, PAD + 0.70 * L, L, -0.15, heading=1)   # flap -0.15: wing swept up + back (the squash beats it)
    a = walls.down(m, W, H) * ALPHA
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = INK
    rgba[..., 3] = (a * 255).round().astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


if __name__ == '__main__':
    im = goose_sprite()
    im.save(os.path.join(HERE, 'goose.png'))
    web = os.path.join(ROOT, 'apps', 'web', 'public', 'ambient', 'goose.webp')
    droid = os.path.join(ROOT, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi', 'ambient_goose.webp')
    iset = os.path.join(ROOT, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets', 'ambient-goose.imageset')
    im.save(web, 'WEBP', lossless=True, method=6)
    im.save(droid, 'WEBP', lossless=True, method=6)
    os.makedirs(iset, exist_ok=True)
    im.save(os.path.join(iset, 'ambient-goose.png'), optimize=True)
    with open(os.path.join(iset, 'Contents.json'), 'w') as f:
        json.dump({'images': [{'filename': 'ambient-goose.png', 'idiom': 'universal'}],
                   'info': {'author': 'xcode', 'version': 1},
                   'properties': {'compression-type': 'lossy'}}, f, indent=2)
        f.write('\n')
    bbox = im.getchannel('A').getbbox()
    print('goose', im.size, 'alpha bbox', bbox, '->', web, droid, iset)
