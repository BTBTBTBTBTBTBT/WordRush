#!/usr/bin/env python3
"""Shared all-lengths lexicon for the OFFLINE More Games generators (Hubbub,
Crosswise, future games). Never bundled into a client — games ship pre-generated
banks — so size is free and a later rule change can never rewrite a played day.

Generalises the G-rules of curate-solutions.py (whose helpers are imported, not
copied) from one length to 3..12 (+ up to 15 for pangram candidates):

  L1 shape        A-Z, length 3..15
  L2 candidates   web2 lowercase lemmas + modern-words.txt + regular inflections
  L3 proper nouns web2 capitalisation split, proper-noun-blocklist, the §265
                  answer-proper-nouns list, NLTK first names at every length,
                  WordNet instance-only senses; name-word-allowlist wins
  L4 known word   WordNet knows it (morphy resolves inflections) or it is in
                  modern-words.txt
  L5 exclusions   offensive + manual blocklists AND the app-wide profanity terms
                  exported from packages/core (export-profanity-terms.ts), on the
                  BASE as well as the inflected form (inflecting a slur yields a slur)
  L6 tiers        common >= 3.0 zipf, extended 2.0..3.0, acceptOnly = taste-list
                  words (typeable, never dealt or required)
  L7 overrides    scripts/data/lexicon-accept.txt / lexicon-reject.txt

  venv/bin/python scripts/build-lexicon.py --report     # counts only
  venv/bin/python scripts/build-lexicon.py --write      # scripts/data/lexicon-all.json
"""
import argparse, hashlib, importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('curate', os.path.join(HERE, 'curate-solutions.py'))
curate = importlib.util.module_from_spec(spec); spec.loader.exec_module(curate)
SD = curate.SCRIPT_DATA
COMMON_Z, EXT_Z, MIN_LEN, MAX_LEN = 3.0, 2.0, 3, 15


def _pkg_version(name):
    try:
        from importlib.metadata import version
        return version(name)
    except Exception:
        return 'unknown'


def build():
    from nltk.corpus import wordnet as wn, names as nltk_names
    import wordfreq
    z = curate.zipf()
    common_lemmas, proper = curate.load_lexicon()
    ws = lambda f: curate.load_wordset(os.path.join(SD, f))
    modern, name_ok = ws('modern-words.txt'), ws('name-word-allowlist.txt')
    offensive, manual = ws('offensive-blocklist.txt'), ws('manual-blocklist.txt')
    blocked = (ws('proper-noun-blocklist.txt') | ws('answer-proper-nouns.txt')
               | {n.upper() for n in nltk_names.words()} | proper) - name_ok
    accept, reject = ws('lexicon-accept.txt'), ws('lexicon-reject.txt')
    # The app-wide profanity vocabulary (usernames, PN guesses, WOTD) exported
    # from packages/core as EXACT words — one filter for the whole product.
    # Matched exactly and on the base of every inflection; substring matching
    # is for usernames and would wrongly cut CONCERT or RACCOON here.
    bad = offensive | ws('profanity-exact.generated.txt')
    # Taste tier: real words (TUMOR, BOWEL, crude-but-legal manual-blocklist
    # entries) that a player may TYPE and have accepted, but that no game may
    # deal, feature or require. Games treat `acceptOnly` like bonus words.
    taste = (manual | ws('taste-exact.generated.txt')) - bad

    def known(w):
        lw = w.lower()
        return w in modern or bool(wn.synsets(lw)) or any(wn.morphy(lw, p) for p in 'nvar')

    def instance_only(w):
        syns = wn.synsets(w.lower())
        return bool(syns) and all(s.instance_hypernyms() for s in syns)

    bases = common_lemmas | modern
    cands = {}
    for b in bases:
        if not b.isalpha():
            continue
        for w in {b} | curate.inflections(b):
            if MIN_LEN <= len(w) <= MAX_LEN and w.isascii() and w.isalpha():
                cands.setdefault(w, set()).add(b)

    common, extended, accept_only = [], [], []
    for w, srcs in cands.items():
        # A blocked BASE taints its inflections (COCKS, DAMNED) — but a word that
        # is a dictionary lemma in its own right is judged on its own (BUTTER is
        # not BUTT+ER, TITER is not a slur).
        own_lemma = w in bases
        tainted = lambda block: w in block or (not own_lemma and any(b in block for b in srcs))
        if w in reject or tainted(bad):
            continue
        if w not in accept:
            if (w in blocked or instance_only(w)) and w not in name_ok:
                continue
            if not known(w):
                continue
        f = z(w)
        if tainted(taste):
            if f >= EXT_Z:
                accept_only.append(w)
        elif w in accept or f >= COMMON_Z:
            common.append(w)
        elif f >= EXT_Z:
            extended.append(w)
    with open('/usr/share/dict/words', 'rb') as fh:
        sha = hashlib.sha256(fh.read()).hexdigest()[:16]
    return {'version': 1, 'source': {'web2Sha': sha, 'wordfreq': _pkg_version('wordfreq'),
            'commonZipf': COMMON_Z, 'extendedZipf': EXT_Z},
            'common': sorted(common), 'extended': sorted(extended), 'acceptOnly': sorted(accept_only)}


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--write', action='store_true'); ap.add_argument('--report', action='store_true')
    a = ap.parse_args()
    lex = build()
    from collections import Counter
    for tier in ('common', 'extended', 'acceptOnly'):
        c = Counter(len(w) for w in lex[tier])
        print(f"{tier}: {len(lex[tier])} words  " + ' '.join(f'{k}:{c[k]}' for k in sorted(c)))
    if a.write:
        out = os.path.join(SD, 'lexicon-all.json')
        with open(out, 'w') as f:
            json.dump(lex, f, separators=(',', ':'))
        print('wrote', out, os.path.getsize(out) // 1024, 'KB')
