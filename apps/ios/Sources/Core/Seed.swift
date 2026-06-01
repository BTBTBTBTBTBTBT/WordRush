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

public func generateSolutionsFromSeed(_ seed: String, count: Int) -> [String] {
    let dict = GameDictionary.shared
    let solutionCount = dict.getSolutionCount()
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
        solutions.append(dict.getSolutionWord(at: index))
    }

    return solutions
}

public func generateSolutionsFromSeedForLength(_ seed: String, count: Int, wordLength: Int) -> [String] {
    let dict = GameDictionary.shared
    let solutionCount = dict.getSolutionCountForLength(wordLength)
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
        solutions.append(dict.getSolutionWordForLength(wordLength, at: index))
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
