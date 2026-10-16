#!/usr/bin/env python3
"""Render a seasonal wall in four times of day with the v2 engines (same scene, tod parameter).
   python3 render-walls.py [thanksgiving|halloween] [page ...] [tod ...]  -> <season>-<page>-<morning|day|evening|night>.webp (1290 x 2796)
   defaults: thanksgiving, page home, all four times. Night is byte-identical to the shipped wall for both seasons."""
import importlib.util, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
TODS = ['morning', 'day', 'evening', 'night']
season = next((a for a in sys.argv[1:] if a in ('thanksgiving', 'halloween')), 'thanksgiving')
if season == 'halloween':
    path, render = os.path.join(HERE, '..', 'halloween', 'walls', 'make-halloween-walls-v2.py'), lambda m, page, tod: m.midnight(m.PORTRAIT, page, True, tod)
else:
    path, render = os.path.join(HERE, '..', 'thanksgiving', 'walls', 'make-thanksgiving-walls-v2.py'), lambda m, page, tod: m.harvest(m.PORTRAIT, page, tod)
spec = importlib.util.spec_from_file_location('walls', path)
walls = importlib.util.module_from_spec(spec); spec.loader.exec_module(walls)
pages = [a for a in sys.argv[1:] if a in walls.HERO] or ['home']
tods = [a for a in sys.argv[1:] if a in TODS] or TODS
for page in pages:
    for tod in tods:
        t = time.time()
        im = render(walls, page, tod)
        im.save(os.path.join(HERE, f'{season}-{page}-{tod}.webp'), 'WEBP', quality=92, method=6)
        print(season, page, tod, f'{time.time()-t:.1f}s', flush=True)
