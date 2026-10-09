#!/usr/bin/env python3
"""compress-art.py — shrink the shipped art ×3 with NO visible quality loss (FRIDAY-QUEUE item 44).

Founder rule: compress everything, but any image that fails the quality guard keeps its original byte-for-byte.

What it scans (the three platform art folders ship-art.py writes to):
  iOS      apps/ios/Wordocious/Resources/Assets.xcassets/*.imageset/*.png   (+ AppIcon, launch images)
           apps/ios/Wordocious/Resources/Wallpapers.xcassets/*.imageset/*.jpg (size report only — JPEG re-encodes
           are lossy-on-lossy and the catalog is 1.4 MB)
  Android  apps/android/app/src/main/res/drawable-nodpi/*.webp + *.png
  Web      apps/web/public/art/**/*.webp

Per image:
  1. Size check — longest side vs the largest it can ever be shown. Caps (justified in the report):
       iOS 1320 px   = 440 pt (iPhone 16 Pro Max logical width) × 3 (@3x); art is never wider than the screen
       Android 1440 px = widest common phone (1440 × 3200 xxxhdpi); drawable-nodpi is raw pixels
       web 1500 px   = the widest a game/page title renders on desktop; no srcset today, so one file serves all
     Wallpapers (art-wall-*) are exempt: full phone resolution (1179×2556 / 2400×1500 wide) by design (§19).
  2. Candidate re-encodes (all in memory, nothing in apps/ is touched unless --apply):
       PNG  → oxipng lossless (level 3, safe-chunk strip; bit-exact asserted), or Pillow optimize if oxipng is missing
            → HEIF 4:4:4 lossless (quality -1) and a lossy ladder q95 → q85, chroma 4:4:4 (iOS catalogs accept .heic,
              deployment target is 16.0). AppIcon / launch images stay PNG (App Store rule / launch-screen safety).
            → lossless WebP (bit-exact). Applicable on Android (resources are referenced by name, so .png→.webp is
              transparent); informational on iOS (asset catalogs do not take WebP).
       WebP → the same lossy WebP ladder q92 → q85 at method 6 (the shipped files are q92 m6 from ship-art.py, so
              this is lossy-on-lossy; expect little), lossless WebP for small alpha art (≤ 400 px) if it is smaller.
       web  → AVIF ladder q95 → q85, 4:4:4, speed 6 — informational (would need <picture> wiring).
  3. Quality guard — decoded candidate vs the shipped original:
       SSIM ≥ 0.995 on RGB composited over mid-grey (what the eye sees; RGB under alpha = 0 is invisible and ignored),
       7×7 uniform window, Wang et al. constants, averaged over the three channels; AND max alpha difference ≤ 2.
       Lossless candidates are additionally asserted visibly bit-exact (alpha identical, RGB identical where alpha > 0).
       Anything failing is REJECTED and the original stays.
     Among the candidates that pass, are smaller than the original, and are applicable on that platform, the
     smallest wins. If none qualifies the file is reported as "kept".

Output (dry run, the default):
  docs/audits/art-compression/report.md   — totals per platform, pass/reject counts, top 40 savings, oversize list,
                                            recommended settings
  docs/audits/art-compression/results.json — every file's candidates + guard metrics (the input to --apply)

Usage
  /opt/homebrew/bin/python3.12 docs/design/brand/compress-art.py                 # dry run, all platforms
  … --platform ios,android --limit 50 --jobs 4                                    # quick look
  … --keep DIR                                                                     # also write the winning encodes to DIR for eyeballing
  … --apply                                                                        # WRITE the winners into apps/ (not used yet — founder review first)

Deps: Pillow ≥ 11 (WebP; AVIF if built with libavif), numpy. Optional: pyoxipng (lossless PNG), pillow-heif (HEIF).
  pip install pyoxipng pillow-heif        # both are small wheels
Deterministic: fixed encoder settings, files sorted, no timestamps (the report carries the git HEAD instead).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, dataclass, field

import numpy as np
from PIL import Image, features

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
IOS_WALLS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Wallpapers.xcassets')
DROID = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art')
REPORT_DIR = os.path.join(REPO, 'docs', 'audits', 'art-compression')

SSIM_MIN = 0.995
ALPHA_MAX_DIFF = 2
SIZE_CAP = {'ios': 1320, 'android': 1440, 'web': 1500}
HEIF_LADDER = (95, 92, 90, 88, 85)
WEBP_LADDER = (92, 90, 88, 85)
AVIF_LADDER = (95, 90, 85)
LOSSLESS_WEBP_MAX_SIDE = 400     # lossless WebP only pays off on small, flat-ish alpha art

try:
    import oxipng
    HAVE_OXIPNG = True
except ImportError:          # pragma: no cover
    oxipng = None
    HAVE_OXIPNG = False
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HAVE_HEIF = True
except ImportError:          # pragma: no cover
    HAVE_HEIF = False
HAVE_AVIF = bool(features.check('avif'))
HAVE_WEBP = bool(features.check('webp'))


# ── quality guard ─────────────────────────────────────────────────────────────

def _box(x: np.ndarray, r: int = 3) -> np.ndarray:
    """(2r+1)² uniform (box) filter with edge replication, via integral images — no scipy needed."""
    k = 2 * r + 1
    p = np.pad(x, r, mode='edge')
    c = np.cumsum(np.cumsum(p, axis=0), axis=1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def ssim_rgb(a: np.ndarray, b: np.ndarray) -> float:
    """Mean SSIM over the three channels (7×7 uniform window, K1 = .01, K2 = .03, L = 255), border cropped."""
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    n = 49.0
    cov_norm = n / (n - 1)
    vals = []
    for ch in range(3):
        x, y = a[..., ch], b[..., ch]
        ux, uy = _box(x), _box(y)
        vx = cov_norm * (_box(x * x) - ux * ux)
        vy = cov_norm * (_box(y * y) - uy * uy)
        vxy = cov_norm * (_box(x * y) - ux * uy)
        s = ((2 * ux * uy + c1) * (2 * vxy + c2)) / ((ux * ux + uy * uy + c1) * (vx + vy + c2))
        core = s[3:-3, 3:-3] if min(s.shape) > 6 else s
        vals.append(float(core.mean()))
    return float(np.mean(vals))


def composite_grey(im: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    a = np.asarray(im.convert('RGBA'), dtype=np.float64)
    al = a[..., 3:4] / 255.0
    return a[..., :3] * al + 128.0 * (1.0 - al), a[..., 3]


def visibly_exact(a: Image.Image, b: Image.Image) -> bool:
    """Bit-exact where it can be seen: alpha identical, RGB identical wherever alpha > 0. (libwebp and oxipng may
    rewrite RGB under fully transparent pixels — invisible, and ignored here.)"""
    x = np.asarray(a.convert('RGBA'))
    y = np.asarray(b.convert('RGBA'))
    if x.shape != y.shape or not np.array_equal(x[..., 3], y[..., 3]):
        return False
    vis = x[..., 3] > 0
    return bool(np.array_equal(x[..., :3][vis], y[..., :3][vis]))


def guard(orig: Image.Image, cand: Image.Image) -> tuple[float, int, int]:
    """→ (ssim, max alpha diff, max composited-RGB diff)."""
    o_rgb, o_a = composite_grey(orig)
    c_rgb, c_a = composite_grey(cand)
    return (round(ssim_rgb(o_rgb, c_rgb), 5),
            int(np.abs(o_a - c_a).max()),
            int(np.rint(np.abs(o_rgb - c_rgb)).max()))


# ── candidates ────────────────────────────────────────────────────────────────

@dataclass
class Candidate:
    kind: str            # e.g. png-oxipng, heif-q92, webp-q90, webp-lossless, avif-q90
    ext: str             # file extension the candidate would ship with
    size: int
    ssim: float
    alpha_diff: int
    max_diff: int
    passed: bool
    applicable: bool     # can this platform ship this format in place?
    note: str = ''


@dataclass
class Result:
    platform: str
    path: str            # repo-relative
    width: int
    height: int
    mode: str
    size: int
    oversize: bool
    candidates: list = field(default_factory=list)
    chosen: str = ''     # kind of the winning candidate, '' = kept original
    chosen_size: int = 0
    error: str = ''


def _decode(data: bytes) -> Image.Image:
    im = Image.open(io.BytesIO(data))
    im.load()
    return im


def _check(orig: Image.Image, data: bytes, kind: str, ext: str, applicable: bool, lossless: bool, note: str = '') -> Candidate:
    dec = _decode(data)
    s, ad, md = guard(orig, dec)
    ok = s >= SSIM_MIN and ad <= ALPHA_MAX_DIFF
    if lossless:
        ok = ok and visibly_exact(orig, dec)
        if not ok:
            note = (note + ' not bit-exact').strip()
    return Candidate(kind, ext, len(data), s, ad, md, ok, applicable, note)


def _save(im: Image.Image, fmt: str, **kw) -> bytes:
    b = io.BytesIO()
    im.save(b, fmt, **kw)
    return b.getvalue()


def _ladder(orig, cands, qualities, encode, kind_prefix, ext, applicable, note=''):
    """Descending quality ladder: keep going while the guard passes, stop at the first failure (recorded)."""
    for q in qualities:
        try:
            c = _check(orig, encode(q), f'{kind_prefix}{q}', ext, applicable, lossless=False, note=note)
        except Exception as e:   # encoder refused (odd sizes etc.) — record and stop
            cands.append(Candidate(f'{kind_prefix}{q}', ext, 0, 0.0, 255, 255, False, applicable, f'encode error: {e}'))
            return
        cands.append(c)
        if not c.passed:
            return


def analyse(job: tuple[str, str]) -> Result:
    platform, abspath = job
    rel = os.path.relpath(abspath, REPO)
    try:
        raw = open(abspath, 'rb').read()
        im = Image.open(io.BytesIO(raw))
        im.load()
    except Exception as e:
        return Result(platform, rel, 0, 0, '?', os.path.getsize(abspath), False, error=str(e))
    name = os.path.basename(abspath)
    ext = name.rsplit('.', 1)[-1].lower()
    is_wall = name.startswith('art-wall-') or name.startswith('art_wall_')
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and (im.mode != 'P' or 'transparency' in im.info)
    work = im.convert('RGBA') if has_alpha else im.convert('RGB')
    res = Result(platform, rel, im.width, im.height, im.mode, len(raw),
                 oversize=(not is_wall and max(im.size) > SIZE_CAP[platform]))
    cands: list[Candidate] = res.candidates
    # iOS catalog members that must stay PNG: the App Store icon and the launch-screen image set.
    png_only = platform == 'ios' and ('AppIcon' in rel or '/launch-' in rel)

    if ext == 'png':
        # 1. lossless PNG
        if HAVE_OXIPNG:
            data = oxipng.optimize_from_memory(raw, level=3, strip=oxipng.StripChunks.safe())
            cands.append(_check(work, data, 'png-oxipng', 'png', True, lossless=True))
        else:
            cands.append(_check(work, _save(im, 'PNG', optimize=True), 'png-pillow', 'png', True, lossless=True,
                                note='oxipng not installed'))
        # 2. lossless WebP — bit-exact; Android can ship it in place (name-addressed resources), iOS cannot
        if HAVE_WEBP:
            # method 6 where it can ship (Android), method 4 where it is informational only (iOS) — 3× faster, ~1% bigger
            cands.append(_check(work, _save(work, 'WEBP', lossless=True, quality=100, method=6 if platform == 'android' else 4),
                                'webp-lossless', 'webp', applicable=(platform == 'android'), lossless=True,
                                note='' if platform == 'android' else 'info only: asset catalogs do not take WebP'))
        # 3. HEIF (iOS only: Xcode compiles .heic image sets; iOS 12+)
        if HAVE_HEIF and platform == 'ios' and not png_only:
            cands.append(_check(work, _save(work, 'HEIF', quality=-1, chroma=444), 'heif-lossless444', 'heic', True,
                                lossless=False, note='YCbCr 4:4:4 lossless (≤ 1 level rounding)'))
            _ladder(work, cands, HEIF_LADDER, lambda q: _save(work, 'HEIF', quality=q, chroma=444), 'heif-q', 'heic', True)
    elif ext == 'webp':
        _ladder(work, cands, WEBP_LADDER, lambda q: _save(work, 'WEBP', quality=q, method=6), 'webp-q', 'webp', True,
                note='lossy-on-lossy re-encode')
        if has_alpha and max(im.size) <= LOSSLESS_WEBP_MAX_SIDE:
            cands.append(_check(work, _save(work, 'WEBP', lossless=True, quality=100, method=6), 'webp-lossless', 'webp',
                                True, lossless=True))
        if platform == 'web' and HAVE_AVIF:
            _ladder(work, cands, AVIF_LADDER, lambda q: _save(work, 'AVIF', quality=q, subsampling='4:4:4', speed=6),
                    'avif-q', 'avif', applicable=False, note='info only: needs <picture> wiring')
    elif ext in ('jpg', 'jpeg'):
        pass   # size report only (see module doc)

    winners = [c for c in cands if c.passed and c.applicable and c.size < res.size]
    if winners:
        best = min(winners, key=lambda c: (c.size, c.kind))
        res.chosen, res.chosen_size = best.kind, best.size
    else:
        res.chosen_size = res.size
    return res


# ── scanning ──────────────────────────────────────────────────────────────────

def scan(platforms: list[str]) -> list[tuple[str, str]]:
    jobs = []
    if 'ios' in platforms:
        for cat in (IOS, IOS_WALLS):
            for root, _dirs, files in os.walk(cat):
                for f in files:
                    if f.lower().rsplit('.', 1)[-1] in ('png', 'jpg', 'jpeg'):
                        jobs.append(('ios', os.path.join(root, f)))
    if 'android' in platforms:
        for f in os.listdir(DROID):
            if f.lower().rsplit('.', 1)[-1] in ('png', 'webp'):
                jobs.append(('android', os.path.join(DROID, f)))
    if 'web' in platforms:
        for root, _dirs, files in os.walk(WEB):
            for f in files:
                if f.lower().endswith('.webp'):
                    jobs.append(('web', os.path.join(root, f)))
    return sorted(jobs)


# ── report ────────────────────────────────────────────────────────────────────

def mb(n: int) -> str:
    return f'{n / 1_000_000:.2f} MB'


def kb(n: int) -> str:
    return f'{n / 1024:.0f} KB'


def pct(before: int, after: int) -> str:
    return f'{(1 - after / before) * 100:.1f}%' if before else '–'


def head_sha() -> str:
    try:
        return subprocess.run(['git', '-C', REPO, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True,
                              check=True).stdout.strip()
    except Exception:
        return 'unknown'


def write_report(results: list[Result], path: str, platforms: list[str], limit: int | None) -> str:
    L: list[str] = []
    w = L.append
    w('# Art compression — dry-run report (FRIDAY-QUEUE item 44)')
    w('')
    w(f'Generated by `docs/design/brand/compress-art.py` at `{head_sha()}` (dry run; nothing in `apps/` was changed).'
      + (f' **Limited to {limit} files per platform.**' if limit else ''))
    w('')
    w(f'Guard: SSIM ≥ {SSIM_MIN} on grey-composited RGB (7×7 window) **and** max alpha diff ≤ {ALPHA_MAX_DIFF}; '
      'lossless candidates must also be bit-exact. A file only changes if a candidate passes the guard, is '
      'smaller, and can ship in place on that platform; otherwise it keeps its original.')
    w('')
    w(f'Encoders: Pillow {Image.__version__} (WebP {"yes" if HAVE_WEBP else "no"}, AVIF {"yes" if HAVE_AVIF else "no"}), '
      f'pyoxipng {"yes" if HAVE_OXIPNG else "NO — Pillow optimize fallback"}, pillow-heif {"yes" if HAVE_HEIF else "NO — HEIF skipped"}.')
    w('')

    # totals
    w('## Totals per platform')
    w('')
    w('| Platform | Files | Before | After | Saved | Changed | Kept (no winner) | Guard rejections (encodes) | Errors |')
    w('|---|---|---|---|---|---|---|---|---|')
    grand_b = grand_a = 0
    for p in platforms:
        rs = [r for r in results if r.platform == p]
        if not rs:
            continue
        b = sum(r.size for r in rs)
        a = sum(r.chosen_size for r in rs)
        grand_b += b
        grand_a += a
        changed = sum(1 for r in rs if r.chosen)
        kept = sum(1 for r in rs if not r.chosen and not r.error)
        rej = sum(1 for r in rs for c in r.candidates if not c.passed)
        err = sum(1 for r in rs if r.error)
        w(f'| {p} | {len(rs)} | {mb(b)} | {mb(a)} | **{mb(b - a)} ({pct(b, a)})** | {changed} | {kept} | {rej} | {err} |')
    w(f'| **all** | {len(results)} | {mb(grand_b)} | {mb(grand_a)} | **{mb(grand_b - grand_a)} ({pct(grand_b, grand_a)})** | | | | |')
    w('')

    # by chosen kind
    w('## What wins, per platform')
    w('')
    w('| Platform | Winning encode | Files | Before | After | Saved |')
    w('|---|---|---|---|---|---|')
    for p in platforms:
        rs = [r for r in results if r.platform == p]
        kinds = sorted({r.chosen or '(kept original)' for r in rs})
        for k in kinds:
            sub = [r for r in rs if (r.chosen or '(kept original)') == k]
            b = sum(r.size for r in sub)
            a = sum(r.chosen_size for r in sub)
            w(f'| {p} | {k} | {len(sub)} | {mb(b)} | {mb(a)} | {mb(b - a)} ({pct(b, a)}) |')
    w('')

    # informational candidates
    w('## Informational candidates (not applicable in place today)')
    w('')
    w('| Platform | Candidate | Files tried | Passed guard | Passed & smaller | Would total | vs current |')
    w('|---|---|---|---|---|---|---|')
    for p in platforms:
        rs = [r for r in results if r.platform == p]
        info_kinds = sorted({c.kind for r in rs for c in r.candidates if not c.applicable})
        for k in info_kinds:
            tried = [(r, c) for r in rs for c in r.candidates if c.kind == k]
            passed = [(r, c) for r, c in tried if c.passed]
            better = [(r, c) for r, c in passed if c.size < r.size]
            cur = sum(r.size for r, _ in tried)
            tot = sum(min(c.size, r.size) if c.passed else r.size for r, c in tried)
            w(f'| {p} | {k} | {len(tried)} | {len(passed)} | {len(better)} | {mb(tot)} | {pct(cur, tot)} |')
    w('')

    # lossy ladder pass rates
    w('## Guard pass rate by candidate')
    w('')
    w('| Platform | Candidate | Tried | Passed | Pass rate | Median SSIM | Max alpha diff seen |')
    w('|---|---|---|---|---|---|---|')
    for p in platforms:
        rs = [r for r in results if r.platform == p]
        for k in sorted({c.kind for r in rs for c in r.candidates}):
            cs = [c for r in rs for c in r.candidates if c.kind == k]
            ps = [c for c in cs if c.passed]
            med = float(np.median([c.ssim for c in cs])) if cs else 0.0
            w(f'| {p} | {k} | {len(cs)} | {len(ps)} | {len(ps) / len(cs) * 100:.0f}% | {med:.4f} | {max(c.alpha_diff for c in cs)} |')
    w('')

    # oversize
    over = [r for r in results if r.oversize]
    w('## Oversize images (longest side above the platform cap; wallpapers exempt)')
    w('')
    w(f'Caps: iOS {SIZE_CAP["ios"]} px (440 pt × 3), Android {SIZE_CAP["android"]} px (xxxhdpi flagship width), '
      f'web {SIZE_CAP["web"]} px (widest desktop render; no srcset yet).')
    w('')
    if over:
        w('| Platform | File | Pixels | Bytes |')
        w('|---|---|---|---|')
        for r in sorted(over, key=lambda r: -max(r.width, r.height)):
            w(f'| {r.platform} | `{r.path}` | {r.width}×{r.height} | {kb(r.size)} |')
    else:
        w('None. Every non-wallpaper image is at or under its platform cap (ship-art.py already right-sizes: '
          'titles 1080–1200 wide, icons 256–320 square).')
    w('')
    walls = [r for r in results if 'art-wall-' in r.path or 'art_wall_' in r.path]
    if walls:
        w(f'Wallpapers scanned: {len(walls)} files, {mb(sum(r.size for r in walls))} total — full phone resolution by design, '
          'already lossy (WebP q86 / JPEG q88), tiny per file.')
        w('')

    # top 40
    w('## Top 40 savings')
    w('')
    w('| # | Platform | File | Pixels | Before | After | Saved | Winner | SSIM | αΔ |')
    w('|---|---|---|---|---|---|---|---|---|---|')
    top = sorted([r for r in results if r.chosen], key=lambda r: r.chosen_size - r.size)[:40]
    for i, r in enumerate(top, 1):
        c = next(c for c in r.candidates if c.kind == r.chosen)
        w(f'| {i} | {r.platform} | `{r.path}` | {r.width}×{r.height} | {kb(r.size)} | {kb(r.chosen_size)} | '
          f'{kb(r.size - r.chosen_size)} ({pct(r.size, r.chosen_size)}) | {r.chosen} | {c.ssim:.4f} | {c.alpha_diff} |')
    w('')

    # kept
    kept = [r for r in results if not r.chosen and not r.error and r.candidates]
    w(f'## Kept at original ({len(kept)} files with candidates, none qualified)')
    w('')
    if kept:
        w('Largest 25:')
        w('')
        w('| Platform | File | Bytes | Best failing candidate | Why |')
        w('|---|---|---|---|---|')
        for r in sorted(kept, key=lambda r: -r.size)[:25]:
            cs = sorted(r.candidates, key=lambda c: c.size)
            best = cs[0]
            why = ('bigger than original' if best.size >= r.size else
                   f'SSIM {best.ssim:.4f}' if best.ssim < SSIM_MIN else
                   f'alpha diff {best.alpha_diff}' if best.alpha_diff > ALPHA_MAX_DIFF else
                   'not applicable in place' if not best.applicable else best.note)
            w(f'| {r.platform} | `{r.path}` | {kb(r.size)} | {best.kind} {kb(best.size)} | {why} |')
        w('')
    errs = [r for r in results if r.error]
    if errs:
        w('## Errors')
        w('')
        for r in errs:
            w(f'- `{r.path}`: {r.error}')
        w('')

    # recommendations
    w('## Recommended settings (what `--apply` would do)')
    w('')
    w(f'- **iOS PNG → HEIC, chroma 4:4:4, per-file quality from the ladder {HEIF_LADDER} (lowest that passes the guard), '
      'else HEIF 4:4:4 lossless, else oxipng-optimized PNG.** Xcode compiles `.heic` image sets (iOS 12+; our target is 16.0); '
      '`Contents.json` filename changes with the extension. Before the swap: build to a device and eyeball a title, a pose and '
      'a scene (HEIF decode goes through the hardware decoder; first-draw cost is the one thing this report cannot measure). '
      'AppIcon and the launch image set stay PNG.')
    w('- **Android PNG → lossless WebP** (bit-exact, drawable-nodpi is name-addressed so call sites do not change); '
      'Android WebP keeps its original unless a q90–92 method-6 re-encode passes the guard *and* is smaller (rare — these are '
      'already q92 m6, so re-encoding only adds generation loss). The real Android/web lever is re-shipping from the PNG '
      'masters in `ship-art.py` at a tuned quality, guarded against the master, not against the current WebP.')
    w('- **Web WebP: leave as is.** AVIF fails the alpha rule on every alpha image (libavif alpha is lossy: 5–16 levels), '
      'and only the opaque wallpapers pass — those are already ~10 KB. Not worth `<picture>` wiring.')
    w(f'- Guard stays at SSIM ≥ {SSIM_MIN} + alpha ≤ {ALPHA_MAX_DIFF}. For reference the shipped web/Android q92 WebP scores '
      '≈ 0.985–0.99 against the iOS PNG master, i.e. the guard is stricter than what already ships on two of three platforms.')
    w('- Lossless WebP for iOS is informational: ~30–55% smaller and bit-exact, but asset catalogs do not take WebP; it would '
      'need bundle files + `UIImage(contentsOfFile:)`, which loses catalog features (thinning, on-demand). HEIC wins anyway.')
    w('')
    w('Re-run: `/opt/homebrew/bin/python3.12 docs/design/brand/compress-art.py` (≈ 10 min on 8 cores). Apply, after review: '
      'add `--apply` (writes winners into `apps/`, rewrites iOS `Contents.json`, deletes the replaced originals) and then run '
      'the quality guard again against the committed originals via `git stash`-free diff review.')
    text = '\n'.join(L) + '\n'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(text)
    return text


# ── apply (NOT used in the dry run) ───────────────────────────────────────────

def _encode_for(res: Result, kind: str) -> bytes:
    """Re-encode the winner deterministically from the original (same settings as analyse)."""
    src = os.path.join(REPO, res.path)
    raw = open(src, 'rb').read()
    im = Image.open(io.BytesIO(raw))
    im.load()
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and (im.mode != 'P' or 'transparency' in im.info)
    work = im.convert('RGBA') if has_alpha else im.convert('RGB')
    if kind == 'png-oxipng':
        return oxipng.optimize_from_memory(raw, level=3, strip=oxipng.StripChunks.safe())
    if kind == 'png-pillow':
        return _save(im, 'PNG', optimize=True)
    if kind == 'webp-lossless':
        return _save(work, 'WEBP', lossless=True, quality=100, method=6)
    if kind.startswith('webp-q'):
        return _save(work, 'WEBP', quality=int(kind[6:]), method=6)
    if kind == 'heif-lossless444':
        return _save(work, 'HEIF', quality=-1, chroma=444)
    if kind.startswith('heif-q'):
        return _save(work, 'HEIF', quality=int(kind[6:]), chroma=444)
    raise ValueError(kind)


def apply(results: list[Result], keep_dir: str | None) -> int:
    """Write every winner into apps/ (or into keep_dir when given — review copies, apps/ untouched)."""
    n = 0
    for r in results:
        if not r.chosen:
            continue
        c = next(c for c in r.candidates if c.kind == r.chosen)
        data = _encode_for(r, r.chosen)
        # the guard runs again on the bytes we are about to write — belt and braces
        im = Image.open(os.path.join(REPO, r.path))
        im.load()
        work = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
        s, ad, _ = guard(work, _decode(data))
        if s < SSIM_MIN or ad > ALPHA_MAX_DIFF or len(data) >= r.size:
            print('skip (re-check failed)', r.path, s, ad, file=sys.stderr)
            continue
        src = os.path.join(REPO, r.path)
        base, _old_ext = os.path.splitext(src)
        dst = f'{base}.{c.ext}'
        if keep_dir:
            out = os.path.join(keep_dir, r.platform, os.path.basename(dst))
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, 'wb') as f:
                f.write(data)
            n += 1
            continue
        with open(dst, 'wb') as f:
            f.write(data)
        if dst != src:
            os.remove(src)
            cj = os.path.join(os.path.dirname(src), 'Contents.json')
            if r.platform == 'ios' and os.path.exists(cj):
                spec = json.load(open(cj))
                for img in spec.get('images', []):
                    if img.get('filename') == os.path.basename(src):
                        img['filename'] = os.path.basename(dst)
                with open(cj, 'w') as f:
                    json.dump(spec, f, indent=2)
        n += 1
    return n


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--platform', default='ios,android,web', help='comma list of ios,android,web')
    ap.add_argument('--limit', type=int, default=None, help='first N files per platform (quick look)')
    ap.add_argument('--jobs', type=int, default=max(1, (os.cpu_count() or 2) - 1))
    ap.add_argument('--report', default=os.path.join(REPORT_DIR, 'report.md'))
    ap.add_argument('--json', default=os.path.join(REPORT_DIR, 'results.json'))
    ap.add_argument('--keep', default=None, help='write the winning encodes here for eyeballing (apps/ untouched)')
    ap.add_argument('--apply', action='store_true', help='WRITE winners into apps/ — only after founder review')
    args = ap.parse_args()
    platforms = [p.strip() for p in args.platform.split(',') if p.strip()]
    jobs = scan(platforms)
    if args.limit:
        jobs = [j for p in platforms for j in [j for j in jobs if j[0] == p][:args.limit]]
    print(f'{len(jobs)} files; oxipng={HAVE_OXIPNG} heif={HAVE_HEIF} avif={HAVE_AVIF} jobs={args.jobs}', file=sys.stderr)
    results: list[Result] = []
    with ProcessPoolExecutor(max_workers=args.jobs) as ex:
        for i, r in enumerate(ex.map(analyse, jobs, chunksize=4), 1):
            results.append(r)
            if i % 100 == 0:
                print(f'  {i}/{len(jobs)}', file=sys.stderr)
    results.sort(key=lambda r: (r.platform, r.path))
    os.makedirs(os.path.dirname(args.json), exist_ok=True)
    with open(args.json, 'w') as f:
        json.dump([asdict(r) for r in results], f, indent=0, separators=(',', ':'))
        f.write('\n')
    write_report(results, args.report, platforms, args.limit)
    b = sum(r.size for r in results)
    a = sum(r.chosen_size for r in results)
    print(f'before {mb(b)} → after {mb(a)} ({pct(b, a)} saved); report {os.path.relpath(args.report, REPO)}', file=sys.stderr)
    if args.keep:
        print('written', apply(results, args.keep), 'review copies to', args.keep, file=sys.stderr)
    if args.apply:
        print('APPLYING to apps/ …', file=sys.stderr)
        print('applied', apply(results, None), 'files', file=sys.stderr)


if __name__ == '__main__':
    main()
