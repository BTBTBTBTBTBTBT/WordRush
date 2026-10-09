#!/usr/bin/env python3
"""FRIDAY-QUEUE item 26: export the Halloween icon (option A) to every platform size.

From the repo root:
  python3 docs/design/brand/2.8/halloween-icon/make-icons.py            # write the Halloween icon everywhere
  python3 docs/design/brand/2.8/halloween-icon/make-icons.py --restore  # ~Nov 1: put the normal icon back
  python3 docs/design/brand/2.8/halloween-icon/make-icons.py --backup   # (once) copy the current icons into normal-backup/
"""
import os, shutil, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../../..'))
BAK = os.path.join(HERE, 'normal-backup')
SRC = os.path.join(HERE, 'AppIcon-Halloween-1024.png')
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
IOS = 'apps/ios/Wordocious/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png'
RES = 'apps/android/app/src/main/res'
WEB = 'apps/web/public'
PLAY = 'docs/design/brand/logo/upload/play-hi-res-icon-512.png'
ADAPT = 'docs/design/brand/logo/android-adaptive-1024.png'
WEB_FILES = ('favicon.ico', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png')
AND_FILES = ('ic_launcher.png', 'ic_launcher_bg.png', 'ic_launcher_round.png')


def p(*a):
    return os.path.join(ROOT, *a)


def copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy(src, dst)


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)


def backup():
    copy(p(IOS), os.path.join(BAK, 'ios/AppIcon-1024.png'))
    for d in DENS:
        for n in AND_FILES:
            copy(p(RES, f'mipmap-{d}', n), os.path.join(BAK, f'android/mipmap-{d}', n))
    for n in WEB_FILES:
        copy(p(WEB, n), os.path.join(BAK, 'web', n))
    copy(p(PLAY), os.path.join(BAK, 'play/play-hi-res-icon-512.png'))
    copy(p(ADAPT), os.path.join(BAK, 'android/android-adaptive-1024.png'))
    print('backed up the normal icon to', BAK)


def restore():
    copy(os.path.join(BAK, 'ios/AppIcon-1024.png'), p(IOS))
    for d in DENS:
        for n in AND_FILES:
            copy(os.path.join(BAK, f'android/mipmap-{d}', n), p(RES, f'mipmap-{d}', n))
    for n in WEB_FILES:
        copy(os.path.join(BAK, 'web', n), p(WEB, n))
    copy(os.path.join(BAK, 'play/play-hi-res-icon-512.png'), p(PLAY))
    copy(os.path.join(BAK, 'android/android-adaptive-1024.png'), p(ADAPT))
    print('restored the normal icon')


def adaptive_bg(src, safe=0.70):
    """Adaptive layer: the whole character fits the 72/108 safe zone. The margin is the art itself,
    scaled up and heavily blurred (like the normal icon's backdrop); the sharp art sits on top
    with a wide feathered edge so there is no visible seam."""
    n = src.width
    inner = int(n * safe)
    pad = (n - inner) // 2
    canvas = src.filter(ImageFilter.GaussianBlur(n * 0.06))
    small = src.resize((inner, inner), Image.LANCZOS)
    mask = Image.new('L', (inner, inner), 0)
    f = int(inner * 0.07)
    ImageDraw.Draw(mask).rectangle((f, f, inner - f - 1, inner - f - 1), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(f * 0.45))
    canvas.paste(small, (pad, pad), mask)
    return canvas


def export():
    src = Image.open(SRC).convert('RGB')
    save(src, p(IOS))
    adapt = adaptive_bg(src)
    adapt.save(p(ADAPT))
    for d, k in DENS.items():
        s = int(round(48 * k))
        legacy = src.resize((s, s), Image.LANCZOS)
        save(legacy, p(RES, f'mipmap-{d}', 'ic_launcher.png'))
        rnd = legacy.convert('RGBA')
        m = Image.new('L', (s * 4, s * 4), 0)
        ImageDraw.Draw(m).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
        rnd.putalpha(m.resize((s, s), Image.LANCZOS))
        save(rnd, p(RES, f'mipmap-{d}', 'ic_launcher_round.png'))
        b = int(round(108 * k))
        save(adapt.resize((b, b), Image.LANCZOS), p(RES, f'mipmap-{d}', 'ic_launcher_bg.png'))
    for n, s in (('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)):
        save(src.resize((s, s), Image.LANCZOS), p(WEB, n))
    src.save(p(WEB, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    save(src.resize((512, 512), Image.LANCZOS), p(PLAY))
    print('Halloween icon exported')


if '--backup' in sys.argv:
    backup()
elif '--restore' in sys.argv:
    restore()
else:
    export()
