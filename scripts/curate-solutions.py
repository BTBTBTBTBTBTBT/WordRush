#!/usr/bin/env python3
"""
Curate the 5-letter daily-answer bank into a common-words-only list.

Keeps a word iff:
  - it is a valid guess (in allowed.json), AND
  - zipf frequency >= THRESHOLD (common enough that no one asks "what?"), AND
  - it is NOT a proper noun / name — i.e. not in the NLTK first-names blocklist
    (names-blocklist.txt) and not in the manual blocklist (manual-blocklist.txt),
    UNLESS it is on the name-word allowlist (common nouns that happen to be
    names, e.g. ROBIN, PEARL).

By default the candidate set is just the current answers (solutions-legacy.json)
— we clean the existing bank rather than grow it, because the current list is
already abundant (~2.6k) and promoting from allowed.json (the permissive GUESS
list) floods in proper nouns / places / brands that make bad answers. Pass
--promote to also consider 5-letter allowed words (with the same name/plural
filters), if you ever want to grow the bank. Output is deterministically
shuffled (fixed
seed) so it isn't alphabetical; that order is PERMANENT once shipped (the daily
index reads position in the array).

Emits review files to scripts/out/{kept,cut,promoted}.txt. Only --write copies
the result into the three bundle dirs; run without it first and eyeball the
lists. solutions-legacy.json is NEVER touched.

Usage:
  python3 scripts/curate-solutions.py                # dry run: counts + review files
  python3 scripts/curate-solutions.py --threshold 3.2
  python3 scripts/curate-solutions.py --scan-only    # 6/7-letter name/weak report
  python3 scripts/curate-solutions.py --write        # sync curated list to bundles
"""
import argparse
import json
import os
import random
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(REPO, 'apps', 'web', 'data')
SCRIPT_DATA = os.path.join(REPO, 'scripts', 'data')
OUT = os.path.join(REPO, 'scripts', 'out')
SHUFFLE_SEED = 'wordocious-2026-07-08'
DEFAULT_THRESHOLD = 2.3
MIN_COUNT, MAX_COUNT = 2100, 3000

# Every bundle location that ships solutions.json (server reads the web copy).
BUNDLE_DIRS = [
    os.path.join(REPO, 'apps', 'web', 'data'),
    os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources'),
    os.path.join(REPO, 'apps', 'android', 'core', 'src', 'main', 'resources', 'data'),
]

FIVE = re.compile(r'^[A-Z]{5}$')


def load_json_list(path):
    with open(path) as f:
        return [w.upper() for w in json.load(f)]


def load_wordset(path):
    if not os.path.exists(path):
        return set()
    out = set()
    with open(path) as f:
        for line in f:
            w = line.strip().upper()
            if w and not w.startswith('#'):
                out.add(w)
    return out


def zipf():
    try:
        from wordfreq import zipf_frequency
    except ImportError:
        sys.exit("wordfreq not installed. Run: python3 -m venv venv && "
                 "venv/bin/pip install wordfreq nltk, then use venv/bin/python.")
    return lambda w: zipf_frequency(w.lower(), 'en')


def curate(threshold, promote=False):
    z = zipf()
    legacy = load_json_list(os.path.join(DATA, 'solutions-legacy.json'))
    allowed = load_json_list(os.path.join(DATA, 'allowed.json'))
    allowed_set = set(allowed)
    allowed5 = [w for w in allowed if FIVE.match(w)]

    names = load_wordset(os.path.join(SCRIPT_DATA, 'names-blocklist.txt'))
    manual = load_wordset(os.path.join(SCRIPT_DATA, 'manual-blocklist.txt'))
    allow = load_wordset(os.path.join(SCRIPT_DATA, 'name-word-allowlist.txt'))

    legacy_set = set(legacy)
    # Default: clean the existing bank only. --promote also considers 5-letter
    # allowed words (they carry the same filters), but the allowed GUESS list is
    # full of proper nouns/brands, so promotion is off unless explicitly asked.
    candidates = sorted(legacy_set | set(allowed5)) if promote else sorted(legacy_set)

    def is_cheap_plural(w):
        # SEALS←SEAL, PRAYS←PRAY: a promotion ending in S whose 4-letter
        # singular is itself a common word reads as a cheap answer. Judged by
        # the singular's frequency (it's 4 letters, so not in the 5-letter
        # allowed set) — this keeps real -SS/-US words (GLASS←GLAS, VIRUS←VIRU
        # have no common singular). Blocks PROMOTIONS only; legacy plurals stay.
        return w.endswith('S') and z(w[:-1]) >= 3.0

    kept, cut, promoted = [], [], []
    for w in candidates:
        in_legacy = w in legacy_set
        reason = None
        if not FIVE.match(w):
            reason = 'not-5-alpha'
        elif w not in allowed_set:
            reason = 'not-in-allowed'
        elif (w in names or w in manual) and w not in allow:
            reason = 'manual' if w in manual else 'name'
        elif z(w) < threshold:
            reason = f'freq<{threshold}({round(z(w), 2)})'
        elif not in_legacy and is_cheap_plural(w):
            reason = 'plural'  # blocks promotion only (see above)
        if reason is None:
            kept.append(w)
            if not in_legacy:
                promoted.append(w)
        elif in_legacy:  # only report words we're actually removing
            cut.append((w, reason))

    kept.sort()
    random.Random(SHUFFLE_SEED).shuffle(kept)

    # invariants
    assert all(FIVE.match(w) for w in kept), 'non-5-letter word in kept'
    assert all(w in allowed_set for w in kept), 'kept word not in allowed'
    assert len(kept) == len(set(kept)), 'duplicate in kept'
    return kept, cut, promoted, legacy_set


def write_review(kept, cut, promoted):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'kept.txt'), 'w') as f:
        f.write('\n'.join(sorted(kept)) + '\n')
    with open(os.path.join(OUT, 'cut.txt'), 'w') as f:
        f.write('\n'.join(f'{w}\t{r}' for w, r in sorted(cut)) + '\n')
    with open(os.path.join(OUT, 'promoted.txt'), 'w') as f:
        f.write('\n'.join(sorted(promoted)) + '\n')


def write_bundles(kept):
    blob = json.dumps(kept, indent=2) + '\n'
    for d in BUNDLE_DIRS:
        with open(os.path.join(d, 'solutions.json'), 'w') as f:
            f.write(blob)
        print(f'  wrote {len(kept)} → {os.path.relpath(os.path.join(d, "solutions.json"), REPO)}')


def curate_length(n, threshold):
    """Curate the 6/7-letter bank: legacy-only, zipf filter + manual blocklist.
    (Names were a non-issue in the 6/7 scan; the manual blocklist still applies.)
    rescue-allowlist.txt words bypass the frequency cut — well-known words that
    just score low in the corpora (user-approved)."""
    z = zipf()
    legacy = load_json_list(os.path.join(DATA, f'solutions-{n}-legacy.json'))
    allowed = set(load_json_list(os.path.join(DATA, f'allowed-{n}.json')))
    manual = load_wordset(os.path.join(SCRIPT_DATA, 'manual-blocklist.txt'))
    rescue = load_wordset(os.path.join(SCRIPT_DATA, 'rescue-allowlist.txt'))
    pat = re.compile(rf'^[A-Z]{{{n}}}$')

    kept, cut = [], []
    for w in sorted(set(legacy)):
        reason = None
        if not pat.match(w):
            reason = 'bad-shape'
        elif w not in allowed:
            reason = 'not-in-allowed'
        elif w in manual:
            reason = 'manual'
        elif w not in rescue and z(w) < threshold:
            reason = f'freq<{threshold}({round(z(w), 2)})'
        if reason is None:
            kept.append(w)
        else:
            cut.append((w, reason))

    kept.sort()
    random.Random(SHUFFLE_SEED + f'-{n}').shuffle(kept)
    assert all(pat.match(w) for w in kept) and len(kept) == len(set(kept))
    assert all(w in allowed for w in kept)
    return kept, cut


def write_length_bundles(n, kept):
    blob = json.dumps(kept, indent=2) + '\n'
    for d in BUNDLE_DIRS:
        with open(os.path.join(d, f'solutions-{n}.json'), 'w') as f:
            f.write(blob)
        print(f'  wrote {len(kept)} → {os.path.relpath(os.path.join(d, f"solutions-{n}.json"), REPO)}')


def scan_lengths():
    z = zipf()
    names = load_wordset(os.path.join(SCRIPT_DATA, 'names-blocklist.txt'))
    for n in (6, 7):
        sols = load_json_list(os.path.join(DATA, f'solutions-{n}.json'))
        pat = re.compile(rf'^[A-Z]{{{n}}}$')
        name_like = [w for w in sols if w in names and pat.match(w)]
        weak = [(w, round(z(w), 2)) for w in sols if z(w) < 3.0]
        print(f'\nsolutions-{n}.json: {len(sols)} words | name-list hits: {len(name_like)} '
              f'| zipf<3.0: {len(weak)}')
        if name_like:
            print('  names:', ', '.join(sorted(name_like)[:30]))
        if weak:
            print('  weakest:', ', '.join(f'{w}({f})' for w, f in sorted(weak, key=lambda x: x[1])[:20]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--threshold', type=float, default=DEFAULT_THRESHOLD)
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--promote', action='store_true', help='also promote 5-letter allowed words (adds proper-noun risk)')
    ap.add_argument('--scan-only', action='store_true')
    ap.add_argument('--curate-length', type=int, choices=(6, 7),
                    help='curate the 6- or 7-letter bank instead of the 5-letter one')
    args = ap.parse_args()

    if args.scan_only:
        scan_lengths()
        return

    if args.curate_length:
        n = args.curate_length
        kept, cut = curate_length(n, args.threshold)
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, f'kept-{n}.txt'), 'w') as f:
            f.write('\n'.join(sorted(kept)) + '\n')
        with open(os.path.join(OUT, f'cut-{n}.txt'), 'w') as f:
            f.write('\n'.join(f'{w}\t{r}' for w, r in sorted(cut)) + '\n')
        print(f'{n}-letter: kept={len(kept)} cut={len(cut)} (review scripts/out/kept-{n}.txt, cut-{n}.txt)')
        if args.write:
            write_length_bundles(n, kept)
        else:
            print('(dry run — no bundles written)')
        return

    print('threshold sweep (kept counts):')
    for t in (2.1, 2.3, 2.5, 2.7):
        k, _, _, _ = curate(t, args.promote)
        print(f'  zipf>={t}: {len(k)} words')

    kept, cut, promoted, legacy_set = curate(args.threshold, args.promote)
    write_review(kept, cut, promoted)
    print(f'\n=== threshold {args.threshold} ===')
    print(f'legacy: {len(legacy_set)} | kept: {len(kept)} '
          f'(promoted-in: {len(promoted)}, cut-from-legacy: {len(cut)})')
    print(f'review files → {os.path.relpath(OUT, REPO)}/(kept|cut|promoted).txt')

    if not (MIN_COUNT <= len(kept) <= MAX_COUNT):
        print(f'\n!! kept={len(kept)} outside [{MIN_COUNT},{MAX_COUNT}] — adjust --threshold')
        if args.write:
            sys.exit('refusing to --write an out-of-range list')

    if args.write:
        print('\nwriting curated list to bundle dirs:')
        write_bundles(kept)
    else:
        print('\n(dry run — no bundles written. Review the lists, then re-run with --write.)')


if __name__ == '__main__':
    main()
