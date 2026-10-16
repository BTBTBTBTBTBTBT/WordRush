#!/usr/bin/env python3
"""Render the Halloween walls for morning / day / evening (night = the shipped wall-<page>.webp) with the v2 midnight engine.
   python3 make-halloween-walls-tod.py [page ...] [tod ...]  -> wall-<page>-<tod>[-wide].webp (portrait + wide)
   Shipped by docs/design/brand/ship-art.py --seasons as art-wall-halloween-<page>-<tod>[-wide]."""
import importlib.util, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('walls', os.path.join(HERE, 'make-halloween-walls-v2.py'))
walls = importlib.util.module_from_spec(spec); spec.loader.exec_module(walls)
TODS = ['morning', 'day', 'evening']
pages = [a for a in sys.argv[1:] if a in walls.PAGES] or walls.PAGES
tods = [a for a in sys.argv[1:] if a in TODS] or TODS
for page in pages:
    for tod in tods:
        for size, suf in ((walls.PORTRAIT, ''), (walls.WIDE, '-wide')):
            t = time.time()
            walls.midnight(size, page, True, tod).save(os.path.join(HERE, f'wall-{page}-{tod}{suf}.webp'), 'WEBP', quality=92, method=6)
            print(page, tod, suf or 'portrait', f'{time.time()-t:.1f}s', flush=True)
