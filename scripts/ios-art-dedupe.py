#!/usr/bin/env python3
"""iOS: de-duplicate byte-identical avatar parts (docs/review/app-size/REPORT.md, "Applied 10-16").

The avatar maker exports e.g. the pets, brows and extras once per body shape although the pixels do not change with
the body (`art-av-acc-puppy-{egg,bunnyear,can,...}-pet` are the same file). An asset catalog has no aliases, so:

  - within `art-av-*` the imagesets of an identical group keep ONE imageset (the alphabetically first name; a name
    that is already an alias target keeps priority) and the others are removed;
  - apps/ios/Wordocious/Resources/art-aliases.json maps  removed name -> kept name.  The app resolves a name through
    it in the only places that load avatar layer art (ArtAsset.exists, MascotArtCache.uiImage / image; the painter,
    the living mascot, the podium ink measure and the share images all go through them), and the Swift coverage test
    (Tests/AvatarArtCoverageTests.swift) reads the same file.

    scripts/ios-art-dedupe.py            apply (idempotent; run after any ship script re-exports avatar art; the order
                                         against scripts/ios-asset-compression.py does not matter)
    scripts/ios-art-dedupe.py --check    exit 1 when an un-aliased duplicate exists or the map is stale
                                         (packages/core/src/asset-size-guards.test.ts)
"""
import glob
import hashlib
import json
import os
import shutil
import sys
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RES = os.path.join(ROOT, 'apps', 'ios', 'Wordocious', 'Resources')
CATALOG = os.path.join(RES, 'Assets.xcassets')
MAP = os.path.join(RES, 'art-aliases.json')
PREFIX = 'art-av-'


def md5(p):
    with open(p, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def groups():
    by = defaultdict(list)
    for d in sorted(glob.glob(os.path.join(CATALOG, PREFIX + '*.imageset'))):
        name = os.path.basename(d)[:-len('.imageset')]
        png = os.path.join(d, name + '.png')
        if os.path.exists(png):
            by[md5(png)].append(name)
    return [sorted(v) for v in by.values() if len(v) > 1]


def read_map():
    return json.load(open(MAP)) if os.path.exists(MAP) else {}


def main():
    check = '--check' in sys.argv
    aliases = read_map()
    if check:
        bad = []
        for g in groups():
            bad.append('byte-identical avatar parts not aliased: ' + ', '.join(g))
        for a, c in aliases.items():
            if os.path.exists(os.path.join(CATALOG, a + '.imageset')):
                bad.append(f'alias {a} shadows a real imageset (a re-export re-created it)')
            if not os.path.exists(os.path.join(CATALOG, c + '.imageset')):
                bad.append(f'alias {a} points at missing imageset {c}')
        if bad:
            print(f'{len(bad)} problem(s). Run: python3 scripts/ios-art-dedupe.py')
            for b in bad[:30]:
                print('  ', b)
            sys.exit(1)
        print(f'ok: no un-aliased duplicate avatar imagesets ({len(aliases)} aliases)')
        return
    targets = set(aliases.values())
    removed, freed = 0, 0
    for g in groups():
        keep = next((n for n in g if n in targets), g[0])
        for n in g:
            if n == keep:
                continue
            d = os.path.join(CATALOG, n + '.imageset')
            freed += os.path.getsize(os.path.join(d, n + '.png'))
            shutil.rmtree(d)
            aliases[n] = keep
            removed += 1
    aliases = {a: c for a, c in aliases.items()
               if not os.path.exists(os.path.join(CATALOG, a + '.imageset')) and os.path.exists(os.path.join(CATALOG, c + '.imageset'))}
    with open(MAP, 'w') as f:
        json.dump(dict(sorted(aliases.items())), f, indent=1, sort_keys=True)
        f.write('\n')
    print(f'removed {removed} duplicate imagesets ({freed / 1e6:.2f} MB of PNG); {len(aliases)} aliases in art-aliases.json')


if __name__ == '__main__':
    main()
