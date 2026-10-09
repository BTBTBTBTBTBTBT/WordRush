import Foundation

/// Live pocket games (FRIDAY-QUEUE item 9b) — the pure rules, mirrored 1:1 from
/// packages/core/src/friendly-live.ts (pinned by FriendlyLiveTests; TS twin is friendly-live.test.ts).
///
/// Gate: `FlagsService.shared.isLive(FriendlyLive.switchKey)`. Off = the old 2 s poll.
/// On: Realtime channel `fg:<gameId>` — broadcast "move" (the receiver's view, sent by the server
/// the instant a move is saved), postgres_changes on friendly_game_pings (backup: only says
/// "refetch"), presence, broadcast "react". The GET stays the source of truth + keep-alive.
public enum FriendlyLive {
    public static let switchKey = "live_play"

    public static func topic(_ gameId: String) -> String { "fg:\(gameId)" }
    public static let eventMove = "move"
    public static let eventReact = "react"
    public static let pingTable = "friendly_game_pings"

    public static let reactions = ["clap", "fire", "wow", "grr", "rematch"]
    public static func isReaction(_ s: String?) -> Bool { s.map(reactions.contains) ?? false }
    public static let reactCooldownMs = 1200
    public static let reactLifetimeMs = 2400

    /// Poll cadence in ms: switch off = 2000; on + socket up = 20 s keep-alive; on + socket down = 4 s.
    public static func pollIntervalMs(liveOn: Bool, socketUp: Bool) -> Int {
        if !liveOn { return 2000 }
        return socketUp ? 20000 : 4000
    }

    /// How long an optimistic move may wait for the server before it is rolled back.
    public static let optimisticTimeoutMs = 8000

    // MARK: Presence

    public enum PresenceLabel: String, Equatable { case here, thinking, left, away }

    public static func presenceLabel(peerPresent: Bool, everSeen: Bool, theirTurn: Bool, peerThinking: Bool = false) -> PresenceLabel {
        if peerPresent { return theirTurn || peerThinking ? .thinking : .here }
        return everSeen ? .left : .away
    }

    public static func presenceCopy(_ l: PresenceLabel) -> String {
        switch l {
        case .here: return "HERE NOW"
        case .thinking: return "THINKING…"
        case .left: return "LEFT THE GAME"
        case .away: return ""
        }
    }

    // MARK: Staleness + change detection

    /// ISO-8601 instant in ms (handles "+00:00" and "Z", with or without fractions); 0 if unparseable.
    public static func instantMs(_ iso: String) -> Double {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d.timeIntervalSince1970 * 1000 }
        f.formatOptions = [.withInternetDateTime]
        return (f.date(from: iso)?.timeIntervalSince1970 ?? 0) * 1000
    }

    /// True when `next` is a strictly newer save than `cur` (or nothing is on screen yet).
    public static func isNewer(_ cur: String?, _ next: String) -> Bool {
        guard let cur else { return true }
        return instantMs(next) > instantMs(cur)
    }

    public struct Change: Equatable {
        public var moved = false
        public var yourTurnStarted = false
        public var ended = false
        public init(moved: Bool = false, yourTurnStarted: Bool = false, ended: Bool = false) {
            self.moved = moved; self.yourTurnStarted = yourTurnStarted; self.ended = ended
        }
    }

    public static func describeChange(_ prev: FriendlyGameView?, _ next: FriendlyGameView) -> Change {
        guard let prev else { return Change() }
        return Change(
            moved: prev.state != next.state,
            yourTurnStarted: !prev.yourTurn && next.yourTurn && next.isActive,
            ended: prev.isActive && !next.isActive
        )
    }

    // MARK: Optimistic moves

    /// The state after MY move when the client can know it: Tic-Tac-Tile always; Rock Paper
    /// Scissors before the friend's pick; Word Chain (shape rules only, the list check is the
    /// server's). Call It, Pass the Puzzle and Ghost wait for the server (nil).
    public static func predictMove(_ state: FriendlyState, side: FriendlySide, _ move: FriendlyMove) -> FriendlyState? {
        switch state {
        case .ttt:
            return ok(FriendlyGames.applyMove(state, by: side, move))
        case .rps(let r):
            guard case .rps = move, r.picks[side] == nil else { return nil }
            let theirs: FriendlySide = side == .a ? .b : .a
            if r.picks[theirs] != nil { return nil }
            return ok(FriendlyGames.applyMove(state, by: side, move))
        case .chain:
            guard case .chain = move else { return nil }
            return ok(FriendlyGames.applyMove(state, by: side, move))
        default:
            return nil
        }
    }

    private static func ok(_ r: FriendlyGames.MoveResult) -> FriendlyState? {
        if case .ok(let s, _, _) = r { return s }
        return nil
    }

    public struct Pending: Equatable {
        public let move: FriendlyMove
        public let predicted: FriendlyState
        public let baseUpdatedAt: String
    }

    /// The confirmed game plus my in-flight prediction. Pure value type; the screen holds one.
    public struct Snapshot: Equatable {
        public var confirmed: FriendlyGameView?
        public var pending: Pending?
        public init(confirmed: FriendlyGameView? = nil, pending: Pending? = nil) {
            self.confirmed = confirmed; self.pending = pending
        }

        /// What to draw: the confirmed game with my predicted state over it while the move is in flight.
        public var displayed: FriendlyGameView? {
            guard let c = confirmed else { return nil }
            guard let p = pending, p.baseUpdatedAt == c.updatedAt else { return c }
            let turn = FriendlyGames.whoseTurn(p.predicted)
            let mineNow = turn == .both || turn?.rawValue == c.me.rawValue
            return c.replacing(state: p.predicted, yourTurn: mineNow)
        }

        /// I tapped. Returns true if a prediction was attached.
        @discardableResult
        public mutating func beginMove(_ move: FriendlyMove) -> Bool {
            guard let c = confirmed, c.isActive, pending == nil,
                  let predicted = FriendlyLive.predictMove(c.state, side: c.me, move) else { return false }
            pending = Pending(move: move, predicted: predicted, baseUpdatedAt: c.updatedAt)
            return true
        }

        /// The server accepted my move: its answer replaces the prediction (never an older save).
        public mutating func confirmMove(_ server: FriendlyGameView) {
            if confirmed == nil || FriendlyLive.isNewer(confirmed?.updatedAt, server.updatedAt) { confirmed = server }
            pending = nil
        }

        /// The server said no, or the call failed. True if a prediction was dropped (the UI shakes).
        @discardableResult
        public mutating func rejectMove() -> Bool {
            let had = pending != nil
            pending = nil
            return had
        }

        /// A view from somewhere other than my own move's reply (broadcast, backup refetch, keep-alive).
        public mutating func receive(_ incoming: FriendlyGameView) -> (applied: Bool, change: Change) {
            guard FriendlyLive.isNewer(confirmed?.updatedAt, incoming.updatedAt) else { return (false, Change()) }
            let change = FriendlyLive.describeChange(confirmed, incoming)
            let stillValid = pending?.baseUpdatedAt == incoming.updatedAt
            confirmed = incoming
            if !stillValid { pending = nil }
            return (true, change)
        }
    }
}

extension FriendlyGameView {
    /// A copy with a different state / turn flag (the optimistic overlay).
    func replacing(state: FriendlyState, yourTurn: Bool) -> FriendlyGameView {
        FriendlyGameView(id: id, kind: kind, title: title, me: me, opponent: opponent, state: state, status: status,
                         yourTurn: yourTurn, result: result, line: line, answer: answer, createdAt: createdAt, updatedAt: updatedAt)
    }
}
