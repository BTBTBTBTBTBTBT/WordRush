#!/usr/bin/env python3
"""iOS asset-catalog compression policy (docs/review/app-size/REPORT.md).

Every raster imageset in apps/ios/Wordocious/Resources/Assets.xcassets declares its actool `compression-type`
in its Contents.json `properties`:

    "lossy"     HEVC (HEIF) with alpha. ~70% smaller Assets.car than the default lossless deepmap2.
    "lossless"  kept exactly as the PNG. Used ONLY where lossy is wrong:
                - `bubble-*`: the glyph atlas is a three-channel TINT MAP (R/G/B carry data, not colour,
                  decoded per pixel by BubbleGlyphTint, byte-identical to web/Android; see
                  scripts/build-bubble-atlas.py and packages/core/src/bubble-text.test.ts);
                - any fully opaque image (no alpha): actool encodes those as RGB555 (15-bit colour) when lossy,
                  which bands on gradients, whereas an image with an alpha channel takes the HEVC path.

Skipped (no property written): vector imagesets (svg / preserves-vector-representation), multi-scale sets
(launch-w), non-PNG sources (the Wallpapers catalog is JPEG already, opaque, 2 MB).

    scripts/ios-asset-compression.py            apply the policy to every imageset (idempotent)
    scripts/ios-asset-compression.py --check    exit 1 listing any imageset with no/wrong compression-type
                                                (run by packages/core/src/asset-size-guards.test.ts in CI)

Run it after any ship script (ship-art.py, ship-family.py, ...) writes new imagesets; they emit plain
Contents.json files. The "wrong" half of --check (an opaque image marked lossy) needs Pillow; without it
only the "missing" half runs.
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CATALOG = os.path.join(ROOT, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')

# Imagesets whose pixels are data, not colour (name prefixes). Always lossless.
DATA_PREFIXES = ('bubble-',)

try:
    from PIL import Image
except ImportError:  # the CI guard still catches missing properties without Pillow
    Image = None


def is_opaque(path):
    """True when the PNG has no alpha channel or every pixel is fully opaque."""
    im = Image.open(path)
    if im.mode in ('RGBA', 'LA', 'PA'):
        return im.getchannel('A').getextrema()[0] == 255
    if im.mode == 'P' and 'transparency' in im.info:
        return im.convert('RGBA').getchannel('A').getextrema()[0] == 255
    return True


def wanted(name, iset_dir, images):
    """The compression-type this imageset should declare, or None to leave it alone."""
    files = [i.get('filename') for i in images]
    if len(images) != 1 or not files[0] or not files[0].lower().endswith('.png'):
        return None, 'not a single PNG'
    # 10-16 (2.9 rollback): lossy (HEVC) broke images with large faint-alpha areas — the button light maps
    # (art-fam-lm-*) drew as an opaque white haze over every key ("unreadable, unplayable"), and 600+ mascot pieces carry
    # the same soft shading. Everything ships LOSSLESS again until a per-image visual gate exists (see REPORT.md).
    if name.startswith(DATA_PREFIXES):
        return 'lossless', 'data atlas'
    return 'lossless', None


def imagesets(catalog):
    for d in sorted(os.listdir(catalog)):
        if d.endswith('.imageset'):
            yield d[:-len('.imageset')], os.path.join(catalog, d)


def main():
    check = '--check' in sys.argv
    catalog = CATALOG
    for a in sys.argv[1:]:
        if a.startswith('--catalog='):
            catalog = a.split('=', 1)[1]
    changed, bad, kept = [], [], []
    counts = {'lossy': 0, 'lossless': 0, 'skipped': 0}
    for name, d in imagesets(catalog):
        cj = os.path.join(d, 'Contents.json')
        j = json.load(open(cj))
        want, why = wanted(name, d, j.get('images', []))
        if want is None:
            counts['skipped'] += 1
            continue
        have = j.get('properties', {}).get('compression-type')
        counts[want] += 1
        if why:
            kept.append(f'{name}: lossless ({why})')
        if check:
            if have is None:
                bad.append(f'{name}: no compression-type (want {want})')
            elif have == 'lossy' and want == 'lossless':
                bad.append(f'{name}: marked lossy but must stay lossless ({why})')
            elif have not in ('lossy', 'lossless'):
                bad.append(f'{name}: unexpected compression-type {have!r}')
            continue
        if have != want:
            props = j.setdefault('properties', {})
            props['compression-type'] = want
            with open(cj, 'w') as f:
                json.dump(j, f, indent=2)
            changed.append(name)
    print(f"imagesets: {counts['lossy']} lossy, {counts['lossless']} lossless, {counts['skipped']} skipped (vector / multi-scale / non-PNG)")
    for k in kept:
        if not k.startswith('bubble-'):
            print('  kept lossless:', k)
    n_bubble = sum(1 for k in kept if k.startswith('bubble-'))
    if n_bubble:
        print(f'  kept lossless: {n_bubble} bubble-* glyph tint maps (data atlas)')
    if check:
        if bad:
            print(f'\n{len(bad)} imageset(s) need attention. Run: python3 scripts/ios-asset-compression.py')
            for b in bad[:40]:
                print('  ', b)
            if len(bad) > 40:
                print(f'   ... and {len(bad) - 40} more')
            sys.exit(1)
        print('ok: every raster imageset declares its compression-type')
    else:
        print(f'updated {len(changed)} Contents.json')


if __name__ == '__main__':
    main()
