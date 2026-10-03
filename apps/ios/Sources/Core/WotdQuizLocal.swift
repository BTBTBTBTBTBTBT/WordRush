import Foundation

/// FINISH_SPEC BI17: the Word of the Day quiz keeps a device copy of every answer so
/// a database outage can't reset today's answer or the word streak. Pure merge rules
/// (shared with Android WotdQuizLocal and web lib/wotd-quiz-local.ts).
public enum WotdQuizLocal {
    public struct Day: Codable, Equatable {
        public let picked: Int
        public let correct: Bool
        public var word: String?
        public init(picked: Int, correct: Bool, word: String? = nil) {
            self.picked = picked
            self.correct = correct
            self.word = word
        }
    }

    /// Server rows win per day; device-only days fill the gaps. `server == nil` means
    /// the read failed (outage) → the device copy alone. `pending` = device-only days
    /// to re-send once the server answers again (sorted, oldest first).
    public static func merge(server: [String: Day]?, local: [String: Day]) -> (days: [String: Day], pending: [String]) {
        guard let server else { return (local, []) }
        var days = server
        var pending: [String] = []
        for (day, v) in local where days[day] == nil {
            days[day] = v
            pending.append(day)
        }
        return (days, pending.sorted())
    }

    /// Drops days before `since` (yyyy-MM-dd strings compare in date order).
    public static func prune(_ local: [String: Day], since: String) -> [String: Day] {
        local.filter { $0.key >= since }
    }
}
