#!/usr/bin/env python3
"""TITLE-INVENTORY → cast-color titles via the API (gen-titles.sh), 4 per sheet; each sheet split into bands.
A title that wrapped onto two lines shows up as extra bands — listed for a local one-line join.
  python3 run-inventory.py <1|2>   (priority)"""
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
HEX = {'gold': 'golden yellow #EEB249', 'slate': 'slate grey #8E92AA', 'orange': 'orange #EDA343', 'purple': 'purple #8530E9',
       'blue': 'blue #2F67E5', 'teal': 'teal #3FB0BA', 'green': 'green #4FB968', 'pink': 'pink #DE47A0'}
pri = sys.argv[1]
inv = open(os.path.join(HERE, '..', '..', 'TITLE-INVENTORY.md')).read()
sec = inv.split('## Priority 1')[1].split('## Priority 2')[0] if pri == '1' else inv.split('## Priority 2')[1].split('## Quick wins')[0]
rows = re.findall(r'^\| (\S+) \| (.+?) \| (\w+) \|$', sec, re.M)
rows = [r for r in rows if r[0] != 'Slug']
todo = [r for r in rows if not os.path.exists(os.path.join(HERE, r[0] + '.png'))]
for i in range(0, len(todo), 4):
    sheet = todo[i:i + 4]
    name = f'inv{pri}-{i // 4 + 1}'
    words = ' / '.join(f'{t} ({HEX[c]})' for _, t, c in sheet)
    r = subprocess.run([os.path.join(HERE, 'gen-titles.sh'), name, words], capture_output=True, text=True,
                       env={**os.environ, 'FID': 'high'})
    print(name, r.stdout.strip(), r.stderr.strip()[-300:]); sys.stdout.flush()
    if r.returncode:
        break
    json.dump([s for s, _, _ in sheet], open(os.path.join(HERE, 'raw', name + '.json'), 'w'))
