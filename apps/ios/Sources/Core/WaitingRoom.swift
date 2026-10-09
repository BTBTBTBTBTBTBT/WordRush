import Foundation

// VS / pocket waiting rooms as a little lobby (FRIDAY-QUEUE item 22, 2.8 wave 3).
// Swift port of packages/core/src/waiting-room.ts, pinned to it by
// waiting-room-fixtures.json (WaitingRoomFixtureTests).
//
// One status line, a REAL counting timer, and a keepy-uppy tile mini-play.

public enum WaitingKind: String, Codable, Equatable {
    /// A private match: invited a named friend, or a code nobody has used yet.
    case friend
    /// Random opponent search.
    case random
    /// A bot is being found / warmed up.
    case bot
    /// A pocket game waiting for the friend to take their turn.
    case pocket
}

public enum WaitingRoom {
    private static func clean(_ s: String?) -> String {
        var t = (s ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        while t.hasPrefix("@") { t.removeFirst() }
        return t
    }

    /// The ONE status line. A real ellipsis character, never three dots.
    public static func statusLine(kind: WaitingKind, name: String? = nil) -> String {
        let n = clean(name)
        switch kind {
        case .friend, .pocket: return n.isEmpty ? "Waiting for your friend…" : "Waiting for \(n)…"
        case .random: return "Finding you an opponent…"
        case .bot: return "Warming up your opponent…"
        }
    }

    /// The counting timer: m:ss under an hour, h:mm:ss after. Negative or NaN reads 0:00.
    public static func waitClock(_ seconds: Double) -> String {
        let s = (seconds.isFinite && seconds > 0) ? Int(seconds.rounded(.down)) : 0
        let h = s / 3600
        let m = (s % 3600) / 60
        let ss = String(format: "%02d", s % 60)
        return h > 0 ? "\(h):" + String(format: "%02d", m) + ":" + ss : "\(m):\(ss)"
    }

    /// Seconds waited from a start time (ms) and now (ms); never negative.
    public static func waitedSeconds(startMs: Double, nowMs: Double) -> Int {
        max(0, Int(((nowMs - startMs) / 1000).rounded(.down)))
    }

    /// Seconds waited from a start Date (what the lobby stores).
    public static func waitedSeconds(since start: Date, now: Date = Date()) -> Int {
        waitedSeconds(startMs: start.timeIntervalSince1970 * 1000, nowMs: now.timeIntervalSince1970 * 1000)
    }

    /// The keepy-uppy line under the tile: nothing at 0, then the bounce count.
    public static func keepyLine(count: Int, best: Int) -> String {
        if count <= 0 { return best > 0 ? "Tap to bounce · best \(best)" : "Tap to bounce the tile" }
        return (count > best && best > 0) ? "\(count) · new best!" : "\(count)"
    }

    /// Idle chirps cycle slowly while you wait (never more than one per 6 s).
    public static let idleBits = ["checks its watch", "yawns", "waves at the door"]
    public static let idleEveryS = 6

    /// Which idle bit plays at a given waited second.
    public static func idleBit(_ seconds: Int) -> String? {
        if seconds < idleEveryS { return nil }
        return idleBits[(seconds / idleEveryS - 1) % idleBits.count]
    }
}
