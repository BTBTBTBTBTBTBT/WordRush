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
  python3 scripts/curate-solutions.py --curate-allowed 6 [--write]
                                                     # curate the GUESS list (see below)
  python3 scripts/curate-solutions.py --grow-allowed 5 [--write]
                                                     # GROW the guess list (see below)
  python3 scripts/curate-solutions.py --grow-length 6 [--write]
                                                     # GROW the 6/7 ANSWER bank (append-only, §222)

--curate-allowed curates allowed-{6,7}.json — the guess-validation dictionary,
NOT the answer bank. That list was a raw scrape of a ~1913 dictionary and half
of it had zero modern-corpus presence (TUZZLE, BUZZLE, BEGNAW…). Rule: keep a
word iff zipf >= ALLOWED_THRESHOLD (any real corpus presence) OR it is a
current/legacy answer (every past + future daily must stay guessable). Guesses
stay a permissive superset of the answers on purpose: the answer bank cuts at
zipf 2.3, so real-but-obscure words (EVINCE, PARSEC) remain valid guesses.

--grow-allowed is the other half, and the one that was missing. Every mode above
only ever CUTS. Nothing ever ADDED to a guess list, and the source it was built
from — /usr/share/dict/words, the 1934 Webster's — lists only LEMMAS. It has no
ASKED, no LOOKS, no WANTS, no BORED. So the guess list inherited a systematic
hole in inflected forms: of the 205 -ED words we accepted, 43 were there solely
because rule G2 forces every answer to stay guessable. That is why POSED was
accepted (it is an answer) and NUKED was not (it is neither an answer nor a
Webster's lemma) — there was never an "-ed rule" at all, just a gap.

THE RULE SET (guess list, per length n):
  G1 shape        exactly n letters, A-Z, deduplicated, sorted.
  G2 answers      every current + legacy answer is guessable, always.
  G3 lexicon      candidates are web2 lemmas of length n, PLUS every regular
                  inflection of a web2 lemma that lands at exactly n letters.
  G4 inflections  -S/-ES, -ED/-D, -ING, -ER, -IES/-IED. This is the rule whose
                  absence produced the whole problem.
  G5 offensive    offensive-blocklist.txt words are never guessable.
  G6 proper nouns excluded. web2 lists proper nouns CAPITALISED, so "appears in
                  web2 only capitalised" identifies ~25k of them for free
                  (PARIS, INDIA, DAVID, ASIAN); name-word-allowlist.txt wins
                  (ROBIN, PEARL), and proper-noun-blocklist.txt mops up the few
                  that web2 happens to lowercase.
  G7 monotonic    THE GUESS LIST NEVER SHRINKS. Union with what already ships,
                  minus G5. A word that worked yesterday must work tomorrow;
                  the run asserts this rather than trusting it.

Crude-but-not-slur words (BOOBS, CRAPS) stay guessable, consistent with the
existing split: offensive-blocklist = slurs = never typeable; manual-blocklist =
crude = typeable, never an answer. Growing the guess list cannot change what the
game SHOWS, because the answer bank is curated separately at a much higher bar.

Safe to ship at any time: guess lookup is a set membership test, so adding words
cannot alter any past or future daily. Only the ANSWER array is order-locked.
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
DEFAULT_THRESHOLD = 3.0
ALLOWED_THRESHOLD = 1.0  # guess list: any corpus presence at all
# Bar for GROWING a guess list (--grow-allowed). Higher than ALLOWED_THRESHOLD
# because that one only decides whether to KEEP a word a human already put in a
# dictionary, whereas this one admits machine-generated inflections and has to
# reject the junk they produce. At 2.0 the -ED forms players actually type all
# clear it (NUKED 2.39 is the closest call); below ~1.5 the additions stop
# looking like words anyone would guess.
GROW_THRESHOLD = 2.0
# Informational only. These are NOT a target to tune the threshold towards —
# that inversion is exactly how the bank rotted: the bar was walked down until
# the count fit, so the bank's SIZE was setting its QUALITY. Every rarest word
# in the 2026-07 bank sat at precisely the then-threshold (GUNNY, PAISA, SOPPY,
# BARMY at zipf 2.30), which is the fingerprint of a floor chosen by headcount.
#
# The threshold is the INPUT. The count is the OUTPUT. If the count comes out
# smaller than you hoped, that is the honest answer — Wordle ships ~2,300
# answers and has run six years on one puzzle a day.
COMFORTABLE_MIN = 1200   # ~3.3 years of a once-daily mode before any repeat

# Every bundle location that ships solutions.json (server reads the web copy).
BUNDLE_DIRS = [
    os.path.join(REPO, 'apps', 'web', 'data'),
    os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources'),
    os.path.join(REPO, 'apps', 'android', 'core', 'src', 'main', 'resources', 'data'),
]

# Test-fixture copies of the word lists (kept as exact copies of the bundles).
FIXTURE_DIRS = [
    os.path.join(REPO, 'apps', 'ios', 'Tests', 'Fixtures'),
    os.path.join(REPO, 'apps', 'android', 'core', 'src', 'test', 'resources', 'fixtures'),
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
    offensive = load_wordset(os.path.join(SCRIPT_DATA, 'offensive-blocklist.txt'))
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
        elif w in offensive:
            reason = 'offensive'  # hard ban — the allowlist cannot rescue these
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
    # FIXTURE_DIRS too: the native test fixtures are exact copies of the
    # bundles, and skipping them here is how they went stale between curation
    # runs (word-list-sync.test.ts now fails loudly if any copy drifts).
    for d in BUNDLE_DIRS + FIXTURE_DIRS:
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
    offensive = load_wordset(os.path.join(SCRIPT_DATA, 'offensive-blocklist.txt'))
    rescue = load_wordset(os.path.join(SCRIPT_DATA, 'rescue-allowlist.txt'))
    pat = re.compile(rf'^[A-Z]{{{n}}}$')

    kept, cut = [], []
    for w in sorted(set(legacy)):
        reason = None
        if not pat.match(w):
            reason = 'bad-shape'
        elif w in offensive:
            reason = 'offensive'
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
    for d in BUNDLE_DIRS + FIXTURE_DIRS:  # fixtures = exact bundle copies (see write_bundles)
        with open(os.path.join(d, f'solutions-{n}.json'), 'w') as f:
            f.write(blob)
        print(f'  wrote {len(kept)} → {os.path.relpath(os.path.join(d, f"solutions-{n}.json"), REPO)}')


def grow_length(n, threshold):
    """GROW the 6/7-letter ANSWER bank (§222) — the only mode that ADDS answers.

    Every other solutions mode only CUTS, so common words the ~1913 scrape
    never had (COOKIE) could never be dealt as a daily answer. Candidates are
    the n-letter GUESS list minus current AND legacy answers (legacy words were
    cut deliberately in July — they must not sneak back), promoted iff:
      - zipf >= threshold — the ANSWER bar (3.0), not the guess bar (1.0/2.0),
      - never offensive/manual-blocklist, never a name (allowlist wins),
      - not a cheap plural: an S-ender whose singular is itself common
        (COOKIES←COOKIE) reads as a lazy answer — same rule as the 5-letter
        promote path. Blocks promotions only; legacy plurals stay.

    APPEND-ONLY: the shipped array is order-locked (position = daily index +
    deck permutation input), so additions are deterministically shuffled and
    appended AFTER the existing entries. The engine's growth date-gate
    (SOLUTIONS_GROWTH_CUTOVER_DATE) keeps pre-growth dates on the frozen
    prefix; this function asserts the prefix is byte-identical.
    """
    z = zipf()
    current = load_json_list(os.path.join(DATA, f'solutions-{n}.json'))
    legacy = set(load_json_list(os.path.join(DATA, f'solutions-{n}-legacy.json')))
    allowed = load_json_list(os.path.join(DATA, f'allowed-{n}.json'))
    manual = load_wordset(os.path.join(SCRIPT_DATA, 'manual-blocklist.txt'))
    offensive = load_wordset(os.path.join(SCRIPT_DATA, 'offensive-blocklist.txt'))
    names = load_wordset(os.path.join(SCRIPT_DATA, 'names-blocklist.txt'))
    name_ok = load_wordset(os.path.join(SCRIPT_DATA, 'name-word-allowlist.txt'))
    blocked = load_wordset(os.path.join(SCRIPT_DATA, 'proper-noun-blocklist.txt')) - name_ok
    pat = re.compile(rf'^[A-Z]{{{n}}}$')
    cur_set = set(current)

    # The names-blocklist holds first names only; the guess list carries
    # places/surnames (MEDICI, POMPEII) that the guess bar tolerates but the
    # answer bar must not. Two screens, both from the §221 audit: web2's
    # capitalisation split (G6 — PARIS, LAWTON), and WordNet's instance
    # hypernyms (a word ALL of whose senses are instances of something is a
    # specific named thing, not a common noun — catches what web2 predates).
    _, proper = load_lexicon()
    try:
        from nltk.corpus import wordnet as wn
    except ImportError:
        sys.exit('nltk/wordnet not installed in this venv — needed for --grow-length')

    def instance_only(w):
        syns = wn.synsets(w.lower())
        return bool(syns) and all(s.instance_hypernyms() for s in syns)

    # names-blocklist.txt is 5-letter-only (built for the 5-letter bank), so
    # 6/7 growth screens against the full NLTK first-names corpus directly.
    try:
        from nltk.corpus import names as nltk_names
        names = names | {x.upper() for x in nltk_names.words() if len(x) == n}
    except (ImportError, LookupError):
        sys.exit('nltk names corpus not available — needed for --grow-length')

    def plural_base_freq(w):
        # COOKIES←COOKIE, BOARDS←BOARD, BUDDIES←BUDDY: judge every plausible
        # singular and take the most common one.
        bases = [w[:-1]]
        if w.endswith('ES'):
            bases.append(w[:-2])
        if w.endswith('IES'):
            bases.append(w[:-3] + 'Y')
        return max(z(b) for b in bases)

    # G8 twin for answers: hand-vouched modern words (SELFIE, EBOOK) bypass the
    # WordNet-known requirement — a human already made the "real word" call.
    modern = load_wordset(os.path.join(SCRIPT_DATA, 'modern-words.txt'))

    added, skipped = [], []
    for w in sorted(set(allowed)):
        if w in cur_set or w in legacy or not pat.match(w):
            continue
        syns = wn.synsets(w.lower())  # morphy resolves inflections (BANKED→bank)
        if w in offensive:
            reason = 'offensive'
        elif w in manual:
            reason = 'manual'
        elif not syns and w not in modern:
            # Not in WordNet at all: the residue here is overwhelmingly
            # surnames/places that web2 happens to lowercase (SHARIF, CROCKER,
            # CRAWLEY) plus scrape junk — none of it answer-quality.
            reason = 'not-in-wordnet'
        elif (w in names or w in blocked or w in proper or instance_only(w)) and w not in name_ok:
            reason = 'name'
        elif z(w) < threshold:
            reason = f'freq<{threshold}({round(z(w), 2)})'
        elif w.endswith('S') and plural_base_freq(w) >= 3.0:
            reason = 'plural'
        else:
            added.append(w)
            continue
        skipped.append((w, reason))

    random.Random(SHUFFLE_SEED + f'-grow-{n}').shuffle(added)
    final = current + added
    assert final[:len(current)] == current, 'prefix invariance violated'
    assert len(final) == len(set(final)), 'duplicate in grown bank'
    allowed_set = set(allowed)
    assert all(w in allowed_set for w in final), 'grown answer not guessable'
    return final, added, skipped


def curate_allowed(n):
    """Curate the n-letter GUESS list: keep iff zipf >= ALLOWED_THRESHOLD or the
    word is a current/legacy answer — and never an offensive-blocklist word
    (slurs are not guessable, unlike manual-blocklist crude words, which stay
    typeable and are only banned as answers). Answers are otherwise kept
    unconditionally so every shipped daily stays guessable (invariant:
    (solutions ∪ legacy) − offensive ⊆ allowed; a LEGACY answer on the
    offensive list loses pre-cutover replay for the days it was the answer —
    accepted pre-release, see bible 129)."""
    z = zipf()
    allowed = load_json_list(os.path.join(DATA, f'allowed-{n}.json'))
    offensive = load_wordset(os.path.join(SCRIPT_DATA, 'offensive-blocklist.txt'))
    must = set(load_json_list(os.path.join(DATA, f'solutions-{n}.json'))) | \
        set(load_json_list(os.path.join(DATA, f'solutions-{n}-legacy.json')))
    pat = re.compile(rf'^[A-Z]{{{n}}}$')

    kept, cut = [], []
    for w in sorted(set(allowed)):
        if w in offensive:
            cut.append((w, 'offensive'))
        elif w in must or (pat.match(w) and z(w) >= ALLOWED_THRESHOLD):
            kept.append(w)
        else:
            cut.append((w, f'freq<{ALLOWED_THRESHOLD}({round(z(w), 2)})'))
    assert (must - offensive) <= set(kept), 'an answer fell out of the allowed list'
    assert len(kept) == len(set(kept))
    return kept, cut


def write_allowed_bundles(n, kept):
    blob = json.dumps(kept, indent=2) + '\n'
    for d in BUNDLE_DIRS + FIXTURE_DIRS:
        with open(os.path.join(d, allowed_name(n)), 'w') as f:
            f.write(blob)
        print(f'  wrote {len(kept)} → {os.path.relpath(os.path.join(d, allowed_name(n)), REPO)}')


def allowed_name(n):
    """The 5-letter guess list predates the multi-length ones and is just
    allowed.json; 6/7 are allowed-N.json."""
    return 'allowed.json' if n == 5 else f'allowed-{n}.json'


def load_lexicon():
    """web2 (/usr/share/dict/words), split by case.

    The case split IS the proper-noun filter (G6): web2 capitalises PARIS,
    INDIA, DAVID, ASIAN and ~25k others, and lowercases ordinary words. Returned
    as (common, proper) with `proper` already excluding anything that also
    appears lowercase — CHINA and ROBIN are both, and must stay guessable.
    """
    path = os.environ.get('WORDOCIOUS_LEXICON', '/usr/share/dict/words')
    if not os.path.exists(path):
        sys.exit(f'No lexicon at {path}. Set WORDOCIOUS_LEXICON to a word list '
                 '(one word per line, proper nouns capitalised).')
    with open(path) as f:
        raw = [w.strip() for w in f if w.strip().isalpha() and w.strip().isascii()]
    common = {w.upper() for w in raw if w.islower()}
    return common, {w.upper() for w in raw if not w.islower()} - common


def inflections(base):
    """Regular English inflections of `base` (G4).

    Deliberately conservative: no consonant doubling (STOP→STOPPED), no
    irregulars. Everything generated here still has to clear the frequency bar,
    so over-generating (SAKED, WOVED) costs nothing — the corpus rejects it.
    """
    out = set()
    if base.endswith('E'):
        out |= {base + 'D', base + 'S', base + 'R'}          # BAKE → BAKED/BAKES/BAKER
    elif base.endswith('Y'):
        out |= {base[:-1] + 'IED', base[:-1] + 'IES', base + 'S'}   # DRY → DRIED/DRIES
    else:
        out |= {base + 'ED', base + 'ES', base + 'S', base + 'ER'}  # ASK → ASKED/ASKS
    return out | {base + 'ING'}


def grow_allowed(n, threshold):
    """Grow the n-letter GUESS list under the G1-G7 rule set in the module
    docstring. Returns (final, added) — and asserts G7, that nothing was lost."""
    z = zipf()
    common, proper = load_lexicon()
    current = {w for w in load_json_list(os.path.join(DATA, allowed_name(n)))}
    offensive = load_wordset(os.path.join(SCRIPT_DATA, 'offensive-blocklist.txt'))
    name_ok = load_wordset(os.path.join(SCRIPT_DATA, 'name-word-allowlist.txt'))
    blocked = load_wordset(os.path.join(SCRIPT_DATA, 'proper-noun-blocklist.txt')) - name_ok
    sols = os.path.join(DATA, 'solutions.json' if n == 5 else f'solutions-{n}.json')
    leg = os.path.join(DATA, 'solutions-legacy.json' if n == 5 else f'solutions-{n}-legacy.json')
    must = set(load_json_list(sols)) | set(load_json_list(leg))
    pat = re.compile(rf'^[A-Z]{{{n}}}$')

    # G8: hand-checked modern vocabulary the 1934 lexicon predates or omits.
    # These bypass the frequency bar and the proper-noun filter (a human already
    # made both calls) but never the offensive blocklist.
    modern = load_wordset(os.path.join(SCRIPT_DATA, 'modern-words.txt'))

    # G3 + G4: lemmas of the right length, plus inflections of any shorter lemma
    # — including the modern list, so EBOOK yields EBOOKS at n=6.
    # G5 applies to the BASE as well as the result. The blocklist holds NEGRO but
    # not NEGROS/NEGROES, and inflecting a slur produces a slur — without this the
    # 6- and 7-letter runs proposed exactly those two. Checked on the base rather
    # than by prefix, because prefix matching condemns SQUAWK, NEGRONI and
    # PONCEAU, which are ordinary words that merely start with one.
    bases = {b for b in (common | modern) if b not in offensive}
    cands = {w for w in bases if len(w) == n}
    for base in bases:
        if 2 <= len(base) < n:
            cands |= {w for w in inflections(base) if len(w) == n}

    added = set()
    for w in cands:
        if w in current or w in offensive or not pat.match(w):
            continue
        if w in modern:                                              # G8: vouched for
            added.add(w)
            continue
        if (w in proper or w in blocked) and w not in name_ok:       # G6
            continue
        if z(w) >= threshold:                                        # frequency bar
            added.add(w)

    # G1 shape + G2 answers + G7 monotonic (union with what already ships).
    final = {w for w in (current | added | must) if pat.match(w)} - offensive
    lost = {w for w in current if pat.match(w)} - final
    assert not lost, f'G7 violated — these words would stop being guessable: {sorted(lost)}'
    assert (must - offensive) <= final, 'G2 violated — an answer is not guessable'
    return sorted(final), sorted(added)


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
    ap.add_argument('--curate-allowed', type=int, choices=(6, 7),
                    help='curate the 6- or 7-letter GUESS list (allowed-N.json)')
    ap.add_argument('--grow-allowed', type=int, choices=(5, 6, 7),
                    help='GROW the n-letter guess list under the G1-G7 rule set (additive)')
    ap.add_argument('--grow-length', type=int, choices=(6, 7),
                    help='GROW the 6/7-letter ANSWER bank (append-only, §222)')
    ap.add_argument('--grow-threshold', type=float, default=GROW_THRESHOLD,
                    help=f'frequency bar for grown words (default {GROW_THRESHOLD})')
    args = ap.parse_args()

    if args.scan_only:
        scan_lengths()
        return

    if args.grow_length:
        n = args.grow_length
        final, added, skipped = grow_length(n, args.threshold)
        os.makedirs(OUT, exist_ok=True)
        z = zipf()
        with open(os.path.join(OUT, f'solutions-{n}-grown.txt'), 'w') as f:
            f.write('\n'.join(f'{w}\t{round(z(w), 2)}' for w in sorted(added)) + '\n')
        with open(os.path.join(OUT, f'solutions-{n}-skipped.txt'), 'w') as f:
            f.write('\n'.join(f'{w}\t{r}' for w, r in sorted(skipped)) + '\n')
        print(f'solutions-{n}: {len(final) - len(added)} → {len(final)}  (+{len(added)} appended — prefix frozen)')
        weakest = sorted(added, key=z)[:15]
        print('  weakest additions:', ', '.join(f'{w}({round(z(w), 2)})' for w in weakest))
        print(f'  review: scripts/out/solutions-{n}-grown.txt, solutions-{n}-skipped.txt')
        if args.write:
            write_length_bundles(n, final)
        else:
            print('  (dry run — pass --write to sync the bundles)')
        return

    if args.grow_allowed:
        n = args.grow_allowed
        final, added = grow_allowed(n, args.grow_threshold)
        before = len({w for w in load_json_list(os.path.join(DATA, allowed_name(n)))
                      if re.match(rf'^[A-Z]{{{n}}}$', w)})
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, f'allowed-{n}-added.txt'), 'w') as f:
            f.write('\n'.join(added) + '\n')
        print(f'{allowed_name(n)}: {before} → {len(final)}  (+{len(added)} added, 0 removed — G7)')
        print(f'  review: {os.path.relpath(os.path.join(OUT, f"allowed-{n}-added.txt"), REPO)}')
        if args.write:
            write_allowed_bundles(n, final)
        else:
            print('  (dry run — pass --write to sync the bundles)')
        return

    if args.curate_allowed:
        n = args.curate_allowed
        kept, cut = curate_allowed(n)
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, f'allowed-{n}-kept.txt'), 'w') as f:
            f.write('\n'.join(sorted(kept)) + '\n')
        with open(os.path.join(OUT, f'allowed-{n}-cut.txt'), 'w') as f:
            f.write('\n'.join(f'{w}\t{r}' for w, r in sorted(cut)) + '\n')
        print(f'allowed-{n}: kept={len(kept)} cut={len(cut)} '
              f'(review scripts/out/allowed-{n}-kept.txt, allowed-{n}-cut.txt)')
        if args.write:
            write_allowed_bundles(n, kept)
        else:
            print('(dry run — no bundles written)')
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
    for t in (2.5, 3.0, 3.2, 3.5, 4.0):
        k, _, _, _ = curate(t, args.promote)
        print(f'  zipf>={t}: {len(k)} words')

    kept, cut, promoted, legacy_set = curate(args.threshold, args.promote)
    write_review(kept, cut, promoted)
    print(f'\n=== threshold {args.threshold} ===')
    print(f'legacy: {len(legacy_set)} | kept: {len(kept)} '
          f'(promoted-in: {len(promoted)}, cut-from-legacy: {len(cut)})')
    print(f'review files → {os.path.relpath(OUT, REPO)}/(kept|cut|promoted).txt')

    years = len(kept) / 365.0
    print(f'\n  bank size {len(kept)} -> {years:.1f} years before a Classic answer repeats')
    if len(kept) < COMFORTABLE_MIN:
        print(f'  !! below {COMFORTABLE_MIN}: repeats get noticeable. Consider a LOWER bar')
        print( '     only if you accept the rarer words that come with it.')
        if args.write:
            sys.exit(f'refusing to --write: {len(kept)} words is below the comfort floor '
                     f'({COMFORTABLE_MIN}). Lower --threshold deliberately, or accept repeats.')
    else:
        print( '  Size is comfortable. Do NOT lower the threshold to grow it further.')

    if args.write:
        print('\nwriting curated list to bundle dirs:')
        write_bundles(kept)
    else:
        print('\n(dry run — no bundles written. Review the lists, then re-run with --write.)')


if __name__ == '__main__':
    main()
