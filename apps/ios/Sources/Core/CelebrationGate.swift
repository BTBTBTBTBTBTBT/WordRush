import Foundation

/// FINISH_SPEC BI16: when a celebration may go up.
///
/// In the 2026-10-02 outage the founder's last daily landed late, so the Daily
/// Sweep popped at an awkward moment. Celebrations that come from a LATE write
/// (a pending-queue replay, the launch/foreground achievement sync, or a live
/// write that came back slowly) now wait for a calm moment: Home's root, nothing
/// presented over it, no other popup. A sweep that waited past midnight is
/// dropped; it belongs to a day that's over.
///
/// Same rules: Android `CelebrationGate`, web `lib/celebration-gate.ts`.
public enum CelebrationGate {
    /// Where a celebration's result came from.
    public enum Source: Equatable, Sendable {
        /// The game the player just finished, its write answering promptly.
        case live
        /// A pending-records replay (drain at launch / foreground / network back).
        case replay
        /// The launch / foreground achievement "seen set" sync.
        case sync
    }

    /// A live finish whose result comes back later than this is treated as late.
    public static let lateAfterSeconds: Double = 6

    /// Calm: on Home's root, nothing (game, cover, sheet, alert) presented over
    /// it, and no other popup up.
    public static func isCalm(onHomeRoot: Bool, anythingPresented: Bool, popupUp: Bool) -> Bool {
        onHomeRoot && !anythingPresented && !popupUp
    }

    /// Whether a celebration must wait for calm instead of showing in place.
    /// `startedAt` is when the live record call began (nil = unknown → live).
    public static func isLate(source: Source, startedAt: Date?, now: Date = Date()) -> Bool {
        switch source {
        case .replay, .sync: return true
        case .live:
            guard let startedAt else { return false }
            return now.timeIntervalSince(startedAt) > lateAfterSeconds
        }
    }

    /// A day-bound celebration (sweep, flawless) queued for `day` and only now
    /// reaching a calm moment on `today` is dropped when the day has rolled.
    public static func shouldDrop(celebrationDay: String, today: String) -> Bool {
        celebrationDay != today
    }

    /// Next celebration to present from `queue` (oldest first), dropping stale
    /// day-bound ones. Returns nil when not calm or nothing is left.
    public static func next<T>(
        _ queue: inout [T], day: (T) -> String?, today: String, calm: Bool
    ) -> T? {
        queue.removeAll { item in day(item).map { shouldDrop(celebrationDay: $0, today: today) } ?? false }
        guard calm, !queue.isEmpty else { return nil }
        return queue.removeFirst()
    }

    // MARK: 2.8 item 52 — the celebration fires at the right moment
    //
    // Bug (founder 10-09): the Flawless banner didn't show after the 8th daily; it came later, after a Puzzle.
    // Celebrations only presented at a CALM moment on Home's root, so leaving the last daily's finished screen by NEXT
    // (or from another tab) ran the whole next game first. Rules (same as web `celebration-gate.ts`):
    //  - DUE is computed from LOCAL results the instant a group's last game finishes (the server never delays it);
    //  - a LIVE celebration presents the moment nothing is open: on Home's root show, off Home go Home then show,
    //    something open wait; a late source (replay / sync) still waits for calm on Home's root;
    //  - leaving a finished screen by NEXT / Leaderboard / Keep playing while one is due plays it FIRST;
    //  - never twice (per-day seen tier; flawless covers sweep); a celebration whose day ended is dropped.

    public enum Group: String, Sendable { case daily, more }
    public enum Tier: String, Sendable { case sweep, flawless }

    public struct Due: Equatable, Sendable {
        public let group: Group
        public let tier: Tier
        /// `day:group:tier` — the once-per-day key.
        public let token: String
    }

    /// Which celebrations are due right now, from local results alone (Daily Sweep first, then Puzzles).
    /// `results` = today's finished games by key → won; `seen` = the tier already celebrated today for a group.
    public static func due(
        results: [String: Bool], dailyKeys: [String], moreKeys: [String],
        today: String, dataDay: String, seen: (Group) -> Tier?
    ) -> [Due] {
        guard dataDay == today else { return [] }
        var out: [Due] = []
        for (group, keys) in [(Group.daily, dailyKeys), (Group.more, moreKeys)] {
            if keys.isEmpty { continue }
            let rows = keys.map { results[$0] }
            if rows.contains(where: { $0 == nil }) { continue }
            let wins = rows.filter { $0 == true }.count
            // A "sweep" with zero recorded wins is stale / degenerate data, never a real day of play.
            if wins == 0 { continue }
            let tier: Tier = wins >= keys.count ? .flawless : .sweep
            let s = seen(group)
            if s == .flawless || s == tier { continue }
            out.append(Due(group: group, tier: tier, token: "\(today):\(group.rawValue):\(tier.rawValue)"))
        }
        return out
    }

    public enum Action: Equatable, Sendable { case present, goHomeThenPresent, wait, drop }

    /// What to do with a queued celebration right now.
    public static func action(
        source: Source, onHomeRoot: Bool, anythingPresented: Bool, popupUp: Bool,
        celebrationDay: String, today: String
    ) -> Action {
        if shouldDrop(celebrationDay: celebrationDay, today: today) { return .drop }
        if anythingPresented || popupUp { return .wait }
        if onHomeRoot { return .present }
        return source == .live ? .goHomeThenPresent : .wait
    }

    /// A game handoff (NEXT daily, Keep playing, Leaderboard) waits while a celebration is due or on screen.
    public static func shouldDeferHandoff(pending: Int) -> Bool { pending > 0 }
}
