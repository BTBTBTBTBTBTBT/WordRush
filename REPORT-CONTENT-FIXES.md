# Content fixes — 2026-10-06 (prompts 05, 05b, 05c)

Applies `REPORT-CONTENT-AUDIT.md` to every game's content, makes everyday words always accepted (05b), and
makes content safety automatic for every current and future game (05c). Branch `cloud/content-fixes`.

**Masking policy.** No offensive word appears in plain text here or anywhere in this change. A flagged item is
named by game + date/index + a masked form (first letter + asterisks). Offensive lists and swap keys are stored
base64-encoded and decoded at run time. The gate's leak scan (G11) enforces this. The tables below are generated
from the banks themselves (a diff against the audited commit `843a2aa`), so they list **every** change.

## Summary

| Area | What changed |
|---|---|
| Classic-family answer pools | **Swap batch 4**: 283 in-place swaps (5/6/7 letters) in `solution-swaps.ts`, `SolutionSwaps.swift` and `SolutionSwaps.kt`. **Cutover 2026-10-13.** 64 keys stored base64. |
| Crosswordocious | 152 future puzzles: clues and answers rewritten; every swap keeps all crossings and one `____` per clue. |
| Muddle | 93 future puzzles: words, finals, captions and alt text. |
| Hubbub | 580 future puzzles: 49 offensive words no longer accepted; 666 British, obscure or proper-noun words moved from scored to bonus; 55,099 junk bonus words dropped (05b); 38 puzzles get a fresh letter set (8 lost their only pangram, 30 fell under the 20-word minimum). |
| Letter Ladder | 38 future ladders re-pathed; the hint/accept list rebuilt (2,499 words). |
| Kindred | 112 future puzzles: groups and labels. |
| Spyglass | 55 future puzzles re-laid; 34 theme pools edited. |
| Codebreaker | 51 future sayings. |
| ProperNoundle | 25 never-served entries. |
| Guess lists (`allowed*.json`) | Unchanged. They are append-only (`word-list-sync.test.ts`). Every must-accept word was already in them (G8). |
| 05b | Must-accept list (1,036 everyday words) + guard G8; Hubbub accepts every one that fits; obscure bonus words dropped; "Already found" proven on all three platforms. |
| 05c | Shared content-safety module, bank registry, `npm run content:check` in CI (12 guards, ~4 s), generators gated, `docs/CONTENT-SAFETY.md`. |

Rules kept throughout:
- **Served content is frozen.** Edits touch only dailies from `CONTENT_RELEASE_DATE` (now **2026-10-13**), the Unlimited pools, and holiday entries never served. G10 proves this against a snapshot of all 728 served entries.
- **The three platforms stay byte-identical.** iOS and Android copies match web (G9), synced with `npm run content:sync`.
- **Each game keeps its rules.** Every bank test passes unchanged.
- American spelling, all-ages content.

## The cutover — 2026-10-13

- **Why this date:**
  - It's the earliest day after today (10-06) that a coordinated build can carry. Builds are expected around 10-12.
  - Daily results are not verified on the server, so an older build dealing the old word can't break a score.
  - VS matches get their words from the server (`match_start`), so VS switches the moment the server deploys.
- **What moves on that date:**
  - `SOLUTION_SWAP_4_CUTOVER_DATE = '2026-10-13'` in all three ports.
  - `CONTENT_RELEASE_DATE = '2026-10-13'` (`apps/web/scripts/content-release-date.mjs`).
- **Mechanism:**
  - `solutionSwapBatchesFor(date)` now returns a bitmask (1, 2, 4, 8 = batches 1–4).
  - Batches 2 and 3 keep their 2026-11-16 cutover, so 10-13 → 11-15 deals batches 1 + 4, and from 11-16 all four.
  - Dictionary caches are keyed by the mask.
  - The old words stay valid guesses.
- **Pinned deals:** Swift, Kotlin and TS tests pin the same deals:
  - `daily-2026-10-12-GAUNTLET` slice still deals AMINO;
  - `daily-2026-10-14-DUEL_6` deals SUITOR;
  - `daily-2026-11-03-GAUNTLET` deals PHASE for a masked key;
  - the batch-2/4 interplay on `daily-2026-10-28-DUEL_7`.
- **Moving the date:** if the release slips past 10-12, move both constants together. Then refresh the served snapshot (`node apps/web/scripts/content-snapshot.mjs --ref=<live commit>`) and update the pinned deals.

### Exposure list

**Dealt before the cutover (every app version).** Batch-4 words still dealt between today and 10-12:

| Date | Mode | Word | Replaced by |
|---|---|---|---|
| 2026-10-09 | Deliverance | TERRY | GLITZ (from 10-13) |
| 2026-10-11 | OctoWord | HIPPY | ANTSY (from 10-13) |
| 2026-10-12 | Gauntlet | AMINO | WISPY (from 10-13) |

**Old app versions after the cutover.** A build without the batch-4 table keeps dealing the old word in that slot. Classic-family dailies, 2026-10-13 → 2026-12-31: 54 deals in 40 days (8 of them offensive words, masked).

<details><summary>All 54 old-version deals</summary>

| Date | Mode | Old build deals | New build deals |
|---|---|---|---|
| 2026-10-14 | Six | LATINO | SUITOR |
| 2026-10-17 | QuadWord | EUROS | CLEAT |
| 2026-10-17 | Succession | B**** | LAYUP |
| 2026-10-23 | Gauntlet | DUCHY | GEEKY |
| 2026-10-27 | QuadWord | REMIT | BLURB |
| 2026-10-28 | QuadWord | F**** | TAUPE |
| 2026-10-29 | OctoWord | HYDRO | FOAMY |
| 2026-10-30 | Gauntlet | F**** | DECAL |
| 2026-10-31 | QuadWord | COSTA | CRYPT |
| 2026-11-02 | Gauntlet | FRANC | GAFFE |
| 2026-11-02 | Gauntlet | HEATH | MOSSY |
| 2026-11-03 | Gauntlet | BOWIE | BIKER |
| 2026-11-03 | Gauntlet | P**** | PHASE |
| 2026-11-04 | OctoWord | B**** | CORGI |
| 2026-11-07 | Gauntlet | SHIRE | GUSTY |
| 2026-11-08 | Deliverance | MINCE | SAUTE |
| 2026-11-09 | Deliverance | S**** | CONDO |
| 2026-11-09 | Deliverance | BLANC | CHIVE |
| 2026-11-12 | Gauntlet | F**** | TAUPE |
| 2026-11-13 | Gauntlet | INTER | BORED |
| 2026-11-14 | Gauntlet | COSTA | CRYPT |
| 2026-11-15 | OctoWord | P**** | PHASE |
| 2026-11-18 | Gauntlet | SHIRE | GUSTY |
| 2026-11-20 | Gauntlet | BOWIE | BIKER |
| 2026-11-20 | Gauntlet | B**** | LAYUP |
| 2026-11-20 | Gauntlet | S**** | CONDO |
| 2026-11-20 | Gauntlet | REMIT | BLURB |
| 2026-11-21 | Six | SLATER | TAMPER |
| 2026-11-22 | Succession | MAMMA | KIDDO |
| 2026-11-25 | Gauntlet | AMINO | WISPY |
| 2026-11-27 | Gauntlet | HIPPY | ANTSY |
| 2026-12-02 | Six | S***** | CLUNKY |
| 2026-12-05 | Gauntlet | B**** | CORGI |
| 2026-12-06 | Gauntlet | BLANC | CHIVE |
| 2026-12-08 | Gauntlet | F**** | DECAL |
| 2026-12-12 | Gauntlet | DUCHY | GEEKY |
| 2026-12-12 | Gauntlet | TERRY | GLITZ |
| 2026-12-14 | Gauntlet | R**** | ALOHA |
| 2026-12-15 | Gauntlet | FRANC | GAFFE |
| 2026-12-16 | Gauntlet | T**** | EMOJI |
| 2026-12-16 | Gauntlet | B**** | ZESTY |
| 2026-12-18 | QuadWord | EUROS | CLEAT |
| 2026-12-18 | QuadWord | TERRA | MUGGY |
| 2026-12-20 | Gauntlet | MINCE | SAUTE |
| 2026-12-21 | Succession | HEATH | MOSSY |
| 2026-12-25 | OctoWord | BLANC | CHIVE |
| 2026-12-25 | Gauntlet | T**** | EMOJI |
| 2026-12-27 | OctoWord | AMINO | WISPY |
| 2026-12-28 | Deliverance | EUROS | CLEAT |
| 2026-12-28 | Six | V***** | SERENE |
| 2026-12-29 | Gauntlet | MINCE | SAUTE |
| 2026-12-29 | Gauntlet | TERRY | GLITZ |
| 2026-12-29 | Gauntlet | TERRA | MUGGY |
| 2026-12-30 | Gauntlet | BOWIE | BIKER |

</details>

Bank items dated 10-09 → 10-12 also stay as already bundled:
- the Crosswordocious daily of 10-09 (`cw-ha3thp`, one masked clue);
- the ProperNoundle Indigenous Peoples’ Day entry on 10-12 (`hol-indigenous-1`, a duplicate of a rotation answer).

The audit (`REPORT-CONTENT-AUDIT.md`) lists every flagged item dated before the cutover.

## Swap batch 4 — all 283 swaps

Same length, common American words, guessable, not in any current or legacy pool, not an earlier batch's key
or replacement, and clean under the safety module (SURREY's first pick was replaced by SPIFFY when the hygiene
test caught a root inside it). Not swapped: the 14 `PENDING_FOUNDER_CALL` words in `answer-pool-hygiene.test.ts`
(still the founder's call; G1 reports them and never fails on them).

<details><summary>All 283 swaps</summary>

| Pool | Index | Old (masked) | New | Why (audit) |
|---|---|---|---|---|
| solutions.json | 122 | DUCHY | GEEKY | obscure / low |
| solutions.json | 182 | B**** | LAYUP | inappropriate / low |
| solutions.json | 225 | TERRA | MUGGY | obscure / low |
| solutions.json | 302 | MAMMA | KIDDO | obscure / low |
| solutions.json | 358 | TERRY | GLITZ | proper-noun / low |
| solutions.json | 410 | B**** | CORGI | inappropriate / high |
| solutions.json | 466 | SHIRE | GUSTY | british / low |
| solutions.json | 502 | R**** | ALOHA | inappropriate / medium |
| solutions.json | 596 | BLANC | CHIVE | obscure / medium |
| solutions.json | 618 | INTER | BORED | obscure / low |
| solutions.json | 664 | B**** | ZESTY | inappropriate / low |
| solutions.json | 706 | HIPPY | ANTSY | obscure / low |
| solutions.json | 709 | MINCE | SAUTE | british / low |
| solutions.json | 719 | EUROS | CLEAT | obscure / low |
| solutions.json | 735 | S**** | CONDO | inappropriate / medium |
| solutions.json | 753 | F**** | DECAL | content gate (second pass) |
| solutions.json | 789 | HEATH | MOSSY | british / low |
| solutions.json | 844 | HYDRO | FOAMY | obscure / low |
| solutions.json | 860 | FRANC | GAFFE | obscure / low |
| solutions.json | 884 | AMINO | WISPY | obscure / low |
| solutions.json | 999 | COSTA | CRYPT | proper-noun / medium |
| solutions.json | 1007 | T**** | EMOJI | inappropriate / medium |
| solutions.json | 1072 | P**** | PHASE | inappropriate / high |
| solutions.json | 1111 | BOWIE | BIKER | proper-noun / medium |
| solutions.json | 1241 | F**** | TAUPE | inappropriate / low |
| solutions.json | 1442 | REMIT | BLURB | british / low |
| solutions-6.json | 66 | ZEPHYR | SQUALL | obscure / low |
| solutions-6.json | 241 | COMELY | SNAZZY | obscure / low |
| solutions-6.json | 280 | A***** | WHOOSH | inappropriate / low |
| solutions-6.json | 440 | EXPIRY | UPTICK | british / medium |
| solutions-6.json | 493 | EYELET | TASSEL | obscure / low |
| solutions-6.json | 559 | CANTON | GROTTO | proper-noun / low |
| solutions-6.json | 671 | SLUICE | SPRAWL | obscure / low |
| solutions-6.json | 759 | AORTIC | HICCUP | obscure / medium |
| solutions-6.json | 766 | BONITO | MINNOW | obscure / medium |
| solutions-6.json | 785 | M***** | SPONGY | inappropriate / low |
| solutions-6.json | 843 | ALBEDO | AMOEBA | obscure / high |
| solutions-6.json | 854 | B***** | TEACUP | inappropriate / low |
| solutions-6.json | 945 | NOUGHT | PRESTO | british / high |
| solutions-6.json | 978 | HAPTIC | KEYPAD | obscure / medium |
| solutions-6.json | 1000 | M***** | SWERVE | inappropriate / low |
| solutions-6.json | 1065 | TIPPLE | FROTHY | british / medium |
| solutions-6.json | 1104 | F***** | NUZZLE | inappropriate / high |
| solutions-6.json | 1130 | HOWLER | WHAMMY | british / low |
| solutions-6.json | 1134 | GARRET | MANTEL | obscure / low |
| solutions-6.json | 1163 | SMITHY | WELDER | obscure / medium |
| solutions-6.json | 1165 | BATTEN | GIRDER | obscure / medium |
| solutions-6.json | 1185 | DINGLE | SQUEAK | obscure / high |
| solutions-6.json | 1187 | V***** | SERENE | inappropriate / medium |
| solutions-6.json | 1215 | CAMBER | STUCCO | obscure / high |
| solutions-6.json | 1230 | STOKER | SKEWER | obscure / low |
| solutions-6.json | 1250 | CLARET | PAPAYA | british / medium |
| solutions-6.json | 1253 | DIPOLE | DIPPER | obscure / high |
| solutions-6.json | 1290 | FOOTED | TRYOUT | obscure / low |
| solutions-6.json | 1318 | CUPOLA | PAGODA | obscure / medium |
| solutions-6.json | 1338 | TOGGLE | BEANIE | obscure / medium |
| solutions-6.json | 1348 | SNOOPY | SNARKY | proper-noun / high |
| solutions-6.json | 1396 | JASPER | PEWTER | proper-noun / medium |
| solutions-6.json | 1492 | JOINER | PUTTER | british / low |
| solutions-6.json | 1503 | WRIGHT | SCULPT | proper-noun / high |
| solutions-6.json | 1519 | CARDED | CHALKY | obscure / medium |
| solutions-6.json | 1543 | COCKLE | SEESAW | content gate (second pass) |
| solutions-6.json | 1570 | AMBLER | SLOUCH | obscure / high |
| solutions-6.json | 1681 | DREAMT | MUTTER | british / medium |
| solutions-6.json | 1687 | LAMBDA | HYPHEN | obscure / medium |
| solutions-6.json | 1699 | SURREY | SPIFFY | proper-noun / high |
| solutions-6.json | 1703 | HARPER | CADDIE | proper-noun / medium |
| solutions-6.json | 1712 | O***** | RUDELY | inappropriate / low |
| solutions-6.json | 1715 | KINASE | OSPREY | obscure / high |
| solutions-6.json | 1716 | S***** | CLUNKY | inappropriate / low |
| solutions-6.json | 1718 | CHEEKY | PLUCKY | british / medium |
| solutions-6.json | 1720 | P***** | GROGGY | inappropriate / medium |
| solutions-6.json | 1751 | N***** | WHIMSY | inappropriate / high |
| solutions-6.json | 1760 | SCOTCH | TUSSLE | proper-noun / low |
| solutions-6.json | 1777 | W***** | PANINI | inappropriate / low |
| solutions-6.json | 1786 | KANSAS | MIDAIR | proper-noun / high |
| solutions-6.json | 1799 | MORROW | WINTRY | obscure / low |
| solutions-6.json | 1808 | PACERS | SPRAIN | proper-noun / high |
| solutions-6.json | 1816 | CICERO | ORATOR | proper-noun / high |
| solutions-6.json | 1817 | BASQUE | QUICHE | proper-noun / high |
| solutions-6.json | 1823 | J***** | PREPPY | inappropriate / high |
| solutions-6.json | 1854 | LINDEN | DAHLIA | obscure / low |
| solutions-6.json | 1859 | SOVIET | TUMULT | proper-noun / medium |
| solutions-6.json | 1861 | SCHEMA | ITALIC | obscure / medium |
| solutions-6.json | 1875 | SALAAM | CUTOUT | obscure / high |
| solutions-6.json | 1887 | BANGER | SIZZLE | british / high |
| solutions-6.json | 1901 | LAGUNA | SWAMPY | proper-noun / medium |
| solutions-6.json | 1903 | COOKER | OMELET | british / medium |
| solutions-6.json | 1905 | DECKER | SLEUTH | obscure / medium |
| solutions-6.json | 1914 | ZIMMER | STUBBY | proper-noun / high |
| solutions-6.json | 1916 | BOURNE | SIESTA | proper-noun / high |
| solutions-6.json | 1919 | MOZART | SONNET | proper-noun / high |
| solutions-6.json | 1933 | B***** | GOATEE | inappropriate / low |
| solutions-6.json | 1941 | GENERA | GAGGLE | obscure / medium |
| solutions-6.json | 1949 | MEDIAL | CORNEA | obscure / medium |
| solutions-6.json | 1952 | LANCET | SPLINT | obscure / medium |
| solutions-6.json | 1960 | A***** | SQUEAL | inappropriate / medium |
| solutions-6.json | 1976 | CAIRNS | CRUTCH | proper-noun / medium |
| solutions-6.json | 1980 | C***** | BONSAI | inappropriate / high |
| solutions-6.json | 1984 | SLATER | TAMPER | proper-noun / high |
| solutions-6.json | 1998 | ENSUES | FALTER | obscure / low |
| solutions-6.json | 2003 | R***** | CANDOR | inappropriate / low |
| solutions-6.json | 2004 | TENSOR | TOFFEE | obscure / high |
| solutions-6.json | 2012 | RECTOR | PONCHO | obscure / low |
| solutions-6.json | 2014 | SIXERS | DOLLOP | proper-noun / high |
| solutions-6.json | 2015 | THRICE | PRESET | obscure / low |
| solutions-6.json | 2016 | MULLER | SPACER | proper-noun / high |
| solutions-6.json | 2031 | CUTLER | SKIMPY | proper-noun / high |
| solutions-6.json | 2039 | PASSER | REFUEL | obscure / low |
| solutions-6.json | 2040 | R***** | BUNGEE | inappropriate / high |
| solutions-6.json | 2068 | DISTAL | GRAINY | obscure / medium |
| solutions-6.json | 2077 | BATMAN | MUDDLE | proper-noun / high |
| solutions-6.json | 2087 | V***** | WASABI | proper-noun / high |
| solutions-6.json | 2093 | SPOILT | SMUDGE | british / medium |
| solutions-6.json | 2110 | RIDLEY | SNOOZE | proper-noun / high |
| solutions-6.json | 2137 | UNICEF | PAJAMA | proper-noun / high |
| solutions-6.json | 2143 | WICKET | HOODIE | british / medium |
| solutions-6.json | 2144 | MANILA | SELFIE | proper-noun / medium |
| solutions-6.json | 2148 | STILES | SCYTHE | obscure / medium |
| solutions-6.json | 2154 | BETHEL | SWEATY | proper-noun / high |
| solutions-6.json | 2156 | LATINO | SUITOR | proper-noun / medium |
| solutions-6.json | 2157 | SLOUGH | SQUIRM | obscure / medium |
| solutions-6.json | 2159 | FISHER | ANGLER | proper-noun / medium |
| solutions-6.json | 2194 | APACHE | POSSUM | proper-noun / high |
| solutions-6.json | 2205 | H***** | MAYDAY | inappropriate / high |
| solutions-6.json | 2221 | U***** | CANOLA | inappropriate / low |
| solutions-6.json | 2224 | R***** | PAYOUT | inappropriate / low |
| solutions-6.json | 2232 | G***** | EATERY | inappropriate / medium |
| solutions-6.json | 2237 | SEXTON | MUSKET | obscure / medium |
| solutions-6.json | 2241 | CAPITA | ACUMEN | obscure / high |
| solutions-6.json | 2268 | BLOODY | CHOPPY | british / medium |
| solutions-6.json | 2269 | SPICER | POINTY | proper-noun / high |
| solutions-6.json | 2273 | L***** | REWIND | inappropriate / low |
| solutions-6.json | 2275 | ANNALS | TROPIC | obscure / low |
| solutions-6.json | 2280 | EUROPE | COLLIE | proper-noun / high |
| solutions-6.json | 2289 | PRIORY | DINGHY | british / medium |
| solutions-6.json | 2292 | THENCE | LEEWAY | obscure / medium |
| solutions-6.json | 2315 | H***** | MOUSSE | inappropriate / low |
| solutions-6.json | 2331 | LIGAND | MUSSEL | obscure / high |
| solutions-6.json | 2333 | QUAKER | OBLONG | proper-noun / high |
| solutions-6.json | 2335 | FULLER | STOCKY | proper-noun / medium |
| solutions-6.json | 2336 | CORPUS | PATINA | obscure / medium |
| solutions-6.json | 2338 | S***** | SCURRY | inappropriate / medium |
| solutions-6.json | 2349 | DOBSON | BELUGA | proper-noun / high |
| solutions-6.json | 2393 | NISSAN | BIONIC | proper-noun / high |
| solutions-6.json | 2394 | WHISKY | KIMONO | british / medium |
| solutions-6.json | 2425 | METHYL | AIRBAG | obscure / high |
| solutions-6.json | 2427 | B***** | SHRILL | inappropriate / medium |
| solutions-6.json | 2432 | BODIED | SLIVER | obscure / medium |
| solutions-6.json | 2445 | OCULUS | EERILY | obscure / high |
| solutions-6.json | 2449 | LEVANT | GLASSY | proper-noun / high |
| solutions-6.json | 2455 | KENYAN | SPOTTY | proper-noun / high |
| solutions-6.json | 2498 | HAIRED | FRIZZY | obscure / medium |
| solutions-6.json | 2499 | SQUIRE | CANTER | obscure / low |
| solutions-6.json | 2504 | BOWMAN | JACKAL | obscure / medium |
| solutions-6.json | 2507 | REEVES | STINKY | proper-noun / high |
| solutions-6.json | 2518 | PLANAR | NEGATE | obscure / medium |
| solutions-6.json | 2525 | BOOKER | BURLAP | proper-noun / medium |
| solutions-6.json | 2528 | R***** | HAGGLE | inappropriate / medium |
| solutions-6.json | 2534 | CANTOR | SHRIEK | obscure / medium |
| solutions-6.json | 2564 | DODGER | SUPPLE | proper-noun / low |
| solutions-6.json | 2565 | S***** | MILDEW | inappropriate / high |
| solutions-6.json | 2583 | DHARMA | WALLOP | obscure / medium |
| solutions-6.json | 2586 | DRAPER | RUFFLE | obscure / medium |
| solutions-6.json | 2596 | PIAZZA | ENTREE | obscure / low |
| solutions-6.json | 2608 | BARROW | TOMBOY | british / medium |
| solutions-6.json | 2613 | HOOVER | BASSET | proper-noun / high |
| solutions-6.json | 2616 | WAGNER | BELLOW | proper-noun / high |
| solutions-6.json | 2635 | G***** | SWATCH | inappropriate / low |
| solutions-6.json | 2637 | LEGGED | PERUSE | obscure / medium |
| solutions-6.json | 2663 | MERCER | WOOLEN | proper-noun / high |
| solutions-6.json | 2664 | UNWELL | QUEASY | british / low |
| solutions-6.json | 2668 | GUINEA | GIBBON | proper-noun / medium |
| solutions-6.json | 2675 | OILERS | TWISTY | proper-noun / high |
| solutions-6.json | 2687 | HOBBIT | URCHIN | proper-noun / medium |
| solutions-6.json | 2711 | S***** | SULLEN | inappropriate / medium |
| solutions-6.json | 2717 | GRANGE | QUINCE | obscure / medium |
| solutions-6.json | 2734 | CAYMAN | WEEVIL | proper-noun / high |
| solutions-6.json | 2752 | YAKUZA | PINKIE | proper-noun / medium |
| solutions-6.json | 2760 | BRUINS | RECAST | proper-noun / high |
| solutions-6.json | 2761 | PORTED | REHEAT | obscure / low |
| solutions-6.json | 2774 | PUNTER | TIRADE | british / high |
| solutions-6.json | 2779 | WHENCE | UNSUNG | obscure / medium |
| solutions-6.json | 2788 | B***** | WALLOW | inappropriate / low |
| solutions-6.json | 2798 | LISTER | LEVITY | proper-noun / high |
| solutions-6.json | 2816 | AIRBUS | BRAINY | proper-noun / high |
| solutions-6.json | 2822 | C***** | SILKEN | inappropriate / medium |
| solutions-6.json | 2845 | ULSTER | HOARSE | proper-noun / high |
| solutions-6.json | 2855 | CONTRA | PACIFY | proper-noun / medium |
| solutions-6.json | 2859 | H***** | IMPROV | inappropriate / high |
| solutions-7.json | 6 | WASTAGE | SAWDUST | british / low |
| solutions-7.json | 91 | STRIDER | WIPEOUT | obscure / medium |
| solutions-7.json | 263 | ENQUIRE | NOURISH | british / high |
| solutions-7.json | 289 | F****** | CURSIVE | inappropriate / low |
| solutions-7.json | 443 | ISLAMIC | ORIGAMI | proper-noun / high |
| solutions-7.json | 458 | INSHORE | RIPTIDE | obscure / low |
| solutions-7.json | 626 | COGNATE | NUMERAL | obscure / low |
| solutions-7.json | 630 | RUBBISH | TAKEOUT | british / high |
| solutions-7.json | 646 | H****** | FIDDLER | inappropriate / low |
| solutions-7.json | 706 | INWARDS | FARAWAY | british / low |
| solutions-7.json | 856 | SIMPLEX | OCTAGON | obscure / medium |
| solutions-7.json | 921 | F****** | FLIPPER | inappropriate / high |
| solutions-7.json | 982 | WAISTED | PLEATED | obscure / medium |
| solutions-7.json | 1117 | POLITIC | TACTFUL | obscure / low |
| solutions-7.json | 1206 | BOLIVIA | SAVANNA | proper-noun / high |
| solutions-7.json | 1215 | THEREOF | ANYTIME | obscure / low |
| solutions-7.json | 1234 | S****** | OFFBEAT | inappropriate / medium |
| solutions-7.json | 1244 | CENTRIC | NUANCED | obscure / low |
| solutions-7.json | 1250 | HECTARE | HEXAGON | obscure / medium |
| solutions-7.json | 1253 | P****** | NECKTIE | inappropriate / high |
| solutions-7.json | 1264 | PLENARY | WEBINAR | obscure / low |
| solutions-7.json | 1302 | ORIOLES | BUZZARD | proper-noun / low |
| solutions-7.json | 1314 | G****** | PEEKING | inappropriate / high |
| solutions-7.json | 1329 | DICKENS | STENCIL | proper-noun / medium |
| solutions-7.json | 1338 | CHAPMAN | DOORMAN | proper-noun / high |
| solutions-7.json | 1345 | GOOGLED | BROWSED | proper-noun / low |
| solutions-7.json | 1435 | BULLOCK | CARIBOU | british / medium |
| solutions-7.json | 1460 | FANCIED | TEARFUL | british / low |
| solutions-7.json | 1473 | DRACULA | GREMLIN | proper-noun / high |
| solutions-7.json | 1480 | TWITTER | HASHTAG | proper-noun / medium |
| solutions-7.json | 1513 | UTERINE | MIXTAPE | content gate (second pass) |
| solutions-7.json | 1544 | MIDLAND | MIDTOWN | proper-noun / medium |
| solutions-7.json | 1645 | BLOODED | MUSCLED | obscure / low |
| solutions-7.json | 1659 | F****** | ODDBALL | inappropriate / low |
| solutions-7.json | 1669 | G****** | SHOWMAN | inappropriate / medium |
| solutions-7.json | 1687 | BRONCOS | STIRRUP | proper-noun / medium |
| solutions-7.json | 1693 | MARQUIS | CHARADE | obscure / low |
| solutions-7.json | 1699 | POLLARD | SAPLING | obscure / high |
| solutions-7.json | 1747 | PEPTIDE | MICROBE | obscure / low |
| solutions-7.json | 1749 | FLEMISH | CHOWDER | proper-noun / high |
| solutions-7.json | 1759 | T****** | SATCHEL | inappropriate / high |
| solutions-7.json | 1793 | P****** | COPYCAT | inappropriate / high |
| solutions-7.json | 1814 | SIEMENS | CHECKUP | proper-noun / high |
| solutions-7.json | 1821 | BESPOKE | THRIFTY | british / medium |
| solutions-7.json | 1826 | HACKNEY | TAXICAB | british / high |
| solutions-7.json | 1866 | WHITING | SARDINE | obscure / low |
| solutions-7.json | 1877 | AQUEOUS | RUBBERY | obscure / low |
| solutions-7.json | 1882 | THEREIN | OFFLINE | obscure / low |
| solutions-7.json | 1889 | SUBUNIT | ROADMAP | obscure / low |
| solutions-7.json | 1893 | S****** | CLAMPED | inappropriate / low |
| solutions-7.json | 1912 | S****** | ENTICED | inappropriate / low |
| solutions-7.json | 1923 | PREFECT | CATERER | british / medium |
| solutions-7.json | 1931 | RAILWAY | AIRFARE | british / low |
| solutions-7.json | 1982 | VENTRAL | NOSTRIL | obscure / low |
| solutions-7.json | 1983 | LOOSING | MOPPING | obscure / medium |
| solutions-7.json | 2025 | PORTAGE | CABOOSE | obscure / low |
| solutions-7.json | 2026 | P****** | HOTSHOT | inappropriate / high |
| solutions-7.json | 2035 | A****** | DAZZLED | inappropriate / medium |
| solutions-7.json | 2069 | UNITARY | PREQUEL | obscure / low |
| solutions-7.json | 2110 | POLLOCK | HALIBUT | proper-noun / high |
| solutions-7.json | 2117 | R****** | BANDANA | inappropriate / high |
| solutions-7.json | 2132 | HANOVER | VERANDA | proper-noun / high |
| solutions-7.json | 2224 | H****** | MEERKAT | inappropriate / low |
| solutions-7.json | 2226 | COROLLA | SIDECAR | proper-noun / high |
| solutions-7.json | 2228 | SNOOKER | CROQUET | british / medium |
| solutions-7.json | 2250 | L****** | LOGBOOK | inappropriate / low |
| solutions-7.json | 2269 | COULTER | TOPSOIL | proper-noun / high |
| solutions-7.json | 2276 | BOTANIC | PETUNIA | obscure / low |
| solutions-7.json | 2280 | COLLIER | TRUCKER | british / medium |
| solutions-7.json | 2295 | NETBALL | RAFTING | british / high |
| solutions-7.json | 2389 | SPECTRA | SUNSPOT | obscure / low |
| solutions-7.json | 2410 | SPIEGEL | SPATULA | proper-noun / high |
| solutions-7.json | 2411 | PARSONS | BARISTA | proper-noun / high |
| solutions-7.json | 2448 | S****** | PENSIVE | inappropriate / low |
| solutions-7.json | 2449 | A****** | RETIREE | inappropriate / low |
| solutions-7.json | 2466 | BATSMAN | SLUGGER | british / high |
| solutions-7.json | 2489 | L****** | DIEHARD | inappropriate / low |
| solutions-7.json | 2510 | SKINNER | DRIFTER | obscure / medium |
| solutions-7.json | 2518 | ENQUIRY | AMENITY | british / high |
| solutions-7.json | 2539 | A****** | ANAGRAM | inappropriate / low |
| solutions-7.json | 2551 | COOKERY | COOKOUT | british / low |
| solutions-7.json | 2566 | TRIPOLI | LAYOVER | proper-noun / high |
| solutions-7.json | 2572 | MAHATMA | MATINEE | proper-noun / high |
| solutions-7.json | 2642 | GRANGER | JUGGLER | proper-noun / high |
| solutions-7.json | 2659 | LANGLEY | KEYHOLE | proper-noun / high |
| solutions-7.json | 2702 | MAGNETO | TOOLKIT | proper-noun / medium |
| solutions-7.json | 2706 | HEPATIC | EARDRUM | obscure / medium |
| solutions-7.json | 2714 | TALIBAN | TRINKET | proper-noun / high |
| solutions-7.json | 2821 | A****** | ELATION | inappropriate / medium |
| solutions-7.json | 2838 | IRONMAN | JETPACK | proper-noun / medium |
| solutions-7.json | 2856 | TOOTHED | MOONLIT | obscure / low |
| solutions-7.json | 2876 | TEMPLAR | SCEPTER | proper-noun / high |
| solutions-7.json | 2897 | GEARBOX | SUNROOF | british / medium |

</details>

## Every bank change (future puzzles only)

### Crosswordocious — 152 puzzle(s) changed (`apps/web/data/crossword-puzzles.json`)

<details><summary>All 152 changes</summary>

| Puzzle | Date | Change (masked) | Why |
|---|---|---|---|
| cw-oifdt6 | 2026-10-17 | 9A THOUGHTS “On second ____” → THOUGHTS “Having second ____” | british |
| cw-wbq5gb | 2026-10-19 | 12A SENSE “Use some horse ____” → SENSE “Common ____” | clue |
| cw-yv01kq | 2026-10-20 | 1D STING “A ____ in the tail” → STING “Float like a butterfly, ____ like a bee”<br>2D BALLOON “Go down like a lead ____” → BALLOON “Go over like a lead ____” | british |
| cw-m7qx2e | 2026-10-22 | 3D WAGON “Hitch your ____ to a star” → BATON “Pass the ____” | duplicate |
| cw-ys3m36 | 2026-10-23 | 4A MILK “Don't cry over spilt ____” → MILK “Don't cry over spilled ____” | british |
| cw-qx8zy8 | 2026-10-27 | 1D WINDOW “A ____ of opportunity” → WINDOW “Go ____ shopping” | clue |
| cw-b6jmeo | 2026-10-31 | 1D GANDER “Sauce for the goose is sauce for the ____” → GANDER “What's good for the goose is good for the ____” | british |
| cw-19a1qb | 2026-11-03 | 9D BUSH “Beat about the ____” → BUSH “Beat around the ____” | british |
| cw-bzwni7 | 2026-11-04 | 3D STABLE “Lock the ____ door after the horse has bolted” → STABLE “Horses bedded down in the ____” | british |
| cw-w9mzm1 | 2026-11-05 | 4A GOLDEN “Speech is silver, silence is ____” → GOLDEN “Do unto others: the ____ rule” | clue |
| cw-2iaydx | 2026-11-06 | 3D CORN “Little Boy Blue, the cow's in the ____” → CURE “An ounce of prevention is worth a pound of ____” | stem repeat in grid |
| cw-c3jdpw | 2026-11-08 | 7A BRASS “Bold as ____” → BRASS “Get down to ____ tacks” | british |
| cw-4o254u | 2026-11-12 | 1A COWS “Till the ____ come home” → COWS “Holy ____!” | clue |
| cw-3gyqzp | 2026-11-13 | 1A SOCKS “Pull your ____ up” → SOCKS “Knock your ____ off” | british |
| cw-58qna3 | 2026-11-15 | 2D FLOWER “In the ____ of youth” → PLANET “Save the ____” | stem repeat in grid |
| cw-fo1aex | 2026-11-16 | 5D LEMONS “Oranges and ____” → LEMONS “When life gives you ____, make lemonade” | british |
| cw-k046t9 | 2026-11-24 | 1D FOOTING “On an equal ____” → FORTUNE “Cost a small ____”<br>5D SOCKS “Pull your ____ up” → SOCKS “Knock your ____ off” | british, duplicate |
| cw-o8abad | 2026-12-12 | 7D SHELL “Come out of your ____” → SMELL “The ____ of bacon and eggs in the morning”<br>12D SUCK “Babies ____ their thumbs” → SEEK “Hide and ____” | inappropriate, duplicate |
| cw-tvmg0u | 2026-12-15 | 4A GAP “Mind the ____” → GAP “Generation ____”<br>12A STREET “Word on the ____” → STRESS “The ____ of big-city life” | british, duplicate |
| cw-cgm8rx | 2026-12-16 | 7A ROOT “Get to the ____ of the problem” → FOOT “Put your best ____ forward” | obscure, stem repeat in grid |
| cw-oiqcxc | 2026-12-20 | 3D DOOR “Show someone the ____” → HOUR “The eleventh ____”<br>9D MAT “Welcome ____” → OUT “Knocked ____” | duplicate |
| cw-2vvdkb | 2026-12-23 | 9A SPRINGS “Hope ____ eternal” → OPTIONS “Keep your ____ open” | duplicate |
| cw-gt4x5h | 2026-12-25 | 1D FEATHER “Birds of a ____ flock together” → WEATHER “Under the ____” | duplicate |
| cw-vyzhpw | 2026-12-28 | 4A NOTICE “Hand in your ____” → NOTICE “Give two weeks' ____” | british |
| cw-77jxfh | 2027-01-01 | 7D OUT “Odd one ____” → OUT “Odd man ____”<br>11A PENNY “Ten a ____” → PENNY “A ____ for your thoughts” | british |
| cw-7asa6 | 2027-01-02 | 5A BOLTED “Shut the stable door after the horse has ____” → BOLTED “Lock the barn door after the horse has ____” | british |
| cw-5fj28d | 2027-01-03 | 1D STORY “[offensive wording — masked]” → STORY “That's my ____ and I'm sticking to it”<br>6A LEATHER “Go H*** for ____” → LEATHER “Tough as ____” | inappropriate |
| cw-shifet | 2027-01-04 | 3D UNCLE “Bob's your ____” → UNCLE “Say ____! (I give up!)” | british |
| cw-qzfube | 2027-01-05 | 4D STORM “A ____ in a teacup” → STORM “Calm before the ____” | british |
| cw-8ib2qj | 2027-01-08 | 12D CURE “Prevention is better than ____” → CURE “An ounce of prevention is worth a pound of ____” | british |
| cw-iczowd | 2027-01-11 | 7A POST “First past the ____” → POST “Mail it at the ____ office” | clue, british |
| cw-qlzmw0 | 2027-01-15 | 5A DANCE “Lead someone a merry ____” → DANCE “Save the last ____ for me” | british |
| cw-nt8t8y | 2027-01-20 | 1A GLASSES “Rose-tinted ____” → GLASSES “Rose-colored ____”<br>9D GAP “Mind the ____” → GAP “Bridge the ____” | british |
| cw-qfdsr2 | 2027-01-27 | 9A MANNERS “Mind your ____” → MANNERS “Table ____” | clue |
| cw-jdr007 | 2027-01-28 | 3D CURE “Kill or ____” → CURE “An ounce of prevention is worth a pound of ____” | british |
| cw-qoceqg | 2027-02-01 | 6D TWIST “A ____ in the tale” → TWIST “A plot ____” | british |
| cw-4ddmn1 | 2027-02-04 | 4A TOES “Keep you on your ____” → TOSS “Coin ____” | duplicate |
| cw-axb5jn | 2027-02-05 | 1A FLY “Pigs might ____” → FLY “When pigs ____”<br>9D LANE “A trip down memory ____” → LANE “Stay in your ____” | british, clue |
| cw-9nb7s | 2027-02-08 | 1A SPEED “More haste, less ____” → SPEED “Full ____ ahead”<br>7D LOAD “A few bricks short of a ____” → LOAD “Take a ____ off your feet” | british |
| cw-8jclrh | 2027-02-09 | 7A EAT “Have your cake and ____ it” → CAN “Open a ____ of worms”<br>10A MILK “Don't cry over spilt ____” → MILK “Don't cry over spilled ____” | british, stem repeat in grid |
| cw-t71mns | 2027-02-10 | 6A BUTTON “Bright as a ____” → BUTTON “Cute as a ____” | british |
| cw-r6exr | 2027-02-12 | 1D BEAT “My heart skipped a ____” → REST “Put your mind at ____” | duplicate |
| cw-2idioz | 2027-02-16 | 5A CURE “Prevention is better than ____” → CURE “An ounce of prevention is worth a pound of ____”<br>10D NOISE “Empty vessels make the most ____” → NOISE “Make some ____!” | british |
| cw-y3pogk | 2027-02-18 | 7D SOCKS “Pull your ____ up” → SOCKS “Knock your ____ off” | british |
| cw-757aoj | 2027-02-19 | 1D HALVES “A game of two ____” → HALVES “Go ____ on the check” | british |
| cw-gx7m6l | 2027-02-20 | 5A ARMOR “A C**** in the ____” → ARMOR “A knight in shining ____” | inappropriate |
| cw-hvckbg | 2027-02-23 | 5D NIGHT “Ships that pass in the ____” → TIGHT “Sleep ____, don't let the bedbugs bite” | duplicate |
| cw-pvz6t5 | 2027-02-26 | 9D PATH “Up the garden ____” → PATH “Off the beaten ____” | british |
| cw-wfza34 | 2027-03-02 | 8D FENCE “Straddle the ____” → PEACE “Keep the ____ with the neighbors” | duplicate |
| cw-453qdg | 2027-03-05 | 10D TIME “Once upon a ____” → TIME “A whale of a ____” | clue |
| cw-np7iap | 2027-03-08 | 8D SHAKE “____ hands on the deal” → STAKE “Drive a ____ into the ground” | duplicate |
| cw-p2o1bj | 2027-03-11 | 3D MOUSE “Quiet as a ____” → MOUSE “Computer ____ and keyboard” | clue |
| cw-o7mdqq | 2027-03-15 | 9A COURAGE “Dutch ____” → COURAGE “The ____ of your convictions” | british |
| cw-kofxd9 | 2027-03-17 | 9A HANDED “Caught red-____” → HINTED “She ____ at a surprise party” | duplicate |
| cw-bo7559 | 2027-03-21 | 3A HEADS “Two ____ are better than one” → TEARS “Bored to ____” | duplicate |
| cw-wezdxu | 2027-03-23 | 11D NAP “Cat ____” → DAY “A ____dream during class” | duplicate |
| cw-qf7ooi | 2027-03-24 | 2D TREE “The apple never falls far from the ____” → STEM “Long-____ roses”<br>5D SEEDS “Sow the ____ of doubt” → SHEDS “A snake ____ its skin”<br>11A TREES “Can't see the wood for the ____” → TREES “Can't see the forest for the ____” | british, duplicate |
| cw-33kjxe | 2027-03-25 | 4D THOUGHTS “On second ____” → THOUGHTS “Having second ____” | british |
| cw-egu3hc | 2027-03-26 | 5D SEED “Run to ____” → SEED “Go to ____” | british |
| cw-atv1ba | 2027-03-29 | 9D BUSH “Beat about the ____” → BUSH “Beat around the ____” | british |
| cw-v55gop | 2027-04-02 | 10D SEED “Run to ____” → SEED “Go to ____” | british |
| cw-uj8ub3 | 2027-04-05 | 9D FLY “Pigs might ____” → FLY “When pigs ____” | british |
| cw-r0b1xd | 2027-04-06 | 5D PATH “Up the garden ____” → PATH “Off the beaten ____” | british |
| cw-4tl15e | 2027-04-12 | 2A CLOUD “On ____ nine” → ALOUD “Read the story ____” | duplicate |
| cw-a9r5m7 | 2027-04-13 | 8D CLOTH “Cut your coat according to your ____” → CLOTH “Cut from the same ____” | british |
| cw-wcl655 | 2027-04-19 | 10A WELCOME “Outstay your ____” → WELCOME “Overstay your ____” | british |
| cw-j80rk5 | 2027-04-21 | 12A WICKET “A sticky ____” → TICKET “Punch your ____ to the playoffs” | british |
| cw-uebvfg | 2027-04-22 | 6A SOCKS “Pull your ____ up” → SOCKS “Knock your ____ off” | british |
| cw-lrx79w | 2027-04-23 | 3D HONEY “Sweet as ____” → HONEY “A land of milk and ____”<br>6A STING “A ____ in the tail” → STING “Float like a butterfly, ____ like a bee” | clue, british |
| cw-i9tmkr | 2027-04-25 | 4D JOKER “The ____ in the pack” → JOKER “The ____ is wild” | british |
| cw-tyx44b | 2027-04-27 | 7A OPENS “When one door closes, another one ____” → OPENS “The store ____ at nine” | clue |
| cw-g8uh0l | 2027-04-29 | 2A SENSE “Use some horse ____” → SENSE “Common ____”<br>8A COURSES “Horses for ____” → COURSES “A three-____ meal” | clue, british |
| cw-n9l7yd | 2027-05-01 | 3D CHALK “Different as ____ and cheese” → CHALK “____ it up to experience”<br>9A STONE “Leave no ____ unturned” → SLOPE “A slippery ____” | british, duplicate |
| cw-lu3r9g | 2027-05-06 | 2D LEMONS “Oranges and ____” → LEMONS “When life gives you ____, make lemonade” | british |
| cw-sup70c | 2027-05-16 | 7D GAP “Mind the ____” → GAP “Bridge the ____” | british |
| cw-9msp2h | 2027-05-23 | 8D CLOTH “Cut your coat according to your ____” → CLOTH “Cut from the same ____” | british |
| cw-g4cad0 | 2027-05-26 | 4D SUCK “Babies ____ their thumbs” → SINK “Everything but the kitchen ____”<br>11A BASKET “Don't put all your eggs in one ____” → BASKET “A picnic ____” | clue, inappropriate |
| cw-l62kdf | 2027-05-27 | 2D PENNY “Ten a ____” → PENNY “A ____ for your thoughts”<br>12D OUT “Odd one ____” → OUT “Odd man ____” | british |
| cw-rl29kg | 2027-05-28 | 1A POST “First past the ____” → POST “Mail it at the ____ office” | british |
| cw-p8pqy3 | 2027-06-02 | 6D JOKER “The ____ in the pack” → JOKER “The ____ is wild” | british |
| cw-gni26k | 2027-06-04 | 6D GAP “Mind the ____” → GAP “Generation ____” | british |
| cw-jejqht | 2027-06-08 | 3D SOCKS “Pull your ____ up” → SOCKS “Knock your ____ off” | british |
| cw-yavkte | 2027-06-10 | 13A GANDER “Sauce for the goose is sauce for the ____” → GANDER “What's good for the goose is good for the ____” | british |
| cw-krb9c2 | 2027-06-11 | 2D FISH “There are plenty more ____ in the sea” → FISH “Like a ____ out of water” | clue |
| cw-bcz5fy | 2027-06-12 | 2A STORM “A ____ in a teacup” → STORM “Calm before the ____” | british |
| cw-mgkd87 | 2027-06-14 | 10D TWIST “A ____ in the tale” → TWIST “A plot ____” | british |
| cw-sviga8 | 2027-06-15 | 6A BLOWS “See which way the wind ____” → BLOWS “Come to ____ (start fighting)”<br>9A BREEZE “Shoot the ____” → FREEZE “Brain ____” | clue, duplicate |
| cw-qh0z8h | 2027-06-20 | 3D ARMOR “A C**** in the ____” → ARMOR “A knight in shining ____” | inappropriate |
| cw-8q7eps | 2027-06-21 | 8A WHEELS “Spin your ____” → SPEEDS “A ten-____ bike” | duplicate |
| cw-iv2pvp | 2027-06-22 | 1D BRIDGE “Water under the ____” → BRIDGE “Cross that ____ when you come to it” | clue |
| cw-e7mwbm | 2027-06-23 | 5D CHAT “Chit-____” → CALM “Cool, ____ and collected”<br>9A GOLDEN “Speech is silver, silence is ____” → GOLDEN “Do unto others: the ____ rule” | duplicate, clue |
| cw-4ejoos | 2027-06-26 | 5A WINDOW “A ____ of opportunity” → WINDOW “Go ____ shopping” | clue |
| cw-inwe88 | 2027-06-27 | 10A LEATHER “Go H*** for ____” → LEATHER “Tough as ____” | inappropriate |
| cw-hy8wn0 | 2027-07-02 | 3D EATING “The proof of the pudding is in the ____” → EXTENT “To a certain ____” | stem repeat in grid |
| cw-f625iz | 2027-07-03 | 5A NOTICE “Hand in your ____” → NOTICE “Give two weeks' ____” | british |
| cw-sc80xy | 2027-07-05 | 12A SECRET “Top ____” → SACRED “Is nothing ____?” | duplicate |
| cw-r0ihp9 | 2027-07-16 | 10D NOTICE “Hand in your ____” → NOTICE “Give two weeks' ____” | british |
| cw-9chc4m | 2027-07-19 | 3D BULL “Like a red rag to a ____” → BULL “Take the ____ by the horns”<br>6A FLY “Pigs might ____” → FLY “When pigs ____” | british |
| cw-96v7w0 | 2027-07-21 | 2D LOAD “A few bricks short of a ____” → LOAD “Lighten the ____” | british |
| cw-lnez3i | 2027-07-27 | 5A ROOST “Chickens come home to ____” → COAST “The ____ is clear” | duplicate |
| cw-b9fckw | 2027-07-29 | 2D MILE “Go the extra ____” → MAKE “____ tracks” | duplicate |
| cw-qr5uf5 | 2027-07-30 | 4D EGGS “Ham and ____” → EDGE “Living on the ____” | duplicate |
| cw-gbr7fg | 2027-08-16 | 8A FLY “Pigs might ____” → FLY “When pigs ____” | british |
| cw-z57o58 | 2027-08-19 | 10A GAP “Mind the ____” → GAP “Bridge the ____” | british |
| cw-dv6lc1 | 2027-08-28 | 2D CRICKET “Chirping insect, or a bat-and-wicket game: ____” → CRICKET “Chirping insect in the grass: a ____” | british |
| cw-v8bx0b | 2027-09-01 | 9D SINK “Everything but the kitchen ____” → SAIL “Set ____” | duplicate |
| cw-clci7l | 2027-09-05 | 7D HANDS “The devil finds work for idle ____” → YARDS “The whole nine ____” | duplicate |
| cw-h4exdi | 2027-09-13 | 3A LEG “Break a ____” → HUG “A big bear ____” | duplicate |
| cw-9h1piq | 2027-09-15 | 7A TRAP “Walk into a ____” → TRIP “Take a ____ down memory lane” | duplicate |
| cw-ok24qf | 2027-09-19 | 9A GLASSES “Rose-tinted ____” → GLASSES “Rose-colored ____” | british |
| cw-z2tyu5 | 2027-09-21 | 4D STONE “Leave no ____ unturned” → STAND “Take a firm ____” | duplicate |
| cw-guhwat | 2027-09-22 | 5A SHAKE “____ hands on the deal” → SHARE “Do your fair ____” | duplicate |
| cw-cl1kew | 2027-09-28 | 7D DOG “Sick as a ____” → DAY “Every dog has its ____”<br>10D BONE “A ____ to pick” → BITE “His bark is worse than his ____” | duplicate |
| cw-bzvm8u | 2027-09-29 | 7D STORY “[offensive wording — masked]” → STORY “A likely ____!” | inappropriate |
| cw-xovztc | 2027-10-02 | 1A MILK “Don't cry over spilt ____” → MILK “Don't cry over spilled ____”<br>7A PATH “Up the garden ____” → PATH “Lead someone down the garden ____” | british |
| cw-css1kq | 2027-10-03 | 1A PATH “Up the garden ____” → PATH “Lead someone down the garden ____” | british |
| cw-mspxko | 2027-10-06 | 1D END “Journey's ____” → EYE “Keep your ____ on the prize” | duplicate |
| cw-3es5ch | 2027-10-07 | 4D SOCKS “Pull your ____ up” → SOCKS “Knock your ____ off”<br>5A GLOVE “Fit like a ____” → GLOBE “Travel all over the ____” | duplicate |
| cw-xvjj4v | 2027-10-13 | 11D CLOUD “On ____ nine” → CROWD “Two's company, three's a ____” | duplicate |
| cw-dyxe21 | 2027-10-16 | 2D SPEED “More haste, less ____” → SPEED “Full ____ ahead” | british |
| cw-f0t4tb | 2027-10-19 | 1A TONIC “Gin and ____” → TONIC “Club soda or ____ water” | inappropriate |
| cw-oip56l | 2027-10-20 | 4D HEN “A mother ____” → PEN “Chickens fenced in a ____” | duplicate |
| cw-h1hl7a | 2027-10-21 | 7A SURRENDER “Wave the white flag and ____” → SURRENDER “Unconditional ____” | clue |
| cw-c21kvy | 2027-10-25 | 3D NAP “Cat ____” → LAP “Kitten asleep in your ____” | duplicate |
| cw-8b1g8m | 2027-11-06 | 4D SHELL “Come out of your ____” → CHILL “____ out and relax” | duplicate |
| cw-kpx1m4 | Unlimited | 1D FISH “Plenty more ____ in the sea” → FISH “Plenty of ____ in the sea” | british |
| cw-3eanim | Unlimited | 7A NIGHT “Ships that pass in the ____” → LIGHT “Out like a ____”<br>13A SLEEP “Not lose any ____ over it” → SHEEP “Counting ____” | duplicate |
| cw-ezpm60 | Unlimited | 6D SAKE “For old times' ____” → SLIP “A ____ of the tongue” | duplicate |
| cw-m0r0ll | Unlimited | 7D ROOST “Chickens come home to ____” → ROOTS “Put down ____” | duplicate |
| cw-ewzkw3 | Unlimited | 8D SOCKS “Pull your ____ up” → SOCKS “Knock your ____ off” | content gate |
| cw-wp828k | Unlimited | 6D MILE “Go the extra ____” → HOLD “Please ____ the line” | duplicate |
| cw-2d5dx4 | Unlimited | 1D CAT “Not enough room to swing a ____” → RAT “Smell a ____” | duplicate |
| cw-gzrxt2 | Unlimited | 3D POURS “It never rains but it ____” → POURS “When it rains, it ____”<br>9D STORM “A ____ in a teacup” → STORM “The calm before the ____” | british |
| cw-jcc93k | Unlimited | 5A FISH “Drink like a ____” → FISH “Like a ____ out of water” | inappropriate |
| cw-89vf3c | Unlimited | 12A COWS “Till the ____ come home” → DAWN “From dusk till ____” | duplicate |
| cw-majwx9 | Unlimited | 3D PATH “Lead someone up the garden ____” → PATH “Lead someone down the garden ____”<br>4A BUSH “Beat about the ____” → BUSH “Beat around the ____” | british |
| cw-pjv23m | Unlimited | 6D WICKET “A sticky ____” → TICKET “A one-way ____” | british |
| cw-zesouj | Unlimited | 10A FEATHER “Birds of a ____ flock together” → WEATHER “Fair-____ friends” | duplicate |
| cw-syvcgt | Unlimited | 10D CAT “Not enough room to swing a ____” → CUT “A ____ above the rest” | duplicate |
| cw-kpxwfs | Unlimited | 2D OUT “Odd one ____” → OUT “Odd man ____”<br>11D HEAD “Off the top of my ____” → HEAR “I ____ you loud and clear” | duplicate, british |
| cw-drdwju | Unlimited | 5A PENNY “Ten a ____” → PENNY “A ____ for your thoughts” | british |
| cw-glfix0 | Unlimited | 5A RICH “Strike it ____” → ROCK “Solid as a ____” | duplicate |
| cw-g1a9ku | Unlimited | 12A DOORWAY “Stand in a ____ during an earthquake” → DOORWAY “Framed in the ____” | clue |
| cw-ooyt3t | 2026-12-24 (christmas) | 8A CRACKER “Pull a Christmas ____” → CRACKER “The Nut____ ballet” | british |
| cw-6bo6l9 | 2030-04-22 (earthday) | 2D FLOW “Go with the ____” → SLOW “____ and steady wins the race” | stem repeat in grid |
| cw-pxoj96 | 2027-06-19 (juneteenth) | 7A JUBILEE “Silver ____ marking 25 years on the throne” → JUBILEE “Juneteenth is also called ____ Day” | off-theme |
| cw-25osnm | 2029-05-28 (memorial) | 5D LOG “A yule ____” → LOG “Sleep like a ____” | off-theme |
| cw-acpjcy | 2027-05-31 (memorial) | 8D FORGET “Lest we ____” → FOUGHT “A hard-____ battle” | duplicate |
| cw-1ghmv2 | 2029-01-15 (mlkday) | 3D GUN “Jump the ____” → GAP “Bridge the ____” | inappropriate |
| cw-baogtw | 2027-05-09 (mothersday) | 11A CHILD “Spare the rod and spoil the ____” → CHILD “It takes a village to raise a ____” | inappropriate |
| cw-jrz7ge | 2028-04-11 (passover) | 8A MIRACLES “Loaves and fishes and other ____” → MIRACLES “The parting of the sea and other ____” | off-theme |
| cw-h5v3ty | 2028-02-14 (valentines) | 11D FISH “Drink like a ____” → FISH “Plenty of ____ in the sea” | inappropriate |

</details>

### Muddle — 93 puzzle(s) changed (`apps/web/data/scramble-puzzles.json`)

<details><summary>All 93 changes</summary>

| Puzzle | Date | Change (masked) | Why |
|---|---|---|---|
| md-78xswy | 2026-10-16 | caption → “The baker and the butcher chatted across the street all day; locals called it ____.” | british |
| md-8upzsk | 2026-10-18 | LICHEN [0,3,5] → LICHEN [3,5]<br>GOODY [0,4] → GOODY [0]<br>final HIGHLY STRUNG → HIGH STRUNG | british |
| md-zgqx80 | 2026-10-22 | caption → “The movers set down the sofa and gathered around as the foreman gave a truly ____.”<br>alt text → “A foreman stands on a crate addressing a group of tearful movers holding boxes.” | british |
| md-o0pqks | 2026-10-23 | DISTAL [0,1,3,5] → LIFTED [0,1,3,5] | obscure, gate: obscure |
| md-u3blw | 2026-10-26 | G***** [1,5] → SHADOW [1,4] | inappropriate |
| md-2i7t2x | 2026-11-01 | CREPT [1,3,4] → TREND [0,3,4]<br>HEFTY [1,4] → AUDIT [0,1,2]<br>IMPORT [2,3,4,5] → FONDUE [0,1,2]<br>final LOST PROPERTY → LOST AND FOUND<br>caption → “The town's wandering cottage finally turned up at the station's ____.” | british |
| md-x3veje | 2026-11-02 | SLUICE [0,3,4,5] → RICHES [1,2,4,5] | gate: obscure |
| md-w4wkda | 2026-11-06 | NOUGHT [0,3,4] → KNIGHT [1,3,4] | british, gate: British |
| md-mil0k3 | 2026-11-18 | CUTLER [0,1,2,5] → CUTTER [0,1,2,5] | obscure |
| md-9px0a6 | 2026-11-27 | TOGGLE [0,1,2,3] → JOGGER [1,2,3,5]<br>SHIRT [0,1,2,3] → SHIRT [0,1,2,4] | gate: obscure |
| md-htmnde | 2026-12-01 | WRIGHT [0,1,3,4] → GROWTH [0,1,3,5] | obscure |
| md-qogggt | 2026-12-04 | TIPPLE [0,1,5] → TICKET [0,1,4]<br>LEGGED [2,5] → RIDING [2,5]<br>caption → “Asked which way the harbor lay, the lighthouse admitted it didn't have the ____.”<br>alt text → “A lighthouse shrugs in thick gray murk while a rowboat below holds up a compass.” | british, gate: British, obscure |
| md-a5k0p9 | 2026-12-05 | caption → “The mechanic only fixed transmissions at night; he called it ____.”<br>alt text → “A mechanic wearing a headlamp repairs a car's gears at night.” | british |
| md-fwykwn | 2026-12-06 | T**** [1,2,4] → GROUP [1,3,4]<br>SMITHY [0,1,2] → SIMPLY [0,1,2] | inappropriate, gate: obscure |
| md-u9qycg | 2026-12-08 | T**** [0,4] → PILOT [0,4] | inappropriate |
| md-za1drz | 2026-12-14 | caption → “The robot swapped its overalls for a tuxedo in seconds; the inventor called it a ____.”<br>alt text → “A cog-covered robot pulls on a tuxedo jacket while an inventor holds a stopwatch.” | british |
| md-jfmjrv | 2026-12-29 | APACHE [1,3] → POCKET [0,2]<br>caption → “The baker's fanciest customers would only ever buy the ____.” | proper-noun, british |
| md-d0znq6 | 2027-01-09 | T**** [0,1,3] → MOTOR [0,2,4] | inappropriate |
| md-gonnbn | 2027-01-10 | caption → “The model railroad hobbyist meant to fix the engine but got ____.” | british |
| md-92xx09 | 2027-01-17 | T**** [1,2,4] → PROUD [0,1,3] | inappropriate |
| md-oe7pqy | 2027-01-18 | BLANC [1,2] → BLAND [1,2]<br>THATCH [0,2] → TAKING [0,1] | obscure, gate: obscure |
| md-ipujmi | 2027-01-20 | CORPUS [4,5] → HOUSES [2,3] | gate: obscure |
| md-ikz7lk | 2027-01-29 | F***** [0,3] → FORKED [0,3] | inappropriate, gate: blocked |
| md-2j1lhi | 2027-01-30 | SURREY [0,2,3,4] → SURFER [0,2,4,5] | proper-noun |
| md-svp1cq | 2027-02-04 | DHARMA [0,2] → AFRAID [0,5] | obscure, gate: obscure |
| md-jqqagi | 2027-02-07 | CAIRNS [0,2,3,4] → CINDER [0,1,2,5] | obscure |
| md-gwv8cd | 2027-02-10 | HIPPY [0,1,4] → SHINY [1,2,4] | british, gate: British, obscure |
| md-83zqje | 2027-02-12 | MOZART [0,1,4] → NORMAL [1,2,3] | proper-noun |
| md-uvzpf | 2027-02-14 | R**** [1,2,4] → CANDY [1,2,4] | inappropriate, gate: British |
| md-izz9n | 2027-02-17 | alt text → “A stylist holds up a pay stub covered in tassels and swinging trims.” | british |
| md-lh3wjv | 2027-02-20 | NISSAN [2,3,4] → STAIRS [0,2,5]<br>HYDRO [2,3] → THIRD [3,4] | proper-noun, gate: obscure |
| md-m1x9z1 | 2027-02-21 | caption → “The librarian's calendar had no free slots left; she was ____.” | british |
| md-dkpksk | 2027-02-26 | caption → “She reached the wildlife blind before dawn; the club called her its ____.”<br>alt text → “A woman with binoculars sits in a dark wildlife blind before sunrise while a robin beside her yawns.” | british |
| md-sqj970 | 2027-03-06 | QUAKER [0,2] → QUAINT [0,2] | proper-noun |
| md-2fse5h | 2027-03-07 | DUCHY [0,2] → CHILD [0,4]<br>FRANC [0,3] → FUNNY [0,2] | british, gate: British, obscure |
| md-nyhi5f | 2027-03-08 | caption → “The grumpy man with the stop sign at the school crosswalk was known to everyone as the ____.” | british |
| md-m0uy3s | 2027-03-12 | alt text → “A breakfast tray floats into a hotel room on a flying sweeper as a wizard in a bathrobe watches.” | british |
| md-1iqvqc | 2027-03-21 | alt text → “A dog digs up a crumbling sheet of paper in a backyard as a boy watches.” | british |
| md-sjgtu3 | 2027-03-24 | alt text → “A horse-shaped chess piece in a guard's cap patrols a dark room with a flashlight past sleeping pieces.” | british |
| md-g3wfrx | 2027-03-26 | BATTEN [1,2,3,5] → ATTEND [0,1,2,4] | gate: obscure |
| md-f89neb | 2027-04-01 | caption → “When the magician's audience left at intermission, the critic called it a ____.” | british |
| md-gppuqh | 2027-04-05 | DHARMA [0,3] → DRIVER [0,1] | obscure, gate: obscure |
| md-a4k6zx | 2027-04-09 | caption → “The cottage swapped its gown on moving day; the mail carrier said he'd need a ____.”<br>alt text → “A house with arms pulls on a polka-dot gown while a puzzled mail carrier holds a letter.” | british |
| md-zdxc41 | 2027-04-12 | alt text → “Musicians in evening dress push a stalled bus up a hill.” | british |
| md-zfg05e | 2027-04-15 | SURREY [0,2,3] → ARROWS [1,2,5] | proper-noun |
| md-fyosj0 | 2027-05-08 | alt text → “An owl in pajamas reads by flashlight while other birds sleep.” | british |
| md-zhw2pc | 2027-05-12 | SLUICE [0,3,4] → COUSIN [0,3,4] | gate: obscure |
| md-sk70xj | 2027-05-14 | caption → “The model railroad enthusiast talked about nothing else; he had a ____.” | british |
| md-7rum1u | 2027-05-15 | caption → “After hours in the attic, the model railroad builder was ____.”<br>alt text → “A tired man slumps beside a model railroad as his toy engine's puff of smoke fizzles out.” | british |
| md-9tzrux | 2027-05-23 | HARPER [2,3,4] → PIRATE [0,2,5] | proper-noun, gate: obscure |
| md-z96fa7 | 2027-05-25 | PLIGHT [1,2,3,5] → PLIGHT [1,2,3]<br>SIGMA [0,1,2,3] → ANSWER [1,2,3,4]<br>final PIGS MIGHT FLY → WHEN PIGS FLY<br>caption → “Asked if his hogs would ever master the new trampoline, the farmer laughed, '____.'” | british |
| md-lknlj6 | 2027-06-05 | DUCHY [2,4] → LUCKY [2,4] | british, gate: British, obscure |
| md-5ccbk | 2027-06-10 | DREAMT [1,2,5] → TURNED [0,2,4]<br>caption → “When the boomerang arrived with no address, the post office marked it ____.”<br>alt text → “A worker ducks as a boomerang flies back out of a post office window.” | british, gate: British |
| md-ny170a | 2027-06-11 | BATTEN [0,2] → BRIGHT [0,5] | gate: obscure |
| md-uu9vwb | 2027-06-18 | FOCAL [0,1,2,4] → FOCAL [1,2,4]<br>FIXING [0,4,5] → TUNING [0,1,2,5]<br>final CLOCKING OFF → CLOCKING OUT | british |
| md-op2otq | 2027-06-24 | CARDED [0,1,2,4] → CEREAL [0,1,2,4] | gate: obscure |
| md-5fxgl7 | 2027-06-29 | PLANAR [0,2] → NAPKIN [1,2] | obscure, gate: obscure |
| md-d4bohx | 2027-06-30 | H***** [1,2,3] → COOKIE [1,2,3] | inappropriate, gate: blocked |
| md-pvky5j | 2027-07-02 | caption → “When the angler claimed the pike was six feet long, his wife suspected ____.” | british |
| md-tfcteo | 2027-07-05 | UNWELL [1,4] → UNCLE [1,3] | gate: British |
| md-xtxhj1 | 2027-07-14 | caption → “The traveling cinema showed films from the back of a camper; naturally they called it the ____.”<br>alt text → “A camper with a screen on its side shows a film to villagers in lawn chairs.” | british |
| md-z38cc | 2027-07-16 | caption → “The kingfisher stopped at the bird blind for barely a second; the club logged it as a ____.”<br>alt text → “A kingfisher streaks past a wooden bird blind while a watcher's binoculars spin on their strap.” | british |
| md-g2d3mg | 2027-07-20 | caption → “The magician scored three goals for the town soccer team; the paper called it a ____.”<br>alt text → “A magician in a cape celebrates on a soccer field while three rabbits sit inside the goal net.” | british |
| md-wxsn77 | 2027-07-23 | T**** [1,2,4] → PROUD [0,1,3] | inappropriate |
| md-szxpv4 | 2027-07-25 | CICERO [0,2] → CIRCUS [0,3] | proper-noun |
| md-dnzkoz | 2027-08-10 | B**** [0,1,3] → BOOTH [0,1,3] | inappropriate |
| md-rul94s | 2027-08-12 | caption → “The officer stood at the intersection with a megaphone and clapperboard, ____.”<br>alt text → “A police officer with a megaphone and clapperboard commands cars at an intersection.” | british |
| md-f1ms0x | 2027-08-21 | BATTEN [2,3,4] → PRETTY [2,3,4] | gate: obscure |
| md-q3cme2 | 2027-08-22 | caption → “The model railroad builder lost his ____ when the engine derailed.” | british |
| md-9vv74t | 2027-09-07 | COCKLE [0,1,2,5] → SOCCER [1,2,3,4]<br>alt text → “A pastry chef hands an apprentice a single slice of a tall tiered wedding dessert.” | british, gate: British |
| md-b01e5c | 2027-09-08 | caption → “The shopkeeper haggled by sliding bills back and forth across the register; he called it a ____.”<br>alt text → “A shopkeeper and a customer push folded bills across the register toward each other.” | british |
| md-m824u4 | 2027-09-15 | BETHEL [0,2,5] → BOTTLE [0,2,4] | proper-noun |
| md-ys0uoc | Unlimited | BONITO [1,4] → TONGUE [0,1] | gate: obscure |
| md-c68un6 | Unlimited | alt text → “A strutting chicken with a small crown crows from a henhouse roof while hens curtsy below.” | british |
| md-ubfj9s | Unlimited | caption → “The astronomy club planted its telescopes thirty feet apart, nicely ____.” | british |
| md-a4gmzo | Unlimited | UNWELL [1,2,4] → WALNUT [0,2,3] | gate: British |
| md-rm0z97 | 2028-04-01 (aprilfools) | alt text → “A puppy hangs from a father's pant cuff as he grins beside a chair with a whoopee cushion.” | british |
| md-ga5njw | 2027-05-05 (cincodemayo) | ANNALS [0,1,4,5] → ANKLES [0,1,3,5] | gate: obscure |
| md-iumrhz | 2028-04-22 (earthday) | OILERS [1,3,4] → WINTER [1,4,5] | proper-noun |
| md-9995bb | 2028-06-18 (fathersday) | LINDEN [0,1,2,4] → PENCIL [1,2,4,5] | gate: obscure |
| md-wpxp5o | 2027-02-02 (groundhog) | AORTIC [0,1,2,3] → THROAT [0,2,3,4] | gate: obscure |
| md-krfti8 | 2026-10-31 (halloween) | ALIAS [0,2] → PIANO [0,1,2]<br>H***** [0,3,5] → HOCKEY [0,3] | inappropriate, gate: blocked |
| md-wfr8ri | 2027-12-25 (hanukkah) | C***** [0,5] → SKETCH [4,5] | inappropriate, gate: blocked |
| md-9guhqs | 2026-12-27 (kwanzaa) | S***** [2,3,4,5] → GRITTY [2,3,4,5] | inappropriate, gate: blocked |
| md-rhjyb3 | 2027-12-27 (kwanzaa) | SEXTON [0,3] → BASKET [2,5] | obscure, gate: obscure |
| md-imsoer | 2027-02-09 (mardigras) | caption → “Asked whether Grandma might skip this year's Mardi Gras pancake supper, Grandpa said ____.” | british |
| md-mwaaan | 2030-03-05 (mardigras) | alt text → “A masked reveler on a float tosses strings of beads to a cheering crowd.” | british |
| md-wi9v31 | 2027-01-18 (mlkday) | LINDEN [1,2,4,5] → DINNER [1,2,3,4] | gate: obscure |
| md-1p7idp | 2028-05-14 (mothersday) | COUNT [1,2] → FLOOD [2,3]<br>SMITHY [0,1,4] → MOUTHS [0,4,5]<br>final MUMS THE WORD → MOMS THE WORD<br>alt text → “Two children shush each other behind a huge bouquet of flowers.” | british, gate: obscure |
| md-jgkypo | 2028-04-11 (passover) | BONITO [1,3,4] → PROFIT [2,4,5] | gate: obscure |
| md-1e515p | 2028-02-21 (presidents) | BATTEN [0,1,2,5] → OBTAIN [1,2,3,5] | gate: obscure |
| md-4i9an | 2026-11-25 (thanksgiving) | caption → “The November feast arrived at the table on a toy railroad; Grandpa called it the ____.” | british |
| md-8k0zrq | 2028-02-14 (valentines) | SEXTON [0,1,3,5] → SUNSET [0,2,4,5] | obscure, gate: obscure |

</details>

### Hubbub — 580 puzzle(s) changed (`apps/web/data/hub-puzzles.json`)

<details><summary>All 580 changes</summary>

| Puzzle | Date | Change (masked) |
|---|---|---|
| hb0021 | 2026-10-13 | demoted to bonus: DAFT; 84 rare bonus word(s) no longer accepted; now accepted: FEET; max 206 → 205 |
| hb0022 | 2026-10-14 | demoted to bonus: INTRA; 178 rare bonus word(s) no longer accepted; max 214 → 209 |
| hb0023 | 2026-10-15 | new letter set OABDGIN → CAELNOZ (pangram CALZONE, 27 words, max 107) — fell under 20 scored words after demotions |
| hb0024 | 2026-10-16 | demoted to bonus: CONN; 72 rare bonus word(s) no longer accepted; max 104 → 103 |
| hb0025 | 2026-10-17 | demoted to bonus: CREE FRANC RUFF; 113 rare bonus word(s) no longer accepted; max 132 → 125 |
| hb0026 | 2026-10-18 | demoted to bonus: LOCO; 112 rare bonus word(s) no longer accepted; max 130 → 129 |
| hb0027 | 2026-10-19 | demoted to bonus: AMINO; 116 rare bonus word(s) no longer accepted; max 153 → 148 |
| hb0028 | 2026-10-20 | removed G****; demoted to bonus: GAGE; 127 rare bonus word(s) no longer accepted; max 169 → 168 |
| hb0029 | 2026-10-21 | 106 rare bonus word(s) no longer accepted |
| hb0030 | 2026-10-22 | demoted to bonus: PARA PARR PROTO TORY; 131 rare bonus word(s) no longer accepted; max 181 → 173 |
| hb0031 | 2026-10-23 | demoted to bonus: APACHE H***; 70 rare bonus word(s) no longer accepted; max 102 → 95 |
| hb0032 | 2026-10-24 | demoted to bonus: TORY; 131 rare bonus word(s) no longer accepted; max 165 → 164 |
| hb0033 | 2026-10-25 | 63 rare bonus word(s) no longer accepted |
| hb0034 | 2026-10-26 | new letter set RCENOQU → UDEGILN (pangram GUIDELINE/INDULGE, 28 words, max 132) — fell under 20 scored words after demotions |
| hb0035 | 2026-10-27 | demoted to bonus: BABA DADA; 117 rare bonus word(s) no longer accepted; max 226 → 224 |
| hb0036 | 2026-10-28 | demoted to bonus: H*** MAHATMA; 55 rare bonus word(s) no longer accepted; max 86 → 78 |
| hb0037 | 2026-10-29 | demoted to bonus: INVARIANT; 166 rare bonus word(s) no longer accepted; max 238 → 229 |
| hb0038 | 2026-10-30 | 94 rare bonus word(s) no longer accepted |
| hb0039 | 2026-10-31 | demoted to bonus: CANT CANTON C*** COCO CONN; 79 rare bonus word(s) no longer accepted; max 174 → 164 |
| hb0040 | 2026-11-01 | 96 rare bonus word(s) no longer accepted |
| hb0041 | 2026-11-02 | demoted to bonus: CHIT MAHATMA; 98 rare bonus word(s) no longer accepted; max 162 → 154 |
| hb0042 | 2026-11-03 | 155 rare bonus word(s) no longer accepted |
| hb0043 | 2026-11-04 | demoted to bonus: C*** COCO CONN CREE; 111 rare bonus word(s) no longer accepted; max 158 → 154 |
| hb0044 | 2026-11-05 | 69 rare bonus word(s) no longer accepted |
| hb0045 | 2026-11-06 | demoted to bonus: M**** TONNE; 96 rare bonus word(s) no longer accepted; max 130 → 120 |
| hb0046 | 2026-11-07 | 39 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0047 | 2026-11-08 | demoted to bonus: C*** COCO LOCO P***; 107 rare bonus word(s) no longer accepted; max 143 → 139 |
| hb0048 | 2026-11-09 | removed P****** P***; 72 rare bonus word(s) no longer accepted; max 122 → 114 |
| hb0049 | 2026-11-10 | 72 rare bonus word(s) no longer accepted |
| hb0050 | 2026-11-11 | demoted to bonus: RUFF; 152 rare bonus word(s) no longer accepted; max 237 → 236 |
| hb0051 | 2026-11-12 | demoted to bonus: H***; 87 rare bonus word(s) no longer accepted; max 106 → 105 |
| hb0052 | 2026-11-13 | 80 rare bonus word(s) no longer accepted |
| hb0053 | 2026-11-14 | demoted to bonus: AMIR ANIL; 158 rare bonus word(s) no longer accepted; max 193 → 191 |
| hb0054 | 2026-11-15 | demoted to bonus: FANCIED; 90 rare bonus word(s) no longer accepted; max 180 → 166 |
| hb0055 | 2026-11-16 | removed V*****; 73 rare bonus word(s) no longer accepted |
| hb0056 | 2026-11-17 | demoted to bonus: ANON H****** NAPA TONNE; 135 rare bonus word(s) no longer accepted; max 123 → 109 |
| hb0057 | 2026-11-18 | new letter set IAELNPX → OADFLNW (pangram DOWNFALL, 21 words, max 66) — fell under 20 scored words after demotions |
| hb0058 | 2026-11-19 | 220 rare bonus word(s) no longer accepted |
| hb0059 | 2026-11-20 | demoted to bonus: COCO CONN CREE LOCO RECTOR; 124 rare bonus word(s) no longer accepted; max 226 → 216 |
| hb0060 | 2026-11-21 | demoted to bonus: M**** TORY; 69 rare bonus word(s) no longer accepted; max 105 → 99 |
| hb0061 | 2026-11-22 | demoted to bonus: ANON; 94 rare bonus word(s) no longer accepted; max 131 → 130 |
| hb0062 | 2026-11-23 | 76 rare bonus word(s) no longer accepted |
| hb0063 | 2026-11-24 | removed P******; demoted to bonus: PROTO TORY; 133 rare bonus word(s) no longer accepted; max 209 → 196 |
| hb0064 | 2026-11-25 | removed P***; 75 rare bonus word(s) no longer accepted; max 82 → 81 |
| hb0065 | 2026-11-26 | 148 rare bonus word(s) no longer accepted |
| hb0066 | 2026-11-27 | demoted to bonus: PEPTIDE; 75 rare bonus word(s) no longer accepted; max 132 → 125 |
| hb0067 | 2026-11-28 | demoted to bonus: AMINO ANIL ANON; 200 rare bonus word(s) no longer accepted; max 214 → 207 |
| hb0068 | 2026-11-29 | demoted to bonus: KERN WEIR WELLER; 75 rare bonus word(s) no longer accepted; max 102 → 94 |
| hb0069 | 2026-11-30 | new letter set OABCEKM → EACHIMP (pangram IMPEACH, 23 words, max 70) — fell under 20 scored words after demotions |
| hb0070 | 2026-12-01 | demoted to bonus: ANIL ANVIL LOCO; 135 rare bonus word(s) no longer accepted; max 152 → 145 |
| hb0071 | 2026-12-02 | demoted to bonus: ANIL ANON; 188 rare bonus word(s) no longer accepted; max 197 → 195 |
| hb0072 | 2026-12-03 | demoted to bonus: LAMA; 89 rare bonus word(s) no longer accepted; max 122 → 121 |
| hb0073 | 2026-12-04 | demoted to bonus: BABA; 112 rare bonus word(s) no longer accepted; max 111 → 110 |
| hb0074 | 2026-12-05 | demoted to bonus: C*** COCO; 41 rare bonus word(s) no longer accepted; max 141 → 139 |
| hb0075 | 2026-12-06 | demoted to bonus: ANON CAYMAN CONN M****; 86 rare bonus word(s) no longer accepted; max 120 → 107 |
| hb0076 | 2026-12-07 | 54 rare bonus word(s) no longer accepted |
| hb0077 | 2026-12-08 | demoted to bonus: COCO CONN; 100 rare bonus word(s) no longer accepted; max 174 → 172 |
| hb0078 | 2026-12-09 | demoted to bonus: ANON CANT CANTON CONN NAPA; 190 rare bonus word(s) no longer accepted; max 249 → 239 |
| hb0079 | 2026-12-10 | 162 rare bonus word(s) no longer accepted |
| hb0080 | 2026-12-11 | demoted to bonus: IDIOT; 66 rare bonus word(s) no longer accepted; max 108 → 103 |
| hb0081 | 2026-12-12 | demoted to bonus: ANON GAGE MAMMA; 162 rare bonus word(s) no longer accepted; max 216 → 209 |
| hb0082 | 2026-12-13 | demoted to bonus: ANON TORAH; 79 rare bonus word(s) no longer accepted; max 125 → 119 |
| hb0083 | 2026-12-14 | removed P***; 123 rare bonus word(s) no longer accepted; max 175 → 174 |
| hb0084 | 2026-12-15 | demoted to bonus: BERG; 110 rare bonus word(s) no longer accepted; max 174 → 173 |
| hb0085 | 2026-12-16 | 157 rare bonus word(s) no longer accepted |
| hb0086 | 2026-12-17 | demoted to bonus: PARA PARR; 116 rare bonus word(s) no longer accepted; max 153 → 151 |
| hb0087 | 2026-12-18 | demoted to bonus: LAMA; 104 rare bonus word(s) no longer accepted; max 85 → 84 |
| hb0088 | 2026-12-19 | demoted to bonus: H*** TONNE; 104 rare bonus word(s) no longer accepted; max 119 → 113 |
| hb0089 | 2026-12-20 | demoted to bonus: D*** P***; 87 rare bonus word(s) no longer accepted; max 182 → 180 |
| hb0090 | 2026-12-21 | demoted to bonus: P***; 103 rare bonus word(s) no longer accepted; max 140 → 139 |
| hb0091 | 2026-12-22 | demoted to bonus: MAMMA NAPA; 191 rare bonus word(s) no longer accepted; max 220 → 214 |
| hb0092 | 2026-12-23 | demoted to bonus: ANIL ANVIL DADA; 94 rare bonus word(s) no longer accepted; max 93 → 86 |
| hb0093 | 2026-12-24 | demoted to bonus: D******* HAIRED; 106 rare bonus word(s) no longer accepted; max 166 → 152 |
| hb0094 | 2026-12-25 | 138 rare bonus word(s) no longer accepted |
| hb0095 | 2026-12-26 | demoted to bonus: HARPER PARA PARR; 131 rare bonus word(s) no longer accepted; max 188 → 180 |
| hb0096 | 2026-12-27 | demoted to bonus: FREEMAN; 86 rare bonus word(s) no longer accepted; max 158 → 151 |
| hb0097 | 2026-12-28 | demoted to bonus: COCO CONN; 48 rare bonus word(s) no longer accepted; max 132 → 130 |
| hb0098 | 2026-12-29 | demoted to bonus: P***; 80 rare bonus word(s) no longer accepted; max 74 → 73 |
| hb0099 | 2026-12-30 | 37 rare bonus word(s) no longer accepted |
| hb0100 | 2026-12-31 | demoted to bonus: BERG; 90 rare bonus word(s) no longer accepted; max 174 → 173 |
| hb0101 | 2027-01-01 | 75 rare bonus word(s) no longer accepted |
| hb0102 | 2027-01-02 | demoted to bonus: BABA; 147 rare bonus word(s) no longer accepted; max 167 → 166 |
| hb0103 | 2027-01-03 | demoted to bonus: CREE; 103 rare bonus word(s) no longer accepted; max 189 → 188 |
| hb0104 | 2027-01-04 | demoted to bonus: C*** COCO CREE; 52 rare bonus word(s) no longer accepted; max 92 → 89 |
| hb0105 | 2027-01-05 | demoted to bonus: AMIR ANIL LAMA MAMMA; 154 rare bonus word(s) no longer accepted; max 150 → 142 |
| hb0106 | 2027-01-06 | 39 rare bonus word(s) no longer accepted |
| hb0107 | 2027-01-07 | demoted to bonus: NAPA; 84 rare bonus word(s) no longer accepted; max 83 → 82 |
| hb0108 | 2027-01-08 | demoted to bonus: PROTO; 41 rare bonus word(s) no longer accepted; max 126 → 121 |
| hb0109 | 2027-01-09 | 67 rare bonus word(s) no longer accepted |
| hb0110 | 2027-01-10 | demoted to bonus: C***; 149 rare bonus word(s) no longer accepted; max 199 → 198 |
| hb0111 | 2027-01-11 | 176 rare bonus word(s) no longer accepted |
| hb0112 | 2027-01-12 | 110 rare bonus word(s) no longer accepted |
| hb0113 | 2027-01-13 | 84 rare bonus word(s) no longer accepted |
| hb0114 | 2027-01-14 | 228 rare bonus word(s) no longer accepted |
| hb0115 | 2027-01-15 | demoted to bonus: ANON M****; 69 rare bonus word(s) no longer accepted; max 137 → 131 |
| hb0116 | 2027-01-16 | 170 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0117 | 2027-01-17 | new letter set RCEKMOY → IBELRTU (pangram REBUILT, 27 words, max 113) — fell under 20 scored words after demotions |
| hb0118 | 2027-01-18 | removed H****; demoted to bonus: M****; 47 rare bonus word(s) no longer accepted; max 95 → 85 |
| hb0119 | 2027-01-19 | 108 rare bonus word(s) no longer accepted |
| hb0120 | 2027-01-20 | new letter set DAILPRY → LAEHIVY (pangram HEAVILY, 26 words, max 81) — fell under 20 scored words after demotions |
| hb0121 | 2027-01-21 | demoted to bonus: CONN M****; 48 rare bonus word(s) no longer accepted; max 105 → 99 |
| hb0122 | 2027-01-22 | 53 rare bonus word(s) no longer accepted |
| hb0123 | 2027-01-23 | demoted to bonus: K*** TING; 43 rare bonus word(s) no longer accepted; max 164 → 162 |
| hb0124 | 2027-01-24 | demoted to bonus: P***; 52 rare bonus word(s) no longer accepted; max 70 → 69 |
| hb0125 | 2027-01-25 | demoted to bonus: ANON BABA EBOLA NETBALL; 186 rare bonus word(s) no longer accepted; max 202 → 188 |
| hb0126 | 2027-01-26 | demoted to bonus: TOOTHED; 133 rare bonus word(s) no longer accepted; max 240 → 233 |
| hb0127 | 2027-01-27 | demoted to bonus: H******; 79 rare bonus word(s) no longer accepted; max 152 → 145 |
| hb0128 | 2027-01-28 | 42 rare bonus word(s) no longer accepted |
| hb0129 | 2027-01-29 | demoted to bonus: GAGE; 88 rare bonus word(s) no longer accepted; max 114 → 113 |
| hb0130 | 2027-01-30 | demoted to bonus: BLOODY; 90 rare bonus word(s) no longer accepted; max 117 → 111 |
| hb0131 | 2027-01-31 | 86 rare bonus word(s) no longer accepted |
| hb0132 | 2027-02-01 | demoted to bonus: ANIL; 90 rare bonus word(s) no longer accepted; max 81 → 80 |
| hb0133 | 2027-02-02 | demoted to bonus: BABA; 167 rare bonus word(s) no longer accepted; max 128 → 127 |
| hb0134 | 2027-02-03 | removed R******* T***; demoted to bonus: DREAMT; 144 rare bonus word(s) no longer accepted; max 215 → 200 |
| hb0135 | 2027-02-04 | demoted to bonus: GAGE; 46 rare bonus word(s) no longer accepted; max 71 → 70 |
| hb0136 | 2027-02-05 | demoted to bonus: M****; 39 rare bonus word(s) no longer accepted; max 139 → 134 |
| hb0137 | 2027-02-06 | removed N*****; demoted to bonus: GAGE; 156 rare bonus word(s) no longer accepted; max 208 → 207 |
| hb0138 | 2027-02-07 | demoted to bonus: CONN; 159 rare bonus word(s) no longer accepted; max 159 → 158 |
| hb0139 | 2027-02-08 | 131 rare bonus word(s) no longer accepted |
| hb0140 | 2027-02-09 | demoted to bonus: ANON CONN; 69 rare bonus word(s) no longer accepted; max 92 → 90 |
| hb0141 | 2027-02-10 | 147 rare bonus word(s) no longer accepted |
| hb0142 | 2027-02-11 | removed D***; demoted to bonus: GIRO; 113 rare bonus word(s) no longer accepted; max 194 → 192 |
| hb0143 | 2027-02-12 | 75 rare bonus word(s) no longer accepted |
| hb0144 | 2027-02-13 | demoted to bonus: BABA BLANC; 80 rare bonus word(s) no longer accepted; max 139 → 133 |
| hb0145 | 2027-02-14 | 99 rare bonus word(s) no longer accepted |
| hb0146 | 2027-02-15 | demoted to bonus: N***; 126 rare bonus word(s) no longer accepted; max 84 → 83 |
| hb0147 | 2027-02-16 | 105 rare bonus word(s) no longer accepted |
| hb0148 | 2027-02-17 | removed B****; 54 rare bonus word(s) no longer accepted; max 90 → 85 |
| hb0149 | 2027-02-18 | demoted to bonus: CREE THRICE; 124 rare bonus word(s) no longer accepted; max 180 → 173 |
| hb0150 | 2027-02-19 | demoted to bonus: DHARMA MAMMA; 68 rare bonus word(s) no longer accepted; max 143 → 132 |
| hb0151 | 2027-02-20 | demoted to bonus: DADA DAFT; 144 rare bonus word(s) no longer accepted; max 232 → 230 |
| hb0152 | 2027-02-21 | demoted to bonus: AMINO MAMMA MING; 111 rare bonus word(s) no longer accepted; max 205 → 194 |
| hb0153 | 2027-02-22 | demoted to bonus: IDIOT; 150 rare bonus word(s) no longer accepted; max 249 → 244 |
| hb0154 | 2027-02-23 | 57 rare bonus word(s) no longer accepted |
| hb0155 | 2027-02-24 | 76 rare bonus word(s) no longer accepted |
| hb0156 | 2027-02-25 | demoted to bonus: LAMA; 96 rare bonus word(s) no longer accepted; max 114 → 113 |
| hb0157 | 2027-02-26 | 92 rare bonus word(s) no longer accepted |
| hb0158 | 2027-02-27 | demoted to bonus: NEURO N***; 114 rare bonus word(s) no longer accepted; max 226 → 220 |
| hb0159 | 2027-02-28 | demoted to bonus: D*** P*** P***; 60 rare bonus word(s) no longer accepted; max 83 → 80 |
| hb0160 | 2027-03-01 | new letter set ACDIMNY → TAGILNV (pangram VIGILANT, 24 words, max 117) — fell under 20 scored words after demotions |
| hb0161 | 2027-03-02 | demoted to bonus: AMIR; 96 rare bonus word(s) no longer accepted; max 213 → 212 |
| hb0162 | 2027-03-03 | demoted to bonus: COCO CONN; 72 rare bonus word(s) no longer accepted; max 168 → 166 |
| hb0163 | 2027-03-04 | demoted to bonus: NEURO RUFF; 102 rare bonus word(s) no longer accepted; max 160 → 154 |
| hb0164 | 2027-03-05 | 61 rare bonus word(s) no longer accepted |
| hb0165 | 2027-03-06 | 53 rare bonus word(s) no longer accepted |
| hb0166 | 2027-03-07 | new letter set CAENRTY → UDENRTW (pangram UNDERWENT, 29 words, max 141) — its only pangram was removed |
| hb0167 | 2027-03-08 | 84 rare bonus word(s) no longer accepted |
| hb0168 | 2027-03-09 | demoted to bonus: ANON NAPA TONNE; 184 rare bonus word(s) no longer accepted; max 167 → 160 |
| hb0169 | 2027-03-10 | 72 rare bonus word(s) no longer accepted |
| hb0170 | 2027-03-11 | 54 rare bonus word(s) no longer accepted |
| hb0171 | 2027-03-12 | demoted to bonus: TONNE; 150 rare bonus word(s) no longer accepted; max 231 → 226 |
| hb0172 | 2027-03-13 | demoted to bonus: CREE JETER JUNE; 95 rare bonus word(s) no longer accepted; max 144 → 137 |
| hb0173 | 2027-03-14 | demoted to bonus: CREE RECTOR THRICE; 169 rare bonus word(s) no longer accepted; max 198 → 185 |
| hb0174 | 2027-03-15 | 116 rare bonus word(s) no longer accepted |
| hb0175 | 2027-03-16 | 63 rare bonus word(s) no longer accepted |
| hb0176 | 2027-03-17 | demoted to bonus: PROTO; 66 rare bonus word(s) no longer accepted; max 95 → 90 |
| hb0177 | 2027-03-18 | removed G******; demoted to bonus: GIRO PONG P***; 46 rare bonus word(s) no longer accepted; max 111 → 101 |
| hb0178 | 2027-03-19 | demoted to bonus: GIRO; 120 rare bonus word(s) no longer accepted; max 160 → 159 |
| hb0179 | 2027-03-20 | demoted to bonus: CENTRIC CREE PENCE; 142 rare bonus word(s) no longer accepted; max 195 → 182 |
| hb0180 | 2027-03-21 | demoted to bonus: LEVANT; 137 rare bonus word(s) no longer accepted; max 126 → 120 |
| hb0181 | 2027-03-22 | demoted to bonus: TORY; 228 rare bonus word(s) no longer accepted; max 189 → 188 |
| hb0182 | 2027-03-23 | demoted to bonus: N***; 89 rare bonus word(s) no longer accepted; max 86 → 85 |
| hb0183 | 2027-03-24 | demoted to bonus: ANON C***; 105 rare bonus word(s) no longer accepted; max 132 → 130 |
| hb0184 | 2027-03-25 | 66 rare bonus word(s) no longer accepted |
| hb0185 | 2027-03-26 | 65 rare bonus word(s) no longer accepted |
| hb0186 | 2027-03-27 | new letter set CEMNORY → EABCRUY (pangram BUREAUCRACY, 28 words, max 110) — fell under 20 scored words after demotions |
| hb0187 | 2027-03-28 | demoted to bonus: COCO CONN M****; 73 rare bonus word(s) no longer accepted; max 103 → 96 |
| hb0188 | 2027-03-29 | demoted to bonus: BABA DADA; 151 rare bonus word(s) no longer accepted; max 217 → 215 |
| hb0189 | 2027-03-30 | 38 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0190 | 2027-03-31 | new letter set PCEINRX → ACINTVY (pangram INACTIVITY, 20 words, max 109) — fell under 20 scored words after demotions |
| hb0191 | 2027-04-01 | removed P******; demoted to bonus: CREE; 145 rare bonus word(s) no longer accepted; max 194 → 186 |
| hb0192 | 2027-04-02 | 74 rare bonus word(s) no longer accepted |
| hb0193 | 2027-04-03 | demoted to bonus: CANT CANTON; 166 rare bonus word(s) no longer accepted; max 234 → 227 |
| hb0194 | 2027-04-04 | 51 rare bonus word(s) no longer accepted |
| hb0195 | 2027-04-05 | removed D***; demoted to bonus: ANON PONG P***; 83 rare bonus word(s) no longer accepted; max 78 → 74 |
| hb0196 | 2027-04-06 | demoted to bonus: AMIR LAMA MAMMA; 136 rare bonus word(s) no longer accepted; max 182 → 175 |
| hb0197 | 2027-04-07 | 47 rare bonus word(s) no longer accepted |
| hb0198 | 2027-04-08 | 93 rare bonus word(s) no longer accepted |
| hb0199 | 2027-04-09 | demoted to bonus: GAGE; 66 rare bonus word(s) no longer accepted; max 111 → 110 |
| hb0200 | 2027-04-10 | new letter set OACGHIN → ECNOPTY (pangram POTENCY, 29 words, max 97) — fell under 20 scored words after demotions |
| hb0201 | 2027-04-11 | demoted to bonus: ANON CANTON C*** COCO CONN; 136 rare bonus word(s) no longer accepted; max 190 → 180 |
| hb0202 | 2027-04-12 | demoted to bonus: B***; 55 rare bonus word(s) no longer accepted; max 84 → 83 |
| hb0203 | 2027-04-13 | demoted to bonus: H*** LAMA; 159 rare bonus word(s) no longer accepted; max 186 → 184 |
| hb0204 | 2027-04-14 | 181 rare bonus word(s) no longer accepted |
| hb0205 | 2027-04-15 | demoted to bonus: CREE; 106 rare bonus word(s) no longer accepted; max 81 → 80 |
| hb0206 | 2027-04-16 | demoted to bonus: DADA; 63 rare bonus word(s) no longer accepted; max 78 → 77 |
| hb0207 | 2027-04-17 | 114 rare bonus word(s) no longer accepted |
| hb0208 | 2027-04-18 | demoted to bonus: TORY; 64 rare bonus word(s) no longer accepted; max 106 → 105 |
| hb0209 | 2027-04-19 | new letter set ABIORTV → LABEOVY (pangram VOLLEYBALL, 30 words, max 114) — fell under 20 scored words after demotions |
| hb0210 | 2027-04-20 | demoted to bonus: BATMAN; 148 rare bonus word(s) no longer accepted; max 208 → 202 |
| hb0211 | 2027-04-21 | 114 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0212 | 2027-04-22 | demoted to bonus: KERN K*** THEREIN; 91 rare bonus word(s) no longer accepted; max 191 → 182 |
| hb0213 | 2027-04-23 | demoted to bonus: ANIL; 146 rare bonus word(s) no longer accepted; max 159 → 158 |
| hb0214 | 2027-04-24 | demoted to bonus: H***; 101 rare bonus word(s) no longer accepted; max 134 → 133 |
| hb0215 | 2027-04-25 | demoted to bonus: TONNE; 131 rare bonus word(s) no longer accepted; max 153 → 148 |
| hb0216 | 2027-04-26 | 129 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0217 | 2027-04-27 | demoted to bonus: BABA; 195 rare bonus word(s) no longer accepted; max 182 → 181 |
| hb0218 | 2027-04-28 | demoted to bonus: GAGE; 129 rare bonus word(s) no longer accepted; max 179 → 178 |
| hb0219 | 2027-04-29 | demoted to bonus: BABA; 202 rare bonus word(s) no longer accepted; max 177 → 176 |
| hb0220 | 2027-04-30 | demoted to bonus: RUFF; 82 rare bonus word(s) no longer accepted; max 115 → 114 |
| hb0221 | 2027-05-01 | demoted to bonus: ANIL ANON; 178 rare bonus word(s) no longer accepted; max 117 → 115 |
| hb0222 | 2027-05-02 | demoted to bonus: GAGE; 48 rare bonus word(s) no longer accepted; max 105 → 104 |
| hb0223 | 2027-05-03 | demoted to bonus: TOOTHED; 36 rare bonus word(s) no longer accepted; max 97 → 90 |
| hb0224 | 2027-05-04 | demoted to bonus: GIRO; 56 rare bonus word(s) no longer accepted; max 146 → 145 |
| hb0225 | 2027-05-05 | 40 rare bonus word(s) no longer accepted |
| hb0226 | 2027-05-06 | demoted to bonus: C***; 143 rare bonus word(s) no longer accepted; max 158 → 157 |
| hb0227 | 2027-05-07 | demoted to bonus: D*** P*** P***; 109 rare bonus word(s) no longer accepted; max 166 → 163 |
| hb0228 | 2027-05-08 | 34 rare bonus word(s) no longer accepted |
| hb0229 | 2027-05-09 | demoted to bonus: APACHE P***; 50 rare bonus word(s) no longer accepted; max 104 → 97 |
| hb0230 | 2027-05-10 | 52 rare bonus word(s) no longer accepted |
| hb0231 | 2027-05-11 | demoted to bonus: BABA DADA; 121 rare bonus word(s) no longer accepted; max 211 → 209 |
| hb0232 | 2027-05-12 | removed L***; demoted to bonus: MULLER; 184 rare bonus word(s) no longer accepted; max 188 → 181 |
| hb0233 | 2027-05-13 | 71 rare bonus word(s) no longer accepted |
| hb0234 | 2027-05-14 | new letter set MFINORU → PCDELRU (pangram PRECLUDE, 23 words, max 104) — fell under 20 scored words after demotions |
| hb0235 | 2027-05-15 | 144 rare bonus word(s) no longer accepted |
| hb0236 | 2027-05-16 | 89 rare bonus word(s) no longer accepted |
| hb0237 | 2027-05-17 | removed P******; demoted to bonus: P***; 84 rare bonus word(s) no longer accepted; max 106 → 98 |
| hb0238 | 2027-05-18 | 39 rare bonus word(s) no longer accepted |
| hb0239 | 2027-05-19 | removed H***; demoted to bonus: MAMMA; 84 rare bonus word(s) no longer accepted; max 119 → 113 |
| hb0240 | 2027-05-20 | removed P***; 139 rare bonus word(s) no longer accepted; max 221 → 220 |
| hb0241 | 2027-05-21 | demoted to bonus: DAFT; 41 rare bonus word(s) no longer accepted; now accepted: FEET; max 109 → 108 |
| hb0242 | 2027-05-22 | demoted to bonus: P*** PROTO TORY; 159 rare bonus word(s) no longer accepted; max 243 → 236 |
| hb0243 | 2027-05-23 | demoted to bonus: AMIR MAMMA; 92 rare bonus word(s) no longer accepted; max 116 → 110 |
| hb0244 | 2027-05-24 | demoted to bonus: CENTRIC CREE; 90 rare bonus word(s) no longer accepted; max 127 → 119 |
| hb0245 | 2027-05-25 | demoted to bonus: C*** DADA; 145 rare bonus word(s) no longer accepted; max 135 → 133 |
| hb0246 | 2027-05-26 | removed H***; demoted to bonus: COCO; 47 rare bonus word(s) no longer accepted; max 82 → 80 |
| hb0247 | 2027-05-27 | new letter set OAGLMPY → HACEIRY (pangram HIERARCHY, 24 words, max 86) — fell under 20 scored words after demotions |
| hb0248 | 2027-05-28 | demoted to bonus: PLAT P***; 111 rare bonus word(s) no longer accepted; max 87 → 85 |
| hb0249 | 2027-05-29 | 134 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0250 | 2027-05-30 | 69 rare bonus word(s) no longer accepted |
| hb0251 | 2027-05-31 | demoted to bonus: TOOTHED; 62 rare bonus word(s) no longer accepted; max 187 → 180 |
| hb0252 | 2027-06-01 | 190 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0253 | 2027-06-02 | 154 rare bonus word(s) no longer accepted |
| hb0254 | 2027-06-03 | demoted to bonus: NAPA P***; 96 rare bonus word(s) no longer accepted; max 106 → 104 |
| hb0255 | 2027-06-04 | 138 rare bonus word(s) no longer accepted |
| hb0256 | 2027-06-05 | removed N*****; 95 rare bonus word(s) no longer accepted |
| hb0257 | 2027-06-06 | demoted to bonus: LAMA; 172 rare bonus word(s) no longer accepted; max 182 → 181 |
| hb0258 | 2027-06-07 | 52 rare bonus word(s) no longer accepted |
| hb0259 | 2027-06-08 | removed N***** N*******; demoted to bonus: LING; 57 rare bonus word(s) no longer accepted; max 92 → 91 |
| hb0260 | 2027-06-09 | 51 rare bonus word(s) no longer accepted |
| hb0261 | 2027-06-10 | demoted to bonus: C*** COCO CONN; 72 rare bonus word(s) no longer accepted; max 226 → 223 |
| hb0262 | 2027-06-11 | demoted to bonus: B****; 55 rare bonus word(s) no longer accepted; max 76 → 71 |
| hb0263 | 2027-06-12 | removed Q****; 104 rare bonus word(s) no longer accepted; max 136 → 131 |
| hb0264 | 2027-06-13 | removed R*******; demoted to bonus: ADVERT; 153 rare bonus word(s) no longer accepted; max 240 → 226 |
| hb0265 | 2027-06-14 | demoted to bonus: MING; 30 rare bonus word(s) no longer accepted; max 84 → 83 |
| hb0266 | 2027-06-15 | demoted to bonus: LAMA PLAT; 102 rare bonus word(s) no longer accepted; max 92 → 90 |
| hb0267 | 2027-06-16 | demoted to bonus: PLAT; 107 rare bonus word(s) no longer accepted; max 93 → 92 |
| hb0268 | 2027-06-17 | demoted to bonus: PARA PARR; 84 rare bonus word(s) no longer accepted; max 148 → 146 |
| hb0269 | 2027-06-18 | demoted to bonus: DADA; 151 rare bonus word(s) no longer accepted; max 214 → 213 |
| hb0270 | 2027-06-19 | demoted to bonus: TRIPOLI; 56 rare bonus word(s) no longer accepted; max 70 → 63 |
| hb0271 | 2027-06-20 | removed Q****; demoted to bonus: CREE; 98 rare bonus word(s) no longer accepted; max 130 → 124 |
| hb0272 | 2027-06-21 | 97 rare bonus word(s) no longer accepted |
| hb0273 | 2027-06-22 | demoted to bonus: ANON BABA LAMA MAMMA; 105 rare bonus word(s) no longer accepted; max 117 → 109 |
| hb0274 | 2027-06-23 | demoted to bonus: WEIR; 75 rare bonus word(s) no longer accepted; max 109 → 108 |
| hb0275 | 2027-06-24 | demoted to bonus: ATLANTIC CANT; 111 rare bonus word(s) no longer accepted; max 122 → 113 |
| hb0276 | 2027-06-25 | demoted to bonus: MAMMA MING; 78 rare bonus word(s) no longer accepted; max 118 → 112 |
| hb0277 | 2027-06-26 | demoted to bonus: CREE MERCER; 148 rare bonus word(s) no longer accepted; max 173 → 166 |
| hb0278 | 2027-06-27 | 80 rare bonus word(s) no longer accepted |
| hb0279 | 2027-06-28 | demoted to bonus: P*** PENCE; 43 rare bonus word(s) no longer accepted; max 153 → 147 |
| hb0280 | 2027-06-29 | 92 rare bonus word(s) no longer accepted |
| hb0281 | 2027-06-30 | demoted to bonus: P*** PROTO; 153 rare bonus word(s) no longer accepted; max 230 → 224 |
| hb0282 | 2027-07-01 | demoted to bonus: TONNE; 56 rare bonus word(s) no longer accepted; max 83 → 78 |
| hb0283 | 2027-07-02 | demoted to bonus: H***; 140 rare bonus word(s) no longer accepted; max 205 → 204 |
| hb0284 | 2027-07-03 | demoted to bonus: CREE MERCER; 135 rare bonus word(s) no longer accepted; max 180 → 173 |
| hb0285 | 2027-07-04 | demoted to bonus: CREE; 99 rare bonus word(s) no longer accepted; max 144 → 143 |
| hb0286 | 2027-07-05 | demoted to bonus: PENCE; 108 rare bonus word(s) no longer accepted; max 129 → 124 |
| hb0287 | 2027-07-06 | demoted to bonus: H****** N***; 134 rare bonus word(s) no longer accepted; max 170 → 162 |
| hb0288 | 2027-07-07 | 91 rare bonus word(s) no longer accepted |
| hb0289 | 2027-07-08 | demoted to bonus: PLAT; 100 rare bonus word(s) no longer accepted; max 78 → 77 |
| hb0290 | 2027-07-09 | 153 rare bonus word(s) no longer accepted |
| hb0291 | 2027-07-10 | 116 rare bonus word(s) no longer accepted |
| hb0292 | 2027-07-11 | 71 rare bonus word(s) no longer accepted |
| hb0293 | 2027-07-12 | demoted to bonus: ANIL ANON; 125 rare bonus word(s) no longer accepted; max 96 → 94 |
| hb0294 | 2027-07-13 | demoted to bonus: TING TUNG; 71 rare bonus word(s) no longer accepted; max 121 → 119 |
| hb0295 | 2027-07-14 | 124 rare bonus word(s) no longer accepted |
| hb0296 | 2027-07-15 | demoted to bonus: ANON M**** P***; 90 rare bonus word(s) no longer accepted; max 107 → 100 |
| hb0297 | 2027-07-16 | demoted to bonus: ANIL BABA INTRA; 174 rare bonus word(s) no longer accepted; max 137 → 130 |
| hb0298 | 2027-07-17 | 102 rare bonus word(s) no longer accepted |
| hb0299 | 2027-07-18 | demoted to bonus: DADA; 63 rare bonus word(s) no longer accepted; max 71 → 70 |
| hb0300 | 2027-07-19 | new letter set CGHINOP → LABIRTY (pangram ARBITRARILY, 23 words, max 94) — fell under 20 scored words after demotions |
| hb0301 | 2027-07-20 | 110 rare bonus word(s) no longer accepted |
| hb0302 | 2027-07-21 | demoted to bonus: GIRO; 82 rare bonus word(s) no longer accepted; max 174 → 173 |
| hb0303 | 2027-07-22 | demoted to bonus: BERG; 114 rare bonus word(s) no longer accepted; max 249 → 248 |
| hb0304 | 2027-07-23 | demoted to bonus: C*** COCO LOCO P***; 59 rare bonus word(s) no longer accepted; max 69 → 65 |
| hb0305 | 2027-07-24 | demoted to bonus: M****; 62 rare bonus word(s) no longer accepted; max 81 → 76 |
| hb0306 | 2027-07-25 | 57 rare bonus word(s) no longer accepted |
| hb0307 | 2027-07-26 | demoted to bonus: CREE; 156 rare bonus word(s) no longer accepted; max 234 → 233 |
| hb0308 | 2027-07-27 | demoted to bonus: P*** PROTO; 137 rare bonus word(s) no longer accepted; max 231 → 225 |
| hb0309 | 2027-07-28 | demoted to bonus: D*** P*** P***; 63 rare bonus word(s) no longer accepted; max 103 → 100 |
| hb0310 | 2027-07-29 | demoted to bonus: ANON; 82 rare bonus word(s) no longer accepted; max 104 → 103 |
| hb0311 | 2027-07-30 | demoted to bonus: ANIL; 109 rare bonus word(s) no longer accepted; max 100 → 99 |
| hb0312 | 2027-07-31 | 89 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0313 | 2027-08-01 | demoted to bonus: WEIR WELLER; 74 rare bonus word(s) no longer accepted; max 214 → 207 |
| hb0314 | 2027-08-02 | demoted to bonus: BLOODED EBOLA; 177 rare bonus word(s) no longer accepted; max 215 → 203 |
| hb0315 | 2027-08-03 | 100 rare bonus word(s) no longer accepted |
| hb0316 | 2027-08-04 | 63 rare bonus word(s) no longer accepted |
| hb0317 | 2027-08-05 | demoted to bonus: RUFF; 83 rare bonus word(s) no longer accepted; max 104 → 103 |
| hb0318 | 2027-08-06 | new letter set PCEMNOT → LBCEIOT (pangram COLLECTIBLE, 43 words, max 141) — fell under 20 scored words after demotions |
| hb0319 | 2027-08-07 | 96 rare bonus word(s) no longer accepted |
| hb0320 | 2027-08-08 | demoted to bonus: HOOVER; 104 rare bonus word(s) no longer accepted; max 168 → 162 |
| hb0321 | 2027-08-09 | new letter set LAENPRY → TDEFINY (pangram IDENTIFY, 37 words, max 191) — its only pangram was removed |
| hb0322 | 2027-08-10 | demoted to bonus: GAGE; 58 rare bonus word(s) no longer accepted; max 120 → 119 |
| hb0323 | 2027-08-11 | demoted to bonus: ANON GAGE; 174 rare bonus word(s) no longer accepted; max 236 → 234 |
| hb0324 | 2027-08-12 | new letter set ODGINPU → CAEGIRV (pangram CAREGIVER, 23 words, max 111) — fell under 20 scored words after demotions |
| hb0325 | 2027-08-13 | new letter set BACEHMR → OABENTY (pangram BAYONET, 24 words, max 69) — fell under 20 scored words after demotions |
| hb0326 | 2027-08-14 | demoted to bonus: CHIT; 17 rare bonus word(s) no longer accepted; max 103 → 102 |
| hb0327 | 2027-08-15 | 122 rare bonus word(s) no longer accepted |
| hb0328 | 2027-08-16 | removed T***; demoted to bonus: N***; 206 rare bonus word(s) no longer accepted; max 196 → 194 |
| hb0329 | 2027-08-17 | demoted to bonus: WEIR; 99 rare bonus word(s) no longer accepted; max 91 → 90 |
| hb0330 | 2027-08-18 | demoted to bonus: CANT TING; 62 rare bonus word(s) no longer accepted; max 125 → 123 |
| hb0331 | 2027-08-19 | 159 rare bonus word(s) no longer accepted |
| hb0332 | 2027-08-20 | removed P***; demoted to bonus: PARA PARR PLAT; 96 rare bonus word(s) no longer accepted; max 88 → 84 |
| hb0333 | 2027-08-21 | demoted to bonus: D*** DRAPER NAPA PARA PARR P*** P***; 141 rare bonus word(s) no longer accepted; max 249 → 237 |
| hb0334 | 2027-08-22 | demoted to bonus: N***; 91 rare bonus word(s) no longer accepted; max 204 → 203 |
| hb0335 | 2027-08-23 | 76 rare bonus word(s) no longer accepted |
| hb0336 | 2027-08-24 | demoted to bonus: TING; 85 rare bonus word(s) no longer accepted; max 144 → 143 |
| hb0337 | 2027-08-25 | demoted to bonus: AMIR MAMMA; 108 rare bonus word(s) no longer accepted; max 99 → 93 |
| hb0338 | 2027-08-26 | demoted to bonus: LAMA MAMMA; 133 rare bonus word(s) no longer accepted; max 155 → 149 |
| hb0339 | 2027-08-27 | demoted to bonus: CANT CANTON; 126 rare bonus word(s) no longer accepted; max 164 → 157 |
| hb0340 | 2027-08-28 | removed H***; demoted to bonus: COCO CONN M****; 80 rare bonus word(s) no longer accepted; max 159 → 151 |
| hb0341 | 2027-08-29 | 145 rare bonus word(s) no longer accepted |
| hb0342 | 2027-08-30 | 32 rare bonus word(s) no longer accepted |
| hb0343 | 2027-08-31 | demoted to bonus: DRAPER PARA PARR P***; 81 rare bonus word(s) no longer accepted; max 167 → 158 |
| hb0344 | 2027-09-01 | removed N*****; 70 rare bonus word(s) no longer accepted |
| hb0345 | 2027-09-02 | demoted to bonus: P***; 54 rare bonus word(s) no longer accepted; max 75 → 74 |
| hb0346 | 2027-09-03 | demoted to bonus: H*** LEGGED; 67 rare bonus word(s) no longer accepted; max 153 → 146 |
| hb0347 | 2027-09-04 | demoted to bonus: WEIR; 68 rare bonus word(s) no longer accepted; max 88 → 87 |
| hb0348 | 2027-09-05 | 102 rare bonus word(s) no longer accepted |
| hb0349 | 2027-09-06 | new letter set ABDEGNO → VEIMORT (pangram OVERTIME, 21 words, max 102) — its only pangram was removed |
| hb0350 | 2027-09-07 | 208 rare bonus word(s) no longer accepted |
| hb0351 | 2027-09-08 | demoted to bonus: AMINO ANON; 101 rare bonus word(s) no longer accepted; max 168 → 162 |
| hb0352 | 2027-09-09 | 52 rare bonus word(s) no longer accepted |
| hb0353 | 2027-09-10 | 50 rare bonus word(s) no longer accepted |
| hb0354 | 2027-09-11 | demoted to bonus: CREE; 73 rare bonus word(s) no longer accepted; max 121 → 120 |
| hb0355 | 2027-09-12 | demoted to bonus: LEGGED; 51 rare bonus word(s) no longer accepted; max 110 → 104 |
| hb0356 | 2027-09-13 | demoted to bonus: BABA; 60 rare bonus word(s) no longer accepted; max 96 → 95 |
| hb0357 | 2027-09-14 | 80 rare bonus word(s) no longer accepted |
| hb0358 | 2027-09-15 | new letter set CDNORTU → FCEILRY (pangram FIERCELY, 29 words, max 118) — fell under 20 scored words after demotions |
| hb0359 | 2027-09-16 | demoted to bonus: TING; 37 rare bonus word(s) no longer accepted; max 123 → 122 |
| hb0360 | 2027-09-17 | demoted to bonus: COCO CONN; 78 rare bonus word(s) no longer accepted; max 109 → 107 |
| hb0361 | 2027-09-18 | demoted to bonus: AORTIC; 157 rare bonus word(s) no longer accepted; max 170 → 157 |
| hb0362 | 2027-09-19 | demoted to bonus: NEURO N***; 137 rare bonus word(s) no longer accepted; max 202 → 196 |
| hb0363 | 2027-09-20 | demoted to bonus: AMIR MAMMA; 71 rare bonus word(s) no longer accepted; max 108 → 102 |
| hb0364 | 2027-09-21 | demoted to bonus: MAMMA; 104 rare bonus word(s) no longer accepted; max 129 → 124 |
| hb0365 | 2027-09-22 | 64 rare bonus word(s) no longer accepted |
| hb0366 | 2027-09-23 | removed G****; demoted to bonus: GAGE; 76 rare bonus word(s) no longer accepted; max 114 → 113 |
| hb0367 | 2027-09-24 | demoted to bonus: CREE MERCER MULLER; 79 rare bonus word(s) no longer accepted; max 104 → 91 |
| hb0368 | 2027-09-25 | demoted to bonus: LAMA MAMMA; 70 rare bonus word(s) no longer accepted; max 91 → 85 |
| hb0369 | 2027-09-26 | removed H***; demoted to bonus: MAHATMA MAMMA M****; 62 rare bonus word(s) no longer accepted; max 116 → 98 |
| hb0370 | 2027-09-27 | 88 rare bonus word(s) no longer accepted |
| hb0371 | 2027-09-28 | 28 rare bonus word(s) no longer accepted |
| hb0372 | 2027-09-29 | 87 rare bonus word(s) no longer accepted |
| hb0373 | 2027-09-30 | 117 rare bonus word(s) no longer accepted |
| hb0374 | 2027-10-01 | demoted to bonus: AMIR CREE MERCER; 158 rare bonus word(s) no longer accepted; max 214 → 206 |
| hb0375 | 2027-10-02 | demoted to bonus: N***; 132 rare bonus word(s) no longer accepted; max 203 → 202 |
| hb0376 | 2027-10-03 | 60 rare bonus word(s) no longer accepted |
| hb0377 | 2027-10-04 | demoted to bonus: COCO CONN; 50 rare bonus word(s) no longer accepted; max 138 → 136 |
| hb0378 | 2027-10-05 | demoted to bonus: C*** DADA MAMMA; 69 rare bonus word(s) no longer accepted; max 165 → 158 |
| hb0379 | 2027-10-06 | demoted to bonus: BACH; 69 rare bonus word(s) no longer accepted; max 151 → 150 |
| hb0380 | 2027-10-07 | new letter set OCEHRUV → ACNOPTU (pangram OCCUPANT, 22 words, max 89) — fell under 20 scored words after demotions |
| hb0381 | 2027-10-08 | demoted to bonus: DAFT; 101 rare bonus word(s) no longer accepted; now accepted: FEET; max 201 → 200 |
| hb0382 | 2027-10-09 | demoted to bonus: C*** COCO LOCO; 131 rare bonus word(s) no longer accepted; max 195 → 192 |
| hb0383 | 2027-10-10 | 246 rare bonus word(s) no longer accepted |
| hb0384 | 2027-10-11 | demoted to bonus: TORY; 91 rare bonus word(s) no longer accepted; max 121 → 120 |
| hb0385 | 2027-10-12 | 112 rare bonus word(s) no longer accepted |
| hb0386 | 2027-10-13 | removed B****; demoted to bonus: B***; 73 rare bonus word(s) no longer accepted; max 84 → 83 |
| hb0387 | 2027-10-14 | new letter set PACILRT → MAENPTY (pangram PAYMENT, 20 words, max 70) — fell under 20 scored words after demotions |
| hb0388 | 2027-10-15 | demoted to bonus: CREE MERCER; 140 rare bonus word(s) no longer accepted; max 185 → 178 |
| hb0389 | 2027-10-16 | demoted to bonus: DADA; 129 rare bonus word(s) no longer accepted; max 156 → 155 |
| hb0390 | 2027-10-17 | 38 rare bonus word(s) no longer accepted |
| hb0391 | 2027-10-18 | demoted to bonus: LAMA; 98 rare bonus word(s) no longer accepted; max 75 → 74 |
| hb0392 | 2027-10-19 | demoted to bonus: CANT CANTON C*** COCO CONN; 127 rare bonus word(s) no longer accepted; max 227 → 217 |
| hb0393 | 2027-10-20 | demoted to bonus: ANIL ANON; 131 rare bonus word(s) no longer accepted; max 144 → 142 |
| hb0394 | 2027-10-21 | demoted to bonus: GAGE; 146 rare bonus word(s) no longer accepted; max 126 → 125 |
| hb0395 | 2027-10-22 | demoted to bonus: D***** N***; 180 rare bonus word(s) no longer accepted; max 223 → 216 |
| hb0396 | 2027-10-23 | demoted to bonus: PARA PARR PROTO TORAH; 85 rare bonus word(s) no longer accepted; max 111 → 99 |
| hb0397 | 2027-10-24 | 163 rare bonus word(s) no longer accepted |
| hb0398 | 2027-10-25 | demoted to bonus: WEIR; 46 rare bonus word(s) no longer accepted; max 112 → 111 |
| hb0399 | 2027-10-26 | 36 rare bonus word(s) no longer accepted |
| hb0400 | 2027-10-27 | demoted to bonus: CANT DADA; 91 rare bonus word(s) no longer accepted; max 183 → 181 |
| hb0401 | Unlimited | removed T***; 32 rare bonus word(s) no longer accepted; max 113 → 112 |
| hb0402 | Unlimited | demoted to bonus: N***; 96 rare bonus word(s) no longer accepted; max 210 → 209 |
| hb0403 | Unlimited | 139 rare bonus word(s) no longer accepted |
| hb0404 | Unlimited | demoted to bonus: D*****; 83 rare bonus word(s) no longer accepted; max 179 → 173 |
| hb0405 | Unlimited | 129 rare bonus word(s) no longer accepted |
| hb0406 | Unlimited | removed D***; demoted to bonus: GIRO; 49 rare bonus word(s) no longer accepted; max 175 → 173 |
| hb0407 | Unlimited | 90 rare bonus word(s) no longer accepted |
| hb0408 | Unlimited | demoted to bonus: CANT PENCE; 130 rare bonus word(s) no longer accepted; max 184 → 178 |
| hb0409 | Unlimited | demoted to bonus: CREE FRANC; 155 rare bonus word(s) no longer accepted; max 195 → 189 |
| hb0410 | Unlimited | 97 rare bonus word(s) no longer accepted |
| hb0411 | Unlimited | demoted to bonus: JUNE; 81 rare bonus word(s) no longer accepted; max 75 → 74 |
| hb0412 | Unlimited | demoted to bonus: H*** LEGGED; 37 rare bonus word(s) no longer accepted; max 163 → 156 |
| hb0413 | Unlimited | demoted to bonus: TONNE; 142 rare bonus word(s) no longer accepted; max 203 → 198 |
| hb0414 | Unlimited | 167 rare bonus word(s) no longer accepted |
| hb0415 | Unlimited | 86 rare bonus word(s) no longer accepted; max 139 → 134 |
| hb0416 | Unlimited | demoted to bonus: NAPA; 148 rare bonus word(s) no longer accepted; max 185 → 184 |
| hb0417 | Unlimited | demoted to bonus: BABA DADA; 80 rare bonus word(s) no longer accepted; max 103 → 101 |
| hb0418 | Unlimited | 66 rare bonus word(s) no longer accepted |
| hb0419 | Unlimited | demoted to bonus: ANIL; 95 rare bonus word(s) no longer accepted; max 71 → 70 |
| hb0420 | Unlimited | 184 rare bonus word(s) no longer accepted |
| hb0421 | Unlimited | demoted to bonus: APACHE HEPATIC; 100 rare bonus word(s) no longer accepted; max 105 → 85 |
| hb0422 | Unlimited | 103 rare bonus word(s) no longer accepted |
| hb0423 | Unlimited | demoted to bonus: ANON; 113 rare bonus word(s) no longer accepted; max 129 → 128 |
| hb0424 | Unlimited | removed P****** P********; 92 rare bonus word(s) no longer accepted; max 197 → 181 |
| hb0425 | Unlimited | demoted to bonus: COCO; 104 rare bonus word(s) no longer accepted; max 172 → 171 |
| hb0426 | Unlimited | demoted to bonus: P***; 73 rare bonus word(s) no longer accepted; max 105 → 104 |
| hb0427 | Unlimited | 69 rare bonus word(s) no longer accepted |
| hb0428 | Unlimited | demoted to bonus: LAMA MAMMA; 65 rare bonus word(s) no longer accepted; max 85 → 79 |
| hb0429 | Unlimited | demoted to bonus: BABA; 72 rare bonus word(s) no longer accepted; max 126 → 125 |
| hb0430 | Unlimited | demoted to bonus: COCO CONN GIRO; 56 rare bonus word(s) no longer accepted; max 93 → 90 |
| hb0431 | Unlimited | 70 rare bonus word(s) no longer accepted |
| hb0432 | Unlimited | demoted to bonus: LEGGED; 49 rare bonus word(s) no longer accepted; max 104 → 98 |
| hb0433 | Unlimited | demoted to bonus: CHIT; 99 rare bonus word(s) no longer accepted; max 119 → 118 |
| hb0434 | Unlimited | removed N*****; 31 rare bonus word(s) no longer accepted |
| hb0435 | Unlimited | demoted to bonus: CREE; 120 rare bonus word(s) no longer accepted; max 113 → 112 |
| hb0436 | Unlimited | demoted to bonus: CONN KERN; 62 rare bonus word(s) no longer accepted; max 187 → 185 |
| hb0437 | Unlimited | demoted to bonus: GAGE MAMMA; 221 rare bonus word(s) no longer accepted; max 219 → 213 |
| hb0438 | Unlimited | 91 rare bonus word(s) no longer accepted |
| hb0439 | Unlimited | 146 rare bonus word(s) no longer accepted |
| hb0440 | Unlimited | demoted to bonus: ANON TONNE; 177 rare bonus word(s) no longer accepted; max 158 → 152 |
| hb0441 | Unlimited | demoted to bonus: CHIT THENCE; 70 rare bonus word(s) no longer accepted; max 141 → 134 |
| hb0442 | Unlimited | new letter set GAEILTY → NEIKLTW (pangram TWINKLE, 30 words, max 97) — fell under 20 scored words after demotions |
| hb0443 | Unlimited | 42 rare bonus word(s) no longer accepted |
| hb0444 | Unlimited | demoted to bonus: N***; 103 rare bonus word(s) no longer accepted; max 125 → 124 |
| hb0445 | Unlimited | demoted to bonus: MING; 54 rare bonus word(s) no longer accepted; max 111 → 110 |
| hb0446 | Unlimited | demoted to bonus: C*** COCO CONN; 92 rare bonus word(s) no longer accepted; max 114 → 111 |
| hb0447 | Unlimited | demoted to bonus: D*** POLLARD P***; 154 rare bonus word(s) no longer accepted; max 224 → 215 |
| hb0448 | Unlimited | demoted to bonus: PARA PARR; 96 rare bonus word(s) no longer accepted; max 100 → 98 |
| hb0449 | Unlimited | 96 rare bonus word(s) no longer accepted |
| hb0450 | Unlimited | demoted to bonus: BABA GAGE LAMA MAMMA; 163 rare bonus word(s) no longer accepted; max 167 → 159 |
| hb0451 | Unlimited | demoted to bonus: BABA MAHATMA MAMMA TORAH; 97 rare bonus word(s) no longer accepted; max 125 → 107 |
| hb0452 | Unlimited | demoted to bonus: AMINO IDIOT; 181 rare bonus word(s) no longer accepted; max 229 → 219 |
| hb0453 | Unlimited | demoted to bonus: H***; 35 rare bonus word(s) no longer accepted; max 85 → 84 |
| hb0454 | Unlimited | demoted to bonus: ANIL; 80 rare bonus word(s) no longer accepted; max 110 → 109 |
| hb0455 | Unlimited | demoted to bonus: CHIT; 113 rare bonus word(s) no longer accepted; max 114 → 113 |
| hb0456 | Unlimited | new letter set VADEOPR → ICGHLTY (pangram GLITCHY, 25 words, max 116) — fell under 20 scored words after demotions |
| hb0457 | Unlimited | removed T***; 46 rare bonus word(s) no longer accepted; max 71 → 70 |
| hb0458 | Unlimited | 101 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0459 | Unlimited | demoted to bonus: LEGGED; 101 rare bonus word(s) no longer accepted; max 233 → 227 |
| hb0460 | Unlimited | 92 rare bonus word(s) no longer accepted |
| hb0461 | Unlimited | 65 rare bonus word(s) no longer accepted |
| hb0462 | Unlimited | 159 rare bonus word(s) no longer accepted |
| hb0463 | Unlimited | demoted to bonus: ANON M****; 117 rare bonus word(s) no longer accepted; max 103 → 97 |
| hb0464 | Unlimited | removed T***; demoted to bonus: PROTO; 44 rare bonus word(s) no longer accepted; max 96 → 90 |
| hb0465 | Unlimited | demoted to bonus: PONG P***; 62 rare bonus word(s) no longer accepted; max 208 → 206 |
| hb0466 | Unlimited | demoted to bonus: P***; 92 rare bonus word(s) no longer accepted; max 190 → 189 |
| hb0467 | Unlimited | 88 rare bonus word(s) no longer accepted |
| hb0468 | Unlimited | 29 rare bonus word(s) no longer accepted |
| hb0469 | Unlimited | demoted to bonus: NAPA PENCE PLAT; 128 rare bonus word(s) no longer accepted; max 178 → 171 |
| hb0470 | Unlimited | demoted to bonus: G*****; 112 rare bonus word(s) no longer accepted; max 150 → 144 |
| hb0471 | Unlimited | new letter set RALNOPU → BAEINRW (pangram WEBINAR, 26 words, max 115) — fell under 20 scored words after demotions |
| hb0472 | Unlimited | demoted to bonus: P***; 65 rare bonus word(s) no longer accepted; max 87 → 86 |
| hb0473 | Unlimited | demoted to bonus: GAGE; 111 rare bonus word(s) no longer accepted; max 145 → 144 |
| hb0474 | Unlimited | 96 rare bonus word(s) no longer accepted |
| hb0475 | Unlimited | demoted to bonus: DADA; 121 rare bonus word(s) no longer accepted; max 157 → 156 |
| hb0476 | Unlimited | demoted to bonus: AMINO ANON C*** COCO CONN P***; 112 rare bonus word(s) no longer accepted; max 109 → 99 |
| hb0477 | Unlimited | new letter set UADEFRT → RAEHNWY (pangram ANYWHERE, 26 words, max 87) — fell under 20 scored words after demotions |
| hb0478 | Unlimited | demoted to bonus: PEPTIDE; 89 rare bonus word(s) no longer accepted; max 185 → 178 |
| hb0479 | Unlimited | new letter set ABEGORX → TAILOVY (pangram VOLATILITY, 20 words, max 76) — its only pangram was removed |
| hb0480 | Unlimited | 66 rare bonus word(s) no longer accepted |
| hb0481 | Unlimited | 64 rare bonus word(s) no longer accepted |
| hb0482 | Unlimited | removed L***; demoted to bonus: B***; 47 rare bonus word(s) no longer accepted; max 90 → 88 |
| hb0483 | Unlimited | 45 rare bonus word(s) no longer accepted |
| hb0484 | Unlimited | demoted to bonus: CANTOR CONTRA TORY; 129 rare bonus word(s) no longer accepted; max 196 → 183 |
| hb0485 | Unlimited | demoted to bonus: ANIL ANON; 249 rare bonus word(s) no longer accepted; max 211 → 209 |
| hb0486 | Unlimited | demoted to bonus: COCO CONN LOCO; 72 rare bonus word(s) no longer accepted; max 176 → 173 |
| hb0487 | Unlimited | 82 rare bonus word(s) no longer accepted |
| hb0488 | Unlimited | 45 rare bonus word(s) no longer accepted |
| hb0489 | Unlimited | demoted to bonus: IDIOT; 126 rare bonus word(s) no longer accepted; max 173 → 168 |
| hb0490 | Unlimited | new letter set TAINRUY → ABCIKLT (pangram CLICKBAIT, 20 words, max 73) — fell under 20 scored words after demotions |
| hb0491 | Unlimited | demoted to bonus: AMIR MAMMA PARA PARR; 94 rare bonus word(s) no longer accepted; max 113 → 100 |
| hb0492 | Unlimited | 78 rare bonus word(s) no longer accepted |
| hb0493 | Unlimited | demoted to bonus: NEURO N***; 139 rare bonus word(s) no longer accepted; max 163 → 157 |
| hb0494 | Unlimited | demoted to bonus: BABA; 191 rare bonus word(s) no longer accepted; max 141 → 140 |
| hb0495 | Unlimited | 153 rare bonus word(s) no longer accepted |
| hb0496 | Unlimited | demoted to bonus: P*** PROTO; 57 rare bonus word(s) no longer accepted; max 158 → 152 |
| hb0497 | Unlimited | 56 rare bonus word(s) no longer accepted |
| hb0498 | Unlimited | 80 rare bonus word(s) no longer accepted |
| hb0499 | Unlimited | 51 rare bonus word(s) no longer accepted |
| hb0500 | Unlimited | demoted to bonus: GAGE TUNG; 158 rare bonus word(s) no longer accepted; max 149 → 147 |
| hb0501 | Unlimited | new letter set OAELNRU → LAFINPU (pangram PAINFUL, 21 words, max 65) — its only pangram was removed |
| hb0502 | Unlimited | new letter set RDENOUW → RDEILVY (pangram DELIVERY, 44 words, max 224) — its only pangram was removed |
| hb0503 | Unlimited | demoted to bonus: D*** P*** P*** PORTED PROTO; 109 rare bonus word(s) no longer accepted; max 236 → 222 |
| hb0504 | Unlimited | demoted to bonus: AMINO AMIR ANON IRONMAN MAMMA; 159 rare bonus word(s) no longer accepted; max 240 → 221 |
| hb0505 | Unlimited | 57 rare bonus word(s) no longer accepted |
| hb0506 | Unlimited | demoted to bonus: CANT; 98 rare bonus word(s) no longer accepted; max 194 → 193 |
| hb0507 | Unlimited | demoted to bonus: PARA PARR; 99 rare bonus word(s) no longer accepted; max 161 → 159 |
| hb0508 | Unlimited | demoted to bonus: D*** P*** P***; 65 rare bonus word(s) no longer accepted; max 97 → 94 |
| hb0509 | Unlimited | 60 rare bonus word(s) no longer accepted |
| hb0510 | Unlimited | demoted to bonus: ANON C***; 152 rare bonus word(s) no longer accepted; max 183 → 181 |
| hb0511 | Unlimited | 61 rare bonus word(s) no longer accepted |
| hb0512 | Unlimited | 75 rare bonus word(s) no longer accepted |
| hb0513 | Unlimited | demoted to bonus: WEIR; 69 rare bonus word(s) no longer accepted; max 108 → 107 |
| hb0514 | Unlimited | 130 rare bonus word(s) no longer accepted |
| hb0515 | Unlimited | demoted to bonus: DADA; 168 rare bonus word(s) no longer accepted; max 200 → 199 |
| hb0516 | Unlimited | demoted to bonus: D*** P***; 57 rare bonus word(s) no longer accepted; max 132 → 130 |
| hb0517 | Unlimited | 163 rare bonus word(s) no longer accepted |
| hb0518 | Unlimited | demoted to bonus: FOOTED IDIOT; 106 rare bonus word(s) no longer accepted; max 178 → 167 |
| hb0519 | Unlimited | demoted to bonus: ANON; 135 rare bonus word(s) no longer accepted; max 169 → 168 |
| hb0520 | Unlimited | demoted to bonus: H****** NAPA; 192 rare bonus word(s) no longer accepted; max 154 → 146 |
| hb0521 | Unlimited | demoted to bonus: C*** COCO LOCO; 76 rare bonus word(s) no longer accepted; max 96 → 93 |
| hb0522 | Unlimited | demoted to bonus: ANIL; 220 rare bonus word(s) no longer accepted; max 180 → 179 |
| hb0523 | Unlimited | 81 rare bonus word(s) no longer accepted |
| hb0524 | Unlimited | new letter set ADLNRUY → VBEGILN (pangram BELIEVING, 20 words, max 86) — fell under 20 scored words after demotions |
| hb0525 | Unlimited | demoted to bonus: D*** NAPA P*** P***; 76 rare bonus word(s) no longer accepted; max 122 → 118 |
| hb0526 | Unlimited | demoted to bonus: FRANC GAGE GENERA GRANGE GRANGER; 130 rare bonus word(s) no longer accepted; max 200 → 175 |
| hb0527 | Unlimited | 104 rare bonus word(s) no longer accepted |
| hb0528 | Unlimited | 186 rare bonus word(s) no longer accepted |
| hb0529 | Unlimited | demoted to bonus: BABA DADA EBOLA; 145 rare bonus word(s) no longer accepted; max 227 → 220 |
| hb0530 | Unlimited | removed G****; demoted to bonus: GAGE; 67 rare bonus word(s) no longer accepted; max 190 → 189 |
| hb0531 | Unlimited | demoted to bonus: BABA; 96 rare bonus word(s) no longer accepted; max 109 → 108 |
| hb0532 | Unlimited | 60 rare bonus word(s) no longer accepted |
| hb0533 | Unlimited | new letter set NACILTY → ECDGLNT (pangram NEGLECTED, 35 words, max 144) — fell under 20 scored words after demotions |
| hb0534 | Unlimited | demoted to bonus: NAPA PENCE; 132 rare bonus word(s) no longer accepted; max 194 → 188 |
| hb0535 | Unlimited | demoted to bonus: GAGE; 101 rare bonus word(s) no longer accepted; max 111 → 110 |
| hb0536 | Unlimited | new letter set GAELNOU → NCDEFIY (pangram DEFICIENCY, 28 words, max 142) — fell under 20 scored words after demotions |
| hb0537 | Unlimited | demoted to bonus: NAPA; 201 rare bonus word(s) no longer accepted; max 226 → 225 |
| hb0538 | Unlimited | demoted to bonus: IDIOT; 72 rare bonus word(s) no longer accepted; max 125 → 120 |
| hb0539 | Unlimited | removed C***; demoted to bonus: PARA PARR; 170 rare bonus word(s) no longer accepted; max 239 → 236 |
| hb0540 | Unlimited | 51 rare bonus word(s) no longer accepted |
| hb0541 | Unlimited | removed N***** N*******; demoted to bonus: G****** H*** LING; 64 rare bonus word(s) no longer accepted; max 238 → 229 |
| hb0542 | Unlimited | demoted to bonus: ANON; 77 rare bonus word(s) no longer accepted; max 146 → 145 |
| hb0543 | Unlimited | demoted to bonus: AMINO ANON C*** COCO CONN IRONMAN M****; 151 rare bonus word(s) no longer accepted; max 190 → 169 |
| hb0544 | Unlimited | demoted to bonus: TONNE; 160 rare bonus word(s) no longer accepted; max 197 → 192 |
| hb0545 | Unlimited | demoted to bonus: ANON TONNE; 76 rare bonus word(s) no longer accepted; max 99 → 93 |
| hb0546 | Unlimited | demoted to bonus: CREE; 128 rare bonus word(s) no longer accepted; max 185 → 184 |
| hb0547 | Unlimited | demoted to bonus: B***; 126 rare bonus word(s) no longer accepted; max 119 → 118 |
| hb0548 | Unlimited | demoted to bonus: LAMA; 111 rare bonus word(s) no longer accepted; max 70 → 69 |
| hb0549 | Unlimited | demoted to bonus: ANON LAMA MAMMA; 81 rare bonus word(s) no longer accepted; max 86 → 79 |
| hb0550 | Unlimited | demoted to bonus: GIRO; 73 rare bonus word(s) no longer accepted; max 120 → 119 |
| hb0551 | Unlimited | demoted to bonus: MEDIAL; 78 rare bonus word(s) no longer accepted; max 197 → 191 |
| hb0552 | Unlimited | demoted to bonus: RUFF; 84 rare bonus word(s) no longer accepted; now accepted: FEET; max 119 → 118 |
| hb0553 | Unlimited | demoted to bonus: M****; 111 rare bonus word(s) no longer accepted; max 156 → 151 |
| hb0554 | Unlimited | 57 rare bonus word(s) no longer accepted |
| hb0555 | Unlimited | demoted to bonus: BABA C*** EBOLA; 97 rare bonus word(s) no longer accepted; max 109 → 102 |
| hb0556 | Unlimited | new letter set RAFIMNY → OIJLNTY (pangram JOINTLY, 23 words, max 66) — fell under 20 scored words after demotions |
| hb0557 | Unlimited | demoted to bonus: ANON DADA; 150 rare bonus word(s) no longer accepted; max 158 → 156 |
| hb0558 | Unlimited | demoted to bonus: B***; 80 rare bonus word(s) no longer accepted; max 79 → 78 |
| hb0559 | Unlimited | demoted to bonus: ANON; 94 rare bonus word(s) no longer accepted; max 131 → 130 |
| hb0560 | Unlimited | demoted to bonus: C*** COCO LOCO; 49 rare bonus word(s) no longer accepted; max 72 → 69 |
| hb0561 | Unlimited | demoted to bonus: PLAT; 161 rare bonus word(s) no longer accepted; max 181 → 180 |
| hb0562 | Unlimited | 122 rare bonus word(s) no longer accepted |
| hb0563 | Unlimited | demoted to bonus: H****** NAPA PLAT; 200 rare bonus word(s) no longer accepted; max 223 → 214 |
| hb0564 | Unlimited | 60 rare bonus word(s) no longer accepted |
| hb0565 | Unlimited | demoted to bonus: PLAT; 150 rare bonus word(s) no longer accepted; max 189 → 188 |
| hb0566 | Unlimited | 140 rare bonus word(s) no longer accepted |
| hb0567 | Unlimited | 40 rare bonus word(s) no longer accepted |
| hb0568 | Unlimited | demoted to bonus: COCO CONN; 74 rare bonus word(s) no longer accepted; max 179 → 177 |
| hb0569 | Unlimited | demoted to bonus: AMINO MAMMA; 156 rare bonus word(s) no longer accepted; max 167 → 157 |
| hb0570 | Unlimited | demoted to bonus: LAMA; 95 rare bonus word(s) no longer accepted; max 79 → 78 |
| hb0571 | Unlimited | demoted to bonus: PEPTIDE; 74 rare bonus word(s) no longer accepted; max 105 → 98 |
| hb0572 | Unlimited | demoted to bonus: DRAPER NAPA PARA PARR P***; 120 rare bonus word(s) no longer accepted; max 184 → 174 |
| hb0573 | Unlimited | 139 rare bonus word(s) no longer accepted |
| hb0574 | Unlimited | demoted to bonus: CREE; 70 rare bonus word(s) no longer accepted; max 91 → 90 |
| hb0575 | Unlimited | demoted to bonus: LAMA MAMMA; 178 rare bonus word(s) no longer accepted; max 188 → 182 |
| hb0576 | Unlimited | demoted to bonus: LINDEN; 67 rare bonus word(s) no longer accepted; max 110 → 104 |
| hb0577 | Unlimited | 124 rare bonus word(s) no longer accepted |
| hb0578 | Unlimited | demoted to bonus: TUNG UTERINE; 142 rare bonus word(s) no longer accepted; max 204 → 196 |
| hb0579 | Unlimited | 49 rare bonus word(s) no longer accepted |
| hb0580 | Unlimited | demoted to bonus: H***; 121 rare bonus word(s) no longer accepted; max 157 → 156 |
| hb0581 | Unlimited | 52 rare bonus word(s) no longer accepted |
| hb0582 | Unlimited | demoted to bonus: TONNE; 120 rare bonus word(s) no longer accepted; max 233 → 228 |
| hb0583 | Unlimited | demoted to bonus: NEURO; 99 rare bonus word(s) no longer accepted; max 118 → 113 |
| hb0584 | Unlimited | demoted to bonus: HOOVER HOVE; 100 rare bonus word(s) no longer accepted; max 224 → 217 |
| hb0585 | Unlimited | demoted to bonus: PLAT; 222 rare bonus word(s) no longer accepted; max 203 → 202 |
| hb0586 | Unlimited | demoted to bonus: DAFT; 70 rare bonus word(s) no longer accepted; now accepted: FEET; max 174 → 173 |
| hb0587 | Unlimited | demoted to bonus: C*** COCO CONN LOCO; 55 rare bonus word(s) no longer accepted; max 124 → 120 |
| hb0588 | Unlimited | demoted to bonus: COCO CONN; 67 rare bonus word(s) no longer accepted; max 152 → 150 |
| hb0589 | Unlimited | removed P***; 71 rare bonus word(s) no longer accepted; max 83 → 82 |
| hb0590 | Unlimited | new letter set NAILOPV → HACDEIN (pangram CHAINED, 23 words, max 96) — fell under 20 scored words after demotions |
| hb0591 | Unlimited | new letter set HAEILPT → AGHLOTU (pangram ALTHOUGH, 21 words, max 61) — its only pangram was removed |
| hb0592 | Unlimited | demoted to bonus: INTRA; 80 rare bonus word(s) no longer accepted; max 97 → 92 |
| hb0593 | Unlimited | removed L***; 70 rare bonus word(s) no longer accepted; max 132 → 131 |
| hb0594 | Unlimited | demoted to bonus: NETBALL; 123 rare bonus word(s) no longer accepted; max 140 → 133 |
| hb0595 | Unlimited | demoted to bonus: IDIOT; 157 rare bonus word(s) no longer accepted; max 232 → 227 |
| hb0596 | Unlimited | 59 rare bonus word(s) no longer accepted |
| hb0597 | Unlimited | demoted to bonus: DADA N***; 109 rare bonus word(s) no longer accepted; max 142 → 140 |
| hb0598 | Unlimited | 56 rare bonus word(s) no longer accepted; now accepted: FEET |
| hb0599 | Unlimited | removed L***; demoted to bonus: B***; 86 rare bonus word(s) no longer accepted; max 123 → 121 |
| hb0600 | Unlimited | new letter set NCEPRTU → WDEILRY (pangram WEIRDLY, 22 words, max 86) — its only pangram was removed |

</details>

### Letter Ladder — 38 puzzle(s) changed (`apps/web/data/ladder-puzzles.json`)

<details><summary>All 38 changes</summary>

| Ladder | Date | Path (masked) | Why |
|---|---|---|---|
| ld0059 | 2026-11-20 | PLACE PLATE SLATE SLAVE SHAVE SHALE SHALL → PLACE PLATE SLATE STATE STALE SHALE SHALL (par 6 → 6) | inappropriate |
| ld0062 | 2026-11-23 | SHAME SHARE SHARK SHANK S**** → SHAME SHARE SHORE SHORT SPORT (par 4 → 4) | inappropriate |
| ld0168 | 2027-03-09 | PUNCH BUNCH B**** BATCH LATCH → PUNCH PINCH PITCH PATCH LATCH (par 4 → 4) | inappropriate |
| ld0174 | 2027-03-15 | PLANE PLANK FLANK FRANK FRANC → JELLY JOLLY FOLLY FILLY SILLY (par 4 → 4) | content gate |
| ld0190 | 2027-03-31 | BLANC BLAND BRAND GRAND GRANT GRUNT → BLANK BLAND BRAND GRAND GRANT GRUNT (par 5 → 5) | obscure |
| ld0192 | 2027-04-02 | B**** BOWER LOWER LONER LINER LINED LIKED → TOWEL TOWER LOWER LOVER LOVED LIVED LIKED (par 6 → 6) | inappropriate |
| ld0205 | 2027-04-15 | SLAVE STAVE STALE STALK STACK STUCK → SHAVE SHARE SHARK STARK STACK STUCK (par 5 → 5) | inappropriate |
| ld0218 | 2027-04-28 | S**** SPARK SPARE SCARE SCORE SCOPE → SHIFT SHIRT SHORT SHORE SCORE SCOPE (par 5 → 5) | inappropriate |
| ld0219 | 2027-04-29 | TRADE TRACE TRACK TRUCK TRUNK DRUNK → TRADE TRACE TRACK CRACK CRANK DRANK (par 5 → 5) | inappropriate |
| ld0228 | 2027-05-08 | GRIME PRIME PRICE P**** BRICK BRINK DRINK → GRIME PRIME PRIDE BRIDE BRINE BRINK DRINK (par 6 → 6) | inappropriate |
| ld0235 | 2027-05-15 | PLATE SLATE SLAVE SHAVE SHALE WHALE WHILE → PLATE SLATE STATE STALE SHALE WHALE WHILE (par 6 → 6) | inappropriate |
| ld0256 | 2027-06-05 | BLANC BLAND BLOND BLOOD BLOOM BROOM → BLANK BLAND BLOND BLOOD BLOOM BROOM (par 5 → 5) | obscure |
| ld0259 | 2027-06-08 | HITCH HUTCH B**** BUNCH BENCH → HITCH HUTCH HUNCH BUNCH BENCH (par 4 → 4) | inappropriate |
| ld0265 | 2027-06-14 | HATCH BATCH B**** BUNCH BENCH → HATCH HUTCH HUNCH BUNCH BENCH (par 4 → 4) | inappropriate |
| ld0266 | 2027-06-15 | LUNCH BUNCH B**** BATCH CATCH → LUNCH HUNCH HUTCH HATCH CATCH (par 4 → 4) | inappropriate |
| ld0273 | 2027-06-22 | P**** BRICK BRINK BRINE BRIBE → TRICK BRICK BRINK BRINE BRIBE (par 4 → 4) | inappropriate |
| ld0281 | 2027-06-30 | HUTCH B**** BUNCH BENCH BEACH → HUTCH HUNCH BUNCH BENCH BEACH (par 4 → 4) | inappropriate |
| ld0282 | 2027-07-01 | WATCH BATCH B**** BUNCH LUNCH → WATCH HATCH HUTCH HUNCH LUNCH (par 4 → 4) | inappropriate |
| ld0287 | 2027-07-06 | WATCH BATCH B**** BUNCH PUNCH → WATCH PATCH PITCH PINCH PUNCH (par 4 → 4) | inappropriate |
| ld0288 | 2027-07-07 | DRUNK TRUNK TRUCK TRACK TRACE → DRANK CRANK CRACK TRACK TRACE (par 4 → 4) | inappropriate |
| ld0350 | 2027-09-07 | PLATE SLATE SLAVE SHAVE SHALE → PLATE SLATE STATE STALE SHALE (par 4 → 4) | inappropriate |
| ld0381 | 2027-10-08 | CRAFT GRAFT GRANT GRAND BRAND BLAND BLANC → CRAFT GRAFT GRANT GRAND BRAND BLAND BLANK (par 6 → 6) | obscure |
| ld0383 | 2027-10-10 | SHELL SHALL SHALE SHAVE SLAVE SLATE PLATE PLACE → SHELL SHALL STALL STALE STATE SLATE PLATE PLACE (par 7 → 7) | inappropriate |
| ld0384 | 2027-10-11 | S**** SHANK SHARK SHARE SHIRE → SMALL SHALL SHALE SHARE SHIRE (par 4 → 4) | inappropriate |
| ld0392 | 2027-10-19 | FRANC FRANK FLANK PLANK PLANT → SWEAR SHEAR SHEER SHEEP SLEEP (par 4 → 4) | content gate |
| ld0414 | Unlimited | WHILE WHALE SHALE SHAVE SLAVE SLATE → WHILE WHALE SHALE STALE STATE SLATE (par 5 → 5) | inappropriate |
| ld0423 | Unlimited | LUNCH BUNCH B**** BATCH PATCH → LUNCH PUNCH PINCH PITCH PATCH (par 4 → 4) | inappropriate |
| ld0428 | Unlimited | PUNCH BUNCH B**** BATCH CATCH → PUNCH PINCH PITCH PATCH CATCH (par 4 → 4) | inappropriate |
| ld0446 | Unlimited | SLAVE SHAVE SHARE SHORE CHORE CHOKE → WHITE WHILE WHOLE WHOSE CHOSE CHOKE (par 5 → 5) | inappropriate |
| ld0464 | Unlimited | DRIED CRIED CREED BREED BLEED BLEND BLAND BLANC → DRIED CRIED CREED BREED BLEED BLEND BLAND BLANK (par 7 → 7) | obscure |
| ld0486 | Unlimited | SHAWL SHALL SHALE SHAVE SLAVE SLATE → SHAWL SHALL STALL STALE STATE SLATE (par 5 → 5) | inappropriate |
| ld0488 | Unlimited | STAVE SLAVE SLATE PLATE PLACE PEACE PEACH PERCH → STAVE STATE SLATE PLATE PLACE PEACE PEACH PERCH (par 7 → 7) | inappropriate |
| ld0491 | Unlimited | STOUT SHOUT SHORT SHORE SHARE SHAVE SLAVE → STOUT SHOUT SHORT SHORE STORE STARE STATE (par 6 → 6) | inappropriate |
| ld0511 | Unlimited | SLATE SLAVE SHAVE SHALE SHALL SHELL SHELF → SLATE STATE STALE SHALE SHALL SHELL SHELF (par 6 → 6) | inappropriate |
| ld0525 | Unlimited | S**** SPARK SPARE SPORE STORE → SHIFT SHIRT SHORT SHORE STORE (par 4 → 4) | inappropriate |
| ld0530 | Unlimited | SHALE SHAVE SLAVE SLATE PLATE PLACE → SHALE STALE STATE SLATE PLATE PLACE (par 5 → 5) | inappropriate |
| ld0543 | Unlimited | PEACE PLACE PLANE PLANK FLANK FRANK FRANC → FRAME FLAME BLAME BLAZE GLAZE GRAZE GRACE (par 6 → 6) | content gate |
| ld0580 | Unlimited | PEACH PEACE PLACE PLATE SLATE SLAVE STAVE STOVE → PEACH PEACE PLACE PLATE SLATE STATE STAVE STOVE (par 7 → 7) | inappropriate |

</details>

### Kindred — 112 puzzle(s) changed (`apps/web/data/groups-puzzles.json`)

<details><summary>All 112 changes</summary>

| Puzzle | Date | Change (masked) | Why |
|---|---|---|---|
| gr-xlul6w | 2026-10-14 | T2 “Twist around”: COIL TWIST CURL SPIRAL → “Twist around”: COIL LOOP CURL SPIRAL | clue |
| gr-bmdfn2 | 2026-10-31 | T1 “Grandmother”: GRANNY NANA GRANDMA GRANDMOTHER → “Grandmother”: GRANNY NANA GRANDMA GRAMMY | clue |
| gr-5ff3e4 | 2026-11-27 | T1 “Seabirds”: PENGUIN ALBATROSS PELICAN GANNET → “Seabirds”: PENGUIN ALBATROSS PELICAN GULL | obscure |
| gr-l2h9fo | 2026-12-08 | T2 “School tests”: TEST EXAM FINAL ORAL → “School tests”: QUIZ EXAM FINAL ORAL | clue |
| gr-fk4bx6 | 2026-12-09 | T3 “Paper ___”: CLIP TRAIL WEIGHT TIGER → “Paper ___”: CLIP TRAIL WEIGHT PLATE | duplicate |
| gr-6mkm5c | 2026-12-16 | T2 “A piece of cake”: CINCH PICNIC WALKOVER PUSHOVER → “A piece of cake”: CINCH PICNIC CAKEWALK PUSHOVER | british |
| gr-hxs0xt | 2026-12-18 | T4 “Sound like numbers”: WON TOO ATE FORE → “Sound like letters”: BEE SEA TEA PEA | duplicate |
| gr-4vjncm | 2026-12-26 | T2 “Spheres”: GLOBE BALL SPHERE MARBLE → “Spheres”: GLOBE BALL BUBBLE MARBLE | clue |
| gr-obddhe | 2026-12-28 | T3 “Happy ___”: ENDING HOUR MEAL CAMPER → “Happy ___”: ENDING HOUR FACE CAMPER | proper-noun |
| gr-7lnyap | 2026-12-29 | T2 “Expert”: WHIZ PRO MAESTRO EXPERT → “Expert”: WHIZ PRO MAESTRO GURU | clue |
| gr-8majzn | 2026-12-31 | T1 “Fishing gear”: ROD REEL LURE TACKLE → “Fishing gear”: ROD REEL LURE NET<br>T2 “Tempt”: ENTICE TEMPT COAX BECKON → “Tempt”: ENTICE INVITE COAX BECKON | duplicate, clue |
| gr-bid5ol | 2027-01-02 | T4 “Hidden TEA”: STEAM INSTEAD PLATEAU STEALTH → “Hidden TEA”: STEAM INSTEAD PLATEAU STEADY | duplicate |
| gr-4bpbfb | 2027-01-03 | T4 “Anagrams of tools”: PANEL LAW DAZE SPAR → “Anagrams of tools”: PANEL LAW SNARED SPAR | obscure |
| gr-svjyhk | 2027-01-14 | T1 “Curves”: ARC CURVE CRESCENT LOOP → “Curves”: ARC SPIRAL CRESCENT LOOP | clue |
| gr-67bfrd | 2027-01-20 | T4 “A currency inside a longer word”: HYENA NEURON COMPOUND CEREAL → “A currency inside a longer word”: HYENA NEURON COMPOUND WONDER | obscure |
| gr-ga4pzr | 2027-01-21 | T2 “Bounce off”: RICOCHET DEFLECT SKIM BOUNCE → “Bounce off”: RICOCHET DEFLECT SKIM REBOUND | clue |
| gr-ah14m8 | 2027-02-06 | T1 “Sailing maneuvers”: TACK JIBE HEEL ANCHOR → “Sailing maneuvers”: TACK JIBE STEER ANCHOR | obscure |
| gr-2sgkaq | 2027-02-07 | T2 “Question”: QUIZ QUESTION INTERROGATE PROBE → “Question”: QUIZ QUERY INTERROGATE PROBE | clue |
| gr-eridf9 | 2027-02-12 | T1 “Shellfish”: OYSTER CLAM SCALLOP COCKLE → “Shellfish”: OYSTER CLAM SCALLOP MUSSEL<br>T2 “Go quiet”: HUSH MUTE QUIET SILENCE → “Go quiet”: HUSH MUTE SHUSH SILENCE | british, clue |
| gr-wa9c01 | 2027-02-16 | T2 “Words for mother”: MOM MOTHER MAMA MATRIARCH → “Words for mother”: MOM MOMMY MAMA MATRIARCH | clue |
| gr-r8tfm6 | 2027-03-10 | T2 “Confront”: MEET BRAVE TACKLE CONFRONT → “Confront”: MEET BRAVE TACKLE DEFY | clue |
| gr-sywf1w | 2027-03-14 | T3 “Hand___”: BAG SHAKE CUFF RAIL → “Hand___”: WRITING SHAKE CUFF RAIL | duplicate |
| gr-q1mqx7 | 2027-03-15 | T1 “Tools”: HAMMER WRENCH CHISEL PLIERS → “Tools”: HAMMER WRENCH CHISEL SAW | duplicate |
| gr-4adwow | 2027-03-23 | T2 “Body shape”: BUILD PHYSIQUE FIGURE SHAPE → “Body shape”: BUILD PHYSIQUE FIGURE FORM | clue |
| gr-h5cs2x | 2027-04-03 | T4 “Hidden currencies”: SCENT BRAND COMPOUND REMARK → “Hidden currencies”: SCENT FRANCHISE COMPOUND NEURON | obscure |
| gr-v3gg66 | 2027-04-06 | T1 “Crow family”: RAVEN CROW ROOK MAGPIE → “Crow family”: RAVEN JAY ROOK MAGPIE<br>T4 “Start with a bird”: GULLIBLE HAWKER TERNARY DOVETAIL → “Start with a bird”: GULLIBLE HAWKER WRENCH DOVETAIL | clue, obscure |
| gr-4td2aj | 2027-04-10 | T2 “Hinder”: HINDER IMPEDE THWART OBSTRUCT → “Hinder”: BLOCK IMPEDE THWART OBSTRUCT | clue |
| gr-vn9qq1 | 2027-04-13 | T2 “Channels in the ground”: MOAT GULLY FURROW CHANNEL → “Channels in the ground”: MOAT GULLY FURROW DITCH | clue |
| gr-ccnfdf | 2027-04-14 | T2 “Friend”: PAL BUDDY CHUM COMRADE → “Friend”: PAL BUDDY CHUM PARTNER | duplicate |
| gr-w4odyh | 2027-04-16 | T2 “Tidy up”: SPRUCE TIDY GROOM STRAIGHTEN → “Tidy up”: SPRUCE CLEAN GROOM STRAIGHTEN | clue |
| gr-yp9b5w | 2027-04-23 | T1 “Grains”: WHEAT BARLEY MILLET SPELT → “Grains”: WHEAT BARLEY MILLET RYE | obscure |
| gr-o5smn1 | 2027-04-25 | T4 “Sound like numbers”: WON TOO FORE ATE → “Hidden ANT”: PANT GIANT PLANT CHANT | duplicate |
| gr-cpmuu2 | 2027-04-28 | T4 “Hidden farm animals”: SCOWL PIGMENT GOATEE KITCHEN → “Hidden farm animals”: SCOWL PIGMENT GOATEE RAMBLE | duplicate |
| gr-aldcdr | 2027-05-06 | T2 “Wager”: BET WAGER GAMBLE RISK → “Wager”: BET VENTURE GAMBLE RISK | clue |
| gr-lnlk4k | 2027-05-09 | T2 “Percussion”: DRUM CYMBAL GONG TAMBOURINE → “Percussion”: DRUM CYMBAL BONGO TAMBOURINE | duplicate |
| gr-6cim8u | 2027-05-11 | T2 “Hint”: HINT PROMPT SIGNAL NUDGE → “Hint”: CLUE PROMPT SIGNAL NUDGE | clue |
| gr-ze534h | 2027-05-16 | T2 “Single”: SOLE LONE SOLO SINGLE → “Single”: SOLE LONE SOLO ONLY | clue |
| gr-c2ql4 | 2027-05-17 | T4 “Sound like seafood”: SOUL LOCKS MUSCLE ROW → “Hidden TART”: TARTAN START STARTLE TARTAR | duplicate |
| gr-xx9wuv | 2027-05-19 | T2 “Nonsense”: BALONEY HOGWASH DRIVEL TWADDLE → “Nonsense”: BALONEY HOGWASH DRIVEL BUNK | british |
| gr-j2kkdf | 2027-05-22 | T2 “Mock”: JEER TAUNT MOCK RIDICULE → “Mock”: JEER TAUNT DERIDE RIDICULE | clue |
| gr-yy3mgy | 2027-05-28 | T3 “___neck”: TURTLE BOTTLE CREW BREAK → “___line”: PUNCH HEAD FINISH CLOTHES | duplicate |
| gr-jq5r9o | 2027-05-30 | T4 “Hidden numbers”: HONEST OFTEN WEIGHT CANINE → “Hidden numbers”: HONEST LISTEN WEIGHT CANINE | duplicate |
| gr-bqcwfr | 2027-05-31 | T2 “Ways of doing things”: METHOD MEANS APPROACH CHANNEL → “Ways of doing things”: METHOD MEANS APPROACH MANNER | duplicate |
| gr-wtbjf3 | 2027-06-01 | T2 “Walk heavily”: TRUDGE PLOD STOMP TRAMP → “Exhausted”: WEARY SPENT DRAINED BUSHED | duplicate |
| gr-qxkndv | 2027-06-06 | T1 “Household staff”: BUTLER MAID FOOTMAN VALET → “Household staff”: BUTLER MAID NANNY VALET | british |
| gr-frg0yr | 2027-06-07 | T1 “Cloud types”: CIRRUS CUMULUS NIMBUS STRATUS → “Cloud types”: CIRRUS CUMULUS THUNDERHEAD STRATUS<br>T4 “Sound like weather words”: REIGN HALE MISSED DUE → “Hidden ICE”: SLICE PRICE NOTICE POLICE | duplicate |
| gr-udp819 | 2027-06-12 | T1 “Magic spells”: SPELL CHARM HEX JINX → “Magic spells”: WHAMMY CHARM HEX JINX | clue |
| gr-hcw96s | 2027-06-16 | T2 “The boss”: CHIEF BOSS DIRECTOR SUPERVISOR → “The boss”: CHIEF HONCHO DIRECTOR SUPERVISOR | clue |
| gr-c4pqdk | 2027-06-17 | T1 “Rooms and spaces”: HALL LOUNGE LANDING PORCH → “Rooms and spaces”: HALL FOYER LANDING PORCH<br>T3 “Town ___”: CRIER SQUARE HOUSE MEETING → “Sun___”: FLOWER BURN GLASSES DIAL | british, duplicate |
| gr-z4282p | 2027-06-22 | T2 “Tear”: RIP TEAR SPLIT GASH → “Tear”: RIP SNAG SPLIT GASH | clue |
| gr-52d0ro | 2027-06-23 | T2 “Jewelry”: BROOCH BANGLE PENDANT LOCKET → “Jewelry”: BROOCH ANKLET PENDANT LOCKET | duplicate |
| gr-hv5g1z | 2027-06-26 | T1 “Parrots”: MACAW COCKATOO PARAKEET PARROT → “Parrots”: MACAW COCKATOO PARAKEET COCKATIEL | clue |
| gr-njdz3h | 2027-06-29 | T2 “Stash”: CACHE STASH STORE BURY → “Stash”: CACHE HOARD STORE BURY | clue |
| gr-piocmx | 2027-07-09 | T2 “Pet”: PAT PET CARESS RUB → “Pet”: PAT CUDDLE CARESS RUB | clue |
| gr-et3hb8 | 2027-07-11 | T2 “Fruit spreads”: JELLY MARMALADE PRESERVE CURD → “Fruit spreads”: JELLY MARMALADE PRESERVE BUTTER | british |
| gr-hzkd13 | 2027-07-21 | T4 “Sound like numbers”: WON TOO FORE ATE → “Hidden RAIN”: TRAIN BRAIN GRAIN STRAIN | duplicate |
| gr-l6jaqj | 2027-07-25 | T1 “Kitchen appliances”: OVEN FREEZER DISHWASHER KETTLE → “Kitchen appliances”: OVEN FREEZER DISHWASHER MICROWAVE | duplicate |
| gr-24jv4v | 2027-07-30 | T1 “Grandfather”: GRANDPA GRAMPS GRANDFATHER POPS → “Grandfather”: GRANDPA GRAMPS GRANDDAD POPS | clue |
| gr-hrt1ec | 2027-08-04 | T2 “Moral failings”: SIN FLAW WEAKNESS FAILING → “Moral failings”: SIN FLAW WEAKNESS FAULT | clue |
| gr-lv0wkj | 2027-08-09 | T2 “Clever”: SHARP CLEVER ASTUTE CANNY → “Clever”: SHARP SMART ASTUTE CANNY | clue |
| gr-txx25e | 2027-08-10 | T4 “Hidden DEN”: GARDEN HIDDEN SUDDEN WOODEN → “Hidden DEN”: GARDEN HIDDEN SUDDEN BURDEN | duplicate |
| gr-nd4ev5 | 2027-08-14 | T1 “Chess pieces”: PAWN ROOK BISHOP KNIGHT → “Chess pieces”: QUEEN ROOK BISHOP KNIGHT | duplicate |
| gr-jaod5y | 2027-08-21 | T3 “___ pie”: HUMBLE MUD POT APPLE → “Sand___”: CASTLE PAPER BOX BAR | duplicate |
| gr-3518nx | 2027-08-24 | T2 “Sets of two”: PAIR BRACE COUPLE DUO → “Sets of two”: PAIR TWOSOME COUPLE DUO | obscure |
| gr-lnujaf | 2027-08-27 | T2 “Eat greedily”: GOBBLE WOLF SCARF DEVOUR → “Eat greedily”: GOBBLE WOLF GULP DEVOUR | duplicate |
| gr-i6u04 | 2027-08-31 | T4 “Sound like body parts”: WASTE HEAL TOW HARE → “Sound like body parts”: WASTE HEAL AYE HARE | duplicate |
| gr-porotm | 2027-09-02 | T2 “Drool”: DROOL SLOBBER DRIP TRICKLE → “Drool”: SALIVATE SLOBBER DRIP TRICKLE | clue |
| gr-lqzg4s | 2027-09-05 | T4 “Anagram of an instrument”: RELY GROAN STAIR ABUT → “Anagram of an instrument”: ALERTING GROAN STAIR ABUT | duplicate |
| gr-m8kf8a | 2027-09-06 | T3 “Party ___”: FAVOR ANIMAL TRICK HAT → “Party ___”: FAVOR ANIMAL TRICK LINE | duplicate |
| gr-yw9d4v | 2027-09-09 | T4 “Reverse for an animal”: FLOW TAB REED TAR → “Reverse for an animal”: MAR TAB REED TAR | duplicate |
| gr-j6sinl | 2027-09-11 | T4 “Sound like units”: WAIT FEAT WEAK TUN → “Sound like units”: WAIT FEAT WEAK HURTS | obscure |
| gr-lnxpuw | 2027-09-17 | T2 “Slow on the uptake”: DENSE SLOW THICK DIM → “Slow on the uptake”: DENSE DOPEY THICK DIM | clue |
| gr-azuyju | 2027-09-21 | T1 “Bugs that bite or sting”: MOSQUITO GNAT HORNET MIDGE → “Bugs that bite or sting”: MOSQUITO GNAT HORNET WASP | british |
| gr-l6j9u0 | 2027-09-25 | T1 “Kitchen utensils”: WHISK LADLE SPATULA TONGS → “Kitchen utensils”: WHISK LADLE SPATULA PEELER<br>T4 “Sound like numbers”: WON TOO ATE FORE → “Hidden BUN”: BUNNY BUNDLE BUNCH BUNKER | duplicate |
| gr-723zmp | 2027-09-30 | T3 “Party ___”: HAT FAVOR ANIMAL TRICK → “Gift ___”: WRAP CARD BAG SHOP | duplicate |
| gr-ya22nb | 2027-10-04 | T2 “Relatives”: NIECE UNCLE COUSIN NEPHEW → “Relatives”: NIECE UNCLE COUSIN STEPSON | duplicate |
| gr-yxacxc | Unlimited | T1 “Potato dishes”: TOTS HASH FRIES CHIPS → “Potato dishes”: TOTS HASH FRIES WEDGES | british |
| gr-7rqwyb | Unlimited | T1 “Fairy folk”: FAIRY ELF PIXIE GNOME → “Fairy folk”: SPRITE ELF PIXIE GNOME | clue |
| gr-2gsrjx | Unlimited | T1 “Places to stay”: HOTEL MOTEL HOSTEL INN → “Luggage”: SUITCASE DUFFEL BACKPACK TRUNK<br>T2 “Watering holes”: PUB BAR TAVERN SALOON → “Watering holes”: DIVE BAR TAVERN SALOON | duplicate |
| gr-qjz5vu | Unlimited | T2 “Neat”: NEAT TRIM TIDY SPRUCE → “Neat”: CLEAN TRIM TIDY SPRUCE<br>T3 “Tree ___”: HOUSE TRUNK FROG LINE → “Head___”: BAND LIGHT PHONES START | clue, duplicate |
| gr-jkqygy | Unlimited | T2 “Levels”: GRADE TIER ECHELON LEVEL → “Levels”: GRADE TIER ECHELON RUNG<br>T3 “___ play”: FAIR HORSE CHILD POWER → “Bad ___”: LUCK NEWS HABIT APPLE | clue, duplicate |
| gr-srcu1m | Unlimited | T1 “Fish on the menu”: COD HADDOCK SOLE HALIBUT → “Fish on the menu”: COD HADDOCK SOLE SALMON<br>T2 “Only”: LONE ONLY SINGLE SOLITARY → “Only”: LONE SOLO SINGLE SOLITARY<br>T4 “Sound like seafood”: ROW LOCKS MUSCLE SOUL → “Hidden EEL”: PEEL FEEL KNEEL STEEL | duplicate, clue |
| gr-blhx74 | Unlimited | T1 “Playground games”: TAG HOPSCOTCH LEAPFROG MARBLES → “Playground games”: TAG HOPSCOTCH LEAPFROG JACKS<br>T2 “Identifiers”: LABEL TICKET BADGE STICKER → “Things you can sign”: CAST CHECK LEASE PETITION | duplicate |
| gr-pjhcpw | Unlimited | T2 “Fasten a garment”: BUTTON ZIP SNAP TOGGLE → “Fasten a garment”: BUTTON ZIP SNAP BUCKLE<br>T4 “Sound like weather”: REIGN MISSED HALE SON → “Sound like weather”: REIGN MISSED HALE WHETHER | obscure, duplicate |
| gr-s0yi97 | Unlimited | T1 “Butterflies”: MONARCH ADMIRAL SKIPPER PEACOCK → “Butterflies”: MONARCH ADMIRAL SKIPPER SWALLOWTAIL | british |
| gr-pu772u | Unlimited | T2 “Settle a debt”: SETTLE CLEAR REPAY EVEN → “Settle a debt”: REIMBURSE CLEAR REPAY EVEN<br>T3 “___ dance”: LINE TAP RAIN POLE → “___ dance”: LINE TAP RAIN FOLK | inappropriate, clue |
| gr-agqgrx | Unlimited | T1 “Fireworks”: ROCKET SPARKLER FOUNTAIN FIRECRACKER → “At a parade”: FLOAT BAND BATON BANNER<br>T4 “Sound like numbers”: WON TOO ATE FORE → “Hidden STAR”: START STARCH MUSTARD STARFISH | duplicate |
| gr-cd53an | Unlimited | T2 “Fellows”: LAD DUDE GUY GENT → “Fellows”: LAD DUDE GUY FELLA<br>T4 “Sound like weather”: REIGN HALE DUE MISSED → “Hidden ROW”: GROWL ARROW THROW BROWSE | duplicate, british |
| gr-j297vc | Unlimited | T2 “Stuffed after a meal”: SATED REPLETE GORGED STUFFED → “Stuffed after a meal”: SATED REPLETE GORGED BLOATED | clue |
| gr-c7qhj9 | Unlimited | T4 “Hidden numbers”: OFTEN STONE WEIGHT CANINE → “Hidden numbers”: OFTEN STONE WEIGHT NETWORK | duplicate |
| gr-3yc1e2 | Unlimited | T3 “___ story”: COVER SHORT TALL GHOST → “Pen ___”: PAL NAME KNIFE LIGHT | duplicate |
| gr-8lubi | Unlimited | T3 “Honey___”: MOON COMB BEE DEW → “Love ___”: SEAT BIRD LETTER SONG | duplicate |
| gr-fl2lln | Unlimited | T1 “Shade”: SHADE SHADOW UMBRA GLOOM → “Shade”: DARKNESS SHADOW UMBRA GLOOM<br>T2 “A hint of”: HINT TINGE TOUCH TRACE → “A hint of”: DASH TINGE TOUCH TRACE | clue |
| gr-6xpbhb | Unlimited | T4 “Homophones of animals”: DEAR MOUSSE KNEW LINKS → “Homophones of animals”: DEAR MOUSSE HEIR LINKS | duplicate |
| gr-y9ll6h | Unlimited | T2 “Sleep”: DOZE NAP SNOOZE SLUMBER → “Sleep”: DOZE NAP SIESTA SLUMBER | duplicate |
| gr-hocssx | Unlimited | T2 “Bounce”: REBOUND RICOCHET BOUNCE SPRING → “Bounce”: REBOUND RICOCHET BOUND SPRING | clue |
| gr-9dfymt | Unlimited | T2 “Shake”: TREMBLE SHIVER SHUDDER SHAKE → “Shake”: TREMBLE SHIVER SHUDDER QUAKE | clue |
| gr-gj57if | Unlimited | T4 “Sound like clothing”: GENES HOES SOOT SHOO → “Sound like clothing”: GENES CLOSE SOOT SHOO | inappropriate |
| gr-osne0a | Unlimited | T4 “Sound like fabrics”: SWAYED TOOL SURGE GENE → “Sound like fabrics”: SWAYED TOOL CHORD GENE | obscure |
| gr-novecn | Unlimited | T3 “___stick”: YARD DRUM JOY LIP → “Tooth___”: BRUSH PASTE PICK ACHE | duplicate |
| gr-vp1ylk | Unlimited | T1 “Kinds of duck”: MALLARD TEAL EIDER GOLDENEYE → “Kinds of duck”: MALLARD TEAL EIDER WOOD | obscure |
| gr-gjf19f | Unlimited | T4 “Anagrams of STAR”: STAR RATS ARTS TSAR → “Anagrams of STAR”: TARS RATS ARTS TSAR | clue |
| gr-brsuvy | 2026-12-25 (christmas) | T4 “Words meaning 'present'”: GIFT NOW HERE CURRENT → “Words meaning 'present'”: EXISTING NOW HERE CURRENT | clue |
| gr-6d3yh6 | 2027-05-05 (cincodemayo) | T1 “Cinco de Mayo fiesta”: FIESTA SOMBRERO MARACAS GUITAR → “Cinco de Mayo fiesta”: PINATA SOMBRERO MARACAS GUITAR | clue |
| gr-xp7i6m | 2027-10-29 (diwali) | T2 “Diwali sights”: FIREWORKS MARIGOLD LOTUS SWEETS → “Diwali sights”: FIREWORKS MARIGOLD LOTUS SPARKLERS | british |
| gr-e8r4sp | 2028-02-02 (groundhog) | T4 “A quick look”: GLANCE PEEP GANDER SQUINT → “A quick look”: GLANCE PEEP GANDER PEEK | british |
| gr-ghhdx6 | 2026-10-31 (halloween) | T3 “Carving a pumpkin”: CARVE SCOOP GRIN GLOW → “Carving a pumpkin”: HOLLOW SCOOP GRIN GLOW | clue |
| gr-73fg0q | 2028-07-04 (july4) | T3 “Rocket ___”: SHIP FUEL SCIENCE BOOSTER → “Fire___”: WORKS FLY PLACE HOUSE | duplicate |
| gr-d1ehfe | 2028-02-29 (leapday) | T1 “Rare as February 29”: RARE SELDOM SCARCE UNCOMMON → “Rare as February 29”: UNUSUAL SELDOM SCARCE UNCOMMON | clue |
| gr-snvm4m | leapday | T3 “One more”: BONUS SPARE EXTRA SURPLUS → “___ cake”: CARROT POUND SPONGE LAYER | duplicate |
| gr-codbuj | 2030-03-05 (mardigras) | T3 “Fat ___”: CAT CHANCE LIP FARM → “Fat ___”: CAT CHANCE LIP FREE | inappropriate |
| gr-vrn3t1 | 2026-11-11 (veterans) | T1 “Armistice Day”: ARMISTICE TRUCE PEACE POPPY → “Armistice Day”: CEASEFIRE TRUCE PEACE POPPY | clue |

</details>

### Spyglass — 55 puzzle(s) changed (`apps/web/data/wordsearch-puzzles.json`)

<details><summary>All 55 changes</summary>

| Puzzle | Date | Change (masked) | Why |
|---|---|---|---|
| ws0046 | 2026-11-07 | STETSON → BEANIE (grid re-laid) | proper-noun |
| ws0051 | 2026-11-12 | CALVES → COLT (grid re-laid) | duplicate |
| ws0059 | 2026-11-20 | PORTCULLIS → GATEHOUSE (grid re-laid); title “Castle Keep” → “At the Castle” | clue, obscure |
| ws0095 | 2026-12-26 | EPAULET → HARDHAT (grid re-laid) | obscure |
| ws0097 | 2026-12-28 | STARTER → SNORKEL (grid re-laid) | off-theme |
| ws0099 | 2026-12-30 | JEEP → GUIDE (grid re-laid) | proper-noun |
| ws0117 | 2027-01-17 | ZAMBONI FIGURE SPEED → SLEDDING TORCH SNOW (grid re-laid) | proper-noun, off-theme |
| ws0130 | 2027-01-30 | OVERDUB → PLAYBACK (grid re-laid) | obscure |
| ws0143 | 2027-02-12 | STANDING → TOKEN (grid re-laid) | off-theme |
| ws0150 | 2027-02-19 | PELOTON → SPOKE (grid re-laid) | proper-noun |
| ws0151 | 2027-02-20 | FINGERING → KEYS (grid re-laid) | inappropriate |
| ws0158 | 2027-02-27 | AFGHAN → MITTEN (grid re-laid) | proper-noun |
| ws0163 | 2027-03-04 | PERIODIC → COMPOUND (grid re-laid) | off-theme |
| ws0164 | 2027-03-05 | CARREL → CHAPTER (grid re-laid) | obscure |
| ws0183 | 2027-03-24 | SERVICE WAKEUP → LUGGAGE LOUNGE (grid re-laid) | off-theme, obscure |
| ws0185 | 2027-03-26 | MUFF → FLEECE (grid re-laid) | inappropriate |
| ws0198 | 2027-04-08 | WOOLENS → FLURRY (grid re-laid) | obscure |
| ws0218 | 2027-04-28 | PETRI → FORMULA (grid re-laid) | obscure |
| ws0226 | 2027-05-06 | STETSON → BONNET (grid re-laid) | proper-noun |
| ws0231 | 2027-05-11 | CALVES → COLT (grid re-laid) | duplicate |
| ws0239 | 2027-05-19 | PORTCULLIS KEEP → TURRET TOWER (grid re-laid); title “Castle Keep” → “At the Castle” | clue, obscure |
| ws0265 | 2027-06-14 | DAMSELFLY → SALAMANDER (grid re-laid) | obscure |
| ws0273 | 2027-06-22 | STARTER → SNORKEL (grid re-laid) | off-theme |
| ws0276 | 2027-06-25 | WARD → CAST (grid re-laid) | british |
| ws0280 | 2027-06-29 | VOWEL → WARMUP (grid re-laid) | off-theme |
| ws0297 | 2027-07-16 | FIGURE SPEED → HOCKEY TORCH (grid re-laid) | off-theme |
| ws0308 | 2027-07-27 | GALOSH → HIGHTOP (grid re-laid) | obscure |
| ws0310 | 2027-07-29 | OVERDUB → REVERB (grid re-laid) | obscure |
| ws0328 | 2027-08-16 | FINGERING ETUDE → SCALE KEYS (grid re-laid) | obscure, inappropriate |
| ws0335 | 2027-08-23 | SEEDER → FURROW (grid re-laid) | obscure |
| ws0336 | 2027-08-24 | GAUGE → TANGLE (grid re-laid) | off-theme |
| ws0340 | 2027-08-28 | CARREL → ATLAS (grid re-laid) | obscure |
| ws0346 | 2027-09-03 | WATERING → HEDGE (grid re-laid) | obscure |
| ws0360 | 2027-09-17 | SERVICE → ELEVATOR (grid re-laid) | off-theme |
| ws0361 | 2027-09-18 |  | content gate |
| ws0363 | 2027-09-20 | VENUS → ASTEROID (grid re-laid) | proper-noun |
| ws0382 | 2027-10-09 | THORAX → CHRYSALIS (grid re-laid) | obscure |
| ws0415 | Unlimited | JEEP → ANTELOPE (grid re-laid) | proper-noun |
| ws0422 | Unlimited |  | content gate |
| ws0438 | Unlimited | CARREL → PERIODICAL (grid re-laid) | obscure |
| ws0447 | Unlimited | VELCRO → PENCIL (grid re-laid) | proper-noun |
| ws0458 | Unlimited | WAKEUP → SLIPPERS (grid re-laid) | obscure |
| ws0460 | Unlimited | STARTER → LANE (grid re-laid) | off-theme |
| ws0461 | Unlimited | VOWEL → MELODY (grid re-laid) | off-theme |
| ws0474 | Unlimited | STETSON → HELMET (grid re-laid) | proper-noun |
| ws0487 | Unlimited | VOWEL → HYMN (grid re-laid) | off-theme |
| ws0493 | Unlimited | PENGUIN → SNOWYOWL (grid re-laid) | off-theme |
| ws0495 | Unlimited | BISQUE → FIRING (grid re-laid) | obscure |
| ws0512 | Unlimited | FIGURE → STICK (grid re-laid) | off-theme |
| ws0519 | Unlimited | CALVES DUCKY → EAGLET FILLY (grid re-laid) | duplicate |
| ws0526 | Unlimited | EPAULET → SCRUBS (grid re-laid) | obscure |
| ws0529 | Unlimited | KEEP → DUNGEON (grid re-laid); title “Castle Keep” → “At the Castle” | clue, obscure |
| ws0537 | Unlimited | STARTER → FLIPPERS (grid re-laid) | off-theme |
| ws0541 | Unlimited | REAGENT → BEAKER (grid re-laid) | obscure |
| ws0544 | Unlimited | THORAX → ANTENNA (grid re-laid) | obscure |

</details>

### Codebreaker — 51 puzzle(s) changed (`apps/web/data/cryptogram-puzzles.json`)

<details><summary>All 51 changes</summary>

| Puzzle | Date | Saying (masked) | Why |
|---|---|---|---|
| cg-bm83g | 2026-10-15 | “Home is home, be it ever so homely.” → “Truth is stranger than fiction.” | obscure |
| cg-spl4xt | 2026-10-28 | “There's no smoke without fire.” → “Where there is smoke, there is fire.” | duplicate |
| cg-ejj9u0 | 2026-11-07 | “In for a penny, in for a pound.” → “Time flies when you are having fun.” | british |
| cg-axt6y7 | 2026-11-17 | “Too much pudding will choke a dog.” → “Variety is the very spice of life.” | obscure |
| cg-ogbqe4 | 2026-11-24 | “Mackerel sky, mackerel sky, never long wet and never long dry.” → “If you can't stand the heat, get out of the kitchen.” | british |
| cg-vwdvpo | 2026-11-27 | “After dinner rest a while, after supper walk a mile.” → “Breakfast is the most important meal of the day.” | obscure |
| cg-2fdz20 | 2026-11-28 | “The least said, the soonest mended.” → “To err is human, to forgive divine.” | british |
| cg-sx17eg | 2026-12-11 | “Fresh air impoverishes the doctor.” → “Laughter is the shortest distance between two people.” | obscure |
| cg-tmrtky | 2026-12-12 | “The more haste, the less speed.” → “The grass is always greener on the other side.” | british |
| cg-xt2d2z | 2026-12-20 | “The wider we roam, the welcomer home.” → “Wherever you go, there you are.” | obscure |
| cg-xb4iwf | 2026-12-26 | “Constant dropping wears away the stone.” → “Constant dripping wears away the stone.” | clue |
| cg-ms7jmk | 2026-12-28 | “The cat would eat fish but would not wet her feet.” → “If it sounds too good to be true, it probably is.” | obscure |
| cg-sdrx68 | 2026-12-29 | “Handsome is that handsome does.” → “Where there is a will, there is a way.” | clue |
| cg-lpzc1a | 2027-01-04 | “It's a long lane that has no turning.” → “What doesn't kill you makes you stronger.” | duplicate |
| cg-mkyw28 | 2027-01-08 | “Even a cat may look at a king.” → “Even a blind squirrel finds a nut.” | british |
| cg-hcxmaj | 2027-01-09 | “An Englishman's home is his castle.” → “The road to success is always under construction.” | british |
| cg-ee4wgv | 2027-01-21 | “You can't see the wood for the trees.” → “You can't see the forest for the trees.” | british |
| cg-kuqhdy | 2027-02-02 | “A creaking door hangs longest.” → “Two's company, three's a crowd.” | obscure |
| cg-abao6o | 2027-02-14 | “Prevention is better than cure.” → “Better late than never, but never late is better.” | duplicate |
| cg-ocy2sm | 2027-02-22 | “A deaf husband and a blind wife are always a happy couple.” → “Life is what happens while you're busy making other plans.” | inappropriate |
| cg-2net32 | 2027-02-27 | “Cut your coat according to your cloth.” → “Close only counts in horseshoes.” | british |
| cg-kv2yh7 | 2027-03-06 | “If you want to live and thrive, let the spider run alive.” → “Do what you love and you'll never work a day in your life.” | british |
| cg-dabmqg | 2027-03-10 | “Take care of the pennies and the pounds will take care of themselves.” → “Those who cannot remember the past are condemned to repeat it.” | british |
| cg-70fd9a | 2027-03-26 | “There is no smoke without fire.” → “A journey of a thousand miles begins with one step.” | duplicate |
| cg-gaew8v | 2027-04-06 | “Patience is a plaster for all sores.” → “It ain't over until it's over.” | british |
| cg-axysr8 | 2027-04-16 | “Grasp the nettle, and it will not sting.” → “A house divided against itself cannot stand.” | british |
| cg-o473ws | 2027-04-30 | “Rain at seven, fine at eleven.” → “Knowledge is power, but enthusiasm pulls the switch.” | british |
| cg-xa7rkp | 2027-05-02 | “Don't wash your dirty linen in public.” → “Don't air your dirty laundry in public.” | british |
| cg-ivte2y | 2027-05-25 | “You can't make an omelette without breaking eggs.” → “You can't make an omelet without breaking eggs.” | british |
| cg-kr3cug | 2027-06-28 | “You have to take the rough with the smooth.” → “You have to take the good with the bad.” | british |
| cg-jhc31p | 2027-06-29 | “A problem shared is a problem halved.” → “A rising tide lifts all boats.” | british |
| cg-ougy0w | 2027-07-02 | “Fine words butter no parsnips.” → “Put your money where your mouth is.” | british |
| cg-q0ujgs | 2027-07-10 | “Everything has an end, and a sausage has two.” → “If it's not one thing, it's another.” | obscure |
| cg-7w19w5 | 2027-07-13 | “When one door shuts, another opens.” → “If you build it, they will come.” | duplicate |
| cg-bweo8q | 2027-07-15 | “Red sky at night, shepherd's delight; red sky in the morning, shepherd's warning.” → “Red sky at night, sailor's delight; red sky in the morning, sailors take warning.” | british |
| cg-goievw | 2027-07-19 | “Empty vessels make the most noise.” → “Speak softly and carry a big stick.” | british |
| cg-jgq6zw | 2027-07-20 | “A dry March and a wet May fill barns and bays with corn and hay.” → “The more things change, the more they stay the same.” | british |
| cg-f1bih6 | 2027-07-22 | “Don't get too big for your boots.” → “Don't get too big for your britches.” | british |
| cg-f2r7jg | 2027-08-02 | “There's no use crying over spilt milk.” → “There's no use crying over spilled milk.” | british |
| cg-yxoocs | 2027-08-12 | “A clear conscience is a soft pillow.” → “Ask me no questions and I'll tell you no lies.” | duplicate |
| cg-6kb5dz | 2027-08-13 | “It's no use locking the stable door after the horse has bolted.” → “It's too late to close the barn door after the horse is gone.” | british |
| cg-57bcsm | 2027-08-17 | “It's a long road that has no turning.” → “Look on the bright side of life.” | duplicate |
| cg-hwk6e9 | 2027-08-22 | “Every family has a skeleton in the cupboard.” → “Every family has a skeleton in the closet.” | british |
| cg-rvnfi9 | Unlimited | “Men make houses, women make homes.” → “Don't sweat the small stuff, and it's all small stuff.” | inappropriate |
| cg-ovjxry | Unlimited | “Ne'er cast a clout till May be out.” → “Life is like a box of chocolates.” | british |
| cg-4nhqgx | Unlimited | “You can't run with the hare and hunt with the hounds.” → “Imitation is the sincerest form of flattery.” | british |
| cg-r17owx | Unlimited | “A hedge between keeps friendship green.” → “Laugh and the world laughs with you.” | obscure |
| cg-obip9r | Unlimited | “It takes all sorts to make a world.” → “Different strokes for different folks.” | british |
| cg-95hxpd | 2027-02-02 (groundhog) | “If Candlemas be fair and bright, winter will have another flight.” → “To everything there is a season, and a time to every purpose under heaven.” | obscure |
| cg-pcja9j | 2028-02-02 (groundhog) | “If Candlemas brings clouds and rain, winter will not come again.” → “Winter is on my head, but eternal spring is in my heart.” | obscure |
| cg-yg1sma | leapday | “Leap year was never a good sheep year.” → “Yesterday is history, tomorrow is a mystery.” | obscure |

</details>

### ProperNoundle — 25 entr(ies) changed (never-served only)

| Entry | Where | Answer | Why |
|---|---|---|---|
| cur113 | rotation | Letitia Wright → Viola Davis | obscure |
| cur114 | rotation | Lupita Nyongo → Lupita Nyong'o | clue |
| geo081 | rotation | Perplexity → Alexa | obscure |
| geo082 | rotation | Midjourney → Zoom | obscure |
| geo083 | rotation | Notion → Etsy | obscure |
| geo084 | rotation | Figma → Labubu | obscure |
| geo098 | rotation | Stripe → PayPal | obscure |
| hol-mlkday-1 | mlkday | Rosa Parks → Lincoln Memorial | duplicate |
| hol-presidents-1 | presidents | Abraham Lincoln → White House | duplicate |
| hol-leapday-1 | leapday | Julius Caesar → Julian Calendar | duplicate |
| hol-leapday-2 | leapday | Leap Year → Kermit the Frog | obscure |
| hol-mardigras-2 | mardigras | Bourbon Street → Louis Armstrong | inappropriate |
| hol-aprilfools-1 | aprilfools | Sidd Finch → Globetrotters | obscure |
| hol-aprilfools-2 | aprilfools | Taco Liberty Bell → Jimmy Kimmel | obscure |
| hol-earthday-1 | earthday | Rachel Carson → Bill Nye | duplicate |
| hol-cincodemayo-2 | cincodemayo | Benito Juárez → Frida Kahlo | obscure |
| hol-mothersday-1 | mothersday | Anna Jarvis → Mother Goose | obscure |
| hol-juneteenth-2 | juneteenth | Harriet Tubman → Sojourner Truth | duplicate |
| hol-july4-2 | july4 | Thomas Jefferson → Uncle Sam | duplicate |
| hol-labor-2 | labor | Mother Jones → Cesar Chavez | obscure |
| hol-indigenous-2 | indigenous | Sitting Bull → Geronimo | duplicate |
| hol-veterans-1 | veterans | Flanders Fields → Purple Heart | british |
| hol-kwanzaa-1 | kwanzaa | Kinara → Africa | obscure |
| hol-lunarnewyear-2 | lunarnewyear | Dragon dance → Chinatown | off-theme |
| hol-diwali-2 | diwali | Rangoli → India | obscure |

### Spyglass theme pools (generator source) — 34 theme(s)

| Theme | Title | Words out → in (masked) |
|---|---|---|
| garden | In the Garden | WATERING → HOSE |
| nightsky | Night Sky | VENUS → ASTEROID |
| pond | Pond Life | DAMSELFLY → SALAMANDER |
| camping | Camping Trip | BAG → MATCHES |
| hotel | Hotel Stay | WAKEUP SERVICE → VACANCY DOORMAN |
| swimming | Swimming Pool | STARTER → SNORKEL |
| cycling | Bike Ride | PELOTON → BIKEPATH |
| wintersports | Winter Games | ZAMBONI SPEED FIGURE → SKIJUMP SKIER TORCH |
| choir | Choir Practice | VOWEL → SINGER |
| jazz | Jazz Club | DIMLIGHT → NIGHTCLUB |
| studio | Recording Studio | OVERDUB FADER → RECORD LYRICS |
| pianolesson | Piano Lesson | ETUDE FINGERING → MELODY PIANIST |
| hospital | At the Hospital | WARD → EMERGENCY |
| farm | On the Farm | SEEDER → FARMER |
| library | Library | CARREL → COMPUTER |
| laboratory | Laboratory | PETRI REAGENT → SCIENTIST CHEMICAL |
| winterday | Winter Day | WOOLENS → SWEATER |
| safari | On Safari | JEEP → CAMERA |
| insects | Bug Hunt | THORAX → MOSQUITO |
| arctic | Arctic Animals | PENGUIN → WOLVERINE |
| babyanimals | Baby Animals | CALVES DUCKY → COLT FILLY |
| knitting | Knitting Circle | GAUGE AFGHAN → SOCKS CARDIGAN |
| pottery | Pottery Studio | BISQUE → ARTIST |
| chemistry | Chemistry Lab | TITRATION PERIODIC → GOGGLES PROTON |
| dinosaurs | Dinosaur Dig | JURASSIC → FOOTPRINT |
| inventions | Great Inventions | VELCRO → COMPUTER |
| microscope | Under the Microscope | OBJECTIVE PETRI → GERMS VIRUS |
| shoes | Shoe Rack | GALOSH → SHOEBOX |
| winterwear | Winter Wear | MUFF → SNOWPANTS |
| hats | Hat Stand | STETSON PANAMA → COWBOYHAT BUCKETHAT |
| uniforms | Uniforms | EPAULET → HARDHAT |
| bicycles | Bicycles | BMX → BIKERACK |
| transit | Public Transit | STANDING → RIDER |
| castle | At the Castle | PORTCULLIS KEEP → PRINCESS KING |

### Holiday answer table (not wired yet) — 4 change(s)

| Holiday | Length | Out → in |
|---|---|---|
| leapday | 6 | YEARLY JUMPER → RARITY HOPPER |
| stpatricks | 5 | PINTS STOUT BREWS → PIPES REELS SAINT |
| stpatricks | 6 | BREWER → LEGEND |
| diwali | 6 | SWEETS → SPARKS |


### Deferred: four crossword grids that need a full rebuild

Each grid repeats a stem that no same-length fill can fix without breaking a crossing (or that only an off-theme
word can fix). They are recorded in `content-safety/data/allow.json` with their reason:

| Puzzle | Repeat |
|---|---|
| cw-3es5ch | CLOTH / CLOTHING |
| cw-8tmtmg | HEART / HEARTBEAT |
| cw-78zs14 | PRINCE / PRINCESS |
| cw-pzf6mr | HEAVEN / HEAVENLY |

## 05b — everyday words are always accepted

- **Source list.** `packages/core/src/content-safety/data/must-accept.json` holds 1,036 words:
  - a curated everyday American vocabulary: family (AUNT, AUNTY, AUNTIE, NIECE, NEPHEW, GRANDMA…), body, food, animals, home, clothing, school, sports, weather, colors, numbers, common verbs and adjectives;
  - plus their regular inflections that wordfreq rates common (Zipf ≥ 3.0).
  - Surnames that look like inflections (JAMES, HARDING…), offensive words and British-only words are excluded.
  - Built by `scripts/build-content-safety-data.py`.
- **Guard G8.** Every must-accept word must be accepted wherever it fits:
  - the 5/6/7-letter accept lists;
  - the Letter Ladder list;
  - every unseen Hubbub puzzle whose seven letters allow it (1,616 fits checked).
  - It fails the build otherwise.
- **Words added:**
  - The guess lists already held every must-accept word, so nothing was added and nothing removed.
  - Letter Ladder's list gained AUNTY plus the batch-4 replacement answers.
  - Hubbub gained FEET in 15 puzzles. Everything else already fit.
  - AUNTIE is accepted in both unseen puzzles whose letters allow it.
  - No Hubbub puzzle has letters for AUNTY.
- **Obscure bonus words removed.** In unseen Hubbub puzzles, a bonus word is no longer accepted when it is:
  - offensive;
  - so rare wordfreq has no Zipf ≥ 2.0 for it (TAUN, RUTTY, ADCRAFT, AIRT, CEORL…);
  - or on the curated obscure list with Zipf < 3 (NITTY).
  - 55,099 such words went; the average bonus list fell from 141 to 41 words.
  - `hub/widen-acceptance.mjs` now applies the same rule and touches only unseen puzzles.
  - British forms stay accepted as bonus words.
- **"Already found" vs "Not a word we know."**
  - The shared reducer already returns `found` for any word found earlier (scored, bonus or revealed, in any case).
  - Web (`hub-game.tsx`), iOS (`HubView.swift`) and Android (`HubScreen.kt`) map it to "Already found".
  - New tests on all three platforms pin that a re-entered word is `found`, never `notword`: `hub.test.ts`, `HubWordCountTests.swift`, `HubWordCountTest.kt`.

## 05c — the automatic content gate

- **Module:** `packages/core/src/content-safety/`.
  - `safety.mjs` with `.d.mts` types: `isOffensive` (exact words, hard roots inside words, leet spellings, phrases in clues), `isBritishOnly`, `isObscure` (curated list or Zipf < 2.5), `mustAccept`, `zipf`, `mask`, `leaks`, `wordProblems`, `textProblems`.
  - Data files in `data/`. The offensive list is base64.
  - Plain ESM with types, so the TypeScript tests and the `.mjs` generators share one copy.
  - Swift and Kotlin need no runtime port: the apps only read the banks the gate has already checked.
  - `safety.test.ts` covers roots, leet, look-alikes, masking, British, obscure, must-accept and the generators' gate.
- **Registry:** `registry.json`. Each entry records the games it serves, kind, schema, web path, every iOS/Android/fixture copy, and `lengths`.

| Registered file | Games | Kind | Copies |
|---|---|---|---|
| `apps/web/data/solutions.json` | Classic, QuadWord, OctoWord, Succession, Deliverance, Gauntlet, VS, bots, Word of the Day | answers | 4 |
| `apps/web/data/solutions-6.json` | Six, VS | answers | 4 |
| `apps/web/data/solutions-7.json` | Seven, VS | answers | 4 |
| `apps/web/data/solutions-legacy.json` | Classic (dailies before 2026-07-08) | answers-frozen | 4 |
| `apps/web/data/solutions-6-legacy.json` | Six (before 2026-07-08) | answers-frozen | 4 |
| `apps/web/data/solutions-7-legacy.json` | Seven (before 2026-07-08) | answers-frozen | 4 |
| `apps/web/data/allowed.json` | Classic family, VS, Letter Ladder hints | accept | 4 |
| `apps/web/data/allowed-6.json` | Six, VS | accept | 4 |
| `apps/web/data/allowed-7.json` | Seven, VS | accept | 4 |
| `apps/web/data/crossword-puzzles.json` | Crosswordocious | clues | 3 |
| `apps/web/data/cryptogram-puzzles.json` | Codebreaker | clues | 3 |
| `apps/web/data/groups-puzzles.json` | Kindred | answers | 3 |
| `apps/web/data/hub-puzzles.json` | Hubbub | required-words | 3 |
| `apps/web/data/ladder-puzzles.json` | Letter Ladder | answers | 3 |
| `apps/web/data/ladder-words.json` | Letter Ladder | accept | 3 |
| `apps/web/data/scramble-puzzles.json` | Muddle | scramble | 3 |
| `apps/web/data/wordsearch-puzzles.json` | Spyglass | answers | 3 |
| `apps/web/data/propernoundle-puzzles.json` | ProperNoundle | answers | 2 |
| `apps/web/data/propernoundle-holidays.json` | ProperNoundle | answers | 2 |
| `apps/web/data/holiday-days.json` | every bank | calendar | 3 |
| `apps/web/data/word-definitions.json` | Word of the Day, word archive | definitions | 2 |
| `apps/web/data/wordsearch-themes.json` | Spyglass (build source) | answers | 0 |
| `apps/web/scripts/holidays/holiday-answers.json` | Classic family holidays (not wired yet) | answers | 0 |
| `apps/web/scripts/holidays/holiday-wotd.json` | Word of the Day holidays (not wired yet) | definitions | 0 |

  Also registered:
  - the scan folders (`apps/web/data`, `apps/web/scripts/*`, iOS Resources and Fixtures, Android data, fixtures and assets);
  - 35 generator source files;
  - `notContent` (JSON files holding no words, each with a reason).
  - Any unregistered bank-like JSON fails G9.
- **Guards (`apps/web/scripts/content-check.test.ts`):**

| Guard | Rule | Result now |
|---|---|---|
| G1 | nothing offensive in answers, required words, rungs, accepted words, accept lists or any text | 0 |
| G2 | nothing British-only in answers, required words, rungs, the ladder list or text | 0 |
| G3 | Kindred: no group repeated | 0 |
| G4 | Codebreaker: no saying twice | 0 |
| G5 | Crosswordocious: no stem twice in a grid | 0 (+4 allowed, rebuild pending) |
| G6 | ProperNoundle: holidays don't repeat the rotation | 0 |
| G7 | no curated-obscure answer, required word, rung, Kindred or Spyglass word | 0 (+8 allowed); 840 words rarer than Zipf 2.5 reported as a warning |
| G8 | must-accept words accepted wherever they fit | 0 missing |
| G9 | registry complete; iOS/Android copies byte-identical | 24 files, 69 copies, 0 drift |
| G10 | served entries unchanged | 728 entries, 0 changed |
| G11 | no offensive word in plain text in the tooling's own files | 42 files/sections, 0 leaks |
| G12 | registry length rules | 121,434 words, 0 out of range |

  `content:check` also runs `content-american.test.ts`, `spelling-copy.test.ts` and `word-list-sync.test.ts`.
  G1, G2 and G7 are implemented once, in `gate.mjs` (`itemProblems`), and shared with the generators.
  Reasoned exceptions live in `data/allow.json`.
- **One command:** `npm run content:check`, from the root or `apps/web`.
  - It first fails if any platform copy differs from web, then runs the four suites and prints the report.
  - **Timing:** about 3.6 s wall time here (the gate alone, about 1.3 s).
  - `npm run content:sync` copies web → iOS/Android/fixtures and regenerates `lib/banks-manifest.json`.
- **CI:** `.github/workflows/ci.yml` gains a "Content gate" step (`pnpm -C apps/web run content:check`) before the web unit tests. The full web vitest run includes the gate too.
- **Generators gated at creation:**
  - `more-games/lib.mjs`: `neverAnswer().has(w)` now also asks the module, which covers the answer and list filters of the Spyglass, Letter Ladder and Muddle builders and both holiday validators.
  - `gateBank(bankId, bank)` runs right before writing in the build-bank and repair-future scripts of Spyglass, Letter Ladder and Hubbub, in the Codebreaker, Crosswordocious, Kindred and Muddle build-bank scripts, and in `hub/widen-acceptance.mjs`.
  - Codebreaker sayings (`make-and-validate.mjs`) go through `textProblems`.
  - Crossword fill (`build-grids.mjs`) goes through `wordProblems`, offensive and British only.
  - Muddle scrambles are checked with `readsOffensive`.
  - Holiday validators report `content-safety:` reasons.
  - The content-fix scripts and `build-ladder-words.mjs` use the module directly.
  - `widen-acceptance.mjs` had its own plain-text list of offensive roots; that list is gone.
- **Docs:** `docs/CONTENT-SAFETY.md` covers the new-game checklist (register → extractor → generator → `content:sync` → `content:check`), how to add words to the allow and block lists, swap batches and cutovers, and the wordfreq credit (CC BY-SA 4.0).

## Tests

| Suite | Result |
|---|---|
| `packages/core` tsc | clean |
| `packages/core` vitest | 33 files, 400 tests passed |
| `apps/web` tsc | clean |
| `apps/web` vitest | 150 files, 1,607 tests passed (includes the content gate) |
| `npm run content:check` | 4 files, 48 tests passed, ~3.6 s |
| `apps/web` test:scoring, `apps/server` typecheck | passed |
| Android core (Kotlin, JVM-only Gradle project over `apps/android/core`; the Android Gradle plugin can't be downloaded here) | 159 tests, 0 failures (`SolutionSwapTest`, `HubWordCountTest`, `BankFixtureTest`…) |
| iOS (Swift) | **not run.** There's no Xcode/Swift toolchain in this Linux container. `SolutionSwapTests.swift` and `HubWordCountTests.swift` mirror the TS and Kotlin tests line for line (same table size, same pinned deals). |

## Known and left as is

- **Four crossword grids** need a full rebuild (above).
- **The 14 `PENDING_FOUNDER_CALL` answers** stay pending.
- **Pre-existing plain text.** The batch-2 swap table and its tests (`solution-swaps.ts`, `SolutionSwaps.swift`, `SolutionSwaps.kt` and their tests), plus a few older lists (`scripts/data/*blocklist*`, older generators), still hold offensive words in plain text. They predate this work and were left unchanged. The one line I edited there (a pinned deal) now decodes its word from base64. Encoding batch 2 the way batch 4 is encoded would be a small follow-up.
- **Rare-word warning.** G7 reports 840 shown or required words rarer than Zipf 2.5 as a warning, not a failure. Rare but fair words exist (e.g. crossword fill, theme words).
