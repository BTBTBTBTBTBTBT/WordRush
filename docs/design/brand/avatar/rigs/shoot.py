#!/usr/bin/env python3
"""Screenshot the rig contact sheets (sheets/*.html, from apps/web/scripts/pose-sheets.ts) in headless Chromium."""
import glob, os
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
exe = '/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe, args=['--allow-file-access-from-files'])
    pg = b.new_page(viewport={'width': 1500, 'height': 900}, device_scale_factor=1)
    for f in sorted(glob.glob(os.path.join(HERE, 'sheets', '*.html'))):
        pg.goto('file://' + f)
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f.replace('.html', '.jpg'), full_page=True, type='jpeg', quality=82)
        print('shot', f)
    b.close()
