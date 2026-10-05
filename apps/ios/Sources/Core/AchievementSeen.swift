import Foundation

/// FINISH_SPEC BF1: players must SEE every unlock once. Achievements can be awarded
/// server-side (after a result saves, by crons, on another device), so on launch /
/// foreground the app diffs the player's earned keys against a locally stored "seen"
/// set and celebrates the unseen ones — once each. The first launch after this
/// update seeds the set with everything already earned (no flood of old popups).
public enum AchievementSeen {
    public struct Earned: Equatable {
        public let key: String
        /// `unlocked_at` (ISO-8601; sorts lexically), nil when unknown.
        public let at: String?
        public init(key: String, at: String?) { self.key = key; self.at = at }
    }

    /// The keys to celebrate (oldest unlock first, then by key) and the new seen set.
    /// `seen == nil` = first launch after the update: celebrate nothing, seed all.
    public static func diff(earned: [Earned], seen: Set<String>?) -> (celebrate: [String], seen: Set<String>) {
        let all = Set(earned.map(\.key))
        guard let seen else { return ([], all) }
        let fresh = earned.filter { !seen.contains($0.key) }
        var unique: [Earned] = []
        var keys = Set<String>()
        for e in fresh where keys.insert(e.key).inserted { unique.append(e) }
        let ordered = unique.sorted { a, b in
            let x = a.at ?? "", y = b.at ?? ""
            return x == y ? a.key < b.key : x < y
        }
        return (ordered.map(\.key), seen.union(all))
    }

    /// Keys from an award (a finished game's unlocks) not yet seen, in award order.
    public static func unseen(_ keys: [String], seen: Set<String>) -> [String] {
        var out: [String] = []
        var s = seen
        for k in keys where s.insert(k).inserted { out.append(k) }
        return out
    }
}

/// Johnny (iOS 242, 10-05): "Awesome!" re-showed the same Swift Codebreaker popup. The
/// unlock popup queue works on moment ids ("a:<key>", "l:<level>"): an id is admitted at
/// most once per session (never twice in one batch, never while it already waits, never
/// after it was shown), and closing a moment drops EVERY queued copy of its id, so
/// "Awesome!" always closes that achievement. Pure, so it is unit-tested in core.
public enum UnlockQueue {
    /// The ids of `incoming` to append, in order: not already queued / held, not shown
    /// (or dismissed) this session, no repeats inside the batch.
    public static func admit(_ incoming: [String], queued: [String], shown: Set<String>) -> [String] {
        var taken = shown.union(queued)
        return incoming.filter { taken.insert($0).inserted }
    }

    /// The queue after the moment `id` closes: every copy of it removed.
    public static func dismiss(_ queue: [String], id: String) -> [String] {
        queue.filter { $0 != id }
    }
}
