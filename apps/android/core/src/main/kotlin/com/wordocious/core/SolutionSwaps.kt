package com.wordocious.core

/**
 * §265: answers that read as PROPER NOUNS are swapped out of the answer pools.
 * Each has a lowercase dictionary sense (japan = lacquer, aspen = a poplar) and
 * cleared the frequency bar BECAUSE of the country/city/people it names, so the
 * curation let it through (founder: "Aspen populated on OctoWord and Japan
 * yesterday, why?"). The pools are ORDER-LOCKED (position = deck-permutation
 * input), so nothing is deleted or moved: from the cutover date on, the word at
 * that index resolves to its replacement. Dated seeds gate on the seed's date,
 * undated seeds (unlimited, live VS — server and clients must agree) on
 * wall-clock UTC, exactly like SOLUTIONS_GROWTH_CUTOVER_DATE. The old words stay
 * valid GUESSES. Mirrors: packages/core/src/solution-swaps.ts,
 * apps/ios/Sources/Core/SolutionSwaps.swift,
 * apps/android/core/.../SolutionSwaps.kt — keep all three identical
 * (solution-swaps.test.ts + native tests pin them). Ship all three platforms
 * before the date arrives.
 */
const val SOLUTION_SWAP_CUTOVER_DATE = "2026-10-05"

val SOLUTION_SWAPS: Map<String, String> = mapOf(
    "JAPAN" to "ALOOF",
    "CHINA" to "EJECT",
    "CHILE" to "LIVID",
    "ASPEN" to "DUVET",
    "DUTCH" to "SLUSH",
    "GREEK" to "VISOR",
    "ROMAN" to "GLEAM",
    "SWISS" to "ERUPT",
    "WELSH" to "CRUMB",
    "BIBLE" to "EMBER",
    "BERLIN" to "BLOTCH",
    "BRAZIL" to "JABBER",
    "GERMAN" to "CAJOLE",
    "GOOGLE" to "CARAFE",
    "GREECE" to "CURDLE",
    "MORMON" to "BRAISE",
    "MUSLIM" to "DAWDLE",
    "PANAMA" to "BISECT",
    "VIKING" to "PILFER",
    "CHICAGO" to "PROFUSE",
    "CHINESE" to "COMPOTE",
    "ENGLISH" to "BURNISH",
    "MOROCCO" to "ENTWINE",
)

/** Batch 1 only: the pool with every swapped-out answer replaced IN PLACE (same length, same index). */
fun applySolutionSwaps(pool: List<String>): List<String> = pool.map { SOLUTION_SWAPS[it] ?: it }

/**
 * Batch 2 (founder, 2026-09-23: "please continue to get rid of profanity like
 * fucker and blowjob"): PROFANITY and sexual/drug vocabulary that the 6- and
 * 7-letter curation let through — the exact-match profanity lists carried FUCK
 * and SHIT but not FUCKER/FUCKING/SHITTY, and BLOWJOB only as a username
 * substring. Same mechanism as batch 1, but a SEPARATE table with its own
 * LATER cutover: store builds carrying batch 1 (iOS 1.29 / Android 121) are
 * already out, so SOLUTION_SWAPS must never grow — a client without an entry
 * would deal the old word while the server dealt the new one. The date is set
 * after the next iOS and Android store releases; all four runtimes must carry
 * this table before it arrives. Replacements: common, clean, guessable words
 * absent from the current AND legacy pools, not in any blocklist, and not a
 * batch-1 replacement. The old words stay valid GUESSES.
 */
const val SOLUTION_SWAP_2_CUTOVER_DATE = "2026-11-16"

val SOLUTION_SWAPS_2: Map<String, String> = mapOf(
    "FUCKER" to "CASHEW",
    "FUCKED" to "DAPPER",
    "SHITTY" to "CHISEL",
    "HERPES" to "FONDUE",
    "HEROIN" to "FILLET",
    "FETISH" to "FLAUNT",
    "FUCKING" to "CRUMPET",
    "BLOWJOB" to "APRICOT",
    "BROTHEL" to "BAGPIPE",
    "GENITAL" to "CHUTNEY",
    "VAGINAL" to "COPILOT",
    "COCAINE" to "CATWALK",
    "BONDAGE" to "CROWBAR",
)

/** Batch 2 only, IN PLACE. */
fun applySolutionSwaps2(pool: List<String>): List<String> = pool.map { SOLUTION_SWAPS_2[it] ?: it }

/**
 * Batch 3 (founder, 2026-10-05: "Definitely get the British answers out, I don't
 * care the date you choose"): British-spelled and British-vocabulary answers
 * (COLOUR, THEATRE, CENTRE, YOGHURT, DUSTBIN, PETROL, JUMPER, BLOKE, CHEQUE,
 * ADVERT, PENCE…) plus
 * CRUMPET, which batch 2 itself dealt in place of FUCKING (British, and slang),
 * and DUVET, batch 1's replacement for ASPEN (US: comforter).
 * CRUMPET and DUVET are keyed on earlier replacements, so this table is applied
 * AFTER batches 1 and 2. Its own table because builds carrying batches 1 and 2 are already in
 * the stores (neither may grow). Cutover: the batch-2 date — the 10-09
 * coordinated release (first builds carrying this table) has 5+ weeks to reach
 * users first, and one shared date keeps a single "release before" deadline.
 * It is its own constant so it can move later without touching batch 2.
 * Replacements: same length, common American words, guessable, not current
 * answers, not a batch-1/2 replacement, not British-spelled.
 * The old words stay valid GUESSES.
 */
const val SOLUTION_SWAP_3_CUTOVER_DATE = "2026-11-16"

val SOLUTION_SWAPS_3: Map<String, String> = mapOf(
    "LITRE" to "PECAN",
    "QUEUE" to "LASSO",
    "FIBRE" to "GECKO",
    "BLOKE" to "LLAMA",
    "JUMPER" to "PIGLET",
    "LEARNT" to "TURNIP",
    "RUMOUR" to "WALRUS",
    "CENTRE" to "IGUANA",
    "PLOUGH" to "TOUCAN",
    "PETROL" to "BOBCAT",
    "ARMOUR" to "QUIVER",
    "CHILLI" to "KIMCHI",
    "VAPOUR" to "MAGPIE",
    "HONOUR" to "CATNIP",
    "HUMOUR" to "EGGNOG",
    "AGEING" to "LENTIL",
    "COLOUR" to "SORBET",
    "LABOUR" to "GELATO",
    "FAVOUR" to "CHURRO",
    "FULFIL" to "TAMALE",
    "TUMOUR" to "SALAMI",
    "AMONGST" to "PRETZEL",
    "FLAVOUR" to "POTLUCK",
    "DUSTBIN" to "TOOLBOX",
    "DEFENCE" to "HOEDOWN",
    "PARLOUR" to "SUNBEAM",
    "LICENCE" to "CARPOOL",
    "REALISE" to "TADPOLE",
    "CALIBRE" to "BOBSLED",
    "CENTRED" to "TUGBOAT",
    "MOULDED" to "COWGIRL",
    "FUELLED" to "HARPOON",
    "THEATRE" to "MARACAS",
    "YOGHURT" to "PAPRIKA",
    "OFFENCE" to "TREETOP",
    "HARBOUR" to "WARTHOG",
    "ANALYSE" to "WETSUIT",
    "SULPHUR" to "MUSKRAT",
    "SPECTRE" to "SUNFISH",
    "PENCE" to "GUMBO",
    "CHEQUE" to "WIDGET",
    "ADVERT" to "SUDOKU",
    "DRAUGHT" to "GUMDROP",
    "QUEUING" to "TRAPEZE",
    "DUVET" to "TAFFY",
    "CRUMPET" to "WALLABY",
)

/** Batch 3 only, IN PLACE (keys may be batch-2 replacements — apply after batch 2). */
fun applySolutionSwaps3(pool: List<String>): List<String> = pool.map { SOLUTION_SWAPS_3[it] ?: it }

/**
 * Batch 4 (content audit, 2026-10-06 — REPORT-CONTENT-AUDIT.md / REPORT-CONTENT-FIXES.md):
 * profanity, slurs, sexual / drug / violent words, political and brand names
 * (the report lists them, masked), the British answers batch 3 missed
 * (ENQUIRY, RUBBISH, NETBALL…), proper nouns, and obscure or jargon words (TOGGLE,
 * KINASE, THEREOF…). Its own table because builds carrying batches 1–3 are already
 * out (none of them may grow). Keys are words of the ORIGINAL pools (none is an
 * earlier batch's key or replacement), so this batch is independent of batches
 * 2–3 and can start BEFORE them: its cutover is the day after the next
 * coordinated store builds (2026-10-12). From then until the batch-2/3 date the
 * pools deal batches 1 + 4. Not swapped: the answer-pool-hygiene
 * PENDING_FOUNDER_CALL words (BOOZE, SLAVE, DAMNED…) — still the founder's call.
 * Replacements: same length, common American words, guessable, not a current or
 * legacy answer, not an earlier batch's key or replacement, not blocked, not British.
 * The old words stay valid GUESSES.
 */
const val SOLUTION_SWAP_4_CUTOVER_DATE = "2026-10-13"

/** Batch 4, keys in plain text. */
private val SOLUTION_SWAPS_4_PLAIN: Map<String, String> = mapOf(
    // 5 letters
    "AMINO" to "WISPY",
    "BLANC" to "CHIVE",
    "BOWIE" to "BIKER",
    "COSTA" to "CRYPT",
    "DUCHY" to "GEEKY",
    "EUROS" to "CLEAT",
    "FRANC" to "GAFFE",
    "HEATH" to "MOSSY",
    "HIPPY" to "ANTSY",
    "HYDRO" to "FOAMY",
    "INTER" to "BORED",
    "MAMMA" to "KIDDO",
    "MINCE" to "SAUTE",
    "REMIT" to "BLURB",
    "SHIRE" to "GUSTY",
    "TERRA" to "MUGGY",
    "TERRY" to "GLITZ",
    // 6 letters
    "AIRBUS" to "BRAINY",
    "ALBEDO" to "AMOEBA",
    "AMBLER" to "SLOUCH",
    "ANNALS" to "TROPIC",
    "AORTIC" to "HICCUP",
    "APACHE" to "POSSUM",
    "BANGER" to "SIZZLE",
    "BARROW" to "TOMBOY",
    "BASQUE" to "QUICHE",
    "BATMAN" to "MUDDLE",
    "BATTEN" to "GIRDER",
    "BETHEL" to "SWEATY",
    "BLOODY" to "CHOPPY",
    "BODIED" to "SLIVER",
    "BONITO" to "MINNOW",
    "BOOKER" to "BURLAP",
    "BOURNE" to "SIESTA",
    "BOWMAN" to "JACKAL",
    "BRUINS" to "RECAST",
    "CAIRNS" to "CRUTCH",
    "CAMBER" to "STUCCO",
    "CANTON" to "GROTTO",
    "CANTOR" to "SHRIEK",
    "CAPITA" to "ACUMEN",
    "CARDED" to "CHALKY",
    "CAYMAN" to "WEEVIL",
    "CHEEKY" to "PLUCKY",
    "CICERO" to "ORATOR",
    "CLARET" to "PAPAYA",
    "COCKLE" to "SEESAW",
    "COMELY" to "SNAZZY",
    "CONTRA" to "PACIFY",
    "COOKER" to "OMELET",
    "CORPUS" to "PATINA",
    "CUPOLA" to "PAGODA",
    "CUTLER" to "SKIMPY",
    "DECKER" to "SLEUTH",
    "DHARMA" to "WALLOP",
    "DINGLE" to "SQUEAK",
    "DIPOLE" to "DIPPER",
    "DISTAL" to "GRAINY",
    "DOBSON" to "BELUGA",
    "DODGER" to "SUPPLE",
    "DRAPER" to "RUFFLE",
    "DREAMT" to "MUTTER",
    "ENSUES" to "FALTER",
    "EUROPE" to "COLLIE",
    "EXPIRY" to "UPTICK",
    "EYELET" to "TASSEL",
    "FISHER" to "ANGLER",
    "FOOTED" to "TRYOUT",
    "FULLER" to "STOCKY",
    "GARRET" to "MANTEL",
    "GENERA" to "GAGGLE",
    "GRANGE" to "QUINCE",
    "GUINEA" to "GIBBON",
    "HAIRED" to "FRIZZY",
    "HAPTIC" to "KEYPAD",
    "HARPER" to "CADDIE",
    "HOBBIT" to "URCHIN",
    "HOOVER" to "BASSET",
    "HOWLER" to "WHAMMY",
    "JASPER" to "PEWTER",
    "JOINER" to "PUTTER",
    "KANSAS" to "MIDAIR",
    "KENYAN" to "SPOTTY",
    "KINASE" to "OSPREY",
    "LAGUNA" to "SWAMPY",
    "LAMBDA" to "HYPHEN",
    "LANCET" to "SPLINT",
    "LATINO" to "SUITOR",
    "LEGGED" to "PERUSE",
    "LEVANT" to "GLASSY",
    "LIGAND" to "MUSSEL",
    "LINDEN" to "DAHLIA",
    "LISTER" to "LEVITY",
    "MANILA" to "SELFIE",
    "MEDIAL" to "CORNEA",
    "MERCER" to "WOOLEN",
    "METHYL" to "AIRBAG",
    "MORROW" to "WINTRY",
    "MOZART" to "SONNET",
    "MULLER" to "SPACER",
    "NISSAN" to "BIONIC",
    "NOUGHT" to "PRESTO",
    "OCULUS" to "EERILY",
    "OILERS" to "TWISTY",
    "PACERS" to "SPRAIN",
    "PASSER" to "REFUEL",
    "PIAZZA" to "ENTREE",
    "PLANAR" to "NEGATE",
    "PORTED" to "REHEAT",
    "PRIORY" to "DINGHY",
    "PUNTER" to "TIRADE",
    "QUAKER" to "OBLONG",
    "RECTOR" to "PONCHO",
    "REEVES" to "STINKY",
    "RIDLEY" to "SNOOZE",
    "SALAAM" to "CUTOUT",
    "SCHEMA" to "ITALIC",
    "SCOTCH" to "TUSSLE",
    "SEXTON" to "MUSKET",
    "SIXERS" to "DOLLOP",
    "SLATER" to "TAMPER",
    "SLOUGH" to "SQUIRM",
    "SLUICE" to "SPRAWL",
    "SMITHY" to "WELDER",
    "SNOOPY" to "SNARKY",
    "SOVIET" to "TUMULT",
    "SPICER" to "POINTY",
    "SPOILT" to "SMUDGE",
    "SQUIRE" to "CANTER",
    "STILES" to "SCYTHE",
    "STOKER" to "SKEWER",
    "SURREY" to "SPIFFY",
    "TENSOR" to "TOFFEE",
    "THENCE" to "LEEWAY",
    "THRICE" to "PRESET",
    "TIPPLE" to "FROTHY",
    "TOGGLE" to "BEANIE",
    "ULSTER" to "HOARSE",
    "UNICEF" to "PAJAMA",
    "UNWELL" to "QUEASY",
    "WAGNER" to "BELLOW",
    "WHENCE" to "UNSUNG",
    "WHISKY" to "KIMONO",
    "WICKET" to "HOODIE",
    "WRIGHT" to "SCULPT",
    "YAKUZA" to "PINKIE",
    "ZEPHYR" to "SQUALL",
    "ZIMMER" to "STUBBY",
    // 7 letters
    "AQUEOUS" to "RUBBERY",
    "BATSMAN" to "SLUGGER",
    "BESPOKE" to "THRIFTY",
    "BLOODED" to "MUSCLED",
    "BOLIVIA" to "SAVANNA",
    "BOTANIC" to "PETUNIA",
    "BRONCOS" to "STIRRUP",
    "BULLOCK" to "CARIBOU",
    "CENTRIC" to "NUANCED",
    "CHAPMAN" to "DOORMAN",
    "COGNATE" to "NUMERAL",
    "COLLIER" to "TRUCKER",
    "COOKERY" to "COOKOUT",
    "COROLLA" to "SIDECAR",
    "COULTER" to "TOPSOIL",
    "DICKENS" to "STENCIL",
    "DRACULA" to "GREMLIN",
    "ENQUIRE" to "NOURISH",
    "ENQUIRY" to "AMENITY",
    "FANCIED" to "TEARFUL",
    "FLEMISH" to "CHOWDER",
    "GEARBOX" to "SUNROOF",
    "GOOGLED" to "BROWSED",
    "GRANGER" to "JUGGLER",
    "HACKNEY" to "TAXICAB",
    "HANOVER" to "VERANDA",
    "HECTARE" to "HEXAGON",
    "HEPATIC" to "EARDRUM",
    "INSHORE" to "RIPTIDE",
    "INWARDS" to "FARAWAY",
    "IRONMAN" to "JETPACK",
    "ISLAMIC" to "ORIGAMI",
    "LANGLEY" to "KEYHOLE",
    "LOOSING" to "MOPPING",
    "MAGNETO" to "TOOLKIT",
    "MAHATMA" to "MATINEE",
    "MARQUIS" to "CHARADE",
    "MIDLAND" to "MIDTOWN",
    "NETBALL" to "RAFTING",
    "ORIOLES" to "BUZZARD",
    "PARSONS" to "BARISTA",
    "PEPTIDE" to "MICROBE",
    "PLENARY" to "WEBINAR",
    "POLITIC" to "TACTFUL",
    "POLLARD" to "SAPLING",
    "POLLOCK" to "HALIBUT",
    "PORTAGE" to "CABOOSE",
    "PREFECT" to "CATERER",
    "RAILWAY" to "AIRFARE",
    "RUBBISH" to "TAKEOUT",
    "SIEMENS" to "CHECKUP",
    "SIMPLEX" to "OCTAGON",
    "SKINNER" to "DRIFTER",
    "SNOOKER" to "CROQUET",
    "SPECTRA" to "SUNSPOT",
    "SPIEGEL" to "SPATULA",
    "STRIDER" to "WIPEOUT",
    "SUBUNIT" to "ROADMAP",
    "TALIBAN" to "TRINKET",
    "TEMPLAR" to "SCEPTER",
    "THEREIN" to "OFFLINE",
    "THEREOF" to "ANYTIME",
    "TOOTHED" to "MOONLIT",
    "TRIPOLI" to "LAYOVER",
    "TWITTER" to "HASHTAG",
    "UNITARY" to "PREQUEL",
    "UTERINE" to "MIXTAPE",
    "VENTRAL" to "NOSTRIL",
    "WAISTED" to "PLEATED",
    "WASTAGE" to "SAWDUST",
    "WHITING" to "SARDINE",
)
/**
 * Batch 4, keys that are offensive (profanity, slurs, sexual, drug or violent words) — stored base64-encoded
 * (content-safety policy: no offensive word in plain text in the repo's own files) and decoded at load.
 */
private val SOLUTION_SWAPS_4_ENCODED: Map<String, String> = mapOf(
    "Qk9PVFk=" to "LAYUP",
    "Qk9XRUw=" to "ZESTY",
    "QlVUQ0g=" to "CORGI",
    "RkFUVFk=" to "DECAL",
    "RkVUVVM=" to "TAUPE",
    "U1BBTks=" to "CONDO",
    "UFJJQ0s=" to "PHASE",
    "UkFORFk=" to "ALOHA",
    "VFJVTVA=" to "EMOJI",
    "Q0VSVklY" to "BONSAI",
    "Q1JPVENI" to "SILKEN",
    "QUJVU0VS" to "SQUEAL",
    "QVJPVVNF" to "WHOOSH",
    "Qk9PR0VS" to "TEACUP",
    "QkFOR0VE" to "WALLOW",
    "QkVOREVS" to "SHRILL",
    "QlJFQVNU" to "GOATEE",
    "R0hFVFRP" to "EATERY",
    "R1VOTkVE" to "SWATCH",
    "Rk9ORExF" to "NUZZLE",
    "SE9PS1VQ" to "IMPROV",
    "SElDS0VZ" to "MAYDAY",
    "SElUTUFO" to "MOUSSE",
    "SlVOS0lF" to "PREPPY",
    "T1JBTExZ" to "RUDELY",
    "TE9PTkVZ" to "REWIND",
    "TUFUSU5H" to "SWERVE",
    "TVVDT1VT" to "SPONGY",
    "TlVESVRZ" to "WHIMSY",
    "U0VEVUNF" to "SCURRY",
    "U0xFQVpZ" to "CLUNKY",
    "U1RPTkVE" to "SULLEN",
    "U1RPTkVS" to "MILDEW",
    "UFNZQ0hP" to "GROGGY",
    "UkFDSVNN" to "CANDOR",
    "UkFDSVNU" to "HAGGLE",
    "UkFQSU5H" to "BUNGEE",
    "UklQUEVS" to "PAYOUT",
    "V0lFTkVS" to "PANINI",
    "VVRFUlVT" to "CANOLA",
    "VklBR1JB" to "WASABI",
    "VklSR0lO" to "SERENE",
    "QVJPVVNBTA==" to "ELATION",
    "QVJPVVNFRA==" to "DAZZLED",
    "QVRIRUlTTQ==" to "ANAGRAM",
    "QVRIRUlTVA==" to "RETIREE",
    "R0FOR1NUQQ==" to "SHOWMAN",
    "R1JPUElORw==" to "PEEKING",
    "RkFTQ0lTTQ==" to "CURSIVE",
    "RkFTQ0lTVA==" to "ODDBALL",
    "RkxBU0hFUg==" to "FLIPPER",
    "SEVBVEhFTg==" to "MEERKAT",
    "SFVTVExFUg==" to "FIDDLER",
    "TEVGVElTVA==" to "LOGBOOK",
    "TFVOQVRJQw==" to "DIEHARD",
    "U0FUQU5JQw==" to "OFFBEAT",
    "U0NSRVdFRA==" to "CLAMPED",
    "U0VEVUNFRA==" to "ENTICED",
    "U0VOU1VBTA==" to "PENSIVE",
    "UEFOVElFUw==" to "NECKTIE",
    "UEVSVkVSVA==" to "COPYCAT",
    "UExBWUJPWQ==" to "HOTSHOT",
    "UkVETkVDSw==" to "BANDANA",
    "VE9QTEVTUw==" to "SATCHEL",
)

val SOLUTION_SWAPS_4: Map<String, String> = SOLUTION_SWAPS_4_PLAIN +
    SOLUTION_SWAPS_4_ENCODED.mapKeys { String(java.util.Base64.getDecoder().decode(it.key), Charsets.UTF_8) }

/** Batch 4 only, IN PLACE (keys are original pool words — order-independent of batches 2–3). */
fun applySolutionSwaps4(pool: List<String>): List<String> = pool.map { SOLUTION_SWAPS_4[it] ?: it }

/**
 * Which swap batches are live on date, as a BITMASK: bit k-1 set = batch k has
 * reached its own cutover (batch 1 = 1, batch 2 = 2, batch 3 = 4, batch 4 = 8).
 * Batch 4 starts before batches 2–3, so the live set is not a prefix any more:
 * 0 before 2026-10-05, 1 (batch 1), 9 (batches 1 + 4) from 2026-10-13, 15 from
 * 2026-11-16. Callers pass the value straight to applySolutionSwapBatches and may
 * use it as a cache key.
 */
fun solutionSwapBatchesFor(date: String): Int {
    var mask = 0
    if (date >= SOLUTION_SWAP_CUTOVER_DATE) mask = mask or 1
    if (date >= SOLUTION_SWAP_2_CUTOVER_DATE) mask = mask or 2
    if (date >= SOLUTION_SWAP_3_CUTOVER_DATE) mask = mask or 4
    if (date >= SOLUTION_SWAP_4_CUTOVER_DATE) mask = mask or 8
    return mask
}

/** Every swap batch whose bit is set in [mask] (see solutionSwapBatchesFor), always in table order 1 → 4. */
fun applySolutionSwapBatches(pool: List<String>, mask: Int): List<String> {
    var out = pool
    if (mask and 1 != 0) out = applySolutionSwaps(out)
    if (mask and 2 != 0) out = applySolutionSwaps2(out)
    if (mask and 4 != 0) out = applySolutionSwaps3(out)
    if (mask and 8 != 0) out = applySolutionSwaps4(out)
    return out
}

/** Mask with every batch set. */
const val ALL_SOLUTION_SWAP_BATCHES = 15

/** Every batch in order — the pool as every runtime sees it once the last cutover has passed. */
fun applyAllSolutionSwaps(pool: List<String>): List<String> = applySolutionSwapBatches(pool, ALL_SOLUTION_SWAP_BATCHES)
