#!/usr/bin/env python3
"""Inventory of the 2.8 item art (FRIDAY-QUEUE 5b / 51) → integration/new-items-plan.json.

Reads every docs/design/brand/2.8/items/<pack>/README.md table (piece, slot, colorable parts) and the art that exists
(`hires/<piece>.png` wins over `out/<piece>.png`, per the art driver), and proposes the rule KIND per slot
(INTEGRATION.md "How to add a new item": hat, face, pendant, necklace, drape, cape, backpack, wings, tail, held, belt,
apron, shoes, buddy, brows, extra). The plan is the checklist for the next step (a rule per piece, compare.py / audit.py
--guards on all 30 bodies, manifest + art ×3). Composite cells (one image, two pieces) are flagged `split`.

  python3 integration/new-items-plan.py
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
ITEMS = os.path.join(REPO, 'docs', 'design', 'brand', '2.8', 'items')

# slot (the README's words) → (config field in the maker, rule kind, tab-order group). The sort key of an item in the maker
# is (field, group, pack order): like items sit together (wings with wings, caps with caps, helmets with helmets).
SLOT = {
    'head': ('head', 'hat', 'hats'), 'hair': ('head', 'hat', 'hair'), 'face': ('face', 'face', 'face'),
    'neck': ('wrap', 'pendant', 'neck'), 'wrap': ('wrap', 'drape', 'wraps'), 'back': ('neck', 'wings', 'back'),
    'held': ('held', 'held', 'held'), 'feet': ('feet', 'shoes', 'feet'), 'pet': ('pet', 'buddy', 'buddies'),
    'extra': ('extra', 'extra', 'extra'),
}
SPLIT = {  # one image, several pieces (cut in code)
    ('careers', 'scientist-kit'), ('careers', 'pilot-cap-aviators'), ('careers', 'beret-palette'),
    ('careers', 'detective-cap-magnifier'), ('basketball-golf', 'headband-wristbands'),
}


def parse(readme):
    rows = []
    for line in open(readme):
        m = re.match(r'\|\s*`out/([^`]+)\.png`\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|', line)
        if m:
            rows.append((m.group(1), m.group(2).strip().lower(), m.group(3).strip()))
    return rows


def main():
    plan, missing = [], []
    for pack in sorted(os.listdir(ITEMS)):
        rd = os.path.join(ITEMS, pack, 'README.md')
        if not os.path.exists(rd):
            continue
        for order, (piece, slot, colorable) in enumerate(parse(rd)):
            slots = [s.strip() for s in re.split(r'[+/]', slot)]
            fld = SLOT.get(slots[0])
            hi = os.path.join('hires', piece + '.png')
            art = hi if os.path.exists(os.path.join(ITEMS, pack, hi)) else os.path.join('out', piece + '.png')
            if not os.path.exists(os.path.join(ITEMS, pack, art)):
                missing.append(f'{pack}/{piece}')
                continue
            plan.append(dict(
                id=f'{pack}-{piece}', pack=pack, piece=piece, art=f'{pack}/{art}', hires=art.startswith('hires'),
                slot=slot, field=fld[0] if fld else None, kind=fld[1] if fld else None, group=fld[2] if fld else None,
                order=order, colorable=None if colorable.lower().startswith('no') else colorable,
                split=(pack, piece) in SPLIT, parts=slots if len(slots) > 1 else None,
            ))
    json.dump(dict(note='integration/new-items-plan.py: the 2.8 item art inventory + the proposed rule kind per piece.',
                   items=plan, missing=missing), open(os.path.join(HERE, 'new-items-plan.json'), 'w'), indent=1)
    by = {}
    for p in plan:
        by.setdefault(p['kind'], 0)
        by[p['kind']] += 1
    print(len(plan), 'pieces,', sum(p['hires'] for p in plan), 'hires,', sum(p['split'] for p in plan), 'to split;', by, 'missing:', missing)


if __name__ == '__main__':
    main()
