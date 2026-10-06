import Foundation

/// §265: answers that read as PROPER NOUNS are swapped out of the answer pools.
/// Each has a lowercase dictionary sense (japan = lacquer, aspen = a poplar) and
/// cleared the frequency bar BECAUSE of the country/city/people it names, so the
/// curation let it through (founder: "Aspen populated on OctoWord and Japan
/// yesterday, why?"). The pools are ORDER-LOCKED (position = deck-permutation
/// input), so nothing is deleted or moved: from the cutover date on, the word at
/// that index resolves to its replacement. Dated seeds gate on the seed's date,
/// undated seeds (unlimited, live VS — server and clients must agree) on
/// wall-clock UTC, exactly like SOLUTIONS_GROWTH_CUTOVER_DATE. The old words stay
/// valid GUESSES. Mirrors: packages/core/src/solution-swaps.ts,
/// apps/ios/Sources/Core/SolutionSwaps.swift,
/// apps/android/core/.../SolutionSwaps.kt — keep all three identical
/// (solution-swaps.test.ts + native tests pin them). Ship all three platforms
/// before the date arrives.
public let SOLUTION_SWAP_CUTOVER_DATE = "2026-10-05"

public let SOLUTION_SWAPS: [String: String] = [
    "JAPAN": "ALOOF",
    "CHINA": "EJECT",
    "CHILE": "LIVID",
    "ASPEN": "DUVET",
    "DUTCH": "SLUSH",
    "GREEK": "VISOR",
    "ROMAN": "GLEAM",
    "SWISS": "ERUPT",
    "WELSH": "CRUMB",
    "BIBLE": "EMBER",
    "BERLIN": "BLOTCH",
    "BRAZIL": "JABBER",
    "GERMAN": "CAJOLE",
    "GOOGLE": "CARAFE",
    "GREECE": "CURDLE",
    "MORMON": "BRAISE",
    "MUSLIM": "DAWDLE",
    "PANAMA": "BISECT",
    "VIKING": "PILFER",
    "CHICAGO": "PROFUSE",
    "CHINESE": "COMPOTE",
    "ENGLISH": "BURNISH",
    "MOROCCO": "ENTWINE",
]

/// Batch 1 only: the pool with every swapped-out answer replaced IN PLACE (same length, same index).
public func applySolutionSwaps(_ pool: [String]) -> [String] {
    pool.map { SOLUTION_SWAPS[$0] ?? $0 }
}

/// Batch 2 (founder, 2026-09-23: "please continue to get rid of profanity like
/// fucker and blowjob"): PROFANITY and sexual/drug vocabulary that the 6- and
/// 7-letter curation let through — the exact-match profanity lists carried FUCK
/// and SHIT but not FUCKER/FUCKING/SHITTY, and BLOWJOB only as a username
/// substring. Same mechanism as batch 1, but a SEPARATE table with its own
/// LATER cutover: store builds carrying batch 1 (iOS 1.29 / Android 121) are
/// already out, so SOLUTION_SWAPS must never grow — a client without an entry
/// would deal the old word while the server dealt the new one. The date is set
/// after the next iOS and Android store releases; all four runtimes must carry
/// this table before it arrives. Replacements: common, clean, guessable words
/// absent from the current AND legacy pools, not in any blocklist, and not a
/// batch-1 replacement. The old words stay valid GUESSES.
public let SOLUTION_SWAP_2_CUTOVER_DATE = "2026-11-16"

public let SOLUTION_SWAPS_2: [String: String] = [
    "FUCKER": "CASHEW",
    "FUCKED": "DAPPER",
    "SHITTY": "CHISEL",
    "HERPES": "FONDUE",
    "HEROIN": "FILLET",
    "FETISH": "FLAUNT",
    "FUCKING": "CRUMPET",
    "BLOWJOB": "APRICOT",
    "BROTHEL": "BAGPIPE",
    "GENITAL": "CHUTNEY",
    "VAGINAL": "COPILOT",
    "COCAINE": "CATWALK",
    "BONDAGE": "CROWBAR",
]

/// Batch 2 only, IN PLACE.
public func applySolutionSwaps2(_ pool: [String]) -> [String] {
    pool.map { SOLUTION_SWAPS_2[$0] ?? $0 }
}

/// Batch 3 (founder, 2026-10-05: "Definitely get the British answers out, I don't
/// care the date you choose"): British-spelled and British-vocabulary answers
/// (COLOUR, THEATRE, CENTRE, YOGHURT, DUSTBIN, PETROL, JUMPER, BLOKE, CHEQUE,
/// ADVERT, PENCE…) plus
/// CRUMPET, which batch 2 itself dealt in place of FUCKING (British, and slang),
/// and DUVET, batch 1's replacement for ASPEN (US: comforter).
/// CRUMPET and DUVET are keyed on earlier replacements, so this table is applied
/// AFTER batches 1 and 2. Its own table because builds carrying batches 1 and 2 are already in
/// the stores (neither may grow). Cutover: the batch-2 date — the 10-09
/// coordinated release (first builds carrying this table) has 5+ weeks to reach
/// users first, and one shared date keeps a single "release before" deadline.
/// It is its own constant so it can move later without touching batch 2.
/// Replacements: same length, common American words, guessable, not current
/// answers, not a batch-1/2 replacement, not British-spelled.
/// The old words stay valid GUESSES.
public let SOLUTION_SWAP_3_CUTOVER_DATE = "2026-11-16"

public let SOLUTION_SWAPS_3: [String: String] = [
    "LITRE": "PECAN",
    "QUEUE": "LASSO",
    "FIBRE": "GECKO",
    "BLOKE": "LLAMA",
    "JUMPER": "PIGLET",
    "LEARNT": "TURNIP",
    "RUMOUR": "WALRUS",
    "CENTRE": "IGUANA",
    "PLOUGH": "TOUCAN",
    "PETROL": "BOBCAT",
    "ARMOUR": "QUIVER",
    "CHILLI": "KIMCHI",
    "VAPOUR": "MAGPIE",
    "HONOUR": "CATNIP",
    "HUMOUR": "EGGNOG",
    "AGEING": "LENTIL",
    "COLOUR": "SORBET",
    "LABOUR": "GELATO",
    "FAVOUR": "CHURRO",
    "FULFIL": "TAMALE",
    "TUMOUR": "SALAMI",
    "AMONGST": "PRETZEL",
    "FLAVOUR": "POTLUCK",
    "DUSTBIN": "TOOLBOX",
    "DEFENCE": "HOEDOWN",
    "PARLOUR": "SUNBEAM",
    "LICENCE": "CARPOOL",
    "REALISE": "TADPOLE",
    "CALIBRE": "BOBSLED",
    "CENTRED": "TUGBOAT",
    "MOULDED": "COWGIRL",
    "FUELLED": "HARPOON",
    "THEATRE": "MARACAS",
    "YOGHURT": "PAPRIKA",
    "OFFENCE": "TREETOP",
    "HARBOUR": "WARTHOG",
    "ANALYSE": "WETSUIT",
    "SULPHUR": "MUSKRAT",
    "SPECTRE": "SUNFISH",
    "PENCE": "GUMBO",
    "CHEQUE": "WIDGET",
    "ADVERT": "SUDOKU",
    "DRAUGHT": "GUMDROP",
    "QUEUING": "TRAPEZE",
    "DUVET": "TAFFY",
    "CRUMPET": "WALLABY",
]

/// Batch 3 only, IN PLACE (keys may be batch-2 replacements — apply after batch 2).
public func applySolutionSwaps3(_ pool: [String]) -> [String] {
    pool.map { SOLUTION_SWAPS_3[$0] ?? $0 }
}

/// Batch 4 (content audit, 2026-10-06 — REPORT-CONTENT-AUDIT.md / REPORT-CONTENT-FIXES.md):
/// profanity, slurs, sexual / drug / violent words, political and brand names
/// (the report lists them, masked), the British answers batch 3 missed
/// (ENQUIRY, RUBBISH, NETBALL…), proper nouns, and obscure or jargon words (TOGGLE,
/// KINASE, THEREOF…). Its own table because builds carrying batches 1–3 are already
/// out (none of them may grow). Keys are words of the ORIGINAL pools (none is an
/// earlier batch's key or replacement), so this batch is independent of batches
/// 2–3 and can start BEFORE them: its cutover is the day after the next
/// coordinated store builds (2026-10-12). From then until the batch-2/3 date the
/// pools deal batches 1 + 4. Not swapped: the answer-pool-hygiene
/// PENDING_FOUNDER_CALL words (BOOZE, SLAVE, DAMNED…) — still the founder's call.
/// Replacements: same length, common American words, guessable, not a current or
/// legacy answer, not an earlier batch's key or replacement, not blocked, not British.
/// The old words stay valid GUESSES.
public let SOLUTION_SWAP_4_CUTOVER_DATE = "2026-10-13"

/// Batch 4, keys in plain text.
private let SOLUTION_SWAPS_4_PLAIN: [String: String] = [
    // 5 letters
    "AMINO": "WISPY",
    "BLANC": "CHIVE",
    "BOWIE": "BIKER",
    "COSTA": "CRYPT",
    "DUCHY": "GEEKY",
    "EUROS": "CLEAT",
    "FRANC": "GAFFE",
    "HEATH": "MOSSY",
    "HIPPY": "ANTSY",
    "HYDRO": "FOAMY",
    "INTER": "BORED",
    "MAMMA": "KIDDO",
    "MINCE": "SAUTE",
    "REMIT": "BLURB",
    "SHIRE": "GUSTY",
    "TERRA": "MUGGY",
    "TERRY": "GLITZ",
    // 6 letters
    "AIRBUS": "BRAINY",
    "ALBEDO": "AMOEBA",
    "AMBLER": "SLOUCH",
    "ANNALS": "TROPIC",
    "AORTIC": "HICCUP",
    "APACHE": "POSSUM",
    "BANGER": "SIZZLE",
    "BARROW": "TOMBOY",
    "BASQUE": "QUICHE",
    "BATMAN": "MUDDLE",
    "BATTEN": "GIRDER",
    "BETHEL": "SWEATY",
    "BLOODY": "CHOPPY",
    "BODIED": "SLIVER",
    "BONITO": "MINNOW",
    "BOOKER": "BURLAP",
    "BOURNE": "SIESTA",
    "BOWMAN": "JACKAL",
    "BRUINS": "RECAST",
    "CAIRNS": "CRUTCH",
    "CAMBER": "STUCCO",
    "CANTON": "GROTTO",
    "CANTOR": "SHRIEK",
    "CAPITA": "ACUMEN",
    "CARDED": "CHALKY",
    "CAYMAN": "WEEVIL",
    "CHEEKY": "PLUCKY",
    "CICERO": "ORATOR",
    "CLARET": "PAPAYA",
    "COCKLE": "SEESAW",
    "COMELY": "SNAZZY",
    "CONTRA": "PACIFY",
    "COOKER": "OMELET",
    "CORPUS": "PATINA",
    "CUPOLA": "PAGODA",
    "CUTLER": "SKIMPY",
    "DECKER": "SLEUTH",
    "DHARMA": "WALLOP",
    "DINGLE": "SQUEAK",
    "DIPOLE": "DIPPER",
    "DISTAL": "GRAINY",
    "DOBSON": "BELUGA",
    "DODGER": "SUPPLE",
    "DRAPER": "RUFFLE",
    "DREAMT": "MUTTER",
    "ENSUES": "FALTER",
    "EUROPE": "COLLIE",
    "EXPIRY": "UPTICK",
    "EYELET": "TASSEL",
    "FISHER": "ANGLER",
    "FOOTED": "TRYOUT",
    "FULLER": "STOCKY",
    "GARRET": "MANTEL",
    "GENERA": "GAGGLE",
    "GRANGE": "QUINCE",
    "GUINEA": "GIBBON",
    "HAIRED": "FRIZZY",
    "HAPTIC": "KEYPAD",
    "HARPER": "CADDIE",
    "HOBBIT": "URCHIN",
    "HOOVER": "BASSET",
    "HOWLER": "WHAMMY",
    "JASPER": "PEWTER",
    "JOINER": "PUTTER",
    "KANSAS": "MIDAIR",
    "KENYAN": "SPOTTY",
    "KINASE": "OSPREY",
    "LAGUNA": "SWAMPY",
    "LAMBDA": "HYPHEN",
    "LANCET": "SPLINT",
    "LATINO": "SUITOR",
    "LEGGED": "PERUSE",
    "LEVANT": "GLASSY",
    "LIGAND": "MUSSEL",
    "LINDEN": "DAHLIA",
    "LISTER": "LEVITY",
    "MANILA": "SELFIE",
    "MEDIAL": "CORNEA",
    "MERCER": "WOOLEN",
    "METHYL": "AIRBAG",
    "MORROW": "WINTRY",
    "MOZART": "SONNET",
    "MULLER": "SPACER",
    "NISSAN": "BIONIC",
    "NOUGHT": "PRESTO",
    "OCULUS": "EERILY",
    "OILERS": "TWISTY",
    "PACERS": "SPRAIN",
    "PASSER": "REFUEL",
    "PIAZZA": "ENTREE",
    "PLANAR": "NEGATE",
    "PORTED": "REHEAT",
    "PRIORY": "DINGHY",
    "PUNTER": "TIRADE",
    "QUAKER": "OBLONG",
    "RECTOR": "PONCHO",
    "REEVES": "STINKY",
    "RIDLEY": "SNOOZE",
    "SALAAM": "CUTOUT",
    "SCHEMA": "ITALIC",
    "SCOTCH": "TUSSLE",
    "SEXTON": "MUSKET",
    "SIXERS": "DOLLOP",
    "SLATER": "TAMPER",
    "SLOUGH": "SQUIRM",
    "SLUICE": "SPRAWL",
    "SMITHY": "WELDER",
    "SNOOPY": "SNARKY",
    "SOVIET": "TUMULT",
    "SPICER": "POINTY",
    "SPOILT": "SMUDGE",
    "SQUIRE": "CANTER",
    "STILES": "SCYTHE",
    "STOKER": "SKEWER",
    "SURREY": "SPIFFY",
    "TENSOR": "TOFFEE",
    "THENCE": "LEEWAY",
    "THRICE": "PRESET",
    "TIPPLE": "FROTHY",
    "TOGGLE": "BEANIE",
    "ULSTER": "HOARSE",
    "UNICEF": "PAJAMA",
    "UNWELL": "QUEASY",
    "WAGNER": "BELLOW",
    "WHENCE": "UNSUNG",
    "WHISKY": "KIMONO",
    "WICKET": "HOODIE",
    "WRIGHT": "SCULPT",
    "YAKUZA": "PINKIE",
    "ZEPHYR": "SQUALL",
    "ZIMMER": "STUBBY",
    // 7 letters
    "AQUEOUS": "RUBBERY",
    "BATSMAN": "SLUGGER",
    "BESPOKE": "THRIFTY",
    "BLOODED": "MUSCLED",
    "BOLIVIA": "SAVANNA",
    "BOTANIC": "PETUNIA",
    "BRONCOS": "STIRRUP",
    "BULLOCK": "CARIBOU",
    "CENTRIC": "NUANCED",
    "CHAPMAN": "DOORMAN",
    "COGNATE": "NUMERAL",
    "COLLIER": "TRUCKER",
    "COOKERY": "COOKOUT",
    "COROLLA": "SIDECAR",
    "COULTER": "TOPSOIL",
    "DICKENS": "STENCIL",
    "DRACULA": "GREMLIN",
    "ENQUIRE": "NOURISH",
    "ENQUIRY": "AMENITY",
    "FANCIED": "TEARFUL",
    "FLEMISH": "CHOWDER",
    "GEARBOX": "SUNROOF",
    "GOOGLED": "BROWSED",
    "GRANGER": "JUGGLER",
    "HACKNEY": "TAXICAB",
    "HANOVER": "VERANDA",
    "HECTARE": "HEXAGON",
    "HEPATIC": "EARDRUM",
    "INSHORE": "RIPTIDE",
    "INWARDS": "FARAWAY",
    "IRONMAN": "JETPACK",
    "ISLAMIC": "ORIGAMI",
    "LANGLEY": "KEYHOLE",
    "LOOSING": "MOPPING",
    "MAGNETO": "TOOLKIT",
    "MAHATMA": "MATINEE",
    "MARQUIS": "CHARADE",
    "MIDLAND": "MIDTOWN",
    "NETBALL": "RAFTING",
    "ORIOLES": "BUZZARD",
    "PARSONS": "BARISTA",
    "PEPTIDE": "MICROBE",
    "PLENARY": "WEBINAR",
    "POLITIC": "TACTFUL",
    "POLLARD": "SAPLING",
    "POLLOCK": "HALIBUT",
    "PORTAGE": "CABOOSE",
    "PREFECT": "CATERER",
    "RAILWAY": "AIRFARE",
    "RUBBISH": "TAKEOUT",
    "SIEMENS": "CHECKUP",
    "SIMPLEX": "OCTAGON",
    "SKINNER": "DRIFTER",
    "SNOOKER": "CROQUET",
    "SPECTRA": "SUNSPOT",
    "SPIEGEL": "SPATULA",
    "STRIDER": "WIPEOUT",
    "SUBUNIT": "ROADMAP",
    "TALIBAN": "TRINKET",
    "TEMPLAR": "SCEPTER",
    "THEREIN": "OFFLINE",
    "THEREOF": "ANYTIME",
    "TOOTHED": "MOONLIT",
    "TRIPOLI": "LAYOVER",
    "TWITTER": "HASHTAG",
    "UNITARY": "PREQUEL",
    "UTERINE": "MIXTAPE",
    "VENTRAL": "NOSTRIL",
    "WAISTED": "PLEATED",
    "WASTAGE": "SAWDUST",
    "WHITING": "SARDINE",
]
/// Batch 4, keys that are offensive (profanity, slurs, sexual, drug or violent words) — stored base64-encoded
/// (content-safety policy: no offensive word in plain text in the repo's own files) and decoded at load.
private let SOLUTION_SWAPS_4_ENCODED: [String: String] = [
    "Qk9PVFk=": "LAYUP",
    "Qk9XRUw=": "ZESTY",
    "QlVUQ0g=": "CORGI",
    "RkFUVFk=": "DECAL",
    "RkVUVVM=": "TAUPE",
    "U1BBTks=": "CONDO",
    "UFJJQ0s=": "PHASE",
    "UkFORFk=": "ALOHA",
    "VFJVTVA=": "EMOJI",
    "Q0VSVklY": "BONSAI",
    "Q1JPVENI": "SILKEN",
    "QUJVU0VS": "SQUEAL",
    "QVJPVVNF": "WHOOSH",
    "Qk9PR0VS": "TEACUP",
    "QkFOR0VE": "WALLOW",
    "QkVOREVS": "SHRILL",
    "QlJFQVNU": "GOATEE",
    "R0hFVFRP": "EATERY",
    "R1VOTkVE": "SWATCH",
    "Rk9ORExF": "NUZZLE",
    "SE9PS1VQ": "IMPROV",
    "SElDS0VZ": "MAYDAY",
    "SElUTUFO": "MOUSSE",
    "SlVOS0lF": "PREPPY",
    "T1JBTExZ": "RUDELY",
    "TE9PTkVZ": "REWIND",
    "TUFUSU5H": "SWERVE",
    "TVVDT1VT": "SPONGY",
    "TlVESVRZ": "WHIMSY",
    "U0VEVUNF": "SCURRY",
    "U0xFQVpZ": "CLUNKY",
    "U1RPTkVE": "SULLEN",
    "U1RPTkVS": "MILDEW",
    "UFNZQ0hP": "GROGGY",
    "UkFDSVNN": "CANDOR",
    "UkFDSVNU": "HAGGLE",
    "UkFQSU5H": "BUNGEE",
    "UklQUEVS": "PAYOUT",
    "V0lFTkVS": "PANINI",
    "VVRFUlVT": "CANOLA",
    "VklBR1JB": "WASABI",
    "VklSR0lO": "SERENE",
    "QVJPVVNBTA==": "ELATION",
    "QVJPVVNFRA==": "DAZZLED",
    "QVRIRUlTTQ==": "ANAGRAM",
    "QVRIRUlTVA==": "RETIREE",
    "R0FOR1NUQQ==": "SHOWMAN",
    "R1JPUElORw==": "PEEKING",
    "RkFTQ0lTTQ==": "CURSIVE",
    "RkFTQ0lTVA==": "ODDBALL",
    "RkxBU0hFUg==": "FLIPPER",
    "SEVBVEhFTg==": "MEERKAT",
    "SFVTVExFUg==": "FIDDLER",
    "TEVGVElTVA==": "LOGBOOK",
    "TFVOQVRJQw==": "DIEHARD",
    "U0FUQU5JQw==": "OFFBEAT",
    "U0NSRVdFRA==": "CLAMPED",
    "U0VEVUNFRA==": "ENTICED",
    "U0VOU1VBTA==": "PENSIVE",
    "UEFOVElFUw==": "NECKTIE",
    "UEVSVkVSVA==": "COPYCAT",
    "UExBWUJPWQ==": "HOTSHOT",
    "UkVETkVDSw==": "BANDANA",
    "VE9QTEVTUw==": "SATCHEL",
]

public let SOLUTION_SWAPS_4: [String: String] = SOLUTION_SWAPS_4_PLAIN.merging(
    SOLUTION_SWAPS_4_ENCODED.map { (String(data: Data(base64Encoded: $0.key)!, encoding: .utf8)!, $0.value) },
    uniquingKeysWith: { a, _ in a })

/// Batch 4 only, IN PLACE (keys are original pool words — order-independent of batches 2–3).
public func applySolutionSwaps4(_ pool: [String]) -> [String] {
    pool.map { SOLUTION_SWAPS_4[$0] ?? $0 }
}

/// Which swap batches are live on `date`, as a BITMASK: bit k-1 set = batch k has
/// reached its own cutover (batch 1 = 1, batch 2 = 2, batch 3 = 4, batch 4 = 8).
/// Batch 4 starts before batches 2–3, so the live set is not a prefix any more:
/// 0 before 2026-10-05, 1 (batch 1), 9 (batches 1 + 4) from 2026-10-13, 15 from
/// 2026-11-16. Callers pass the value straight to applySolutionSwapBatches and may
/// use it as a cache key.
public func solutionSwapBatchesFor(_ date: String) -> Int {
    var mask = 0
    if date >= SOLUTION_SWAP_CUTOVER_DATE { mask |= 1 }
    if date >= SOLUTION_SWAP_2_CUTOVER_DATE { mask |= 2 }
    if date >= SOLUTION_SWAP_3_CUTOVER_DATE { mask |= 4 }
    if date >= SOLUTION_SWAP_4_CUTOVER_DATE { mask |= 8 }
    return mask
}

/// Every swap batch whose bit is set in `mask` (see solutionSwapBatchesFor), always in table order 1 → 4.
public func applySolutionSwapBatches(_ pool: [String], _ mask: Int) -> [String] {
    var out = pool
    if mask & 1 != 0 { out = applySolutionSwaps(out) }
    if mask & 2 != 0 { out = applySolutionSwaps2(out) }
    if mask & 4 != 0 { out = applySolutionSwaps3(out) }
    if mask & 8 != 0 { out = applySolutionSwaps4(out) }
    return out
}

/// Mask with every batch set.
public let ALL_SOLUTION_SWAP_BATCHES = 15

/// Every batch in order — the pool as every runtime sees it once the last cutover has passed.
public func applyAllSolutionSwaps(_ pool: [String]) -> [String] {
    applySolutionSwapBatches(pool, ALL_SOLUTION_SWAP_BATCHES)
}
