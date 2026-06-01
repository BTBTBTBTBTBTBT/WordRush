import Foundation

/// ProperNoundle puzzle + logic — ports components/propernoundle/
/// {types,game-logic,puzzle-service}.ts. A guess-the-name game: the answer is
/// a normalized name (e.g. "taylorswift"), tiles colour like Wordle, the
/// board lays out word-groups from `display` ("Taylor Swift" → 6+5).
struct NPuzzle: Codable, Equatable {
    let id: String
    let answer: String
    let display: String
    let category: String
    let themeCategory: String?
    let hint: String?
    let wikiTitle: String?
}

enum NTile: String { case correct, present, absent, empty, hintUsed }

enum ProperNoundle {
    static let maxGuesses = 6
    private static let epoch = "2024-01-01"
    private static let maxAnswerLength = 15

    /// lowercase, strip diacritics + spaces, keep word chars (mirrors normalizeString).
    static func normalize(_ s: String) -> String {
        let folded = s.folding(options: .diacriticInsensitive, locale: .current).lowercased()
        return String(folded.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) || $0 == "'" || $0 == "-" })
    }

    /// Tile states for a guess vs answer (Wordle two-pass), length-gated.
    static func evaluate(guess: String, answer: String) -> [NTile] {
        let g = Array(normalize(guess)), a = Array(normalize(answer))
        guard g.count == a.count else { return Array(repeating: .absent, count: g.count) }
        var result = [NTile](repeating: .absent, count: g.count)
        var used = [Bool](repeating: false, count: a.count)
        for i in g.indices where g[i] == a[i] { result[i] = .correct; used[i] = true }
        for i in g.indices where result[i] != .correct {
            for j in a.indices where !used[j] && a[j] == g[i] { result[i] = .present; used[j] = true; break }
        }
        return result
    }

    static func isWin(_ tiles: [NTile]) -> Bool { !tiles.isEmpty && tiles.allSatisfy { $0 == .correct } }

    /// Word lengths from the display string (for the tile layout gaps).
    static func wordGroups(_ display: String) -> [Int] {
        let groups = display.split(separator: " ").map { normalize(String($0)).count }.filter { $0 > 0 }
        return groups.isEmpty ? [normalize(display).count] : groups
    }

    // MARK: Daily selection (alphabetical category round-robin)

    private static let all: [NPuzzle] = {
        guard let url = Bundle.main.url(forResource: "propernoundle-puzzles", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let puzzles = try? JSONDecoder().decode([NPuzzle].self, from: data) else { return [] }
        return puzzles.filter { $0.answer.count <= maxAnswerLength }
    }()

    private static let byCategory: [String: [NPuzzle]] = {
        Dictionary(grouping: all) { $0.themeCategory ?? "general" }
    }()
    private static let categoryCycle: [String] = byCategory.keys.sorted()

    static func dailyPuzzle(date: String = LeaderboardService.todayLocal()) -> NPuzzle? {
        guard !categoryCycle.isEmpty else { return nil }
        let day = daysSinceEpoch(date)
        let cat = categoryCycle[((day % categoryCycle.count) + categoryCycle.count) % categoryCycle.count]
        guard let list = byCategory[cat], !list.isEmpty else { return nil }
        let idx = (day / categoryCycle.count) % list.count
        return list[max(0, idx)]
    }

    /// Deterministic puzzle from a VS match seed (stable FNV-1a hash → index)
    /// so both players in a match get the same puzzle, independent of date.
    static func puzzle(forSeed seed: String) -> NPuzzle? {
        guard !all.isEmpty else { return nil }
        var h: UInt64 = 1469598103934665603
        for b in seed.utf8 { h = (h ^ UInt64(b)) &* 1099511628211 }
        return all[Int(h % UInt64(all.count))]
    }

    private static func daysSinceEpoch(_ dateString: String) -> Int {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "UTC")
        guard let target = f.date(from: dateString), let e = f.date(from: epoch) else { return 0 }
        return Int((target.timeIntervalSince1970 - e.timeIntervalSince1970) / 86400)
    }
}
