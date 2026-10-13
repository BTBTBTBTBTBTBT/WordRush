# Hubbub family-gap audit (live puzzles)

Report only. No puzzle bank, test or app file was edited. Machine-readable copy: `docs/audits/puzzles/hubbub-family-gaps.json`. Scanner: scratchpad `family_gaps.py`.

## 1. Totals

- Live puzzles scanned: **580** (380 daily entries dated 2026-10-13 onward + 200 extra).
- Candidate (puzzle, word) gaps with zipf >= 1.5: **4494**, across **1180** unique words.
- Candidate strings that fit a puzzle at all (any zipf): 60891 (puzzle, word) pairs; 21126 unique strings. Almost all of them score below 1.5 and are dropped.

| zipf band | (puzzle, word) pairs | unique words |
|---|---|---|
| >=3.0 | 286 | 70 |
| 2.0-2.99 | 1295 | 323 |
| 1.5-1.99 | 2913 | 787 |
| <1.5 | not reported | not reported |

Method: for each accepted word W (words + bonus) in each live puzzle, generate family variants (W+ED/ER/ING/S/ES, W+D/R and -ING for E-final, -IED/-IES for Y-final, doubled-consonant forms, and suffix-stripped bases incl. doubled-consonant bases). A variant is kept if it is >= 4 letters, uses only the puzzle letters, contains the center letter (letters[0]), and is not already accepted in that puzzle. Scored with `wordfreq.zipf_frequency(word.lower(), 'en')`. The "Suggested by" column is the accepted word that produced the candidate in the first live puzzle (in scan order) where it appears.

Caveat: wordfreq does not separate proper nouns or fragments from words, and its 1.5-1.99 band is mostly noise. The zipf >= 3.0 rows are the useful tier.

## 2. Candidate words (zipf >= 1.5, unique, sorted by zipf)

| Word | Zipf | Suggested by | Puzzles | Up to 5 ids |
|---|---|---|---|---|
| DAMN | 5.09 | DAMNED | 1 | hb0395 |
| MATT | 4.55 | MATTER | 8 | hb0058, hb0134, hb0152, hb0336, hb0337 |
| RAPE | 4.48 | RAPER | 9 | hb0086, hb0095, hb0268, hb0333, hb0343 |
| MOORE | 4.28 | MOORED | 3 | hb0170, hb0425, hb0553 |
| PENN | 3.90 | PENNER | 14 | hb0111, hb0137, hb0174, hb0279, hb0286 |
| FINN | 3.78 | FINNED | 2 | hb0054, hb0536 |
| PITT | 3.78 | PITTER | 6 | hb0029, hb0048, hb0066, hb0094, hb0478 |
| CARRIE | 3.77 | CARRIED | 9 | hb0093, hb0139, hb0226, hb0306, hb0324 |
| WEBB | 3.77 | WEBBER | 2 | hb0148, hb0356 |
| GREENE | 3.76 | GREENER | 8 | hb0049, hb0111, hb0143, hb0174, hb0303 |
| MANN | 3.73 | MANNER | 8 | hb0096, hb0152, hb0276, hb0363, hb0395 |
| MAYO | 3.72 | MAYOR | 2 | hb0115, hb0443 |
| BART | 3.67 | BARTER | 3 | hb0219, hb0383, hb0494 |
| MARTY | 3.64 | MARTYR | 1 | hb0384 |
| LABELLED | 3.62 | LABEL | 5 | hb0144, hb0188, hb0314, hb0429, hb0529 |
| ROTH | 3.59 | ROTHER | 1 | hb0320 |
| KELLER | 3.58 | KELL | 5 | hb0068, hb0085, hb0122, hb0233, hb0277 |
| LOWE | 3.56 | LOWER | 1 | hb0101 |
| LEVI | 3.54 | LEVIED | 2 | hb0551, hb0576 |
| WEIR | 3.52 | WEIRD | 1 | hb0600 |
| BARR | 3.46 | BARRED | 2 | hb0035, hb0231 |
| LITER | 3.46 | LITE | 1 | hb0117 |
| BEEP | 3.45 | BEEPER | 2 | hb0268, hb0472 |
| DOWNING | 3.44 | DOWN | 1 | hb0406 |
| WILDE | 3.43 | WILDER | 1 | hb0600 |
| BROWNE | 3.42 | BROWNER | 1 | hb0148 |
| MOTO | 3.42 | MOTOR | 5 | hb0060, hb0240, hb0243, hb0369, hb0553 |
| DECO | 3.41 | DECOR | 1 | hb0425 |
| BUTCH | 3.37 | BUTCHER | 1 | hb0386 |
| GRIMM | 3.35 | GRIMMER | 2 | hb0218, hb0366 |
| ROWE | 3.35 | ROWED | 5 | hb0062, hb0101, hb0274, hb0320, hb0398 |
| POOLE | 3.34 | POOLED | 3 | hb0159, hb0298, hb0447 |
| PRETTIER | 3.32 | PRETTY | 1 | hb0329 |
| ROCHE | 3.32 | ROCHER | 2 | hb0173, hb0340 |
| CANCELLING | 3.31 | CANCEL | 1 | hb0301 |
| CHAI | 3.29 | CHAIR | 1 | hb0247 |
| MARIN | 3.29 | MARINER | 3 | hb0053, hb0096, hb0363 |
| COLO | 3.28 | COLOR | 3 | hb0026, hb0059, hb0382 |
| ROBB | 3.28 | ROBBER | 7 | hb0084, hb0148, hb0204, hb0281, hb0357 |
| HELLER | 3.27 | HELL | 4 | hb0203, hb0214, hb0283, hb0580 |
| GUNN | 3.26 | GUNNED | 3 | hb0034, hb0362, hb0578 |
| MODELLED | 3.25 | MODEL | 2 | hb0154, hb0559 |
| CONG | 3.24 | CONGER | 1 | hb0043 |
| GREER | 3.24 | GREE | 20 | hb0028, hb0084, hb0100, hb0111, hb0143 |
| GROVER | 3.22 | GROVE | 4 | hb0238, hb0315, hb0550, hb0562 |
| TERRI | 3.22 | TERRIER | 27 | hb0094, hb0100, hb0116, hb0117, hb0147 |
| BONER | 3.21 | BONE | 1 | hb0148 |
| DIFF | 3.20 | DIFFER | 1 | hb0161 |
| MILNE | 3.20 | MILNER | 1 | hb0053 |
| BRAINER | 3.19 | BRAIN | 1 | hb0471 |
| LEMME | 3.19 | LEMMING | 1 | hb0445 |
| TENN | 3.19 | TENNER | 12 | hb0045, hb0171, hb0172, hb0212, hb0331 |
| HORNE | 3.17 | HORNER | 1 | hb0340 |
| BETTE | 3.15 | BETTER | 3 | hb0126, hb0219, hb0599 |
| DOGG | 3.15 | DOGGED | 4 | hb0089, hb0142, hb0355, hb0432 |
| ALLIE | 3.14 | ALLIED | 3 | hb0475, hb0527, hb0551 |
| FAIRE | 3.14 | FAIRED | 7 | hb0161, hb0335, hb0347, hb0372, hb0409 |
| LUBE | 3.13 | LUBED | 1 | hb0482 |
| PORTE | 3.13 | PORTER | 5 | hb0063, hb0242, hb0281, hb0308, hb0503 |
| ALTA | 3.12 | ALTAR | 16 | hb0040, hb0058, hb0079, hb0114, hb0156 |
| BARRIE | 3.12 | BARRIER | 6 | hb0139, hb0213, hb0383, hb0471, hb0494 |
| MARR | 3.11 | MARRED | 1 | hb0150 |
| BARRE | 3.08 | BARRED | 2 | hb0035, hb0231 |
| BRIE | 3.08 | BRIER | 12 | hb0100, hb0117, hb0139, hb0148, hb0205 |
| CURRIE | 3.08 | CURRIER | 4 | hb0094, hb0205, hb0271, hb0546 |
| FRAU | 3.07 | FRAUD | 1 | hb0050 |
| LEVELLED | 3.04 | LEVEL | 2 | hb0551, hb0576 |
| WINN | 3.02 | WINNER | 1 | hb0513 |
| POOPING | 3.01 | POOP | 2 | hb0177, hb0465 |
| TEMPE | 3.01 | TEMPER | 3 | hb0048, hb0240, hb0503 |
| LAUDE | 2.99 | LAUDED | 7 | hb0065, hb0298, hb0346, hb0389, hb0459 |
| REPELLED | 2.98 | REPEL | 1 | hb0234 |
| ANGE | 2.97 | ANGER | 1 | hb0526 |
| GOODE | 2.97 | GOODER | 2 | hb0089, hb0142 |
| TOTALLED | 2.97 | TOTAL | 1 | hb0529 |
| WAITE | 2.97 | WAITED | 1 | hb0033 |
| CREWE | 2.96 | CREWED | 1 | hb0574 |
| KEENE | 2.96 | KEENER | 4 | hb0068, hb0123, hb0212, hb0436 |
| WITT | 2.96 | WITTED | 2 | hb0033, hb0399 |
| FRYE | 2.95 | FRYER | 3 | hb0312, hb0353, hb0358 |
| CRAMER | 2.93 | CRAM | 2 | hb0284, hb0374 |
| GELLER | 2.93 | GELL | 3 | hb0028, hb0255, hb0257 |
| LEVELLING | 2.92 | LEVEL | 3 | hb0131, hb0259, hb0524 |
| CALLE | 2.91 | CALLER | 12 | hb0110, hb0188, hb0226, hb0236, hb0253 |
| PREPPED | 2.91 | PREP | 1 | hb0234 |
| HAMM | 2.90 | HAMMER | 2 | hb0150, hb0239 |
| TRAD | 2.90 | TRADED | 2 | hb0134, hb0264 |
| BERING | 2.89 | BERE | 1 | hb0303 |
| KILT | 2.88 | KILTER | 1 | hb0233 |
| REINER | 2.88 | REIN | 24 | hb0049, hb0053, hb0068, hb0096, hb0103 |
| TRIPP | 2.88 | TRIPPER | 5 | hb0029, hb0048, hb0094, hb0329, hb0462 |
| BEECHER | 2.87 | BEECH | 1 | hb0379 |
| DIGG | 2.87 | DIGGER | 2 | hb0089, hb0194 |
| FOOTE | 2.85 | FOOTER | 2 | hb0216, hb0518 |
| WINKLER | 2.84 | WINKLE | 1 | hb0068 |
| ALLI | 2.83 | ALLIED | 2 | hb0475, hb0527 |
| TOURE | 2.83 | TOURER | 6 | hb0163, hb0171, hb0204, hb0216, hb0263 |
| AIME | 2.82 | AIMER | 7 | hb0053, hb0161, hb0276, hb0337, hb0363 |
| ALLE | 2.81 | ALLER | 20 | hb0079, hb0085, hb0102, hb0110, hb0114 |
| CHEE | 2.81 | CHEER | 1 | hb0247 |
| MERC | 2.81 | MERCER | 5 | hb0277, hb0284, hb0367, hb0374, hb0388 |
| OLDE | 2.80 | OLDER | 5 | hb0109, hb0314, hb0376, hb0447, hb0516 |
| CONDON | 2.79 | CONDONED | 3 | hb0261, hb0377, hb0436 |
| JETT | 2.79 | JETTED | 1 | hb0461 |
| LADD | 2.78 | LADDER | 2 | hb0269, hb0314 |
| THICKE | 2.78 | THICKER | 1 | hb0149 |
| WARNE | 2.78 | WARNED | 3 | hb0042, hb0477, hb0513 |
| WIEN | 2.78 | WIENER | 2 | hb0068, hb0513 |
| BREA | 2.77 | BREAD | 2 | hb0035, hb0231 |
| ELAN | 2.77 | ELAND | 3 | hb0065, hb0151, hb0269 |
| PARTE | 2.77 | PARTER | 1 | hb0086 |
| TROTT | 2.77 | TROTTER | 15 | hb0032, hb0063, hb0171, hb0181, hb0204 |
| PARKE | 2.76 | PARKER | 1 | hb0507 |
| CARDED | 2.75 | CARD | 1 | hb0515 |
| PIETER | 2.75 | PIET | 4 | hb0029, hb0048, hb0094, hb0191 |
| REBA | 2.75 | REBAR | 17 | hb0035, hb0084, hb0085, hb0102, hb0186 |
| BENNING | 2.74 | BENN | 2 | hb0256, hb0303 |
| REDD | 2.74 | REDDER | 1 | hb0502 |
| WELKER | 2.74 | WELK | 2 | hb0068, hb0122 |
| ALVA | 2.73 | ALVAR | 4 | hb0102, hb0253, hb0269, hb0415 |
| GARBER | 2.73 | GARB | 1 | hb0084 |
| READE | 2.73 | READER | 7 | hb0035, hb0042, hb0050, hb0231, hb0269 |
| VIGO | 2.73 | VIGOR | 1 | hb0550 |
| THATCH | 2.71 | THATCHED | 1 | hb0251 |
| WARING | 2.71 | WARE | 1 | hb0513 |
| LAZER | 2.70 | LAZE | 1 | hb0197 |
| LITT | 2.69 | LITTER | 4 | hb0117, hb0147, hb0211, hb0291 |
| BOWE | 2.68 | BOWER | 1 | hb0148 |
| FETE | 2.68 | FETED | 6 | hb0021, hb0211, hb0241, hb0321, hb0381 |
| RAINE | 2.68 | RAINER | 6 | hb0053, hb0096, hb0213, hb0214, hb0293 |
| GRAMMER | 2.67 | GRAM | 4 | hb0218, hb0239, hb0366, hb0437 |
| RIDDLER | 2.66 | RIDDLE | 1 | hb0502 |
| TRAPP | 2.66 | TRAPPER | 1 | hb0086 |
| TIMO | 2.65 | TIMOR | 3 | hb0060, hb0240, hb0243 |
| CARPE | 2.64 | CARPER | 1 | hb0539 |
| DAMM | 2.64 | DAMMED | 2 | hb0150, hb0378 |
| MERRIER | 2.64 | MERRY | 1 | hb0192 |
| NUTT | 2.63 | NUTTED | 8 | hb0146, hb0163, hb0166, hb0171, hb0287 |
| PEELE | 2.63 | PEELED | 1 | hb0234 |
| PINTER | 2.63 | PINT | 1 | hb0341 |
| FETT | 2.62 | FETTER | 10 | hb0021, hb0046, hb0116, hb0211, hb0216 |
| BLATT | 2.61 | BLATTER | 1 | hb0219 |
| HALLER | 2.61 | HALL | 4 | hb0110, hb0203, hb0283, hb0580 |
| RAPP | 2.61 | RAPPER | 9 | hb0086, hb0095, hb0268, hb0333, hb0343 |
| HAMER | 2.60 | HAME | 2 | hb0150, hb0239 |
| PANELLED | 2.60 | PANEL | 1 | hb0065 |
| CAIR | 2.59 | CAIRD | 4 | hb0093, hb0139, hb0245, hb0361 |
| ELLER | 2.59 | ELLE | 17 | hb0026, hb0068, hb0085, hb0114, hb0169 |
| NUDGING | 2.59 | NUDGE | 1 | hb0034 |
| CELLED | 2.58 | CELL | 1 | hb0533 |
| GLUING | 2.58 | GLUE | 1 | hb0034 |
| RYDE | 2.58 | RYDER | 1 | hb0316 |
| VIVI | 2.58 | VIVID | 2 | hb0228, hb0278 |
| FRIGGING | 2.56 | FRIG | 2 | hb0143, hb0335 |
| LORING | 2.56 | LORE | 1 | hb0178 |
| POOPER | 2.56 | POOP | 11 | hb0090, hb0227, hb0242, hb0281, hb0308 |
| PREORDERED | 2.56 | PREORDER | 8 | hb0089, hb0227, hb0309, hb0333, hb0447 |
| PEGG | 2.54 | PEGGING | 4 | hb0111, hb0137, hb0343, hb0410 |
| REACHER | 2.54 | REACH | 1 | hb0247 |
| TRAC | 2.54 | TRACER | 1 | hb0307 |
| BELLI | 2.53 | BELLIED | 1 | hb0499 |
| DANN | 2.52 | DANNER | 4 | hb0061, hb0269, hb0395, hb0515 |
| ANNEXE | 2.51 | ANNEXING | 1 | hb0222 |
| HELMER | 2.50 | HELM | 1 | hb0203 |
| MOLLER | 2.50 | MOLL | 3 | hb0090, hb0338, hb0397 |
| RETURNER | 2.50 | RETURN | 1 | hb0166 |
| REITER | 2.49 | REIT | 1 | hb0117 |
| RIGG | 2.49 | RIGGER | 8 | hb0100, hb0143, hb0194, hb0218, hb0366 |
| BROOKER | 2.48 | BROOK | 2 | hb0084, hb0532 |
| GATO | 2.48 | GATOR | 3 | hb0394, hb0403, hb0437 |
| PENDER | 2.48 | PEND | 4 | hb0279, hb0333, hb0444, hb0572 |
| PONTING | 2.48 | PONT | 1 | hb0465 |
| RICHE | 2.48 | RICHER | 6 | hb0093, hb0103, hb0149, hb0173, hb0247 |
| BABI | 2.47 | BABIED | 1 | hb0139 |
| BROWER | 2.47 | BROW | 1 | hb0148 |
| CANN | 2.47 | CANNER | 16 | hb0043, hb0157, hb0182, hb0183, hb0253 |
| COOTE | 2.47 | COOTER | 2 | hb0059, hb0173 |
| DOLLA | 2.47 | DOLLAR | 4 | hb0130, hb0245, hb0314, hb0447 |
| GROUPE | 2.47 | GROUPED | 2 | hb0185, hb0255 |
| NAVER | 2.47 | NAVE | 5 | hb0037, hb0061, hb0102, hb0253, hb0269 |
| INTE | 2.46 | INTER | 6 | hb0212, hb0341, hb0413, hb0414, hb0420 |
| DONO | 2.45 | DONOR | 8 | hb0061, hb0142, hb0158, hb0195, hb0406 |
| LEAKE | 2.45 | LEAKER | 4 | hb0085, hb0122, hb0236, hb0277 |
| LEGG | 2.45 | LEGGING | 12 | hb0137, hb0256, hb0259, hb0344, hb0346 |
| RABI | 2.45 | RABID | 2 | hb0112, hb0139 |
| WITTE | 2.45 | WITTED | 2 | hb0033, hb0399 |
| CLAPP | 2.44 | CLAPPER | 1 | hb0539 |
| FORME | 2.44 | FORMED | 2 | hb0170, hb0353 |
| LETT | 2.44 | LETTER | 11 | hb0026, hb0058, hb0114, hb0147, hb0203 |
| FRON | 2.43 | FROND | 1 | hb0158 |
| TREN | 2.43 | TREND | 2 | hb0052, hb0424 |
| BAHA | 2.42 | BAHAR | 2 | hb0379, hb0451 |
| FERRIER | 2.42 | FERRY | 1 | hb0358 |
| GOERING | 2.42 | GOER | 4 | hb0111, hb0142, hb0178, hb0550 |
| HADER | 2.41 | HADE | 3 | hb0379, hb0492, hb0584 |
| NETT | 2.41 | NETTER | 23 | hb0045, hb0113, hb0123, hb0127, hb0171 |
| THEI | 2.41 | THEIR | 5 | hb0147, hb0149, hb0173, hb0291, hb0487 |
| BEGG | 2.40 | BEGGING | 3 | hb0256, hb0303, hb0432 |
| ELUDING | 2.40 | ELUDE | 1 | hb0034 |
| REEDER | 2.40 | REED | 1 | hb0502 |
| TITE | 2.40 | TITER | 1 | hb0117 |
| WEIRDED | 2.40 | WEIRD | 1 | hb0600 |
| NATUR | 2.39 | NATURED | 1 | hb0328 |
| PERRI | 2.39 | PERRIER | 18 | hb0029, hb0048, hb0094, hb0095, hb0111 |
| WARR | 2.39 | WARRING | 1 | hb0513 |
| BALMER | 2.38 | BALM | 2 | hb0257, hb0338 |
| MAPP | 2.38 | MAPPED | 2 | hb0150, hb0491 |
| REINE | 2.38 | REINING | 10 | hb0049, hb0103, hb0111, hb0143, hb0303 |
| CANDI | 2.37 | CANDID | 2 | hb0054, hb0157 |
| CLEA | 2.37 | CLEAR | 6 | hb0110, hb0226, hb0253, hb0277, hb0307 |
| ENDE | 2.37 | ENDED | 16 | hb0061, hb0113, hb0157, hb0158, hb0182 |
| FILLE | 2.37 | FILLER | 7 | hb0169, hb0312, hb0347, hb0358, hb0372 |
| LEGGE | 2.37 | LEGGING | 12 | hb0137, hb0256, hb0259, hb0344, hb0346 |
| PAYE | 2.37 | PAYER | 2 | hb0086, hb0288 |
| PREF | 2.37 | PREFER | 3 | hb0268, hb0274, hb0466 |
| TRIGG | 2.37 | TRIGGER | 5 | hb0100, hb0116, hb0218, hb0291, hb0473 |
| AMBLER | 2.36 | AMBLE | 4 | hb0085, hb0232, hb0257, hb0338 |
| LEHRER | 2.36 | LEHR | 5 | hb0203, hb0214, hb0283, hb0357, hb0580 |
| POPPE | 2.36 | POPPER | 17 | hb0090, hb0111, hb0159, hb0174, hb0227 |
| RAYE | 2.36 | RAYED | 2 | hb0231, hb0316 |
| ROLLE | 2.36 | ROLLER | 14 | hb0026, hb0032, hb0090, hb0101, hb0109 |
| WELLE | 2.36 | WELLER | 2 | hb0068, hb0600 |
| DEEDED | 2.35 | DEED | 1 | hb0533 |
| DRILLER | 2.35 | DRILL | 1 | hb0502 |
| BETT | 2.34 | BETTER | 3 | hb0126, hb0219, hb0599 |
| BIRTHER | 2.34 | BIRTH | 1 | hb0100 |
| GRAMMA | 2.34 | GRAMMAR | 6 | hb0218, hb0239, hb0366, hb0368, hb0437 |
| UNDE | 2.34 | UNDER | 1 | hb0166 |
| CAPP | 2.32 | CAPPED | 2 | hb0229, hb0539 |
| GRAV | 2.32 | GRAVER | 1 | hb0530 |
| KRON | 2.32 | KRONER | 2 | hb0305, hb0436 |
| LAGE | 2.32 | LAGER | 2 | hb0028, hb0257 |
| ROCH | 2.32 | ROCHER | 1 | hb0340 |
| WEARE | 2.32 | WEARER | 6 | hb0042, hb0062, hb0079, hb0145, hb0477 |
| BARRELLED | 2.31 | BARREL | 1 | hb0314 |
| FAREED | 2.31 | FARE | 6 | hb0021, hb0035, hb0050, hb0365, hb0381 |
| DENTE | 2.30 | DENTED | 7 | hb0113, hb0127, hb0287, hb0321, hb0461 |
| HOPPE | 2.30 | HOPPED | 1 | hb0525 |
| KEELE | 2.30 | KEELER | 6 | hb0068, hb0085, hb0122, hb0233, hb0236 |
| MARKE | 2.30 | MARKER | 3 | hb0085, hb0122, hb0277 |
| ORDE | 2.30 | ORDER | 14 | hb0089, hb0109, hb0126, hb0142, hb0315 |
| OTHE | 2.30 | OTHER | 3 | hb0126, hb0173, hb0470 |
| PREPPER | 2.30 | PREP | 1 | hb0234 |
| TAPP | 2.29 | TAPPED | 4 | hb0066, hb0086, hb0229, hb0571 |
| BERNER | 2.28 | BERNE | 5 | hb0148, hb0284, hb0303, hb0435, hb0599 |
| LABO | 2.28 | LABOR | 5 | hb0130, hb0237, hb0273, hb0314, hb0382 |
| LINKE | 2.28 | LINKER | 1 | hb0068 |
| MADD | 2.28 | MADDER | 1 | hb0150 |
| MENDE | 2.28 | MENDED | 4 | hb0375, hb0395, hb0404, hb0553 |
| WIELDER | 2.28 | WIELD | 1 | hb0600 |
| BURNE | 2.27 | BURNED | 2 | hb0493, hb0599 |
| GENTING | 2.27 | GENT | 4 | hb0123, hb0294, hb0359, hb0582 |
| GUID | 2.26 | GUIDED | 2 | hb0034, hb0194 |
| LEVE | 2.26 | LEVER | 2 | hb0131, hb0415 |
| ATTEN | 2.25 | ATTEND | 5 | hb0113, hb0127, hb0151, hb0287, hb0400 |
| HAMEED | 2.25 | HAME | 1 | hb0150 |
| CORNE | 2.24 | CORNER | 7 | hb0043, hb0059, hb0121, hb0138, hb0340 |
| DARKE | 2.24 | DARKER | 1 | hb0231 |
| EMPTED | 2.24 | EMPT | 2 | hb0478, hb0503 |
| POLA | 2.24 | POLAR | 4 | hb0237, hb0280, hb0296, hb0447 |
| TRIA | 2.24 | TRIAD | 3 | hb0299, hb0361, hb0481 |
| VETTE | 2.24 | VETTED | 4 | hb0264, hb0487, hb0523, hb0571 |
| ABID | 2.23 | ABIDED | 1 | hb0139 |
| BELI | 2.23 | BELIED | 1 | hb0499 |
| FATH | 2.23 | FATHER | 1 | hb0586 |
| HAMP | 2.23 | HAMPER | 1 | hb0150 |
| INDE | 2.23 | INDEED | 1 | hb0536 |
| MANDER | 2.23 | MAND | 1 | hb0395 |
| BORGER | 2.22 | BORG | 1 | hb0084 |
| TERME | 2.22 | TERMED | 4 | hb0052, hb0134, hb0462, hb0553 |
| TEXTE | 2.22 | TEXTER | 3 | hb0192, hb0359, hb0544 |
| ALTE | 2.21 | ALTER | 6 | hb0058, hb0079, hb0114, hb0203, hb0283 |
| BRIA | 2.21 | BRIAR | 8 | hb0112, hb0139, hb0213, hb0297, hb0383 |
| COTT | 2.21 | COTTER | 1 | hb0059 |
| GABLER | 2.21 | GABLE | 1 | hb0257 |
| INDER | 2.21 | INDE | 2 | hb0375, hb0573 |
| ROOKE | 2.21 | ROOKER | 3 | hb0084, hb0305, hb0376 |
| MANNE | 2.20 | MANNER | 8 | hb0096, hb0276, hb0363, hb0388, hb0395 |
| TOPP | 2.20 | TOPPER | 5 | hb0242, hb0281, hb0308, hb0465, hb0503 |
| BABER | 2.19 | BABE | 13 | hb0035, hb0085, hb0102, hb0186, hb0217 |
| BALLA | 2.19 | BALLAD | 6 | hb0144, hb0188, hb0314, hb0370, hb0429 |
| GELL | 2.19 | GELLED | 1 | hb0533 |
| MACHA | 2.19 | MACHAR | 1 | hb0446 |
| MOLDE | 2.19 | MOLDED | 2 | hb0154, hb0559 |
| DENI | 2.18 | DENIED | 7 | hb0054, hb0157, hb0292, hb0375, hb0536 |
| ENTE | 2.18 | ENTER | 12 | hb0045, hb0171, hb0172, hb0212, hb0331 |
| FING | 2.17 | FINGER | 1 | hb0335 |
| KENN | 2.17 | KENNER | 3 | hb0068, hb0212, hb0436 |
| TIPP | 2.17 | TIPPER | 6 | hb0029, hb0048, hb0066, hb0094, hb0478 |
| TOLLE | 2.17 | TOLLER | 3 | hb0026, hb0235, hb0397 |
| ACCOR | 2.16 | ACCORD | 2 | hb0245, hb0361 |
| BERGE | 2.16 | BERGER | 3 | hb0084, hb0100, hb0303 |
| HITT | 2.16 | HITTING | 5 | hb0099, hb0147, hb0291, hb0326, hb0487 |
| LANDE | 2.16 | LANDED | 4 | hb0065, hb0151, hb0269, hb0597 |
| HECKER | 2.15 | HECK | 1 | hb0149 |
| TIMI | 2.15 | TIMID | 4 | hb0452, hb0478, hb0481, hb0595 |
| TREA | 2.15 | TREAD | 2 | hb0134, hb0264 |
| BENNER | 2.14 | BENN | 4 | hb0148, hb0303, hb0435, hb0599 |
| FOWLE | 2.14 | FOWLER | 1 | hb0101 |
| MERCE | 2.14 | MERCER | 5 | hb0277, hb0284, hb0367, hb0374, hb0388 |
| TAPI | 2.14 | TAPIR | 3 | hb0267, hb0332, hb0455 |
| DONAT | 2.13 | DONATING | 1 | hb0557 |
| DORNER | 2.13 | DORN | 7 | hb0061, hb0142, hb0158, hb0315, hb0423 |
| GOVER | 2.13 | GOVE | 3 | hb0238, hb0550, hb0562 |
| PILLER | 2.13 | PILL | 3 | hb0095, hb0286, hb0539 |
| VINING | 2.13 | VINE | 2 | hb0131, hb0524 |
| GATH | 2.12 | GATHER | 1 | hb0473 |
| GRABER | 2.12 | GRAB | 1 | hb0084 |
| TOLER | 2.12 | TOLE | 3 | hb0026, hb0235, hb0397 |
| WARDE | 2.12 | WARDED | 2 | hb0042, hb0062 |
| WILLE | 2.12 | WILLED | 1 | hb0600 |
| BANN | 2.11 | BANNER | 6 | hb0102, hb0144, hb0182, hb0217, hb0429 |
| DREA | 2.11 | DREAD | 7 | hb0035, hb0042, hb0050, hb0231, hb0269 |
| GRINER | 2.11 | GRIN | 3 | hb0049, hb0143, hb0546 |
| LAPP | 2.11 | LAPPED | 3 | hb0065, hb0298, hb0459 |
| VIBING | 2.11 | VIBE | 1 | hb0524 |
| BEATE | 2.10 | BEATER | 2 | hb0219, hb0494 |
| BILLER | 2.10 | BILL | 1 | hb0117 |
| BRODER | 2.10 | BROD | 1 | hb0438 |
| EMME | 2.10 | EMMER | 16 | hb0085, hb0150, hb0170, hb0192, hb0232 |
| FATT | 2.10 | FATTER | 8 | hb0021, hb0079, hb0116, hb0145, hb0381 |
| FLATT | 2.10 | FLATTER | 2 | hb0079, hb0381 |
| GENER | 2.10 | GENE | 5 | hb0049, hb0111, hb0174, hb0303, hb0410 |
| LIPPE | 2.10 | LIPPER | 3 | hb0095, hb0286, hb0539 |
| NAVEED | 2.10 | NAVE | 3 | hb0061, hb0113, hb0269 |
| POORE | 2.10 | POORER | 16 | hb0063, hb0090, hb0111, hb0174, hb0227 |
| POPP | 2.10 | POPPER | 15 | hb0090, hb0159, hb0177, hb0227, hb0242 |
| REVELLED | 2.10 | REVEL | 1 | hb0502 |
| REVELLING | 2.10 | REVEL | 1 | hb0131 |
| BARBE | 2.09 | BARBER | 2 | hb0186, hb0471 |
| BOATER | 2.09 | BOAT | 1 | hb0281 |
| CELLE | 2.09 | CELLED | 4 | hb0236, hb0402, hb0527, hb0540 |
| COPP | 2.09 | COPPED | 2 | hb0159, hb0227 |
| LEVELLER | 2.09 | LEVEL | 2 | hb0131, hb0415 |
| PATT | 2.09 | PATTED | 4 | hb0066, hb0086, hb0229, hb0571 |
| RIGO | 2.09 | RIGOR | 8 | hb0142, hb0177, hb0178, hb0224, hb0302 |
| TINIER | 2.09 | TINY | 1 | hb0413 |
| MARRI | 2.08 | MARRIED | 1 | hb0161 |
| THAL | 2.08 | THALER | 2 | hb0203, hb0283 |
| BIGGE | 2.07 | BIGGER | 1 | hb0303 |
| LODER | 2.07 | LODE | 5 | hb0109, hb0314, hb0376, hb0447, hb0516 |
| PERRIE | 2.07 | PERRIER | 18 | hb0029, hb0048, hb0094, hb0095, hb0111 |
| TOUTE | 2.07 | TOUTED | 1 | hb0223 |
| TRIE | 2.07 | TRIER | 27 | hb0094, hb0100, hb0116, hb0117, hb0147 |
| TROYER | 2.07 | TROY | 4 | hb0032, hb0063, hb0181, hb0242 |
| BERTHE | 2.06 | BERTHED | 1 | hb0126 |
| DEFI | 2.06 | DEFIED | 3 | hb0054, hb0161, hb0466 |
| PAVER | 2.06 | PAVE | 2 | hb0415, hb0491 |
| BITTE | 2.05 | BITTER | 1 | hb0117 |
| BROK | 2.05 | BROKER | 2 | hb0084, hb0532 |
| LITTE | 2.05 | LITTER | 5 | hb0117, hb0147, hb0211, hb0291, hb0420 |
| LIVI | 2.05 | LIVID | 1 | hb0576 |
| PARLER | 2.05 | PARLE | 3 | hb0095, hb0268, hb0539 |
| PILA | 2.05 | PILAR | 4 | hb0087, hb0095, hb0332, hb0539 |
| PITI | 2.05 | PITIED | 3 | hb0066, hb0478, hb0571 |
| TRUTHER | 2.05 | TRUTH | 1 | hb0386 |
| WATE | 2.05 | WATER | 2 | hb0079, hb0145 |
| BELLER | 2.04 | BELL | 9 | hb0085, hb0169, hb0219, hb0232, hb0257 |
| BOOKE | 2.04 | BOOKER | 1 | hb0532 |
| BULLE | 2.04 | BULLER | 3 | hb0232, hb0593, hb0599 |
| DIMM | 2.04 | DIMMED | 3 | hb0154, hb0161, hb0595 |
| GROCE | 2.04 | GROCER | 2 | hb0043, hb0104 |
| LEGE | 2.04 | LEGER | 3 | hb0028, hb0255, hb0257 |
| PLAC | 2.04 | PLACER | 1 | hb0539 |
| ACTO | 2.03 | ACTOR | 1 | hb0382 |
| FRING | 2.03 | FRINGING | 2 | hb0143, hb0335 |
| HARTER | 2.03 | HART | 1 | hb0480 |
| PRIO | 2.03 | PRIOR | 9 | hb0176, hb0177, hb0227, hb0270, hb0278 |
| ARCHE | 2.02 | ARCHER | 1 | hb0247 |
| DIENER | 2.02 | DIENE | 2 | hb0375, hb0573 |
| DOTT | 2.02 | DOTTED | 3 | hb0223, hb0264, hb0518 |
| FERRIE | 2.02 | FERRIER | 17 | hb0046, hb0143, hb0161, hb0165, hb0220 |
| FROMMER | 2.02 | FROM | 2 | hb0170, hb0353 |
| GORG | 2.02 | GORGED | 9 | hb0142, hb0177, hb0178, hb0224, hb0302 |
| HARRI | 2.02 | HARRIED | 3 | hb0093, hb0247, hb0306 |
| LUMB | 2.02 | LUMBER | 1 | hb0593 |
| PANDE | 2.02 | PANDER | 2 | hb0333, hb0572 |
| POWE | 2.02 | POWER | 2 | hb0274, hb0508 |
| TAGG | 2.02 | TAGGER | 11 | hb0058, hb0116, hb0160, hb0218, hb0323 |
| BALLE | 2.01 | BALLER | 11 | hb0085, hb0102, hb0144, hb0188, hb0217 |
| CUPP | 2.01 | CUPPED | 2 | hb0159, hb0234 |
| GETT | 2.01 | GETTER | 11 | hb0058, hb0116, hb0218, hb0291, hb0294 |
| HANDE | 2.01 | HANDED | 3 | hb0287, hb0492, hb0590 |
| BENING | 2.00 | BENE | 2 | hb0256, hb0303 |
| BRAK | 2.00 | BRAKED | 1 | hb0231 |
| FURR | 2.00 | FURRED | 1 | hb0050 |
| LAYE | 2.00 | LAYER | 4 | hb0038, hb0197, hb0283, hb0505 |
| LETTE | 2.00 | LETTER | 11 | hb0026, hb0058, hb0114, hb0147, hb0203 |
| MELLING | 2.00 | MELL | 1 | hb0445 |
| METTLER | 2.00 | METTLE | 4 | hb0058, hb0203, hb0397, hb0575 |
| REDI | 2.00 | REDID | 13 | hb0089, hb0093, hb0103, hb0139, hb0153 |
| RIPP | 2.00 | RIPPER | 12 | hb0029, hb0048, hb0094, hb0095, hb0227 |
| RUTTE | 2.00 | RUTTER | 14 | hb0134, hb0163, hb0171, hb0172, hb0202 |
| ACTE | 1.99 | ACTED | 8 | hb0074, hb0188, hb0378, hb0389, hb0400 |
| COLLA | 1.99 | COLLAR | 4 | hb0110, hb0226, hb0245, hb0382 |
| DOLO | 1.99 | DOLOR | 6 | hb0109, hb0130, hb0314, hb0376, hb0447 |
| FIFER | 1.99 | FIFE | 1 | hb0358 |
| HUGER | 1.99 | HUGE | 1 | hb0470 |
| LEVERED | 1.99 | LEVER | 1 | hb0502 |
| ALDE | 1.98 | ALDER | 2 | hb0269, hb0314 |
| RELI | 1.98 | RELIED | 2 | hb0313, hb0502 |
| REVILE | 1.98 | REVILED | 1 | hb0502 |
| TOVA | 1.98 | TOVAR | 3 | hb0235, hb0264, hb0308 |
| BRIEFE | 1.97 | BRIEFER | 2 | hb0165, hb0303 |
| CARRER | 1.97 | CARR | 15 | hb0025, hb0043, hb0104, hb0110, hb0183 |
| GREYED | 1.97 | GREY | 1 | hb0530 |
| TERRIE | 1.97 | TERRIER | 27 | hb0094, hb0100, hb0116, hb0117, hb0147 |
| TRAPPE | 1.97 | TRAPPER | 1 | hb0086 |
| BORDE | 1.96 | BORDER | 2 | hb0126, hb0438 |
| CUTT | 1.96 | CUTTER | 1 | hb0386 |
| KNELLER | 1.96 | KNELL | 1 | hb0068 |
| LARG | 1.96 | LARGER | 3 | hb0028, hb0257, hb0517 |
| RUNING | 1.96 | RUNE | 2 | hb0546, hb0578 |
| WEBBE | 1.96 | WEBBER | 2 | hb0148, hb0356 |
| CELLER | 1.95 | CELL | 6 | hb0026, hb0059, hb0277, hb0307, hb0354 |
| CIDE | 1.95 | CIDER | 3 | hb0093, hb0139, hb0153 |
| DEMAN | 1.95 | DEMAND | 2 | hb0395, hb0404 |
| AIDER | 1.94 | AIDE | 3 | hb0093, hb0139, hb0161 |
| BLAT | 1.94 | BLATTER | 1 | hb0219 |
| DEFECATED | 1.94 | DEFECATE | 1 | hb0021 |
| DUELED | 1.94 | DUEL | 1 | hb0034 |
| EIDE | 1.94 | EIDER | 8 | hb0089, hb0093, hb0139, hb0153, hb0161 |
| LEAV | 1.94 | LEAVER | 5 | hb0102, hb0253, hb0269, hb0415, hb0551 |
| MANAG | 1.94 | MANAGING | 3 | hb0152, hb0276, hb0504 |
| MANED | 1.94 | MANE | 2 | hb0395, hb0404 |
| MELTER | 1.94 | MELT | 4 | hb0058, hb0203, hb0397, hb0575 |
| TANN | 1.94 | TANNED | 15 | hb0113, hb0127, hb0151, hb0160, hb0287 |
| TURRETED | 1.94 | TURRET | 3 | hb0134, hb0166, hb0328 |
| BAYAR | 1.93 | BAYARD | 1 | hb0231 |
| BEARE | 1.93 | BEARER | 17 | hb0035, hb0084, hb0085, hb0102, hb0186 |
| BOMBE | 1.93 | BOMBER | 2 | hb0338, hb0404 |
| FOUN | 1.93 | FOUND | 1 | hb0158 |
| HIVER | 1.93 | HIVE | 1 | hb0306 |
| MODER | 1.93 | MODE | 3 | hb0170, hb0425, hb0553 |
| PERCENTER | 1.93 | PERCENT | 2 | hb0179, hb0279 |
| ATON | 1.92 | ATONING | 3 | hb0323, hb0542, hb0557 |
| BAITER | 1.92 | BAIT | 1 | hb0494 |
| COMED | 1.92 | COME | 4 | hb0154, hb0246, hb0261, hb0425 |
| ENLIVENING | 1.92 | ENLIVEN | 3 | hb0131, hb0259, hb0524 |
| GREATE | 1.92 | GREATER | 6 | hb0058, hb0116, hb0218, hb0394, hb0437 |
| HOOVERED | 1.92 | HOOVER | 1 | hb0584 |
| LIPP | 1.92 | LIPPER | 3 | hb0095, hb0286, hb0539 |
| OTTE | 1.92 | OTTER | 15 | hb0126, hb0171, hb0173, hb0216, hb0235 |
| PANTH | 1.92 | PANTHER | 1 | hb0520 |
| TREED | 1.92 | TREE | 11 | hb0052, hb0126, hb0134, hb0147, hb0211 |
| ARME | 1.91 | ARMED | 1 | hb0150 |
| BARRI | 1.91 | BARRIER | 6 | hb0139, hb0213, hb0383, hb0471, hb0494 |
| CANTING | 1.91 | CANT | 2 | hb0330, hb0392 |
| CAREEN | 1.91 | CAREENED | 1 | hb0515 |
| CHARR | 1.91 | CHARRED | 2 | hb0379, hb0492 |
| DAPP | 1.91 | DAPPER | 3 | hb0333, hb0343, hb0572 |
| EDGER | 1.91 | EDGE | 3 | hb0089, hb0194, hb0530 |
| FITT | 1.91 | FITTER | 7 | hb0046, hb0116, hb0211, hb0216, hb0312 |
| GREYER | 1.91 | GREY | 4 | hb0028, hb0174, hb0366, hb0530 |
| HOPP | 1.91 | HOPPED | 1 | hb0525 |
| LIVERED | 1.91 | LIVER | 1 | hb0502 |
| MAILE | 1.91 | MAILER | 2 | hb0053, hb0551 |
| NEITH | 1.91 | NEITHER | 1 | hb0212 |
| PROPE | 1.91 | PROPER | 16 | hb0063, hb0090, hb0111, hb0174, hb0227 |
| REAMER | 1.91 | REAM | 14 | hb0085, hb0150, hb0232, hb0239, hb0277 |
| ROTT | 1.91 | ROTTER | 15 | hb0032, hb0063, hb0171, hb0181, hb0204 |
| THIR | 1.91 | THIRD | 2 | hb0147, hb0487 |
| TILER | 1.91 | TILE | 5 | hb0117, hb0147, hb0211, hb0291, hb0420 |
| TOMER | 1.91 | TOME | 3 | hb0240, hb0397, hb0553 |
| VENTE | 1.91 | VENTER | 4 | hb0037, hb0113, hb0171, hb0511 |
| AERATE | 1.90 | AERATED | 2 | hb0134, hb0264 |
| AFTE | 1.90 | AFTER | 8 | hb0021, hb0079, hb0116, hb0145, hb0381 |
| BEAV | 1.90 | BEAVER | 1 | hb0102 |
| BECH | 1.90 | BECHER | 1 | hb0379 |
| EITH | 1.90 | EITHER | 5 | hb0147, hb0149, hb0173, hb0291, hb0487 |
| FLEER | 1.90 | FLEE | 10 | hb0026, hb0169, hb0312, hb0317, hb0353 |
| HIRER | 1.90 | HIRE | 9 | hb0093, hb0100, hb0103, hb0149, hb0173 |
| INURE | 1.90 | INURED | 1 | hb0375 |
| JETTE | 1.90 | JETTED | 1 | hb0461 |
| LEVELER | 1.90 | LEVEL | 2 | hb0131, hb0415 |
| LOKER | 1.90 | LOKE | 1 | hb0376 |
| MIFF | 1.90 | MIFFED | 1 | hb0161 |
| PIERCER | 1.90 | PIERCE | 7 | hb0029, hb0094, hb0179, hb0191, hb0227 |
| PROVID | 1.90 | PROVIDED | 1 | hb0278 |
| PULPED | 1.90 | PULP | 1 | hb0234 |
| TEDD | 1.90 | TEDDER | 7 | hb0126, hb0134, hb0147, hb0211, hb0264 |
| BEANER | 1.89 | BEAN | 4 | hb0102, hb0217, hb0435, hb0471 |
| BLACKBALL | 1.89 | BLACKBALLED | 1 | hb0540 |
| BLOO | 1.89 | BLOOD | 3 | hb0130, hb0314, hb0370 |
| BRAINE | 1.89 | BRAINER | 1 | hb0213 |
| CONK | 1.89 | CONKER | 1 | hb0436 |
| ELLING | 1.89 | ELLE | 6 | hb0137, hb0256, hb0259, hb0344, hb0434 |
| FOYE | 1.89 | FOYER | 1 | hb0353 |
| FRIE | 1.89 | FRIED | 3 | hb0161, hb0313, hb0466 |
| HEELING | 1.89 | HEEL | 1 | hb0541 |
| HILLE | 1.89 | HILLER | 2 | hb0214, hb0580 |
| LEDER | 1.89 | LEDE | 2 | hb0314, hb0516 |
| MADDENED | 1.89 | MADDEN | 2 | hb0395, hb0404 |
| MEMB | 1.89 | MEMBER | 4 | hb0085, hb0232, hb0338, hb0593 |
| PEALING | 1.89 | PEAL | 1 | hb0137 |
| RAVAGER | 1.89 | RAVAGE | 1 | hb0530 |
| RECODED | 1.89 | RECODE | 1 | hb0425 |
| RUGG | 1.89 | RUGGED | 3 | hb0185, hb0194, hb0362 |
| TANER | 1.89 | TANE | 5 | hb0331, hb0350, hb0440, hb0520, hb0537 |
| TARTER | 1.89 | TART | 12 | hb0058, hb0079, hb0086, hb0116, hb0134 |
| TAVERNER | 1.89 | TAVERN | 1 | hb0037 |
| ANTH | 1.88 | ANTHER | 1 | hb0520 |
| BARNER | 1.88 | BARN | 4 | hb0102, hb0217, hb0284, hb0471 |
| BOBB | 1.88 | BOBBED | 2 | hb0377, hb0438 |
| BOTHE | 1.88 | BOTHER | 1 | hb0126 |
| CERNER | 1.88 | CERN | 18 | hb0025, hb0043, hb0049, hb0059, hb0103 |
| CRIBBED | 1.88 | CRIB | 1 | hb0139 |
| DELLER | 1.88 | DELL | 2 | hb0314, hb0516 |
| DETE | 1.88 | DETER | 7 | hb0126, hb0134, hb0147, hb0211, hb0264 |
| DIRECTO | 1.88 | DIRECTOR | 1 | hb0153 |
| ETCHER | 1.88 | ETCH | 2 | hb0149, hb0173 |
| GROPER | 1.88 | GROPE | 3 | hb0111, hb0174, hb0255 |
| LANER | 1.88 | LANE | 11 | hb0102, hb0114, hb0197, hb0214, hb0217 |
| OFFEN | 1.88 | OFFEND | 1 | hb0158 |
| OGLED | 1.88 | OGLE | 2 | hb0355, hb0432 |
| PEEPER | 1.88 | PEEP | 24 | hb0029, hb0048, hb0095, hb0111, hb0174 |
| PERMED | 1.88 | PERM | 5 | hb0150, hb0170, hb0462, hb0503, hb0508 |
| PLODDED | 1.88 | PLOD | 4 | hb0159, hb0298, hb0447, hb0516 |
| RAKER | 1.88 | RAKE | 8 | hb0084, hb0085, hb0122, hb0231, hb0250 |
| ROBER | 1.88 | ROBE | 8 | hb0084, hb0126, hb0148, hb0204, hb0281 |
| WINNE | 1.88 | WINNER | 2 | hb0068, hb0513 |
| WINNOW | 1.88 | WINNOWING | 1 | hb0406 |
| BLIN | 1.87 | BLIND | 1 | hb0499 |
| CURLE | 1.87 | CURLER | 2 | hb0205, hb0367 |
| DAPPLE | 1.87 | DAPPLED | 3 | hb0065, hb0298, hb0459 |
| ENVI | 1.87 | ENVIED | 1 | hb0228 |
| EXPLODER | 1.87 | EXPLODE | 1 | hb0516 |
| FAFFING | 1.87 | FAFF | 1 | hb0335 |
| GELDED | 1.87 | GELD | 6 | hb0346, hb0355, hb0412, hb0432, hb0459 |
| HARRER | 1.87 | HARR | 5 | hb0110, hb0198, hb0379, hb0480, hb0492 |
| HELLYER | 1.87 | HELLY | 1 | hb0283 |
| INTEN | 1.87 | INTEND | 5 | hb0292, hb0321, hb0461, hb0478, hb0595 |
| PINCE | 1.87 | PINCER | 2 | hb0179, hb0286 |
| TONNER | 1.87 | TONNE | 5 | hb0045, hb0171, hb0413, hb0440, hb0544 |
| TRIMER | 1.87 | TRIM | 5 | hb0175, hb0240, hb0337, hb0462, hb0512 |
| BOKER | 1.86 | BOKE | 1 | hb0532 |
| CEIL | 1.86 | CEILING | 1 | hb0301 |
| CONTINU | 1.86 | CONTINUING | 1 | hb0588 |
| EARTHER | 1.86 | EARTH | 1 | hb0480 |
| HARPE | 1.86 | HARPER | 1 | hb0095 |
| MACED | 1.86 | MACE | 2 | hb0261, hb0378 |
| MAGER | 1.86 | MAGE | 4 | hb0218, hb0239, hb0366, hb0437 |
| POOLER | 1.86 | POOL | 3 | hb0090, hb0447, hb0472 |
| PREMI | 1.86 | PREMIER | 3 | hb0048, hb0240, hb0462 |
| REHABBED | 1.86 | REHAB | 1 | hb0379 |
| TEAMER | 1.86 | TEAM | 5 | hb0058, hb0134, hb0337, hb0437, hb0575 |
| TEET | 1.86 | TEETER | 24 | hb0058, hb0116, hb0126, hb0134, hb0147 |
| TEMPTER | 1.86 | TEMPT | 3 | hb0048, hb0240, hb0503 |
| UNITER | 1.86 | UNIT | 1 | hb0578 |
| VENDER | 1.86 | VEND | 1 | hb0061 |
| WALLE | 1.86 | WALLER | 1 | hb0079 |
| YARDE | 1.86 | YARDER | 2 | hb0231, hb0316 |
| DOPER | 1.85 | DOPE | 8 | hb0089, hb0227, hb0309, hb0333, hb0447 |
| FERMENTER | 1.85 | FERMENT | 2 | hb0052, hb0512 |
| FLATTERER | 1.85 | FLATTER | 2 | hb0079, hb0381 |
| GANGER | 1.85 | GANG | 1 | hb0526 |
| MOOCHER | 1.85 | MOOCH | 1 | hb0340 |
| NACER | 1.85 | NACE | 9 | hb0043, hb0183, hb0253, hb0285, hb0388 |
| PEDIGREED | 1.85 | PEDIGREE | 1 | hb0089 |
| PELLING | 1.85 | PELL | 1 | hb0137 |
| PROCE | 1.85 | PROCEED | 1 | hb0227 |
| REVIVER | 1.85 | REVIVE | 13 | hb0037, hb0131, hb0191, hb0278, hb0306 |
| ROADER | 1.85 | ROAD | 4 | hb0035, hb0423, hb0438, hb0447 |
| TURNE | 1.85 | TURNER | 6 | hb0163, hb0166, hb0171, hb0172, hb0328 |
| ALOU | 1.84 | ALOUD | 1 | hb0298 |
| AVERRED | 1.84 | AVER | 2 | hb0269, hb0584 |
| CANDIE | 1.84 | CANDIED | 2 | hb0054, hb0157 |
| CONDER | 1.84 | COND | 1 | hb0436 |
| CRUELER | 1.84 | CRUEL | 2 | hb0205, hb0367 |
| DEBA | 1.84 | DEBAR | 2 | hb0035, hb0231 |
| DOWDING | 1.84 | DOWD | 1 | hb0406 |
| EERY | 1.84 | EERILY | 4 | hb0038, hb0420, hb0502, hb0566 |
| FLUFFER | 1.84 | FLUFF | 1 | hb0317 |
| HORDER | 1.84 | HORDE | 2 | hb0126, hb0584 |
| IMAGIN | 1.84 | IMAGINING | 3 | hb0152, hb0276, hb0504 |
| LIVERIED | 1.84 | LIVERY | 1 | hb0502 |
| MOUN | 1.84 | MOUND | 1 | hb0360 |
| PETT | 1.84 | PETTER | 9 | hb0029, hb0048, hb0066, hb0191, hb0229 |
| ROTHE | 1.84 | ROTHER | 4 | hb0126, hb0173, hb0320, hb0470 |
| WALLOWED | 1.84 | WALLOW | 1 | hb0076 |
| WEDD | 1.84 | WEDDED | 3 | hb0062, hb0398, hb0600 |
| ANGERER | 1.83 | ANGER | 1 | hb0526 |
| BOBBLED | 1.83 | BOBBLE | 1 | hb0314 |
| BONDE | 1.83 | BONDED | 2 | hb0377, hb0404 |
| CONTROLL | 1.83 | CONTROLLER | 1 | hb0059 |
| DEBARRED | 1.83 | DEBAR | 2 | hb0035, hb0231 |
| FLOO | 1.83 | FLOOR | 5 | hb0026, hb0057, hb0101, hb0353, hb0443 |
| HAGGLED | 1.83 | HAGGLE | 1 | hb0346 |
| HAIRIER | 1.83 | HAIRY | 1 | hb0247 |
| IMAG | 1.83 | IMAGING | 5 | hb0152, hb0218, hb0276, hb0366, hb0504 |
| MELLE | 1.83 | MELLER | 8 | hb0085, hb0203, hb0232, hb0257, hb0277 |
| PEOPL | 1.83 | PEOPLED | 3 | hb0159, hb0298, hb0447 |
| REPLACER | 1.83 | REPLACE | 1 | hb0539 |
| RINKER | 1.83 | RINK | 1 | hb0212 |
| ROIL | 1.83 | ROILING | 2 | hb0178, hb0302 |
| VEINING | 1.83 | VEIN | 2 | hb0131, hb0524 |
| WHITED | 1.83 | WHIT | 2 | hb0033, hb0399 |
| CARRI | 1.82 | CARRIED | 9 | hb0093, hb0139, hb0226, hb0306, hb0324 |
| CEDA | 1.82 | CEDAR | 1 | hb0515 |
| CHINNED | 1.82 | CHIN | 1 | hb0590 |
| DAGG | 1.82 | DAGGER | 1 | hb0530 |
| HOOTED | 1.82 | HOOT | 2 | hb0223, hb0251 |
| MENTO | 1.82 | MENTOR | 2 | hb0045, hb0553 |
| MOORER | 1.82 | MOOR | 9 | hb0090, hb0170, hb0239, hb0240, hb0305 |
| NEEDLED | 1.82 | NEEDLE | 6 | hb0065, hb0402, hb0444, hb0533, hb0576 |
| VALVED | 1.82 | VALVE | 2 | hb0269, hb0551 |
| WADER | 1.82 | WADE | 1 | hb0062 |
| WIEL | 1.82 | WIELD | 1 | hb0600 |
| ALLOTED | 1.81 | ALLOT | 1 | hb0529 |
| ALMON | 1.81 | ALMOND | 1 | hb0559 |
| ANCHO | 1.81 | ANCHOR | 1 | hb0446 |
| CORON | 1.81 | CORONER | 6 | hb0043, hb0059, hb0121, hb0138, hb0340 |
| DIVERTER | 1.81 | DIVERT | 1 | hb0487 |
| DIVINED | 1.81 | DIVINE | 1 | hb0228 |
| HERBED | 1.81 | HERB | 2 | hb0126, hb0379 |
| KNEEING | 1.81 | KNEE | 1 | hb0123 |
| MEMED | 1.81 | MEME | 6 | hb0150, hb0154, hb0170, hb0404, hb0551 |
| PIPELINING | 1.81 | PIPELINE | 1 | hb0137 |
| PROCURER | 1.81 | PROCURE | 1 | hb0583 |
| REGARDE | 1.81 | REGARDED | 1 | hb0530 |
| TATTLER | 1.81 | TATTLE | 6 | hb0058, hb0079, hb0114, hb0203, hb0283 |
| TEACHED | 1.81 | TEACH | 1 | hb0251 |
| ALLOTT | 1.80 | ALLOTTED | 1 | hb0529 |
| AUGE | 1.80 | AUGER | 2 | hb0028, hb0394 |
| BACHER | 1.80 | BACH | 1 | hb0379 |
| BALLOTED | 1.80 | BALLOT | 1 | hb0529 |
| BIRDER | 1.80 | BIRD | 1 | hb0139 |
| CANER | 1.80 | CANE | 9 | hb0043, hb0183, hb0253, hb0285, hb0388 |
| CHANCER | 1.80 | CHANCE | 2 | hb0285, hb0492 |
| DICER | 1.80 | DICE | 3 | hb0093, hb0139, hb0153 |
| LIMITE | 1.80 | LIMITED | 2 | hb0184, hb0445 |
| LIVENED | 1.80 | LIVEN | 1 | hb0576 |
| MACER | 1.80 | MACE | 2 | hb0277, hb0388 |
| MOATED | 1.80 | MOAT | 1 | hb0378 |
| MOONED | 1.80 | MOON | 2 | hb0553, hb0559 |
| NANNYING | 1.80 | NANNY | 2 | hb0055, hb0272 |
| OCCLUDE | 1.80 | OCCLUDED | 1 | hb0402 |
| PROPPER | 1.80 | PROP | 12 | hb0063, hb0090, hb0227, hb0242, hb0281 |
| PROVER | 1.80 | PROVE | 3 | hb0063, hb0308, hb0415 |
| RECKONER | 1.80 | RECKON | 1 | hb0436 |
| RICER | 1.80 | RICE | 20 | hb0093, hb0094, hb0103, hb0139, hb0149 |
| TELLIER | 1.80 | TELLY | 1 | hb0420 |
| VENTURER | 1.80 | VENTURE | 1 | hb0171 |
| WAREING | 1.80 | WARE | 1 | hb0513 |
| BALED | 1.79 | BALE | 5 | hb0144, hb0188, hb0314, hb0429, hb0529 |
| BINGER | 1.79 | BINGE | 1 | hb0303 |
| CANCE | 1.79 | CANCER | 9 | hb0043, hb0183, hb0253, hb0285, hb0388 |
| CONED | 1.79 | CONE | 5 | hb0261, hb0334, hb0377, hb0402, hb0436 |
| DENATURE | 1.79 | DENATURED | 1 | hb0328 |
| DIETED | 1.79 | DIET | 15 | hb0033, hb0066, hb0147, hb0153, hb0211 |
| EMPLOYE | 1.79 | EMPLOYER | 1 | hb0090 |
| EVADER | 1.79 | EVADE | 2 | hb0269, hb0584 |
| LOPER | 1.79 | LOPE | 4 | hb0090, hb0255, hb0447, hb0472 |
| PAROL | 1.79 | PAROLED | 1 | hb0447 |
| PEALED | 1.79 | PEAL | 3 | hb0065, hb0298, hb0459 |
| PEATED | 1.79 | PEAT | 3 | hb0066, hb0229, hb0571 |
| RAMM | 1.79 | RAMMED | 10 | hb0150, hb0239, hb0284, hb0337, hb0338 |
| REFERRER | 1.79 | REFER | 26 | hb0021, hb0025, hb0046, hb0050, hb0052 |
| REMAINER | 1.79 | REMAIN | 3 | hb0053, hb0096, hb0363 |
| TRIPPE | 1.79 | TRIPPER | 6 | hb0029, hb0048, hb0094, hb0191, hb0329 |
| VINTER | 1.79 | VINT | 2 | hb0037, hb0414 |
| WALKE | 1.79 | WALKER | 1 | hb0122 |
| WARRE | 1.79 | WARRING | 1 | hb0513 |
| AIRILY | 1.78 | AIRY | 3 | hb0038, hb0509, hb0596 |
| APPEN | 1.78 | APPEND | 3 | hb0333, hb0525, hb0572 |
| BIDED | 1.78 | BIDE | 3 | hb0139, hb0292, hb0499 |
| DEAFEN | 1.78 | DEAFENED | 1 | hb0151 |
| DITHERED | 1.78 | DITHER | 2 | hb0147, hb0487 |
| FEDERATE | 1.78 | FEDERATED | 3 | hb0021, hb0381, hb0586 |
| FRIA | 1.78 | FRIAR | 9 | hb0161, hb0335, hb0347, hb0372, hb0409 |
| GUIDER | 1.78 | GUIDE | 1 | hb0194 |
| LEAPER | 1.78 | LEAP | 3 | hb0095, hb0268, hb0539 |
| MENDER | 1.78 | MEND | 3 | hb0375, hb0395, hb0553 |
| RANIER | 1.78 | RANI | 5 | hb0053, hb0096, hb0213, hb0293, hb0409 |
| ROAMER | 1.78 | ROAM | 3 | hb0239, hb0338, hb0437 |
| TOBER | 1.78 | TOBE | 2 | hb0126, hb0281 |
| TRILLED | 1.78 | TRILL | 2 | hb0147, hb0211 |
| TWIGGED | 1.78 | TWIG | 1 | hb0399 |
| BROODER | 1.77 | BROOD | 1 | hb0438 |
| CAVER | 1.77 | CAVE | 3 | hb0104, hb0253, hb0324 |
| DEFEN | 1.77 | DEFEND | 2 | hb0158, hb0536 |
| EAGLED | 1.77 | EAGLE | 2 | hb0346, hb0459 |
| FIRME | 1.77 | FIRMED | 2 | hb0161, hb0512 |
| FLITTER | 1.77 | FLIT | 2 | hb0211, hb0312 |
| HARDENER | 1.77 | HARDEN | 1 | hb0492 |
| LAMELLA | 1.77 | LAMELLAR | 7 | hb0085, hb0203, hb0232, hb0257, hb0277 |
| LIKER | 1.77 | LIKE | 2 | hb0068, hb0233 |
| LORDED | 1.77 | LORD | 5 | hb0109, hb0314, hb0376, hb0447, hb0516 |
| NIBBLER | 1.77 | NIBBLE | 1 | hb0213 |
| PUTTE | 1.77 | PUTTED | 2 | hb0066, hb0202 |
| RAFFLED | 1.77 | RAFFLE | 2 | hb0050, hb0381 |
| REALER | 1.77 | REAL | 23 | hb0050, hb0079, hb0085, hb0102, hb0110 |
| ROBBE | 1.77 | ROBBER | 8 | hb0084, hb0126, hb0148, hb0204, hb0281 |
| TUNNELLED | 1.77 | TUNNEL | 1 | hb0146 |
| VERGED | 1.77 | VERGE | 2 | hb0315, hb0530 |
| WOODING | 1.77 | WOOD | 1 | hb0406 |
| CHEERIER | 1.76 | CHEERY | 1 | hb0247 |
| CREDITO | 1.76 | CREDITOR | 1 | hb0153 |
| CYCLER | 1.76 | CYCLE | 1 | hb0354 |
| KETTLER | 1.76 | KETTLE | 1 | hb0233 |
| LEATH | 1.76 | LEATHER | 2 | hb0203, hb0283 |
| MITTER | 1.76 | MITT | 4 | hb0175, hb0240, hb0337, hb0512 |
| MORTA | 1.76 | MORTAR | 6 | hb0196, hb0243, hb0369, hb0384, hb0437 |
| NAILER | 1.76 | NAIL | 3 | hb0053, hb0213, hb0293 |
| OFFE | 1.76 | OFFER | 6 | hb0101, hb0165, hb0274, hb0353, hb0365 |
| PARATROOP | 1.76 | PARATROOPER | 3 | hb0242, hb0281, hb0308 |
| PLOTT | 1.76 | PLOTTING | 1 | hb0465 |
| PRIE | 1.76 | PRIED | 6 | hb0227, hb0278, hb0309, hb0462, hb0466 |
| RATHE | 1.76 | RATHER | 1 | hb0480 |
| WHATEV | 1.76 | WHATEVER | 1 | hb0480 |
| AGRE | 1.75 | AGREED | 1 | hb0530 |
| BILLE | 1.75 | BILLER | 4 | hb0169, hb0213, hb0499, hb0514 |
| BLAD | 1.75 | BLADED | 5 | hb0144, hb0188, hb0314, hb0429, hb0529 |
| COOLE | 1.75 | COOLER | 3 | hb0026, hb0059, hb0402 |
| CORDE | 1.75 | CORDED | 1 | hb0425 |
| CRAVER | 1.75 | CRAVE | 3 | hb0104, hb0253, hb0324 |
| GIBBER | 1.75 | GIBBERING | 1 | hb0303 |
| GINGE | 1.75 | GINGER | 4 | hb0049, hb0111, hb0303, hb0410 |
| HUNTE | 1.75 | HUNTED | 1 | hb0287 |
| INTUITED | 1.75 | INTUIT | 1 | hb0146 |
| KAMER | 1.75 | KAME | 3 | hb0085, hb0122, hb0277 |
| LETTERE | 1.75 | LETTERED | 2 | hb0147, hb0211 |
| NEATE | 1.75 | NEATER | 5 | hb0331, hb0350, hb0440, hb0520, hb0537 |
| NETTE | 1.75 | NETTER | 23 | hb0045, hb0113, hb0123, hb0127, hb0171 |
| OPIN | 1.75 | OPINING | 3 | hb0177, hb0465, hb0573 |
| PAMP | 1.75 | PAMPER | 2 | hb0150, hb0491 |
| PILLA | 1.75 | PILLAR | 4 | hb0087, hb0095, hb0332, hb0539 |
| REARMED | 1.75 | REARM | 1 | hb0150 |
| TOTED | 1.75 | TOTE | 4 | hb0126, hb0223, hb0264, hb0518 |
| UNTI | 1.75 | UNTIED | 1 | hb0146 |
| ARMORING | 1.74 | ARMOR | 1 | hb0504 |
| BILKED | 1.74 | BILK | 1 | hb0499 |
| BLABBED | 1.74 | BLAB | 5 | hb0144, hb0188, hb0314, hb0429, hb0529 |
| DOERING | 1.74 | DOER | 1 | hb0142 |
| DRIE | 1.74 | DRIED | 13 | hb0089, hb0093, hb0103, hb0139, hb0153 |
| GIDDILY | 1.74 | GIDDY | 1 | hb0355 |
| GRAFTER | 1.74 | GRAFT | 1 | hb0116 |
| HARRIE | 1.74 | HARRIED | 4 | hb0093, hb0214, hb0247, hb0306 |
| INCHER | 1.74 | INCH | 1 | hb0049 |
| LANC | 1.74 | LANCER | 3 | hb0253, hb0301, hb0439 |
| LOLLED | 1.74 | LOLL | 7 | hb0076, hb0109, hb0298, hb0314, hb0376 |
| NURTURER | 1.74 | NURTURE | 6 | hb0163, hb0166, hb0171, hb0172, hb0328 |
| PERCEIVER | 1.74 | PERCEIVE | 1 | hb0191 |
| REEFING | 1.74 | REEF | 3 | hb0143, hb0303, hb0335 |
| TETER | 1.74 | TETE | 24 | hb0058, hb0116, hb0126, hb0134, hb0147 |
| TROLLER | 1.74 | TROLL | 4 | hb0026, hb0032, hb0204, hb0235 |
| BABBLER | 1.73 | BABBLE | 7 | hb0085, hb0102, hb0217, hb0219, hb0232 |
| CALVER | 1.73 | CALVE | 1 | hb0253 |
| DAMER | 1.73 | DAME | 1 | hb0150 |
| DROPED | 1.73 | DROP | 8 | hb0089, hb0227, hb0309, hb0333, hb0447 |
| ELOP | 1.73 | ELOPED | 3 | hb0159, hb0298, hb0447 |
| GOUR | 1.73 | GOURD | 3 | hb0185, hb0362, hb0401 |
| GOVERNO | 1.73 | GOVERNOR | 3 | hb0238, hb0315, hb0550 |
| GUTT | 1.73 | GUTTER | 2 | hb0394, hb0578 |
| LECHER | 1.73 | LECH | 1 | hb0580 |
| METEO | 1.73 | METEOR | 3 | hb0240, hb0397, hb0553 |
| NULLED | 1.73 | NULL | 5 | hb0034, hb0065, hb0146, hb0444, hb0576 |
| PANNE | 1.73 | PANNED | 3 | hb0333, hb0525, hb0572 |
| PERIO | 1.73 | PERIOD | 4 | hb0227, hb0278, hb0309, hb0573 |
| PINN | 1.73 | PINNER | 3 | hb0286, hb0341, hb0573 |
| RECITER | 1.73 | RECITE | 10 | hb0094, hb0149, hb0153, hb0173, hb0179 |
| REMOTER | 1.73 | REMOTE | 3 | hb0240, hb0397, hb0553 |
| RINDER | 1.73 | RIND | 4 | hb0103, hb0375, hb0431, hb0573 |
| ROUN | 1.73 | ROUND | 4 | hb0158, hb0362, hb0457, hb0493 |
| TROL | 1.73 | TROLLING | 1 | hb0302 |
| WOOLER | 1.73 | WOOL | 1 | hb0101 |
| BOUNDER | 1.72 | BOUND | 1 | hb0493 |
| DRIL | 1.72 | DRILLED | 2 | hb0313, hb0502 |
| DRIV | 1.72 | DRIVER | 2 | hb0278, hb0502 |
| FORDED | 1.72 | FORD | 2 | hb0365, hb0518 |
| FROGGING | 1.72 | FROG | 2 | hb0224, hb0430 |
| GLUEING | 1.72 | GLUE | 2 | hb0034, hb0259 |
| GOONER | 1.72 | GOON | 3 | hb0142, hb0178, hb0550 |
| GROOME | 1.72 | GROOMER | 1 | hb0239 |
| LATT | 1.72 | LATTER | 6 | hb0058, hb0079, hb0114, hb0203, hb0283 |
| LIBELED | 1.72 | LIBEL | 1 | hb0499 |
| LOOKE | 1.72 | LOOKED | 1 | hb0376 |
| MEINER | 1.72 | MEIN | 6 | hb0053, hb0096, hb0341, hb0363, hb0375 |
| NETH | 1.72 | NETHER | 2 | hb0212, hb0520 |
| OWNE | 1.72 | OWNER | 1 | hb0121 |
| REMEMBRANCER | 1.72 | REMEMBRANCE | 1 | hb0284 |
| REVERING | 1.72 | REVERE | 1 | hb0131 |
| RIMER | 1.72 | RIME | 10 | hb0053, hb0161, hb0175, hb0192, hb0240 |
| TREADED | 1.72 | TREAD | 2 | hb0134, hb0264 |
| VALO | 1.72 | VALOR | 2 | hb0235, hb0415 |
| WATTER | 1.72 | WATT | 2 | hb0079, hb0145 |
| BOLLER | 1.71 | BOLL | 2 | hb0314, hb0532 |
| DALLIED | 1.71 | DALLY | 1 | hb0527 |
| DELET | 1.71 | DELETED | 8 | hb0147, hb0184, hb0211, hb0236, hb0260 |
| EVOLV | 1.71 | EVOLVED | 2 | hb0109, hb0376 |
| GOVERNER | 1.71 | GOVERN | 3 | hb0238, hb0315, hb0550 |
| MILLIN | 1.71 | MILLINER | 1 | hb0053 |
| REMIXER | 1.71 | REMIX | 3 | hb0175, hb0192, hb0363 |
| REVENGER | 1.71 | REVENGE | 3 | hb0131, hb0238, hb0315 |
| RIGI | 1.71 | RIGID | 1 | hb0194 |
| TABL | 1.71 | TABLED | 2 | hb0188, hb0529 |
| TECHED | 1.71 | TECH | 1 | hb0251 |
| TEEMED | 1.71 | TEEM | 4 | hb0134, hb0223, hb0478, hb0553 |
| TORRI | 1.71 | TORRID | 4 | hb0080, hb0153, hb0361, hb0518 |
| TUFTE | 1.71 | TUFTED | 1 | hb0241 |
| WILLER | 1.71 | WILL | 2 | hb0347, hb0600 |
| ADDE | 1.70 | ADDED | 17 | hb0035, hb0151, hb0188, hb0231, hb0269 |
| ANNEAL | 1.70 | ANNEALED | 4 | hb0065, hb0137, hb0151, hb0269 |
| AWAR | 1.70 | AWARD | 4 | hb0042, hb0062, hb0206, hb0299 |
| BACKE | 1.70 | BACKER | 2 | hb0250, hb0540 |
| CADDIED | 1.70 | CADDIE | 3 | hb0054, hb0093, hb0139 |
| COLLER | 1.70 | COLL | 2 | hb0026, hb0059 |
| COMMEN | 1.70 | COMMEND | 1 | hb0261 |
| CREER | 1.70 | CREE | 27 | hb0025, hb0043, hb0059, hb0103, hb0104 |
| DABBLER | 1.70 | DABBLE | 1 | hb0314 |
| DANGED | 1.70 | DANG | 1 | hb0113 |
| DIMED | 1.70 | DIME | 4 | hb0154, hb0161, hb0551, hb0595 |
| DRAGGER | 1.70 | DRAG | 1 | hb0530 |
| DRAWED | 1.70 | DRAW | 2 | hb0042, hb0062 |
| FANN | 1.70 | FANNING | 1 | hb0335 |
| GANGE | 1.70 | GANGED | 2 | hb0113, hb0323 |
| KALER | 1.70 | KALE | 3 | hb0085, hb0122, hb0277 |
| KOLL | 1.70 | KOLLER | 1 | hb0376 |
| LAMED | 1.70 | LAME | 1 | hb0551 |
| LOOMER | 1.70 | LOOM | 2 | hb0090, hb0338 |
| NEUT | 1.70 | NEUTER | 6 | hb0163, hb0166, hb0171, hb0172, hb0328 |
| PELLER | 1.70 | PELL | 6 | hb0095, hb0255, hb0268, hb0286, hb0472 |
| PEPPE | 1.70 | PEPPER | 24 | hb0029, hb0048, hb0095, hb0111, hb0174 |
| RECOR | 1.70 | RECORD | 1 | hb0425 |
| REPELLER | 1.70 | REPEL | 7 | hb0095, hb0234, hb0255, hb0268, hb0286 |
| TALKE | 1.70 | TALKED | 1 | hb0236 |
| TYPER | 1.70 | TYPE | 1 | hb0288 |
| ABUTTED | 1.69 | ABUT | 1 | hb0417 |
| ADDLE | 1.69 | ADDLED | 15 | hb0065, hb0151, hb0188, hb0236, hb0269 |
| ARROWED | 1.69 | ARROW | 1 | hb0062 |
| BLEE | 1.69 | BLEED | 5 | hb0144, hb0314, hb0429, hb0482, hb0499 |
| BRECKER | 1.69 | BRECK | 2 | hb0250, hb0532 |
| CLAVER | 1.69 | CLAVE | 1 | hb0253 |
| COATE | 1.69 | COATED | 2 | hb0074, hb0378 |
| COVED | 1.69 | COVE | 2 | hb0074, hb0228 |
| EYELINE | 1.69 | EYELINER | 1 | hb0420 |
| GALLER | 1.69 | GALL | 2 | hb0028, hb0257 |
| GRIDER | 1.69 | GRID | 2 | hb0089, hb0194 |
| HAPPI | 1.69 | HAPPIER | 1 | hb0095 |
| MEDALED | 1.69 | MEDAL | 1 | hb0551 |
| NATT | 1.69 | NATTER | 5 | hb0331, hb0350, hb0440, hb0520, hb0537 |
| RECEIV | 1.69 | RECEIVER | 5 | hb0191, hb0306, hb0324, hb0348, hb0418 |
| TARTED | 1.69 | TART | 2 | hb0134, hb0264 |
| ADDUCE | 1.68 | ADDUCED | 6 | hb0334, hb0389, hb0417, hb0506, hb0515 |
| ARCADED | 1.68 | ARCADE | 1 | hb0515 |
| BERRIED | 1.68 | BERRI | 1 | hb0139 |
| DEGREED | 1.68 | DEGREE | 4 | hb0089, hb0194, hb0315, hb0530 |
| DINN | 1.68 | DINNER | 2 | hb0375, hb0573 |
| DODDER | 1.68 | DODD | 10 | hb0089, hb0109, hb0142, hb0376, hb0423 |
| EBBE | 1.68 | EBBED | 8 | hb0126, hb0144, hb0256, hb0303, hb0404 |
| MARLE | 1.68 | MARLER | 8 | hb0085, hb0203, hb0232, hb0257, hb0277 |
| NAMER | 1.68 | NAME | 6 | hb0096, hb0363, hb0388, hb0395, hb0537 |
| PEENING | 1.68 | PEEN | 3 | hb0111, hb0137, hb0410 |
| POPULA | 1.68 | POPULAR | 1 | hb0280 |
| RETCHED | 1.68 | RETCH | 1 | hb0574 |
| REVER | 1.68 | REVE | 17 | hb0032, hb0037, hb0063, hb0106, hb0131 |
| TREATER | 1.68 | TREAT | 13 | hb0058, hb0079, hb0086, hb0116, hb0134 |
| WAILER | 1.68 | WAIL | 1 | hb0347 |
| APPROVER | 1.67 | APPROVE | 2 | hb0308, hb0415 |
| BUNDER | 1.67 | BUND | 1 | hb0493 |
| CONNE | 1.67 | CONNER | 11 | hb0043, hb0059, hb0121, hb0138, hb0261 |
| DOORED | 1.67 | DOOR | 12 | hb0089, hb0109, hb0142, hb0315, hb0376 |
| DOWE | 1.67 | DOWER | 2 | hb0062, hb0398 |
| ENVIE | 1.67 | ENVIED | 1 | hb0228 |
| GAGING | 1.67 | GAGE | 1 | hb0323 |
| GROOVER | 1.67 | GROOVE | 4 | hb0238, hb0315, hb0550, hb0562 |
| INTONE | 1.67 | INTONED | 1 | hb0595 |
| LEERED | 1.67 | LEER | 4 | hb0050, hb0313, hb0314, hb0502 |
| LEGEN | 1.67 | LEGEND | 1 | hb0533 |
| LEVIE | 1.67 | LEVIED | 2 | hb0551, hb0576 |
| MINDE | 1.67 | MINDED | 2 | hb0375, hb0595 |
| PRIC | 1.67 | PRICED | 1 | hb0227 |
| RECKER | 1.67 | RECK | 4 | hb0149, hb0233, hb0250, hb0277 |
| RUINE | 1.67 | RUINED | 4 | hb0375, hb0411, hb0546, hb0578 |
| TENDERER | 1.67 | TENDER | 2 | hb0052, hb0424 |
| THITH | 1.67 | THITHER | 3 | hb0147, hb0291, hb0487 |
| TOOTED | 1.67 | TOOT | 3 | hb0223, hb0264, hb0518 |
| VICA | 1.67 | VICAR | 2 | hb0306, hb0348 |
| WANGER | 1.67 | WANG | 1 | hb0513 |
| APPEA | 1.66 | APPEAR | 8 | hb0086, hb0095, hb0268, hb0333, hb0343 |
| AUBER | 1.66 | AUBE | 3 | hb0217, hb0232, hb0494 |
| BLUNTER | 1.66 | BLUNT | 1 | hb0599 |
| CHANC | 1.66 | CHANCED | 2 | hb0492, hb0590 |
| FACER | 1.66 | FACE | 6 | hb0021, hb0198, hb0317, hb0458, hb0526 |
| GRAINING | 1.66 | GRAIN | 5 | hb0055, hb0071, hb0272, hb0504, hb0510 |
| LARCHER | 1.66 | LARCH | 2 | hb0110, hb0580 |
| NEEDE | 1.66 | NEEDED | 16 | hb0061, hb0113, hb0157, hb0158, hb0182 |
| PANN | 1.66 | PANNED | 3 | hb0333, hb0525, hb0572 |
| REVEALER | 1.66 | REVEAL | 4 | hb0102, hb0253, hb0269, hb0415 |
| TEARE | 1.66 | TEARED | 2 | hb0134, hb0264 |
| TELLE | 1.66 | TELLER | 11 | hb0026, hb0058, hb0114, hb0147, hb0203 |
| TREADER | 1.66 | TREAD | 2 | hb0134, hb0264 |
| WEENING | 1.66 | WEEN | 1 | hb0513 |
| WEEPER | 1.66 | WEEP | 2 | hb0274, hb0508 |
| BROO | 1.65 | BROOD | 3 | hb0112, hb0130, hb0438 |
| CANC | 1.65 | CANCER | 7 | hb0043, hb0183, hb0253, hb0285, hb0439 |
| CHIPP | 1.65 | CHIPPER | 2 | hb0029, hb0326 |
| CLAT | 1.65 | CLATTER | 1 | hb0307 |
| DIDDLED | 1.65 | DIDDLE | 5 | hb0184, hb0412, hb0527, hb0551, hb0576 |
| DUDER | 1.65 | DUDE | 6 | hb0166, hb0185, hb0328, hb0362, hb0466 |
| EMCEED | 1.65 | EMCEE | 2 | hb0154, hb0261 |
| ERRE | 1.65 | ERRED | 19 | hb0042, hb0050, hb0052, hb0103, hb0111 |
| GAITER | 1.65 | GAIT | 3 | hb0116, hb0218, hb0473 |
| GILLING | 1.65 | GILL | 2 | hb0259, hb0541 |
| GRIMER | 1.65 | GRIM | 2 | hb0218, hb0366 |
| MANER | 1.65 | MANE | 6 | hb0096, hb0363, hb0388, hb0395, hb0537 |
| MOTTER | 1.65 | MOTT | 3 | hb0240, hb0397, hb0553 |
| PEDALLED | 1.65 | PEDAL | 3 | hb0065, hb0298, hb0459 |
| RODDING | 1.65 | RODD | 2 | hb0142, hb0406 |
| ROKE | 1.65 | ROKER | 3 | hb0084, hb0305, hb0376 |
| RUTT | 1.65 | RUTTER | 10 | hb0134, hb0163, hb0171, hb0202, hb0204 |
| ADMIR | 1.64 | ADMIRED | 1 | hb0161 |
| BEAME | 1.64 | BEAMER | 5 | hb0085, hb0232, hb0276, hb0338, hb0404 |
| BOUN | 1.64 | BOUND | 2 | hb0377, hb0493 |
| COCOONING | 1.64 | COCOON | 3 | hb0392, hb0430, hb0588 |
| DERMER | 1.64 | DERM | 5 | hb0052, hb0150, hb0170, hb0462, hb0553 |
| DRON | 1.64 | DRONED | 8 | hb0061, hb0142, hb0158, hb0315, hb0406 |
| HEAV | 1.64 | HEAVED | 1 | hb0584 |
| LEEDER | 1.64 | LEED | 2 | hb0314, hb0516 |
| MAUND | 1.64 | MAUNDER | 1 | hb0395 |
| PLUNDERER | 1.64 | PLUNDER | 1 | hb0444 |
| RIFFED | 1.64 | RIFF | 2 | hb0161, hb0313 |
| TABO | 1.64 | TABOR | 3 | hb0281, hb0382, hb0451 |
| APPAL | 1.63 | APPALLED | 3 | hb0065, hb0298, hb0459 |
| BALDE | 1.63 | BALDER | 1 | hb0314 |
| BARER | 1.63 | BARE | 17 | hb0035, hb0084, hb0085, hb0102, hb0186 |
| BITT | 1.63 | BITTER | 1 | hb0117 |
| CALME | 1.63 | CALMER | 1 | hb0277 |
| CHID | 1.63 | CHIDED | 2 | hb0093, hb0590 |
| DAND | 1.63 | DANDER | 4 | hb0061, hb0269, hb0395, hb0515 |
| EVENTER | 1.63 | EVENT | 3 | hb0037, hb0171, hb0511 |
| FIEN | 1.63 | FIEND | 2 | hb0054, hb0536 |
| MEADER | 1.63 | MEAD | 1 | hb0150 |
| POOHED | 1.63 | POOH | 1 | hb0525 |
| RECLAIMER | 1.63 | RECLAIM | 1 | hb0374 |
| TROWER | 1.63 | TROW | 1 | hb0320 |
| TUTO | 1.63 | TUTOR | 9 | hb0080, hb0108, hb0163, hb0171, hb0208 |
| ACHER | 1.62 | ACHE | 6 | hb0110, hb0198, hb0247, hb0285, hb0379 |
| ADDL | 1.62 | ADDLED | 14 | hb0065, hb0151, hb0188, hb0236, hb0269 |
| ADOR | 1.62 | ADORED | 4 | hb0035, hb0423, hb0438, hb0447 |
| ARDO | 1.62 | ARDOR | 11 | hb0035, hb0080, hb0112, hb0130, hb0195 |
| BEATED | 1.62 | BEAT | 3 | hb0188, hb0417, hb0529 |
| BLOGG | 1.62 | BLOGGED | 1 | hb0432 |
| BRACER | 1.62 | BRACE | 4 | hb0186, hb0284, hb0307, hb0435 |
| CENTE | 1.62 | CENTER | 4 | hb0059, hb0172, hb0179, hb0244 |
| DEEMER | 1.62 | DEEM | 3 | hb0150, hb0170, hb0553 |
| EDUCAT | 1.62 | EDUCATED | 4 | hb0389, hb0417, hb0506, hb0567 |
| HAILER | 1.62 | HAIL | 1 | hb0580 |
| INNE | 1.62 | INNER | 20 | hb0049, hb0053, hb0068, hb0096, hb0111 |
| LATED | 1.62 | LATE | 7 | hb0151, hb0188, hb0236, hb0389, hb0475 |
| MINGING | 1.62 | MING | 4 | hb0152, hb0265, hb0276, hb0445 |
| MIXE | 1.62 | MIXER | 3 | hb0175, hb0192, hb0363 |
| NEWE | 1.62 | NEWER | 3 | hb0068, hb0121, hb0513 |
| POLED | 1.62 | POLE | 3 | hb0159, hb0298, hb0447 |
| RIMM | 1.62 | RIMMER | 9 | hb0053, hb0161, hb0175, hb0240, hb0337 |
| TRICKER | 1.62 | TRICK | 2 | hb0233, hb0467 |
| TYRED | 1.62 | TYRE | 1 | hb0316 |
| BEANED | 1.61 | BEAN | 4 | hb0144, hb0182, hb0404, hb0429 |
| BECHE | 1.61 | BECHER | 1 | hb0379 |
| CHAFER | 1.61 | CHAFE | 1 | hb0198 |
| CHATT | 1.61 | CHATTED | 1 | hb0251 |
| COINER | 1.61 | COIN | 1 | hb0138 |
| CRAPPIER | 1.61 | CRAPPIE | 1 | hb0539 |
| DEARE | 1.61 | DEARER | 7 | hb0035, hb0042, hb0050, hb0231, hb0269 |
| DEVOLVER | 1.61 | DEVOLVE | 2 | hb0109, hb0376 |
| GOUGER | 1.61 | GOUGE | 5 | hb0185, hb0255, hb0362, hb0394, hb0470 |
| GRILLER | 1.61 | GRILL | 1 | hb0517 |
| HARDE | 1.61 | HARDER | 3 | hb0379, hb0492, hb0584 |
| HONO | 1.61 | HONOR | 2 | hb0082, hb0340 |
| KENNE | 1.61 | KENNER | 3 | hb0068, hb0212, hb0436 |
| MAINING | 1.61 | MAIN | 3 | hb0152, hb0276, hb0504 |
| MODED | 1.61 | MODE | 7 | hb0154, hb0170, hb0246, hb0404, hb0425 |
| OFTENER | 1.61 | OFTEN | 1 | hb0440 |
| PRUNER | 1.61 | PRUNE | 4 | hb0411, hb0444, hb0572, hb0583 |
| RANTER | 1.61 | RANT | 6 | hb0181, hb0331, hb0350, hb0440, hb0520 |
| REPP | 1.61 | REPPED | 11 | hb0227, hb0279, hb0309, hb0333, hb0343 |
| BATTE | 1.60 | BATTED | 5 | hb0188, hb0219, hb0417, hb0494, hb0529 |
| BEVELING | 1.60 | BEVEL | 1 | hb0524 |
| CHAINE | 1.60 | CHAINED | 1 | hb0590 |
| DAUNTE | 1.60 | DAUNTED | 2 | hb0287, hb0328 |
| FIGUR | 1.60 | FIGURED | 1 | hb0194 |
| FINANC | 1.60 | FINANCED | 1 | hb0054 |
| HATTE | 1.60 | HATTED | 4 | hb0033, hb0127, hb0251, hb0480 |
| HELPE | 1.60 | HELPER | 1 | hb0095 |
| HILLING | 1.60 | HILL | 1 | hb0541 |
| KAYAKED | 1.60 | KAYAK | 1 | hb0231 |
| KILLE | 1.60 | KILLER | 2 | hb0068, hb0233 |
| LUPER | 1.60 | LUPE | 1 | hb0255 |
| MEEKE | 1.60 | MEEKER | 3 | hb0085, hb0122, hb0277 |
| PREENED | 1.60 | PREEN | 5 | hb0279, hb0333, hb0424, hb0444, hb0572 |
| RAMER | 1.60 | RAME | 14 | hb0085, hb0150, hb0232, hb0239, hb0277 |
| BEGINN | 1.59 | BEGINNING | 2 | hb0256, hb0303 |
| BLAKER | 1.59 | BLAKE | 1 | hb0085 |
| BREACHER | 1.59 | BREACH | 1 | hb0379 |
| CANNE | 1.59 | CANNER | 16 | hb0043, hb0157, hb0182, hb0183, hb0253 |
| COLER | 1.59 | COLE | 2 | hb0026, hb0059 |
| DEMANDE | 1.59 | DEMANDED | 2 | hb0395, hb0404 |
| DRIPPER | 1.59 | DRIP | 6 | hb0089, hb0227, hb0278, hb0309, hb0462 |
| ERRO | 1.59 | ERROR | 40 | hb0032, hb0063, hb0084, hb0090, hb0101 |
| FORG | 1.59 | FORGING | 2 | hb0224, hb0430 |
| GOGGLED | 1.59 | GOGGLE | 2 | hb0355, hb0432 |
| LADLED | 1.59 | LADLE | 15 | hb0065, hb0151, hb0188, hb0236, hb0269 |
| LAGG | 1.59 | LAGGING | 3 | hb0071, hb0346, hb0459 |
| LEANE | 1.59 | LEANED | 14 | hb0065, hb0102, hb0114, hb0137, hb0151 |
| REGAR | 1.59 | REGARD | 1 | hb0530 |
| RELEARNED | 1.59 | RELEARN | 1 | hb0269 |
| ROVED | 1.59 | ROVE | 5 | hb0109, hb0315, hb0376, hb0438, hb0584 |
| TABLER | 1.59 | TABLE | 1 | hb0219 |
| THUDDED | 1.59 | THUD | 1 | hb0223 |
| TIGE | 1.59 | TIGER | 5 | hb0116, hb0218, hb0291, hb0473, hb0562 |
| TOTTERED | 1.59 | TOTTER | 3 | hb0126, hb0264, hb0518 |
| TRUING | 1.59 | TRUE | 1 | hb0578 |
| WATERER | 1.59 | WATER | 2 | hb0079, hb0145 |
| BARG | 1.58 | BARGER | 1 | hb0084 |
| BOATED | 1.58 | BOAT | 1 | hb0529 |
| BODED | 1.58 | BODE | 4 | hb0126, hb0377, hb0404, hb0438 |
| CORER | 1.58 | CORE | 7 | hb0043, hb0059, hb0104, hb0173, hb0340 |
| DAUBE | 1.58 | DAUBED | 1 | hb0417 |
| FORTUNER | 1.58 | FORTUNE | 1 | hb0163 |
| HEAVER | 1.58 | HEAVE | 2 | hb0480, hb0584 |
| LAPPE | 1.58 | LAPPED | 3 | hb0065, hb0298, hb0459 |
| MAGING | 1.58 | MAGE | 1 | hb0276 |
| MEMER | 1.58 | MEME | 16 | hb0085, hb0150, hb0170, hb0192, hb0232 |
| PADD | 1.58 | PADDED | 5 | hb0229, hb0333, hb0343, hb0525, hb0572 |
| REPORTE | 1.58 | REPORTER | 5 | hb0063, hb0242, hb0281, hb0308, hb0503 |
| RERUNNING | 1.58 | RERUN | 2 | hb0546, hb0578 |
| RINGE | 1.58 | RINGER | 6 | hb0049, hb0111, hb0143, hb0303, hb0410 |
| WINGE | 1.58 | WINGER | 1 | hb0513 |
| BAILER | 1.57 | BAIL | 2 | hb0213, hb0514 |
| BUMBLED | 1.57 | BUMBLE | 1 | hb0482 |
| CHURCHER | 1.57 | CHURCH | 1 | hb0386 |
| DEANER | 1.57 | DEAN | 4 | hb0061, hb0269, hb0395, hb0515 |
| DEFEATER | 1.57 | DEFEAT | 3 | hb0021, hb0381, hb0586 |
| DIFFE | 1.57 | DIFFER | 2 | hb0161, hb0466 |
| DUBB | 1.57 | DUBBED | 2 | hb0482, hb0493 |
| GARAGED | 1.57 | GARAGE | 1 | hb0530 |
| LIBE | 1.57 | LIBER | 3 | hb0169, hb0213, hb0514 |
| LIVENING | 1.57 | LIVEN | 3 | hb0131, hb0259, hb0524 |
| MONER | 1.57 | MONE | 6 | hb0045, hb0121, hb0305, hb0340, hb0388 |
| MOOTING | 1.57 | MOOT | 1 | hb0152 |
| NAPP | 1.57 | NAPPED | 5 | hb0333, hb0520, hb0525, hb0537, hb0572 |
| REBELLE | 1.57 | REBELLED | 1 | hb0314 |
| TALLI | 1.57 | TALLIED | 1 | hb0475 |
| THEAT | 1.57 | THEATER | 1 | hb0480 |
| TWITTERER | 1.57 | TWITTER | 1 | hb0329 |
| COPI | 1.56 | COPIED | 1 | hb0227 |
| FALLE | 1.56 | FALLER | 5 | hb0079, hb0317, hb0372, hb0381, hb0449 |
| FIRER | 1.56 | FIRE | 18 | hb0046, hb0143, hb0161, hb0165, hb0220 |
| GREENED | 1.56 | GREEN | 1 | hb0315 |
| GRIEFING | 1.56 | GRIEF | 3 | hb0143, hb0303, hb0335 |
| HERNING | 1.56 | HERN | 1 | hb0049 |
| HILTER | 1.56 | HILT | 2 | hb0147, hb0291 |
| LARDED | 1.56 | LARD | 3 | hb0050, hb0269, hb0314 |
| MARRE | 1.56 | MARRED | 1 | hb0150 |
| NAPPE | 1.56 | NAPPED | 5 | hb0333, hb0520, hb0525, hb0537, hb0572 |
| NEWCOME | 1.56 | NEWCOMER | 1 | hb0121 |
| NOONER | 1.56 | NOON | 14 | hb0045, hb0061, hb0121, hb0138, hb0142 |
| PALLI | 1.56 | PALLID | 2 | hb0391, hb0548 |
| POURER | 1.56 | POUR | 2 | hb0185, hb0583 |
| TWITTED | 1.56 | TWIT | 2 | hb0033, hb0399 |
| WRONGING | 1.56 | WRONG | 1 | hb0406 |
| ANTING | 1.55 | ANTE | 1 | hb0323 |
| BEDD | 1.55 | BEDDED | 6 | hb0126, hb0144, hb0404, hb0429, hb0482 |
| CLEATED | 1.55 | CLEAT | 3 | hb0188, hb0236, hb0389 |
| CORRIDO | 1.55 | CORRIDOR | 3 | hb0153, hb0361, hb0425 |
| COTTE | 1.55 | COTTER | 2 | hb0059, hb0173 |
| COUPED | 1.55 | COUP | 1 | hb0159 |
| CROPP | 1.55 | CROPPED | 1 | hb0227 |
| DEEPE | 1.55 | DEEPER | 12 | hb0089, hb0227, hb0234, hb0279, hb0309 |
| DUELE | 1.55 | DUELING | 10 | hb0034, hb0065, hb0146, hb0184, hb0298 |
| EFFACE | 1.55 | EFFACED | 1 | hb0021 |
| FLATTED | 1.55 | FLAT | 3 | hb0151, hb0241, hb0381 |
| GAINE | 1.55 | GAINING | 1 | hb0323 |
| GALLED | 1.55 | GALL | 2 | hb0346, hb0459 |
| GRABBE | 1.55 | GRABBER | 1 | hb0084 |
| HERBER | 1.55 | HERB | 4 | hb0100, hb0126, hb0357, hb0379 |
| LITTL | 1.55 | LITTLER | 4 | hb0117, hb0147, hb0211, hb0291 |
| MONITO | 1.55 | MONITOR | 2 | hb0060, hb0136 |
| NERVED | 1.55 | NERVE | 3 | hb0061, hb0315, hb0424 |
| PARER | 1.55 | PARE | 9 | hb0086, hb0095, hb0268, hb0333, hb0343 |
| PROPP | 1.55 | PROPPING | 7 | hb0177, hb0227, hb0309, hb0333, hb0447 |
| TEATER | 1.55 | TEAT | 11 | hb0058, hb0079, hb0086, hb0116, hb0134 |
| TEETHER | 1.55 | TEETH | 8 | hb0126, hb0147, hb0149, hb0173, hb0291 |
| TOTT | 1.55 | TOTTER | 8 | hb0171, hb0216, hb0235, hb0242, hb0264 |
| TRUED | 1.55 | TRUE | 3 | hb0134, hb0166, hb0328 |
| WEATH | 1.55 | WEATHER | 1 | hb0480 |
| ALLURED | 1.54 | ALLURE | 1 | hb0050 |
| BATTERER | 1.54 | BATTER | 3 | hb0219, hb0383, hb0494 |
| BRACHER | 1.54 | BRACH | 1 | hb0379 |
| CAGER | 1.54 | CAGE | 5 | hb0043, hb0104, hb0285, hb0324, hb0526 |
| CAREERED | 1.54 | CAREER | 1 | hb0515 |
| CARRING | 1.54 | CARR | 2 | hb0272, hb0510 |
| CHARG | 1.54 | CHARGER | 1 | hb0285 |
| COOPE | 1.54 | COOPED | 2 | hb0159, hb0227 |
| DALER | 1.54 | DALE | 2 | hb0269, hb0314 |
| DEVILLED | 1.54 | DEVIL | 2 | hb0551, hb0576 |
| FEINTED | 1.54 | FEINT | 1 | hb0321 |
| GUIL | 1.54 | GUILD | 1 | hb0034 |
| HEFTED | 1.54 | HEFT | 1 | hb0586 |
| HOOFER | 1.54 | HOOF | 1 | hb0365 |
| LADER | 1.54 | LADE | 2 | hb0269, hb0314 |
| MITRED | 1.54 | MITRE | 1 | hb0462 |
| PEPP | 1.54 | PEPPER | 24 | hb0029, hb0048, hb0095, hb0111, hb0174 |
| REEDE | 1.54 | REEDER | 15 | hb0042, hb0050, hb0052, hb0089, hb0103 |
| REEDED | 1.54 | REED | 16 | hb0042, hb0050, hb0052, hb0089, hb0103 |
| REEFED | 1.54 | REEF | 8 | hb0021, hb0050, hb0052, hb0313, hb0365 |
| TENO | 1.54 | TENOR | 5 | hb0045, hb0171, hb0413, hb0440, hb0544 |
| VERGEER | 1.54 | VERGE | 5 | hb0131, hb0238, hb0315, hb0530, hb0562 |
| AGITATO | 1.53 | AGITATOR | 1 | hb0403 |
| ANTED | 1.53 | ANTE | 5 | hb0113, hb0127, hb0151, hb0287, hb0400 |
| BELIEV | 1.53 | BELIEVING | 1 | hb0524 |
| BETROTH | 1.53 | BETROTHED | 1 | hb0126 |
| BLAN | 1.53 | BLAND | 2 | hb0144, hb0429 |
| BUNTE | 1.53 | BUNTER | 1 | hb0599 |
| CANTE | 1.53 | CANTED | 2 | hb0400, hb0506 |
| CRIE | 1.53 | CRIED | 20 | hb0093, hb0094, hb0103, hb0139, hb0149 |
| DEBAT | 1.53 | DEBATED | 3 | hb0188, hb0417, hb0529 |
| FERRETED | 1.53 | FERRET | 5 | hb0021, hb0052, hb0211, hb0381, hb0586 |
| GART | 1.53 | GARTER | 6 | hb0058, hb0116, hb0218, hb0394, hb0437 |
| LOGG | 1.53 | LOGGER | 5 | hb0178, hb0302, hb0355, hb0432, hb0465 |
| RIFTED | 1.53 | RIFT | 1 | hb0211 |
| RODER | 1.53 | RODE | 14 | hb0089, hb0109, hb0126, hb0142, hb0315 |
| TACKER | 1.53 | TACK | 1 | hb0250 |
| TULLER | 1.53 | TULLE | 1 | hb0114 |
| VENE | 1.53 | VENEER | 6 | hb0037, hb0061, hb0106, hb0131, hb0238 |
| BLEATED | 1.52 | BLEAT | 2 | hb0188, hb0529 |
| CARLIER | 1.52 | CARLIE | 5 | hb0226, hb0348, hb0374, hb0514, hb0580 |
| COPIE | 1.52 | COPIED | 1 | hb0227 |
| DIEMER | 1.52 | DIEM | 1 | hb0161 |
| FREEZ | 1.52 | FREEZER | 1 | hb0143 |
| GUNT | 1.52 | GUNTER | 1 | hb0578 |
| KIRKER | 1.52 | KIRK | 1 | hb0233 |
| LANED | 1.52 | LANE | 3 | hb0065, hb0151, hb0269 |
| PIND | 1.52 | PINDER | 1 | hb0573 |
| PLODDER | 1.52 | PLOD | 2 | hb0447, hb0516 |
| PRATE | 1.52 | PRATER | 1 | hb0086 |
| PUDDLED | 1.52 | PUDDLE | 5 | hb0065, hb0159, hb0234, hb0298, hb0459 |
| RECHARGER | 1.52 | RECHARGE | 1 | hb0285 |
| UPGRADER | 1.52 | UPGRADE | 1 | hb0343 |
| APPALL | 1.51 | APPALLED | 3 | hb0065, hb0298, hb0459 |
| CHATTE | 1.51 | CHATTED | 1 | hb0251 |
| DANDE | 1.51 | DANDER | 4 | hb0061, hb0269, hb0395, hb0515 |
| DIPP | 1.51 | DIPPED | 5 | hb0089, hb0227, hb0278, hb0309, hb0573 |
| FREEE | 1.51 | FREEING | 3 | hb0143, hb0303, hb0335 |
| FULLED | 1.51 | FULL | 1 | hb0241 |
| KINKING | 1.51 | KINK | 1 | hb0123 |
| LIBELLED | 1.51 | LIBEL | 1 | hb0499 |
| MAINER | 1.51 | MAIN | 3 | hb0053, hb0096, hb0363 |
| MANIER | 1.51 | MANI | 3 | hb0053, hb0096, hb0363 |
| MITTING | 1.51 | MITT | 3 | hb0152, hb0336, hb0445 |
| MODELE | 1.51 | MODELED | 2 | hb0154, hb0559 |
| NAVED | 1.51 | NAVE | 3 | hb0061, hb0113, hb0269 |
| PATTE | 1.51 | PATTED | 4 | hb0066, hb0086, hb0229, hb0571 |
| PLANN | 1.51 | PLANNED | 1 | hb0065 |
| PREMIE | 1.51 | PREMIER | 3 | hb0048, hb0240, hb0462 |
| REBELL | 1.51 | REBELLED | 1 | hb0314 |
| REVENGING | 1.51 | REVENGE | 1 | hb0131 |
| TALER | 1.51 | TALE | 6 | hb0058, hb0079, hb0114, hb0203, hb0283 |
| TIERE | 1.51 | TIERED | 6 | hb0147, hb0153, hb0211, hb0462, hb0467 |
| TILLE | 1.51 | TILLER | 9 | hb0117, hb0147, hb0184, hb0211, hb0260 |
| TYRER | 1.51 | TYRE | 10 | hb0032, hb0063, hb0181, hb0192, hb0288 |
| BERNING | 1.50 | BERNE | 1 | hb0303 |
| DEPORTE | 1.50 | DEPORTED | 1 | hb0503 |
| DUNNER | 1.50 | DUNNE | 7 | hb0158, hb0328, hb0362, hb0375, hb0395 |
| FRIEDER | 1.50 | FRIED | 3 | hb0161, hb0313, hb0466 |
| GROUN | 1.50 | GROUND | 1 | hb0362 |
| GULLED | 1.50 | GULL | 3 | hb0034, hb0346, hb0459 |
| HULLE | 1.50 | HULLED | 1 | hb0346 |
| MITERED | 1.50 | MITER | 1 | hb0462 |
| MORTER | 1.50 | MORT | 2 | hb0240, hb0553 |
| PARRED | 1.50 | PARR | 3 | hb0333, hb0343, hb0572 |
| PIPP | 1.50 | PIPPED | 4 | hb0227, hb0278, hb0309, hb0573 |
| PLAI | 1.50 | PLAID | 2 | hb0391, hb0548 |
| REVILING | 1.50 | REVILE | 1 | hb0131 |
| RUTHER | 1.50 | RUTH | 1 | hb0386 |
| TOTALE | 1.50 | TOTALED | 1 | hb0529 |
| TROVER | 1.50 | TROVE | 11 | hb0032, hb0063, hb0171, hb0235, hb0264 |
| WAINER | 1.50 | WAIN | 1 | hb0513 |
| WEEDER | 1.50 | WEED | 3 | hb0062, hb0398, hb0600 |
| WHEATER | 1.50 | WHEAT | 1 | hb0480 |

## 3. Likely false positives (for a human to strike; not removed)

- **Proper nouns and surnames** (wordfreq scores names highly): MATT, PENN, PITT, CARRIE, WEBB, GREENE, MANN, MAYO, BART, MARTY, ROTH, LOWE, LEVI, WEIR, BARR, WILDE, BROWNE, DOWNING, ROWE, POOLE, ROCHE, MARIN, ROBB, HELLER, KELLER, GELLER, GUNN, GREER, GROVER, TENN, HORNE, KEENE, FRYE, CRAMER, REINER, TRIPP, BEECHER, WINKLER, TOURE, CONDON, WARNE, PIETER, READE, GARBER, VIGO, MOORE, FINN,
- **Name or word fragments and non-words**: ALLI, ALLE, BETTE, BABI, TREN, TRAC, ROUN, MOUN, DOLLA, GOVERNO, METEO, PEOPL, WHATEV, CANC, LITTL, DRIV, FREEZ, PRIC, EVOLV, TABL, RECEIV, AWAR, DIFFE, LOOKE, CONTINU, PROVID, NATUR, HEAV, BEGINN, CHANC, DEFEN, IMAG, FRIA, GIDDILY, GROUN, RECOR, REGAR, RINGE, TEATER, THEAT, TEET, TELLE, TOTT, ELOP, PINN, PANN, NETH, EITH, THIR, ALMON, ANCHO, CORON, DEBA, GOUR, TROL, DRIL,
- **Offensive or crude (should not be auto-added; a content call for a human)**: DAMN, RAPE, RAPER (also accepted in some live puzzle, see below), BONER, POOPING, POOPER, FRIGGING, DEFECATED, CRAPPIER, DAMMED/DAMM, BUTCH, LECHER.
- **British doubled-L spellings** (Brian's American-spelling rule; word lists are exempt in the memory, so this is a strike decision): LABELLED, CANCELLING, MODELLED, LEVELLED, REPELLED, TOTALLED, LEVELLING, PANELLED, BARRELLED, REVELLED, REVELLING, LIBELLED, DEVILLED, PEDALLED, TUNNELLED, LEVELLER, REPELLER, TRILLED. No -OUR, -RE or -ISE hits in the table.
- **Abbreviations or clipped forms**: DIFF, TRAD, MERC, LUBE, OLDE, LEMME, DOGG, BRIE, CHAI, FRAU, DECO, COLO, MOTO, CONG, TERRI, ALTA, PORTE, BETTE, CALLE, DONO, GATO, FETE, PEGG.
- **Accepted-list issue spotted while tracing sources**: RAPER appears in live accepted lists (source of the RAPE candidate). RAPER is accepted in 9 live puzzles (hb0086, hb0095, hb0268, hb0333, hb0343, hb0491, hb0507, hb0539, hb0572), which is a content call for a human. The scan treats accepted words as ground truth and did not audit them.

