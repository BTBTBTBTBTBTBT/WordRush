#!/usr/bin/env python3
"""Write bodies.<id>.hands (the measured hand ellipses [cx, cy, rx, ry], body units) into the three manifests for the
bodies that have none (the 17 new 2.8 bodies; item 50). The v3 wrap-line tests read them (avatar-layout.test.ts,
apps/web/lib/avatar-wrap-hoops.test.ts) to prove no wrap layer crosses an arm.

  python3 integration/write-body-hands.py
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
LMS = json.load(open(os.path.join(HERE, 'landmarks.json')))['bodies']
for p in ('packages/core/src/avatar-parts.json', 'apps/ios/Wordocious/Resources/avatar-parts.json',
          'apps/android/app/src/main/assets/avatar-parts.json'):
    path = os.path.join(REPO, p)
    d = json.load(open(path))
    n = 0
    for bid, b in d['bodies'].items():
        if 'hands' in b or bid not in LMS or '@' in bid:
            continue
        arms = LMS[bid]['arms']
        if 'L' not in arms or 'R' not in arms:
            continue
        b['hands'] = {s: [round(v, 4) for v in arms[s]['hand']] for s in 'LR'}
        n += 1
    with open(path, 'w') as f:
        json.dump(d, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(p, n)
