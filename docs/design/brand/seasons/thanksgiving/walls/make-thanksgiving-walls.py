#!/usr/bin/env python3
"""Thanksgiving wallpapers, CODE-DRAWN at full resolution with the Halloween wall engine
(../../halloween/walls/make-halloween-walls.py): a warm dusk gradient (deep plum-brown to amber), a low golden
horizon glow, a faint harvest-moon glow, very few stars, and a few SMALL faint harvest props only in the margins.
Nothing sits in the content column. Backgrounds never distract.
  python3 docs/design/brand/seasons/thanksgiving/walls/make-thanksgiving-walls.py
  -> wall-<page>.webp (1290 x 2796) and wall-<page>-wide.webp (2400 x 1500)
"""
import importlib.util, os
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('hw', os.path.join(HERE, '..', '..', 'halloween', 'walls', 'make-halloween-walls.py'))
hw = importlib.util.module_from_spec(spec); spec.loader.exec_module(hw)
PROPS = os.path.join(HERE, '..', 'props')
PAGES = {
    'home':        ((255, 170, 60),  ['halloween/moon-full', 'leaf-maple', 'leaf-oak', 'halloween/pumpkin', 'wheat', 'acorn']),
    'games':       ((255, 150, 50),  ['halloween/moon-full', 'leaf-oak', 'acorn', 'corn', 'leaf-maple']),
    'stats':       ((240, 170, 80),  ['halloween/moon-full', 'acorn', 'leaf-maple', 'wheat', 'apple']),
    'friends':     ((255, 140, 90),  ['halloween/moon-full', 'leaf-maple', 'apple', 'halloween/pumpkin', 'leaf-oak']),
    'leaderboard': ((255, 190, 60),  ['halloween/moon-full', 'leaf-oak', 'leaf-maple', 'wheat', 'acorn']),
}
SKY = ((30, 14, 30), (58, 24, 34), (86, 40, 26))
if __name__ == '__main__':
    for page in PAGES:
        for size, suffix in ((hw.PORTRAIT, ''), (hw.WIDE, '-wide')):
            out = os.path.join(HERE, f'wall-{page}{suffix}.webp')
            hw.wallpaper(size, page, pages=PAGES, props_dir=PROPS, sky=SKY, tint=(46, 20, 24), tag='thanksgiving', star_density=0.35,
                         moon_glow=(255, 200, 120)).save(out, 'WEBP', quality=92, method=6)
            print(out)
