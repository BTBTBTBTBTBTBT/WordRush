#!/usr/bin/env python3
"""Offline word-frequency table for the Hubbub everyday-word audit (Friday queue item 33).

Prints JSON {WORD: zipf} for every lowercase a-z word of 4+ letters in wordfreq's English
list whose Zipf frequency is at least --min (default 1.9). wordfreq is installed offline with
`python3 -m pip install --user wordfreq` (user site, so run this WITHOUT -I).

  python3 scripts/puzzles/hubbub-freq.py [--min 1.9]
"""
import json
import re
import sys

try:
    from wordfreq import top_n_list, zipf_frequency
except ImportError:  # pragma: no cover
    sys.stderr.write("wordfreq missing: python3 -m pip install --user wordfreq\n")
    sys.exit(2)

floor = 1.9
if "--min" in sys.argv:
    floor = float(sys.argv[sys.argv.index("--min") + 1])

out = {}
for w in top_n_list("en", 600000):
    if not re.fullmatch(r"[a-z]{4,}", w):
        continue
    z = zipf_frequency(w, "en")
    if z >= floor:
        out[w.upper()] = round(z, 2)
json.dump(out, sys.stdout, separators=(",", ":"))
