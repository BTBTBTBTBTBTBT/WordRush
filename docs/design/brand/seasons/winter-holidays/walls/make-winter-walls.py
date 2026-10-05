#!/usr/bin/env python3
"""Winter holidays wallpapers (10-05), CODE-DRAWN at full resolution with the Halloween wall engine
(../../halloween/walls/make-halloween-walls.py): a deep winter-night gradient (midnight navy to soft blue), a
cool snow-glow at the horizon, a few stars, and a few SMALL faint winter props (snowflakes, a star,
a pine branch, a candle, mittens) only in the margins. Inclusive winter framing; nothing in the content column.
  python3 docs/design/brand/seasons/winter-holidays/walls/make-winter-walls.py
  -> wall-<page>.webp (1290 x 2796) and wall-<page>-wide.webp (2400 x 1500)
"""
import importlib.util, os
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('hw', os.path.join(HERE, '..', '..', 'halloween', 'walls', 'make-halloween-walls.py'))
hw = importlib.util.module_from_spec(spec); spec.loader.exec_module(hw)
PROPS = os.path.join(HERE, '..', 'props')
PAGES = {
    'home':        ((150, 200, 255), ['snowflake', 'star', 'pine-branch', 'snowflake', 'candle']),
    'games':       ((140, 190, 255), ['snowflake', 'ornament', 'snowflake', 'mittens']),
    'stats':       ((160, 200, 240), ['snowflake', 'star', 'pine-branch', 'snowflake']),
    'friends':     ((190, 180, 255), ['snowflake', 'mittens', 'candle', 'snowflake']),
    'leaderboard': ((170, 210, 255), ['star', 'snowflake', 'ornament', 'snowflake']),
}
SKY = ((10, 16, 40), (22, 36, 78), (44, 70, 120))
if __name__ == '__main__':
    for page in PAGES:
        for size, suffix in ((hw.PORTRAIT, ''), (hw.WIDE, '-wide')):
            out = os.path.join(HERE, f'wall-{page}{suffix}.webp')
            hw.wallpaper(size, page, pages=PAGES, props_dir=PROPS, sky=SKY, tint=(16, 24, 52), tag='winter-holidays', star_density=0.5,
                         moon_glow=(200, 225, 255)).save(out, 'WEBP', quality=92, method=6)
            print(out)
