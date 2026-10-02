import Foundation

/// FINISH_SPEC (founder 10-02): a VS player's race clock. Like solo Gauntlet, it
/// PAUSES while that player's own stage card is up (each player pauses only during
/// their own card); recorded times exclude the card time. Pure, unit tested.
public struct RaceClock: Equatable {
    /// Unix ms the race started.
    public var startMs: Double
    /// Total ms spent paused (finished pauses).
    public private(set) var pausedMs: Double = 0
    /// When the current pause began (nil = running).
    public private(set) var pauseStartMs: Double?

    public init(startMs: Double) { self.startMs = startMs }

    public var isPaused: Bool { pauseStartMs != nil }

    /// Pause at `now` (no-op while already paused).
    public mutating func pause(at now: Double) {
        guard pauseStartMs == nil else { return }
        pauseStartMs = now
    }

    /// Resume at `now`, banking the pause (no-op while running).
    public mutating func resume(at now: Double) {
        guard let p = pauseStartMs else { return }
        pausedMs += max(0, now - p)
        pauseStartMs = nil
    }

    /// Race time at `now`, excluding every pause (an open pause counts up to `now`
    /// as paused, so a time taken mid-card stops at the card).
    public func elapsedMs(at now: Double) -> Double {
        guard startMs > 0 else { return 0 }
        let open = pauseStartMs.map { max(0, now - $0) } ?? 0
        return max(0, now - startMs - pausedMs - open)
    }
}
