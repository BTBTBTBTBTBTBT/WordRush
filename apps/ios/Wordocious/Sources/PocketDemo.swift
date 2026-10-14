#if DEBUG
import Foundation
import SwiftUI
import WordociousCore

/// DEBUG-only perf + playthrough harness for the pocket games (founder 10-13). Pocket games are two-player and server-driven, so
/// no guest can reach one. This plays ONE local game through the real core rules (`FriendlyGames.applyMove`) with a scripted
/// "Doug" on the other side and no network at all: `FriendlyGamesService` hands `demo-*` game ids to `PocketDemo` (get / move /
/// resign), and the real `FriendlyGameScreen` renders them. The PerfTour's `pocket.<kind>.*` steps drive my side through the
/// screen's own input handlers (letters typed one by one, taps), so the entry row, the board and the keyboard behave exactly as in
/// a real game. Mirrors apps/android/.../data/PocketDemo.kt and apps/web/lib/pocket-demo.ts. A Release build contains none of it.
/// A harness log line: stderr + the host file given by `-perfMarks` (simctl can't always hand the app's stderr back).
func plog(_ s: String) {
    fputs(s, stderr)
    PerfTour.mark(s.trimmingCharacters(in: .whitespacesAndNewlines))
}

@MainActor
enum PocketDemo {
    nonisolated static let prefix = "demo-"
    /// Posted when the local game changes (the screen refetches at once instead of waiting for its 2 s poll).
    static let changedNote = Notification.Name("wordocious.pocketDemo.changed")
    /// object: a `FriendlyMove` the screen plays through its own input path (letters typed, a tap).
    static let myMoveNote = Notification.Name("wordocious.pocketDemo.myMove")
    /// object: Bool — show / hide the How to Play card.
    static let helpNote = Notification.Name("wordocious.pocketDemo.help")

    nonisolated static func isDemo(_ id: String) -> Bool { id.hasPrefix(prefix) }

    private(set) static var kind: FriendlyKind = .rps
    private static var state: FriendlyState = FriendlyGames.newState(.rps)
    private static var seq = 0
    private static var base = Date().addingTimeInterval(-3600)
    private static var startedAt = CACurrentMediaTime()
    private(set) static var last: FriendlyGameView?
    private static var friendTask: Task<Void, Never>?
    private static var runId = 0

    // MARK: Scripts (same as the Android + web demos)

    private static let ghostWords = ["STRAND", "PLANT"]
    private static let coinWinners: [FriendlySide] = [.a, .b, .a, .b, .a]
    /// Word Chain: 5 to 15 letters, race to 50. STRAIGHTFORWARD is the 15-letter max.
    static let chainMine = ["STUPENDOUS", "STRAIGHTFORWARD", "LIGHTHOUSE", "YESTERDAY", "FANTASTIC"]
    private static let chainTheirs = ["SERENDIPITOUS", "DEVELOPMENTAL", "EXTRAORDINARY", "YOURSELF"]
    private static let tttMine = [[0, 4, 8], [0, 4, 8]]
    private static let tttTheirs = [[1, 2], [1, 2, 3]]

    private static func clamp(_ n: Int, _ m: Int) -> Int { min(n, m) }

    /// My next scripted move (nil when it isn't my turn).
    static func myMove(_ s: FriendlyState) -> FriendlyMove? {
        switch s {
        case .rps(let r):
            return r.picks.a != nil ? nil : .rps([RpsPick.rock, .paper, .scissors][r.rounds.count % 3])
        case .ttt(let t):
            return t.turn != .a ? nil : .ttt(tttMine[clamp(t.games.count, 1)][clamp(t.board.filter { $0 == .a }.count, 2)])
        case .coin(let c):
            return c.caller != .a ? nil : .coin(c.rounds.count % 4 == 0 ? .heads : .tails)
        case .pass(let p):
            let mine = ["CRANE", "BLAND", "PLANT"]
            return p.turn != .a ? nil : .pass(mine[clamp(p.guesses.filter { $0.by == .a }.count, 2)])
        case .ghost(let g):
            guard g.turn == .a else { return nil }
            let w = Array(ghostWords[clamp(g.rounds.count, 1)])
            return .ghost(String(w[g.fragment.count]))
        case .chain(let c):
            return c.turn != .a ? nil : .chain(chainMine[clamp(c.words.filter { $0.by == .a }.count, 4)])
        }
    }

    private static func theirMove(_ s: FriendlyState) -> FriendlyMove? {
        switch s {
        case .rps(let r):
            // Doug picks first on rounds 1 and 3 (the face-down fist), after me on round 2.
            let ready = r.picks.b == nil && (r.rounds.count % 2 == 0 || r.picks.a != nil)
            return ready ? .rps([RpsPick.scissors, .scissors, .paper][r.rounds.count % 3]) : nil
        case .ttt(let t):
            guard t.turn == .b else { return nil }
            let opts = tttTheirs[clamp(t.games.count, 1)]
            let want = opts[clamp(t.board.filter { $0 == .b }.count, opts.count - 1)]
            return .ttt(t.board[want] == nil ? want : (t.board.firstIndex(where: { $0 == nil }) ?? 0))
        case .coin(let c):
            return c.caller != .b ? nil : .coin(.tails)
        case .pass(let p):
            let theirs = ["SLOTH", "GLINT", "FUDGY"]
            return p.turn != .b ? nil : .pass(theirs[clamp(p.guesses.filter { $0.by == .b }.count, 2)])
        case .ghost(let g):
            guard g.turn == .b else { return nil }
            let w = Array(ghostWords[clamp(g.rounds.count, 1)])
            return .ghost(String(w[g.fragment.count]))
        case .chain(let c):
            return c.turn != .b ? nil : .chain(chainTheirs[clamp(c.words.filter { $0.by == .b }.count, 3)])
        }
    }

    // MARK: The local game

    /// A fresh game on my turn; `kind` stays until the next `begin`.
    static func begin(_ k: FriendlyKind) {
        friendTask?.cancel()
        runId += 1
        kind = k
        seq = 0
        base = Date().addingTimeInterval(-3600)
        startedAt = CACurrentMediaTime()
        state = FriendlyGames.newState(k)
        // The first-play How to Play card stays out of the way (the help steps open it on purpose).
        if !StoreDemo.active && !AuthService.shared.isAuthenticated { TutorialsSeen.shared.mark(PocketHelp.tutorialKey(k)) }
        publish()
        plog("POCKET|start|\(k.rawValue)\n")
    }

    static var gameId: String { prefix + kind.rawValue }
    static var isOver: Bool { FriendlyGames.friendlyWinner(state) != nil }

    private static func view() -> FriendlyGameView? {
        let w = FriendlyGames.friendlyWinner(state)
        seq += 1
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let t = iso.string(from: base.addingTimeInterval(Double(seq) * 0.05))
        // The friend's open RPS pick is face down until mine is in.
        var shown = state
        if case .rps(var r) = state, r.picks.b != nil { r.picks.b = .hidden; shown = .rps(r) }
        guard let stateData = try? JSONEncoder().encode(shown),
              let stateObj = try? JSONSerialization.jsonObject(with: stateData) else { return nil }
        let turn = FriendlyGames.whoseTurn(state)
        let yourTurn = w == nil && (turn == .a || turn == .both)
        let result: Any = w == nil ? NSNull() : (w == .a ? "win" : w == .b ? "loss" : "draw")
        let json: [String: Any] = [
            "id": gameId, "kind": kind.rawValue, "title": kind.title, "me": "a",
            "opponent": ["id": "5d0e0000-0000-4000-8000-000000000013", "username": "Doug"],
            "state": stateObj, "status": w == nil ? "active" : "done", "yourTurn": yourTurn,
            "result": result, "line": w == nil ? "" : (w == .a ? "You won" : "Doug won"),
            "answer": kind == .pass && w != nil ? "PLANT" : NSNull(),
            "createdAt": t, "updatedAt": t,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: json) else { return nil }
        return try? JSONDecoder().decode(FriendlyGameView.self, from: data)
    }

    private static func publish() {
        last = view()
        NotificationCenter.default.post(name: changedNote, object: nil)
    }

    private static func ctx(by: FriendlySide, move: FriendlyMove) -> (random: () -> Double, solution: String, isWord: (String) -> Bool, hasPrefix: (String) -> Bool) {
        let want: FriendlySide = {
            if case .coin(let c) = state { return coinWinners[clamp(c.rounds.count, 4)] }
            return .a
        }()
        let random: () -> Double = {
            guard case .coin(let call) = move else { return 0.5 }
            let flip: CoinFace = want == by ? call : (call == .heads ? .tails : .heads)
            return flip == .heads ? 0.2 : 0.8
        }
        let isGhost: Bool = { if case .ghost = state { return true }; return false }()
        return (random, "PLANT", { w in isGhost ? ghostWords.contains(w) : true }, { p in ghostWords.contains { $0.hasPrefix(p) } })
    }

    private static func apply(_ by: FriendlySide, _ move: FriendlyMove) -> String? {
        let c = ctx(by: by, move: move)
        switch FriendlyGames.applyMove(state, by: by, move, random: c.random, solution: c.solution,
                                       isValidWord: { _ in true }, isWord: c.isWord, hasPrefix: c.hasPrefix) {
        case .failure(let m): return m
        case .ok(let s, _, _):
            state = s
            publish()
            plog(String(format: "POCKET|move|%@|%@|%.0f\n", by.rawValue, "\(move)", (CACurrentMediaTime() - startedAt) * 1000))
            return nil
        }
    }

    static func get(_ id: String) -> Result<FriendlyGameView, FriendlyGamesService.Failure> {
        guard let g = last, g.id == id else { return .failure(.message("Not found")) }
        scheduleFriend()
        return .success(g)
    }

    /// My move through the screen's real send path.
    static func move(_ id: String, _ m: FriendlyMove) -> Result<FriendlyGameView, FriendlyGamesService.Failure> {
        guard let g = last, g.id == id else { return .failure(.message("Not found")) }
        if let err = apply(.a, m) { return .failure(.message(err)) }
        scheduleFriend()
        return last.map { .success($0) } ?? .success(g)
    }

    static func resign(_ id: String) -> Result<FriendlyGameView, FriendlyGamesService.Failure> {
        guard let g = last, g.id == id else { return .failure(.message("Not found")) }
        return .success(g)
    }

    /// Doug answers after a beat (1.1 s), the way a friend on the other phone would.
    private static func scheduleFriend() {
        guard friendTask == nil || friendTask?.isCancelled == true, !isOver, let mv = theirMove(state) else { return }
        let run = runId
        friendTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_100_000_000)
            friendTask = nil
            guard !Task.isCancelled, run == runId, !isOver else { return }
            if let mv2 = theirMove(state) { _ = apply(.b, mv2) } else { _ = mv }
        }
    }

    /// Plays my side through the screen's input path until the game is over (or `timeout` s pass).
    /// A finished round / flip plays its animation first: leave it room before the next move.
    static func autoplay(pace: Double = 1.6, timeout: Double = 150) async {
        let deadline = CACurrentMediaTime() + timeout
        await PerfDrive.sleep(1.2)
        var lastRounds = roundsOf(state)
        var myMoves = 0
        var shotReveal = false
        while !isOver, CACurrentMediaTime() < deadline {
            scheduleFriend()
            if let mine = myMove(state), FriendlyGames.whoseTurn(state) == .a || FriendlyGames.whoseTurn(state) == .both {
                NotificationCenter.default.post(name: myMoveNote, object: mine)
                // The screen types the move (letters 70 ms apart) and sends it; wait for it to land.
                let before = seq
                var waited = 0.0
                while seq == before, waited < 12 { await PerfDrive.sleep(0.1); waited += 0.1 }
                let r = roundsOf(state)
                let reveal = r > lastRounds && (kind == .rps || kind == .coin)
                lastRounds = r
                myMoves += 1
                if reveal && !shotReveal { shotReveal = true; await PerfDrive.sleep(0.8); snap("\(kind.rawValue)-reveal"); await PerfDrive.sleep(3.5) }
                else if myMoves == 2 && !reveal { await PerfDrive.sleep(0.9); snap("\(kind.rawValue)-mid"); await PerfDrive.sleep(pace) }
                else { await PerfDrive.sleep(reveal ? 4.3 : pace) }
            } else {
                await PerfDrive.sleep(0.25)
                let r = roundsOf(state)
                if r > lastRounds && (kind == .rps || kind == .coin) { lastRounds = r; await PerfDrive.sleep(4.3) }
            }
        }
        plog(String(format: "POCKET|done|%@|%.0f|over=%@\n", kind.rawValue, (CACurrentMediaTime() - startedAt) * 1000, isOver ? "true" : "false"))
    }

    private static func roundsOf(_ s: FriendlyState) -> Int {
        switch s {
        case .rps(let r): return r.rounds.count
        case .coin(let c): return c.rounds.count
        case .ttt(let t): return t.games.count
        case .ghost(let g): return g.rounds.count
        default: return 0
        }
    }
}

// MARK: - Screenshots

extension PocketDemo {
    /// `-pocketShots <host dir>`: a PNG of the whole window (whatever is presented) at this moment.
    static func snap(_ name: String) {
        guard let dir = PerfTour.argument("-pocketShots") else { return }
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
              let window = scene.windows.first(where: \.isKeyWindow) ?? scene.windows.first else { return }
        let img = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: false)
        }
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try? img.pngData()?.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        plog("POCKET|shot|\(name)\n")
    }
}

// MARK: - The musical cast

/// DEBUG perf harness for the musical cast (founder 10-13): the tour turns musical mode on, taps a tune's notes at ~300 ms through
/// the header's own touch-down path, then checks the sung-back playback (every note, in order, at `MusicalCast.replay` timing) and
/// that the achievement unlock is CALLED once, after the playback.
@MainActor
enum MusicalDemo {
    static let tapNote = Notification.Name("wordocious.musicalDemo.tap")
    private static var tapSeq = 0
    private static var claimed = Set<Int>()
    /// The last tap's time: the sung-back playback's offsets count from it.
    private static var lastTapAt: CFTimeInterval = 0
    private static var recording = false
    private static var sung: [(castId: String, ms: Int)] = []
    private static var unlocks: [(key: String, ms: Int)] = []

    /// The first header to see a tap takes it (several headers can be mounted at once).
    static func claim(_ n: Notification) -> Bool {
        guard let id = n.userInfo?["id"] as? Int else { return true }
        return claimed.insert(id).inserted
    }

    static func castId(midi: Int) -> String? { MusicalCast.scale.firstIndex(of: midi).map { MusicalCast.ids[$0] } }

    static func noted(_ castId: String, fromPlayback: Bool) {
        guard recording else { return }
        let ms = Int((CACurrentMediaTime() - lastTapAt) * 1000)
        if fromPlayback { sung.append((castId, ms)) }
        plog("MUSICAL|\(fromPlayback ? "sing" : "tap")|\(castId)|\(ms)\n")
    }

    static func matched(_ tune: MusicalMelody) {
        guard recording else { return }
        plog("MUSICAL|matched|\(tune.id)|\(Int((CACurrentMediaTime() - lastTapAt) * 1000))\n")
    }

    static func unlockCalled(_ key: String) async {
        guard recording else { return }
        let ms = Int((CACurrentMediaTime() - lastTapAt) * 1000)
        unlocks.append((key, ms))
        plog("MUSICAL|unlock-called|\(key)|\(ms)\n")
    }

    /// Musical mode on / off through the store (what a long-press does).
    static func setMode(_ on: Bool) {
        if MusicalCastStore.shared.musical != on { MusicalCastStore.shared.toggle(from: .w) }
    }

    /// Plays `tune` on the header (notes 300 ms apart), waits for the playback and the unlock call, then checks them.
    static func play(_ tune: MusicalMelody) async -> String {
        sung = []; unlocks = []; recording = true
        MusicalCastStore.shared.melody = .start
        for midi in tune.notes {
            guard let id = castId(midi: midi) else { continue }
            tapSeq += 1
            lastTapAt = CACurrentMediaTime()
            NotificationCenter.default.post(name: tapNote, object: id, userInfo: ["id": tapSeq])
            await PerfDrive.sleep(0.3)
        }
        // The playback (lead-in + the jingle), then the unlock call 250 ms after it.
        await PerfDrive.sleep(Double(MusicalCast.replayDuration(tune) + 250) / 1000 - 0.3 + 0.7)
        recording = false
        let want = MusicalCast.replay(tune)
        var problems: [String] = []
        if sung.count != want.count { problems.append("sang \(sung.count) of \(want.count) notes") }
        var maxDrift = 0
        for (i, w) in want.enumerated() where i < sung.count {
            if sung[i].castId != w.castId { problems.append("note \(i + 1): \(sung[i].castId) != \(w.castId)") }
            maxDrift = max(maxDrift, abs(sung[i].ms - w.atMs))
        }
        if maxDrift > 40 { problems.append("timing drift \(maxDrift) ms") }
        if unlocks.count != 1 || unlocks.first?.key != tune.achievement { problems.append("unlock called \(unlocks.count)x") }
        let line = "MUSICAL|verify|\(tune.id)|\(problems.isEmpty ? "PASS" : "FAIL " + problems.joined(separator: "; "))|notes=\(sung.count)/\(want.count)|maxDriftMs=\(maxDrift)|unlockMs=\(unlocks.first?.ms ?? -1)"
        plog(line + "\n")
        print(line)
        fflush(stdout)
        return line
    }
}
#endif
