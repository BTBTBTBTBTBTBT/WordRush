"""The 2.8 item packs as DATA (FRIDAY-QUEUE 5b/51): integration/new-items-spec.json → rule table entries, held / shoe specs.

rules.py calls add_rules() while it builds the rule table and register() once its drawing helpers are imported; the
ingest script (new-items.py) writes the art + manifest + option lists from the same spec."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
SPEC_PATH = os.path.join(HERE, 'new-items-spec.json')
SPEC = json.load(open(SPEC_PATH)) if os.path.exists(SPEC_PATH) else {'items': [], 'collections': {}, 'withheld': {}}
SPECS = SPEC['items']


def add_rules(rules, R, HELD, BUDDY):
    """One rule per item the manifest carries but build_rules() does not cover (held / shoes / buddy / pendant; hats and
    face items get theirs from their manifest slot)."""
    for sp in SPECS:
        key = 'acc:' + sp['id']
        if key in rules:
            continue
        k = sp['kind']
        if k == 'held':
            rules[key] = HELD(builder='np', tall=bool(sp['held'].get('tall')))
        elif k == 'buddy':
            rules[key] = BUDDY(sp['buddy']['where'], k=sp['buddy']['k'])
        elif k == 'shoes':
            rules[key] = R('shoes', 'each foot box (from the ankle / hip line to the floor)', 'foot width × 1.25',
                           'feet (the torso stays in front of the shoe tops)', 'on the feet', None)
        elif k == 'pendant':
            p = sp['pendant']
            rules[key] = R('pendant', 'the drape (the chain hangs from it): its bottom, else slid toward the left arm',
                           'the biggest of k × shoulder span (100–60%) that clears the face + letter',
                           'neckFront (one art); under the letter when nothing clears', 'below the mouth, off the letter',
                           'necklace drape', k=p['k'], anchor_y=p['anchor_y'], slide=bool(p.get('slide')))


def register(NP, SI):
    """The held grips + shoe crops the builders read (new_pieces.HELD, ship-integrated.SHOE_KEEP)."""
    for sp in SPECS:
        if sp['kind'] == 'held':
            h = sp['held']
            NP.HELD[sp['id']] = dict(grip=tuple(h['grip']), w=h['w'], rot=h['rot'], side=h['side'], set=sp['pack'].title(),
                                     label=sp['label'])
        elif sp['kind'] == 'shoes':
            SI.SHOE_KEEP[sp['id']] = sp.get('shoe_keep', 0.62)
            NP.SHOE_KEEP[sp['id']] = sp.get('shoe_keep', 0.62)
