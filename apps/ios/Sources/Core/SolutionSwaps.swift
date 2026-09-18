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

/// The pool with every swapped-out answer replaced IN PLACE (same length, same index).
public func applySolutionSwaps(_ pool: [String]) -> [String] {
    pool.map { SOLUTION_SWAPS[$0] ?? $0 }
}
