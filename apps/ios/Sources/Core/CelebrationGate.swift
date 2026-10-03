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
}
