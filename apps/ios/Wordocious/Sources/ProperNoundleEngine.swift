import Foundation
import WordociousCore

/// ProperNoundle puzzle + logic — ports components/propernoundle/
/// {types,game-logic,puzzle-service}.ts. A guess-the-name game: the answer is
/// a normalized name (e.g. "taylorswift"), tiles colour like Wordle, the
/// board lays out word-groups from `display` ("Taylor Swift" → 6+5).
/// NTile + the pure logic live in WordociousCore (ProperNoundleCore.swift) so
/// `swift test` can pin them; the statics below forward for source compat.
struct NPuzzle: Codable, Equatable {
    let id: String
    let answer: String
    let display: String
    let category: String
    let themeCategory: String?
    let hint: String?
    let wikiTitle: String?
}


enum ProperNoundle {
    static let maxGuesses = 6
    private static let epoch = "2024-01-01"
    private static let maxAnswerLength = 15

    // Pure logic forwards to WordociousCore.ProperNoundleCore (testable via
    // swift test — ProperNoundleReconstructTests pins rebuildRow's hint-row
    // positions cross-platform).
    static func normalize(_ s: String) -> String { ProperNoundleCore.normalize(s) }
    static func evaluate(guess: String, answer: String) -> [NTile] { ProperNoundleCore.evaluate(guess: guess, answer: answer) }
    static func isWin(_ tiles: [NTile]) -> Bool { ProperNoundleCore.isWin(tiles) }
    static func rebuildRow(recorded: String, answer: String) -> (letters: [String], tiles: [NTile]) {
        ProperNoundleCore.rebuildRow(recorded: recorded, answer: answer)
    }
    static func wordGroups(_ display: String) -> [Int] { ProperNoundleCore.wordGroups(display) }

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

    /// Daily puzzle number shown in the header ("#N") — web parity:
    /// getDailyPuzzleNumber = days since the 2024-01-01 epoch + 1.
    static func dailyPuzzleNumber(date: String = LeaderboardService.todayLocal()) -> Int {
        daysSinceEpoch(date) + 1
    }

    /// Deterministic puzzle from a VS match seed so both players in a match get
    /// the same proper noun, independent of date.
    ///
    /// CRITICAL: this must use the SAME hash as the server's
    /// `selectProperNoundlePuzzle` (and the shared word-seed `simpleHash`):
    /// JS `hash = ((hash << 5) - hash + charCode) | 0`, then `abs(hash) % count`.
    /// It previously used FNV-1a, which diverged from the server — so the iOS
    /// player and the web/server opponent were handed DIFFERENT puzzles and
    /// raced different words. The puzzle JSON is byte-identical across platforms,
    /// so matching the hash yields the same index → the same puzzle.
    static func puzzle(forSeed seed: String) -> NPuzzle? {
        guard !all.isEmpty else { return nil }
        var hash: Int32 = 0
        for scalar in seed.unicodeScalars { hash = (hash &<< 5) &- hash &+ Int32(scalar.value) }
        return all[Int(abs(hash)) % all.count]
    }

    private static func daysSinceEpoch(_ dateString: String) -> Int {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "UTC")
        guard let target = f.date(from: dateString), let e = f.date(from: epoch) else { return 0 }
        return Int((target.timeIntervalSince1970 - e.timeIntervalSince1970) / 86400)
    }
}
