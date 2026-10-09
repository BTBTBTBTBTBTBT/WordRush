import Foundation

// FRIDAY-QUEUE item 35: the player's own game order — a 1:1 port of packages/core/src/game-order.ts.
// Display-only (sweep rules / db keys never change). Classic is pinned first in Dailies; unknown saved
// ids are dropped; games missing from a saved order (new games) are appended in default order.

public struct GameOrderPrefs: Codable, Equatable {
    public var dailies: [String]
    public var puzzles: [String]
    public init(dailies: [String] = [], puzzles: [String] = []) { self.dailies = dailies; self.puzzles = puzzles }
}

public enum GameOrderSection: String { case dailies, puzzles }

public enum GameOrder {
    public static let pinnedFirstDaily = "practice"
    /// Founder's default Dailies order (10-08): Classic, QuadWord, OctoWord, Succession, Six, Seven, Deliverance, Gauntlet.
    public static let defaultDailies = ["practice", "quordle", "octordle", "sequence", "six", "seven", "rescue", "gauntlet"]
    /// Default Puzzles order, easiest to hardest for now (Muddle moved down).
    public static let defaultPuzzles = ["propernoundle", "sudoku", "regions", "wordsearch", "ladder", "hub", "groups", "crossword", "cryptogram", "scramble"]

    public static func pinned(for section: GameOrderSection) -> String? { section == .dailies ? pinnedFirstDaily : nil }

    public static func apply(defaultIds: [String], saved: [String]?, pinnedFirst: String?) -> [String] {
        let known = Set(defaultIds)
        var out: [String] = []
        var seen = Set<String>()
        for id in saved ?? [] where known.contains(id) && !seen.contains(id) { out.append(id); seen.insert(id) }
        for id in defaultIds where !seen.contains(id) { out.append(id); seen.insert(id) }
        if let pin = pinnedFirst, known.contains(pin) { return [pin] + out.filter { $0 != pin } }
        return out
    }

    /// Move one id from index `from` to `to`; the pinned slot-0 game can neither move nor be displaced.
    public static func move(_ order: [String], from: Int, to: Int, pinnedFirst: String?) -> [String] {
        var next = order
        guard from >= 0, from < next.count, to >= 0, to < next.count, from != to else { return next }
        let pinned = pinnedFirst.flatMap { next.firstIndex(of: $0) } ?? -1
        if pinned == from { return next }
        let id = next.remove(at: from)
        var dest = to
        if pinned == 0 && dest == 0 { dest = 1 }
        next.insert(id, at: min(dest, next.count))
        return next
    }

    public static func isDefault(defaultIds: [String], saved: [String]?, pinnedFirst: String?) -> Bool {
        apply(defaultIds: defaultIds, saved: saved, pinnedFirst: pinnedFirst) == apply(defaultIds: defaultIds, saved: nil, pinnedFirst: pinnedFirst)
    }

    /// Sanitize an untrusted saved value into prefs, or nil when empty (lists capped at 40).
    public static func parse(dailies: [String]?, puzzles: [String]?) -> GameOrderPrefs? {
        let p = GameOrderPrefs(dailies: Array((dailies ?? []).prefix(40)), puzzles: Array((puzzles ?? []).prefix(40)))
        return p.dailies.isEmpty && p.puzzles.isEmpty ? nil : p
    }

    /// NEXT on a finished screen: the next game AFTER `currentId` in the player's order that is not
    /// played yet, wrapping once; nil when everything is played.
    public static func nextUnplayed(order: [String], currentId: String, played: Set<String>) -> String? {
        guard !order.isEmpty else { return nil }
        let start = order.firstIndex(of: currentId) ?? -1
        for step in 1...order.count {
            let id = order[((start + step) % order.count + order.count) % order.count]
            if id != currentId && !played.contains(id) { return id }
        }
        return nil
    }
}
