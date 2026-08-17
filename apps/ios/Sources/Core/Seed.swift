import Foundation

// JavaScript's bitwise operators work on 32-bit signed integers.
// Swift's Int is 64-bit, so we must explicitly truncate to Int32
// to match JS behavior exactly. This is the most critical function
// for cross-platform parity — if hashes diverge, every puzzle differs.
func simpleHash(_ str: String) -> Int {
    var hash: Int32 = 0
    for scalar in str.unicodeScalars {
        let char = Int32(scalar.value)
        // JS: hash = ((hash << 5) - hash) + char; hash = hash & hash;
        // The (hash << 5) - hash is hash * 31, but we must use bitwise
        // shift to match JS overflow behavior exactly.
        hash = (hash &<< 5) &- hash &+ char
        // JS "hash & hash" is a no-op identity that forces i32 truncation.
        // In Swift with Int32, this is already the case — no extra op needed.
    }
    return Int(abs(hash))
}

// ── Deck dealing (§215) — port of packages/core seed.ts ─────────────────────
// Post-cutover daily seeds deal from a deterministic shuffled deck (one
// Fisher–Yates permutation per epoch, fixed non-overlapping per-mode slices
// per day) so no answer repeats across ANY 5-letter daily for a whole epoch
// (~40 days). Pre-cutover dailies, unlimited/match/replacement seeds keep the
// legacy hash path. Byte-parity with TS/Kotlin is pinned by seed-fixtures.json.
public let DECK_CUTOVER_DATE = "2026-08-24"

private struct DeckDeal { let offset: Int; let count: Int }

// FROZEN deal table — never reorder/resize existing modes (see TS core).
private let DECK_DEALS_5: [String: DeckDeal] = [
    "DUEL": DeckDeal(offset: 0, count: 1),
    "QUORDLE": DeckDeal(offset: 1, count: 4),
    "OCTORDLE": DeckDeal(offset: 5, count: 8),
    "SEQUENCE": DeckDeal(offset: 13, count: 4),
    "RESCUE": DeckDeal(offset: 17, count: 4),
    "GAUNTLET": DeckDeal(offset: 21, count: 21),
    "DUEL_VS": DeckDeal(offset: 42, count: 1),
]
private let DECK_TOTAL_5 = 43
private let DECK_DEALS_6: [String: DeckDeal] = ["DUEL_6": DeckDeal(offset: 0, count: 1)]
private let DECK_DEALS_7: [String: DeckDeal] = ["DUEL_7": DeckDeal(offset: 0, count: 1)]

/// mulberry32 PRNG — UInt32 wrapping ops reproduce the JS int32/imul bit
/// patterns exactly. As parity-critical as simpleHash.
private struct Mulberry32 {
    var state: UInt32
    mutating func next() -> UInt32 {
        state = state &+ 0x6D2B79F5
        var t = (state ^ (state >> 15)) &* (state | 1)
        t = (t &+ ((t ^ (t >> 7)) &* (t | 61))) ^ t
        return t ^ (t >> 14)
    }
}

/// Whole days from DECK_CUTOVER_DATE to `date` (UTC), nil if unparseable.
private func deckDayIndex(_ date: String) -> Int? {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    f.timeZone = TimeZone(identifier: "UTC")
    f.locale = Locale(identifier: "en_US_POSIX")
    guard let to = f.date(from: date), let from = f.date(from: DECK_CUTOVER_DATE) else { return nil }
    return Int(((to.timeIntervalSince1970 - from.timeIntervalSince1970) / 86400).rounded())
}

private func deckSolutions(_ seed: String, count: Int, pool: [String],
                           deals: [String: DeckDeal], dailyTotal: Int, lengthKey: Int) -> [String]? {
    // Exactly daily-YYYY-MM-DD-MODE: suffixed seeds (gauntlet blackout
    // replacements, etc.) must never collide with the day's real deals.
    let parts = seed.split(separator: "-", omittingEmptySubsequences: false)
    guard parts.count == 5, parts[0] == "daily" else { return nil }
    let date = "\(parts[1])-\(parts[2])-\(parts[3])"
    guard date >= DECK_CUTOVER_DATE else { return nil }
    guard let deal = deals[String(parts[4])], deal.count == count else { return nil }
    let daysPerEpoch = pool.count / dailyTotal
    guard daysPerEpoch >= 1 else { return nil }
    guard let dayIndex = deckDayIndex(date), dayIndex >= 0 else { return nil }
    let epoch = dayIndex / daysPerEpoch
    var perm = Array(0..<pool.count)
    var rng = Mulberry32(state: UInt32(truncatingIfNeeded: simpleHash("deck-\(lengthKey)-\(epoch)")))
    var i = pool.count - 1
    while i > 0 {
        let j = Int(rng.next() % UInt32(i + 1))
        perm.swapAt(i, j)
        i -= 1
    }
    let base = (dayIndex % daysPerEpoch) * dailyTotal + deal.offset
    return (0..<count).map { pool[perm[base + $0]] }
}
// ────────────────────────────────────────────────────────────────────────────

public func generateSolutionsFromSeed(_ seed: String, count: Int) -> [String] {
    let dict = GameDictionary.shared
    // Answer pool chosen by the DATE embedded in the seed (never wall clock),
    // so every client resolves the same seed identically: pre-cutover daily
    // dates → legacy list, post-cutover dailies + all non-daily seeds → curated.
    let pool = dict.solutionPool(forDateKey: getDailySeedDate(seed))
    // Post-DECK_CUTOVER_DATE dailies deal from the shuffled deck (§215).
    if let deck = deckSolutions(seed, count: count, pool: pool,
                                deals: DECK_DEALS_5, dailyTotal: DECK_TOTAL_5, lengthKey: 5) {
        return deck
    }
    let solutionCount = pool.count
    var solutions: [String] = []
    var used: Set<Int> = []

    for i in 0..<count {
        let seedWithIndex = "\(seed)-\(i)"
        var hash = simpleHash(seedWithIndex)
        var attempts = 0

        while used.contains(hash % solutionCount) && attempts < solutionCount {
            hash = simpleHash("\(seedWithIndex)-\(attempts)")
            attempts += 1
        }

        let index = hash % solutionCount
        used.insert(index)
        solutions.append(pool[index])
    }

    return solutions
}

public func generateSolutionsFromSeedForLength(_ seed: String, count: Int, wordLength: Int) -> [String] {
    let dict = GameDictionary.shared
    // Same date-gate as the 5-letter path — pre-cutover Six/Seven dailies keep
    // their legacy words; new dailies + non-daily seeds use the curated list.
    let pool = dict.solutionPool(forLength: wordLength, dateKey: getDailySeedDate(seed))
    // Six/Seven post-cutover dailies deal from their own decks (§215).
    if let deals = wordLength == 6 ? DECK_DEALS_6 : wordLength == 7 ? DECK_DEALS_7 : nil,
       let deck = deckSolutions(seed, count: count, pool: pool,
                                deals: deals, dailyTotal: 1, lengthKey: wordLength) {
        return deck
    }
    let solutionCount = pool.count
    var solutions: [String] = []
    var used: Set<Int> = []

    for i in 0..<count {
        let seedWithIndex = "\(seed)-\(i)"
        var hash = simpleHash(seedWithIndex)
        var attempts = 0

        while used.contains(hash % solutionCount) && attempts < solutionCount {
            hash = simpleHash("\(seedWithIndex)-\(attempts)")
            attempts += 1
        }

        let index = hash % solutionCount
        used.insert(index)
        solutions.append(pool[index])
    }

    return solutions
}

public func generateMatchSeed() -> String {
    return "\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(15).lowercased())"
}

public func generateDailySeed(date: String, gameMode: String) -> String {
    return "daily-\(date)-\(gameMode)"
}

public func isDailySeed(_ seed: String) -> Bool {
    return seed.hasPrefix("daily-")
}

public func getDailySeedDate(_ seed: String) -> String? {
    guard isDailySeed(seed) else { return nil }
    let parts = seed.split(separator: "-")
    guard parts.count >= 4 else { return nil }
    return "\(parts[1])-\(parts[2])-\(parts[3])"
}
