# Hubbub everyday-word audit

Generated 2026-10-09 by `scripts/puzzles/hubbub-audit.mjs` (Friday queue item 33). **Report only** — the bank is untouched; the proposed patch is `hubbub-additions.json` beside this file.

Scope: dailies from 2026-10-09 (index 16, hb0017) to hb0400 (385 puzzles) plus the 200 Unlimited puzzles. Sources: wordfreq (offline, Zipf ≥ 1.9) cross-checked against the lexicon tiers, /usr/share/dict/words, word-definitions.json, the Wordle and Ladder lists and the modern/accept lists; regular derivations of dictionary words count; words no dictionary knows need Zipf ≥ 2.5 and are flagged **review**. Blocklists, offensive roots and British spellings excluded. "Main" = Zipf ≥ 2.5 (a knob: `--main-zipf`); the rest go to bonus. Zipf 3 ≈ once per million words; 2 ≈ once per ten million.

## Summary

| | Puzzles | With gaps | Main-list adds | Bonus adds | Review (uncorroborated) |
|---|---|---|---|---|---|
| Dailies from today | 385 | 216 | 193 | 355 | 5235 |
| Unlimited pool | 200 | 102 | 94 | 201 | 2747 |

### Known reports

| Word | Zipf | Fits puzzle(s) | Status |
|---|---|---|---|
| RECOLLECT | 2.69 | hb0016 (day 15, 2026-10-08), hb0026 (day 25, 2026-10-18), hb0059 (day 58, 2026-11-20) | MISSING, MISSING, MISSING |
| RECYCLER | 2.12 | hb0016 (day 15, 2026-10-08), hb0354 (day 353, 2027-09-11) | MISSING, MISSING |
| REELECT | 1.91 | hb0016 (day 15, 2026-10-08), hb0026 (day 25, 2026-10-18), hb0059 (day 58, 2026-11-20), hb0307 (day 306, 2027-07-26), hb0354 (day 353, 2027-09-11) | MISSING, MISSING, MISSING, MISSING, MISSING |
| AUNTY | 3.16 | hb0490 (Unlimited) | MISSING |
| FUTON | 2.56 | hb0017 (day 16, 2026-10-09), hb0163 (day 162, 2027-03-04) | MISSING, MISSING |

### Most common missing words (across all audited puzzles, dictionary-backed)

REFERRED 4.61 ×8 _(derived from REFER)_ · CONTINUING 4.48 ×1 _(derived from CONTINUE)_ · MANAGING 4.4 ×3 _(derived from MANAGE)_ · REFERRING 4.35 ×3 _(derived from REFER)_ · ARRIVING 4.16 ×1 _(derived from ARRIVE)_ · IGNORING 4.04 ×8 _(derived from IGNORE)_ · EMBEDDED 3.89 ×2 _(derived from EMBED)_ · NEGOTIATING 3.78 ×1 _(derived from NEGOTIATE)_ · EXPELLED 3.7 ×1 _(derived from EXPEL)_ · IMAGINING 3.65 ×3 _(derived from IMAGINE)_ · NOTICING 3.64 ×2 _(derived from NOTICE)_ · DONATING 3.59 ×1 _(derived from DONATE)_ · ARRANGING 3.55 ×5 _(derived from ARRANGE)_ · PROPELLED 3.48 ×2 _(derived from PROPEL)_ · ALLEGING 3.47 ×1 _(derived from ALLEGE)_ · OVERHEARD 3.4 ×1 _(derived from OVERHEAR)_ · INITIATING 3.38 ×4 _(derived from INITIATE)_ · FLICKR 3.33 ×1 _(derived from FLICK)_ · ALLOTTED 3.28 ×1 _(derived from ALLOT)_ · NUANCED 3.26 ×4 _(derived from NUANCE)_ · GROVER 3.22 ×4 _(derived from GROVE)_ · NURTURING 3.22 ×1 _(derived from NURTURE)_ · EMITTING 3.21 ×1 _(derived from EMIT)_ · IMITATING 3.2 ×2 _(derived from IMITATE)_ · NOMINATING 3.2 ×1 _(derived from NOMINATE)_ · PREPPING 3.18 ×2 _(derived from PREP)_ · CICERO 3.18 ×3 _(definitions)_ · INCITING 3.17 ×5 _(derived from INCITE)_ · MITIGATING 3.14 ×2 _(derived from MITIGATE)_ · GOOGLED 3.14 ×2 _(definitions)_ · REDNECK 3.13 ×1 _(definitions)_ · RECITING 3.12 ×1 _(derived from RECITE)_ · GENDERED 3.08 ×1 _(derived from GENDER)_ · NAGAR 3.07 ×6 _(derived from NAGA)_ · INFRINGING 3.07 ×2 _(derived from INFRINGE)_ · NATURED 3.03 ×1 _(derived from NATURE)_ · POOPING 3.01 ×3 _(derived from POOP)_ · GOOGLING 3.01 ×3 _(derived from GOOGLE)_ · REPELLED 2.98 ×1 _(derived from REPEL)_ · ANNULLED 2.95 ×2 _(derived from ANNUL)_ · REBELLED 2.95 ×1 _(derived from REBEL)_ · REUNITING 2.95 ×1 _(derived from REUNITE)_ · HEROD 2.94 ×2 _(derived from HERO)_ · RETWEETED 2.94 ×1 _(derived from TWEETED)_ · CRAMER 2.93 ×4 _(derived from CRAM)_ · PREPPED 2.91 ×13 _(derived from PREP)_ · DETERRED 2.9 ×11 _(derived from DETER)_ · TROTTING 2.9 ×2 _(derived from TROT)_ · OMITTING 2.88 ×1 _(derived from OMIT)_ · OVERTHREW 2.88 ×1 _(derived from THREW)_ · INCURRING 2.88 ×1 _(derived from INCUR)_ · BEECHER 2.87 ×2 _(derived from BEECH)_ · MINGLING 2.86 ×2 _(derived from MINGLE)_ · ERODING 2.85 ×1 _(derived from ERODE)_ · WINKLER 2.84 ×1 _(derived from WINKLE)_ · RELIVING 2.84 ×1 _(derived from RELIVE)_ · REENTRY 2.83 ×3 _(derived from ENTRY)_ · IGNITING 2.8 ×5 _(derived from IGNITE)_ · UNCOOL 2.79 ×1 _(derived from COOL)_ · HONING 2.79 ×1 _(derived from HONE)_

### Most frequent REVIEW words (no dictionary backs them — names, brands, slang, loanwords; not in the patch)

GONNA 5.29 ×14 · INTERNET 5.06 ×6 · EUROPE 5.04 ×3 · WANNA 5.04 ×1 · GOTTA 4.95 ×7 · AFRICA 4.92 ×3 · OBAMA 4.86 ×4 · OREGON 4.3 ×6 · CAMERON 4.26 ×1 · ONTARIO 4.21 ×1 · HAWAII 4.21 ×1 · TIMELINE 4.15 ×2 · PUTIN 4.13 ×2 · GENTLEMEN 4.13 ×1 · ARABIA 4.12 ×8 · CONNECTICUT 4.11 ×1 · OUTTA 4.1 ×3 · NINTENDO 4.08 ×1 · INTEL 4.07 ×8 · HANNAH 4.05 ×6 · CLARKE 4.05 ×1 · WALLACE 4.05 ×1 · MEANTIME 4.04 ×2 · BENNETT 4.03 ×5 · NICOLE 3.99 ×3 · LAUREN 3.98 ×3 · BARACK 3.96 ×1 · TOYOTA 3.95 ×2 · REAGAN 3.95 ×1 · PERTH 3.93 ×1 · TAMPA 3.92 ×3 · NIXON 3.91 ×2 · MONROE 3.89 ×6 · GARCIA 3.89 ×2 · LANKA 3.89 ×1 · FERRARI 3.88 ×7 · BIDEN 3.86 ×3 · MILTON 3.84 ×1 · ROBBIE 3.84 ×2 · NOBEL 3.84 ×1

### Why these were missing

- `words`/`bonus` were frozen from lexicon-all.json (21k common + 23k extended) and widened once from Webster's Second (1934) + 385 curated modern words. Everyday derivations (RECYCLER, REELECT), loanwords (FUTON) and compounds younger than 1934 fall through; obscure 1934 entries (CERCELEE, CEORL) stay because they are in web2.
- The cloud 05b everyday-words fix (AUNT/AUNTY/UNCLE guard) is not on this branch: AUNTY is still missing from hb0490 (Unlimited).

## Dailies

### hb0016 — day 15 (2026-10-08) · letters LCEORTY (center L) · 35 words / 139 bonus · max 157

- **Main-list worthy** (+9 max): RECOLLECT 2.69
- Bonus: RECYCLER 2.12, CELLER 1.95, REELECT 1.91
- Review (no dictionary backs these; not in the patch): TERRELL 2.98 (uncorroborated); TYRELL 2.94 (uncorroborated); COOLEY 2.93 (uncorroborated); COLETTE 2.92 (uncorroborated); COYLE 2.85 (uncorroborated); LEYTE 2.76 (uncorroborated); TYROL 2.68 (uncorroborated); LECLERC 2.62 (uncorroborated); ELLERY 2.61 (uncorroborated); ELLER 2.59 (wordle-lists only); TELCO 2.59 (uncorroborated); LOLOL 2.58 (uncorroborated); COLLETTE 2.57 (uncorroborated); TYRRELL 2.57 (uncorroborated); LYELL 2.56 (uncorroborated); LECTER 2.52 (uncorroborated); COTTRELL 2.51 (uncorroborated)

### hb0017 — day 16 (2026-10-09) · letters TCFINOU (center T) · 24 words / 74 bonus · max 113

- **Main-list worthy** (+5 max): FUTON 2.56
- Review (no dictionary backs these; not in the patch): INUIT 2.95 (uncorroborated); CONTI 2.8 (uncorroborated); INFINITI 2.76 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); TINTO 2.63 (uncorroborated)

### hb0018 — day 17 (2026-10-10) · letters ADEINTU (center A) · 39 words / 225 bonus · max 200

- Review (no dictionary backs these; not in the patch): NADINE 3.26 (uncorroborated); ANAND 3.1 (uncorroborated); TENNANT 3.09 (uncorroborated); TATIANA 3.07 (uncorroborated); AIDEN 3.06 (uncorroborated); DIANNE 3 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); DEANNA 2.85 (uncorroborated); DETAINEE 2.85 (uncorroborated); EATIN 2.76 (uncorroborated); ATTENDEE 2.72 (uncorroborated); AUDEN 2.65 (uncorroborated); NAIDU 2.56 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0019 — day 18 (2026-10-11) · letters IACNPRT (center I) · 26 words / 226 bonus · max 121

- Review (no dictionary backs these; not in the patch): RICAN 3.43 (uncorroborated); TATIANA 3.07 (uncorroborated); ATARI 2.98 (uncorroborated); NARNIA 2.93 (uncorroborated); CATANIA 2.9 (uncorroborated); RICCI 2.88 (uncorroborated); TRIPP 2.88 (uncorroborated); PARTI 2.77 (uncorroborated); ATTICA 2.74 (uncorroborated); INNIT 2.74 (uncorroborated); TRIPPIN 2.71 (uncorroborated); ICANN 2.7 (uncorroborated); TINTIN 2.7 (uncorroborated); ARIANNA 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); PRAIA 2.64 (uncorroborated); NAIRA 2.63 (uncorroborated); CIARAN 2.53 (uncorroborated); TIRANA 2.51 (uncorroborated)

### hb0020 — day 19 (2026-10-12) · letters NBCDEIO (center N) · 42 words / 107 bonus · max 179

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): BIDEN 3.86 (uncorroborated); NOONE 3.08 (uncorroborated); BIONIC 2.96 (wordle-lists only); BONDI 2.96 (uncorroborated); NOOOO 2.82 (uncorroborated); CINCO 2.81 (uncorroborated); DONNED 2.8 (wordle-lists only); CONDON 2.79 (uncorroborated); CONDE 2.77 (uncorroborated); BENNIE 2.73 (wordle-lists only); INDIO 2.69 (uncorroborated); BONNE 2.67 (uncorroborated); NOOOOO 2.63 (uncorroborated); DIONNE 2.58 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0021 — day 20 (2026-10-13) · letters FACDERT (center F) · 46 words / 116 bonus · max 206

- **Main-list worthy** (+8 max): REFERRED 4.61
- Bonus: FAREED 2.31, DEFECATED 1.94, EFFACED 1.91
- Review (no dictionary backs these; not in the patch): FEDERER 3.22 (uncorroborated); FERRER 3 (uncorroborated); FARRAR 2.88 (uncorroborated); ARAFAT 2.86 (uncorroborated); FARTED 2.78 (wordle-lists only)

### hb0022 — day 21 (2026-10-14) · letters RAILNOT (center R) · 41 words / 236 bonus · max 214

- Review (no dictionary backs these; not in the patch): ONTARIO 4.21 (uncorroborated); NORTON 3.75 (uncorroborated); ROLLIN 3.11 (uncorroborated); RONAN 3.06 (uncorroborated); TARANTINO 3.04 (uncorroborated); ATARI 2.98 (uncorroborated); RATON 2.96 (uncorroborated); NARNIA 2.93 (uncorroborated); TORINO 2.87 (uncorroborated); TARRANT 2.78 (uncorroborated); RONIN 2.77 (uncorroborated); TROTT 2.77 (uncorroborated); ARRAN 2.69 (uncorroborated); ARIANNA 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); NAIRA 2.63 (uncorroborated); TRAINOR 2.61 (uncorroborated); RIALTO 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); LORAIN 2.56 (uncorroborated); RITALIN 2.53 (uncorroborated); TIRANA 2.51 (uncorroborated)

### hb0023 — day 22 (2026-10-15) · letters OABDGIN (center O) · 20 words / 135 bonus · max 86

- Bonus: NONBINDING 1.96
- Review (no dictionary backs these; not in the patch): GONNA 5.29 (wordle-lists only); BANNON 3.12 (uncorroborated); BONDI 2.96 (uncorroborated); GABON 2.92 (uncorroborated); NOONAN 2.85 (uncorroborated); GANNON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); ABINGDON 2.79 (uncorroborated); BOING 2.74 (wordle-lists only); DONNING 2.74 (wordle-lists only); INDIO 2.69 (uncorroborated); NOIDA 2.69 (uncorroborated); DOGGING 2.68 (wordle-lists only); ADDON 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); BOGDAN 2.62 (uncorroborated); GODIN 2.6 (uncorroborated); NAGANO 2.6 (uncorroborated); BADOO 2.52 (uncorroborated); GAGNON 2.51 (uncorroborated)

### hb0024 — day 23 (2026-10-16) · letters NCEILOX (center N) · 27 words / 100 bonus · max 104

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): NICOLE 3.99 (uncorroborated); NIXON 3.91 (uncorroborated); LENNON 3.56 (uncorroborated); LENIN 3.44 (uncorroborated); INLINE 3.18 (wordle-lists only); LENNOX 3.18 (uncorroborated); CELINE 3.16 (uncorroborated); EXXON 3.1 (uncorroborated); NOONE 3.08 (uncorroborated); NEILL 3.01 (uncorroborated); LONNIE 2.91 (uncorroborated); CONNELL 2.88 (uncorroborated); LENOX 2.86 (uncorroborated); NOOOO 2.82 (uncorroborated); CINCO 2.81 (uncorroborated); NOELLE 2.78 (uncorroborated); CONLON 2.73 (uncorroborated); LENNIE 2.7 (uncorroborated); NOOOOO 2.63 (uncorroborated); ILLINI 2.61 (uncorroborated); LEONIE 2.53 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0025 — day 24 (2026-10-17) · letters RACEFNU (center R) · 35 words / 145 bonus · max 132

- Review (no dictionary backs these; not in the patch): ACCRA 3.04 (uncorroborated); CURRAN 3.04 (uncorroborated); FERRER 3 (uncorroborated); NAURU 2.94 (uncorroborated); NEUER 2.9 (uncorroborated); FARRAR 2.88 (uncorroborated); ACURA 2.81 (uncorroborated); RENNER 2.8 (uncorroborated); CARRERA 2.77 (uncorroborated); CARNE 2.76 (uncorroborated); ARRAN 2.69 (uncorroborated); FRANCA 2.66 (uncorroborated); RACECAR 2.58 (uncorroborated); FENNER 2.56 (uncorroborated)

### hb0026 — day 25 (2026-10-18) · letters LCEFORT (center L) · 37 words / 144 bonus · max 130

- **Main-list worthy** (+9 max): RECOLLECT 2.69
- Bonus: CELLER 1.95, REELECT 1.91
- Review (no dictionary backs these; not in the patch): TERRELL 2.98 (uncorroborated); FERRELL 2.97 (uncorroborated); COLETTE 2.92 (uncorroborated); LECLERC 2.62 (uncorroborated); ELLER 2.59 (wordle-lists only); TELCO 2.59 (uncorroborated); LOLOL 2.58 (uncorroborated); COLLETTE 2.57 (uncorroborated); LECTER 2.52 (uncorroborated); COTTRELL 2.51 (uncorroborated)

### hb0027 — day 26 (2026-10-19) · letters IABMNOT (center I) · 26 words / 168 bonus · max 153

- Review (no dictionary backs these; not in the patch): MANITOBA 3.43 (uncorroborated); NAMIBIA 3.25 (uncorroborated); TATIANA 3.07 (uncorroborated); ANTONI 2.89 (uncorroborated); BIMBO 2.87 (uncorroborated); BONITA 2.76 (uncorroborated); INNIT 2.74 (uncorroborated); AMIIBO 2.72 (uncorroborated); INMAN 2.72 (uncorroborated); AMINA 2.7 (uncorroborated); TINTIN 2.7 (uncorroborated); ANTONIN 2.68 (uncorroborated); TINTO 2.63 (uncorroborated); MINATO 2.53 (uncorroborated); MINTON 2.53 (uncorroborated); MONTI 2.5 (uncorroborated); OMNIA 2.5 (uncorroborated)

### hb0028 — day 27 (2026-10-20) · letters GAELRUY (center G) · 39 words / 169 bonus · max 169

- Bonus: GRAYER 1.95
- Review (no dictionary backs these; not in the patch): URUGUAY 3.7 (uncorroborated); GAULLE 3.02 (uncorroborated); GUERRA 2.97 (uncorroborated); GELLER 2.93 (uncorroborated); GULAG 2.85 (uncorroborated); GREELEY 2.83 (uncorroborated); ELGAR 2.75 (uncorroborated); GURLEY 2.75 (uncorroborated); GUERRE 2.73 (uncorroborated); GEARY 2.71 (uncorroborated); ALEGRE 2.69 (uncorroborated); RUGER 2.68 (wordle-lists only); YEAGER 2.64 (uncorroborated); ALGER 2.62 (uncorroborated); ALLEGRA 2.57 (uncorroborated)

### hb0029 — day 28 (2026-10-21) · letters PCEHIRT (center P) · 22 words / 139 bonus · max 95

- Bonus: PREPPER 2.3
- Review (no dictionary backs these; not in the patch): PERTH 3.93 (uncorroborated); PRETTIER 3.32 (uncorroborated); PETRI 2.98 (uncorroborated); TRIPP 2.88 (uncorroborated); PEIRCE 2.77 (uncorroborated); RECEP 2.66 (uncorroborated); PRITCHETT 2.53 (uncorroborated); PETTIT 2.52 (uncorroborated); PREET 2.5 (uncorroborated)

### hb0030 — day 29 (2026-10-22) · letters RALOPTY (center R) · 44 words / 180 bonus · max 181

- Review (no dictionary backs these; not in the patch): PRYOR 3.16 (uncorroborated); PROLLY 3.04 (uncorroborated); YARRA 2.81 (uncorroborated); TROTT 2.77 (uncorroborated); TYROL 2.68 (uncorroborated); TRAPP 2.66 (uncorroborated); ARORA 2.57 (uncorroborated); POTRO 2.57 (uncorroborated); YATRA 2.52 (uncorroborated)

### hb0031 — day 30 (2026-10-23) · letters EACHLPY (center E) · 33 words / 96 bonus · max 102

- Review (no dictionary backs these; not in the patch): HAYLEY 3.39 (uncorroborated); HELLA 3.35 (uncorroborated); HEALY 3.23 (uncorroborated); HALLE 3.21 (uncorroborated); CALLE 2.91 (uncorroborated); CHAPPELL 2.91 (uncorroborated); HEALEY 2.9 (uncorroborated); LEAHY 2.88 (uncorroborated); CHAPPELLE 2.77 (uncorroborated); CAPPELLA 2.76 (uncorroborated); PALEY 2.76 (uncorroborated); HALLEY 2.71 (uncorroborated); CHAPELLE 2.63 (uncorroborated); LAPLACE 2.63 (uncorroborated); PAELLA 2.63 (wordle-lists only); PEPPA 2.61 (uncorroborated); HEHEHE 2.58 (uncorroborated); LYELL 2.56 (uncorroborated); PELLE 2.56 (uncorroborated); LECHE 2.54 (uncorroborated); APPEL 2.53 (uncorroborated)

### hb0032 — day 31 (2026-10-24) · letters RELOTVY (center R) · 39 words / 174 bonus · max 165

- **Main-list worthy** (+6 max): EVERLY 2.53
- Bonus: LEVELLER 2.09, TROYER 2.07
- Review (no dictionary backs these; not in the patch): TERRE 3.07 (uncorroborated); TERRELL 2.98 (uncorroborated); TYRELL 2.94 (uncorroborated); TORREY 2.89 (uncorroborated); ROLLOVER 2.85 (uncorroborated); TROTT 2.77 (uncorroborated); TYROL 2.68 (uncorroborated); ELLERY 2.61 (uncorroborated); ELLER 2.59 (wordle-lists only); TYRRELL 2.57 (uncorroborated)

### hb0033 — day 32 (2026-10-25) · letters TADEHIW (center T) · 28 words / 97 bonus · max 114

- Bonus: WHETTED 2, THATD 1.99
- Review (no dictionary backs these; not in the patch): HEWITT 3.39 (uncorroborated); DEWITT 2.89 (uncorroborated); ETIHAD 2.86 (uncorroborated); IWATA 2.51 (uncorroborated)

### hb0034 — day 33 (2026-10-26) · letters RCENOQU (center R) · 21 words / 89 bonus · max 127

- Review (no dictionary backs these; not in the patch): CONNOR 3.77 (uncorroborated); ROCCO 3.11 (uncorroborated); NEUER 2.9 (uncorroborated); COEUR 2.88 (uncorroborated); ENRON 2.84 (uncorroborated); RENNER 2.8 (uncorroborated); ROUEN 2.77 (uncorroborated); CERRO 2.66 (uncorroborated)

### hb0035 — day 34 (2026-10-27) · letters ABDEFOR (center A) · 56 words / 164 bonus · max 226

- **Main-list worthy** (+5 max): BABAR 2.61
- Bonus: FAREED 2.31, BABER 2.19, DADAR 1.92
- Review (no dictionary backs these; not in the patch): FABER 3.19 (uncorroborated); BARRE 3.08 (uncorroborated); ABABA 2.96 (uncorroborated); FARRAR 2.88 (uncorroborated); RADFORD 2.87 (uncorroborated); READE 2.73 (uncorroborated); FARBER 2.68 (uncorroborated); ARORA 2.57 (uncorroborated); BARODA 2.54 (uncorroborated); BERRA 2.53 (uncorroborated); BADOO 2.52 (uncorroborated); BARBA 2.5 (uncorroborated); OFFROAD 2.5 (wordle-lists only)

### hb0036 — day 35 (2026-10-28) · letters HAELMPT (center H) · 25 words / 78 bonus · max 86

- Review (no dictionary backs these; not in the patch): HAHAHA 3.81 (uncorroborated); HELLA 3.35 (uncorroborated); HAHAHAHA 3.23 (uncorroborated); HALLE 3.21 (uncorroborated); MAHAL 3.2 (uncorroborated); HAHAH 3.08 (uncorroborated); LATHAM 3.03 (uncorroborated); THELMA 3.02 (uncorroborated); MEHTA 2.97 (uncorroborated); AHHHH 2.93 (uncorroborated); HALLAM 2.82 (uncorroborated); PELHAM 2.82 (wordle-lists only); HAHAHAHAHA 2.81 (uncorroborated); MEHMET 2.77 (uncorroborated); HALLETT 2.63 (uncorroborated); AHAHA 2.62 (uncorroborated); HAHAHAH 2.62 (uncorroborated); HEHEHE 2.58 (uncorroborated); AAAAH 2.57 (uncorroborated); MEATH 2.57 (uncorroborated); AHHHHH 2.54 (uncorroborated); PLATH 2.52 (uncorroborated)

### hb0037 — day 36 (2026-10-29) · letters VAEINRT (center V) · 41 words / 221 bonus · max 238

- Bonus: NAVER 2.47
- Review (no dictionary backs these; not in the patch): IRVINE 3.55 (uncorroborated); RIVERA 3.44 (uncorroborated); VIVIAN 3.43 (uncorroborated); AVANT 3.36 (uncorroborated); RIVIERA 3.26 (uncorroborated); VINNIE 2.93 (uncorroborated); VIVIENNE 2.81 (uncorroborated); VIVIEN 2.75 (uncorroborated); VIEIRA 2.74 (uncorroborated); NAVARRE 2.72 (uncorroborated); RAVENNA 2.65 (uncorroborated); VIRAT 2.64 (uncorroborated); IVANA 2.59 (uncorroborated); EEVEE 2.56 (uncorroborated); VARIAN 2.56 (uncorroborated); VIVRE 2.5 (uncorroborated)

### hb0038 — day 37 (2026-10-30) · letters YABEILR (center Y) · 23 words / 130 bonus · max 108

- **Main-list worthy** (+6 max): BAILLY 2.53
- Review (no dictionary backs these; not in the patch): REILLY 3.33 (uncorroborated); BAYER 3.26 (uncorroborated); BAYLEY 2.98 (uncorroborated); LEARY 2.86 (uncorroborated); YARRA 2.81 (uncorroborated); AYALA 2.77 (uncorroborated); REALY 2.76 (uncorroborated); BEYER 2.63 (uncorroborated); ELLERY 2.61 (uncorroborated); BREYER 2.6 (uncorroborated); LALLY 2.56 (uncorroborated); LYELL 2.56 (uncorroborated); BIBBY 2.54 (uncorroborated); LILLEY 2.52 (uncorroborated)

### hb0039 — day 38 (2026-10-31) · letters CAENOTV (center C) · 38 words / 110 bonus · max 174

- Review (no dictionary backs these; not in the patch): TENCENT 2.81 (uncorroborated); CAVAN 2.53 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0040 — day 39 (2026-11-01) · letters TAFLNOR (center T) · 35 words / 140 bonus · max 109

- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); NAFTA 3.14 (uncorroborated); RATON 2.96 (uncorroborated); FONTANA 2.92 (uncorroborated); ARAFAT 2.86 (uncorroborated); FANART 2.83 (wordle-lists only); TARRANT 2.78 (uncorroborated); TROTT 2.77 (uncorroborated); FORTRAN 2.69 (wordle-lists only); ALTOONA 2.61 (uncorroborated); TANTO 2.6 (uncorroborated); FANTA 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated)

### hb0041 — day 40 (2026-11-02) · letters TACEHIM (center T) · 42 words / 141 bonus · max 162

- Review (no dictionary backs these; not in the patch): CHATHAM 3.28 (uncorroborated); MATIC 3.06 (uncorroborated); HITACHI 3 (uncorroborated); MEHTA 2.97 (uncorroborated); MATTIE 2.79 (uncorroborated); MEHMET 2.77 (uncorroborated); ATTICA 2.74 (uncorroborated); MATCHA 2.67 (wordle-lists only); THICC 2.66 (uncorroborated); HACHETTE 2.6 (uncorroborated); HECHT 2.6 (uncorroborated); MEATH 2.57 (uncorroborated); MATHEMATICA 2.5 (uncorroborated); MITCHAM 2.5 (uncorroborated); TECHIE 2.5 (wordle-lists only)

### hb0042 — day 41 (2026-11-03) · letters RADENUW (center R) · 55 words / 213 bonus · max 247

- **Main-list worthy** (+13 max): RENARD 2.67, REDRAWN 2.62
- Bonus: REDREW 2.01, DADAR 1.92
- Review (no dictionary backs these; not in the patch): RWANDA 3.53 (uncorroborated); ANWAR 3.15 (uncorroborated); DURAN 3.12 (uncorroborated); NAURU 2.94 (uncorroborated); RWANDAN 2.94 (wordle-lists only); DEERE 2.91 (uncorroborated); NADER 2.9 (uncorroborated); NEUER 2.9 (uncorroborated); DEANDRE 2.86 (uncorroborated); DURAND 2.83 (uncorroborated); ANDRADE 2.8 (uncorroborated); RENNER 2.8 (uncorroborated); ARNAUD 2.78 (uncorroborated); WARNE 2.78 (uncorroborated); EDUARD 2.76 (uncorroborated); READE 2.73 (uncorroborated); DEWAR 2.71 (uncorroborated); ARRAN 2.69 (uncorroborated); DREDD 2.69 (uncorroborated); ANDER 2.66 (wordle-lists only); DARDEN 2.54 (uncorroborated); RENAUD 2.5 (uncorroborated); UNRWA 2.5 (uncorroborated)

### hb0043 — day 42 (2026-11-04) · letters CAEGNOR (center C) · 37 words / 148 bonus · max 158

- Review (no dictionary backs these; not in the patch): CONNOR 3.77 (uncorroborated); ROCCO 3.11 (uncorroborated); ACCRA 3.04 (uncorroborated); GRECO 2.99 (uncorroborated); CORCORAN 2.95 (uncorroborated); CARRERA 2.77 (uncorroborated); CARNE 2.76 (uncorroborated); CERRO 2.66 (uncorroborated); COOGAN 2.59 (uncorroborated); AGENCE 2.58 (uncorroborated); RACECAR 2.58 (uncorroborated); NARCO 2.57 (uncorroborated); ROCCA 2.55 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0044 — day 43 (2026-11-05) · letters ICFLNOT (center I) · 25 words / 104 bonus · max 107

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): CLIFTON 3.33 (uncorroborated); LINTON 2.88 (uncorroborated); CINCO 2.81 (uncorroborated); CONTI 2.8 (uncorroborated); OFFICIO 2.77 (uncorroborated); INFINITI 2.76 (uncorroborated); INNIT 2.74 (uncorroborated); FOLIC 2.71 (uncorroborated); TINTIN 2.7 (uncorroborated); LIFTOFF 2.68 (wordle-lists only); TINTO 2.63 (uncorroborated); ILLINI 2.61 (uncorroborated); TINFOIL 2.52 (wordle-lists only); ILOILO 2.5 (uncorroborated)

### hb0045 — day 44 (2026-11-06) · letters NELMORT (center N) · 35 words / 135 bonus · max 130

- Bonus: REENTER 2.43
- Review (no dictionary backs these; not in the patch): MONROE 3.89 (uncorroborated); NORTON 3.75 (uncorroborated); NOTRE 3.67 (uncorroborated); LENNON 3.56 (uncorroborated); MORENO 3.35 (uncorroborated); NOONE 3.08 (uncorroborated); LERNER 3.07 (uncorroborated); MONET 3.07 (uncorroborated); ENRON 2.84 (uncorroborated); NORTE 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); MENLO 2.8 (uncorroborated); RENNER 2.8 (uncorroborated); NOELLE 2.78 (uncorroborated); MORETON 2.71 (uncorroborated); MENON 2.69 (uncorroborated); RENTON 2.67 (uncorroborated); MORTEN 2.66 (uncorroborated); MONTERO 2.64 (uncorroborated); NOOOOO 2.63 (uncorroborated); LENORE 2.61 (uncorroborated); TREMONT 2.55 (uncorroborated); TELNET 2.52 (uncorroborated); LEMMON 2.5 (uncorroborated)

### hb0046 — day 45 (2026-11-07) · letters FEGHIRT (center F) · 23 words / 59 bonus · max 114

- Review (no dictionary backs these; not in the patch): FIREFIGHTER 3.37 (uncorroborated); FERRER 3 (uncorroborated); FERGIE 2.91 (uncorroborated); FIREFIGHT 2.88 (uncorroborated)

### hb0047 — day 46 (2026-11-08) · letters OACILPT (center O) · 40 words / 156 bonus · max 143

- Review (no dictionary backs these; not in the patch): LOLITA 3.07 (wordle-lists only); APOLITICAL 2.77 (uncorroborated); COPPOLA 2.75 (uncorroborated); ALCOA 2.67 (uncorroborated); OCALA 2.61 (uncorroborated); ALCOTT 2.59 (uncorroborated); LOLOL 2.58 (uncorroborated); ILOILO 2.5 (uncorroborated)

### hb0048 — day 47 (2026-11-09) · letters PEIMRTV (center P) · 24 words / 99 bonus · max 122

- Bonus: PREPPER 2.3
- Review (no dictionary backs these; not in the patch): PRETTIER 3.32 (uncorroborated); PRIMETIME 3.21 (uncorroborated); PETRI 2.98 (uncorroborated); TRIPP 2.88 (uncorroborated); PREEMPTIVE 2.8 (uncorroborated); PRETERM 2.75 (wordle-lists only); EMPTIVE 2.62 (uncorroborated); PETTIT 2.52 (uncorroborated); PREET 2.5 (uncorroborated)

### hb0049 — day 48 (2026-11-10) · letters NCEGHIR (center N) · 36 words / 107 bonus · max 200

- Bonus: GRINER 2.11, GENER 2.1, HERING 2.08, REENGINEERING 1.97, NEIGHING 1.94
- Review (no dictionary backs these; not in the patch): GREENE 3.76 (uncorroborated); HENNING 3 (uncorroborated); GINGRICH 2.99 (uncorroborated); RENNIE 2.89 (uncorroborated); RENNER 2.8 (uncorroborated); HEINE 2.65 (uncorroborated); EINER 2.54 (uncorroborated)

### hb0050 — day 49 (2026-11-11) · letters RADEFLU (center R) · 56 words / 212 bonus · max 237

- **Main-list worthy** (+8 max): REFERRED 4.61
- Bonus: FAREED 2.31, DADAR 1.92
- Review (no dictionary backs these; not in the patch): FREUD 3.47 (uncorroborated); FARRELL 3.45 (uncorroborated); ADLER 3.36 (uncorroborated); LAUDERDALE 3.32 (uncorroborated); FEDERER 3.22 (uncorroborated); FERRER 3 (uncorroborated); FERRELL 2.97 (uncorroborated); DARFUR 2.95 (uncorroborated); DEERE 2.91 (uncorroborated); FARRAR 2.88 (uncorroborated); ADDERALL 2.87 (uncorroborated); EULER 2.79 (uncorroborated); EDUARD 2.76 (uncorroborated); READE 2.73 (uncorroborated); DREDD 2.69 (uncorroborated); LAUER 2.67 (uncorroborated); RAFFAELE 2.65 (uncorroborated); ELLER 2.59 (wordle-lists only); LARUE 2.58 (uncorroborated); FREEFALL 2.56 (uncorroborated); ALLARD 2.52 (uncorroborated)

### hb0051 — day 50 (2026-11-12) · letters EAHLTWY (center E) · 28 words / 132 bonus · max 106

- Review (no dictionary backs these; not in the patch): HAYLEY 3.39 (uncorroborated); HELLA 3.35 (uncorroborated); HEALY 3.23 (uncorroborated); HALLE 3.21 (uncorroborated); HEWLETT 3.14 (uncorroborated); WHYTE 3.05 (uncorroborated); HAWLEY 2.98 (uncorroborated); WHEATLEY 2.92 (uncorroborated); HEALEY 2.9 (uncorroborated); LEAHY 2.88 (uncorroborated); LEYTE 2.76 (uncorroborated); HALLEY 2.71 (uncorroborated); ELWAY 2.65 (uncorroborated); HALLETT 2.63 (uncorroborated); HEHEHE 2.58 (uncorroborated); WYETH 2.57 (uncorroborated); LYELL 2.56 (uncorroborated); TALLEY 2.54 (uncorroborated)

### hb0052 — day 51 (2026-11-13) · letters RDEFMNT (center R) · 35 words / 121 bonus · max 180

- **Main-list worthy** (+16 max): REFERRED 4.61, DETERRED 2.9
- Bonus: REENTER 2.43, REENTERED 2.15, TEETERED 1.9
- Review (no dictionary backs these; not in the patch): FEDERER 3.22 (uncorroborated); TERRE 3.07 (uncorroborated); FERRER 3 (uncorroborated); DEERE 2.91 (uncorroborated); RENNER 2.8 (uncorroborated); REDFERN 2.7 (uncorroborated); DREDD 2.69 (uncorroborated); FENNER 2.56 (uncorroborated); FREEDMEN 2.54 (uncorroborated)

### hb0053 — day 52 (2026-11-14) · letters IAELMNR (center I) · 47 words / 245 bonus · max 193

- Review (no dictionary backs these; not in the patch): ARMENIA 3.56 (uncorroborated); MELANIE 3.53 (uncorroborated); MERRILL 3.51 (uncorroborated); LENIN 3.44 (uncorroborated); EMINEM 3.34 (uncorroborated); LILLIAN 3.26 (uncorroborated); MILNE 3.2 (uncorroborated); INLINE 3.18 (wordle-lists only); IMRAN 3.16 (uncorroborated); ARMANI 3.06 (uncorroborated); MAINLINE 3.06 (uncorroborated); NEILL 3.01 (uncorroborated); MILLAR 2.99 (uncorroborated); LILLE 2.98 (uncorroborated); ARMIN 2.96 (uncorroborated); NARNIA 2.93 (uncorroborated); LINEMEN 2.92 (wordle-lists only); MIRREN 2.89 (uncorroborated); RENNIE 2.89 (uncorroborated); RAINIER 2.87 (wordle-lists only); MERRIAM 2.84 (uncorroborated); LANIER 2.82 (uncorroborated); EMILIE 2.79 (uncorroborated); MARNIE 2.77 (uncorroborated); LILLIE 2.74 (uncorroborated); INMAN 2.72 (uncorroborated); AMINA 2.7 (uncorroborated); LENNIE 2.7 (uncorroborated); MAIER 2.7 (uncorroborated); MALIAN 2.7 (wordle-lists only); MARIAM 2.7 (uncorroborated); MARIANNA 2.69 (uncorroborated); ARIANE 2.67 (wordle-lists only); ARIANNA 2.66 (uncorroborated); ELMIRA 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); NEIMAN 2.65 (uncorroborated); MERRIER 2.64 (wordle-lists only); NAIRA 2.63 (uncorroborated); AMIRA 2.62 (uncorroborated); MALIN 2.62 (uncorroborated); ILLINI 2.61 (uncorroborated); MIRAMAR 2.61 (uncorroborated); REIMER 2.61 (uncorroborated); RIEMANN 2.6 (uncorroborated); EINAR 2.57 (uncorroborated); AMARI 2.56 (uncorroborated); LILIANA 2.55 (uncorroborated); MERRIMAN 2.55 (uncorroborated); EINER 2.54 (uncorroborated); MELINA 2.54 (uncorroborated); MIRAI 2.54 (uncorroborated); AMELIE 2.53 (uncorroborated); MARINARA 2.53 (uncorroborated); AMALIA 2.51 (uncorroborated); RANIERI 2.51 (uncorroborated)

### hb0054 — day 53 (2026-11-15) · letters IACDEFN (center I) · 35 words / 118 bonus · max 180

- Review (no dictionary backs these; not in the patch): NADINE 3.26 (uncorroborated); CANDICE 3.12 (uncorroborated); FANNIE 3.07 (uncorroborated); AIDEN 3.06 (uncorroborated); CAINE 3.06 (uncorroborated); DIANNE 3 (uncorroborated); FANFIC 2.9 (wordle-lists only); CANDIDA 2.85 (wordle-lists only); INDICA 2.85 (wordle-lists only); DANICA 2.71 (uncorroborated); DANCIN 2.7 (uncorroborated); ICANN 2.7 (uncorroborated); FACIE 2.62 (uncorroborated); FENDI 2.57 (uncorroborated)

### hb0055 — day 54 (2026-11-16) · letters AGINRVY (center A) · 33 words / 110 bonus · max 135

- **Main-list worthy** (+22 max): ARRIVING 4.16, ARRANGING 3.55, NAGAR 3.07
- Bonus: RAVAGING 2.49, RARING 2.45
- Review (no dictionary backs these; not in the patch): VIVIAN 3.43 (uncorroborated); VIAGRA 3.24 (wordle-lists only); GAGGING 2.93 (wordle-lists only); NARNIA 2.93 (uncorroborated); GIANNI 2.91 (uncorroborated); ANNAN 2.88 (uncorroborated); YARRA 2.81 (uncorroborated); RYANAIR 2.73 (uncorroborated); NARAYAN 2.72 (uncorroborated); ARRAN 2.69 (uncorroborated); ARIANNA 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); NAIRA 2.63 (uncorroborated); IVANA 2.59 (uncorroborated); VARIAN 2.56 (uncorroborated); GARVIN 2.51 (uncorroborated); NIGRA 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0056 — day 55 (2026-11-17) · letters NAEHOPT (center N) · 34 words / 182 bonus · max 123

- Review (no dictionary backs these; not in the patch): HANNAH 4.05 (uncorroborated); EATON 3.42 (uncorroborated); PATTON 3.4 (uncorroborated); TENNANT 3.09 (uncorroborated); NOONE 3.08 (uncorroborated); HEATON 2.89 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); HATTON 2.86 (uncorroborated); NOONAN 2.85 (uncorroborated); PATNA 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); PONTE 2.75 (uncorroborated); ETHNO 2.69 (uncorroborated); HENAN 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); ATENEO 2.62 (uncorroborated); TANTO 2.6 (uncorroborated); THANET 2.6 (uncorroborated); THEON 2.57 (uncorroborated); PONTA 2.56 (uncorroborated); TAPPAN 2.54 (uncorroborated); HANNAN 2.52 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0057 — day 56 (2026-11-18) · letters IAELNPX (center I) · 20 words / 117 bonus · max 77

- Review (no dictionary backs these; not in the patch): LENIN 3.44 (uncorroborated); PALIN 3.29 (uncorroborated); LILLIAN 3.26 (uncorroborated); INLINE 3.18 (wordle-lists only); PAINE 3.17 (uncorroborated); ALEXEI 3.13 (uncorroborated); NEILL 3.01 (uncorroborated); LILLE 2.98 (uncorroborated); XXIII 2.93 (uncorroborated); LEXIE 2.74 (uncorroborated); LILLIE 2.74 (uncorroborated); LENNIE 2.7 (uncorroborated); ILLINI 2.61 (uncorroborated); LILIANA 2.55 (uncorroborated)

### hb0058 — day 57 (2026-11-19) · letters TAEGLMR (center T) · 48 words / 286 bonus · max 197

- Bonus: METTLER 2
- Review (no dictionary backs these; not in the patch): GARRETT 3.67 (uncorroborated); GAMERGATE 3.07 (uncorroborated); TERRE 3.07 (uncorroborated); TERRELL 2.98 (uncorroborated); TAGGART 2.94 (uncorroborated); MATTEL 2.87 (uncorroborated); MARGATE 2.75 (wordle-lists only); MARTELL 2.71 (uncorroborated); ARTETA 2.6 (uncorroborated); GEERT 2.6 (uncorroborated); TARTE 2.59 (uncorroborated); ARTEM 2.56 (uncorroborated); LEGGETT 2.55 (uncorroborated); MARAT 2.51 (uncorroborated)

### hb0059 — day 58 (2026-11-20) · letters CELNORT (center C) · 43 words / 171 bonus · max 226

- **Main-list worthy** (+9 max): RECOLLECT 2.69
- Bonus: CELLER 1.95, REELECT 1.91
- Review (no dictionary backs these; not in the patch): CONNOR 3.77 (uncorroborated); CORNELL 3.69 (uncorroborated); COLTON 3.16 (uncorroborated); ROCCO 3.11 (uncorroborated); CENTRO 3.01 (uncorroborated); COLETTE 2.92 (uncorroborated); CONNELL 2.88 (uncorroborated); TENCENT 2.81 (uncorroborated); CONLON 2.73 (uncorroborated); CERRO 2.66 (uncorroborated); LECLERC 2.62 (uncorroborated); TELCO 2.59 (uncorroborated); CORLEONE 2.58 (uncorroborated); COLLETTE 2.57 (uncorroborated); LECTER 2.52 (uncorroborated); COTTRELL 2.51 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0060 — day 59 (2026-11-21) · letters OIMNRTY (center O) · 33 words / 109 bonus · max 105

- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); MORNIN 3.07 (uncorroborated); TYRION 3.01 (uncorroborated); TORINO 2.87 (uncorroborated); NOOOO 2.82 (uncorroborated); RONIN 2.77 (uncorroborated); TROTT 2.77 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); MINTON 2.53 (uncorroborated); TRYON 2.52 (uncorroborated); MONTI 2.5 (uncorroborated)

### hb0061 — day 60 (2026-11-22) · letters NADEORV (center N) · 34 words / 150 bonus · max 131

- **Main-list worthy** (+6 max): RENARD 2.67
- Bonus: NAVER 2.47, NAVEED 2.1, DRONED 1.95, VENEERED 1.95
- Review (no dictionary backs these; not in the patch): ANAND 3.1 (uncorroborated); NOONE 3.08 (uncorroborated); RONAN 3.06 (uncorroborated); NAVARRO 3.05 (uncorroborated); DORAN 2.95 (uncorroborated); ANDOVER 2.94 (uncorroborated); DOREEN 2.91 (uncorroborated); NADER 2.9 (uncorroborated); ANNAN 2.88 (uncorroborated); DEANDRE 2.86 (uncorroborated); DEANNA 2.85 (uncorroborated); NOONAN 2.85 (uncorroborated); DONNER 2.84 (uncorroborated); ENRON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); ANDRADE 2.8 (uncorroborated); DONNED 2.8 (wordle-lists only); RENNER 2.8 (uncorroborated); RADEON 2.74 (uncorroborated); NAVARRE 2.72 (uncorroborated); OVERRAN 2.71 (wordle-lists only); REARDON 2.71 (uncorroborated); ANDORRA 2.69 (uncorroborated); ARRAN 2.69 (uncorroborated); ANDER 2.66 (wordle-lists only); RAVENNA 2.65 (uncorroborated); NORAD 2.64 (uncorroborated); ADDON 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); REDONDO 2.6 (uncorroborated); ANOVA 2.57 (uncorroborated); DORNAN 2.56 (uncorroborated); VANDER 2.55 (uncorroborated); DARDEN 2.54 (uncorroborated); EVANDER 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0062 — day 61 (2026-11-23) · letters WADEFOR (center W) · 31 words / 102 bonus · max 137

- Bonus: REDREW 2.01, REWORDED 1.93
- Review (no dictionary backs these; not in the patch): WOODFORD 2.9 (uncorroborated); DARROW 2.75 (uncorroborated); DEWAR 2.71 (uncorroborated); AWWWW 2.62 (uncorroborated); FREEWARE 2.57 (uncorroborated); WOODARD 2.53 (uncorroborated)

### hb0063 — day 62 (2026-11-24) · letters REOPTVY (center R) · 48 words / 179 bonus · max 209

- **Main-list worthy** (+6 max): POOPER 2.56
- Bonus: PREPPER 2.3, TROYER 2.07
- Review (no dictionary backs these; not in the patch): PRYOR 3.16 (uncorroborated); PORTE 3.13 (uncorroborated); TERRE 3.07 (uncorroborated); PETRO 2.94 (uncorroborated); TORREY 2.89 (uncorroborated); PROVO 2.86 (uncorroborated); TROTT 2.77 (uncorroborated); PETROV 2.75 (uncorroborated); PEROT 2.59 (uncorroborated); POTRO 2.57 (uncorroborated); PREET 2.5 (uncorroborated)

### hb0064 — day 63 (2026-11-25) · letters IELMPTU (center I) · 29 words / 98 bonus · max 82

- Review (no dictionary backs these; not in the patch): LILLE 2.98 (uncorroborated); EMILIE 2.79 (uncorroborated); UPTIME 2.78 (wordle-lists only); LILLIE 2.74 (uncorroborated); LIEUT 2.57 (uncorroborated); PETTIT 2.52 (uncorroborated)

### hb0065 — day 64 (2026-11-26) · letters LADENPU (center L) · 46 words / 206 bonus · max 194

- **Main-list worthy** (+16 max): ANNULLED 2.95, PANELLED 2.6
- Bonus: PEDALED 1.97, DUELED 1.94, PULPED 1.9
- Review (no dictionary backs these; not in the patch): NADAL 3.35 (uncorroborated); LELAND 3.19 (uncorroborated); LEANNE 3.03 (uncorroborated); LAUDE 2.99 (uncorroborated); DELLE 2.78 (uncorroborated); LALLANA 2.73 (uncorroborated); ALLENDE 2.72 (uncorroborated); PAELLA 2.63 (wordle-lists only); DEPAUL 2.58 (uncorroborated); LAUDA 2.58 (uncorroborated); PELLE 2.56 (uncorroborated); APPEL 2.53 (uncorroborated); NELLA 2.52 (uncorroborated)

### hb0066 — day 65 (2026-11-27) · letters TADEIPU (center T) · 30 words / 111 bonus · max 132

- Review (no dictionary backs these; not in the patch): TAIPEI 3.32 (uncorroborated); PEETA 2.56 (uncorroborated); PETTIT 2.52 (uncorroborated)

### hb0067 — day 66 (2026-11-28) · letters NAILMOT (center N) · 42 words / 279 bonus · max 214

- Review (no dictionary backs these; not in the patch): MILTON 3.84 (uncorroborated); LATINO 3.79 (wordle-lists only); LATINA 3.38 (wordle-lists only); LILLIAN 3.26 (uncorroborated); LAMONT 3.17 (uncorroborated); MILANO 3.17 (uncorroborated); TATIANA 3.07 (uncorroborated); MOLINA 3.04 (uncorroborated); ALTMAN 2.96 (uncorroborated); ANTONI 2.89 (uncorroborated); TOMLIN 2.89 (uncorroborated); ANNAN 2.88 (uncorroborated); LINTON 2.88 (uncorroborated); NOONAN 2.85 (uncorroborated); TILLMAN 2.83 (uncorroborated); NOOOO 2.82 (uncorroborated); ANATOLIA 2.77 (uncorroborated); MOANA 2.76 (uncorroborated); TALLINN 2.75 (uncorroborated); INNIT 2.74 (uncorroborated); LALLANA 2.73 (uncorroborated); INMAN 2.72 (uncorroborated); ALLMAN 2.7 (uncorroborated); AMINA 2.7 (uncorroborated); MALIAN 2.7 (wordle-lists only); MANOLO 2.7 (uncorroborated); TINTIN 2.7 (uncorroborated); ANTONIN 2.68 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); ITALIANO 2.62 (uncorroborated); MALIN 2.62 (uncorroborated); ALTOONA 2.61 (uncorroborated); ILLINI 2.61 (uncorroborated); TANTO 2.6 (uncorroborated); LILIANA 2.55 (uncorroborated); MINATO 2.53 (uncorroborated); MINTON 2.53 (uncorroborated); TAMAN 2.53 (uncorroborated); ATALANTA 2.51 (uncorroborated); MONTI 2.5 (uncorroborated); NANNA 2.5 (uncorroborated); OMNIA 2.5 (uncorroborated)

### hb0068 — day 67 (2026-11-29) · letters EIKLNRW (center E) · 31 words / 111 bonus · max 102

- **Main-list worthy** (+14 max): WINKLER 2.84 ★pangram
- Bonus: KNELLER 1.96, KILNER 1.93
- Review (no dictionary backs these; not in the patch): KLEIN 3.71 (uncorroborated); KELLER 3.58 (uncorroborated); LENIN 3.44 (uncorroborated); WEINER 3.22 (uncorroborated); INLINE 3.18 (wordle-lists only); LERNER 3.07 (uncorroborated); NEILL 3.01 (uncorroborated); NEWELL 3.01 (uncorroborated); LILLE 2.98 (uncorroborated); KLINE 2.96 (uncorroborated); RENNIE 2.89 (uncorroborated); RIKER 2.83 (uncorroborated); RENNER 2.8 (uncorroborated); WILKIE 2.8 (uncorroborated); LEWIN 2.79 (uncorroborated); LILLIE 2.74 (uncorroborated); WELKER 2.74 (uncorroborated); LENNIE 2.7 (uncorroborated); KELLIE 2.69 (uncorroborated); NIKKEI 2.64 (uncorroborated); WEENIE 2.62 (wordle-lists only); WEILL 2.61 (uncorroborated); ELLER 2.59 (wordle-lists only); REIKI 2.59 (uncorroborated); LINEKER 2.55 (uncorroborated); EINER 2.54 (uncorroborated)

### hb0069 — day 68 (2026-11-30) · letters OABCEKM (center O) · 20 words / 68 bonus · max 63

- Review (no dictionary backs these; not in the patch): OBAMA 4.86 (uncorroborated); MACBOOK 3.41 (uncorroborated); MOMMA 3.41 (uncorroborated); COOKE 3.38 (uncorroborated); COMME 2.84 (uncorroborated); KABOOM 2.56 (wordle-lists only); MACOMB 2.56 (uncorroborated); BAMAKO 2.55 (uncorroborated)

### hb0070 — day 69 (2026-12-01) · letters LACINOV (center L) · 35 words / 181 bonus · max 152

- Review (no dictionary backs these; not in the patch): NICOLA 3.54 (uncorroborated); VOLVO 3.48 (uncorroborated); LILLIAN 3.26 (uncorroborated); LOVIN 3.21 (uncorroborated); AVALON 3.19 (uncorroborated); LIVIN 3.19 (uncorroborated); NACIONAL 3.04 (uncorroborated); CALLIN 2.87 (uncorroborated); COLVIN 2.85 (uncorroborated); AVILA 2.81 (uncorroborated); LAVAL 2.8 (uncorroborated); CANOLA 2.74 (wordle-lists only); CONLON 2.73 (uncorroborated); LALLANA 2.73 (uncorroborated); ALCOA 2.67 (uncorroborated); CALLAN 2.62 (uncorroborated); ILLINI 2.61 (uncorroborated); OCALA 2.61 (uncorroborated); CAVILL 2.58 (uncorroborated); LOLOL 2.58 (uncorroborated); CAVALLI 2.56 (uncorroborated); LILIANA 2.55 (uncorroborated); NICOLAI 2.52 (uncorroborated); ILOILO 2.5 (uncorroborated)

### hb0071 — day 70 (2026-12-02) · letters AGILNOR (center A) · 46 words / 256 bonus · max 197

- **Main-list worthy** (+14 max): ARRANGING 3.55, NAGAR 3.07
- Bonus: RARING 2.45, GARGLING 2.2
- Review (no dictionary backs these; not in the patch): GONNA 5.29 (wordle-lists only); ANGLO 3.81 (uncorroborated); LILLIAN 3.26 (uncorroborated); ANGLIA 3.06 (uncorroborated); RONAN 3.06 (uncorroborated); GALLO 3.05 (uncorroborated); GAGGING 2.93 (wordle-lists only); NARNIA 2.93 (uncorroborated); RANGOON 2.93 (uncorroborated); ARAGON 2.91 (uncorroborated); GIANNI 2.91 (uncorroborated); LAING 2.91 (wordle-lists only); GOLAN 2.89 (uncorroborated); ANNAN 2.88 (uncorroborated); NOONAN 2.85 (uncorroborated); GANNON 2.84 (uncorroborated); GILLIGAN 2.8 (uncorroborated); LALLANA 2.73 (uncorroborated); ARRAN 2.69 (uncorroborated); ARIANNA 2.66 (uncorroborated); ARAGORN 2.65 (uncorroborated); NAIRN 2.65 (uncorroborated); ANGOLAN 2.63 (wordle-lists only); NAIRA 2.63 (uncorroborated); NAGANO 2.6 (uncorroborated); ARORA 2.57 (uncorroborated); LORAIN 2.56 (uncorroborated); LILIANA 2.55 (uncorroborated); GILLAN 2.52 (uncorroborated); LANNING 2.52 (uncorroborated); LONGORIA 2.52 (uncorroborated); GAGNON 2.51 (uncorroborated); GROGAN 2.51 (uncorroborated); LIAONING 2.51 (uncorroborated); NIGRA 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0072 — day 71 (2026-12-03) · letters LACIMTY (center L) · 30 words / 132 bonus · max 122

- Review (no dictionary backs these; not in the patch): ITALIA 3.39 (uncorroborated); MCCALL 3.24 (uncorroborated); MALAYA 3 (uncorroborated); CAMILA 2.95 (uncorroborated); ATTILA 2.89 (uncorroborated); AYALA 2.77 (uncorroborated); MALALA 2.63 (uncorroborated); YALTA 2.57 (uncorroborated); LALLY 2.56 (uncorroborated); ALMATY 2.55 (uncorroborated); AMALIA 2.51 (uncorroborated); MITTAL 2.51 (uncorroborated)

### hb0073 — day 72 (2026-12-04) · letters ABCEILP (center A) · 30 words / 165 bonus · max 111

- Review (no dictionary backs these; not in the patch): CALLIE 2.97 (uncorroborated); ABABA 2.96 (uncorroborated); ALIBABA 2.96 (uncorroborated); CALLE 2.91 (uncorroborated); BILAL 2.83 (uncorroborated); LEICA 2.79 (uncorroborated); BAILLIE 2.77 (uncorroborated); CAPPELLA 2.76 (uncorroborated); LAPLACE 2.63 (uncorroborated); PAELLA 2.63 (wordle-lists only); CABBIE 2.62 (wordle-lists only); PEPPA 2.61 (uncorroborated); APPEL 2.53 (uncorroborated)

### hb0074 — day 73 (2026-12-05) · letters CADEOTV (center C) · 26 words / 66 bonus · max 141

- Review (no dictionary backs these; not in the patch): CODEC 2.67 (uncorroborated); DECCA 2.51 (uncorroborated)

### hb0075 — day 74 (2026-12-06) · letters NACMORY (center N) · 29 words / 124 bonus · max 120

- Bonus: NOMAR 2
- Review (no dictionary backs these; not in the patch): MYANMAR 3.81 (uncorroborated); CONNOR 3.77 (uncorroborated); MONACO 3.65 (uncorroborated); MCCANN 3.29 (uncorroborated); MCNAMARA 3.22 (uncorroborated); ROMANO 3.07 (wordle-lists only); RONAN 3.06 (uncorroborated); CONROY 2.98 (uncorroborated); CORCORAN 2.95 (uncorroborated); ANNAN 2.88 (uncorroborated); NOONAN 2.85 (uncorroborated); NOOOO 2.82 (uncorroborated); MOANA 2.76 (uncorroborated); NARAYAN 2.72 (uncorroborated); ARRAN 2.69 (uncorroborated); CONMAN 2.63 (wordle-lists only); NOOOOO 2.63 (uncorroborated); NARCO 2.57 (uncorroborated); ROMANA 2.56 (uncorroborated); MCCARRON 2.52 (uncorroborated); NANNA 2.5 (uncorroborated); RAYNOR 2.5 (uncorroborated)

### hb0076 — day 75 (2026-12-07) · letters OADEHLW (center O) · 23 words / 85 bonus · max 88

- Bonus: DOLLED 2.44, DOLED 2.27, DOODLED 1.99
- Review (no dictionary backs these; not in the patch): HOWELL 3.45 (uncorroborated); OOOOH 2.93 (uncorroborated); OHHHH 2.9 (uncorroborated); AHOLD 2.86 (uncorroborated); HALLO 2.75 (uncorroborated); WOODHEAD 2.67 (uncorroborated); LOLOL 2.58 (uncorroborated); OOOOOH 2.51 (uncorroborated)

### hb0077 — day 76 (2026-12-08) · letters CEINOTU (center C) · 33 words / 125 bonus · max 174

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): CONNECTICUT 4.11 (uncorroborated); UCONN 3.09 (uncorroborated); CINCO 2.81 (uncorroborated); TENCENT 2.81 (uncorroborated); CONTI 2.8 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0078 — day 77 (2026-12-09) · letters NACIOPT (center N) · 48 words / 259 bonus · max 249

- Bonus: INCAPACITATION 2.17 ★, NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): PATTON 3.4 (uncorroborated); PONTIAC 3.12 (uncorroborated); NAACP 3.1 (uncorroborated); TATIANA 3.07 (uncorroborated); NIPPON 2.95 (uncorroborated); CATANIA 2.9 (uncorroborated); ANTONI 2.89 (uncorroborated); ANNAN 2.88 (uncorroborated); NOONAN 2.85 (uncorroborated); TIPTON 2.85 (uncorroborated); PATNA 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); CINCO 2.81 (uncorroborated); CONTI 2.8 (uncorroborated); PACINO 2.8 (uncorroborated); INNIT 2.74 (uncorroborated); ICANN 2.7 (uncorroborated); TINTIN 2.7 (uncorroborated); ANTONIN 2.68 (uncorroborated); NOOOOO 2.63 (uncorroborated); POCONO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); TANTO 2.6 (uncorroborated); PONTA 2.56 (uncorroborated); TAPPAN 2.54 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0079 — day 78 (2026-12-10) · letters AEFLRTW (center A) · 60 words / 221 bonus · max 230

- Review (no dictionary backs these; not in the patch): FARRELL 3.45 (uncorroborated); LAWLER 2.93 (uncorroborated); WALLA 2.92 (uncorroborated); FARRAR 2.88 (uncorroborated); ARAFAT 2.86 (uncorroborated); RAFFAELE 2.65 (uncorroborated); FALAFEL 2.64 (wordle-lists only); AWWWW 2.62 (uncorroborated); ARTETA 2.6 (uncorroborated); AFTERALL 2.59 (uncorroborated); FATALE 2.59 (uncorroborated); TARTE 2.59 (uncorroborated); FREEWARE 2.57 (uncorroborated); FREEFALL 2.56 (uncorroborated)

### hb0080 — day 79 (2026-12-11) · letters OADIRTU (center O) · 30 words / 102 bonus · max 108

- Bonus: AUTOR 2.07
- Review (no dictionary backs these; not in the patch): OUTTA 4.1 (uncorroborated); ARTURO 3.1 (uncorroborated); TRURO 2.79 (uncorroborated); TROTT 2.77 (uncorroborated); ARORA 2.57 (uncorroborated); DIARIO 2.55 (uncorroborated)

### hb0081 — day 80 (2026-12-12) · letters AEGMNOT (center A) · 50 words / 237 bonus · max 216

- Review (no dictionary backs these; not in the patch): GONNA 5.29 (wordle-lists only); GOTTA 4.95 (uncorroborated); EATON 3.42 (uncorroborated); MOMMA 3.41 (uncorroborated); MATTEO 3.15 (uncorroborated); TENNANT 3.09 (uncorroborated); ANNAN 2.88 (uncorroborated); MAGEE 2.87 (uncorroborated); AETNA 2.86 (uncorroborated); NOONAN 2.85 (uncorroborated); GANNON 2.84 (uncorroborated); GANGNAM 2.79 (uncorroborated); MOANA 2.76 (uncorroborated); OTAGO 2.76 (uncorroborated); NEGAN 2.71 (uncorroborated); AMATO 2.67 (uncorroborated); TEGAN 2.67 (uncorroborated); AEGON 2.64 (uncorroborated); EAMON 2.64 (uncorroborated); MEENA 2.64 (uncorroborated); ATENEO 2.62 (uncorroborated); NAGANO 2.6 (uncorroborated); TANTO 2.6 (uncorroborated); GANNETT 2.54 (uncorroborated); MOTTA 2.54 (uncorroborated); MANET 2.53 (uncorroborated); TAMAN 2.53 (uncorroborated); GAGNON 2.51 (uncorroborated); EAMONN 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0082 — day 81 (2026-12-13) · letters OAHNRTW (center O) · 32 words / 115 bonus · max 125

- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); THORNTON 3.51 (uncorroborated); HORTON 3.36 (uncorroborated); WHARTON 3.22 (uncorroborated); RONAN 3.06 (uncorroborated); RATON 2.96 (uncorroborated); OOOOH 2.93 (uncorroborated); OHHHH 2.9 (uncorroborated); HATTON 2.86 (uncorroborated); NOONAN 2.85 (uncorroborated); NOOOO 2.82 (uncorroborated); HORAN 2.79 (uncorroborated); TROTT 2.77 (uncorroborated); HAWORTH 2.67 (uncorroborated); NOOOOO 2.63 (uncorroborated); TANTO 2.6 (uncorroborated); ARORA 2.57 (uncorroborated); HOWARTH 2.54 (uncorroborated); WOOTTON 2.52 (uncorroborated); OOOOOH 2.51 (uncorroborated)

### hb0083 — day 82 (2026-12-14) · letters IEMNOPT (center I) · 38 words / 156 bonus · max 175

- Review (no dictionary backs these; not in the patch): EMINEM 3.34 (uncorroborated); ETIENNE 3.1 (uncorroborated); POINTE 3.03 (wordle-lists only); NIPPON 2.95 (uncorroborated); NIETO 2.87 (uncorroborated); TIPTON 2.85 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); TINTO 2.63 (uncorroborated); MINTON 2.53 (uncorroborated); PETTIT 2.52 (uncorroborated); TOMMIE 2.51 (uncorroborated); MONTI 2.5 (uncorroborated)

### hb0084 — day 83 (2026-12-15) · letters RABEGKO (center R) · 47 words / 159 bonus · max 174

- **Main-list worthy** (+11 max): GARBER 2.73, BABAR 2.61
- Bonus: BROOKER 2.48, BABER 2.19, GRABER 2.12
- Review (no dictionary backs these; not in the patch): AKBAR 3.29 (uncorroborated); BRAGG 3.19 (uncorroborated); BARRE 3.08 (uncorroborated); KROGER 3.02 (uncorroborated); KORRA 2.91 (uncorroborated); GERBER 2.88 (uncorroborated); REEBOK 2.85 (uncorroborated); BARAK 2.71 (uncorroborated); KERBER 2.63 (uncorroborated); BARAKA 2.61 (uncorroborated); BRAGA 2.58 (uncorroborated); ARORA 2.57 (uncorroborated); GABOR 2.56 (uncorroborated); GARBO 2.55 (uncorroborated); BERRA 2.53 (uncorroborated); BARBA 2.5 (uncorroborated)

### hb0085 — day 84 (2026-12-16) · letters EABKLMR (center E) · 57 words / 223 bonus · max 202

- Bonus: BALMER 2.38, BABER 2.19, BELLER 2.04, BLEAKER 1.96
- Review (no dictionary backs these; not in the patch): KELLER 3.58 (uncorroborated); KERALA 3.53 (uncorroborated); KRAMER 3.45 (uncorroborated); MERKEL 3.4 (uncorroborated); LEMME 3.19 (uncorroborated); BARRE 3.08 (uncorroborated); KAREEM 3.05 (uncorroborated); ALBEMARLE 2.79 (uncorroborated); MALEK 2.78 (uncorroborated); MEERA 2.77 (uncorroborated); MARBELLA 2.7 (uncorroborated); BARBELL 2.65 (wordle-lists only); BEEBE 2.63 (uncorroborated); KERBER 2.63 (uncorroborated); MARKLE 2.6 (uncorroborated); ELLER 2.59 (wordle-lists only); BREMER 2.56 (uncorroborated); KREME 2.55 (uncorroborated); BERRA 2.53 (uncorroborated)

### hb0086 — day 85 (2026-12-17) · letters AEPRTXY (center A) · 41 words / 172 bonus · max 153

- Review (no dictionary backs these; not in the patch): EXPAT 3.01 (wordle-lists only); YARRA 2.81 (uncorroborated); PARTE 2.77 (uncorroborated); PATTAYA 2.69 (uncorroborated); TRAPP 2.66 (uncorroborated); PEPPA 2.61 (uncorroborated); ARTETA 2.6 (uncorroborated); TARTE 2.59 (uncorroborated); PEETA 2.56 (uncorroborated); YATRA 2.52 (uncorroborated)

### hb0087 — day 86 (2026-12-18) · letters LAIMPRY (center L) · 24 words / 152 bonus · max 85

- Review (no dictionary backs these; not in the patch): PAYPAL 3.75 (uncorroborated); MALAYA 3 (uncorroborated); MILLAR 2.99 (uncorroborated); AIRPLAY 2.85 (wordle-lists only); AYALA 2.77 (uncorroborated); MALALA 2.63 (uncorroborated); LALLY 2.56 (uncorroborated); AMALIA 2.51 (uncorroborated)

### hb0088 — day 87 (2026-12-19) · letters EHLNOPT (center E) · 38 words / 147 bonus · max 119

- Review (no dictionary backs these; not in the patch): LENNON 3.56 (uncorroborated); POOLE 3.34 (uncorroborated); NOONE 3.08 (uncorroborated); HELENE 3.02 (uncorroborated); NOELLE 2.78 (uncorroborated); PONTE 2.75 (uncorroborated); ETHNO 2.69 (uncorroborated); HEHEHE 2.58 (uncorroborated); THEON 2.57 (uncorroborated); PELLE 2.56 (uncorroborated); TELNET 2.52 (uncorroborated)

### hb0089 — day 88 (2026-12-20) · letters DEGIOPR (center D) · 47 words / 150 bonus · max 182

- **Main-list worthy** (+21 max): PREPPED 2.91, PRODDED 2.59, DRIPPED 2.56
- Bonus: DEEDED 2.35, DOERR 2.07, GRIDDED 1.98, GIRDED 1.97, DROOPED 1.91
- Review (no dictionary backs these; not in the patch): OPIOID 3.33 (wordle-lists only); RODRIGO 3.28 (uncorroborated); DIDIER 3.03 (uncorroborated); GOODE 2.97 (uncorroborated); DEERE 2.91 (uncorroborated); GOODIE 2.8 (wordle-lists only); DREDD 2.69 (uncorroborated); GORDO 2.68 (uncorroborated); PREORDERED 2.56 (uncorroborated); GORDIE 2.51 (uncorroborated)

### hb0090 — day 89 (2026-12-21) · letters OELMPRY (center O) · 38 words / 148 bonus · max 140

- **Main-list worthy** (+12 max): POOPER 2.56, MOLLER 2.5
- Review (no dictionary backs these; not in the patch): POOLE 3.34 (uncorroborated); MORLEY 3.18 (uncorroborated); PRYOR 3.16 (uncorroborated); PROLLY 3.04 (uncorroborated); POMEROY 2.83 (uncorroborated); POMPEO 2.81 (uncorroborated); ROMMEL 2.81 (uncorroborated); ELMORE 2.75 (uncorroborated); MELLOR 2.71 (uncorroborated); MOLLOY 2.69 (uncorroborated); MOYER 2.63 (uncorroborated); MELLO 2.62 (uncorroborated); MOREY 2.62 (uncorroborated); MORRELL 2.61 (uncorroborated); LOLOL 2.58 (uncorroborated); MORELL 2.55 (uncorroborated); POOPY 2.5 (uncorroborated)

### hb0091 — day 90 (2026-12-22) · letters AEIMNPT (center A) · 50 words / 279 bonus · max 220

- Review (no dictionary backs these; not in the patch): MEANTIME 4.04 (uncorroborated); TAMPA 3.92 (uncorroborated); TAIPEI 3.32 (uncorroborated); PAINE 3.17 (uncorroborated); TENNANT 3.09 (uncorroborated); TATIANA 3.07 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); PATNA 2.84 (uncorroborated); MATTIE 2.79 (uncorroborated); TIANANMEN 2.79 (uncorroborated); PITTMAN 2.77 (uncorroborated); EATIN 2.76 (uncorroborated); INMAN 2.72 (uncorroborated); AMINA 2.7 (uncorroborated); NEIMAN 2.65 (uncorroborated); MEENA 2.64 (uncorroborated); PEPPA 2.61 (uncorroborated); PEETA 2.56 (uncorroborated); TAPPAN 2.54 (uncorroborated); MANET 2.53 (uncorroborated); TAMAN 2.53 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0092 — day 91 (2026-12-23) · letters ADILNUV (center A) · 25 words / 132 bonus · max 93

- Review (no dictionary backs these; not in the patch): VIVIAN 3.43 (uncorroborated); NADAL 3.35 (uncorroborated); DALAI 3.28 (uncorroborated); LILLIAN 3.26 (uncorroborated); NVIDIA 3.25 (uncorroborated); VIDAL 3.19 (uncorroborated); ANAND 3.1 (uncorroborated); DUVAL 3.06 (uncorroborated); ANNAN 2.88 (uncorroborated); AVILA 2.81 (uncorroborated); LAVAL 2.8 (uncorroborated); DALIAN 2.73 (uncorroborated); LALLANA 2.73 (uncorroborated); DUVALL 2.7 (uncorroborated); ADVIL 2.59 (uncorroborated); IVANA 2.59 (uncorroborated); LAUDA 2.58 (uncorroborated); VIVALDI 2.58 (uncorroborated); NAIDU 2.56 (uncorroborated); LILIANA 2.55 (uncorroborated); DAVINA 2.53 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0093 — day 92 (2026-12-24) · letters IACDEHR (center I) · 42 words / 141 bonus · max 166

- **Main-list worthy** (+7 max): READIED 2.59
- Bonus: REHIRED 2.43, REHIRE 2.24
- Review (no dictionary backs these; not in the patch): RICHIE 3.67 (uncorroborated); REICH 3.49 (uncorroborated); DIDIER 3.03 (uncorroborated); RICCI 2.88 (uncorroborated); CHERIE 2.84 (uncorroborated); HAIDER 2.82 (uncorroborated); CARDI 2.77 (uncorroborated); CHICA 2.77 (uncorroborated); HADID 2.76 (uncorroborated); HARDIE 2.72 (uncorroborated); CHIARA 2.6 (uncorroborated); DERRIDA 2.59 (uncorroborated); DIRAC 2.59 (uncorroborated); AIRDRIE 2.5 (uncorroborated); HARIRI 2.5 (uncorroborated)

### hb0094 — day 93 (2026-12-25) · letters ICEPRTU (center I) · 25 words / 176 bonus · max 117

- Review (no dictionary backs these; not in the patch): PRETTIER 3.32 (uncorroborated); CURRIE 3.08 (uncorroborated); RITTER 2.99 (uncorroborated); PETRI 2.98 (uncorroborated); RICCI 2.88 (uncorroborated); TRIPP 2.88 (uncorroborated); PRUITT 2.87 (uncorroborated); RETIREE 2.81 (wordle-lists only); CRITTER 2.77 (wordle-lists only); PEIRCE 2.77 (uncorroborated); PETTIT 2.52 (uncorroborated)

### hb0095 — day 94 (2026-12-26) · letters PAEHILR (center P) · 46 words / 171 bonus · max 188

- Bonus: PREPPER 2.3, PILLER 2.13
- Review (no dictionary backs these; not in the patch): PHARRELL 3.09 (uncorroborated); PHILIPP 2.9 (uncorroborated); HIPAA 2.7 (uncorroborated); PIRELLI 2.68 (uncorroborated); PRAIA 2.64 (uncorroborated); PAELLA 2.63 (wordle-lists only); PAPIER 2.63 (uncorroborated); PEPPA 2.61 (uncorroborated); PELLE 2.56 (uncorroborated); APPEL 2.53 (uncorroborated)

### hb0096 — day 95 (2026-12-27) · letters NAEFIMR (center N) · 37 words / 144 bonus · max 158

- Review (no dictionary backs these; not in the patch): ARMENIA 3.56 (uncorroborated); EMINEM 3.34 (uncorroborated); IMRAN 3.16 (uncorroborated); FANNIE 3.07 (uncorroborated); ARMANI 3.06 (uncorroborated); MAINFRAME 2.99 (uncorroborated); ARMIN 2.96 (uncorroborated); NARNIA 2.93 (uncorroborated); MIRREN 2.89 (uncorroborated); RENNIE 2.89 (uncorroborated); ANNAN 2.88 (uncorroborated); RAINIER 2.87 (wordle-lists only); RENNER 2.8 (uncorroborated); MARNIE 2.77 (uncorroborated); INMAN 2.72 (uncorroborated); AMINA 2.7 (uncorroborated); ARRAN 2.69 (uncorroborated); MARIANNA 2.69 (uncorroborated); ARIANE 2.67 (wordle-lists only); ARIANNA 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); NEIMAN 2.65 (uncorroborated); MEENA 2.64 (uncorroborated); NAIRA 2.63 (uncorroborated); RIEMANN 2.6 (uncorroborated); EINAR 2.57 (uncorroborated); FENNER 2.56 (uncorroborated); MERRIMAN 2.55 (uncorroborated); EINER 2.54 (uncorroborated); MARINARA 2.53 (uncorroborated); RANIERI 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0097 — day 96 (2026-12-28) · letters OCIJNTU (center O) · 25 words / 67 bonus · max 132

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): UCONN 3.09 (uncorroborated); NOOOO 2.82 (uncorroborated); CINCO 2.81 (uncorroborated); CONTI 2.8 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated)

### hb0098 — day 97 (2026-12-29) · letters OEILPTY (center O) · 26 words / 115 bonus · max 74

- Review (no dictionary backs these; not in the patch): POOLE 3.34 (uncorroborated); LOLOL 2.58 (uncorroborated); ILOILO 2.5 (uncorroborated); POOPY 2.5 (uncorroborated)

### hb0099 — day 98 (2026-12-30) · letters HDEGINT (center H) · 33 words / 55 bonus · max 187

- **Main-list worthy** (+7 max): THINNED 2.72
- Bonus: NEIGHING 1.94
- Review (no dictionary backs these; not in the patch): HENNING 3 (uncorroborated); HEINE 2.65 (uncorroborated); HEHEHE 2.58 (uncorroborated); INTHE 2.58 (uncorroborated)

### hb0100 — day 99 (2026-12-31) · letters RBEGHIT (center R) · 38 words / 128 bonus · max 174

- Bonus: BIRTHER 2.34, REHIRE 2.24
- Review (no dictionary backs these; not in the patch): BIEBER 3.7 (uncorroborated); TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); THIER 2.99 (uncorroborated); EBERT 2.96 (uncorroborated); GEIGER 2.96 (uncorroborated); HERBIE 2.93 (uncorroborated); BRIGITTE 2.92 (uncorroborated); GERBER 2.88 (uncorroborated); HIBBERT 2.81 (uncorroborated); RETIREE 2.81 (wordle-lists only); GREIG 2.65 (uncorroborated); GEERT 2.6 (uncorroborated); TIBER 2.6 (wordle-lists only); HEBERT 2.52 (uncorroborated)

### hb0101 — day 100 (2027-01-01) · letters OEFLRVW (center O) · 33 words / 88 bonus · max 142

- Review (no dictionary backs these; not in the patch): VOLVO 3.48 (uncorroborated); WOLFE 3.41 (uncorroborated); WOLFF 3.23 (uncorroborated); ORWELL 3.15 (uncorroborated); WOOLF 3.15 (uncorroborated); LOVELL 2.97 (uncorroborated); ROLLOVER 2.85 (uncorroborated); FERRO 2.74 (uncorroborated); LOLOL 2.58 (uncorroborated)

### hb0102 — day 101 (2027-01-02) · letters ABELNRV (center A) · 49 words / 218 bonus · max 167

- **Main-list worthy** (+5 max): BABAR 2.61
- Bonus: NAVER 2.47, LAVAR 2.2, BABER 2.19
- Review (no dictionary backs these; not in the patch): BRENNAN 3.65 (uncorroborated); BARRE 3.08 (uncorroborated); LEANNE 3.03 (uncorroborated); ABABA 2.96 (uncorroborated); ANNABELLE 2.94 (uncorroborated); BEVAN 2.94 (uncorroborated); VALLE 2.94 (uncorroborated); ANNAN 2.88 (uncorroborated); LAVAL 2.8 (uncorroborated); LAVERNE 2.77 (uncorroborated); LALLANA 2.73 (uncorroborated); NAVARRE 2.72 (uncorroborated); ARRAN 2.69 (uncorroborated); BERNAL 2.67 (uncorroborated); BARBELL 2.65 (wordle-lists only); RAVENNA 2.65 (uncorroborated); VALERA 2.54 (uncorroborated); BERRA 2.53 (uncorroborated); NELLA 2.52 (uncorroborated); VELLA 2.51 (uncorroborated); BARBA 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0103 — day 102 (2027-01-03) · letters RCDEHIN (center R) · 40 words / 154 bonus · max 189

- Bonus: REHIRED 2.43, REHIRE 2.24
- Review (no dictionary backs these; not in the patch): RICHIE 3.67 (uncorroborated); REICH 3.49 (uncorroborated); DIDIER 3.03 (uncorroborated); DEERE 2.91 (uncorroborated); RENNIE 2.89 (uncorroborated); RICCI 2.88 (uncorroborated); CHERIE 2.84 (uncorroborated); RENNER 2.8 (uncorroborated); DREDD 2.69 (uncorroborated); RIDIN 2.69 (uncorroborated); EINER 2.54 (uncorroborated)

### hb0104 — day 103 (2027-01-04) · letters CAEGORV (center C) · 23 words / 68 bonus · max 92

- Review (no dictionary backs these; not in the patch): ROCCO 3.11 (uncorroborated); ACCRA 3.04 (uncorroborated); GRECO 2.99 (uncorroborated); CARRERA 2.77 (uncorroborated); CERRO 2.66 (uncorroborated); RACECAR 2.58 (uncorroborated); ROCCA 2.55 (uncorroborated)

### hb0105 — day 104 (2027-01-05) · letters ACILMNR (center A) · 39 words / 248 bonus · max 150

- Review (no dictionary backs these; not in the patch): MCCAIN 3.77 (uncorroborated); MACMILLAN 3.56 (uncorroborated); RICAN 3.43 (uncorroborated); MCCANN 3.29 (uncorroborated); LILLIAN 3.26 (uncorroborated); MCCALL 3.24 (uncorroborated); MCNAMARA 3.22 (uncorroborated); IMRAN 3.16 (uncorroborated); MCMILLAN 3.16 (uncorroborated); ARMANI 3.06 (uncorroborated); ACCRA 3.04 (uncorroborated); MILLAR 2.99 (uncorroborated); ARMIN 2.96 (uncorroborated); CAMILA 2.95 (uncorroborated); NARNIA 2.93 (uncorroborated); MANCINI 2.91 (uncorroborated); ANNAN 2.88 (uncorroborated); CALLIN 2.87 (uncorroborated); MCNAIR 2.84 (uncorroborated); MCCLAIN 2.75 (uncorroborated); LALLANA 2.73 (uncorroborated); INMAN 2.72 (uncorroborated); ALLMAN 2.7 (uncorroborated); AMINA 2.7 (uncorroborated); ICANN 2.7 (uncorroborated); MALIAN 2.7 (wordle-lists only); MARIAM 2.7 (uncorroborated); ARRAN 2.69 (uncorroborated); MARIANNA 2.69 (uncorroborated); ARIANNA 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); MALALA 2.63 (uncorroborated); NAIRA 2.63 (uncorroborated); AMIRA 2.62 (uncorroborated); CALLAN 2.62 (uncorroborated); MALIN 2.62 (uncorroborated); MIRAMAR 2.61 (uncorroborated); CALAMARI 2.57 (uncorroborated); AMARI 2.56 (uncorroborated); LILIANA 2.55 (uncorroborated); MIRAI 2.54 (uncorroborated); CIARAN 2.53 (uncorroborated); MARINARA 2.53 (uncorroborated); AMALIA 2.51 (uncorroborated); MARCA 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0106 — day 105 (2027-01-06) · letters VCENORU (center V) · 23 words / 50 bonus · max 115

- Review (no dictionary backs these; not in the patch): OEUVRE 2.79 (wordle-lists only); NUEVO 2.76 (uncorroborated); EEVEE 2.56 (uncorroborated)

### hb0107 — day 106 (2027-01-07) · letters NAEMPTV (center N) · 26 words / 122 bonus · max 83

- Review (no dictionary backs these; not in the patch): AVANT 3.36 (uncorroborated); TENNANT 3.09 (uncorroborated); ANNAN 2.88 (uncorroborated); MAVEN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); PATNA 2.84 (uncorroborated); MEENA 2.64 (uncorroborated); TAPPAN 2.54 (uncorroborated); MANET 2.53 (uncorroborated); TAMAN 2.53 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0108 — day 107 (2027-01-08) · letters TGHOPRU (center T) · 31 words / 70 bonus · max 126

- Bonus: OUTGROUP 2.23
- Review (no dictionary backs these; not in the patch): TRURO 2.79 (uncorroborated); TROTT 2.77 (uncorroborated); POTRO 2.57 (uncorroborated)

### hb0109 — day 108 (2027-01-09) · letters ODELRUV (center O) · 41 words / 97 bonus · max 195

- Bonus: DOLLED 2.44, OVERRODE 2.3, DOLED 2.27, DOERR 2.07, LODER 2.07, DOODLED 1.99
- Review (no dictionary backs these; not in the patch): VOLVO 3.48 (uncorroborated); LORDE 3.16 (uncorroborated); LOVELL 2.97 (uncorroborated); ROLLOVER 2.85 (uncorroborated); OEUVRE 2.79 (wordle-lists only); LOLOL 2.58 (uncorroborated)

### hb0110 — day 109 (2027-01-10) · letters ACEHLOR (center A) · 54 words / 202 bonus · max 199

- **Main-list worthy** (+6 max): HALLER 2.61
- Bonus: HOLLAR 1.93
- Review (no dictionary backs these; not in the patch): HAHAHA 3.81 (uncorroborated); CARROLL 3.8 (uncorroborated); HORACE 3.52 (uncorroborated); LAHORE 3.49 (uncorroborated); HERRERA 3.36 (uncorroborated); HELLA 3.35 (uncorroborated); HAHAHAHA 3.23 (uncorroborated); HALLE 3.21 (uncorroborated); COACHELLA 3.14 (uncorroborated); HAHAH 3.08 (uncorroborated); ACCRA 3.04 (uncorroborated); AHHHH 2.93 (uncorroborated); CALLE 2.91 (uncorroborated); HARARE 2.85 (uncorroborated); HAHAHAHAHA 2.81 (uncorroborated); OCHOA 2.81 (uncorroborated); ROCHA 2.78 (uncorroborated); CARRERA 2.77 (uncorroborated); HALLO 2.75 (uncorroborated); HARRELL 2.72 (uncorroborated); OREAL 2.71 (uncorroborated); ALCOA 2.67 (uncorroborated); AHAHA 2.62 (uncorroborated); HAHAHAH 2.62 (uncorroborated); OCALA 2.61 (uncorroborated); RACECAR 2.58 (uncorroborated); AAAAH 2.57 (uncorroborated); ARORA 2.57 (uncorroborated); HOARE 2.55 (uncorroborated); ROCCA 2.55 (uncorroborated); AHHHHH 2.54 (uncorroborated); CARLE 2.53 (uncorroborated); LORCA 2.53 (uncorroborated); CHORALE 2.51 (wordle-lists only)

### hb0111 — day 110 (2027-01-11) · letters EGINOPR (center E) · 47 words / 234 bonus · max 223

- **Main-list worthy** (+14 max): PREPPING 3.18, POOPER 2.56
- Bonus: GOERING 2.42, PREPPER 2.3, GRINER 2.11, GENER 2.1, REENGINEERING 1.97
- Review (no dictionary backs these; not in the patch): OREGON 4.3 (uncorroborated); GREENE 3.76 (uncorroborated); RONNIE 3.7 (uncorroborated); NOONE 3.08 (uncorroborated); PIERO 3.01 (uncorroborated); GEIGER 2.96 (uncorroborated); RENNIE 2.89 (uncorroborated); GREGORIO 2.87 (uncorroborated); ENRON 2.84 (uncorroborated); PERRIN 2.83 (uncorroborated); RENNER 2.8 (uncorroborated); RENOIR 2.73 (uncorroborated); NOIRE 2.7 (uncorroborated); ROGEN 2.7 (uncorroborated); EPPING 2.66 (uncorroborated); GREIG 2.65 (uncorroborated); GRONINGEN 2.64 (uncorroborated); ORIGEN 2.64 (uncorroborated); GEORGI 2.63 (uncorroborated); EINER 2.54 (uncorroborated); POIRIER 2.5 (uncorroborated)

### hb0112 — day 111 (2027-01-12) · letters RABDILO (center R) · 35 words / 160 bonus · max 130

- **Main-list worthy** (+5 max): BABAR 2.61
- Bonus: DOLLARD 1.95, DADAR 1.92
- Review (no dictionary backs these; not in the patch): ARABIA 4.12 (uncorroborated); BALLARD 3.25 (uncorroborated); LILLARD 2.82 (uncorroborated); ROALD 2.79 (uncorroborated); DILLARD 2.72 (uncorroborated); LIDAR 2.65 (uncorroborated); LIBOR 2.63 (uncorroborated); ARORA 2.57 (uncorroborated); DIARIO 2.55 (uncorroborated); BARODA 2.54 (uncorroborated); BLOOR 2.54 (uncorroborated); ALLARD 2.52 (uncorroborated); BIRLA 2.52 (uncorroborated); BARBA 2.5 (uncorroborated)

### hb0113 — day 112 (2027-01-13) · letters NADEGTV (center N) · 41 words / 131 bonus · max 184

- Bonus: NAVEED 2.1
- Review (no dictionary backs these; not in the patch): AVANT 3.36 (uncorroborated); ANAND 3.1 (uncorroborated); TENNANT 3.09 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); DEANNA 2.85 (uncorroborated); ATTENDEE 2.72 (uncorroborated); NEGAN 2.71 (uncorroborated); TEGAN 2.67 (uncorroborated); NEGEV 2.55 (uncorroborated); GANNETT 2.54 (uncorroborated); GENTE 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0114 — day 113 (2027-01-14) · letters LAENRTU (center L) · 49 words / 286 bonus · max 230

- Review (no dictionary backs these; not in the patch): LAUREN 3.98 (uncorroborated); RENAULT 3.35 (uncorroborated); LERNER 3.07 (uncorroborated); LEANNE 3.03 (uncorroborated); TERRELL 2.98 (uncorroborated); TUTTLE 2.96 (uncorroborated); TULANE 2.9 (uncorroborated); NUTELLA 2.84 (uncorroborated); EULER 2.79 (uncorroborated); LALLANA 2.73 (uncorroborated); NUTTALL 2.73 (uncorroborated); LAUER 2.67 (uncorroborated); ELLER 2.59 (wordle-lists only); LARUE 2.58 (uncorroborated); NELLA 2.52 (uncorroborated); TELNET 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated)

### hb0115 — day 114 (2027-01-15) · letters OALMNRY (center O) · 37 words / 122 bonus · max 137

- Bonus: NOMAR 2
- Review (no dictionary backs these; not in the patch): MOMMA 3.41 (uncorroborated); MARLON 3.21 (uncorroborated); MALLORY 3.15 (uncorroborated); LOYOLA 3.07 (uncorroborated); ROMANO 3.07 (wordle-lists only); RONAN 3.06 (uncorroborated); NOONAN 2.85 (uncorroborated); NOOOO 2.82 (uncorroborated); NAYLOR 2.8 (uncorroborated); MOANA 2.76 (uncorroborated); MANOLO 2.7 (uncorroborated); MOLLOY 2.69 (uncorroborated); NOOOOO 2.63 (uncorroborated); LOLOL 2.58 (uncorroborated); ARORA 2.57 (uncorroborated); ROMANA 2.56 (uncorroborated); MALMO 2.5 (uncorroborated); RAYNOR 2.5 (uncorroborated)

### hb0116 — day 115 (2027-01-16) · letters TAEFGIR (center T) · 43 words / 237 bonus · max 179

- Review (no dictionary backs these; not in the patch): GARRETT 3.67 (uncorroborated); GRAFFITI 3.65 (uncorroborated); TERRE 3.07 (uncorroborated); ERITREA 3.05 (uncorroborated); RITTER 2.99 (uncorroborated); ATARI 2.98 (uncorroborated); TAGGART 2.94 (uncorroborated); ARAFAT 2.86 (uncorroborated); RETIREE 2.81 (wordle-lists only); TIERRA 2.81 (uncorroborated); ARTETA 2.6 (uncorroborated); GEERT 2.6 (uncorroborated); TARTE 2.59 (uncorroborated)

### hb0117 — day 116 (2027-01-17) · letters RCEKMOY (center R) · 24 words / 97 bonus · max 98

- Review (no dictionary backs these; not in the patch): ECOMMERCE 3.3 (uncorroborated); CREME 3.12 (uncorroborated); ROCCO 3.11 (uncorroborated); MERCK 3.03 (uncorroborated); YORKE 2.88 (uncorroborated); CERRO 2.66 (uncorroborated); MOYER 2.63 (uncorroborated); CROKE 2.62 (uncorroborated); MOREY 2.62 (uncorroborated); CROKER 2.6 (uncorroborated); KREME 2.55 (uncorroborated)

### hb0118 — day 117 (2027-01-18) · letters RAHMNOY (center R) · 24 words / 80 bonus · max 95

- Bonus: NOMAR 2
- Review (no dictionary backs these; not in the patch): MYANMAR 3.81 (uncorroborated); HARAM 3.43 (uncorroborated); RAHMAN 3.3 (uncorroborated); HARYANA 3.17 (uncorroborated); ROMANO 3.07 (wordle-lists only); RONAN 3.06 (uncorroborated); YARRA 2.81 (uncorroborated); HORAN 2.79 (uncorroborated); MARYAM 2.78 (uncorroborated); NARAYAN 2.72 (uncorroborated); ARRAN 2.69 (uncorroborated); ARORA 2.57 (uncorroborated); ROMANA 2.56 (uncorroborated); RAYNOR 2.5 (uncorroborated)

### hb0119 — day 118 (2027-01-19) · letters ACHIRTY (center A) · 30 words / 164 bonus · max 128

- Review (no dictionary backs these; not in the patch): HAHAHA 3.81 (uncorroborated); HAHAHAHA 3.23 (uncorroborated); HAHAH 3.08 (uncorroborated); ACCRA 3.04 (uncorroborated); HITACHI 3 (uncorroborated); ATARI 2.98 (uncorroborated); AHHHH 2.93 (uncorroborated); CARTA 2.91 (uncorroborated); HAHAHAHAHA 2.81 (uncorroborated); TAHIR 2.81 (uncorroborated); YARRA 2.81 (uncorroborated); YAHYA 2.79 (uncorroborated); CHICA 2.77 (uncorroborated); ATTICA 2.74 (uncorroborated); AHAHA 2.62 (uncorroborated); HAHAHAH 2.62 (uncorroborated); CHIARA 2.6 (uncorroborated); TAHRIR 2.6 (uncorroborated); AAAAH 2.57 (uncorroborated); HAYAT 2.56 (uncorroborated); CATHCART 2.55 (uncorroborated); AHHHHH 2.54 (uncorroborated); ACHARYA 2.52 (uncorroborated); YATRA 2.52 (uncorroborated); HARIRI 2.5 (uncorroborated)

### hb0120 — day 119 (2027-01-20) · letters DAILPRY (center D) · 20 words / 80 bonus · max 75

- Bonus: DADAR 1.92
- Review (no dictionary backs these; not in the patch): LIPID 3.29 (wordle-lists only); DALAI 3.28 (uncorroborated); PRADA 3.21 (uncorroborated); PADILLA 3 (uncorroborated); LILLARD 2.82 (uncorroborated); DARPA 2.77 (uncorroborated); DILLARD 2.72 (uncorroborated); LIDAR 2.65 (uncorroborated); ALLARD 2.52 (uncorroborated)

### hb0121 — day 120 (2027-01-21) · letters NCEMORW (center N) · 27 words / 72 bonus · max 105

- Review (no dictionary backs these; not in the patch): MONROE 3.89 (uncorroborated); CONNOR 3.77 (uncorroborated); MORENO 3.35 (uncorroborated); NOONE 3.08 (uncorroborated); ENRON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); RENNER 2.8 (uncorroborated); MCEWEN 2.71 (uncorroborated); COWEN 2.7 (uncorroborated); MENON 2.69 (uncorroborated); NOOOOO 2.63 (uncorroborated); CREWMEN 2.61 (wordle-lists only); MCENROE 2.57 (uncorroborated); MCCOWN 2.55 (uncorroborated); CROWNE 2.51 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0122 — day 121 (2027-01-22) · letters KAELMRW (center K) · 20 words / 73 bonus · max 66

- Review (no dictionary backs these; not in the patch): KELLER 3.58 (uncorroborated); KERALA 3.53 (uncorroborated); KRAMER 3.45 (uncorroborated); MERKEL 3.4 (uncorroborated); KAMAL 3.05 (uncorroborated); KAREEM 3.05 (uncorroborated); MALEK 2.78 (uncorroborated); WELKER 2.74 (uncorroborated); KWAME 2.72 (uncorroborated); KAMARA 2.64 (uncorroborated); MARKLE 2.6 (uncorroborated); AKRAM 2.56 (uncorroborated); KREME 2.55 (uncorroborated); KARAM 2.53 (uncorroborated)

### hb0123 — day 122 (2027-01-23) · letters NCEGIKT (center N) · 36 words / 69 bonus · max 164

- **Main-list worthy** (+16 max): INCITING 3.17, IGNITING 2.8
- Bonus: GENTING 2.27, GEEKING 2.02, KEENING 1.92, TENTING 1.92
- Review (no dictionary backs these; not in the patch): GETTIN 3.72 (uncorroborated); ETIENNE 3.1 (uncorroborated); KINECT 2.96 (uncorroborated); TENCENT 2.81 (uncorroborated); INNIT 2.74 (uncorroborated); KICKIN 2.7 (uncorroborated); TINTIN 2.7 (uncorroborated); NIKKEI 2.64 (uncorroborated); CKING 2.61 (uncorroborated); KENNETT 2.61 (uncorroborated); GENTE 2.51 (uncorroborated)

### hb0124 — day 123 (2027-01-24) · letters PCELMOT (center P) · 22 words / 77 bonus · max 70

- Review (no dictionary backs these; not in the patch): POOLE 3.34 (uncorroborated); POMPEO 2.81 (uncorroborated); EPCOT 2.65 (uncorroborated); PETCO 2.59 (uncorroborated); PELLE 2.56 (uncorroborated)

### hb0125 — day 124 (2027-01-25) · letters ABELNOT (center A) · 52 words / 258 bonus · max 202

- Review (no dictionary backs these; not in the patch): ABBOTT 3.78 (uncorroborated); EATON 3.42 (uncorroborated); BANNON 3.12 (uncorroborated); TENNANT 3.09 (uncorroborated); LEANNE 3.03 (uncorroborated); ABABA 2.96 (uncorroborated); BOOLEAN 2.95 (wordle-lists only); ANNABELLE 2.94 (uncorroborated); BALLON 2.91 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); NOONAN 2.85 (uncorroborated); LALLANA 2.73 (uncorroborated); BEATLE 2.63 (uncorroborated); ATENEO 2.62 (uncorroborated); BEATON 2.62 (uncorroborated); ALTOONA 2.61 (uncorroborated); BLATT 2.61 (uncorroborated); TANTO 2.6 (uncorroborated); NELLA 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated); BLANTON 2.51 (uncorroborated); ABLETON 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0126 — day 125 (2027-01-26) · letters EBDHORT (center E) · 54 words / 197 bonus · max 240

- **Main-list worthy** (+20 max): HEROD 2.94, DETERRED 2.9, TROTTED 2.71
- Bonus: DEEDED 2.35, DOERR 2.07, BROODED 1.93, THROBBED 1.91 ★, TEETERED 1.9
- Review (no dictionary backs these; not in the patch): RHODE 3.79 (uncorroborated); TERRE 3.07 (uncorroborated); EBERT 2.96 (uncorroborated); DEERE 2.91 (uncorroborated); ROTTED 2.82 (wordle-lists only); DREDD 2.69 (uncorroborated); THEODOR 2.68 (uncorroborated); BEEBE 2.63 (uncorroborated); HEHEHE 2.58 (uncorroborated); ODETTE 2.58 (uncorroborated); HEBDO 2.56 (uncorroborated); HEBERT 2.52 (uncorroborated)

### hb0127 — day 126 (2027-01-27) · letters TADEHKN (center T) · 35 words / 119 bonus · max 152

- Bonus: THATD 1.99
- Review (no dictionary backs these; not in the patch): TENNANT 3.09 (uncorroborated); AETNA 2.86 (uncorroborated); KATANA 2.83 (wordle-lists only); ATTENDEE 2.72 (uncorroborated); TAKEDA 2.72 (uncorroborated); KENNETT 2.61 (uncorroborated); THANET 2.6 (uncorroborated); KANTE 2.53 (uncorroborated)

### hb0128 — day 127 (2027-01-28) · letters RBHINOT (center R) · 21 words / 68 bonus · max 82

- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); THORNTON 3.51 (uncorroborated); HORTON 3.36 (uncorroborated); BRITTON 2.98 (uncorroborated); ROHIT 2.98 (uncorroborated); TORINO 2.87 (uncorroborated); BORNO 2.8 (uncorroborated); RONIN 2.77 (uncorroborated); TROTT 2.77 (uncorroborated); THORIN 2.61 (uncorroborated)

### hb0129 — day 128 (2027-01-29) · letters GAEILMT (center G) · 23 words / 125 bonus · max 114

- Review (no dictionary backs these; not in the patch): GIMME 3.57 (uncorroborated); GMAIL 3.32 (uncorroborated); GILLETTE 3.09 (uncorroborated); TAILGATE 3.02 (uncorroborated); MAGEE 2.87 (uncorroborated); GILLIAM 2.76 (uncorroborated); AMIGA 2.73 (uncorroborated); GILLETT 2.62 (uncorroborated); LEGGETT 2.55 (uncorroborated); GAMAL 2.5 (uncorroborated)

### hb0130 — day 129 (2027-01-30) · letters OABDLRY (center O) · 30 words / 143 bonus · max 117

- Bonus: DOLLARD 1.95
- Review (no dictionary backs these; not in the patch): BAYLOR 3.43 (uncorroborated); LOYOLA 3.07 (uncorroborated); DOLBY 2.96 (uncorroborated); ROALD 2.79 (uncorroborated); ODDBALL 2.76 (wordle-lists only); LOLOL 2.58 (uncorroborated); ARORA 2.57 (uncorroborated); BARODA 2.54 (uncorroborated); BLOOR 2.54 (uncorroborated); BADOO 2.52 (uncorroborated)

### hb0131 — day 130 (2027-01-31) · letters VEGILNR (center V) · 39 words / 118 bonus · max 197

- **Main-list worthy** (+15 max): RELIVING 2.84 ★pangram
- Bonus: VERGING 2.44, VINING 2.13, REVELLING 2.1 ★, LEVELLER 2.09, LEVERING 1.96 ★
- Review (no dictionary backs these; not in the patch): IRVINE 3.55 (uncorroborated); LEVINE 3.46 (uncorroborated); VIRGIL 3.42 (uncorroborated); GREENVILLE 3.28 (uncorroborated); LIVIN 3.19 (uncorroborated); VINNIE 2.93 (uncorroborated); GIVIN 2.86 (uncorroborated); VIVIENNE 2.81 (uncorroborated); VIVIEN 2.75 (uncorroborated); GRENVILLE 2.71 (uncorroborated); REVVING 2.66 (wordle-lists only); ELVEN 2.63 (uncorroborated); EEVEE 2.56 (uncorroborated); NEGEV 2.55 (uncorroborated); VERGIL 2.52 (uncorroborated); VIVRE 2.5 (uncorroborated)

### hb0132 — day 131 (2027-02-01) · letters LACDINR (center L) · 22 words / 118 bonus · max 81

- Review (no dictionary backs these; not in the patch): CADILLAC 3.48 (uncorroborated); NADAL 3.35 (uncorroborated); DALAI 3.28 (uncorroborated); LILLIAN 3.26 (uncorroborated); DARLIN 2.88 (uncorroborated); CALLIN 2.87 (uncorroborated); LILLARD 2.82 (uncorroborated); DALIAN 2.73 (uncorroborated); LALLANA 2.73 (uncorroborated); DILLARD 2.72 (uncorroborated); ALDRIN 2.65 (wordle-lists only); LIDAR 2.65 (uncorroborated); CALLAN 2.62 (uncorroborated); ILLINI 2.61 (uncorroborated); LILIANA 2.55 (uncorroborated); ALLARD 2.52 (uncorroborated)

### hb0133 — day 132 (2027-02-02) · letters ABEHILT (center A) · 39 words / 222 bonus · max 128

- Review (no dictionary backs these; not in the patch): HAHAHA 3.81 (uncorroborated); ITALIA 3.39 (uncorroborated); HELLA 3.35 (uncorroborated); HAHAHAHA 3.23 (uncorroborated); HALLE 3.21 (uncorroborated); HAHAH 3.08 (uncorroborated); ABABA 2.96 (uncorroborated); ALIBABA 2.96 (uncorroborated); AHHHH 2.93 (uncorroborated); ATTILA 2.89 (uncorroborated); BAHIA 2.88 (uncorroborated); BEATTIE 2.88 (uncorroborated); HABIB 2.88 (uncorroborated); BILAL 2.83 (uncorroborated); HAHAHAHAHA 2.81 (uncorroborated); BAILLIE 2.77 (uncorroborated); TALIB 2.77 (uncorroborated); BHATT 2.69 (uncorroborated); BEATLE 2.63 (uncorroborated); HALLETT 2.63 (uncorroborated); HILAL 2.63 (uncorroborated); AHAHA 2.62 (uncorroborated); HAHAHAH 2.62 (uncorroborated); BLATT 2.61 (uncorroborated); AAAAH 2.57 (uncorroborated); AHHHHH 2.54 (uncorroborated); HAILE 2.54 (uncorroborated); HALLIE 2.51 (uncorroborated)

### hb0134 — day 133 (2027-02-03) · letters TADEMRU (center T) · 50 words / 202 bonus · max 215

- **Main-list worthy** (+13 max): DETERRED 2.9, METED 2.56
- Bonus: TEETERED 1.9
- Review (no dictionary backs these; not in the patch): TRUDEAU 3.44 (uncorroborated); METADATA 3.36 (uncorroborated); UTTAR 3.22 (uncorroborated); TERRE 3.07 (uncorroborated); DUTERTE 2.93 (uncorroborated); DUARTE 2.7 (uncorroborated); ARTETA 2.6 (uncorroborated); TARTE 2.59 (uncorroborated); ARTEM 2.56 (uncorroborated); MARAT 2.51 (uncorroborated)

### hb0135 — day 134 (2027-02-04) · letters EAFGILO (center E) · 21 words / 68 bonus · max 71

- Review (no dictionary backs these; not in the patch): EIFFEL 3.23 (uncorroborated); GALILEO 3.2 (uncorroborated); LILLE 2.98 (uncorroborated); LILLIE 2.74 (uncorroborated); FALAFEL 2.64 (wordle-lists only)

### hb0136 — day 135 (2027-02-05) · letters NIMOPRT (center N) · 30 words / 66 bonus · max 139

- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); MORNIN 3.07 (uncorroborated); NIPPON 2.95 (uncorroborated); TORINO 2.87 (uncorroborated); TIPTON 2.85 (uncorroborated); NOOOO 2.82 (uncorroborated); RONIN 2.77 (uncorroborated); INNIT 2.74 (uncorroborated); TRIPPIN 2.71 (uncorroborated); TINTIN 2.7 (uncorroborated); RIPON 2.66 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); MINTON 2.53 (uncorroborated); MONTI 2.5 (uncorroborated)

### hb0137 — day 136 (2027-02-06) · letters EAGILNP (center E) · 48 words / 221 bonus · max 208

- **Main-list worthy** (+8 max): ALLEGING 3.47
- Review (no dictionary backs these; not in the patch): LENIN 3.44 (uncorroborated); LANGE 3.2 (uncorroborated); INLINE 3.18 (wordle-lists only); ELGIN 3.17 (uncorroborated); PAINE 3.17 (uncorroborated); LEANNE 3.03 (uncorroborated); NEILL 3.01 (uncorroborated); ENGEL 3 (uncorroborated); LILLE 2.98 (uncorroborated); GALLEN 2.91 (uncorroborated); EALING 2.81 (uncorroborated); LILLIE 2.74 (uncorroborated); NEGAN 2.71 (uncorroborated); LENNIE 2.7 (uncorroborated); EPPING 2.66 (uncorroborated); LEPAGE 2.66 (uncorroborated); NAGEL 2.64 (uncorroborated); PAELLA 2.63 (wordle-lists only); PEPPA 2.61 (uncorroborated); ENGLE 2.57 (uncorroborated); GLENELG 2.57 (uncorroborated); ANGELL 2.56 (uncorroborated); PELLE 2.56 (uncorroborated); APPEL 2.53 (uncorroborated); NELLA 2.52 (uncorroborated)

### hb0138 — day 137 (2027-02-07) · letters NCEILOR (center N) · 39 words / 208 bonus · max 159

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): NICOLE 3.99 (uncorroborated); CONNOR 3.77 (uncorroborated); RONNIE 3.7 (uncorroborated); CORNELL 3.69 (uncorroborated); LENNON 3.56 (uncorroborated); LENIN 3.44 (uncorroborated); INLINE 3.18 (wordle-lists only); CELINE 3.16 (uncorroborated); ROLLIN 3.11 (uncorroborated); NOONE 3.08 (uncorroborated); LERNER 3.07 (uncorroborated); NEILL 3.01 (uncorroborated); ENRICO 2.95 (uncorroborated); LONNIE 2.91 (uncorroborated); RENNIE 2.89 (uncorroborated); CONNELL 2.88 (uncorroborated); ENRON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); CINCO 2.81 (uncorroborated); CRONIN 2.8 (uncorroborated); RENNER 2.8 (uncorroborated); NOELLE 2.78 (uncorroborated); RONIN 2.77 (uncorroborated); CONLON 2.73 (uncorroborated); RENOIR 2.73 (uncorroborated); LENNIE 2.7 (uncorroborated); NOIRE 2.7 (uncorroborated); NOOOOO 2.63 (uncorroborated); ILLINI 2.61 (uncorroborated); LENORE 2.61 (uncorroborated); CORLEONE 2.58 (uncorroborated); EINER 2.54 (uncorroborated); CORRINE 2.53 (uncorroborated); LEONIE 2.53 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0139 — day 138 (2027-02-08) · letters IABCDER (center I) · 44 words / 175 bonus · max 197

- **Main-list worthy** (+7 max): READIED 2.59
- Bonus: BIRDIED 1.95
- Review (no dictionary backs these; not in the patch): ARABIA 4.12 (uncorroborated); BIEBER 3.7 (uncorroborated); BARBIE 3.56 (uncorroborated); BARRIE 3.12 (uncorroborated); DIDIER 3.03 (uncorroborated); RICCI 2.88 (uncorroborated); CARDI 2.77 (uncorroborated); CABBIE 2.62 (wordle-lists only); DERRIDA 2.59 (uncorroborated); DIRAC 2.59 (uncorroborated); BACARDI 2.51 (uncorroborated); AIRDRIE 2.5 (uncorroborated)

### hb0140 — day 139 (2027-02-09) · letters NACLMOU (center N) · 23 words / 96 bonus · max 92

- **Main-list worthy** (+6 max): UNCOOL 2.79
- Review (no dictionary backs these; not in the patch): MONACO 3.65 (uncorroborated); MCCANN 3.29 (uncorroborated); ANNUM 3.23 (uncorroborated); UCONN 3.09 (uncorroborated); ANNAN 2.88 (uncorroborated); CANCUN 2.87 (uncorroborated); MONOCLONAL 2.85 (uncorroborated); NOONAN 2.85 (uncorroborated); NOOOO 2.82 (uncorroborated); MULAN 2.81 (uncorroborated); COLMAN 2.79 (uncorroborated); MOANA 2.76 (uncorroborated); CANOLA 2.74 (wordle-lists only); CONLON 2.73 (uncorroborated); LALLANA 2.73 (uncorroborated); ALLMAN 2.7 (uncorroborated); MANOLO 2.7 (uncorroborated); CONMAN 2.63 (wordle-lists only); NOOOOO 2.63 (uncorroborated); CALLAN 2.62 (uncorroborated); MAULANA 2.62 (uncorroborated); ULLMAN 2.59 (uncorroborated); MAUNA 2.52 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0141 — day 140 (2027-02-10) · letters EABCLPT (center E) · 55 words / 196 bonus · max 224

- Review (no dictionary backs these; not in the patch): BLEEP 3.08 (uncorroborated); CALLE 2.91 (uncorroborated); PLATTE 2.84 (uncorroborated); CAPPELLA 2.76 (uncorroborated); ALCATEL 2.63 (uncorroborated); BEATLE 2.63 (uncorroborated); BEEBE 2.63 (uncorroborated); LAPLACE 2.63 (uncorroborated); PAELLA 2.63 (wordle-lists only); CELTA 2.62 (uncorroborated); PEPPA 2.61 (uncorroborated); PEETA 2.56 (uncorroborated); PELLE 2.56 (uncorroborated); APPEL 2.53 (uncorroborated)

### hb0142 — day 141 (2027-02-11) · letters ODEGINR (center O) · 46 words / 166 bonus · max 194

- **Main-list worthy** (+29 max): IGNORING 4.04, ERODING 2.85 ★pangram, DRONING 2.53
- Bonus: GOERING 2.42, GORGING 2.26, DOERR 2.07, DRONED 1.95
- Review (no dictionary backs these; not in the patch): OREGON 4.3 (uncorroborated); RONNIE 3.7 (uncorroborated); RODRIGO 3.28 (uncorroborated); GIORGIO 3.24 (uncorroborated); OGDEN 3.19 (uncorroborated); RINGO 3.16 (uncorroborated); NOONE 3.08 (uncorroborated); GOODE 2.97 (uncorroborated); DOREEN 2.91 (uncorroborated); GREGORIO 2.87 (uncorroborated); DONNER 2.84 (uncorroborated); ENRON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); DONNED 2.8 (wordle-lists only); GOODIE 2.8 (wordle-lists only); RONIN 2.77 (uncorroborated); DONNING 2.74 (wordle-lists only); RENOIR 2.73 (uncorroborated); INDIEGOGO 2.71 (uncorroborated); NOIRE 2.7 (uncorroborated); ROGEN 2.7 (uncorroborated); INDIO 2.69 (uncorroborated); DOGGING 2.68 (wordle-lists only); GORDO 2.68 (uncorroborated); INDORE 2.66 (uncorroborated); RODIN 2.66 (uncorroborated); GRONINGEN 2.64 (uncorroborated); ORIGEN 2.64 (uncorroborated); GEORGI 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); GODIN 2.6 (uncorroborated); REDONDO 2.6 (uncorroborated); DIONNE 2.58 (uncorroborated); GIORNO 2.54 (uncorroborated); GORDIE 2.51 (uncorroborated)

### hb0143 — day 142 (2027-02-12) · letters REFGINZ (center R) · 38 words / 109 bonus · max 206

- **Main-list worthy** (+38 max): REFERRING 4.35, INFRINGING 3.07, ENERGIZING 2.59, INFERRING 2.57
- Bonus: GRINER 2.11, GENER 2.1, REENGINEERING 1.97
- Review (no dictionary backs these; not in the patch): GREENE 3.76 (uncorroborated); FRIGGIN 3.17 (uncorroborated); FERRER 3 (uncorroborated); GEIGER 2.96 (uncorroborated); FERGIE 2.91 (uncorroborated); RENNIE 2.89 (uncorroborated); RENNER 2.8 (uncorroborated); GREIG 2.65 (uncorroborated); FENNER 2.56 (uncorroborated); FRIGGING 2.56 (uncorroborated); EINER 2.54 (uncorroborated)

### hb0144 — day 143 (2027-02-13) · letters BACDELN (center B) · 34 words / 116 bonus · max 139

- Bonus: ABLED 2.29, BABBLED 1.95
- Review (no dictionary backs these; not in the patch): BADEN 3.52 (uncorroborated); LEBLANC 2.98 (uncorroborated); ABABA 2.96 (uncorroborated); ANNABELLE 2.94 (uncorroborated); NABBED 2.79 (wordle-lists only); BANDANA 2.75 (wordle-lists only); BEEBE 2.63 (uncorroborated)

### hb0145 — day 144 (2027-02-14) · letters AEFORTW (center A) · 32 words / 143 bonus · max 114

- Review (no dictionary backs these; not in the patch): FARRAR 2.88 (uncorroborated); ARAFAT 2.86 (uncorroborated); TEATRO 2.63 (uncorroborated); AWWWW 2.62 (uncorroborated); ARTETA 2.6 (uncorroborated); TARTE 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); FREEWARE 2.57 (uncorroborated)

### hb0146 — day 145 (2027-02-15) · letters UDEILNT (center U) · 22 words / 158 bonus · max 84

- Bonus: DUELED 1.94
- Review (no dictionary backs these; not in the patch): DUNDEE 3.6 (uncorroborated); TUTTLE 2.96 (uncorroborated); DUNEDIN 2.95 (uncorroborated); INUIT 2.95 (uncorroborated); LIEUT 2.57 (uncorroborated)

### hb0147 — day 146 (2027-02-16) · letters TDEHILR (center T) · 44 words / 148 bonus · max 199

- **Main-list worthy** (+8 max): DETERRED 2.9
- Bonus: RETITLED 2.03, DIRTIED 1.93, TEETERED 1.9
- Review (no dictionary backs these; not in the patch): REDDIT 3.66 (uncorroborated); TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); THIER 2.99 (uncorroborated); TERRELL 2.98 (uncorroborated); RETIREE 2.81 (wordle-lists only); THIEL 2.75 (uncorroborated); DIRTIER 2.6 (wordle-lists only); HELTER 2.5 (uncorroborated)

### hb0148 — day 147 (2027-02-17) · letters BEINORW (center B) · 22 words / 88 bonus · max 90

- Bonus: BROWER 2.47
- Review (no dictionary backs these; not in the patch): ROBBIE 3.84 (uncorroborated); BIEBER 3.7 (uncorroborated); BOWEN 3.51 (uncorroborated); BROWNE 3.42 (uncorroborated); WEIBO 3.24 (uncorroborated); BRENNER 2.97 (uncorroborated); BONNER 2.96 (uncorroborated); BREEN 2.93 (uncorroborated); ROBBEN 2.84 (uncorroborated); BORNO 2.8 (uncorroborated); BERNIER 2.74 (uncorroborated); BENNIE 2.73 (wordle-lists only); RIBEIRO 2.68 (uncorroborated); BONNE 2.67 (uncorroborated); BEEBE 2.63 (uncorroborated); BRIENNE 2.63 (uncorroborated); BRIEN 2.5 (uncorroborated)

### hb0149 — day 148 (2027-02-18) · letters ECHIKRT (center E) · 41 words / 174 bonus · max 180

- Bonus: REHIRE 2.24
- Review (no dictionary backs these; not in the patch): RICHIE 3.67 (uncorroborated); REICH 3.49 (uncorroborated); RITCHIE 3.37 (uncorroborated); RICHTER 3.22 (uncorroborated); TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); THIER 2.99 (uncorroborated); CHERIE 2.84 (uncorroborated); RIKER 2.83 (uncorroborated); RETIREE 2.81 (wordle-lists only); RICKIE 2.78 (uncorroborated); THICKE 2.78 (uncorroborated); CRITTER 2.77 (wordle-lists only); TRICKIER 2.75 (uncorroborated); HERRICK 2.72 (uncorroborated); ECKERT 2.61 (uncorroborated); HECHT 2.6 (uncorroborated); REIKI 2.59 (uncorroborated); HEHEHE 2.58 (uncorroborated); TECHIE 2.5 (wordle-lists only)

### hb0150 — day 149 (2027-02-19) · letters MADEHPR (center M) · 31 words / 115 bonus · max 143

- **Main-list worthy** (+5 max): HAMER 2.6
- Bonus: HAMEED 2.25, DAMAR 1.98
- Review (no dictionary backs these; not in the patch): HARAM 3.43 (uncorroborated); MAHER 3.33 (uncorroborated); MADRE 2.88 (uncorroborated); RAHEEM 2.86 (uncorroborated); AMPED 2.8 (wordle-lists only); MEERA 2.77 (uncorroborated); MEDEA 2.76 (uncorroborated); ADAMA 2.74 (uncorroborated); HAMAD 2.66 (uncorroborated); HEMMED 2.66 (wordle-lists only); PADMA 2.65 (uncorroborated); MADERA 2.64 (uncorroborated); DEMAR 2.59 (uncorroborated)

### hb0151 — day 150 (2027-02-20) · letters ADEFLNT (center A) · 58 words / 205 bonus · max 232

- Review (no dictionary backs these; not in the patch): NADAL 3.35 (uncorroborated); LELAND 3.19 (uncorroborated); NAFTA 3.14 (uncorroborated); ANAND 3.1 (uncorroborated); TENNANT 3.09 (uncorroborated); LEANNE 3.03 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); DEANNA 2.85 (uncorroborated); FANNED 2.74 (wordle-lists only); LALLANA 2.73 (uncorroborated); ALLENDE 2.72 (uncorroborated); ATTENDEE 2.72 (uncorroborated); FALAFEL 2.64 (wordle-lists only); FATALE 2.59 (uncorroborated); ENFANT 2.53 (uncorroborated); FANTA 2.52 (uncorroborated); NELLA 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0152 — day 151 (2027-02-21) · letters MAGINOT (center M) · 39 words / 168 bonus · max 205

- **Main-list worthy** (+61 max): MANAGING 4.4, IMAGINING 3.65, IMITATING 3.2, NOMINATING 3.2 ★pangram, MITIGATING 3.14, OMITTING 2.88
- Bonus: INTIMATING 1.99
- Review (no dictionary backs these; not in the patch): MOMMA 3.41 (uncorroborated); GANGNAM 2.79 (uncorroborated); GAIMAN 2.76 (uncorroborated); MOANA 2.76 (uncorroborated); AMIGA 2.73 (uncorroborated); INMAN 2.72 (uncorroborated); AMINA 2.7 (uncorroborated); AMATO 2.67 (uncorroborated); GITMO 2.63 (uncorroborated); MOTTA 2.54 (uncorroborated); MINATO 2.53 (uncorroborated); MINTON 2.53 (uncorroborated); TAMAN 2.53 (uncorroborated); MONTI 2.5 (uncorroborated); OMNIA 2.5 (uncorroborated)

### hb0153 — day 152 (2027-02-22) · letters ICDEORT (center I) · 52 words / 195 bonus · max 249

- **Main-list worthy** (+6 max): CICERO 3.18
- Bonus: DIRTIED 1.93
- Review (no dictionary backs these; not in the patch): REDDIT 3.66 (uncorroborated); DIDIER 3.03 (uncorroborated); RITTER 2.99 (uncorroborated); RICCI 2.88 (uncorroborated); RETIREE 2.81 (wordle-lists only); CRITTER 2.77 (wordle-lists only); DIRTIER 2.6 (wordle-lists only); DOTTIE 2.57 (uncorroborated)

### hb0154 — day 153 (2027-02-23) · letters MCDEILO (center M) · 29 words / 89 bonus · max 88

- Bonus: MIMED 1.98, COMED 1.92
- Review (no dictionary backs these; not in the patch): LEMME 3.19 (uncorroborated); EMILIO 3.15 (uncorroborated); MCLEOD 3.15 (uncorroborated); COMME 2.84 (uncorroborated); EMILIE 2.79 (uncorroborated); MODDED 2.67 (wordle-lists only); MELLO 2.62 (uncorroborated)

### hb0155 — day 154 (2027-02-24) · letters LACETXY (center L) · 22 words / 103 bonus · max 69

- Review (no dictionary backs these; not in the patch): CALLE 2.91 (uncorroborated); AYALA 2.77 (uncorroborated); LEYTE 2.76 (uncorroborated); ALEXEY 2.74 (uncorroborated); ALCATEL 2.63 (uncorroborated); CELTA 2.62 (uncorroborated); YALTA 2.57 (uncorroborated); LALLY 2.56 (uncorroborated); LYELL 2.56 (uncorroborated); TALLEY 2.54 (uncorroborated)

### hb0156 — day 155 (2027-02-25) · letters LAIMRTY (center L) · 27 words / 138 bonus · max 114

- Review (no dictionary backs these; not in the patch): ITALIA 3.39 (uncorroborated); MALAYA 3 (uncorroborated); MILLAR 2.99 (uncorroborated); ATTILA 2.89 (uncorroborated); AYALA 2.77 (uncorroborated); MALALA 2.63 (uncorroborated); YALTA 2.57 (uncorroborated); LALLY 2.56 (uncorroborated); ALMATY 2.55 (uncorroborated); AMALIA 2.51 (uncorroborated); MITTAL 2.51 (uncorroborated)

### hb0157 — day 156 (2027-02-26) · letters NACDEIY (center N) · 26 words / 131 bonus · max 122

- Review (no dictionary backs these; not in the patch): NADINE 3.26 (uncorroborated); CANDICE 3.12 (uncorroborated); ANAND 3.1 (uncorroborated); AIDEN 3.06 (uncorroborated); CAINE 3.06 (uncorroborated); DIANNE 3 (uncorroborated); ANNAN 2.88 (uncorroborated); CANDIDA 2.85 (wordle-lists only); DEANNA 2.85 (uncorroborated); INDICA 2.85 (wordle-lists only); DANICA 2.71 (uncorroborated); DANCIN 2.7 (uncorroborated); ICANN 2.7 (uncorroborated); DECCAN 2.59 (uncorroborated); YANCEY 2.51 (uncorroborated); DAYNE 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0158 — day 157 (2027-02-27) · letters NDEFORU (center N) · 47 words / 154 bonus · max 226

- Bonus: DRONED 1.95
- Review (no dictionary backs these; not in the patch): DUNNO 3.76 (uncorroborated); DUNDEE 3.6 (uncorroborated); NOONE 3.08 (uncorroborated); DOREEN 2.91 (uncorroborated); NEUER 2.9 (uncorroborated); DONNER 2.84 (uncorroborated); ENRON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); DONNED 2.8 (wordle-lists only); RENNER 2.8 (uncorroborated); ROUEN 2.77 (uncorroborated); UNDERFUNDED 2.74 (uncorroborated); EFRON 2.73 (uncorroborated); REDFERN 2.7 (uncorroborated); NOOOOO 2.63 (uncorroborated); REDONDO 2.6 (uncorroborated); FENNER 2.56 (uncorroborated); FREUND 2.52 (uncorroborated); DEFUND 2.51 (wordle-lists only); ENDURO 2.51 (wordle-lists only)

### hb0159 — day 158 (2027-02-28) · letters PCDELOU (center P) · 27 words / 89 bonus · max 83

- Bonus: COOPED 2.47, PLOPPED 2.37, PULPED 1.9
- Review (no dictionary backs these; not in the patch): POOLE 3.34 (uncorroborated); UPPED 3.07 (uncorroborated); POPUP 2.78 (wordle-lists only); LEOPOLDO 2.61 (uncorroborated); PELLE 2.56 (uncorroborated)

### hb0160 — day 159 (2027-03-01) · letters ACDIMNY (center A) · 21 words / 150 bonus · max 96

- Review (no dictionary backs these; not in the patch): MCCAIN 3.77 (uncorroborated); DAMIAN 3.39 (uncorroborated); MCCANN 3.29 (uncorroborated); ANAND 3.1 (uncorroborated); MANCINI 2.91 (uncorroborated); ANNAN 2.88 (uncorroborated); CANDIDA 2.85 (wordle-lists only); INDICA 2.85 (wordle-lists only); ADAMA 2.74 (uncorroborated); YAMADA 2.74 (uncorroborated); INMAN 2.72 (uncorroborated); DANICA 2.71 (uncorroborated); AMINA 2.7 (uncorroborated); DANCIN 2.7 (uncorroborated); ICANN 2.7 (uncorroborated); AMAYA 2.58 (uncorroborated); CYDIA 2.52 (uncorroborated); AADMI 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0161 — day 160 (2027-03-02) · letters IADEFMR (center I) · 49 words / 148 bonus · max 213

- **Main-list worthy** (+15 max): REMEDIED 2.75, READIED 2.59
- Bonus: REFRIED 2.2, MIMED 1.98
- Review (no dictionary backs these; not in the patch): FERRARI 3.88 (uncorroborated); MADDIE 3.25 (uncorroborated); FAIRE 3.14 (uncorroborated); MARDI 3.14 (uncorroborated); DIDIER 3.03 (uncorroborated); FRIDA 2.97 (uncorroborated); FERREIRA 2.89 (uncorroborated); MERRIAM 2.84 (uncorroborated); AIRFARE 2.83 (wordle-lists only); FERMI 2.83 (uncorroborated); MAIER 2.7 (uncorroborated); MARIAM 2.7 (uncorroborated); MIDAIR 2.7 (wordle-lists only); MERRIER 2.64 (wordle-lists only); AMIRA 2.62 (uncorroborated); FARID 2.62 (uncorroborated); MIRAMAR 2.61 (uncorroborated); REIMER 2.61 (uncorroborated); DERRIDA 2.59 (uncorroborated); AMARI 2.56 (uncorroborated); MIRAI 2.54 (uncorroborated); AADMI 2.51 (uncorroborated); AIRDRIE 2.5 (uncorroborated)

### hb0162 — day 161 (2027-03-03) · letters CEIJNOT (center C) · 29 words / 94 bonus · max 168

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): CINCO 2.81 (uncorroborated); TENCENT 2.81 (uncorroborated); CONTI 2.8 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0163 — day 162 (2027-03-04) · letters UEFNORT (center U) · 35 words / 129 bonus · max 160

- **Main-list worthy** (+5 max): FUTON 2.56
- Review (no dictionary backs these; not in the patch): NEUER 2.9 (uncorroborated); TRURO 2.79 (uncorroborated); ROUEN 2.77 (uncorroborated); UTERO 2.7 (uncorroborated); FRONTRUNNER 2.69 (uncorroborated)

### hb0164 — day 163 (2027-03-05) · letters EBCIMNO (center E) · 24 words / 84 bonus · max 90

- Review (no dictionary backs these; not in the patch): EMINEM 3.34 (uncorroborated); NOONE 3.08 (uncorroborated); COMME 2.84 (uncorroborated); BENNIE 2.73 (wordle-lists only); MENON 2.69 (uncorroborated); BONNE 2.67 (uncorroborated); BEEBE 2.63 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0165 — day 164 (2027-03-06) · letters FBEINOR (center F) · 23 words / 66 bonus · max 89

- Review (no dictionary backs these; not in the patch): FERRER 3 (uncorroborated); FREEBIE 2.86 (wordle-lists only); FERRO 2.74 (uncorroborated); EFRON 2.73 (uncorroborated); FENNER 2.56 (uncorroborated)

### hb0166 — day 165 (2027-03-07) · letters CAENRTY (center C) · 41 words / 160 bonus · max 205

- Bonus: REENACT 2.42
- Review (no dictionary backs these; not in the patch): ACCRA 3.04 (uncorroborated); CETERA 2.96 (uncorroborated); CARTA 2.91 (uncorroborated); CARREY 2.82 (uncorroborated); TENCENT 2.81 (uncorroborated); CARRERA 2.77 (uncorroborated); CARNE 2.76 (uncorroborated); ETCETERA 2.7 (uncorroborated); RACECAR 2.58 (uncorroborated); YANCEY 2.51 (uncorroborated)

### hb0167 — day 166 (2027-03-08) · letters TAGHILR (center T) · 23 words / 127 bonus · max 90

- Review (no dictionary backs these; not in the patch): ITALIA 3.39 (uncorroborated); ATARI 2.98 (uncorroborated); TAGGART 2.94 (uncorroborated); ATTILA 2.89 (uncorroborated); TAHIR 2.81 (uncorroborated); AIGHT 2.64 (uncorroborated); TAHRIR 2.6 (uncorroborated); HAIGHT 2.51 (uncorroborated)

### hb0168 — day 167 (2027-03-09) · letters NAELOPT (center N) · 45 words / 246 bonus · max 167

- Review (no dictionary backs these; not in the patch): LENNON 3.56 (uncorroborated); EATON 3.42 (uncorroborated); PATTON 3.4 (uncorroborated); APPLETON 3.12 (uncorroborated); TENNANT 3.09 (uncorroborated); NOONE 3.08 (uncorroborated); LEANNE 3.03 (uncorroborated); PLANO 2.92 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); NOONAN 2.85 (uncorroborated); PATNA 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); NOELLE 2.78 (uncorroborated); PONTE 2.75 (uncorroborated); LALLANA 2.73 (uncorroborated); NOOOOO 2.63 (uncorroborated); ATENEO 2.62 (uncorroborated); ALTOONA 2.61 (uncorroborated); TANTO 2.6 (uncorroborated); PONTA 2.56 (uncorroborated); TAPPAN 2.54 (uncorroborated); NELLA 2.52 (uncorroborated); TELNET 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0169 — day 168 (2027-03-10) · letters LBEFIRY (center L) · 27 words / 105 bonus · max 104

- Bonus: BELLER 2.04
- Review (no dictionary backs these; not in the patch): REILLY 3.33 (uncorroborated); EIFFEL 3.23 (uncorroborated); LILLE 2.98 (uncorroborated); FERRELL 2.97 (uncorroborated); LIBRE 2.86 (uncorroborated); LILLIE 2.74 (uncorroborated); ELLERY 2.61 (uncorroborated); FEELY 2.61 (uncorroborated); ELLER 2.59 (wordle-lists only); LYELL 2.56 (uncorroborated); BEFELL 2.54 (wordle-lists only); BELLI 2.53 (uncorroborated); LILLEY 2.52 (uncorroborated)

### hb0170 — day 169 (2027-03-11) · letters MDEFOPR (center M) · 30 words / 79 bonus · max 136

- Bonus: FROMMER 2.02, MODER 1.93, ROMPED 1.91
- Review (no dictionary backs these; not in the patch): FEMME 3.19 (uncorroborated); MEDFORD 2.87 (uncorroborated); MORDOR 2.87 (uncorroborated); POMPEO 2.81 (uncorroborated); MODDED 2.67 (wordle-lists only); FROMM 2.66 (uncorroborated); FROME 2.65 (uncorroborated); FREEFORM 2.55 (uncorroborated); ROMFORD 2.54 (uncorroborated); FROOME 2.52 (uncorroborated); FEMDOM 2.51 (wordle-lists only)

### hb0171 — day 170 (2027-03-12) · letters TENORUV (center T) · 56 words / 198 bonus · max 231

- Bonus: REENTER 2.43
- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); EVERTON 3.7 (uncorroborated); NOTRE 3.67 (uncorroborated); TERRE 3.07 (uncorroborated); OVERTON 2.88 (uncorroborated); NORTE 2.84 (uncorroborated); TRURO 2.79 (uncorroborated); TROTT 2.77 (uncorroborated); UTERO 2.7 (uncorroborated); RENTON 2.67 (uncorroborated); VENETO 2.57 (uncorroborated)

### hb0172 — day 171 (2027-03-13) · letters ECJNRTU (center E) · 32 words / 128 bonus · max 144

- Bonus: REENTER 2.43
- Review (no dictionary backs these; not in the patch): JENNER 3.37 (uncorroborated); TERRE 3.07 (uncorroborated); NEUER 2.9 (uncorroborated); TENCENT 2.81 (uncorroborated); RENNER 2.8 (uncorroborated)

### hb0173 — day 172 (2027-03-14) · letters ECHIORT (center E) · 45 words / 239 bonus · max 198

- **Main-list worthy** (+6 max): CICERO 3.18
- Bonus: REHIRE 2.24
- Review (no dictionary backs these; not in the patch): RICHIE 3.67 (uncorroborated); REICH 3.49 (uncorroborated); RITCHIE 3.37 (uncorroborated); ROCHE 3.32 (uncorroborated); RICHTER 3.22 (uncorroborated); TERRE 3.07 (uncorroborated); HOTTIE 3.02 (wordle-lists only); RITTER 2.99 (uncorroborated); THIER 2.99 (uncorroborated); CHERIE 2.84 (uncorroborated); RETIREE 2.81 (wordle-lists only); CRITTER 2.77 (wordle-lists only); OCHRE 2.69 (uncorroborated); CERRO 2.66 (uncorroborated); HECHT 2.6 (uncorroborated); HEHEHE 2.58 (uncorroborated); CHEETO 2.51 (uncorroborated); TECHIE 2.5 (wordle-lists only)

### hb0174 — day 173 (2027-03-15) · letters EGNOPRY (center E) · 28 words / 159 bonus · max 105

- **Main-list worthy** (+6 max): POOPER 2.56
- Bonus: PREPPER 2.3, GENER 2.1
- Review (no dictionary backs these; not in the patch): OREGON 4.3 (uncorroborated); GREENE 3.76 (uncorroborated); ROONEY 3.7 (uncorroborated); NOONE 3.08 (uncorroborated); ENRON 2.84 (uncorroborated); PENNEY 2.81 (uncorroborated); RENNER 2.8 (uncorroborated); ROGEN 2.7 (uncorroborated); YONGE 2.7 (uncorroborated); GEORGY 2.51 (uncorroborated)

### hb0175 — day 174 (2027-03-16) · letters IEMRTUX (center I) · 20 words / 83 bonus · max 64

- Review (no dictionary backs these; not in the patch): MERRITT 3.14 (uncorroborated); RITTER 2.99 (uncorroborated); XXIII 2.93 (uncorroborated); RETIREE 2.81 (wordle-lists only); MERRIER 2.64 (wordle-lists only); REIMER 2.61 (uncorroborated); TIMUR 2.53 (uncorroborated)

### hb0176 — day 175 (2027-03-17) · letters RIMOPTU (center R) · 29 words / 92 bonus · max 95

- Review (no dictionary backs these; not in the patch): POIROT 2.89 (uncorroborated); TRIPP 2.88 (uncorroborated); PRUITT 2.87 (uncorroborated); TRURO 2.79 (uncorroborated); PRIORI 2.78 (uncorroborated); TROTT 2.77 (uncorroborated); POTRO 2.57 (uncorroborated); TIMUR 2.53 (uncorroborated)

### hb0177 — day 176 (2027-03-18) · letters OGINPRU (center O) · 25 words / 69 bonus · max 111

- **Main-list worthy** (+30 max): IGNORING 4.04, POOPING 3.01, PROPPING 2.78, GOUGING 2.67
- Bonus: GORGING 2.26, OPINING 2.07
- Review (no dictionary backs these; not in the patch): GIORGIO 3.24 (uncorroborated); RINGO 3.16 (uncorroborated); GOPRO 3.14 (uncorroborated); NIPPON 2.95 (uncorroborated); GROUPON 2.88 (uncorroborated); NOOOO 2.82 (uncorroborated); POPUP 2.78 (wordle-lists only); PRIORI 2.78 (uncorroborated); RONIN 2.77 (uncorroborated); GURION 2.72 (uncorroborated); GRUPO 2.66 (uncorroborated); RIPON 2.66 (uncorroborated); NOOOOO 2.63 (uncorroborated); GIORNO 2.54 (uncorroborated)

### hb0178 — day 177 (2027-03-19) · letters OEGILNR (center O) · 38 words / 169 bonus · max 160

- **Main-list worthy** (+22 max): IGNORING 4.04, GOOGLING 3.01, LORING 2.56
- Bonus: GOERING 2.42, OGLING 2.3, GORGING 2.26
- Review (no dictionary backs these; not in the patch): OREGON 4.3 (uncorroborated); RONNIE 3.7 (uncorroborated); LENNON 3.56 (uncorroborated); GEELONG 3.28 (uncorroborated); GIORGIO 3.24 (uncorroborated); RINGO 3.16 (uncorroborated); ROLLIN 3.11 (uncorroborated); NOONE 3.08 (uncorroborated); LONNIE 2.91 (uncorroborated); GREGORIO 2.87 (uncorroborated); ENRON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); NOELLE 2.78 (uncorroborated); RONIN 2.77 (uncorroborated); LOIRE 2.75 (uncorroborated); RENOIR 2.73 (uncorroborated); NOIRE 2.7 (uncorroborated); ROGEN 2.7 (uncorroborated); GRONINGEN 2.64 (uncorroborated); ORIGEN 2.64 (uncorroborated); GEORGI 2.63 (uncorroborated); LONGO 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); LENORE 2.61 (uncorroborated); LOLOL 2.58 (uncorroborated); GOGOL 2.55 (uncorroborated); GIORNO 2.54 (uncorroborated); GLENNON 2.53 (uncorroborated); LEONIE 2.53 (uncorroborated); LEONG 2.52 (uncorroborated); LORELEI 2.52 (uncorroborated); ILOILO 2.5 (uncorroborated)

### hb0179 — day 178 (2027-03-20) · letters CEINPRT (center C) · 31 words / 177 bonus · max 195

- Bonus: PERCENTER 1.93
- Review (no dictionary backs these; not in the patch): RICCI 2.88 (uncorroborated); TENCENT 2.81 (uncorroborated); CRITTER 2.77 (wordle-lists only); PEIRCE 2.77 (uncorroborated); RECEP 2.66 (uncorroborated); PRINCIPE 2.52 (uncorroborated)

### hb0180 — day 179 (2027-03-21) · letters TAELNUV (center T) · 32 words / 178 bonus · max 126

- Review (no dictionary backs these; not in the patch): AVANT 3.36 (uncorroborated); VETTEL 3.25 (uncorroborated); TENNANT 3.09 (uncorroborated); TUTTLE 2.96 (uncorroborated); TULANE 2.9 (uncorroborated); AETNA 2.86 (uncorroborated); NUTELLA 2.84 (uncorroborated); VANUATU 2.78 (uncorroborated); NUTTALL 2.73 (uncorroborated); NUNAVUT 2.72 (uncorroborated); VUELTA 2.64 (uncorroborated); TELNET 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated)

### hb0181 — day 180 (2027-03-22) · letters RAENOTY (center R) · 48 words / 319 bonus · max 189

- **Main-list worthy** (+7 max): REENTRY 2.83
- Bonus: REENTER 2.43, TROYER 2.07
- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); ROONEY 3.7 (uncorroborated); NOTRE 3.67 (uncorroborated); TERRE 3.07 (uncorroborated); RONAN 3.06 (uncorroborated); RATON 2.96 (uncorroborated); TORREY 2.89 (uncorroborated); ENRON 2.84 (uncorroborated); NORTE 2.84 (uncorroborated); TRYNA 2.84 (uncorroborated); YARRA 2.81 (uncorroborated); RENNER 2.8 (uncorroborated); TARRANT 2.78 (uncorroborated); TROTT 2.77 (uncorroborated); NARAYAN 2.72 (uncorroborated); RAYNER 2.7 (uncorroborated); ARRAN 2.69 (uncorroborated); RENATA 2.68 (uncorroborated); RENATO 2.68 (uncorroborated); RENTON 2.67 (uncorroborated); ARNETT 2.64 (uncorroborated); AYRTON 2.64 (uncorroborated); TEATRO 2.63 (uncorroborated); ARTETA 2.6 (uncorroborated); TARTE 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); TRYON 2.52 (uncorroborated); YATRA 2.52 (uncorroborated); RATNER 2.51 (uncorroborated); TERRAN 2.51 (uncorroborated); RAYNOR 2.5 (uncorroborated)

### hb0182 — day 181 (2027-03-23) · letters NABCDEU (center N) · 23 words / 123 bonus · max 86

- **Main-list worthy** (+7 max): NUANCED 3.26
- Review (no dictionary backs these; not in the patch): DUNDEE 3.6 (uncorroborated); BADEN 3.52 (uncorroborated); ANAND 3.1 (uncorroborated); BUENA 2.96 (uncorroborated); ANNAN 2.88 (uncorroborated); CANCUN 2.87 (uncorroborated); DEANNA 2.85 (uncorroborated); NABBED 2.79 (wordle-lists only); BANDANA 2.75 (wordle-lists only); AUDEN 2.65 (uncorroborated); DECCAN 2.59 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0183 — day 182 (2027-03-24) · letters ACENORU (center A) · 33 words / 139 bonus · max 132

- Review (no dictionary backs these; not in the patch): RONAN 3.06 (uncorroborated); ACCRA 3.04 (uncorroborated); CURRAN 3.04 (uncorroborated); CORCORAN 2.95 (uncorroborated); NAURU 2.94 (uncorroborated); ANNAN 2.88 (uncorroborated); CANCUN 2.87 (uncorroborated); NOONAN 2.85 (uncorroborated); ACURA 2.81 (uncorroborated); CARRERA 2.77 (uncorroborated); CARNE 2.76 (uncorroborated); ARRAN 2.69 (uncorroborated); RACECAR 2.58 (uncorroborated); ARORA 2.57 (uncorroborated); NARCO 2.57 (uncorroborated); ROCCA 2.55 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0184 — day 183 (2027-03-25) · letters LDEIMTU (center L) · 36 words / 117 bonus · max 134

- Bonus: DUELED 1.94
- Review (no dictionary backs these; not in the patch): LEMME 3.19 (uncorroborated); LILLE 2.98 (uncorroborated); TUTTLE 2.96 (uncorroborated); EMILIE 2.79 (uncorroborated); DELLE 2.78 (uncorroborated); LILLIE 2.74 (uncorroborated); LIDDELL 2.69 (uncorroborated); LIEUT 2.57 (uncorroborated)

### hb0185 — day 184 (2027-03-26) · letters UDEGOPR (center U) · 22 words / 94 bonus · max 98

- **Main-list worthy** (+7 max): PROUDER 2.66
- Review (no dictionary backs these; not in the patch): EUROPE 5.04 (wordle-lists only); PURDUE 3.38 (uncorroborated); GUERRERO 3.17 (uncorroborated); UPPED 3.07 (uncorroborated); POPUP 2.78 (wordle-lists only); GUERRE 2.73 (uncorroborated); RUGER 2.68 (wordle-lists only); DUPREE 2.67 (uncorroborated); GRUPO 2.66 (uncorroborated); PERDUE 2.6 (uncorroborated)

### hb0186 — day 185 (2027-03-27) · letters CEMNORY (center C) · 20 words / 74 bonus · max 95

- Review (no dictionary backs these; not in the patch): CONNOR 3.77 (uncorroborated); MCCOY 3.57 (uncorroborated); COMEY 3.31 (uncorroborated); ECOMMERCE 3.3 (uncorroborated); CREME 3.12 (uncorroborated); ROCCO 3.11 (uncorroborated); CONEY 3.06 (uncorroborated); CONROY 2.98 (uncorroborated); CONNERY 2.88 (uncorroborated); COMME 2.84 (uncorroborated); COONEY 2.73 (uncorroborated); COYNE 2.67 (uncorroborated); CERRO 2.66 (uncorroborated); MCENROE 2.57 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0187 — day 186 (2027-03-28) · letters OCFIMNR (center O) · 29 words / 99 bonus · max 103

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): CONNOR 3.77 (uncorroborated); COMIN 3.53 (uncorroborated); ROCCO 3.11 (uncorroborated); MORNIN 3.07 (uncorroborated); NOOOO 2.82 (uncorroborated); CINCO 2.81 (uncorroborated); CRONIN 2.8 (uncorroborated); OFFICIO 2.77 (uncorroborated); RONIN 2.77 (uncorroborated); FROMM 2.66 (uncorroborated); OFCOM 2.65 (uncorroborated); NOOOOO 2.63 (uncorroborated); FIRMINO 2.51 (uncorroborated)

### hb0188 — day 187 (2027-03-29) · letters ABCDELT (center A) · 55 words / 217 bonus · max 217

- **Main-list worthy** (+7 max): ABETTED 2.56
- Bonus: ABLED 2.29, BABBLED 1.95
- Review (no dictionary backs these; not in the patch): ABABA 2.96 (uncorroborated); CALLE 2.91 (uncorroborated); ALCATEL 2.63 (uncorroborated); BEATLE 2.63 (uncorroborated); CELTA 2.62 (uncorroborated); BLATT 2.61 (uncorroborated); DECCA 2.51 (uncorroborated)

### hb0189 — day 188 (2027-03-30) · letters FAEHLTU (center F) · 24 words / 54 bonus · max 73

- Review (no dictionary backs these; not in the patch): FATAH 2.85 (uncorroborated); FALAFEL 2.64 (wordle-lists only); FATALE 2.59 (uncorroborated)

### hb0190 — day 189 (2027-03-31) · letters PCEINRX (center P) · 20 words / 96 bonus · max 90

- Bonus: PREPPER 2.3
- Review (no dictionary backs these; not in the patch): PERRIN 2.83 (uncorroborated); PEIRCE 2.77 (uncorroborated); RECEP 2.66 (uncorroborated); PRINCIPE 2.52 (uncorroborated)

### hb0191 — day 190 (2027-04-01) · letters ECIPRTV (center E) · 43 words / 213 bonus · max 194

- Bonus: PREPPER 2.3
- Review (no dictionary backs these; not in the patch): PRETTIER 3.32 (uncorroborated); TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); PETRI 2.98 (uncorroborated); RETIREE 2.81 (wordle-lists only); CRITTER 2.77 (wordle-lists only); PEIRCE 2.77 (uncorroborated); RECIEVE 2.75 (uncorroborated); RECEP 2.66 (uncorroborated); EEVEE 2.56 (uncorroborated); PETTIT 2.52 (uncorroborated); PREET 2.5 (uncorroborated); VIVRE 2.5 (uncorroborated)

### hb0192 — day 191 (2027-04-02) · letters EIMRTXY (center E) · 27 words / 108 bonus · max 91

- Bonus: TEXTER 1.91
- Review (no dictionary backs these; not in the patch): EXETER 3.52 (uncorroborated); MERRITT 3.14 (uncorroborated); TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); RETIREE 2.81 (wordle-lists only); XTREME 2.79 (uncorroborated); MERRIER 2.64 (wordle-lists only); REIMER 2.61 (uncorroborated)

### hb0193 — day 192 (2027-04-03) · letters TACINOU (center T) · 42 words / 229 bonus · max 234

- Review (no dictionary backs these; not in the patch): OUTTA 4.1 (uncorroborated); TATIANA 3.07 (uncorroborated); UTICA 2.99 (uncorroborated); INUIT 2.95 (uncorroborated); CATANIA 2.9 (uncorroborated); ANTONI 2.89 (uncorroborated); CONTI 2.8 (uncorroborated); ATTICA 2.74 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); ANTONIN 2.68 (uncorroborated); TINTO 2.63 (uncorroborated); TANTO 2.6 (uncorroborated)

### hb0194 — day 193 (2027-04-04) · letters GDEFIRU (center G) · 23 words / 74 bonus · max 114

- Bonus: GRIDDED 1.98, GIRDED 1.97
- Review (no dictionary backs these; not in the patch): GEIGER 2.96 (uncorroborated); FERGIE 2.91 (uncorroborated); GUERRE 2.73 (uncorroborated); RUGER 2.68 (wordle-lists only); GREIG 2.65 (uncorroborated)

### hb0195 — day 194 (2027-04-05) · letters OADGNPR (center O) · 26 words / 123 bonus · max 78

- Review (no dictionary backs these; not in the patch): GONNA 5.29 (wordle-lists only); GOPRO 3.14 (uncorroborated); RONAN 3.06 (uncorroborated); DORAN 2.95 (uncorroborated); RANGOON 2.93 (uncorroborated); ARAGON 2.91 (uncorroborated); NOONAN 2.85 (uncorroborated); PRADO 2.85 (uncorroborated); GANNON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); ANDORRA 2.69 (uncorroborated); GORDO 2.68 (uncorroborated); ARAGORN 2.65 (uncorroborated); NORAD 2.64 (uncorroborated); ADDON 2.63 (uncorroborated); GODARD 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); NAGANO 2.6 (uncorroborated); ARORA 2.57 (uncorroborated); DORNAN 2.56 (uncorroborated); GAGNON 2.51 (uncorroborated); GROGAN 2.51 (uncorroborated)

### hb0196 — day 195 (2027-04-06) · letters AILMORT (center A) · 47 words / 221 bonus · max 182

- Review (no dictionary backs these; not in the patch): MOMMA 3.41 (uncorroborated); ITALIA 3.39 (uncorroborated); MOTOROLA 3.37 (uncorroborated); MARRIOTT 3.35 (uncorroborated); LOLITA 3.07 (wordle-lists only); MILLAR 2.99 (uncorroborated); ATARI 2.98 (uncorroborated); ATTILA 2.89 (uncorroborated); MARIAM 2.7 (uncorroborated); MARIOTA 2.69 (uncorroborated); AMATO 2.67 (uncorroborated); MALALA 2.63 (uncorroborated); AMIRA 2.62 (uncorroborated); MIRAMAR 2.61 (uncorroborated); RIALTO 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); MORATA 2.57 (uncorroborated); AMARI 2.56 (uncorroborated); MIRAI 2.54 (uncorroborated); MOTTA 2.54 (uncorroborated); AMALIA 2.51 (uncorroborated); MARAT 2.51 (uncorroborated); MITTAL 2.51 (uncorroborated); TAMIR 2.51 (uncorroborated); TOMAR 2.51 (uncorroborated); MALMO 2.5 (uncorroborated)

### hb0197 — day 196 (2027-04-07) · letters LAENRYZ (center L) · 23 words / 79 bonus · max 94

- **Main-list worthy** (+5 max): LAZER 2.7
- Review (no dictionary backs these; not in the patch): LERNER 3.07 (uncorroborated); LEANNE 3.03 (uncorroborated); LEARY 2.86 (uncorroborated); AYALA 2.77 (uncorroborated); REALY 2.76 (uncorroborated); LALLANA 2.73 (uncorroborated); YELLEN 2.66 (uncorroborated); ELLERY 2.61 (uncorroborated); ZELLER 2.6 (uncorroborated); ELLER 2.59 (wordle-lists only); LANZA 2.57 (uncorroborated); LALLY 2.56 (uncorroborated); LYELL 2.56 (uncorroborated); NELLA 2.52 (uncorroborated)

### hb0198 — day 197 (2027-04-08) · letters ACEFHRU (center A) · 25 words / 115 bonus · max 77

- Review (no dictionary backs these; not in the patch): HAHAHA 3.81 (uncorroborated); HERRERA 3.36 (uncorroborated); HAHAHAHA 3.23 (uncorroborated); HAHAH 3.08 (uncorroborated); ACCRA 3.04 (uncorroborated); AHHHH 2.93 (uncorroborated); FARRAR 2.88 (uncorroborated); FARRAH 2.86 (uncorroborated); HARARE 2.85 (uncorroborated); CHAUCER 2.84 (uncorroborated); ACURA 2.81 (uncorroborated); HAHAHAHAHA 2.81 (uncorroborated); CARRERA 2.77 (uncorroborated); AHAHA 2.62 (uncorroborated); HAHAHAH 2.62 (uncorroborated); RACECAR 2.58 (uncorroborated); AAAAH 2.57 (uncorroborated); AHHHHH 2.54 (uncorroborated)

### hb0199 — day 198 (2027-04-09) · letters EAGIMNZ (center E) · 26 words / 97 bonus · max 111

- Bonus: MEMEING 1.95
- Review (no dictionary backs these; not in the patch): GIMME 3.57 (uncorroborated); EMINEM 3.34 (uncorroborated); MAGEE 2.87 (uncorroborated); NEGAN 2.71 (uncorroborated); NEIMAN 2.65 (uncorroborated); MEENA 2.64 (uncorroborated)

### hb0200 — day 199 (2027-04-10) · letters OACGHIN (center O) · 20 words / 106 bonus · max 79

- **Main-list worthy** (+6 max): HONING 2.79
- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): GONNA 5.29 (wordle-lists only); HANOI 3.39 (uncorroborated); CHONG 3.15 (uncorroborated); OOOOH 2.93 (uncorroborated); IGNACIO 2.9 (uncorroborated); OHHHH 2.9 (uncorroborated); CHICANO 2.85 (wordle-lists only); NOONAN 2.85 (uncorroborated); GANNON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); CINCO 2.81 (uncorroborated); OCHOA 2.81 (uncorroborated); GOOCH 2.72 (uncorroborated); GOHAN 2.7 (uncorroborated); HOGGING 2.68 (wordle-lists only); NOOOOO 2.63 (uncorroborated); ICHIGO 2.61 (uncorroborated); NAGANO 2.6 (uncorroborated); COOGAN 2.59 (uncorroborated); NIHON 2.54 (uncorroborated); GNOCCHI 2.53 (wordle-lists only); GAGNON 2.51 (uncorroborated); OOOOOH 2.51 (uncorroborated)

### hb0201 — day 200 (2027-04-11) · letters OACFINT (center O) · 36 words / 179 bonus · max 190

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): FACTO 3.58 (uncorroborated); FONTANA 2.92 (uncorroborated); ANTONI 2.89 (uncorroborated); NOONAN 2.85 (uncorroborated); FANFICTION 2.82 (uncorroborated); NOOOO 2.82 (uncorroborated); CINCO 2.81 (uncorroborated); CONTI 2.8 (uncorroborated); OFFICIO 2.77 (uncorroborated); ANTONIN 2.68 (uncorroborated); CONCACAF 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); TANTO 2.6 (uncorroborated)

### hb0203 — day 202 (2027-04-13) · letters LAEHMRT (center L) · 48 words / 219 bonus · max 186

- **Main-list worthy** (+12 max): HALLER 2.61, HELMER 2.5
- Bonus: METTLER 2
- Review (no dictionary backs these; not in the patch): HARLEM 3.56 (uncorroborated); HELLA 3.35 (uncorroborated); HALLE 3.21 (uncorroborated); MAHAL 3.2 (uncorroborated); LEMME 3.19 (uncorroborated); LATHAM 3.03 (uncorroborated); THELMA 3.02 (uncorroborated); TERRELL 2.98 (uncorroborated); MATTEL 2.87 (uncorroborated); HALLAM 2.82 (uncorroborated); MAHLER 2.82 (uncorroborated); HARRELL 2.72 (uncorroborated); MARTELL 2.71 (uncorroborated); RAMALLAH 2.65 (uncorroborated); HALLETT 2.63 (uncorroborated); MALALA 2.63 (uncorroborated); ELLER 2.59 (wordle-lists only); HELTER 2.5 (uncorroborated)

### hb0204 — day 203 (2027-04-14) · letters RBELOTU (center R) · 47 words / 245 bonus · max 190

- Bonus: BELLER 2.04
- Review (no dictionary backs these; not in the patch): TERRE 3.07 (uncorroborated); ROLLOUT 3.06 (wordle-lists only); BURRELL 3.02 (uncorroborated); TERRELL 2.98 (uncorroborated); EBERT 2.96 (uncorroborated); EULER 2.79 (uncorroborated); TRURO 2.79 (uncorroborated); TROTT 2.77 (uncorroborated); UTERO 2.7 (uncorroborated); ELLER 2.59 (wordle-lists only); BLOOR 2.54 (uncorroborated)

### hb0205 — day 204 (2027-04-15) · letters RBCEILU (center R) · 23 words / 145 bonus · max 81

- Bonus: BELLER 2.04, CELLER 1.95
- Review (no dictionary backs these; not in the patch): BIEBER 3.7 (uncorroborated); CURRIE 3.08 (uncorroborated); BURRELL 3.02 (uncorroborated); RICCI 2.88 (uncorroborated); LIBRE 2.86 (uncorroborated); EULER 2.79 (uncorroborated); URIBE 2.68 (uncorroborated); LECLERC 2.62 (uncorroborated); ELLER 2.59 (wordle-lists only)

### hb0206 — day 205 (2027-04-16) · letters ADKLRWY (center A) · 21 words / 98 bonus · max 78

- Bonus: DADAR 1.92
- Review (no dictionary backs these; not in the patch): DAKAR 2.98 (uncorroborated); WALLA 2.92 (uncorroborated); DRYWALL 2.9 (wordle-lists only); YARRA 2.81 (uncorroborated); AYALA 2.77 (uncorroborated); AWWWW 2.62 (uncorroborated); WAAAAY 2.61 (uncorroborated); WAYYY 2.58 (uncorroborated); LALLY 2.56 (uncorroborated); ARKADY 2.55 (uncorroborated); WAYYYY 2.53 (uncorroborated); ALLARD 2.52 (uncorroborated)

### hb0207 — day 206 (2027-04-17) · letters AILORTU (center A) · 27 words / 162 bonus · max 110

- Bonus: AUTOR 2.07
- Review (no dictionary backs these; not in the patch): OUTTA 4.1 (uncorroborated); ITALIA 3.39 (uncorroborated); UTTAR 3.22 (uncorroborated); ARTURO 3.1 (uncorroborated); LOLITA 3.07 (wordle-lists only); ATARI 2.98 (uncorroborated); ATTILA 2.89 (uncorroborated); RIALTO 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); LATOUR 2.57 (uncorroborated)

### hb0208 — day 207 (2027-04-18) · letters TCNORUY (center T) · 27 words / 92 bonus · max 106

- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); TRURO 2.79 (uncorroborated); TROTT 2.77 (uncorroborated); TRYON 2.52 (uncorroborated)

### hb0209 — day 208 (2027-04-19) · letters ABIORTV (center A) · 22 words / 128 bonus · max 93

- **Main-list worthy** (+5 max): BABAR 2.61
- Review (no dictionary backs these; not in the patch): ARABIA 4.12 (uncorroborated); ABBOTT 3.78 (uncorroborated); BAVARIA 3.18 (uncorroborated); ATARI 2.98 (uncorroborated); ABABA 2.96 (uncorroborated); BATAVIA 2.72 (uncorroborated); VIRAT 2.64 (uncorroborated); ARORA 2.57 (uncorroborated); BORAT 2.54 (uncorroborated); BARRATT 2.53 (uncorroborated); BRITTA 2.53 (uncorroborated); VITTORIA 2.52 (uncorroborated); BARBA 2.5 (uncorroborated)

### hb0210 — day 209 (2027-04-20) · letters TABEIMN (center T) · 49 words / 209 bonus · max 208

- Review (no dictionary backs these; not in the patch): MEANTIME 4.04 (uncorroborated); BENNETT 4.03 (uncorroborated); ETIENNE 3.1 (uncorroborated); TENNANT 3.09 (uncorroborated); TATIANA 3.07 (uncorroborated); BEATTIE 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); MATTIE 2.79 (uncorroborated); TIANANMEN 2.79 (uncorroborated); EATIN 2.76 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); MANET 2.53 (uncorroborated); TAMAN 2.53 (uncorroborated)

### hb0211 — day 210 (2027-04-21) · letters TDEFILR (center T) · 51 words / 167 bonus · max 221

- **Main-list worthy** (+8 max): DETERRED 2.9
- Bonus: REFITTED 2.37, RETITLED 2.03, FLITTED 2, FILLETED 1.98, DIRTIED 1.93, FRITTERED 1.92, TEETERED 1.9
- Review (no dictionary backs these; not in the patch): REDDIT 3.66 (uncorroborated); TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); TERRELL 2.98 (uncorroborated); RETIREE 2.81 (wordle-lists only); DIRTIER 2.6 (wordle-lists only); LITTLEFIELD 2.57 (uncorroborated)

### hb0212 — day 211 (2027-04-22) · letters NEHIKRT (center N) · 40 words / 124 bonus · max 191

- Bonus: REENTER 2.43
- Review (no dictionary backs these; not in the patch): INTERNET 5.06 (uncorroborated); THINKIN 3.34 (uncorroborated); ETHERNET 3.28 (uncorroborated); HENRIK 3.27 (uncorroborated); ETIENNE 3.1 (uncorroborated); HEINEKEN 3.01 (uncorroborated); RENNIE 2.89 (uncorroborated); RENNER 2.8 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); KIRIN 2.68 (uncorroborated); HEINE 2.65 (uncorroborated); NIKKEI 2.64 (uncorroborated); KENNETT 2.61 (uncorroborated); INTHE 2.58 (uncorroborated); EINER 2.54 (uncorroborated)

### hb0213 — day 212 (2027-04-23) · letters IABELNR (center I) · 36 words / 219 bonus · max 159

- Review (no dictionary backs these; not in the patch): ARABIA 4.12 (uncorroborated); BIEBER 3.7 (uncorroborated); BARBIE 3.56 (uncorroborated); LENIN 3.44 (uncorroborated); AIRBNB 3.32 (uncorroborated); LILLIAN 3.26 (uncorroborated); INLINE 3.18 (wordle-lists only); BARRIE 3.12 (uncorroborated); NEILL 3.01 (uncorroborated); LILLE 2.98 (uncorroborated); ALIBABA 2.96 (uncorroborated); NARNIA 2.93 (uncorroborated); BRIANNA 2.9 (uncorroborated); RENNIE 2.89 (uncorroborated); RAINIER 2.87 (wordle-lists only); LIBRE 2.86 (uncorroborated); BIENNALE 2.85 (uncorroborated); BILAL 2.83 (uncorroborated); LANIER 2.82 (uncorroborated); ABILENE 2.81 (uncorroborated); BAILLIE 2.77 (uncorroborated); BERNIER 2.74 (uncorroborated); LILLIE 2.74 (uncorroborated); BENNIE 2.73 (wordle-lists only); LENNIE 2.7 (uncorroborated); ARIANE 2.67 (wordle-lists only); ARIANNA 2.66 (uncorroborated); NABIL 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); BRIENNE 2.63 (uncorroborated); NAIRA 2.63 (uncorroborated); BELLINI 2.61 (uncorroborated); ILLINI 2.61 (uncorroborated); BALLIN 2.59 (uncorroborated); EINAR 2.57 (uncorroborated); LILIANA 2.55 (uncorroborated); EINER 2.54 (uncorroborated); BELLI 2.53 (uncorroborated); BIRLA 2.52 (uncorroborated); RANIERI 2.51 (uncorroborated); BRIEN 2.5 (uncorroborated)

### hb0214 — day 213 (2027-04-24) · letters EAHILNR (center E) · 40 words / 155 bonus · max 134

- **Main-list worthy** (+6 max): HALLER 2.61
- Bonus: REHIRE 2.24
- Review (no dictionary backs these; not in the patch): LENIN 3.44 (uncorroborated); HERRERA 3.36 (uncorroborated); HELLA 3.35 (uncorroborated); HALLE 3.21 (uncorroborated); INLINE 3.18 (wordle-lists only); LERNER 3.07 (uncorroborated); LEANNE 3.03 (uncorroborated); HELENE 3.02 (uncorroborated); NEILL 3.01 (uncorroborated); LILLE 2.98 (uncorroborated); RENNIE 2.89 (uncorroborated); RAINIER 2.87 (wordle-lists only); HEARN 2.86 (uncorroborated); HARARE 2.85 (uncorroborated); LANIER 2.82 (uncorroborated); RENNER 2.8 (uncorroborated); LILLIE 2.74 (uncorroborated); HARRELL 2.72 (uncorroborated); LENNIE 2.7 (uncorroborated); ARIANE 2.67 (wordle-lists only); HALEN 2.67 (uncorroborated); HEINE 2.65 (uncorroborated); HENAN 2.63 (uncorroborated); ELLER 2.59 (wordle-lists only); HEHEHE 2.58 (uncorroborated); EINAR 2.57 (uncorroborated); EINER 2.54 (uncorroborated); HAILE 2.54 (uncorroborated); HEINLEIN 2.53 (uncorroborated); HILLIER 2.53 (wordle-lists only); NELLA 2.52 (uncorroborated); HALLIE 2.51 (uncorroborated); RANIERI 2.51 (uncorroborated)

### hb0215 — day 214 (2027-04-25) · letters TEILNOU (center T) · 42 words / 176 bonus · max 153

- Review (no dictionary backs these; not in the patch): INTEL 4.07 (uncorroborated); LUTON 3.13 (uncorroborated); TELLIN 3.11 (uncorroborated); ETIENNE 3.1 (uncorroborated); TOULON 3.03 (uncorroborated); TUTTLE 2.96 (uncorroborated); INUIT 2.95 (uncorroborated); LINTON 2.88 (uncorroborated); NIETO 2.87 (uncorroborated); LITTLETON 2.86 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); TINTO 2.63 (uncorroborated); LIEUT 2.57 (uncorroborated); TELNET 2.52 (uncorroborated)

### hb0216 — day 215 (2027-04-26) · letters TEFIORU (center T) · 46 words / 179 bonus · max 171

- Review (no dictionary backs these; not in the patch): TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); FOOTE 2.85 (uncorroborated); RETROFIT 2.83 (uncorroborated); RETIREE 2.81 (wordle-lists only); TRURO 2.79 (uncorroborated); TROTT 2.77 (uncorroborated); UTERO 2.7 (uncorroborated)

### hb0217 — day 216 (2027-04-27) · letters ABELNRU (center A) · 47 words / 266 bonus · max 182

- **Main-list worthy** (+5 max): BABAR 2.61
- Bonus: BABER 2.19, BABUR 1.96
- Review (no dictionary backs these; not in the patch): LAUREN 3.98 (uncorroborated); BRENNAN 3.65 (uncorroborated); BAUER 3.51 (uncorroborated); BRAUN 3.35 (uncorroborated); URBANA 3.13 (uncorroborated); BARRE 3.08 (uncorroborated); LEANNE 3.03 (uncorroborated); ABABA 2.96 (uncorroborated); BUENA 2.96 (uncorroborated); ANNABELLE 2.94 (uncorroborated); NAURU 2.94 (uncorroborated); ARUBA 2.93 (uncorroborated); ANNAN 2.88 (uncorroborated); LALLANA 2.73 (uncorroborated); ARRAN 2.69 (uncorroborated); BERNAL 2.67 (uncorroborated); LAUER 2.67 (uncorroborated); BARBELL 2.65 (wordle-lists only); ABREU 2.64 (uncorroborated); LARUE 2.58 (uncorroborated); BERRA 2.53 (uncorroborated); NELLA 2.52 (uncorroborated); BARBA 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0218 — day 217 (2027-04-28) · letters GAEIMRT (center G) · 38 words / 177 bonus · max 179

- **Main-list worthy** (+7 max): GRAMMER 2.67
- Review (no dictionary backs these; not in the patch): GARRETT 3.67 (uncorroborated); GIMME 3.57 (uncorroborated); GRIMM 3.35 (uncorroborated); GAMERGATE 3.07 (uncorroborated); GEIGER 2.96 (uncorroborated); ARMITAGE 2.94 (uncorroborated); TAGGART 2.94 (uncorroborated); MAGEE 2.87 (uncorroborated); MARGATE 2.75 (wordle-lists only); AMIGA 2.73 (uncorroborated); GREIG 2.65 (uncorroborated); GEERT 2.6 (uncorroborated)

### hb0219 — day 218 (2027-04-29) · letters BAELRTY (center B) · 42 words / 265 bonus · max 177

- **Main-list worthy** (+5 max): BABAR 2.61
- Bonus: BABER 2.19, BELLER 2.04
- Review (no dictionary backs these; not in the patch): BAYER 3.26 (uncorroborated); BEATTY 3.19 (uncorroborated); BARRE 3.08 (uncorroborated); BAYLEY 2.98 (uncorroborated); ABABA 2.96 (uncorroborated); EBERT 2.96 (uncorroborated); BALLARAT 2.9 (uncorroborated); BERETTA 2.71 (uncorroborated); BARBELL 2.65 (wordle-lists only); BEATLE 2.63 (uncorroborated); BEEBE 2.63 (uncorroborated); BEYER 2.63 (uncorroborated); BLATT 2.61 (uncorroborated); BREYER 2.6 (uncorroborated); BARTLEY 2.58 (uncorroborated); BARRATT 2.53 (uncorroborated); BERRA 2.53 (uncorroborated); BARBA 2.5 (uncorroborated)

### hb0220 — day 219 (2027-04-30) · letters REFITUX (center R) · 30 words / 103 bonus · max 115

- Bonus: TEXTER 1.91
- Review (no dictionary backs these; not in the patch): EXETER 3.52 (uncorroborated); TERRE 3.07 (uncorroborated); FERRER 3 (uncorroborated); RITTER 2.99 (uncorroborated); RETIREE 2.81 (wordle-lists only)

### hb0221 — day 220 (2027-05-01) · letters NADILOT (center N) · 25 words / 237 bonus · max 117

- Review (no dictionary backs these; not in the patch): LATINO 3.79 (wordle-lists only); DILLON 3.47 (uncorroborated); LATINA 3.38 (wordle-lists only); NADAL 3.35 (uncorroborated); DOLAN 3.26 (uncorroborated); LILLIAN 3.26 (uncorroborated); ANAND 3.1 (uncorroborated); LANDON 3.1 (uncorroborated); TATIANA 3.07 (uncorroborated); ANTONI 2.89 (uncorroborated); ANNAN 2.88 (uncorroborated); LINTON 2.88 (uncorroborated); NOONAN 2.85 (uncorroborated); NOOOO 2.82 (uncorroborated); ANATOLIA 2.77 (uncorroborated); LANDO 2.75 (uncorroborated); TALLINN 2.75 (uncorroborated); INNIT 2.74 (uncorroborated); DALIAN 2.73 (uncorroborated); LALLANA 2.73 (uncorroborated); TINTIN 2.7 (uncorroborated); INDIO 2.69 (uncorroborated); NOIDA 2.69 (uncorroborated); ANTONIN 2.68 (uncorroborated); DANILO 2.66 (uncorroborated); ADDON 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); ITALIANO 2.62 (uncorroborated); ALTOONA 2.61 (uncorroborated); ILLINI 2.61 (uncorroborated); TANTO 2.6 (uncorroborated); LILIANA 2.55 (uncorroborated); ATALANTA 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0222 — day 221 (2027-05-02) · letters EAGIMNX (center E) · 24 words / 78 bonus · max 105

- Bonus: MEMEING 1.95
- Review (no dictionary backs these; not in the patch): GIMME 3.57 (uncorroborated); EMINEM 3.34 (uncorroborated); MAXINE 3.25 (uncorroborated); MAGEE 2.87 (uncorroborated); NEGAN 2.71 (uncorroborated); MAXIME 2.66 (uncorroborated); NEIMAN 2.65 (uncorroborated); MEENA 2.64 (uncorroborated)

### hb0223 — day 222 (2027-05-03) · letters TDEHMOU (center T) · 24 words / 64 bonus · max 97

- **Main-list worthy** (+5 max): METED 2.56
- Review (no dictionary backs these; not in the patch): MEHMET 2.77 (uncorroborated); METOO 2.75 (uncorroborated); ODETTE 2.58 (uncorroborated)

### hb0224 — day 223 (2027-05-04) · letters OFGINRT (center O) · 37 words / 98 bonus · max 146

- **Main-list worthy** (+16 max): IGNORING 4.04, TROTTING 2.9
- Bonus: GORGING 2.26
- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); GIORGIO 3.24 (uncorroborated); RINGO 3.16 (uncorroborated); TORINO 2.87 (uncorroborated); INFRONT 2.84 (wordle-lists only); NOOOO 2.82 (uncorroborated); NOTTING 2.77 (uncorroborated); RONIN 2.77 (uncorroborated); TROTT 2.77 (uncorroborated); GOTTI 2.7 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); GROTON 2.55 (uncorroborated); GIORNO 2.54 (uncorroborated); GORTON 2.5 (uncorroborated)

### hb0225 — day 224 (2027-05-05) · letters ECMOPTU (center E) · 21 words / 65 bonus · max 77

- Review (no dictionary backs these; not in the patch): MEETUP 3.17 (wordle-lists only); MUPPET 3.08 (wordle-lists only); COMTE 2.91 (uncorroborated); COMME 2.84 (uncorroborated); POMPEO 2.81 (uncorroborated); METOO 2.75 (uncorroborated); EPCOT 2.65 (uncorroborated); PETCO 2.59 (uncorroborated)

### hb0226 — day 225 (2027-05-06) · letters ACEILOR (center A) · 42 words / 193 bonus · max 158

- Review (no dictionary backs these; not in the patch): CARROLL 3.8 (uncorroborated); ACCRA 3.04 (uncorroborated); CALLIE 2.97 (uncorroborated); CALLE 2.91 (uncorroborated); LEICA 2.79 (uncorroborated); CARRERA 2.77 (uncorroborated); OREAL 2.71 (uncorroborated); ALCOA 2.67 (uncorroborated); OCALA 2.61 (uncorroborated); CARRILLO 2.6 (uncorroborated); RACECAR 2.58 (uncorroborated); ARORA 2.57 (uncorroborated); ROCCA 2.55 (uncorroborated); LORELAI 2.54 (uncorroborated); CARLE 2.53 (uncorroborated); LORCA 2.53 (uncorroborated)

### hb0227 — day 226 (2027-05-07) · letters PCDEIOR (center P) · 45 words / 154 bonus · max 166

- **Main-list worthy** (+27 max): PREPPED 2.91, PRODDED 2.59, DRIPPED 2.56, POOPER 2.56
- Bonus: COOPED 2.47, PREPPER 2.3, DROOPED 1.91
- Review (no dictionary backs these; not in the patch): OPIOID 3.33 (wordle-lists only); PIERO 3.01 (uncorroborated); PRIORI 2.78 (uncorroborated); PEIRCE 2.77 (uncorroborated); RECEP 2.66 (uncorroborated); PREORDERED 2.56 (uncorroborated); POIRIER 2.5 (uncorroborated)

### hb0228 — day 227 (2027-05-08) · letters VCDEINO (center V) · 36 words / 54 bonus · max 217

- Bonus: VIDEOED 1.97
- Review (no dictionary backs these; not in the patch): VINCI 3.29 (uncorroborated); DEVINE 3.03 (uncorroborated); VINNIE 2.93 (uncorroborated); VIVIENNE 2.81 (uncorroborated); VIVIEN 2.75 (uncorroborated); EEVEE 2.56 (uncorroborated); OVIEDO 2.54 (uncorroborated); VICODIN 2.54 (uncorroborated); VIVENDI 2.52 (uncorroborated)

### hb0229 — day 228 (2027-05-09) · letters PACDEHT (center P) · 27 words / 68 bonus · max 104

- Review (no dictionary backs these; not in the patch): DEPECHE 2.65 (uncorroborated); PEPPA 2.61 (uncorroborated); PEETA 2.56 (uncorroborated)

### hb0230 — day 229 (2027-05-10) · letters ECIMNTX (center E) · 32 words / 76 bonus · max 123

- Review (no dictionary backs these; not in the patch): EMINEM 3.34 (uncorroborated); ETIENNE 3.1 (uncorroborated); TENCENT 2.81 (uncorroborated)

### hb0231 — day 230 (2027-05-11) · letters ABDEKRY (center A) · 55 words / 176 bonus · max 211

- **Main-list worthy** (+12 max): BABAR 2.61, ARRAYED 2.57
- Bonus: BABER 2.19, DADAR 1.92
- Review (no dictionary backs these; not in the patch): AKBAR 3.29 (uncorroborated); BAYER 3.26 (uncorroborated); BARRE 3.08 (uncorroborated); DAKAR 2.98 (uncorroborated); ABABA 2.96 (uncorroborated); YARRA 2.81 (uncorroborated); READE 2.73 (uncorroborated); BARAK 2.71 (uncorroborated); BARAKA 2.61 (uncorroborated); ARKADY 2.55 (uncorroborated); BERRA 2.53 (uncorroborated); BARBA 2.5 (uncorroborated)

### hb0232 — day 231 (2027-05-12) · letters EABLMRU (center E) · 51 words / 259 bonus · max 188

- Bonus: BALMER 2.38, BABER 2.19, BELLER 2.04
- Review (no dictionary backs these; not in the patch): MUELLER 3.61 (uncorroborated); BAUER 3.51 (uncorroborated); LEMME 3.19 (uncorroborated); BARRE 3.08 (uncorroborated); BURRELL 3.02 (uncorroborated); ALBEMARLE 2.79 (uncorroborated); EULER 2.79 (uncorroborated); MEERA 2.77 (uncorroborated); MARBELLA 2.7 (uncorroborated); LAUER 2.67 (uncorroborated); BARBELL 2.65 (wordle-lists only); ABREU 2.64 (uncorroborated); BEEBE 2.63 (uncorroborated); ELLER 2.59 (wordle-lists only); MAURER 2.59 (uncorroborated); BUELL 2.58 (uncorroborated); LARUE 2.58 (uncorroborated); BREMER 2.56 (uncorroborated); BERRA 2.53 (uncorroborated); BLUME 2.53 (uncorroborated)

### hb0233 — day 232 (2027-05-13) · letters KCEILRT (center K) · 21 words / 96 bonus · max 94

- Review (no dictionary backs these; not in the patch): KELLER 3.58 (uncorroborated); RIKER 2.83 (uncorroborated); RICKIE 2.78 (uncorroborated); TRICKIER 2.75 (uncorroborated); KELLIE 2.69 (uncorroborated); KRILL 2.63 (uncorroborated); ECKERT 2.61 (uncorroborated); REIKI 2.59 (uncorroborated); KIRILL 2.51 (uncorroborated); TIKRIT 2.5 (uncorroborated)

### hb0234 — day 233 (2027-05-14) · letters MFINORU (center M) · 20 words / 53 bonus · max 84

- Review (no dictionary backs these; not in the patch): MUNRO 3.15 (uncorroborated); MORNIN 3.07 (uncorroborated); FROMM 2.66 (uncorroborated); FIRMINO 2.51 (uncorroborated)

### hb0235 — day 234 (2027-05-15) · letters OAELRTV (center O) · 46 words / 190 bonus · max 174

- Review (no dictionary backs these; not in the patch): VOLVO 3.48 (uncorroborated); LORETTA 3.27 (uncorroborated); LOVELL 2.97 (uncorroborated); ROLLOVER 2.85 (uncorroborated); ALVARO 2.84 (uncorroborated); LOVATO 2.83 (uncorroborated); TRAVOLTA 2.81 (uncorroborated); LOVETT 2.79 (uncorroborated); TROTT 2.77 (uncorroborated); OREAL 2.71 (uncorroborated); LAVROV 2.66 (uncorroborated); TEATRO 2.63 (uncorroborated); LOLOL 2.58 (uncorroborated); ARORA 2.57 (uncorroborated)

### hb0236 — day 235 (2027-05-16) · letters LACDEKT (center L) · 35 words / 126 bonus · max 124

- Review (no dictionary backs these; not in the patch): CALLE 2.91 (uncorroborated); DALEK 2.83 (uncorroborated); DELLE 2.78 (uncorroborated); ALCATEL 2.63 (uncorroborated); CELTA 2.62 (uncorroborated)

### hb0237 — day 236 (2027-05-17) · letters OABLPRY (center O) · 28 words / 130 bonus · max 106

- Review (no dictionary backs these; not in the patch): BAYLOR 3.43 (uncorroborated); PRYOR 3.16 (uncorroborated); LOYOLA 3.07 (uncorroborated); PROLLY 3.04 (uncorroborated); LOLOL 2.58 (uncorroborated); ARORA 2.57 (uncorroborated); BLOOR 2.54 (uncorroborated); POOPY 2.5 (uncorroborated)

### hb0238 — day 237 (2027-05-18) · letters VCEGNOR (center V) · 25 words / 50 bonus · max 145

- **Main-list worthy** (+6 max): GROVER 3.22
- Review (no dictionary backs these; not in the patch): EEVEE 2.56 (uncorroborated); NEGEV 2.55 (uncorroborated)

### hb0239 — day 238 (2027-05-19) · letters MAEGHOR (center M) · 32 words / 124 bonus · max 119

- **Main-list worthy** (+12 max): GRAMMER 2.67, HAMER 2.6
- Bonus: REHOME 2.05
- Review (no dictionary backs these; not in the patch): HARAM 3.43 (uncorroborated); MOMMA 3.41 (uncorroborated); MAHER 3.33 (uncorroborated); HOMME 2.93 (uncorroborated); AMORE 2.91 (uncorroborated); ARMAGH 2.91 (uncorroborated); MAGEE 2.87 (uncorroborated); RAHEEM 2.86 (uncorroborated); MEERA 2.77 (uncorroborated); GORHAM 2.58 (uncorroborated); GRAHAME 2.56 (uncorroborated); HOMEROOM 2.54 (uncorroborated); GOMORRAH 2.5 (uncorroborated)

### hb0240 — day 239 (2027-05-20) · letters MEIOPRT (center M) · 51 words / 188 bonus · max 221

- Bonus: TOMER 1.91
- Review (no dictionary backs these; not in the patch): PRIMETIME 3.21 (uncorroborated); MORTEM 3.16 (uncorroborated); MERRITT 3.14 (uncorroborated); POMPEO 2.81 (uncorroborated); METOO 2.75 (uncorroborated); PRETERM 2.75 (wordle-lists only); TEMPORE 2.67 (uncorroborated); MERRIER 2.64 (wordle-lists only); MORETTI 2.64 (uncorroborated); REIMER 2.61 (uncorroborated); TOMMIE 2.51 (uncorroborated)

### hb0241 — day 240 (2027-05-21) · letters FADELTU (center F) · 34 words / 70 bonus · max 109

- Review (no dictionary backs these; not in the patch): FALAFEL 2.64 (wordle-lists only); FATALE 2.59 (uncorroborated)

### hb0242 — day 241 (2027-05-22) · letters OAEPRTY (center O) · 51 words / 215 bonus · max 243

- **Main-list worthy** (+6 max): POOPER 2.56
- Bonus: TROYER 2.07
- Review (no dictionary backs these; not in the patch): TOYOTA 3.95 (uncorroborated); PRYOR 3.16 (uncorroborated); PORTE 3.13 (uncorroborated); PETRO 2.94 (uncorroborated); TORREY 2.89 (uncorroborated); TROTT 2.77 (uncorroborated); TEATRO 2.63 (uncorroborated); PEROT 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); POTRO 2.57 (uncorroborated); PARETO 2.5 (uncorroborated); POOPY 2.5 (uncorroborated)

### hb0243 — day 242 (2027-05-23) · letters MACIORT (center M) · 32 words / 133 bonus · max 116

- Review (no dictionary backs these; not in the patch): MOMMA 3.41 (uncorroborated); MARRIOTT 3.35 (uncorroborated); TACOMA 3.28 (uncorroborated); CAMARO 3.09 (uncorroborated); MATIC 3.06 (uncorroborated); MARIAM 2.7 (uncorroborated); MARIOTA 2.69 (uncorroborated); AMATO 2.67 (uncorroborated); AMIRA 2.62 (uncorroborated); MIRAMAR 2.61 (uncorroborated); MORATA 2.57 (uncorroborated); AMARI 2.56 (uncorroborated); MIRAI 2.54 (uncorroborated); MOTTA 2.54 (uncorroborated); MARAT 2.51 (uncorroborated); TAMIR 2.51 (uncorroborated); TOMAR 2.51 (uncorroborated); MARCA 2.5 (uncorroborated)

### hb0244 — day 243 (2027-05-24) · letters CEGINRT (center C) · 23 words / 114 bonus · max 127

- **Main-list worthy** (+23 max): INCITING 3.17, RECITING 3.12 ★pangram
- Review (no dictionary backs these; not in the patch): RICCI 2.88 (uncorroborated); TENCENT 2.81 (uncorroborated); CRITTER 2.77 (wordle-lists only)

### hb0245 — day 244 (2027-05-25) · letters ACDILOR (center A) · 38 words / 196 bonus · max 135

- Bonus: DOLLARD 1.95, DADAR 1.92
- Review (no dictionary backs these; not in the patch): CARROLL 3.8 (uncorroborated); CADILLAC 3.48 (uncorroborated); DALAI 3.28 (uncorroborated); ACCRA 3.04 (uncorroborated); LILLARD 2.82 (uncorroborated); ROALD 2.79 (uncorroborated); CARDI 2.77 (uncorroborated); RICCARDO 2.75 (uncorroborated); DILLARD 2.72 (uncorroborated); RICCIARDO 2.7 (uncorroborated); ALCOA 2.67 (uncorroborated); LIDAR 2.65 (uncorroborated); OCALA 2.61 (uncorroborated); CARRILLO 2.6 (uncorroborated); DIRAC 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); DIARIO 2.55 (uncorroborated); ROCCA 2.55 (uncorroborated); LORCA 2.53 (uncorroborated); ALLARD 2.52 (uncorroborated)

### hb0246 — day 245 (2027-05-26) · letters OCDEHIM (center O) · 23 words / 70 bonus · max 82

- Bonus: COMED 1.92
- Review (no dictionary backs these; not in the patch): HOMME 2.93 (uncorroborated); OOOOH 2.93 (uncorroborated); OHHHH 2.9 (uncorroborated); COMME 2.84 (uncorroborated); CODEC 2.67 (uncorroborated); MODDED 2.67 (wordle-lists only); HIDEO 2.61 (uncorroborated); OOOOOH 2.51 (uncorroborated)

### hb0247 — day 246 (2027-05-27) · letters OAGLMPY (center O) · 20 words / 102 bonus · max 70

- Review (no dictionary backs these; not in the patch): MOMMA 3.41 (uncorroborated); LOYOLA 3.07 (uncorroborated); GALLO 3.05 (uncorroborated); PALOMA 2.8 (uncorroborated); GOPAL 2.71 (uncorroborated); MOLLOY 2.69 (uncorroborated); LOLOL 2.58 (uncorroborated); GOGOL 2.55 (uncorroborated); MALMO 2.5 (uncorroborated); POOPY 2.5 (uncorroborated)

### hb0248 — day 247 (2027-05-28) · letters PAILOTU (center P) · 25 words / 145 bonus · max 87

- Review (no dictionary backs these; not in the patch): PAPUA 3.42 (uncorroborated); PLATA 2.88 (uncorroborated); POPUP 2.78 (wordle-lists only); LUPITA 2.7 (uncorroborated); TILAPIA 2.64 (wordle-lists only); PATIL 2.62 (uncorroborated); PULLOUT 2.59 (wordle-lists only)

### hb0249 — day 248 (2027-05-29) · letters TACEFIL (center T) · 43 words / 179 bonus · max 173

- Review (no dictionary backs these; not in the patch): ITALIA 3.39 (uncorroborated); FACELIFT 2.93 (uncorroborated); ATTILA 2.89 (uncorroborated); ATTICA 2.74 (uncorroborated); LATIF 2.67 (uncorroborated); ALCATEL 2.63 (uncorroborated); CELTA 2.62 (uncorroborated); FATALE 2.59 (uncorroborated)

### hb0250 — day 249 (2027-05-30) · letters KABCERT (center K) · 30 words / 93 bonus · max 138

- Review (no dictionary backs these; not in the patch): BARACK 3.96 (uncorroborated); BECKETT 3.42 (uncorroborated); AKBAR 3.29 (uncorroborated); RACETRACK 3.02 (uncorroborated); BARAK 2.71 (uncorroborated); TAREK 2.71 (uncorroborated); KARAT 2.63 (uncorroborated); KERBER 2.63 (uncorroborated); BARAKA 2.61 (uncorroborated); ECKERT 2.61 (uncorroborated); BRACKETT 2.52 (uncorroborated)

### hb0251 — day 250 (2027-05-31) · letters HACDEOT (center H) · 39 words / 96 bonus · max 187

- Bonus: THATD 1.99
- Review (no dictionary backs these; not in the patch): HAHAHA 3.81 (uncorroborated); HAHAHAHA 3.23 (uncorroborated); TAHOE 3.2 (uncorroborated); HAHAH 3.08 (uncorroborated); AHHHH 2.93 (uncorroborated); OOOOH 2.93 (uncorroborated); OHHHH 2.9 (uncorroborated); HAHAHAHAHA 2.81 (uncorroborated); OCHOA 2.81 (uncorroborated); HADDAD 2.63 (uncorroborated); AHAHA 2.62 (uncorroborated); HAHAHAH 2.62 (uncorroborated); HACHETTE 2.6 (uncorroborated); HEATHCOTE 2.6 (uncorroborated); HECHT 2.6 (uncorroborated); HEHEHE 2.58 (uncorroborated); AAAAH 2.57 (uncorroborated); AHHHHH 2.54 (uncorroborated); CHEETO 2.51 (uncorroborated); OOOOOH 2.51 (uncorroborated)

### hb0252 — day 251 (2027-06-01) · letters TAEFILN (center T) · 55 words / 256 bonus · max 227

- Review (no dictionary backs these; not in the patch): INTEL 4.07 (uncorroborated); ITALIA 3.39 (uncorroborated); LATINA 3.38 (wordle-lists only); ANTIFA 3.2 (uncorroborated); NAFTA 3.14 (uncorroborated); TELLIN 3.11 (uncorroborated); ETIENNE 3.1 (uncorroborated); TENNANT 3.09 (uncorroborated); TATIANA 3.07 (uncorroborated); ATTILA 2.89 (uncorroborated); AETNA 2.86 (uncorroborated); EATIN 2.76 (uncorroborated); INFINITI 2.76 (uncorroborated); TALLINN 2.75 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); LATIF 2.67 (uncorroborated); TITANFALL 2.63 (uncorroborated); FATALE 2.59 (uncorroborated); ENFANT 2.53 (uncorroborated); FANTA 2.52 (uncorroborated); TELNET 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated)

### hb0253 — day 252 (2027-06-02) · letters ACELNRV (center A) · 59 words / 223 bonus · max 239

- Bonus: NAVER 2.47, LAVAR 2.2
- Review (no dictionary backs these; not in the patch): ACCRA 3.04 (uncorroborated); LEANNE 3.03 (uncorroborated); VALLE 2.94 (uncorroborated); CALLE 2.91 (uncorroborated); ANNAN 2.88 (uncorroborated); CANAVERAL 2.8 (uncorroborated); LAVAL 2.8 (uncorroborated); CARRERA 2.77 (uncorroborated); LAVERNE 2.77 (uncorroborated); CARNE 2.76 (uncorroborated); LALLANA 2.73 (uncorroborated); NAVARRE 2.72 (uncorroborated); ARRAN 2.69 (uncorroborated); RAVENNA 2.65 (uncorroborated); CALLAN 2.62 (uncorroborated); RACECAR 2.58 (uncorroborated); VALERA 2.54 (uncorroborated); CARLE 2.53 (uncorroborated); CAVAN 2.53 (uncorroborated); CARNAVAL 2.52 (uncorroborated); NELLA 2.52 (uncorroborated); VELLA 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0254 — day 253 (2027-06-03) · letters PAINOTU (center P) · 25 words / 132 bonus · max 106

- Review (no dictionary backs these; not in the patch): PUTIN 4.13 (uncorroborated); PAPUA 3.42 (uncorroborated); PATTON 3.4 (uncorroborated); NIPPON 2.95 (uncorroborated); TIPTON 2.85 (uncorroborated); PATNA 2.84 (uncorroborated); POPUP 2.78 (wordle-lists only); PUTTIN 2.73 (uncorroborated); PONTA 2.56 (uncorroborated); TAPPAN 2.54 (uncorroborated)

### hb0255 — day 254 (2027-06-04) · letters EGLOPRU (center E) · 37 words / 175 bonus · max 131

- **Main-list worthy** (+6 max): POOPER 2.56
- Bonus: PREPPER 2.3
- Review (no dictionary backs these; not in the patch): EUROPE 5.04 (wordle-lists only); POOLE 3.34 (uncorroborated); GUERRERO 3.17 (uncorroborated); GELLER 2.93 (uncorroborated); EULER 2.79 (uncorroborated); GUERRE 2.73 (uncorroborated); RUGER 2.68 (wordle-lists only); ELLER 2.59 (wordle-lists only); PELLE 2.56 (uncorroborated)

### hb0256 — day 255 (2027-06-05) · letters EBGILNO (center E) · 36 words / 153 bonus · max 160

- Review (no dictionary backs these; not in the patch): NOBEL 3.84 (uncorroborated); LENNON 3.56 (uncorroborated); LENIN 3.44 (uncorroborated); GEELONG 3.28 (uncorroborated); BIGGIE 3.18 (wordle-lists only); INLINE 3.18 (wordle-lists only); ELGIN 3.17 (uncorroborated); NOONE 3.08 (uncorroborated); BELLO 3.02 (uncorroborated); NEILL 3.01 (uncorroborated); ENGEL 3 (uncorroborated); LILLE 2.98 (uncorroborated); LONNIE 2.91 (uncorroborated); NOELLE 2.78 (uncorroborated); BENNING 2.74 (uncorroborated); LILLIE 2.74 (uncorroborated); BENNIE 2.73 (wordle-lists only); LENNIE 2.7 (uncorroborated); BONNE 2.67 (uncorroborated); BLIGE 2.64 (uncorroborated); BEEBE 2.63 (uncorroborated); BELLINI 2.61 (uncorroborated); ENGLE 2.57 (uncorroborated); GLENELG 2.57 (uncorroborated); BENIGNO 2.55 (uncorroborated); BELLI 2.53 (uncorroborated); GLENNON 2.53 (uncorroborated); LEONIE 2.53 (uncorroborated); LEONG 2.52 (uncorroborated)

### hb0257 — day 256 (2027-06-06) · letters LABEGMR (center L) · 46 words / 234 bonus · max 182

- Bonus: BALMER 2.38, GABLER 2.21, BELLER 2.04
- Review (no dictionary backs these; not in the patch): LEMME 3.19 (uncorroborated); GELLER 2.93 (uncorroborated); ALBEMARLE 2.79 (uncorroborated); ELGAR 2.75 (uncorroborated); MARBELLA 2.7 (uncorroborated); ALEGRE 2.69 (uncorroborated); BALLGAME 2.69 (uncorroborated); BARBELL 2.65 (wordle-lists only); MALALA 2.63 (uncorroborated); ALGER 2.62 (uncorroborated); ELLER 2.59 (wordle-lists only); ALLEGRA 2.57 (uncorroborated); GAMAL 2.5 (uncorroborated)

### hb0258 — day 257 (2027-06-07) · letters TAEIMOV (center T) · 27 words / 86 bonus · max 81

- Review (no dictionary backs these; not in the patch): MATTEO 3.15 (uncorroborated); MATTIE 2.79 (uncorroborated); METOO 2.75 (uncorroborated); AMATO 2.67 (uncorroborated); MOTTA 2.54 (uncorroborated); TOMMIE 2.51 (uncorroborated)

### hb0259 — day 258 (2027-06-08) · letters LEGINUV (center L) · 26 words / 90 bonus · max 92

- **Main-list worthy** (+6 max): GLUING 2.58
- Review (no dictionary backs these; not in the patch): LEVINE 3.46 (uncorroborated); LENIN 3.44 (uncorroborated); LIVIN 3.19 (uncorroborated); INLINE 3.18 (wordle-lists only); ELGIN 3.17 (uncorroborated); NEILL 3.01 (uncorroborated); ENGEL 3 (uncorroborated); LILLE 2.98 (uncorroborated); LIGUE 2.96 (uncorroborated); LILLIE 2.74 (uncorroborated); LENNIE 2.7 (uncorroborated); ELVEN 2.63 (uncorroborated); VILLENEUVE 2.63 (uncorroborated); ILLINI 2.61 (uncorroborated); ENGLE 2.57 (uncorroborated); GLENELG 2.57 (uncorroborated); LUGGING 2.57 (wordle-lists only); LEUVEN 2.53 (uncorroborated)

### hb0261 — day 260 (2027-06-10) · letters CADEMNO (center C) · 43 words / 108 bonus · max 226

- Bonus: COMED 1.92
- Review (no dictionary backs these; not in the patch): MONACO 3.65 (uncorroborated); CAMDEN 3.53 (uncorroborated); MCCANN 3.29 (uncorroborated); COMME 2.84 (uncorroborated); CONDON 2.79 (uncorroborated); CONDE 2.77 (uncorroborated); CODEC 2.67 (uncorroborated); CONMAN 2.63 (wordle-lists only); CODENAME 2.6 (uncorroborated); DECCAN 2.59 (uncorroborated); CODENAMED 2.57 (uncorroborated); MANCE 2.57 (uncorroborated); MCADOO 2.53 (uncorroborated); DECCA 2.51 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0262 — day 261 (2027-06-11) · letters OBILNTY (center O) · 26 words / 93 bonus · max 76

- Review (no dictionary backs these; not in the patch): BOLTON 3.65 (uncorroborated); LINTON 2.88 (uncorroborated); NOOOO 2.82 (uncorroborated); BOYNTON 2.65 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); LYTTON 2.62 (uncorroborated); LOLOL 2.58 (uncorroborated); ILOILO 2.5 (uncorroborated)

### hb0263 — day 262 (2027-06-12) · letters EAOQRTU (center E) · 29 words / 137 bonus · max 136

- Review (no dictionary backs these; not in the patch): TERRE 3.07 (uncorroborated); QUETTA 2.87 (uncorroborated); UTERO 2.7 (uncorroborated); TEATRO 2.63 (uncorroborated); ARTETA 2.6 (uncorroborated); TARTE 2.59 (uncorroborated); ARQUETTE 2.53 (uncorroborated)

### hb0264 — day 263 (2027-06-13) · letters TADEORV (center T) · 51 words / 218 bonus · max 240

- **Main-list worthy** (+15 max): DETERRED 2.9, TROTTED 2.71
- Bonus: TEETERED 1.9
- Review (no dictionary backs these; not in the patch): TERRE 3.07 (uncorroborated); ROTTED 2.82 (wordle-lists only); TROTT 2.77 (uncorroborated); TEATRO 2.63 (uncorroborated); ARTETA 2.6 (uncorroborated); TARTE 2.59 (uncorroborated); ODETTE 2.58 (uncorroborated)

### hb0265 — day 264 (2027-06-14) · letters MDGILNO (center M) · 21 words / 42 bonus · max 84

- **Main-list worthy** (+8 max): MINGLING 2.86
- Bonus: DOOMING 1.98, MONOD 1.91
- Review (no dictionary backs these; not in the patch): DOMINGO 3.21 (uncorroborated); DIGIMON 2.8 (uncorroborated); MONDO 2.79 (uncorroborated); LOMOND 2.64 (uncorroborated); DIMMING 2.62 (wordle-lists only); DOMINI 2.61 (uncorroborated); MODDING 2.5 (wordle-lists only)

### hb0266 — day 265 (2027-06-15) · letters LAIMOPT (center L) · 36 words / 153 bonus · max 92

- Review (no dictionary backs these; not in the patch): ITALIA 3.39 (uncorroborated); LOLITA 3.07 (wordle-lists only); ATTILA 2.89 (uncorroborated); PLATA 2.88 (uncorroborated); PALOMA 2.8 (uncorroborated); TILAPIA 2.64 (wordle-lists only); MALALA 2.63 (uncorroborated); PATIL 2.62 (uncorroborated); LOLOL 2.58 (uncorroborated); AMALIA 2.51 (uncorroborated); LIMPOPO 2.51 (uncorroborated); MITTAL 2.51 (uncorroborated); ILOILO 2.5 (uncorroborated); MALMO 2.5 (uncorroborated)

### hb0267 — day 266 (2027-06-16) · letters TAILPRY (center T) · 25 words / 149 bonus · max 93

- Review (no dictionary backs these; not in the patch): ITALIA 3.39 (uncorroborated); ATARI 2.98 (uncorroborated); ATTILA 2.89 (uncorroborated); PLATA 2.88 (uncorroborated); TRIPP 2.88 (uncorroborated); TRIPPY 2.86 (wordle-lists only); PARTI 2.77 (uncorroborated); PATTAYA 2.69 (uncorroborated); TRAPP 2.66 (uncorroborated); TILAPIA 2.64 (wordle-lists only); PATIL 2.62 (uncorroborated); TAYYIP 2.58 (uncorroborated); YALTA 2.57 (uncorroborated); YATRA 2.52 (uncorroborated)

### hb0268 — day 267 (2027-06-17) · letters PABEFLR (center P) · 33 words / 107 bonus · max 148

- Bonus: PREPPER 2.3
- Review (no dictionary backs these; not in the patch): BLEEP 3.08 (uncorroborated); PAELLA 2.63 (wordle-lists only); PEPPA 2.61 (uncorroborated); PELLE 2.56 (uncorroborated); APPEL 2.53 (uncorroborated)

### hb0269 — day 268 (2027-06-18) · letters ADELNRV (center A) · 57 words / 237 bonus · max 214

- **Main-list worthy** (+6 max): RENARD 2.67
- Bonus: NAVER 2.47, LAVAR 2.2, NAVEED 2.1, DADAR 1.92
- Review (no dictionary backs these; not in the patch): ADLER 3.36 (uncorroborated); NADAL 3.35 (uncorroborated); VADER 3.29 (wordle-lists only); LELAND 3.19 (uncorroborated); ANAND 3.1 (uncorroborated); LEANNE 3.03 (uncorroborated); VALLE 2.94 (uncorroborated); NADER 2.9 (uncorroborated); ANNAN 2.88 (uncorroborated); ADDERALL 2.87 (uncorroborated); DARLENE 2.87 (uncorroborated); DEANDRE 2.86 (uncorroborated); DEANNA 2.85 (uncorroborated); ANDRADE 2.8 (uncorroborated); DARNELL 2.8 (uncorroborated); LAVAL 2.8 (uncorroborated); LAVERNE 2.77 (uncorroborated); LALLANA 2.73 (uncorroborated); READE 2.73 (uncorroborated); ALLENDE 2.72 (uncorroborated); NAVARRE 2.72 (uncorroborated); VALVERDE 2.7 (uncorroborated); ARRAN 2.69 (uncorroborated); ANDER 2.66 (wordle-lists only); RAVENNA 2.65 (uncorroborated); NEDERLAND 2.6 (uncorroborated); EDVARD 2.58 (uncorroborated); VERLANDER 2.56 (uncorroborated); VANDER 2.55 (uncorroborated); DARDEN 2.54 (uncorroborated); VALERA 2.54 (uncorroborated); ALLARD 2.52 (uncorroborated); NELLA 2.52 (uncorroborated); VELLA 2.51 (uncorroborated); EVANDER 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0270 — day 269 (2027-06-19) · letters IFLOPRT (center I) · 21 words / 75 bonus · max 70

- Review (no dictionary backs these; not in the patch): POIROT 2.89 (uncorroborated); TRIPP 2.88 (uncorroborated); PRIORI 2.78 (uncorroborated); LIFTOFF 2.68 (wordle-lists only); PIRLO 2.64 (uncorroborated); ILOILO 2.5 (uncorroborated)

### hb0271 — day 270 (2027-06-20) · letters ECIQRTU (center E) · 28 words / 130 bonus · max 130

- Review (no dictionary backs these; not in the patch): CURRIE 3.08 (uncorroborated); TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); RETIREE 2.81 (wordle-lists only); CRITTER 2.77 (wordle-lists only)

### hb0272 — day 271 (2027-06-21) · letters ACGINRY (center A) · 32 words / 147 bonus · max 145

- **Main-list worthy** (+21 max): ARRANGING 3.55, NAGAR 3.07, GRACING 2.5
- Bonus: RARING 2.45, CRANING 1.92
- Review (no dictionary backs these; not in the patch): GARCIA 3.89 (uncorroborated); RICAN 3.43 (uncorroborated); ACCRA 3.04 (uncorroborated); GAGGING 2.93 (wordle-lists only); NARNIA 2.93 (uncorroborated); GIANNI 2.91 (uncorroborated); ANNAN 2.88 (uncorroborated); YARRA 2.81 (uncorroborated); RYANAIR 2.73 (uncorroborated); NARAYAN 2.72 (uncorroborated); ICANN 2.7 (uncorroborated); ARRAN 2.69 (uncorroborated); ARIANNA 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); NAIRA 2.63 (uncorroborated); CIARAN 2.53 (uncorroborated); NIGRA 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0273 — day 272 (2027-06-22) · letters ABLMNOR (center A) · 33 words / 182 bonus · max 117

- **Main-list worthy** (+5 max): BABAR 2.61
- Bonus: NOMAR 2
- Review (no dictionary backs these; not in the patch): OBAMA 4.86 (uncorroborated); MOMMA 3.41 (uncorroborated); MARLON 3.21 (uncorroborated); BARRON 3.15 (uncorroborated); BANNON 3.12 (uncorroborated); ROMANO 3.07 (wordle-lists only); RONAN 3.06 (uncorroborated); MARLBORO 3.02 (uncorroborated); ABABA 2.96 (uncorroborated); BALLON 2.91 (uncorroborated); ANNAN 2.88 (uncorroborated); NOONAN 2.85 (uncorroborated); MOANA 2.76 (uncorroborated); LALLANA 2.73 (uncorroborated); ALLMAN 2.7 (uncorroborated); MANOLO 2.7 (uncorroborated); ARRAN 2.69 (uncorroborated); MALALA 2.63 (uncorroborated); LAMBO 2.61 (uncorroborated); ARORA 2.57 (uncorroborated); BAMBA 2.56 (uncorroborated); ROMANA 2.56 (uncorroborated); BARBA 2.5 (uncorroborated); MALMO 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0274 — day 273 (2027-06-23) · letters EFIOPRW (center E) · 35 words / 96 bonus · max 109

- **Main-list worthy** (+6 max): POOPER 2.56
- Bonus: PREPPER 2.3
- Review (no dictionary backs these; not in the patch): PIERO 3.01 (uncorroborated); FERRER 3 (uncorroborated); PFEIFFER 2.96 (uncorroborated); FERRO 2.74 (uncorroborated); POIRIER 2.5 (uncorroborated)

### hb0275 — day 274 (2027-06-24) · letters TACILMN (center T) · 26 words / 156 bonus · max 122

- Review (no dictionary backs these; not in the patch): ITALIA 3.39 (uncorroborated); LATINA 3.38 (wordle-lists only); CAITLIN 3.31 (uncorroborated); TATIANA 3.07 (uncorroborated); MATIC 3.06 (uncorroborated); ALTMAN 2.96 (uncorroborated); CATANIA 2.9 (uncorroborated); ATTILA 2.89 (uncorroborated); TILLMAN 2.83 (uncorroborated); TALLINN 2.75 (uncorroborated); ATTICA 2.74 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); TAMAN 2.53 (uncorroborated); ATALANTA 2.51 (uncorroborated); MITTAL 2.51 (uncorroborated)

### hb0276 — day 275 (2027-06-25) · letters MABEGIN (center M) · 28 words / 127 bonus · max 118

- **Main-list worthy** (+17 max): MANAGING 4.4, IMAGINING 3.65
- Bonus: IMBIBING 2.13, MEMEING 1.95
- Review (no dictionary backs these; not in the patch): GIMME 3.57 (uncorroborated); EMINEM 3.34 (uncorroborated); NAMIBIA 3.25 (uncorroborated); MAGEE 2.87 (uncorroborated); GANGNAM 2.79 (uncorroborated); GAIMAN 2.76 (uncorroborated); AMIGA 2.73 (uncorroborated); AMBIEN 2.72 (uncorroborated); INMAN 2.72 (uncorroborated); AMINA 2.7 (uncorroborated); NEIMAN 2.65 (uncorroborated); MEENA 2.64 (uncorroborated); BAMBA 2.56 (uncorroborated)

### hb0277 — day 276 (2027-06-26) · letters EACKLMR (center E) · 50 words / 208 bonus · max 173

- **Main-list worthy** (+6 max): CRAMER 2.93
- Bonus: CELLER 1.95
- Review (no dictionary backs these; not in the patch): CLARKE 4.05 (uncorroborated); KELLER 3.58 (uncorroborated); KERALA 3.53 (uncorroborated); KRAMER 3.45 (uncorroborated); MERKEL 3.4 (uncorroborated); LEMME 3.19 (uncorroborated); CREME 3.12 (uncorroborated); KAREEM 3.05 (uncorroborated); MERCK 3.03 (uncorroborated); MCKEE 2.99 (uncorroborated); CALLE 2.91 (uncorroborated); MALEK 2.78 (uncorroborated); CARRERA 2.77 (uncorroborated); MEERA 2.77 (uncorroborated); MCRAE 2.7 (uncorroborated); MACRAE 2.64 (uncorroborated); LECLERC 2.62 (uncorroborated); MARKLE 2.6 (uncorroborated); ELLER 2.59 (wordle-lists only); RACECAR 2.58 (uncorroborated); KREME 2.55 (uncorroborated); CARLE 2.53 (uncorroborated); MCKELLAR 2.51 (uncorroborated)

### hb0278 — day 277 (2027-06-27) · letters IDEOPRV (center I) · 40 words / 114 bonus · max 219

- **Main-list worthy** (+7 max): DRIPPED 2.56
- Bonus: VIDEOED 1.97
- Review (no dictionary backs these; not in the patch): OPIOID 3.33 (wordle-lists only); DIDIER 3.03 (uncorroborated); PIERO 3.01 (uncorroborated); VERDI 2.82 (uncorroborated); PRIORI 2.78 (uncorroborated); IVOIRE 2.76 (uncorroborated); OVIEDO 2.54 (uncorroborated); POIRIER 2.5 (uncorroborated); VIVRE 2.5 (uncorroborated)

### hb0279 — day 278 (2027-06-28) · letters PCDENRT (center P) · 25 words / 69 bonus · max 153

- **Main-list worthy** (+7 max): PREPPED 2.91
- Bonus: PREPPER 2.3, PETERED 2.23, PERCENTER 1.93
- Review (no dictionary backs these; not in the patch): RECEP 2.66 (uncorroborated); PRETEEN 2.53 (wordle-lists only); PREET 2.5 (uncorroborated)

### hb0280 — day 279 (2027-06-29) · letters LAOPRUY (center L) · 28 words / 132 bonus · max 112

- Review (no dictionary backs these; not in the patch): PAYPAL 3.75 (uncorroborated); YOULL 3.21 (uncorroborated); LOYOLA 3.07 (uncorroborated); PROLLY 3.04 (uncorroborated); AYALA 2.77 (uncorroborated); LOLOL 2.58 (uncorroborated); LALLY 2.56 (uncorroborated)

### hb0281 — day 280 (2027-06-30) · letters OABEPRT (center O) · 54 words / 213 bonus · max 230

- **Main-list worthy** (+6 max): POOPER 2.56
- Review (no dictionary backs these; not in the patch): ABBOTT 3.78 (uncorroborated); PORTE 3.13 (uncorroborated); PETRO 2.94 (uncorroborated); TROTT 2.77 (uncorroborated); TEATRO 2.63 (uncorroborated); PEROT 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); POTRO 2.57 (uncorroborated); BORAT 2.54 (uncorroborated); PARETO 2.5 (uncorroborated)

### hb0282 — day 281 (2027-07-01) · letters TBELNOV (center T) · 31 words / 77 bonus · max 83

- Review (no dictionary backs these; not in the patch): BENNETT 4.03 (uncorroborated); BOLTON 3.65 (uncorroborated); VETTEL 3.25 (uncorroborated); LOVETT 2.79 (uncorroborated); BENTO 2.7 (uncorroborated); VENETO 2.57 (uncorroborated); TELNET 2.52 (uncorroborated); BOTNET 2.5 (wordle-lists only)

### hb0283 — day 282 (2027-07-02) · letters LAEHRTY (center L) · 47 words / 191 bonus · max 205

- **Main-list worthy** (+6 max): HALLER 2.61
- Review (no dictionary backs these; not in the patch): HARLEY 3.72 (uncorroborated); HARTLEY 3.4 (uncorroborated); HAYLEY 3.39 (uncorroborated); HELLA 3.35 (uncorroborated); HEALY 3.23 (uncorroborated); HALLE 3.21 (uncorroborated); TERRELL 2.98 (uncorroborated); TYRELL 2.94 (uncorroborated); HEALEY 2.9 (uncorroborated); LEAHY 2.88 (uncorroborated); LEARY 2.86 (uncorroborated); AYALA 2.77 (uncorroborated); LEYTE 2.76 (uncorroborated); REALY 2.76 (uncorroborated); HARRELL 2.72 (uncorroborated); HALLEY 2.71 (uncorroborated); HALLETT 2.63 (uncorroborated); ELLERY 2.61 (uncorroborated); ELLER 2.59 (wordle-lists only); TYRRELL 2.57 (uncorroborated); YALTA 2.57 (uncorroborated); LALLY 2.56 (uncorroborated); LYELL 2.56 (uncorroborated); TALLEY 2.54 (uncorroborated); HELTER 2.5 (uncorroborated)

### hb0284 — day 283 (2027-07-03) · letters RABCEMN (center R) · 43 words / 186 bonus · max 180

- **Main-list worthy** (+11 max): CRAMER 2.93, BABAR 2.61
- Bonus: BABER 2.19
- Review (no dictionary backs these; not in the patch): BRENNAN 3.65 (uncorroborated); BARCA 3.41 (uncorroborated); MCNAMARA 3.22 (uncorroborated); BERMAN 3.16 (uncorroborated); CREME 3.12 (uncorroborated); BARRE 3.08 (uncorroborated); ACCRA 3.04 (uncorroborated); CABRERA 3.04 (uncorroborated); BREMEN 2.99 (uncorroborated); BRENNER 2.97 (uncorroborated); BREEN 2.93 (uncorroborated); RENNER 2.8 (uncorroborated); CARRERA 2.77 (uncorroborated); MEERA 2.77 (uncorroborated); CARNE 2.76 (uncorroborated); MCRAE 2.7 (uncorroborated); ARRAN 2.69 (uncorroborated); MACRAE 2.64 (uncorroborated); RACECAR 2.58 (uncorroborated); BREMER 2.56 (uncorroborated); CRABB 2.56 (uncorroborated); BERRA 2.53 (uncorroborated); CAMERAMEN 2.53 (uncorroborated); BARBA 2.5 (uncorroborated); MARCA 2.5 (uncorroborated)

### hb0285 — day 284 (2027-07-04) · letters CAEGHNR (center C) · 32 words / 128 bonus · max 144

- Review (no dictionary backs these; not in the patch): ACCRA 3.04 (uncorroborated); CARRERA 2.77 (uncorroborated); CARNE 2.76 (uncorroborated); AACHEN 2.6 (uncorroborated); AGENCE 2.58 (uncorroborated); RACECAR 2.58 (uncorroborated)

### hb0286 — day 285 (2027-07-05) · letters PCEILNR (center P) · 29 words / 138 bonus · max 129

- Bonus: PREPPER 2.3, PILLER 2.13
- Review (no dictionary backs these; not in the patch): PERRIN 2.83 (uncorroborated); PEIRCE 2.77 (uncorroborated); PIRELLI 2.68 (uncorroborated); RECEP 2.66 (uncorroborated); PELLE 2.56 (uncorroborated); PRINCIPE 2.52 (uncorroborated)

### hb0287 — day 286 (2027-07-06) · letters NADEHTU (center N) · 40 words / 183 bonus · max 170

- Review (no dictionary backs these; not in the patch): HANNAH 4.05 (uncorroborated); DUNDEE 3.6 (uncorroborated); ANAND 3.1 (uncorroborated); TENNANT 3.09 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); DEANNA 2.85 (uncorroborated); HUNAN 2.8 (uncorroborated); ATTENDEE 2.72 (uncorroborated); HADEN 2.71 (uncorroborated); AUDEN 2.65 (uncorroborated); HENAN 2.63 (uncorroborated); THANET 2.6 (uncorroborated); HANNAN 2.52 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0288 — day 287 (2027-07-07) · letters YAEHPRT (center Y) · 20 words / 126 bonus · max 92

- Bonus: THEYR 2.03
- Review (no dictionary backs these; not in the patch): THAYER 2.96 (uncorroborated); YARRA 2.81 (uncorroborated); YAHYA 2.79 (uncorroborated); PATTAYA 2.69 (uncorroborated); HAYAT 2.56 (uncorroborated); YATRA 2.52 (uncorroborated)

### hb0289 — day 288 (2027-07-08) · letters TAILMNP (center T) · 22 words / 143 bonus · max 78

- Review (no dictionary backs these; not in the patch): TAMPA 3.92 (uncorroborated); ITALIA 3.39 (uncorroborated); LATINA 3.38 (wordle-lists only); TATIANA 3.07 (uncorroborated); ALTMAN 2.96 (uncorroborated); ATTILA 2.89 (uncorroborated); PLATA 2.88 (uncorroborated); PATNA 2.84 (uncorroborated); TILLMAN 2.83 (uncorroborated); PITTMAN 2.77 (uncorroborated); TALLINN 2.75 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); TILAPIA 2.64 (wordle-lists only); PATIL 2.62 (uncorroborated); TAPPAN 2.54 (uncorroborated); TAMAN 2.53 (uncorroborated); ATALANTA 2.51 (uncorroborated); MITTAL 2.51 (uncorroborated)

### hb0290 — day 289 (2027-07-09) · letters TACEHLO (center T) · 50 words / 217 bonus · max 198

- Review (no dictionary backs these; not in the patch): TAHOE 3.2 (uncorroborated); COLETTE 2.92 (uncorroborated); CALTECH 2.72 (uncorroborated); ALCATEL 2.63 (uncorroborated); HALLETT 2.63 (uncorroborated); CELTA 2.62 (uncorroborated); HACHETTE 2.6 (uncorroborated); HEATHCOTE 2.6 (uncorroborated); HECHT 2.6 (uncorroborated); ALCOTT 2.59 (uncorroborated); TELCO 2.59 (uncorroborated); COLLETTE 2.57 (uncorroborated); CHEETO 2.51 (uncorroborated); CHOCOLAT 2.5 (uncorroborated)

### hb0291 — day 290 (2027-07-10) · letters TEGHILR (center T) · 42 words / 162 bonus · max 201

- Review (no dictionary backs these; not in the patch): GILLETTE 3.09 (uncorroborated); TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); THIER 2.99 (uncorroborated); TERRELL 2.98 (uncorroborated); RETIREE 2.81 (wordle-lists only); THIEL 2.75 (uncorroborated); GILLETT 2.62 (uncorroborated); GEERT 2.6 (uncorroborated); LEGGETT 2.55 (uncorroborated); HELTER 2.5 (uncorroborated)

### hb0292 — day 291 (2027-07-11) · letters IBDEHNT (center I) · 32 words / 99 bonus · max 141

- **Main-list worthy** (+7 max): THINNED 2.72
- Review (no dictionary backs these; not in the patch): BIDEN 3.86 (uncorroborated); ETIENNE 3.1 (uncorroborated); INNIT 2.74 (uncorroborated); BENNIE 2.73 (wordle-lists only); TINTIN 2.7 (uncorroborated); HEINE 2.65 (uncorroborated); HEBEI 2.6 (uncorroborated); INTHE 2.58 (uncorroborated)

### hb0293 — day 292 (2027-07-12) · letters AEILNOR (center A) · 33 words / 185 bonus · max 96

- Review (no dictionary backs these; not in the patch): LILLIAN 3.26 (uncorroborated); RONAN 3.06 (uncorroborated); LEANNE 3.03 (uncorroborated); NARNIA 2.93 (uncorroborated); ANNAN 2.88 (uncorroborated); RAINIER 2.87 (wordle-lists only); NOONAN 2.85 (uncorroborated); LANIER 2.82 (uncorroborated); LALLANA 2.73 (uncorroborated); OREAL 2.71 (uncorroborated); ARRAN 2.69 (uncorroborated); ARIANE 2.67 (wordle-lists only); ARIANNA 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); LORENA 2.64 (uncorroborated); NAIRA 2.63 (uncorroborated); ARORA 2.57 (uncorroborated); EINAR 2.57 (uncorroborated); LORAIN 2.56 (uncorroborated); LILIANA 2.55 (uncorroborated); LORELAI 2.54 (uncorroborated); NELLA 2.52 (uncorroborated); RANIERI 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0294 — day 293 (2027-07-13) · letters TEGINUY (center T) · 27 words / 94 bonus · max 121

- **Main-list worthy** (+8 max): IGNITING 2.8
- Bonus: GENTING 2.27, TENTING 1.92
- Review (no dictionary backs these; not in the patch): GETTIN 3.72 (uncorroborated); GETTY 3.49 (uncorroborated); ETIENNE 3.1 (uncorroborated); NUGENT 3.02 (uncorroborated); INUIT 2.95 (uncorroborated); GUTTING 2.74 (wordle-lists only); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); GENTE 2.51 (uncorroborated)

### hb0295 — day 294 (2027-07-14) · letters IABCENT (center I) · 24 words / 165 bonus · max 120

- Review (no dictionary backs these; not in the patch): ETIENNE 3.1 (uncorroborated); TATIANA 3.07 (uncorroborated); CAINE 3.06 (uncorroborated); CATANIA 2.9 (uncorroborated); BEATTIE 2.88 (uncorroborated); EATIN 2.76 (uncorroborated); ATTICA 2.74 (uncorroborated); INNIT 2.74 (uncorroborated); BENNIE 2.73 (wordle-lists only); ICANN 2.7 (uncorroborated); TINTIN 2.7 (uncorroborated); BINANCE 2.64 (uncorroborated); CABBIE 2.62 (wordle-lists only)

### hb0296 — day 295 (2027-07-15) · letters OALMNPR (center O) · 36 words / 138 bonus · max 107

- Bonus: NOMAR 2
- Review (no dictionary backs these; not in the patch): MOMMA 3.41 (uncorroborated); MARLON 3.21 (uncorroborated); ROMANO 3.07 (wordle-lists only); RONAN 3.06 (uncorroborated); PLANO 2.92 (uncorroborated); NOONAN 2.85 (uncorroborated); NOOOO 2.82 (uncorroborated); PALOMA 2.8 (uncorroborated); MOANA 2.76 (uncorroborated); MANOLO 2.7 (uncorroborated); NOOOOO 2.63 (uncorroborated); LOLOL 2.58 (uncorroborated); ARORA 2.57 (uncorroborated); ROMANA 2.56 (uncorroborated); PAMPLONA 2.54 (uncorroborated); MALMO 2.5 (uncorroborated)

### hb0297 — day 296 (2027-07-16) · letters ABILNRT (center A) · 38 words / 262 bonus · max 137

- **Main-list worthy** (+5 max): BABAR 2.61
- Review (no dictionary backs these; not in the patch): ARABIA 4.12 (uncorroborated); TALIBAN 3.69 (wordle-lists only); ITALIA 3.39 (uncorroborated); LATINA 3.38 (wordle-lists only); AIRBNB 3.32 (uncorroborated); LILLIAN 3.26 (uncorroborated); TATIANA 3.07 (uncorroborated); ATARI 2.98 (uncorroborated); ABABA 2.96 (uncorroborated); ALIBABA 2.96 (uncorroborated); NARNIA 2.93 (uncorroborated); BALLARAT 2.9 (uncorroborated); BRIANNA 2.9 (uncorroborated); ATTILA 2.89 (uncorroborated); ANNAN 2.88 (uncorroborated); BILAL 2.83 (uncorroborated); TARRANT 2.78 (uncorroborated); TALIB 2.77 (uncorroborated); TALLINN 2.75 (uncorroborated); LALLANA 2.73 (uncorroborated); ARRAN 2.69 (uncorroborated); ARIANNA 2.66 (uncorroborated); NABIL 2.66 (uncorroborated); NAIRN 2.65 (uncorroborated); NAIRA 2.63 (uncorroborated); BLATT 2.61 (uncorroborated); BALLIN 2.59 (uncorroborated); LILIANA 2.55 (uncorroborated); BARRATT 2.53 (uncorroborated); BRITTA 2.53 (uncorroborated); RITALIN 2.53 (uncorroborated); BIRLA 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated); TIRANA 2.51 (uncorroborated); BARBA 2.5 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0298 — day 297 (2027-07-17) · letters LADEOPU (center L) · 48 words / 160 bonus · max 192

- Bonus: DOLLED 2.44, PLOPPED 2.37, DOLED 2.27, DOODLED 1.99, PEDALED 1.97, DUELED 1.94, PULPED 1.9
- Review (no dictionary backs these; not in the patch): POOLE 3.34 (uncorroborated); DEADPOOL 3.24 (uncorroborated); LAUDE 2.99 (uncorroborated); DELLE 2.78 (uncorroborated); PAELLA 2.63 (wordle-lists only); LEOPOLDO 2.61 (uncorroborated); DEPAUL 2.58 (uncorroborated); LAUDA 2.58 (uncorroborated); LOLOL 2.58 (uncorroborated); PELLE 2.56 (uncorroborated); APPEL 2.53 (uncorroborated)

### hb0299 — day 298 (2027-07-18) · letters ADHIRTW (center A) · 23 words / 101 bonus · max 71

- Bonus: THATD 1.99, DADAR 1.92
- Review (no dictionary backs these; not in the patch): HAWAII 4.21 (uncorroborated); HAHAHA 3.81 (uncorroborated); HAHAHAHA 3.23 (uncorroborated); HAHAH 3.08 (uncorroborated); ATARI 2.98 (uncorroborated); AHHHH 2.93 (uncorroborated); RADHA 2.82 (uncorroborated); HAHAHAHAHA 2.81 (uncorroborated); TAHIR 2.81 (uncorroborated); HADID 2.76 (uncorroborated); HADDAD 2.63 (uncorroborated); AHAHA 2.62 (uncorroborated); AWWWW 2.62 (uncorroborated); HAHAHAH 2.62 (uncorroborated); TAHRIR 2.6 (uncorroborated); AAAAH 2.57 (uncorroborated); AHHHHH 2.54 (uncorroborated); IWATA 2.51 (uncorroborated); TIWARI 2.51 (uncorroborated); HARIRI 2.5 (uncorroborated)

### hb0300 — day 299 (2027-07-19) · letters CGHINOP (center C) · 20 words / 58 bonus · max 80

- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): CHONG 3.15 (uncorroborated); PINOCCHIO 2.93 (uncorroborated); CINCO 2.81 (uncorroborated); GOOCH 2.72 (uncorroborated); POCONO 2.63 (uncorroborated); ICHIGO 2.61 (uncorroborated); GNOCCHI 2.53 (wordle-lists only)

### hb0301 — day 300 (2027-07-20) · letters CAEGILN (center C) · 35 words / 137 bonus · max 215

- Bonus: LANCING 2.15, LICENCING 2.09, INCLINING 1.9
- Review (no dictionary backs these; not in the patch): CLEGG 3.23 (uncorroborated); CELINE 3.16 (uncorroborated); CAINE 3.06 (uncorroborated); CALLIE 2.97 (uncorroborated); CALLE 2.91 (uncorroborated); CALLIN 2.87 (uncorroborated); LEICA 2.79 (uncorroborated); GALICIA 2.75 (uncorroborated); ICANN 2.7 (uncorroborated); CALLAN 2.62 (uncorroborated); AGENCE 2.58 (uncorroborated)

### hb0302 — day 301 (2027-07-21) · letters OGILNRT (center O) · 44 words / 132 bonus · max 174

- **Main-list worthy** (+30 max): IGNORING 4.04, GOOGLING 3.01, TROTTING 2.9, LORING 2.56
- Bonus: OGLING 2.3, GORGING 2.26, TOGGLING 2.01
- Review (no dictionary backs these; not in the patch): NORTON 3.75 (uncorroborated); GIORGIO 3.24 (uncorroborated); RINGO 3.16 (uncorroborated); ROLLIN 3.11 (uncorroborated); LINTON 2.88 (uncorroborated); TORINO 2.87 (uncorroborated); NOOOO 2.82 (uncorroborated); NOTTING 2.77 (uncorroborated); RONIN 2.77 (uncorroborated); TROTT 2.77 (uncorroborated); GOTTI 2.7 (uncorroborated); LONGO 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); LOLOL 2.58 (uncorroborated); GOGOL 2.55 (uncorroborated); GROTON 2.55 (uncorroborated); GIORNO 2.54 (uncorroborated); GORTON 2.5 (uncorroborated); ILOILO 2.5 (uncorroborated)

### hb0303 — day 302 (2027-07-22) · letters EBFGINR (center E) · 50 words / 166 bonus · max 249

- **Main-list worthy** (+18 max): REFERRING 4.35, INFERRING 2.57
- Bonus: GRINER 2.11, GENER 2.1, REENGINEERING 1.97
- Review (no dictionary backs these; not in the patch): GREENE 3.76 (uncorroborated); BIEBER 3.7 (uncorroborated); BERGEN 3.32 (uncorroborated); GREENBERG 3.25 (uncorroborated); BIGGIE 3.18 (wordle-lists only); FERRER 3 (uncorroborated); BRENNER 2.97 (uncorroborated); GEIGER 2.96 (uncorroborated); BREEN 2.93 (uncorroborated); FERGIE 2.91 (uncorroborated); BERING 2.89 (uncorroborated); RENNIE 2.89 (uncorroborated); GERBER 2.88 (uncorroborated); FREEBIE 2.86 (wordle-lists only); RENNER 2.8 (uncorroborated); EFFING 2.75 (wordle-lists only); BENNING 2.74 (uncorroborated); BERNIER 2.74 (uncorroborated); BENNIE 2.73 (wordle-lists only); FEINBERG 2.65 (uncorroborated); GREIG 2.65 (uncorroborated); BEEBE 2.63 (uncorroborated); BRIENNE 2.63 (uncorroborated); FENNER 2.56 (uncorroborated); GEFFEN 2.56 (uncorroborated); EINER 2.54 (uncorroborated); BRIEN 2.5 (uncorroborated)

### hb0304 — day 303 (2027-07-23) · letters OACELPU (center O) · 25 words / 87 bonus · max 69

- Review (no dictionary backs these; not in the patch): POOLE 3.34 (uncorroborated); POPUP 2.78 (wordle-lists only); COPPOLA 2.75 (uncorroborated); ALCOA 2.67 (uncorroborated); OCALA 2.61 (uncorroborated); LOLOL 2.58 (uncorroborated)

### hb0305 — day 304 (2027-07-24) · letters OEIKMNR (center O) · 26 words / 94 bonus · max 81

- Review (no dictionary backs these; not in the patch): MONROE 3.89 (uncorroborated); RONNIE 3.7 (uncorroborated); MORENO 3.35 (uncorroborated); NIKON 3.33 (uncorroborated); NOONE 3.08 (uncorroborated); MORNIN 3.07 (uncorroborated); ENRON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); RONIN 2.77 (uncorroborated); RENOIR 2.73 (uncorroborated); NOIRE 2.7 (uncorroborated); MENON 2.69 (uncorroborated); KENMORE 2.67 (uncorroborated); NOOOOO 2.63 (uncorroborated); KEIKO 2.61 (uncorroborated); MOOKIE 2.61 (uncorroborated)

### hb0306 — day 305 (2027-07-25) · letters IACEHRV (center I) · 23 words / 85 bonus · max 103

- Bonus: REHIRE 2.24
- Review (no dictionary backs these; not in the patch): RICHIE 3.67 (uncorroborated); REICH 3.49 (uncorroborated); RIVERA 3.44 (uncorroborated); RIVIERA 3.26 (uncorroborated); RICCI 2.88 (uncorroborated); CHERIE 2.84 (uncorroborated); CHICA 2.77 (uncorroborated); RECIEVE 2.75 (uncorroborated); VIEIRA 2.74 (uncorroborated); CHIARA 2.6 (uncorroborated); AVICII 2.5 (uncorroborated); HARIRI 2.5 (uncorroborated); VIVRE 2.5 (uncorroborated)

### hb0307 — day 306 (2027-07-26) · letters CABELRT (center C) · 44 words / 194 bonus · max 234

- Bonus: CELLER 1.95, REELECT 1.91
- Review (no dictionary backs these; not in the patch): BARCA 3.41 (uncorroborated); ACCRA 3.04 (uncorroborated); CABRERA 3.04 (uncorroborated); CETERA 2.96 (uncorroborated); CRABTREE 2.96 (uncorroborated); CALLE 2.91 (uncorroborated); CARTA 2.91 (uncorroborated); CARRERA 2.77 (uncorroborated); ETCETERA 2.7 (uncorroborated); ALCATEL 2.63 (uncorroborated); CELTA 2.62 (uncorroborated); LECLERC 2.62 (uncorroborated); RACECAR 2.58 (uncorroborated); CRABB 2.56 (uncorroborated); CARLE 2.53 (uncorroborated); LECTER 2.52 (uncorroborated)

### hb0308 — day 307 (2027-07-27) · letters OAEPRTV (center O) · 52 words / 183 bonus · max 231

- **Main-list worthy** (+6 max): POOPER 2.56
- Review (no dictionary backs these; not in the patch): PORTE 3.13 (uncorroborated); PETRO 2.94 (uncorroborated); PROVO 2.86 (uncorroborated); TROTT 2.77 (uncorroborated); PETROV 2.75 (uncorroborated); TEATRO 2.63 (uncorroborated); PEROT 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); POTRO 2.57 (uncorroborated); PARETO 2.5 (uncorroborated)

### hb0309 — day 308 (2027-07-28) · letters PDEIORX (center P) · 31 words / 91 bonus · max 103

- **Main-list worthy** (+27 max): PREPPED 2.91, PRODDED 2.59, DRIPPED 2.56, POOPER 2.56
- Bonus: PREPPER 2.3, DROOPED 1.91
- Review (no dictionary backs these; not in the patch): OPIOID 3.33 (wordle-lists only); PIERO 3.01 (uncorroborated); PRIORI 2.78 (uncorroborated); PREORDERED 2.56 (uncorroborated); POIRIER 2.5 (uncorroborated)

### hb0310 — day 309 (2027-07-29) · letters OAEGLNY (center O) · 29 words / 119 bonus · max 104

- Review (no dictionary backs these; not in the patch): GONNA 5.29 (wordle-lists only); ANGLO 3.81 (uncorroborated); LENNON 3.56 (uncorroborated); GEELONG 3.28 (uncorroborated); NOONE 3.08 (uncorroborated); LOYOLA 3.07 (uncorroborated); GALLO 3.05 (uncorroborated); YANGON 3.03 (uncorroborated); GOLAN 2.89 (uncorroborated); NAGOYA 2.88 (uncorroborated); NOONAN 2.85 (uncorroborated); GANNON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); NOELLE 2.78 (uncorroborated); YONGE 2.7 (uncorroborated); AEGON 2.64 (uncorroborated); ANGOLAN 2.63 (wordle-lists only); LONGO 2.63 (uncorroborated); NOOOOO 2.63 (uncorroborated); OLNEY 2.63 (uncorroborated); NAGANO 2.6 (uncorroborated); LOLOL 2.58 (uncorroborated); GOGOL 2.55 (uncorroborated); GLENNON 2.53 (uncorroborated); LEONG 2.52 (uncorroborated); GAGNON 2.51 (uncorroborated)

### hb0311 — day 310 (2027-07-30) · letters LAHINOT (center L) · 28 words / 155 bonus · max 100

- Review (no dictionary backs these; not in the patch): LATINO 3.79 (wordle-lists only); HILTON 3.75 (uncorroborated); ITALIA 3.39 (uncorroborated); LATINA 3.38 (wordle-lists only); LILLIAN 3.26 (uncorroborated); LOLITA 3.07 (wordle-lists only); LOTHIAN 3.05 (uncorroborated); ATTILA 2.89 (uncorroborated); LINTON 2.88 (uncorroborated); HANLON 2.79 (uncorroborated); ANATOLIA 2.77 (uncorroborated); HALLO 2.75 (uncorroborated); TALLINN 2.75 (uncorroborated); LALLANA 2.73 (uncorroborated); HILAL 2.63 (uncorroborated); ITALIANO 2.62 (uncorroborated); ALTOONA 2.61 (uncorroborated); ILLINI 2.61 (uncorroborated); LOLOL 2.58 (uncorroborated); HOLTON 2.55 (uncorroborated); LILIANA 2.55 (uncorroborated); ATALANTA 2.51 (uncorroborated); ILOILO 2.5 (uncorroborated)

### hb0312 — day 311 (2027-07-31) · letters FEILRTY (center F) · 37 words / 122 bonus · max 141

- Review (no dictionary backs these; not in the patch): EIFFEL 3.23 (uncorroborated); FERRER 3 (uncorroborated); FERRELL 2.97 (uncorroborated); FEELY 2.61 (uncorroborated)

### hb0313 — day 312 (2027-08-01) · letters RDEFILW (center R) · 47 words / 122 bonus · max 214

- **Main-list worthy** (+14 max): REFERRED 4.61, DILLER 2.51
- Bonus: WEIRDED 2.4, REFRIED 2.2, REDREW 2.01
- Review (no dictionary backs these; not in the patch): FEDERER 3.22 (uncorroborated); DIDIER 3.03 (uncorroborated); FERRER 3 (uncorroborated); FERRELL 2.97 (uncorroborated); DEERE 2.91 (uncorroborated); WILFRID 2.72 (uncorroborated); DREDD 2.69 (uncorroborated); DEERFIELD 2.68 (uncorroborated); WIERD 2.61 (uncorroborated); WILFRIED 2.61 (uncorroborated); ELLER 2.59 (wordle-lists only); RIDDELL 2.54 (uncorroborated); REDFIELD 2.51 (uncorroborated)

### hb0314 — day 313 (2027-08-02) · letters LABDEOR (center L) · 54 words / 259 bonus · max 215

- **Main-list worthy** (+8 max): REBELLED 2.95
- Bonus: DOLLED 2.44, BARRELLED 2.31, ABLED 2.29, DOLED 2.27, BOLDED 2.2, LODER 2.07, BELLER 2.04, DOODLED 1.99, BABBLED 1.95, DOLLARD 1.95
- Review (no dictionary backs these; not in the patch): ADLER 3.36 (uncorroborated); BALLARD 3.25 (uncorroborated); LORDE 3.16 (uncorroborated); BELLO 3.02 (uncorroborated); ADDERALL 2.87 (uncorroborated); LAREDO 2.83 (uncorroborated); ROALD 2.79 (uncorroborated); DELLE 2.78 (uncorroborated); ODDBALL 2.76 (wordle-lists only); OREAL 2.71 (uncorroborated); ELDORADO 2.68 (uncorroborated); BARBELL 2.65 (wordle-lists only); ELLER 2.59 (wordle-lists only); LOLOL 2.58 (uncorroborated); BLOOR 2.54 (uncorroborated); ALLARD 2.52 (uncorroborated)

### hb0315 — day 314 (2027-08-03) · letters RDEGNOV (center R) · 47 words / 157 bonus · max 233

- **Main-list worthy** (+14 max): GROVER 3.22, GENDERED 3.08
- Bonus: OVERRODE 2.3, GENER 2.1, DOERR 2.07, DRONED 1.95, VENEERED 1.95
- Review (no dictionary backs these; not in the patch): OREGON 4.3 (uncorroborated); GREENE 3.76 (uncorroborated); VERDE 3.29 (uncorroborated); DEERE 2.91 (uncorroborated); DOREEN 2.91 (uncorroborated); DONNER 2.84 (uncorroborated); ENRON 2.84 (uncorroborated); RENNER 2.8 (uncorroborated); ROGEN 2.7 (uncorroborated); DREDD 2.69 (uncorroborated); GORDO 2.68 (uncorroborated); REDONDO 2.6 (uncorroborated); NOVGOROD 2.58 (uncorroborated)

### hb0316 — day 315 (2027-08-04) · letters YADEIRT (center Y) · 21 words / 98 bonus · max 89

- **Main-list worthy** (+7 max): ARRAYED 2.57
- Review (no dictionary backs these; not in the patch): ADITYA 2.98 (wordle-lists only); YARRA 2.81 (uncorroborated); YATRA 2.52 (uncorroborated)

### hb0317 — day 316 (2027-08-05) · letters FACELRU (center F) · 30 words / 103 bonus · max 104

- Review (no dictionary backs these; not in the patch): FARRELL 3.45 (uncorroborated); FERRER 3 (uncorroborated); FERRELL 2.97 (uncorroborated); FARRAR 2.88 (uncorroborated); RAFFAELE 2.65 (uncorroborated); FALAFEL 2.64 (wordle-lists only); FREEFALL 2.56 (uncorroborated)

### hb0318 — day 317 (2027-08-06) · letters PCEMNOT (center P) · 20 words / 70 bonus · max 120

- Review (no dictionary backs these; not in the patch): COMPTON 3.38 (uncorroborated); POMPEO 2.81 (uncorroborated); PONTE 2.75 (uncorroborated); EPCOT 2.65 (uncorroborated); POCONO 2.63 (uncorroborated); PETCO 2.59 (uncorroborated)

### hb0319 — day 318 (2027-08-07) · letters IAERTVY (center I) · 20 words / 134 bonus · max 110

- Review (no dictionary backs these; not in the patch): RIVERA 3.44 (uncorroborated); RIVIERA 3.26 (uncorroborated); ERITREA 3.05 (uncorroborated); RITTER 2.99 (uncorroborated); ATARI 2.98 (uncorroborated); RETIREE 2.81 (wordle-lists only); TIERRA 2.81 (uncorroborated); VIEIRA 2.74 (uncorroborated); VIRAT 2.64 (uncorroborated); VIVRE 2.5 (uncorroborated)

### hb0320 — day 319 (2027-08-08) · letters REHOTVW (center R) · 38 words / 143 bonus · max 168

- **Main-list worthy** (+30 max): OVERTHREW 2.88 ★pangram, REWROTE 2.75, RETWEET 2.73
- Review (no dictionary backs these; not in the patch): TERRE 3.07 (uncorroborated); TROTT 2.77 (uncorroborated)

### hb0321 — day 320 (2027-08-09) · letters LAENPRY (center L) · 43 words / 170 bonus · max 182

- Review (no dictionary backs these; not in the patch): PAYPAL 3.75 (uncorroborated); LERNER 3.07 (uncorroborated); LEANNE 3.03 (uncorroborated); PARNELL 2.95 (uncorroborated); LEARY 2.86 (uncorroborated); AYALA 2.77 (uncorroborated); PALEY 2.76 (uncorroborated); REALY 2.76 (uncorroborated); LALLANA 2.73 (uncorroborated); YELLEN 2.66 (uncorroborated); PAELLA 2.63 (wordle-lists only); ELLERY 2.61 (uncorroborated); ELLER 2.59 (wordle-lists only); LALLY 2.56 (uncorroborated); LYELL 2.56 (uncorroborated); PELLE 2.56 (uncorroborated); APPEL 2.53 (uncorroborated); NELLA 2.52 (uncorroborated)

### hb0322 — day 321 (2027-08-10) · letters EACGILO (center E) · 23 words / 89 bonus · max 120

- Review (no dictionary backs these; not in the patch): CLEGG 3.23 (uncorroborated); GALILEO 3.2 (uncorroborated); LILLE 2.98 (uncorroborated); CALLIE 2.97 (uncorroborated); CALLE 2.91 (uncorroborated); LEICA 2.79 (uncorroborated); LILLIE 2.74 (uncorroborated); GEICO 2.57 (uncorroborated)

### hb0323 — day 322 (2027-08-11) · letters AEGINOT (center A) · 42 words / 241 bonus · max 236

- **Main-list worthy** (+45 max): NEGOTIATING 3.78 ★pangram, INITIATING 3.38, AGITATING 2.67, NEGATING 2.55
- Bonus: ATONING 2.21, ANNOTATING 2.05
- Review (no dictionary backs these; not in the patch): GONNA 5.29 (wordle-lists only); GOTTA 4.95 (uncorroborated); EATON 3.42 (uncorroborated); ANTOINE 3.39 (uncorroborated); TENNANT 3.09 (uncorroborated); TATIANA 3.07 (uncorroborated); GAGGING 2.93 (wordle-lists only); GIANNI 2.91 (uncorroborated); ANTONI 2.89 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); NOONAN 2.85 (uncorroborated); GANNON 2.84 (uncorroborated); EATIN 2.76 (uncorroborated); OTAGO 2.76 (uncorroborated); NEGAN 2.71 (uncorroborated); ANTONIN 2.68 (uncorroborated); TEGAN 2.67 (uncorroborated); AEGON 2.64 (uncorroborated); ATENEO 2.62 (uncorroborated); NAGANO 2.6 (uncorroborated); TANTO 2.6 (uncorroborated); TIAGO 2.57 (uncorroborated); GANNETT 2.54 (uncorroborated); GAGNON 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0324 — day 323 (2027-08-12) · letters ODGINPU (center O) · 22 words / 75 bonus · max 90

- **Main-list worthy** (+14 max): POOPING 3.01, GOUGING 2.67
- Bonus: OPINING 2.07
- Review (no dictionary backs these; not in the patch): DUNNO 3.76 (uncorroborated); OPIOID 3.33 (wordle-lists only); NIPPON 2.95 (uncorroborated); NOOOO 2.82 (uncorroborated); POPUP 2.78 (wordle-lists only); DONNING 2.74 (wordle-lists only); INDIO 2.69 (uncorroborated); DOGGING 2.68 (wordle-lists only); NOOOOO 2.63 (uncorroborated); GODIN 2.6 (uncorroborated)

### hb0325 — day 324 (2027-08-13) · letters BACEHMR (center B) · 20 words / 90 bonus · max 82

- **Main-list worthy** (+12 max): BEECHER 2.87, BABAR 2.61
- Bonus: BABER 2.19
- Review (no dictionary backs these; not in the patch): BARCA 3.41 (uncorroborated); MCCABE 3.13 (uncorroborated); BARRE 3.08 (uncorroborated); CABRERA 3.04 (uncorroborated); ABABA 2.96 (uncorroborated); BEEBE 2.63 (uncorroborated); HABER 2.59 (uncorroborated); BAMBA 2.56 (uncorroborated); BRABHAM 2.56 (uncorroborated); BREMER 2.56 (uncorroborated); CRABB 2.56 (uncorroborated); CHAMBRE 2.55 (uncorroborated); BERRA 2.53 (uncorroborated); BARBA 2.5 (uncorroborated)

### hb0326 — day 325 (2027-08-14) · letters HCGINPT (center H) · 24 words / 30 bonus · max 103

- Review (no dictionary backs these; not in the patch): NICHT 2.87 (uncorroborated); THICC 2.66 (uncorroborated)

### hb0327 — day 326 (2027-08-15) · letters EILMNPT (center E) · 46 words / 176 bonus · max 171

- Review (no dictionary backs these; not in the patch): TIMELINE 4.15 (uncorroborated); INTEL 4.07 (uncorroborated); LENIN 3.44 (uncorroborated); EMINEM 3.34 (uncorroborated); MILNE 3.2 (uncorroborated); LEMME 3.19 (uncorroborated); INLINE 3.18 (wordle-lists only); TELLIN 3.11 (uncorroborated); ETIENNE 3.1 (uncorroborated); NEILL 3.01 (uncorroborated); LILLE 2.98 (uncorroborated); LINEMEN 2.92 (wordle-lists only); EMILIE 2.79 (uncorroborated); LILLIE 2.74 (uncorroborated); LENNIE 2.7 (uncorroborated); PELLE 2.56 (uncorroborated); PETTIT 2.52 (uncorroborated); TELNET 2.52 (uncorroborated)

### hb0328 — day 327 (2027-08-16) · letters UADENRT (center U) · 37 words / 257 bonus · max 196

- **Main-list worthy** (+14 max): NATURED 3.03 ★pangram
- Review (no dictionary backs these; not in the patch): DUNDEE 3.6 (uncorroborated); TRUDEAU 3.44 (uncorroborated); UTTAR 3.22 (uncorroborated); DURAN 3.12 (uncorroborated); NAURU 2.94 (uncorroborated); DUTERTE 2.93 (uncorroborated); NEUER 2.9 (uncorroborated); DURAND 2.83 (uncorroborated); ARNAUD 2.78 (uncorroborated); EDUARD 2.76 (uncorroborated); DUARTE 2.7 (uncorroborated); AUDEN 2.65 (uncorroborated); DURANTE 2.6 (uncorroborated); NATURA 2.6 (uncorroborated); RENAUD 2.5 (uncorroborated)

### hb0329 — day 328 (2027-08-17) · letters REIPTWY (center R) · 24 words / 141 bonus · max 91

- **Main-list worthy** (+7 max): RETWEET 2.73
- Bonus: PREPPER 2.3
- Review (no dictionary backs these; not in the patch): PRETTIER 3.32 (uncorroborated); TERRE 3.07 (uncorroborated); RITTER 2.99 (uncorroborated); PETRI 2.98 (uncorroborated); TRIPP 2.88 (uncorroborated); TRIPPY 2.86 (wordle-lists only); RETIREE 2.81 (wordle-lists only); PREET 2.5 (uncorroborated)

### hb0330 — day 329 (2027-08-18) · letters TACGIKN (center T) · 27 words / 103 bonus · max 125

- **Main-list worthy** (+35 max): INITIATING 3.38, INCITING 3.17, IGNITING 2.8, AGITATING 2.67
- Review (no dictionary backs these; not in the patch): NIKITA 3.17 (uncorroborated); TATIANA 3.07 (uncorroborated); CATANIA 2.9 (uncorroborated); KATANA 2.83 (wordle-lists only); ATTICA 2.74 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); KITKAT 2.55 (uncorroborated); KATIA 2.51 (uncorroborated)

### hb0331 — day 330 (2027-08-19) · letters NAEFLRT (center N) · 33 words / 222 bonus · max 149

- Bonus: REENTER 2.43
- Review (no dictionary backs these; not in the patch): NAFTA 3.14 (uncorroborated); TENNANT 3.09 (uncorroborated); LERNER 3.07 (uncorroborated); LEANNE 3.03 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); FANART 2.83 (wordle-lists only); RENNER 2.8 (uncorroborated); TARRANT 2.78 (uncorroborated); LALLANA 2.73 (uncorroborated); ARRAN 2.69 (uncorroborated); RENATA 2.68 (uncorroborated); ARNETT 2.64 (uncorroborated); FENNER 2.56 (uncorroborated); ENFANT 2.53 (uncorroborated); FANTA 2.52 (uncorroborated); NELLA 2.52 (uncorroborated); TELNET 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated); RATNER 2.51 (uncorroborated); TERRAN 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0332 — day 331 (2027-08-20) · letters PAILMRT (center P) · 26 words / 130 bonus · max 88

- Review (no dictionary backs these; not in the patch): TAMPA 3.92 (uncorroborated); PARRAMATTA 3.12 (uncorroborated); PLATA 2.88 (uncorroborated); TRIPP 2.88 (uncorroborated); PARTI 2.77 (uncorroborated); TRAPP 2.66 (uncorroborated); PRAIA 2.64 (uncorroborated); TILAPIA 2.64 (wordle-lists only); PATIL 2.62 (uncorroborated)

### hb0333 — day 332 (2027-08-21) · letters PADENOR (center P) · 58 words / 204 bonus · max 249

- **Main-list worthy** (+20 max): PREPPED 2.91, PRODDED 2.59, POOPER 2.56
- Bonus: PANEER 2.31, PREPPER 2.3, DROOPED 1.91
- Review (no dictionary backs these; not in the patch): PRADA 3.21 (uncorroborated); PRADO 2.85 (uncorroborated); DARPA 2.77 (uncorroborated); PEPPA 2.61 (uncorroborated); PREORDERED 2.56 (uncorroborated); PANERA 2.52 (uncorroborated)

### hb0334 — day 333 (2027-08-22) · letters EACDNOU (center E) · 43 words / 128 bonus · max 204

- **Main-list worthy** (+7 max): NUANCED 3.26
- Bonus: DEEDED 2.35
- Review (no dictionary backs these; not in the patch): DUNDEE 3.6 (uncorroborated); NOONE 3.08 (uncorroborated); DEANNA 2.85 (uncorroborated); DONNED 2.8 (wordle-lists only); CONDE 2.77 (uncorroborated); CODEC 2.67 (uncorroborated); AUDEN 2.65 (uncorroborated); DECCAN 2.59 (uncorroborated); DECCA 2.51 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0335 — day 334 (2027-08-23) · letters FAEGINR (center F) · 33 words / 112 bonus · max 149

- **Main-list worthy** (+28 max): REFERRING 4.35, INFRINGING 3.07, INFERRING 2.57
- Review (no dictionary backs these; not in the patch): FERRARI 3.88 (uncorroborated); FARAGE 3.22 (uncorroborated); FRIGGIN 3.17 (uncorroborated); FAIRE 3.14 (uncorroborated); FANNIE 3.07 (uncorroborated); FERRER 3 (uncorroborated); FERGIE 2.91 (uncorroborated); FERREIRA 2.89 (uncorroborated); FARRAR 2.88 (uncorroborated); AIRFARE 2.83 (wordle-lists only); FAGAN 2.76 (uncorroborated); EFFING 2.75 (wordle-lists only); FINNEGAN 2.67 (uncorroborated); FENNER 2.56 (uncorroborated); FRIGGING 2.56 (uncorroborated); GEFFEN 2.56 (uncorroborated)

### hb0336 — day 335 (2027-08-24) · letters TAGILMN (center T) · 30 words / 139 bonus · max 144

- **Main-list worthy** (+46 max): INITIATING 3.38, IMITATING 3.2, MITIGATING 3.14, IGNITING 2.8, AGITATING 2.67
- Bonus: LITIGATING 2.31, LAMINATING 2.14 ★, AMALGAMATING 2.05 ★, INTIMATING 1.99
- Review (no dictionary backs these; not in the patch): ITALIA 3.39 (uncorroborated); LATINA 3.38 (wordle-lists only); TATIANA 3.07 (uncorroborated); ALTMAN 2.96 (uncorroborated); ATTILA 2.89 (uncorroborated); TILLMAN 2.83 (uncorroborated); TAILGATING 2.8 (uncorroborated); TALLINN 2.75 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); GALLATIN 2.66 (uncorroborated); TAMAN 2.53 (uncorroborated); ATALANTA 2.51 (uncorroborated); MITTAL 2.51 (uncorroborated)

### hb0337 — day 336 (2027-08-25) · letters MAEIRTW (center M) · 32 words / 154 bonus · max 99

- Review (no dictionary backs these; not in the patch): MERRITT 3.14 (uncorroborated); MARIETTA 3.04 (uncorroborated); AIRTIME 2.96 (wordle-lists only); WEIMAR 2.92 (uncorroborated); MERRIAM 2.84 (uncorroborated); MATTIE 2.79 (uncorroborated); MEERA 2.77 (uncorroborated); MAIER 2.7 (uncorroborated); MARIAM 2.7 (uncorroborated); MATERIA 2.66 (uncorroborated); MERRIER 2.64 (wordle-lists only); AMIRA 2.62 (uncorroborated); MIRAMAR 2.61 (uncorroborated); REIMER 2.61 (uncorroborated); AMIRITE 2.58 (uncorroborated); AMARI 2.56 (uncorroborated); ARTEM 2.56 (uncorroborated); MIRAI 2.54 (uncorroborated); MARAT 2.51 (uncorroborated); TAMIR 2.51 (uncorroborated)

### hb0338 — day 337 (2027-08-26) · letters MABELOR (center M) · 42 words / 205 bonus · max 155

- **Main-list worthy** (+6 max): MOLLER 2.5
- Bonus: BALMER 2.38
- Review (no dictionary backs these; not in the patch): OBAMA 4.86 (uncorroborated); MOMMA 3.41 (uncorroborated); LEMME 3.19 (uncorroborated); MARLBORO 3.02 (uncorroborated); BROOME 2.93 (uncorroborated); AMORE 2.91 (uncorroborated); ROMMEL 2.81 (uncorroborated); ALBEMARLE 2.79 (uncorroborated); MEERA 2.77 (uncorroborated); ELMORE 2.75 (uncorroborated); MELLOR 2.71 (uncorroborated); MARBELLA 2.7 (uncorroborated); MALALA 2.63 (uncorroborated); MELLO 2.62 (uncorroborated); LAMBO 2.61 (uncorroborated); MORRELL 2.61 (uncorroborated); OMBRE 2.59 (uncorroborated); BAMBA 2.56 (uncorroborated); BREMER 2.56 (uncorroborated); MORELL 2.55 (uncorroborated); MALMO 2.5 (uncorroborated)

### hb0339 — day 338 (2027-08-27) · letters TACINOX (center T) · 30 words / 180 bonus · max 164

- Review (no dictionary backs these; not in the patch): TATIANA 3.07 (uncorroborated); CATANIA 2.9 (uncorroborated); ANTONI 2.89 (uncorroborated); CONTI 2.8 (uncorroborated); ATTICA 2.74 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); ANTONIN 2.68 (uncorroborated); TINTO 2.63 (uncorroborated); TANTO 2.6 (uncorroborated)

### hb0340 — day 339 (2027-08-28) · letters OCEHMNR (center O) · 45 words / 117 bonus · max 159

- Bonus: REHOME 2.05
- Review (no dictionary backs these; not in the patch): MONROE 3.89 (uncorroborated); CONNOR 3.77 (uncorroborated); MORENO 3.35 (uncorroborated); ROCHE 3.32 (uncorroborated); ECOMMERCE 3.3 (uncorroborated); HORNE 3.17 (uncorroborated); ROCCO 3.11 (uncorroborated); NOONE 3.08 (uncorroborated); HOMME 2.93 (uncorroborated); OOOOH 2.93 (uncorroborated); OHHHH 2.9 (uncorroborated); COMME 2.84 (uncorroborated); ENRON 2.84 (uncorroborated); NOOOO 2.82 (uncorroborated); CHRONO 2.69 (uncorroborated); MENON 2.69 (uncorroborated); OCHRE 2.69 (uncorroborated); CERRO 2.66 (uncorroborated); RHONE 2.66 (uncorroborated); NOOOOO 2.63 (uncorroborated); MCENROE 2.57 (uncorroborated); HERRON 2.54 (uncorroborated); HOMEROOM 2.54 (uncorroborated); NEOCON 2.51 (wordle-lists only); OOOOOH 2.51 (uncorroborated)

### hb0341 — day 340 (2027-08-29) · letters NEIMPRT (center N) · 36 words / 192 bonus · max 198

- **Main-list worthy** (+6 max): PINTER 2.63
- Bonus: REENTER 2.43
- Review (no dictionary backs these; not in the patch): INTERNET 5.06 (uncorroborated); EMINEM 3.34 (uncorroborated); ETIENNE 3.1 (uncorroborated); MIRREN 2.89 (uncorroborated); RENNIE 2.89 (uncorroborated); PERRIN 2.83 (uncorroborated); RENNER 2.8 (uncorroborated); PREEMINENT 2.79 (uncorroborated); INNIT 2.74 (uncorroborated); TRIPPIN 2.71 (uncorroborated); TINTIN 2.7 (uncorroborated); EINER 2.54 (uncorroborated); PRETEEN 2.53 (wordle-lists only)

### hb0342 — day 341 (2027-08-30) · letters OGINQTU (center O) · 20 words / 51 bonus · max 94

- **Main-list worthy** (+7 max): GOUGING 2.67
- Review (no dictionary backs these; not in the patch): QUITO 2.83 (uncorroborated); NOOOO 2.82 (uncorroborated); NOTTING 2.77 (uncorroborated); GOTTI 2.7 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated)

### hb0343 — day 342 (2027-08-31) · letters PADEGRU (center P) · 35 words / 121 bonus · max 167

- **Main-list worthy** (+7 max): PREPPED 2.91
- Bonus: PREPPER 2.3
- Review (no dictionary backs these; not in the patch): PAPUA 3.42 (uncorroborated); PURDUE 3.38 (uncorroborated); PRADA 3.21 (uncorroborated); UPPED 3.07 (uncorroborated); DARPA 2.77 (uncorroborated); PADUA 2.76 (uncorroborated); DUPREE 2.67 (uncorroborated); PEPPA 2.61 (uncorroborated); PERDUE 2.6 (uncorroborated); PRAEGER 2.5 (uncorroborated)

### hb0344 — day 343 (2027-09-01) · letters EFGILNO (center E) · 27 words / 109 bonus · max 92

- Review (no dictionary backs these; not in the patch): LENNON 3.56 (uncorroborated); LENIN 3.44 (uncorroborated); GEELONG 3.28 (uncorroborated); FEELIN 3.24 (uncorroborated); EIFFEL 3.23 (uncorroborated); INLINE 3.18 (wordle-lists only); ELGIN 3.17 (uncorroborated); NOONE 3.08 (uncorroborated); NEILL 3.01 (uncorroborated); ENGEL 3 (uncorroborated); LILLE 2.98 (uncorroborated); LONNIE 2.91 (uncorroborated); NOELLE 2.78 (uncorroborated); EFFING 2.75 (wordle-lists only); LILLIE 2.74 (uncorroborated); LENNIE 2.7 (uncorroborated); ENGLE 2.57 (uncorroborated); GLENELG 2.57 (uncorroborated); GEFFEN 2.56 (uncorroborated); GLENNON 2.53 (uncorroborated); LEONIE 2.53 (uncorroborated); LEONG 2.52 (uncorroborated)

### hb0345 — day 344 (2027-09-02) · letters PEILOTX (center P) · 23 words / 81 bonus · max 75

- Review (no dictionary backs these; not in the patch): POOLE 3.34 (uncorroborated); PELLE 2.56 (uncorroborated); PETTIT 2.52 (uncorroborated)

### hb0346 — day 345 (2027-09-03) · letters LADEGHU (center L) · 42 words / 111 bonus · max 153

- Bonus: DUELED 1.94
- Review (no dictionary backs these; not in the patch): HELLA 3.35 (uncorroborated); HALLE 3.21 (uncorroborated); GAULLE 3.02 (uncorroborated); LAUDE 2.99 (uncorroborated); GULAG 2.85 (uncorroborated); HEGEL 2.81 (uncorroborated); DELLE 2.78 (uncorroborated); ALLAHU 2.67 (uncorroborated); LAUDA 2.58 (uncorroborated); DUGDALE 2.54 (uncorroborated)

### hb0347 — day 346 (2027-09-04) · letters IAEFLRW (center I) · 28 words / 105 bonus · max 88

- Review (no dictionary backs these; not in the patch): FERRARI 3.88 (uncorroborated); EIFFEL 3.23 (uncorroborated); FAIRE 3.14 (uncorroborated); LILLE 2.98 (uncorroborated); FERREIRA 2.89 (uncorroborated); AIRFARE 2.83 (wordle-lists only); ILLAWARRA 2.82 (uncorroborated); LILLIE 2.74 (uncorroborated); WIRRAL 2.69 (uncorroborated); WEILL 2.61 (uncorroborated)

### hb0348 — day 347 (2027-09-05) · letters IACELRV (center I) · 42 words / 156 bonus · max 209

- Review (no dictionary backs these; not in the patch): RIVERA 3.44 (uncorroborated); RIVIERA 3.26 (uncorroborated); LILLE 2.98 (uncorroborated); CALLIE 2.97 (uncorroborated); RICCI 2.88 (uncorroborated); VILLARREAL 2.83 (uncorroborated); AVILA 2.81 (uncorroborated); LEICA 2.79 (uncorroborated); RECIEVE 2.75 (uncorroborated); LILLIE 2.74 (uncorroborated); VIEIRA 2.74 (uncorroborated); CAVILL 2.58 (uncorroborated); CAVALLI 2.56 (uncorroborated); AVICII 2.5 (uncorroborated); VIVRE 2.5 (uncorroborated)

### hb0349 — day 348 (2027-09-06) · letters ABDEGNO (center A) · 32 words / 138 bonus · max 128

- Review (no dictionary backs these; not in the patch): GONNA 5.29 (wordle-lists only); BADEN 3.52 (uncorroborated); BANNON 3.12 (uncorroborated); ANAND 3.1 (uncorroborated); ABABA 2.96 (uncorroborated); GABON 2.92 (uncorroborated); GAGGED 2.9 (wordle-lists only); ANNAN 2.88 (uncorroborated); DEANNA 2.85 (uncorroborated); NOONAN 2.85 (uncorroborated); GANNON 2.84 (uncorroborated); NABBED 2.79 (wordle-lists only); BANDANA 2.75 (wordle-lists only); GABBANA 2.72 (uncorroborated); NEGAN 2.71 (uncorroborated); AEGON 2.64 (uncorroborated); ADDON 2.63 (uncorroborated); BOGDAN 2.62 (uncorroborated); GANGBANG 2.61 (uncorroborated); NAGANO 2.6 (uncorroborated); DANDENONG 2.58 (uncorroborated); BADOO 2.52 (uncorroborated); GAGNON 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0350 — day 349 (2027-09-07) · letters AELNRTX (center A) · 55 words / 282 bonus · max 230

- Review (no dictionary backs these; not in the patch): XANAX 3.18 (uncorroborated); TENNANT 3.09 (uncorroborated); LEANNE 3.03 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); TARRANT 2.78 (uncorroborated); LALLANA 2.73 (uncorroborated); ARRAN 2.69 (uncorroborated); RENATA 2.68 (uncorroborated); ARNETT 2.64 (uncorroborated); ARTETA 2.6 (uncorroborated); TARTE 2.59 (uncorroborated); NELLA 2.52 (uncorroborated); ATALANTA 2.51 (uncorroborated); RATNER 2.51 (uncorroborated); TERRAN 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0351 — day 350 (2027-09-08) · letters OAIMNTV (center O) · 32 words / 130 bonus · max 168

- Review (no dictionary backs these; not in the patch): MOMMA 3.41 (uncorroborated); MOVIN 3.08 (uncorroborated); ANTONI 2.89 (uncorroborated); NOONAN 2.85 (uncorroborated); NOOOO 2.82 (uncorroborated); IVANOV 2.77 (uncorroborated); MOANA 2.76 (uncorroborated); ANTONIN 2.68 (uncorroborated); AMATO 2.67 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); TANTO 2.6 (uncorroborated); ANOVA 2.57 (uncorroborated); MOTTA 2.54 (uncorroborated); MINATO 2.53 (uncorroborated); MINTON 2.53 (uncorroborated); MONTI 2.5 (uncorroborated); OMNIA 2.5 (uncorroborated)

### hb0352 — day 351 (2027-09-09) · letters TGHIORU (center T) · 31 words / 79 bonus · max 119

- Review (no dictionary backs these; not in the patch): ROHIT 2.98 (uncorroborated); TRURO 2.79 (uncorroborated); TROTT 2.77 (uncorroborated); GOTTI 2.7 (uncorroborated); HOUTHI 2.67 (uncorroborated)

### hb0353 — day 352 (2027-09-10) · letters FELMORY (center F) · 22 words / 61 bonus · max 92

- Bonus: FROMMER 2.02
- Review (no dictionary backs these; not in the patch): FOLEY 3.5 (uncorroborated); FEMME 3.19 (uncorroborated); FERRER 3 (uncorroborated); FERRELL 2.97 (uncorroborated); FERRO 2.74 (uncorroborated); FROMM 2.66 (uncorroborated); FROME 2.65 (uncorroborated); FEELY 2.61 (uncorroborated); FOYLE 2.61 (uncorroborated); FREEFORM 2.55 (uncorroborated); FROOME 2.52 (uncorroborated)

### hb0354 — day 353 (2027-09-11) · letters CEILRTY (center C) · 23 words / 96 bonus · max 121

- Bonus: RECYCLER 2.12, CELLER 1.95, REELECT 1.91
- Review (no dictionary backs these; not in the patch): RICCI 2.88 (uncorroborated); CRITTER 2.77 (wordle-lists only); LECLERC 2.62 (uncorroborated); LECTER 2.52 (uncorroborated)

### hb0355 — day 354 (2027-09-12) · letters GDEILOY (center G) · 24 words / 89 bonus · max 110

- **Main-list worthy** (+7 max): GOOGLED 3.14
- Review (no dictionary backs these; not in the patch): GOODE 2.97 (uncorroborated); GOODELL 2.92 (uncorroborated); GOODIE 2.8 (wordle-lists only); GOGOL 2.55 (uncorroborated)

### hb0356 — day 355 (2027-09-13) · letters BAEKRWY (center B) · 24 words / 85 bonus · max 96

- **Main-list worthy** (+5 max): BABAR 2.61
- Bonus: BABER 2.19
- Review (no dictionary backs these; not in the patch): AKBAR 3.29 (uncorroborated); BAYER 3.26 (uncorroborated); BARRE 3.08 (uncorroborated); ABABA 2.96 (uncorroborated); BARAK 2.71 (uncorroborated); BEEBE 2.63 (uncorroborated); BEYER 2.63 (uncorroborated); KERBER 2.63 (uncorroborated); BARAKA 2.61 (uncorroborated); BREYER 2.6 (uncorroborated); BERRA 2.53 (uncorroborated); BARBA 2.5 (uncorroborated)

### hb0357 — day 356 (2027-09-14) · letters RBEHILO (center R) · 21 words / 113 bonus · max 71

- Bonus: REHIRE 2.24, BELLER 2.04
- Review (no dictionary backs these; not in the patch): ROBBIE 3.84 (uncorroborated); BIEBER 3.7 (uncorroborated); HERBIE 2.93 (uncorroborated); LIBRE 2.86 (uncorroborated); LOIRE 2.75 (uncorroborated); RIBEIRO 2.68 (uncorroborated); LIBOR 2.63 (uncorroborated); ELLER 2.59 (wordle-lists only); HOLIER 2.55 (wordle-lists only); BLOOR 2.54 (uncorroborated); HILLIER 2.53 (wordle-lists only); LORELEI 2.52 (uncorroborated)

### hb0358 — day 357 (2027-09-15) · letters CDNORTU (center C) · 20 words / 67 bonus · max 104

- Review (no dictionary backs these; not in the patch): CONNOR 3.77 (uncorroborated); ROCCO 3.11 (uncorroborated); UCONN 3.09 (uncorroborated); CONDON 2.79 (uncorroborated)

### hb0359 — day 358 (2027-09-16) · letters TCEGINX (center T) · 26 words / 55 bonus · max 123

- **Main-list worthy** (+16 max): INCITING 3.17, IGNITING 2.8
- Bonus: GENTING 2.27, TENTING 1.92
- Review (no dictionary backs these; not in the patch): GETTIN 3.72 (uncorroborated); ETIENNE 3.1 (uncorroborated); TENCENT 2.81 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); GENTE 2.51 (uncorroborated)

### hb0360 — day 359 (2027-09-17) · letters OCDIMNU (center O) · 25 words / 95 bonus · max 109

- Bonus: NONIONIC 1.96, MONOD 1.91
- Review (no dictionary backs these; not in the patch): DUNNO 3.76 (uncorroborated); COMIN 3.53 (uncorroborated); CUOMO 3.28 (uncorroborated); UCONN 3.09 (uncorroborated); MUNDO 3.05 (uncorroborated); NOOOO 2.82 (uncorroborated); CINCO 2.81 (uncorroborated); CONDON 2.79 (uncorroborated); MONDO 2.79 (uncorroborated); INDIO 2.69 (uncorroborated); NOOOOO 2.63 (uncorroborated); DOMINI 2.61 (uncorroborated)

### hb0361 — day 360 (2027-09-18) · letters RACDIOT (center R) · 42 words / 207 bonus · max 170

- Bonus: DADAR 1.92
- Review (no dictionary backs these; not in the patch): ROCCO 3.11 (uncorroborated); ACCRA 3.04 (uncorroborated); ATARI 2.98 (uncorroborated); CARTA 2.91 (uncorroborated); RICCI 2.88 (uncorroborated); CARDI 2.77 (uncorroborated); TROTT 2.77 (uncorroborated); RICCARDO 2.75 (uncorroborated); RICCIARDO 2.7 (uncorroborated); RICOTTA 2.68 (wordle-lists only); DIRAC 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); DIARIO 2.55 (uncorroborated); ROCCA 2.55 (uncorroborated)

### hb0362 — day 361 (2027-09-19) · letters UDEGNOR (center U) · 38 words / 168 bonus · max 202

- Review (no dictionary backs these; not in the patch): DUNNO 3.76 (uncorroborated); DUNDEE 3.6 (uncorroborated); UNDERGONE 3.58 (uncorroborated); GUERRERO 3.17 (uncorroborated); NEUER 2.9 (uncorroborated); ROUEN 2.77 (uncorroborated); GUERRE 2.73 (uncorroborated); RUGER 2.68 (wordle-lists only); UNGER 2.68 (uncorroborated); GRUDEN 2.65 (uncorroborated); ENUGU 2.6 (uncorroborated); ENDURO 2.51 (wordle-lists only)

### hb0363 — day 362 (2027-09-20) · letters MAEINRX (center M) · 28 words / 126 bonus · max 108

- Bonus: REEXAMINE 2.35 ★
- Review (no dictionary backs these; not in the patch): ARMENIA 3.56 (uncorroborated); EMINEM 3.34 (uncorroborated); MAXINE 3.25 (uncorroborated); IMRAN 3.16 (uncorroborated); ARMANI 3.06 (uncorroborated); ARMIN 2.96 (uncorroborated); MIRREN 2.89 (uncorroborated); MERRIAM 2.84 (uncorroborated); MARNIE 2.77 (uncorroborated); MEERA 2.77 (uncorroborated); INMAN 2.72 (uncorroborated); AMINA 2.7 (uncorroborated); MAIER 2.7 (uncorroborated); MARIAM 2.7 (uncorroborated); MARIANNA 2.69 (uncorroborated); MAXIME 2.66 (uncorroborated); NEIMAN 2.65 (uncorroborated); MEENA 2.64 (uncorroborated); MERRIER 2.64 (wordle-lists only); AMIRA 2.62 (uncorroborated); MIRAMAR 2.61 (uncorroborated); REIMER 2.61 (uncorroborated); RIEMANN 2.6 (uncorroborated); AMARI 2.56 (uncorroborated); MERRIMAN 2.55 (uncorroborated); MIRAI 2.54 (uncorroborated); MARINARA 2.53 (uncorroborated)

### hb0364 — day 363 (2027-09-21) · letters MAEGNTU (center M) · 29 words / 148 bonus · max 129

- Review (no dictionary backs these; not in the patch): ANNUM 3.23 (uncorroborated); NEUMANN 3.04 (uncorroborated); MAGEE 2.87 (uncorroborated); GANGNAM 2.79 (uncorroborated); GAUTAM 2.65 (uncorroborated); MEENA 2.64 (uncorroborated); MANET 2.53 (uncorroborated); TAMAN 2.53 (uncorroborated); MAUNA 2.52 (uncorroborated)

### hb0365 — day 364 (2027-09-22) · letters FADEHOR (center F) · 27 words / 83 bonus · max 111

- **Main-list worthy** (+8 max): REFERRED 4.61
- Bonus: FAREED 2.31
- Review (no dictionary backs these; not in the patch): FEDERER 3.22 (uncorroborated); FERRER 3 (uncorroborated); REDFORD 2.91 (uncorroborated); DEFOE 2.9 (uncorroborated); FRODO 2.9 (uncorroborated); FARRAR 2.88 (uncorroborated); RADFORD 2.87 (uncorroborated); FARRAH 2.86 (uncorroborated); FERRO 2.74 (uncorroborated); HARFORD 2.61 (uncorroborated); FEDOR 2.59 (uncorroborated); FREDO 2.57 (uncorroborated); FORDE 2.51 (uncorroborated); HOFFA 2.51 (uncorroborated); OFFROAD 2.5 (wordle-lists only)

### hb0366 — day 365 (2027-09-23) · letters GAEIMRY (center G) · 26 words / 106 bonus · max 114

- **Main-list worthy** (+7 max): GRAMMER 2.67
- Bonus: GRAYER 1.95
- Review (no dictionary backs these; not in the patch): GRAMMY 3.73 (wordle-lists only); GIMME 3.57 (uncorroborated); GRIMM 3.35 (uncorroborated); GEIGER 2.96 (uncorroborated); MAGEE 2.87 (uncorroborated); AMIGA 2.73 (uncorroborated); GEARY 2.71 (uncorroborated); GREIG 2.65 (uncorroborated); MIYAGI 2.65 (uncorroborated); YEAGER 2.64 (uncorroborated)

### hb0367 — day 366 (2027-09-24) · letters RBCELMU (center R) · 25 words / 115 bonus · max 104

- Bonus: BELLER 2.04, CELLER 1.95
- Review (no dictionary backs these; not in the patch): MUELLER 3.61 (uncorroborated); CREME 3.12 (uncorroborated); BURRELL 3.02 (uncorroborated); MCCLURE 2.96 (uncorroborated); EULER 2.79 (uncorroborated); LECLERC 2.62 (uncorroborated); ELLER 2.59 (wordle-lists only); BREMER 2.56 (uncorroborated)

### hb0368 — day 367 (2027-09-25) · letters MAGLORU (center M) · 23 words / 112 bonus · max 91

- Review (no dictionary backs these; not in the patch): MOMMA 3.41 (uncorroborated); MAURO 2.76 (uncorroborated); GOLLUM 2.7 (uncorroborated); MALALA 2.63 (uncorroborated); GAMAL 2.5 (uncorroborated); MALMO 2.5 (uncorroborated)

### hb0369 — day 368 (2027-09-26) · letters MAHNORT (center M) · 33 words / 102 bonus · max 116

- Bonus: NOMAR 2
- Review (no dictionary backs these; not in the patch): HARAM 3.43 (uncorroborated); MOMMA 3.41 (uncorroborated); RAHMAN 3.3 (uncorroborated); HARTMAN 3.12 (uncorroborated); ROMANO 3.07 (wordle-lists only); MOANA 2.76 (uncorroborated); MAHAN 2.69 (uncorroborated); MONAHAN 2.69 (uncorroborated); AMATO 2.67 (uncorroborated); MANMOHAN 2.67 (uncorroborated); MAHON 2.65 (uncorroborated); ROTHMAN 2.61 (uncorroborated); MORATA 2.57 (uncorroborated); ROMANA 2.56 (uncorroborated); MOTTA 2.54 (uncorroborated); TAMAN 2.53 (uncorroborated); MARAT 2.51 (uncorroborated); TOMAR 2.51 (uncorroborated)

### hb0370 — day 369 (2027-09-27) · letters LABDIOT (center L) · 31 words / 130 bonus · max 70

- Review (no dictionary backs these; not in the patch): ITALIA 3.39 (uncorroborated); DALAI 3.28 (uncorroborated); DIABLO 3.28 (uncorroborated); LOLITA 3.07 (wordle-lists only); ALIBABA 2.96 (uncorroborated); BILBAO 2.93 (uncorroborated); IDLIB 2.9 (uncorroborated); ATTILA 2.89 (uncorroborated); DALIT 2.86 (uncorroborated); BILAL 2.83 (uncorroborated); TALIB 2.77 (uncorroborated); ODDBALL 2.76 (wordle-lists only); BLATT 2.61 (uncorroborated); LOLOL 2.58 (uncorroborated); ILOILO 2.5 (uncorroborated)

### hb0371 — day 370 (2027-09-28) · letters HBGORTU (center H) · 22 words / 46 bonus · max 113

- Review (no dictionary backs these; not in the patch): GOUGH 3.04 (uncorroborated); OOOOH 2.93 (uncorroborated); OHHHH 2.9 (uncorroborated); BHUTTO 2.8 (uncorroborated); BUTTHURT 2.76 (uncorroborated); UHHHH 2.63 (uncorroborated); UHURU 2.63 (uncorroborated); OOOOOH 2.51 (uncorroborated)

### hb0372 — day 371 (2027-09-29) · letters FAEGILR (center F) · 38 words / 120 bonus · max 128

- Review (no dictionary backs these; not in the patch): FERRARI 3.88 (uncorroborated); FARRELL 3.45 (uncorroborated); EIFFEL 3.23 (uncorroborated); FARAGE 3.22 (uncorroborated); FAIRE 3.14 (uncorroborated); FERRER 3 (uncorroborated); FERRELL 2.97 (uncorroborated); FERGIE 2.91 (uncorroborated); FERREIRA 2.89 (uncorroborated); FARRAR 2.88 (uncorroborated); AIRFARE 2.83 (wordle-lists only); RAFFAELE 2.65 (uncorroborated); FALAFEL 2.64 (wordle-lists only); FLAGG 2.56 (uncorroborated); FREEFALL 2.56 (uncorroborated)

### hb0373 — day 372 (2027-09-30) · letters TAILNOY (center T) · 32 words / 169 bonus · max 155

- Review (no dictionary backs these; not in the patch): TOYOTA 3.95 (uncorroborated); LATINO 3.79 (wordle-lists only); ITALIA 3.39 (uncorroborated); LATINA 3.38 (wordle-lists only); LOLITA 3.07 (wordle-lists only); TATIANA 3.07 (uncorroborated); LAYTON 2.93 (uncorroborated); ANTONI 2.89 (uncorroborated); ATTILA 2.89 (uncorroborated); LINTON 2.88 (uncorroborated); ANATOLIA 2.77 (uncorroborated); TALLINN 2.75 (uncorroborated); INNIT 2.74 (uncorroborated); TINTIN 2.7 (uncorroborated); ANTONIN 2.68 (uncorroborated); NATALYA 2.67 (uncorroborated); TINTO 2.63 (uncorroborated); ITALIANO 2.62 (uncorroborated); LYTTON 2.62 (uncorroborated); ALTOONA 2.61 (uncorroborated); TANTO 2.6 (uncorroborated); ANTALYA 2.58 (uncorroborated); YALTA 2.57 (uncorroborated); ATALANTA 2.51 (uncorroborated)

### hb0374 — day 373 (2027-10-01) · letters RACEILM (center R) · 50 words / 224 bonus · max 214

- **Main-list worthy** (+6 max): CRAMER 2.93
- Bonus: CELLER 1.95
- Review (no dictionary backs these; not in the patch): MERRILL 3.51 (uncorroborated); CRIMEA 3.45 (uncorroborated); CREME 3.12 (uncorroborated); ACCRA 3.04 (uncorroborated); MILLAR 2.99 (uncorroborated); RICCI 2.88 (uncorroborated); MERRIAM 2.84 (uncorroborated); CARRERA 2.77 (uncorroborated); MEERA 2.77 (uncorroborated); MAIER 2.7 (uncorroborated); MARIAM 2.7 (uncorroborated); MCRAE 2.7 (uncorroborated); MERCIER 2.69 (uncorroborated); MERCIA 2.67 (uncorroborated); ELMIRA 2.66 (uncorroborated); MACRAE 2.64 (uncorroborated); MERRIER 2.64 (wordle-lists only); AMIRA 2.62 (uncorroborated); LECLERC 2.62 (uncorroborated); MIRAMAR 2.61 (uncorroborated); REIMER 2.61 (uncorroborated); ELLER 2.59 (wordle-lists only); RACECAR 2.58 (uncorroborated); CALAMARI 2.57 (uncorroborated); AMARI 2.56 (uncorroborated); MIRAI 2.54 (uncorroborated); CARLE 2.53 (uncorroborated); ICECREAM 2.53 (uncorroborated); MARCA 2.5 (uncorroborated)

### hb0375 — day 374 (2027-10-02) · letters NDEIMRU (center N) · 40 words / 177 bonus · max 203

- Review (no dictionary backs these; not in the patch): DUNDEE 3.6 (uncorroborated); EMINEM 3.34 (uncorroborated); RUNNIN 3.15 (uncorroborated); DUNEDIN 2.95 (uncorroborated); NEUER 2.9 (uncorroborated); MIRREN 2.89 (uncorroborated); RENNIE 2.89 (uncorroborated); RENNER 2.8 (uncorroborated); RIDIN 2.69 (uncorroborated); MUNDI 2.59 (uncorroborated); EINER 2.54 (uncorroborated)

### hb0376 — day 375 (2027-10-03) · letters ODEKLRV (center O) · 44 words / 94 bonus · max 208

- Bonus: DOLLED 2.44, OVERRODE 2.3, DOLED 2.27, DOERR 2.07, LODER 2.07, DOODLED 1.99
- Review (no dictionary backs these; not in the patch): VOLVO 3.48 (uncorroborated); LORDE 3.16 (uncorroborated); LOVELL 2.97 (uncorroborated); ROLLOVER 2.85 (uncorroborated); VOLKER 2.64 (uncorroborated); KROLL 2.59 (uncorroborated); LOLOL 2.58 (uncorroborated)

### hb0377 — day 376 (2027-10-04) · letters OBCDENU (center O) · 34 words / 79 bonus · max 138

- Review (no dictionary backs these; not in the patch): DUNNO 3.76 (uncorroborated); UCONN 3.09 (uncorroborated); NOONE 3.08 (uncorroborated); BUENO 2.93 (uncorroborated); NOOOO 2.82 (uncorroborated); DONNED 2.8 (wordle-lists only); CONDON 2.79 (uncorroborated); CONDE 2.77 (uncorroborated); BONNE 2.67 (uncorroborated); CODEC 2.67 (uncorroborated); NOOOOO 2.63 (uncorroborated); NEOCON 2.51 (wordle-lists only)

### hb0378 — day 377 (2027-10-05) · letters ACDEMOT (center A) · 40 words / 112 bonus · max 165

- Review (no dictionary backs these; not in the patch): MOMMA 3.41 (uncorroborated); METADATA 3.36 (uncorroborated); TACOMA 3.28 (uncorroborated); MATTEO 3.15 (uncorroborated); MEDEA 2.76 (uncorroborated); ADAMA 2.74 (uncorroborated); AMATO 2.67 (uncorroborated); MOTTA 2.54 (uncorroborated); MCADOO 2.53 (uncorroborated); DECCA 2.51 (uncorroborated)

### hb0379 — day 378 (2027-10-06) · letters HABCDER (center H) · 34 words / 104 bonus · max 151

- **Main-list worthy** (+7 max): BEECHER 2.87
- Review (no dictionary backs these; not in the patch): HAHAHA 3.81 (uncorroborated); HERRERA 3.36 (uncorroborated); HAHAHAHA 3.23 (uncorroborated); HAHAH 3.08 (uncorroborated); AHHHH 2.93 (uncorroborated); HARARE 2.85 (uncorroborated); RADHA 2.82 (uncorroborated); HAHAHAHAHA 2.81 (uncorroborated); HADDAD 2.63 (uncorroborated); AHAHA 2.62 (uncorroborated); HAHAHAH 2.62 (uncorroborated); HABER 2.59 (uncorroborated); HEHEHE 2.58 (uncorroborated); AAAAH 2.57 (uncorroborated); AHHHHH 2.54 (uncorroborated)

### hb0380 — day 379 (2027-10-07) · letters OCEHRUV (center O) · 21 words / 57 bonus · max 87

- Review (no dictionary backs these; not in the patch): ROCHE 3.32 (uncorroborated); ROCCO 3.11 (uncorroborated); OOOOH 2.93 (uncorroborated); OHHHH 2.9 (uncorroborated); COEUR 2.88 (uncorroborated); OEUVRE 2.79 (wordle-lists only); OCHRE 2.69 (uncorroborated); CERRO 2.66 (uncorroborated); OOOOOH 2.51 (uncorroborated)

### hb0381 — day 380 (2027-10-08) · letters FADELRT (center F) · 52 words / 139 bonus · max 201

- **Main-list worthy** (+8 max): REFERRED 4.61
- Bonus: FAREED 2.31
- Review (no dictionary backs these; not in the patch): FARRELL 3.45 (uncorroborated); FEDERER 3.22 (uncorroborated); FERRER 3 (uncorroborated); FERRELL 2.97 (uncorroborated); FARRAR 2.88 (uncorroborated); ARAFAT 2.86 (uncorroborated); FARTED 2.78 (wordle-lists only); RAFFAELE 2.65 (uncorroborated); FALAFEL 2.64 (wordle-lists only); AFTERALL 2.59 (uncorroborated); FATALE 2.59 (uncorroborated); FREEFALL 2.56 (uncorroborated)

### hb0382 — day 381 (2027-10-09) · letters OABCLRT (center O) · 55 words / 194 bonus · max 195

- Review (no dictionary backs these; not in the patch): CARROLL 3.8 (uncorroborated); ABBOTT 3.78 (uncorroborated); ROCCO 3.11 (uncorroborated); COLLAB 2.97 (wordle-lists only); TROTT 2.77 (uncorroborated); TOOLBAR 2.73 (wordle-lists only); ALCOA 2.67 (uncorroborated); OCALA 2.61 (uncorroborated); ALCOTT 2.59 (uncorroborated); LOLOL 2.58 (uncorroborated); ARORA 2.57 (uncorroborated); CARLOTTA 2.57 (uncorroborated); ROCCA 2.55 (uncorroborated); BLOOR 2.54 (uncorroborated); BORAT 2.54 (uncorroborated); LORCA 2.53 (uncorroborated)

### hb0383 — day 382 (2027-10-10) · letters RABEITV (center R) · 55 words / 336 bonus · max 245

- **Main-list worthy** (+5 max): BABAR 2.61
- Bonus: VIBER 2.41, BABER 2.19
- Review (no dictionary backs these; not in the patch): ARABIA 4.12 (uncorroborated); BIEBER 3.7 (uncorroborated); BARBIE 3.56 (uncorroborated); RIVERA 3.44 (uncorroborated); RIVIERA 3.26 (uncorroborated); BAVARIA 3.18 (uncorroborated); BARRIE 3.12 (uncorroborated); BARRE 3.08 (uncorroborated); TERRE 3.07 (uncorroborated); BREITBART 3.05 (uncorroborated); ERITREA 3.05 (uncorroborated); RITTER 2.99 (uncorroborated); ATARI 2.98 (uncorroborated); EBERT 2.96 (uncorroborated); RETIREE 2.81 (wordle-lists only); TIERRA 2.81 (uncorroborated); VIEIRA 2.74 (uncorroborated); BERETTA 2.71 (uncorroborated); VIRAT 2.64 (uncorroborated); BITRATE 2.63 (wordle-lists only); ARTETA 2.6 (uncorroborated); TIBER 2.6 (wordle-lists only); TARTE 2.59 (uncorroborated); BARRATT 2.53 (uncorroborated); BERRA 2.53 (uncorroborated); BRITTA 2.53 (uncorroborated); BARBA 2.5 (uncorroborated); VIVRE 2.5 (uncorroborated)

### hb0384 — day 383 (2027-10-11) · letters RAMOTUY (center R) · 33 words / 141 bonus · max 121

- Bonus: AUTOR 2.07
- Review (no dictionary backs these; not in the patch): UTTAR 3.22 (uncorroborated); ARTURO 3.1 (uncorroborated); YARRA 2.81 (uncorroborated); TRURO 2.79 (uncorroborated); MARYAM 2.78 (uncorroborated); TROTT 2.77 (uncorroborated); MAURO 2.76 (uncorroborated); ARORA 2.57 (uncorroborated); MORATA 2.57 (uncorroborated); YATRA 2.52 (uncorroborated); MARAT 2.51 (uncorroborated); TOMAR 2.51 (uncorroborated)

### hb0385 — day 384 (2027-10-12) · letters EACLMTU (center E) · 34 words / 161 bonus · max 117

- Review (no dictionary backs these; not in the patch): LEMME 3.19 (uncorroborated); TUTTLE 2.96 (uncorroborated); CALLE 2.91 (uncorroborated); MATTEL 2.87 (uncorroborated); ALCATEL 2.63 (uncorroborated); CELTA 2.62 (uncorroborated)

### hb0386 — day 385 (2027-10-13) · letters UBCEHRT (center U) · 22 words / 97 bonus · max 84

- Bonus: TRUTHER 2.05
- Review (no dictionary backs these; not in the patch): HUBER 2.93 (wordle-lists only); BURCH 2.92 (uncorroborated); CHUBB 2.77 (uncorroborated); BUTTHURT 2.76 (uncorroborated); UHHHH 2.63 (uncorroborated); UHURU 2.63 (uncorroborated)

### hb0387 — day 386 (2027-10-14) · letters PACILRT (center P) · 21 words / 141 bonus · max 61

- Review (no dictionary backs these; not in the patch): PLATA 2.88 (uncorroborated); TRIPP 2.88 (uncorroborated); PARTI 2.77 (uncorroborated); TRAPP 2.66 (uncorroborated); PRAIA 2.64 (uncorroborated); TILAPIA 2.64 (wordle-lists only); PATIL 2.62 (uncorroborated)

### hb0388 — day 387 (2027-10-15) · letters EACMNOR (center E) · 52 words / 199 bonus · max 185

- **Main-list worthy** (+6 max): CRAMER 2.93
- Review (no dictionary backs these; not in the patch): CAMERON 4.26 (uncorroborated); MONROE 3.89 (uncorroborated); CAMEROON 3.53 (uncorroborated); MORENO 3.35 (uncorroborated); ECOMMERCE 3.3 (uncorroborated); CREME 3.12 (uncorroborated); NOONE 3.08 (uncorroborated); AMORE 2.91 (uncorroborated); COMME 2.84 (uncorroborated); ENRON 2.84 (uncorroborated); RENNER 2.8 (uncorroborated); CARRERA 2.77 (uncorroborated); MEERA 2.77 (uncorroborated); CARNE 2.76 (uncorroborated); MCRAE 2.7 (uncorroborated); MENON 2.69 (uncorroborated); CERRO 2.66 (uncorroborated); EAMON 2.64 (uncorroborated); MACRAE 2.64 (uncorroborated); MEENA 2.64 (uncorroborated); RACECAR 2.58 (uncorroborated); RAMONE 2.58 (uncorroborated); MANCE 2.57 (uncorroborated); MCENROE 2.57 (uncorroborated); CAMERAMEN 2.53 (uncorroborated); NEOCON 2.51 (wordle-lists only); EAMONN 2.5 (uncorroborated)

### hb0389 — day 388 (2027-10-16) · letters ACDELTU (center A) · 38 words / 180 bonus · max 156

- Review (no dictionary backs these; not in the patch): CALCUTTA 3.52 (uncorroborated); LAUDE 2.99 (uncorroborated); CALLE 2.91 (uncorroborated); ALCATEL 2.63 (uncorroborated); LUCCA 2.63 (uncorroborated); CELTA 2.62 (uncorroborated); CLAUDETTE 2.6 (uncorroborated); LAUDA 2.58 (uncorroborated); ACTUATED 2.56 (uncorroborated); DECCA 2.51 (uncorroborated)

### hb0391 — day 390 (2027-10-18) · letters LADIMPU (center L) · 28 words / 133 bonus · max 75

- Review (no dictionary backs these; not in the patch): LIPID 3.29 (wordle-lists only); DALAI 3.28 (uncorroborated); PADILLA 3 (uncorroborated); LUMIA 2.88 (uncorroborated); MALALA 2.63 (uncorroborated); LAUDA 2.58 (uncorroborated); AMALIA 2.51 (uncorroborated)

### hb0392 — day 391 (2027-10-19) · letters CAGINOT (center C) · 36 words / 173 bonus · max 227

- **Main-list worthy** (+16 max): NOTICING 3.64, INCITING 3.17
- Bonus: NONIONIC 1.96
- Review (no dictionary backs these; not in the patch): CATANIA 2.9 (uncorroborated); IGNACIO 2.9 (uncorroborated); CINCO 2.81 (uncorroborated); CONTI 2.8 (uncorroborated); ATTICA 2.74 (uncorroborated); ICANN 2.7 (uncorroborated); COOGAN 2.59 (uncorroborated)

### hb0393 — day 392 (2027-10-20) · letters NAFILOT (center N) · 27 words / 184 bonus · max 144

- Review (no dictionary backs these; not in the patch): LATINO 3.79 (wordle-lists only); FALLON 3.45 (uncorroborated); LATINA 3.38 (wordle-lists only); LILLIAN 3.26 (uncorroborated); ANTIFA 3.2 (uncorroborated); NAFTA 3.14 (uncorroborated); TATIANA 3.07 (uncorroborated); FONTANA 2.92 (uncorroborated); ANTONI 2.89 (uncorroborated); ANNAN 2.88 (uncorroborated); LINTON 2.88 (uncorroborated); NOONAN 2.85 (uncorroborated); NOOOO 2.82 (uncorroborated); FALLIN 2.8 (uncorroborated); ANATOLIA 2.77 (uncorroborated); INFINITI 2.76 (uncorroborated); TALLINN 2.75 (uncorroborated); INNIT 2.74 (uncorroborated); LALLANA 2.73 (uncorroborated); TINTIN 2.7 (uncorroborated); ANTONIN 2.68 (uncorroborated); NOOOOO 2.63 (uncorroborated); TINTO 2.63 (uncorroborated); TITANFALL 2.63 (uncorroborated); ITALIANO 2.62 (uncorroborated); ALTOONA 2.61 (uncorroborated); ILLINI 2.61 (uncorroborated); TANTO 2.6 (uncorroborated); LILIANA 2.55 (uncorroborated); FANTA 2.52 (uncorroborated); TINFOIL 2.52 (wordle-lists only); ATALANTA 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

### hb0394 — day 393 (2027-10-21) · letters GAEORTU (center G) · 30 words / 193 bonus · max 126

- Review (no dictionary backs these; not in the patch): GOTTA 4.95 (uncorroborated); GARRETT 3.67 (uncorroborated); GUERRERO 3.17 (uncorroborated); AGUERO 3.11 (uncorroborated); ORTEGA 3.03 (uncorroborated); GUERRA 2.97 (uncorroborated); TAGGART 2.94 (uncorroborated); OTAGO 2.76 (uncorroborated); GUERRE 2.73 (uncorroborated); RUGER 2.68 (wordle-lists only); TAGORE 2.63 (uncorroborated); GEERT 2.6 (uncorroborated); GUETTA 2.56 (uncorroborated)

### hb0395 — day 394 (2027-10-22) · letters NADEMRU (center N) · 47 words / 246 bonus · max 223

- **Main-list worthy** (+6 max): RENARD 2.67
- Review (no dictionary backs these; not in the patch): DUNDEE 3.6 (uncorroborated); ANNUM 3.23 (uncorroborated); DURAN 3.12 (uncorroborated); ANAND 3.1 (uncorroborated); NEUMANN 3.04 (uncorroborated); ARMAND 2.98 (uncorroborated); NAURU 2.94 (uncorroborated); NADER 2.9 (uncorroborated); NEUER 2.9 (uncorroborated); ANNAN 2.88 (uncorroborated); DEANDRE 2.86 (uncorroborated); DEANNA 2.85 (uncorroborated); DURAND 2.83 (uncorroborated); ANDRADE 2.8 (uncorroborated); RENNER 2.8 (uncorroborated); ARNAUD 2.78 (uncorroborated); REDMAN 2.75 (uncorroborated); MANMADE 2.72 (wordle-lists only); ARRAN 2.69 (uncorroborated); ANDER 2.66 (wordle-lists only); AUDEN 2.65 (uncorroborated); MADMEN 2.65 (wordle-lists only); MEENA 2.64 (uncorroborated); DARDEN 2.54 (uncorroborated); MAUNA 2.52 (uncorroborated); DENMAN 2.5 (uncorroborated); NANNA 2.5 (uncorroborated); RENAUD 2.5 (uncorroborated)

### hb0396 — day 395 (2027-10-23) · letters RAGHOPT (center R) · 29 words / 130 bonus · max 111

- Review (no dictionary backs these; not in the patch): GOPRO 3.14 (uncorroborated); TAGGART 2.94 (uncorroborated); HOGARTH 2.82 (uncorroborated); TROTT 2.77 (uncorroborated); TRAPP 2.66 (uncorroborated); HAGAR 2.59 (uncorroborated); ARORA 2.57 (uncorroborated); POTRO 2.57 (uncorroborated)

### hb0397 — day 396 (2027-10-24) · letters ELMORTY (center E) · 37 words / 226 bonus · max 154

- **Main-list worthy** (+6 max): MOLLER 2.5
- Bonus: TROYER 2.07, METTLER 2, TOMER 1.91
- Review (no dictionary backs these; not in the patch): LEMME 3.19 (uncorroborated); MORLEY 3.18 (uncorroborated); MORTEM 3.16 (uncorroborated); TERRE 3.07 (uncorroborated); TERRELL 2.98 (uncorroborated); TYRELL 2.94 (uncorroborated); TORREY 2.89 (uncorroborated); ROMMEL 2.81 (uncorroborated); LEYTE 2.76 (uncorroborated); ELMORE 2.75 (uncorroborated); MERLOT 2.75 (wordle-lists only); METOO 2.75 (uncorroborated); MELLOR 2.71 (uncorroborated); MOYER 2.63 (uncorroborated); MELLO 2.62 (uncorroborated); MOREY 2.62 (uncorroborated); ELLERY 2.61 (uncorroborated); MORRELL 2.61 (uncorroborated); ELLER 2.59 (wordle-lists only); TYRRELL 2.57 (uncorroborated); LYELL 2.56 (uncorroborated); MORELL 2.55 (uncorroborated); TOOMEY 2.53 (uncorroborated)

### hb0398 — day 397 (2027-10-25) · letters WDEFIOR (center W) · 27 words / 64 bonus · max 112

- Bonus: WEIRDED 2.4, REDREW 2.01, REWORDED 1.93
- Review (no dictionary backs these; not in the patch): WOODFORD 2.9 (uncorroborated); WIERD 2.61 (uncorroborated)

### hb0399 — day 398 (2027-10-26) · letters IDEGHTW (center I) · 22 words / 49 bonus · max 90

- Review (no dictionary backs these; not in the patch): HEWITT 3.39 (uncorroborated); WIDGET 2.96 (wordle-lists only); DEWITT 2.89 (uncorroborated); HEDWIG 2.65 (uncorroborated)

### hb0400 — day 399 (2027-10-27) · letters ACDEJNT (center A) · 38 words / 139 bonus · max 183

- Bonus: DECANTED 1.99
- Review (no dictionary backs these; not in the patch): ANAND 3.1 (uncorroborated); TENNANT 3.09 (uncorroborated); JANATA 2.98 (uncorroborated); ANNAN 2.88 (uncorroborated); AETNA 2.86 (uncorroborated); DEANNA 2.85 (uncorroborated); JADEN 2.76 (uncorroborated); ATTENDEE 2.72 (uncorroborated); JETTA 2.67 (uncorroborated); DECCAN 2.59 (uncorroborated); DEJAN 2.59 (uncorroborated); DECCA 2.51 (uncorroborated); NANNA 2.5 (uncorroborated)

## Unlimited pool (brief)

- hb0401 UDGHORT:  · review: GOUGH TRURO UHHHH UHURU
- hb0402 ECDLNOU: DOLLED DEEDED DOLED DOODLED DUELED · review: DUNDEE LENNON NOONE DOLCE CONNELL DONNED DELLE NOELLE CONDE CODEC DONNELL NEOCON
- hb0403 AGILORT:  · review: GOTTA ITALIA LOLITA GALLO ATARI TAGGART ATTILA OTAGO RIALTO ARORA TIAGO
- hb0404 EABDMNO: EMBEDDED* DEEDED · review: BADEN NOONE MONDE DEANNA DONNED NABBED MEDEA MANMADE MENON MOBBED BONNE MODDED MADMEN EAMON MEENA BEEBE DENMAN EAMONN
- hb0405 TAEINQU:  · review: QUENTIN ETIENNE TENNANT TATIANA INUIT QUETTA AETNA QUINTANA EATIN INNIT TINTIN QUINTA
- hb0406 ODGINRW: IGNORING* DRONING* GORGING WINDOWING · review: GOODWIN RODRIGO GIORGIO NORWOOD RINGO NOOOO RONIN GOODWOOD DONNING INDIO DOGGING GORDO RODIN NOOOOO GODIN GIORNO
- hb0407 CAEHILM:  · review: MICHELE CAMILLE MCCALL CALLIE CAMILA CALLE MICHAELA MECHA LEICA CHICA MALACHI MICHAL HIMACHAL MCHALE LECHE
- hb0408 CAEINPT:  · review: NAACP CAINE CATANIA TENCENT ATTICA ICANN
- hb0409 RACEFIN:  · review: AFRICA FERRARI RICAN FAIRE ACCRA FERRER RACINE NARNIA FERREIRA RENNIE FARRAR RICCI RAINIER FRANCINE AIRFARE RENNER CARRERA CARNE ARRAN ARIANE RECIFE ARIANNA FRANCA NAIRN NAIRA RACECAR EINAR FENNER EINER CIARAN RANIERI
- hb0410 EGINPRX: PREPPING* PREPPER GRINER GENER REENGINEERING · review: GREENE GEIGER RENNIE PERRIN RENNER EPPING GREIG EINER
- hb0411 EIJNPRU: PREPPER · review: JENNER NEUER RENNIE PERRIN RENNER EINER PRENUP
- hb0412 LDEGHIT:  · review: GILLETTE LEHIGH LILLE HEGEL DELLE THIEL LILLIE LIDDELL GILLETT LEGGETT
- hb0413 NEIORTY: REENTRY* REENTER · review: INTERNET NORTON RONNIE ROONEY NOTRE TRYIN ETIENNE NOONE TYRION RENNIE NIETO TORINO ENRON NORTE NOOOO TIERNEY RENNER RONIN INNIT RENOIR NOIRE TINTIN RENTON NOOOOO TINTO EINER TRYON
- hb0414 IENORTV:  · review: INTERNET RONNIE IRVINE VITRO ETIENNE RITTER VINNIE RENNIE NIETO TORINO RETIREE VIVIENNE RONIN IVOIRE VIVIEN INNIT VITTORIO RENOIR NOIRE TINTIN TINTO EINER VIVRE
- hb0415 VAELOPR: LAVAR LEVELLER · review: VOLVO LOVELL VALLE PROVO ROLLOVER ALVARO LAVAL LAVROV PAVLOV EEVEE VALERA VELLA
- hb0416 NAEGLPT:  · review: LANGE TENNANT LEANNE ENGEL GALLEN TELANGANA ANNAN AETNA PATNA LALLANA NEGAN TEGAN NAGEL ENGLE GLENELG ANGELL GANNETT TAPPAN NELLA TELNET ATALANTA GENTE NANNA
- hb0417 ABCDETU: ABETTED* · review: ABABA ACTUATED DECCA
- hb0418 VCEIORT:  · review: VITRO VOICEOVER IVOIRE RECIEVE VITTORIO EEVEE VIVRE
- hb0419 IAFLNPT:  · review: ITALIA LATINA PALIN LILLIAN ANTIFA TATIANA ATTILA FALLIN INFINITI TALLINN INNIT TINTIN LATIF TILAPIA TITANFALL PATIL ILLINI LILIANA FLIPPIN
- hb0420 EILNRTY: REENTRY* REENTER · review: INTERNET INTEL LENIN REILLY INLINE TELLIN ETIENNE LERNER TERRE NEILL RITTER LILLE TERRELL TYRELL RENNIE RETIREE TIERNEY RENNER LEYTE LILLIE LENNIE YELLEN ELLERY ELLER TYRRELL LYELL EINER LILLEY TELNET
- hb0421 PACEHIT:  · review: TAIPEI HIPAA PEPPA PEETA PETTIT
- hb0422 IAENOTX:  · review: NIXON ANTOINE ETIENNE TATIANA XXIII ANTONI NIETO EATIN INNIT TINTIN ANTONIN TINTO
- hb0423 OADEINR: DOERR DRONED · review: RONNIE NOONE RONAN DORAN DOREEN NOONAN DONNER ENRON NOOOO DONNED RONIN RADEON RENOIR REARDON NOIRE ANDORRA INDIO NOIDA INDORE RIORDAN RODIN NORAD ADDON NOOOOO ADRIANO REDONDO DIONNE ARORA DORNAN DIARIO
- hb0424 RDENPTV: PREPPED* DETERRED* REENTER PREPPER PETERED REENTERED VENEERED TEETERED · review: VERDE TERRE DEERE RENNER DREDD PRETEEN PREET
- hb0425 OCDEIMR: CICERO* DOERR MODER COMED · review: ECOMMERCE ROCCO MORDOR COMME MCCORD CODEC MODDED CERRO CORMIER MODRIC MIDORI
- hb0426 PILNOTU:  · review: PUTIN NIPPON LUPIN TIPTON POPUP LIPTON PUTTIN PULLIN PULLOUT
- hb0427 LEFINTY:  · review: INTEL LENIN FEELIN EIFFEL INLINE TELLIN FINLEY NEILL LILLE LEYTE LILLIE LENNIE YELLEN FEELY ILLINI NILLY LYELL LILLEY TELNET FLYIN
- hb0428 AFLMORU:  · review: MOMMA LMFAO FORMA FARRAR MAURO MALALA ARORA MALMO
- hb0429 BADELNP: ABLED BABBLED · review: BADEN BLEEP ABABA ANNABELLE NABBED BANDANA BEEBE
- hb0430 OCFGINR: IGNORING* GORGING NONIONIC · review: CONNOR GIORGIO RINGO ROCCO CONFIG NOOOO CINCO CRONIN OFFICIO RONIN NOOOOO GIORNO
- hb0431 RDEIJNO: DOERR DRONED · review: RONNIE JENNER DIDIER DEERE DOREEN RENNIE DONNER ENRON JORDI RENNER RONIN RENOIR NOIRE DREDD RIDIN INDORE RODIN REDONDO EINER
- hb0432 GBDEILO: GOOGLED* BOGGLED · review: BIGGIE BOGGED GOODE GOODELL GOODIE BLIGE GLOBO GOGOL
- hb0433 CAHIRTU:  · review: ACCRA HITACHI UTICA CARTA RICCI ACURA CHICA ATTICA THICC CHIARA CURIA CATHCART
- hb0434 EFGILNX: EXILING · review: LENIN FEELIN EIFFEL INLINE ELGIN NEILL ENGEL LILLE EFFING LEXIE LILLIE LENNIE ENGLE GLENELG GEFFEN
- hb0435 EABCNRY: BABER · review: BAYERN BRENNAN BYRNE BAYER BARRE CABRERA BRENNER BREEN CARREY RENNER CARRERA CARNE RAYNER BEEBE BEYER BREYER RACECAR BERRA YANCEY
- hb0436 NCDEKOR: REDNECK* ENCODER* CORDONED DRONED CROONED · review: CONNOR NOONE DOREEN DONNER ENRON NOOOO CONCORDE DONNED RENNER CONDON CONDE CORDEN NOOOOO KONDO REDONDO NEOCON
- hb0437 AEGMORT: GRAMMER* · review: GOTTA GARRETT MOMMA MATTEO GAMERGATE ORTEGA TAGGART AMORE MAGEE MEERA OTAGO MARGATE AMATO TAGORE TEATRO ARTETA TARTE ARORA MORATA ARTEM MOTTA MARAT TOMAR
- hb0438 OABDERV: OVERRODE DOERR BROODED · review: DAVAO ARORA BARODA BADOO
- hb0439 NACELRU:  · review: LAUREN LERNER CURRAN LEANNE NAURU NEUER ANNAN CANCUN RENNER CARNE LALLANA ARRAN CALLAN NELLA NANNA
- hb0440 NAEFORT: REENTER · review: NORTON NOTRE EATON FENTON NAFTA TENNANT NOONE RONAN RATON FONTANA ANNAN AETNA NOONAN ENRON NORTE FANART NOOOO RENNER TARRANT EFRON ARRAN FORTRAN RENATA RENATO RENTON ARNETT NOOOOO ATENEO TANTO FENNER ENFANT FANTA RATNER TERRAN NANNA
- hb0441 TCEHIKN:  · review: THINKIN ETIENNE KINECT NICHT TENCENT THICKE INNIT TINTIN THICC KENNETT HECHT INTHE TECHIE
- hb0442 GAEILTY: GATELY · review: GETTY GILLETTE TAILGATE GILLETT LEGGETT
- hb0443 OAFLMRY:  · review: MOMMA LMFAO MALLORY LOYOLA FORMA MOLLOY FROMM MALFOY LOLOL ARORA MALMO
- hb0444 NDELPRU:  · review: DUNDEE LERNER NEUER RENNER PRENUP
- hb0445 MEGILNT: EMITTING* MINGLING* METING MEMEING · review: TIMELINE GENTLEMEN GIMME EMINEM MILNE LEMME LINEMEN EMILIE
- hb0446 CAHMNOR:  · review: CONNOR MONACO MCMAHON MCCANN COCHRAN MCNAMARA ROCCO CAMARO ACCRA CORCORAN OCHOA ROCHA ANARCHO CHRONO ANCHORMAN CONMAN NARCO ROCCA CAMACHO MCCARRON MARCA
- hb0447 OADELPR: PROPELLED* PRODDED* POOPER* DOLLED PLOPPED DOLED DOERR LODER DOODLED DOLLARD DROOPED · review: POOLE DEADPOOL LORDE PRADO LAREDO ROALD OREAL ELDORADO LEOPOLDO LOLOL ARORA PREORDERED
- hb0448 RADINOP: DADAR · review: PRADA RONAN DORAN INDIRA NARNIA PRADO PRIORI DARPA RONIN ANDORRA ARRAN RIDIN ARIANNA RIORDAN RIPON RODIN NAIRN NORAD PRAIA NAIRA ADRIANO ARORA DARRIN DORNAN DIARIO
- hb0449 FAEILNR:  · review: FERRARI FARRELL FEELIN EIFFEL FAIRE FANNIE FERRER FERRELL FELLAINI FERREIRA FARRAR AIRFARE FALLIN RAFFAELE FALAFEL FENNER FREEFALL
- hb0450 ABEGLMN:  · review: LANGE LEANNE ABABA ANNABELLE GALLEN ANNAN MAGEE BANGLA GANGNAM LALLANA GABBANA NEGAN ALLMAN BALLGAME MEENA NAGEL MALALA GANGBANG ANGELL BAMBA NELLA GAMAL NANNA
- hb0451 ABHMORT: BABAR* · review: OBAMA HAHAHA ABBOTT HARAM HOBART MOMMA HAHAHAHA BHARAT HAHAH ABABA AHHHH HAHAHAHAHA BOTHA BHATT AMATO AHAHA HAHAHAH AAAAH ARORA MORATA BAMBA BRABHAM AHHHHH BORAT MOTTA THABO BARRATT ARBROATH BROTHA MARAT TOMAR BARBA
- hb0452 IADMNOT:  · review: DAMMIT DAMIAN DAMNIT TATIANA MINDANAO ANTONI INNIT INMAN AMINA TINTIN INDIO NOIDA ANTONIN TINTO DOMINI MINATO MINTON AADMI MONTI OMNIA
- hb0453 LCEFHIY:  · review: EIFFEL LILLE LIFECYCLE LILLIE FELICE FEELY LYELL LECHE LILLEY
- hb0454 IAFLNTY:  · review: ITALIA LATINA LILLIAN ANTIFA TATIANA ATTILA FINLAY FALLIN INFINITI TALLINN INNIT TINTIN LATIF TITANFALL ILLINI NILLY LILIANA FLYIN
- hb0455 TACHIPR:  · review: HITACHI ATARI CARTA TRIPP TAHIR PARTI ATTICA THICC TRAPP TAHRIR CATHCART
- hb0456 VADEOPR: OVERRODE · review: VADER VERDE DAVAO PROVO PRAVDA EDVARD EEVEE
- hb0457 RDNOTUW:  · review: NORTON NORWOOD TRURO TROTT
- hb0458 FACEIRT:  · review: AFRICA FERRARI FAIRE FERRER FERREIRA FARRAR ARAFAT AIRFARE TRIFECTA RECIFE FACIE
- hb0459 LADEGPU: PEDALED DUELED PULPED · review: GALLUP GAULLE LAUDE GUADALUPE GULAG DELLE LEPAGE PAELLA DEPAUL LAUDA PELLE DUGDALE APPEL
- hb0460 TACFILR:  · review: ITALIA ATARI FRACTAL CARTA ATTILA ARAFAT ATTICA LATIF CLARITA
- hb0461 TCDEIJN:  · review: ETIENNE TENCENT INNIT TINTIN
- hb0462 RDEIMPT: PREPPED* DETERRED* REMEDIED* DRIPPED* REMITTED PREPPER PETERED DIRTIED TEETERED · review: REDDIT PRETTIER PRIMETIME MERRITT DIMITRI TERRE DIDIER RITTER PETRI DEERE DMITRI TRIPP RETIREE PRETERM DREDD MERRIER REIMER DIRTIER RIPTIDE PREET
- hb0463 NADMORT: NOMAR MONOD · review: NORTON ANAND ROMANO RONAN ARMAND RATON DORAN ARMANDO ANNAN NOONAN NOOOO MONDO TARRANT MARADONA MOANA ANDORRA ARRAN NORAD ADDON DORMAN NOOOOO TANTO DORNAN ROMANA TAMAN NANNA
- hb0464 TCDOPRU:  · review: TRURO TROTT POTRO
- hb0465 OGILNPT: GOOGLING* POOPING* TOPPLING* OGLING OPINING TOGGLING PLOPPING LOPING · review: NIPPON LINTON TIPTON NOOOO NOTTING LIPTON GOTTI LONGO NOOOOO TINTO LOLOL GOGOL ILOILO
- hb0466 EDFIPRU: REFERRED* PREPPED* DRIPPED* DEEDED PREPPER REFRIED · review: FREUD PURDUE FEDERER UPPED DIDIER FERRER PFEIFFER DEERE DREDD DUPREE PERDUE
- hb0467 TCDEIKR: DETERRED* TREKKED DIRTIED TEETERED · review: REDDIT TERRE RITTER RETIREE CRITTER TRICKIER ECKERT DIRTIER TIKRIT
- hb0468 OFGHLTU:  · review: GOUGH OOOOH OHHHH LOLOL GOGOL LOUTH OOOOOH
- hb0469 PACELNT:  · review: NAACP PLATA PATNA PLATTE CAPPELLA LAPLACE PAELLA PEPPA CAPLAN PEETA PELLE TAPPAN APPEL
- hb0470 EGHORTU: RETHOUGHT TRUTHER HUGER · review: GUERRERO GOETHE TERRE GUERRE UTERO RUGER GEERT HEHEHE
- hb0471 RALNOPU:  · review: RONAN NAURU ARRAN ARORA
- hb0472 PBELMOR: POOPER* PREPPER · review: POOLE BLEEP POMPEO PELLE
- hb0473 GAEHIRT:  · review: GARRETT GARETH GEIGER TAGGART GREIG AIGHT HIGHGATE GEERT HAGAR HAGER HAIGHT
- hb0474 EABFILN:  · review: LENIN FEELIN EIFFEL INLINE FANNIE LEANNE NEILL LILLE ANNABELLE FELLAINI BIENNALE ABILENE BAILLIE LILLIE BENNIE LENNIE FALAFEL BEEBE BELLINI BEFELL BELLI NELLA
- hb0475 ADEILTU:  · review: ITALIA DALAI LAUDE ATTILA DALIT LAUDA
- hb0476 OACIMNP: NONIONIC · review: MONACO COMIN MOMMA CAPCOM NIPPON CAMINO NOONAN NOOOO CINCO PACINO MOANA CONMAN NOOOOO POCONO OMNIA
- hb0477 UADEFRT:  · review: FREUD TRUDEAU UTTAR DARFUR DUTERTE EDUARD DUARTE
- hb0478 TDEIMNP: METED* · review: ETIENNE INNIT TINTIN PETTIT
- hb0479 ABEGORX: GARBER* BABAR* BABER GRABER · review: BRAGG BARRE ABABA BRAGA ARORA GABOR GARBO BERRA BARBA
- hb0480 HAERTVW: HARTER · review: HAHAHA HERRERA HAHAHAHA HAHAH AHHHH HARARE HEATWAVE HAHAHAHAHA ARETHA HAVRE EARHART AHAHA HAHAHAH HEHEHE AAAAH AHHHHH HARTE
- hb0481 TACDIMR:  · review: DAMMIT DIMITRI MATIC ATARI CARTA DMITRI ATTICA MARAT TAMIR
- hb0482 BDELMTU: EMBEDDED* DUMBED · review: BEEBE BUELL DEMBELE BLUME
- hb0483 IEGHLMT:  · review: GIMME GILLETTE LEHIGH LILLE EMILIE THIEL LILLIE GILLETT
- hb0484 RACNOTY:  · review: CONNOR NORTON ROCCO RONAN ACCRA CONROY RATON CORCORAN CARTA TRYNA YARRA TARRANT TROTT NARAYAN CORTANA ARRAN AYRTON ARORA NARCO ROCCA TRYON YATRA RAYNOR
- hb0485 AEILNOT:  · review: LATINO EATON ANTOINE ITALIA LATINA LILLIAN TENNANT LOLITA TATIANA LEANNE ANTONI ATTILA ANNAN AETNA NOONAN ANATOLIA NATIONALE EATIN TALLINN LALLANA ANTONIN ATENEO ITALIANO ALTOONA TANTO LILIANA NELLA ATALANTA NANNA
- hb0486 CEILNOV: NONIONIC · review: NICOLE VINCI CELINE CONNELL COLVIN CINCO CONLON NEOCON
- hb0487 TDEHIRV: DETERRED* DIRTIED TEETERED · review: REDDIT TERRE RITTER THIER RETIREE DIRTIER
- hb0488 FCEIKLR: FLICKR* · review: EIFFEL FERRER FRICK FERRELL KIEFER RECIFE FELICE
- hb0489 TADINOP:  · review: PATTON TATIANA ANTONI TIPTON PATNA PANDIT INNIT TINTIN ANTONIN TINTO TANTO PONTA TAPPAN
- hb0490 TAINRUY:  · review: TRYIN TURIN UTTAR TATIANA ATARI INUIT TRYNA TARRANT INNIT TINTIN NATURA YATRA TIRANA
- hb0491 AEIMPRV:  · review: RIVERA RIVIERA MERRIAM MEERA VERMA VIEIRA MAIER MARIAM MAEVE PRAIA PAPIER AMIRA MIRAMAR PEPPA AMARI MIRAI
- hb0492 HACDENR:  · review: HANNAH HAHAHA HERRERA HAHAHAHA CHANDRA HAHAH AHHHH HEARN HARARE RADHA HAHAHAHAHA HADEN CHAND HADDAD HENAN AHAHA HAHAHAH AACHEN HEHEHE AAAAH AHHHHH HANNAN DENCH
- hb0493 UBDENOR:  · review: DUNNO DUNDEE BUENO BUREN NEUER ROUEN BRUNNER ENDURO
- hb0494 ABEIRTU: BABAR* BABER BABUR · review: ARABIA BARBIE BAUER UTTAR BARRIE BARRE BREITBART ERITREA ATARI ABABA ARUBA BEATTIE TIERRA BERETTA ABREU BITRATE ARTETA TARTE BARRATT BERRA BRITTA BARBA
- hb0495 IACNOTV: NONIONIC · review: VIVIAN VINCI TATIANA CATANIA ANTONI CINCO CONTI IVANOV ATTICA INNIT ICANN TINTIN ANTONIN CAVANI TINTO IVANOVIC IVANA INVICTA AVICII
- hb0496 OFINPRT:  · review: NORTON NIPPON POIROT TORINO TIPTON INFRONT NOOOO PRIORI RONIN TROTT RIPON NOOOOO TINTO POTRO
- hb0497 LAEGUVY:  · review: GAULLE VALLE GULAG LAVAL AYALA LALLY LYELL VELLA
- hb0498 ACEIPTV:  · review: TAIPEI ATTICA PEPPA PEETA AVICII
- hb0499 BDEIKLN:  · review: BIDEN IDLIB BIDDLE BENNIE BEEBE BELLINI BELLI
- hb0500 GAELNTU:  · review: LAGUNA LANGE GUNNA GAULLE NUGENT ENGEL GALLEN TELANGANA GULAG GAUTENG NEGAN TEGAN NAGEL ENUGU ENGLE GLENELG ANGELL GUETTA LEGGETT GANNETT GENTE
- hb0501 OAELNRU:  · review: LENNON NOONE RONAN NOONAN ENRON NOOOO NOELLE ROUEN OREAL LORENA NOOOOO LENORE LOLOL ARORA
- hb0502 RDENOUW: DOERR REDREW DRONED REWORDED · review: NORWOOD DEERE DOREEN NEUER DONNER ENRON RENNER ROUEN DREDD REDONDO ENDURO
- hb0503 PDEMORT: PREPPED* PRODDED* POOPER* PREPPER PETERED TROOPED DROOPED ROMPED · review: PORTE PETRO POMPEO PRETERM TEMPORE PEROT POTRO PREORDERED PREET
- hb0504 AGIMNOR: MANAGING* IMAGINING* ARRANGING* NAGAR* RARING NOMAR · review: GONNA MOMMA MARINO GORMAN IMRAN MARIANO ROMANO ARMANI RONAN ARMIN ORIGAMI GAGGING NARNIA RANGOON GARMIN ARAGON GIANNI ANNAN NOONAN GANNON RAMMING GANGNAM GAIMAN MOANA AMIGA INMAN AMINA MARIAM ARRAN MARIANNA ROMANI ARIANNA ARAGORN NAIRN NAIRA AMIRA MIRAMAR NAGANO ARORA AMARI ROMANA MIRAI MARINARA GAGNON GROGAN NIGRA NANNA OMNIA
- hb0505 YAELORV: EVERLY* · review: LOYOLA LEARY YARRA AYALA REALY LOVEY VALERY ELLERY LALLY LYELL
- hb0506 CADENTU: NUANCED* DECANTED · review: CANCUN TENCENT DECCAN ACTUATED DECCA
- hb0507 RABEKPU: BABAR* PREPPER BABER BABUR · review: BAUER AKBAR BARRE ARUBA ABUBAKAR BARAK ABREU KERBER BARAKA BERRA BARBA
- hb0508 PDEMORW: PREPPED* PRODDED* POOPER* PREPPER DROOPED ROMPED · review: POMPEO PREORDERED
- hb0509 IACFLRY:  · review: AFRICA CALIF RICCI
- hb0510 ACGINOR: ARRANGING* NAGAR* GRACING* RARING CRANING · review: GONNA GARCIA RICAN RONAN ACCRA CORCORAN GAGGING NARNIA RANGOON ARAGON GIANNI IGNACIO ANNAN NOONAN GANNON CORRIGAN ICANN ARRAN ARIANNA ARAGORN NAIRN NAIRA NAGANO COOGAN ARORA NARCO ROCCA CIARAN GAGNON GROGAN NIGRA NANNA
- hb0511 VCENORT:  · review: EVERTON OVERTON VENETO EEVEE
- hb0512 MEFINRT:  · review: EMINEM FEMME MERRITT MIRREN FERMI MERRIER REIMER
- hb0513 WAEGINR: REWIRING · review: WANNA WAGNER WENGER EWING WEINER ANWAR WAGGING AGNEW WARNE WAGGA AWWWW WEENIE GAWAIN WEARIN
- hb0514 IABCELR:  · review: ARABIA BIEBER BARBIE BARRIE LILLE CALLIE ALIBABA RICCI LIBRE BILAL LEICA BAILLIE LILLIE CALABRIA CABBIE BELLI BIRLA
- hb0515 ACDENRU: NUANCED* RENARD* CAREENED CRANED DADAR · review: DURAN ANAND ACCRA CURRAN NAURU NADER ANNAN CANCUN DEANDRE DEANNA DURAND ACURA ANDRADE ARNAUD CARRERA CARNE EDUARD READE ARRAN ANDER AUDEN DECCAN RACECAR UNDERCARD DARDEN DECCA NANNA RENAUD
- hb0516 DELOPRX: EXPELLED* PROPELLED* REPELLED* PREPPED* PRODDED* DOLLED PLOPPED DEEDED DOLED DOERR LODER DOODLED DROOPED · review: LORDE DEERE DREXEL DELLE DREDD LEOPOLDO PREORDERED
- hb0517 RAEGILU:  · review: ALGERIA GUERRA GEIGER AGUILERA AGUILAR GELLER GUERILLA UGLIER EULER AGUIRRE ELGAR GUERRE ALEGRE RUGER LAUER GREIG ALGER ELLER LAURIER LARUE ALLEGRA ALLEGRI
- hb0518 ODEFIRT: TROTTED* DOERR · review: REDFORD DEFOE FRODO FOOTE RETROFIT ROTTED TROTT FERRO FEDOR ODETTE DOTTIE FREDO RETROFITTED FORDE
- hb0519 OABILNT:  · review: LATINO ABBOTT BOLTON BANNON LOLITA BILBAO BALLON ANTONI LINTON NOONAN NOOOO ANATOLIA BONITA ANTONIN NOOOOO TINTO ITALIANO ALTOONA TANTO LOLOL BLANTON ILOILO
- hb0520 NAEHPRT: REENTER PANEER · review: HANNAH TEHRAN ETHERNET TENNANT ANNAN AETNA HEARN PATNA RENNER TARRANT ARRAN RENATA ARNETT HENAN THANET PANTERA TAPPAN PRETEEN HANNAN PANERA RATNER TERRAN NANNA
- hb0521 CAIKLOT:  · review: ATTICA ALCOA OCALA ALCOTT
- hb0522 NAEILTU:  · review: INTEL LENIN LATINA LILLIAN INLINE TELLIN ETIENNE TENNANT TATIANA LEANNE NEILL INUIT TULANE ANNAN AETNA NUTELLA EATIN TALLINN INNIT LALLANA NUTTALL LENNIE TINTIN ILLINI LILIANA NELLA TELNET ATALANTA NANNA
- hb0523 TADELUV:  · review: VETTEL TUTTLE VUELTA
- hb0524 ADLNRUY: DADAR · review: NADAL DURAN ANAND LANDRY NAURU YUNNAN ANNAN DURAND YARRA ARNAUD AYALA LALLANA NARAYAN ARRAN LAURYN LAUDA RUDYARD LALLY ALLARD NANNA
- hb0525 PADEHNO: HAPPEND* · review: PEPPA HADOOP
- hb0526 ACEFGNR: NAGAR* · review: REAGAN FARAGE ACCRA ANNAN FARRAR CARRERA CARNE FAGAN NEGAN ARRAN FRANCA AGENCE RACECAR NANNA
- hb0527 LACDEIY: ALLAYED · review: CADILLAC DALAI DALEY LILLE CALLIE CALLE LEICA DELLE AYALA LILLIE LIDDELL LALLY LYELL LILLEY
- hb0528 ACEHILT:  · review: HAHAHA ITALIA HELLA HAHAHAHA HALLE HAHAH HITACHI CALLIE AHHHH CALLE ATTILA HAHAHAHAHA LEICA CHICA ATTICA CALTECH ALCATEL HALLETT HILAL AHAHA CELTA HAHAHAH HACHETTE AAAAH AHHHHH HAILE HALLIE
- hb0529 ABDELOT: ALLOTTED* ABETTED* ABLED BABBLED · review: ABBOTT ABABA ODDBALL BEATLE BLATT BADOO
- hb0530 GADERVY: AGARD GRAYER GRAYED · review: GARDE GERRARD GAGGED GARDA GEARY VERGARA YEAGER REDGRAVE
- hb0531 ABEKORY: BABAR* BABER · review: AKBAR BAYER BARRE ABABA KORRA YARRA BARAK BARAKA ARORA BERRA BARBA
- hb0532 BCEKLOR: BROOKER BELLER · review: BELLO REEBOK BEEBE KERBER BLOOR
- hb0533 NACILTY:  · review: LATINA CAITLIN LILLIAN CLANCY TATIANA CAITLYN CATANIA ANNAN CALLIN TALLINN INNIT LALLANA ICANN TINTIN NATALYA CALLAN ILLINI NILLY ANTALYA LILIANA ATALANTA NANNA
- hb0534 PACEILN:  · review: PALIN PAINE NAACP CAPPELLA LAPLACE PAELLA PEPPA CAPLAN PELLE APPEL
- hb0535 GACELNO:  · review: GONNA ANGLO GEELONG CLEGG LANGE GALLO ENGEL GALLEN GOLAN GANNON NEGAN GLENCOE AEGON NAGEL ANGOLAN LONGO NAGANO COOGAN AGENCE ENGLE GLENELG ANGELL GOGOL GLENNON LEONG GAGNON
- hb0536 GAELNOU:  · review: GONNA ANGLO GEELONG LAGUNA LANGE GUNNA GALLO GAULLE ENGEL ANGELOU GALLEN GOLAN GULAG GANNON NEGAN AEGON NAGEL ANGOLAN LONGO ENUGU NAGANO ENGLE GLENELG ANGELL GOGOL GLENNON LEONG LUGANO GAGNON
- hb0537 NAEMPRT: REENTER PANEER · review: TENNANT ANNAN AETNA PATNA RENNER TARRANT ARRAN RENATA ARNETT MEENA PERMANENTE PANTERA TAPPAN MANET PRETEEN TAMAN PANERA RATNER TERRAN NANNA
- hb0538 TCDINOU:  · review: DUTTON INUIT CONTI INNIT TINTIN TINTO
- hb0539 PACEILR: PREPPER PILLER CRAPPER · review: PEARCE PEIRCE CAPPELLA PIRELLI RECEP CARPE PRAIA LAPLACE PAELLA PAPIER PEPPA PELLE APPEL
- hb0540 CABDEKL:  · review: CALLE CALLBACK DECCA
- hb0541 LEGHINT: ENTITLING · review: INTEL LENIN INLINE ELGIN TELLIN GILLETTE LEHIGH HELENE NEILL ENGEL LILLE HEGEL THIEL LILLIE LENNIE GILLETT ILLINI ENGLE GLENELG LEGGETT HEINLEIN TELNET
- hb0542 OAGINTV: INNOVATING* ATONING ANNOTATING · review: GONNA GOTTA ANTONI NOONAN GANNON NOOOO IVANOV NOTTING OTAGO AVIGNON GOTTI ANTONIN GOVAN NOOOOO TINTO NAGANO TANTO ANOVA TIAGO GIOVANNA GAGNON
- hb0543 OACIMNR: NOMAR NONIONIC · review: CONNOR MONACO COMIN MOMMA MARINO ROCCO CAMARO MARIANO MORNIN ROMANO RONAN CORCORAN CAMINO NOONAN NOOOO CINCO CRONIN RONIN MOANA ROMANI CONMAN NOOOOO ARORA NARCO ROMANA ROCCA MCCARRON OMNIA
- hb0544 EINORTX: REENTER TEXTER · review: INTERNET RONNIE NOTRE EXETER ETIENNE EXXON NOONE TERRE RITTER RENNIE NIETO ENRON NORTE RETIREE RENNER RENOIR NOIRE RENTON EINER
- hb0545 OAEHLNT: NONLETHAL · review: LENNON EATON TAHOE NOONE OOOOH OHHHH HEATON HATTON NOONAN NOOOO HANLON NOELLE HALLO ETHNO NOOOOO ATENEO ALTOONA TANTO LOLOL THEON HOLTON OOOOOH
- hb0546 RCEGINU: INCURRING* GRINER GENER REENGINEERING RUNING · review: GREENE RUNNIN CURRIE GEIGER NEUER RENNIE RICCI RENNER GUERRE RUGER UNGER GREIG EINER
- hb0547 TBEILNU:  · review: INTEL BENNETT UBUNTU TELLIN ETIENNE TUTTLE INUIT INNIT TINTIN LIEUT TELNET
- hb0548 LADIMOP:  · review: LIPID DALAI PADILLA PALOMA DIPLO MALALA LOLOL AMALIA LIMPOPO ILOILO MALMO
- hb0549 AHLMNOR: NOMAR HOLLAR · review: HANNAH HAHAHA HARAM MOMMA RAHMAN HAHAHAHA MARLON HARLAN MAHAL HAHAH ROMANO RONAN HOLMAN AHHHH ANNAN NOONAN HALLAM HAHAHAHAHA HANLON HORAN MOANA HALLO LALLANA HALLORAN ALLMAN MANOLO ARRAN MAHAN MONAHAN MANMOHAN MAHON RAMALLAH MALALA AHAHA HAHAHAH LANHAM AAAAH ARORA ROMANA AHHHHH HANNAN MALMO NANNA
- hb0550 OEGINRV: IGNORING* GROVER* GOERING GORGING · review: OREGON RONNIE GIORGIO RINGO NOONE GREGORIO ENRON NOOOO RONIN IVOIRE RENOIR NOIRE ROGEN GRONINGEN ORIGEN GEORGI NOOOOO GIORNO
- hb0551 EADILMV: DEEDED MIMED · review: MADDIE MELVILLE LEMME LILLE ALMEIDA VALLE MEDVEDEV EMILIE DELLE MEDEA LILLIE LIDDELL MAEVE DEVEL EEVEE IMELDA AMELIE DAVIDE VELLA
- hb0552 FACERTU:  · review: FERRER FARRAR ARAFAT
- hb0553 MDENORT: METED* MODER NORMED MONOD TOMER · review: MONROE EDMONTON MORENO REDMOND MORTEM MONET MONDE DERMOT MORDOR MONDO METOO MORETON MENON MODDED MORTEN MONTERO MODERNE TREMONT
- hb0554 LBEGITY:  · review: GILLETTE LILLE LEYTE LILLIE BLIGE GILLETT LYELL LEGGETT BELLI LILLEY
- hb0555 ABCELOP:  · review: COLLAB ABABA CALLE CAPPELLA COPPOLA ALCOA LAPLACE PAELLA OCALA PEPPA CABELLO APPEL
- hb0556 RAFIMNY:  · review: MYANMAR IMRAN ARMANI ARMIN NARNIA FARRAR YARRA MARYAM RYANAIR NARAYAN MARIAM ARRAN MARIANNA ARIANNA NAIRN NAIRA AMIRA MIRAMAR AMARI MIRAI MARINARA
- hb0557 ADGINOT: DONATING* INITIATING* AGITATING* ATONING ANNOTATING · review: GONNA GOTTA ANAND TATIANA GAGGING GIANNI ANTONI ANNAN NOONAN GANNON OTAGO NOIDA ANTONIN ADDON NAGANO TANTO TIAGO GAGNON NANNA
- hb0558 TABENQU:  · review: BENNETT UBUNTU TENNANT QUETTA AETNA
- hb0559 OADELMN: DOLLED DOLED LEMOND DOODLED MONOD · review: LENNON MALONE MOMMA DOLAN LANDON NOONE MONDE NOONAN DELANO NOOOO DONNED MENLO MONDO NOELLE MALDONADO MOANA LANDO OLDMAN MANOLO MENON MODDED EAMON LOMOND ADDON NOOOOO MELLO LOLOL DONNELL MONDALE EAMONN LEMMON MALMO
- hb0560 OABCGKL:  · review: GLOCK GALLO COLLAB ALCOA OCALA LOLOL GLOBO GOGOL
- hb0561 TAELNPY:  · review: TENNANT PLATA AETNA PATNA PLATTE LEYTE PATTAYA NATALYA ANTALYA YALTA PEETA TALLEY TAPPAN TELNET ATALANTA
- hb0562 EGIORTV: GROVER* · review: TERRE RITTER GEIGER GREGORIO RETIREE IVOIRE GREIG GEORGI GEERT EEVEE VIVRE
- hb0563 AEHLNPT:  · review: HANNAH HAHAHA HELLA HAHAHAHA HALLE TENNANT HAHAH LEANNE AHHHH ANNAN PLATA AETNA PATNA PLATTE HAHAHAHAHA LALLANA PHELAN HALEN HALLETT HENAN PAELLA AHAHA HAHAHAH PEPPA THANET AAAAH PEETA AHHHHH TAPPAN APPEL HANNAN NELLA PLATH ATALANTA NANNA
- hb0564 IACDLTW: WILLD · review: CADILLAC ITALIA DALAI DIWALI ATTILA DALIT ATTICA WALID LAIDLAW WICCA IWATA
- hb0565 LAEIPTV:  · review: LATVIA ITALIA VETTEL LILLE VALLE ATTILA PLATA LEVITT PLATTE AVILA LAVAL LILLIE LEAVITT TILAPIA PAELLA PATIL PELLE APPEL VITALI VELLA VITALE
- hb0566 RBEILTY: BELLER · review: BIEBER REILLY TERRE RITTER TERRELL EBERT TYRELL LIBRE RETIREE BEYER ELLERY BREYER TIBER ELLER TYRRELL
- hb0567 CADETUV:  · review: ACTUATED DECCA
- hb0568 CEINOTX: NONIONIC · review: CINCO TENCENT CONTI NEOCON
- hb0569 MACINOT:  · review: MCCAIN MONACO COMIN MOMMA MCCANN TACOMA MATIC CAMINO MANCINI MOANA MONCTON INMAN AMINA AMATO CONMAN MOTTA MINATO MINTON TAMAN MONTI OMNIA
- hb0570 LABCIMU:  · review: MALIBU MCCALL CALLUM ALIBABA CAMILA CALUM LUMIA BILAL MCCALLUM LUCCA MALALA AMALIA LUMUMBA
- hb0571 TADEIPV:  · review: TAIPEI PEETA PETTIT
- hb0572 PADENRU: PREPPED* PANEER PREPPER · review: PAPUA PURDUE PRADA UPPED DARPA PADUA DUPREE PEPPA PERDUE PANERA PRENUP
- hb0573 IDENOPR: DRIPPED* · review: RONNIE OPIOID DIDIER PIERO NIPPON RENNIE PERRIN PRIORI RONIN RENOIR NOIRE INDIO RIDIN INDORE RIPON RODIN NIPPED DIONNE EINER POIRIER
- hb0574 RCDEHTW: RETWEETED* DETERRED* RETWEET* REDREW TEETERED · review: TERRE CREWE DEERE DREDD
- hb0575 MAELNRT: METTLER · review: LEMME LETTERMAN MARLENE ALTMAN MATTEL MEERA MARTELL ALLMAN MEENA MALALA ARTEM MANET TAMAN MARAT
- hb0576 LDEINUV: DUELED · review: LEVINE LENIN LIVIN INLINE DEVLIN NEILL LILLE LEIDEN DELLE LILLIE LINDE LENNIE LIDDELL DEVEL ELVEN VILLENEUVE ILLINI LEUVEN
- hb0577 EACINTY:  · review: ETIENNE TENNANT CAINE AETNA TENCENT EATIN YANCEY
- hb0578 UEGINRT: NURTURING* REUNITING* RUNING · review: TURIN TURING RUNNIN NUGENT INUIT NEUER GUTTING GUERRE RUGER UNGER ENUGU
- hb0579 FCEILNU:  · review: FEELIN EIFFEL UNICEF FELICE
- hb0580 LACEHIR: HALLER* CELLER · review: HELLA HALLE LILLE CALLIE CALLE EHRLICH LEICA LILLIE HARRELL HILAL LECLERC ELLER CHARLI HAILE LECHE CARLE HILLIER HALLIE
- hb0581 LABITVY: BAILLY* · review: LATVIA ITALIA ALIBABA ATTILA BILAL AVILA LAVAL AYALA TALIB VITALY BLATT YALTA LALLY VITALI
- hb0582 ECGINOT: GENTING TENTING · review: GETTIN ETIENNE NOONE NIETO TENCENT GEICO GENTE NEOCON
- hb0583 UCENOPR:  · review: EUROPE UCONN NEUER COEUR POPUP ROUEN PRENUP
- hb0584 EADHORV: OVERHEARD* HEROD* DEEDED OVERRODE DOERR HOOVERED · review: RHODE HERRERA VADER VERDE DEERE HARARE HAVRE READE DREDD EDVARD HEHEHE EEVEE HOARE
- hb0585 LACEIPT:  · review: ITALIA LILLE CALLIE CALLE ATTILA PLATA PLATTE LEICA CAPPELLA LILLIE TILAPIA ALCATEL LAPLACE PAELLA CELTA PATIL PELLE APPEL
- hb0586 FADEHRT: REFERRED* FAREED · review: FEDERER FERRER FARRAR ARAFAT FARRAH FATAH FARTED
- hb0587 CAELNOW:  · review: WALLACE COWELL CALLE CONNELL CANOLA CONLON COWEN ALCOA CALLAN OCALA NEOCON
- hb0588 OCGINTU: CONTINUING* NOTICING* GOUGING* NONIONIC · review: UCONN NOOOO CINCO CONTI NOTTING GOTTI NOOOOO TINTO
- hb0589 IACEMPT:  · review: TAIPEI MATIC MATTIE ATTICA PETTIT
- hb0590 NAILOPV:  · review: VIVIAN NAPOLI PALIN LILLIAN LOVIN AVALON LIVIN NIPPON PLANO ANNAN NOONAN NOOOO IVANOV LALLANA NOOOOO ILLINI IVANA ANOVA LILIANA NANNA
- hb0591 HAEILPT:  · review: HAHAHA HELLA HAHAHAHA HALLE HAHAH AHHHH PHILIPP HAHAHAHAHA THIEL HIPAA HALLETT HILAL AHAHA HAHAHAH HEHEHE AAAAH AHHHHH HAILE PLATH HALLIE
- hb0592 RAFINTY:  · review: TRYIN ATARI NARNIA FARRAR ARAFAT TRYNA FANART YARRA TARRANT RYANAIR NARAYAN ARRAN ARIANNA NAIRN NAIRA YATRA TIRANA
- hb0593 BELMRUY: BELLER · review: BURRELL BEEBE BEYER BREYER BUELL BREMER BLUME
- hb0594 LABEKNT:  · review: LANKA LANKAN LEANNE ANNABELLE LALLANA BEATLE BLATT NELLA TELNET ATALANTA
- hb0595 IDEMNOT: MIMED · review: NINTENDO EMINEM ETIENNE NIETO INNIT TINTIN INDIO TINTO DOMINI DIONNE DOTTIE MINTON TOMMIE MONTI
- hb0596 YACDILR:  · review: YARRA AYALA LYCRA LALLY CYDIA
- hb0597 DAELNOU: ANNULLED* DOLLED DEEDED DOLED DOODLED DUELED · review: DUNNO DUNDEE NADAL DOLAN LELAND ANAND LANDON LAUDE DEANNA DELANO LOUDOUN DONNED DELLE LANDO ALLENDE AUDEN ADDON LOUDON LAUDA DONNELL LLANDUDNO
- hb0598 EFLNTUV:  · review: VETTEL TUTTLE ELVEN EEVEE LEUVEN TELNET
- hb0599 BELNRTU: BELLER · review: BENNETT BURNETT TURNBULL UBUNTU BURRELL BRENNER EBERT BREEN BUREN BRUNNER BEEBE BRUNEL BUELL
- hb0600 NCEPRTU: REENTER PERCENTER · review: NEUER TENCENT RENNER PRETEEN PRENUP

`*` main-list worthy · `⚠` uncorroborated, review before applying

## Guard test

Proposed as `docs/audits/puzzles/hubbub-everyday-guard.proposed.test.ts` (move to packages/core/src/games/ once the additions are applied): every known everyday word must be accepted by every puzzle its letters fit, and no audited puzzle may lack a main-tier word.
