import Foundation

// Friends overhaul (founder, 2026-10-01; spec docs/FRIENDS_REDESIGN_SPEC.md):
// the pocket games you play with a friend — Rock Paper Scissors, Tic-Tac-Tile,
// Call It and Pass the Puzzle — plus the Friends banner words, friend streaks
// and the "on now" rule. Swift port of packages/core/src/friendly-games.ts,
// pinned to it by friendly-games-fixtures.json (FriendlyGamesFixtureTests).
//
// The server is the only writer (it runs the rules and stores the state);
// clients decode the state it sends and render the words below.
// applyFriendlyMove is ported too so the fixtures can replay every script.

public enum FriendlyKind: String, Codable, CaseIterable, Identifiable {
    case rps, ttt, coin, pass
    public var id: String { rawValue }

    /// FRIENDLY_TITLES.
    public var title: String {
        switch self {
        case .rps: return "Rock Paper Scissors"
        case .ttt: return "Tic-Tac-Tile"
        case .coin: return "Call It"
        case .pass: return "Pass the Puzzle"
        }
    }

    /// FRIENDLY_TARGET — wins needed: best of 3 (RPS, Tic-Tac-Tile), best of 5 (Call It).
    public var target: Int {
        switch self {
        case .rps, .ttt: return 2
        case .coin: return 3
        case .pass: return 1
        }
    }

    /// The kind whose title this is (feed moments carry the title only).
    public init?(title: String) {
        guard let k = FriendlyKind.allCases.first(where: { $0.title == title }) else { return nil }
        self = k
    }
}

public enum FriendlySide: String, Codable, Equatable {
    case a, b
    public var other: FriendlySide { self == .a ? .b : .a }
}

/// whoseTurn: a side, both (an open RPS round), or nil when it's over.
public enum FriendlyTurn: String, Codable, Equatable {
    case a, b, both
}

/// friendlyWinner: a side or a draw (nil while it's still going).
public enum FriendlyOutcome: String, Codable, Equatable {
    case a, b, draw
}

public enum RpsPick: String, Codable, CaseIterable, Equatable {
    case rock, paper, scissors
}

/// One open RPS pick as a viewer sees it: the friend's arrives as "hidden".
public enum RpsSlot: String, Codable, Equatable {
    case rock, paper, scissors, hidden
    public var pick: RpsPick? { RpsPick(rawValue: rawValue) }
    public init(_ p: RpsPick) { self = RpsSlot(rawValue: p.rawValue)! }
}

public enum CoinFace: String, Codable, CaseIterable, Equatable {
    case heads, tails
}

public struct FriendlyScore: Codable, Equatable {
    public var a: Int
    public var b: Int
    public init(a: Int = 0, b: Int = 0) { self.a = a; self.b = b }
    public subscript(_ s: FriendlySide) -> Int {
        get { s == .a ? a : b }
        set { if s == .a { a = newValue } else { b = newValue } }
    }
}

public struct RpsPicks: Codable, Equatable {
    public var a: RpsSlot?
    public var b: RpsSlot?
    public init(a: RpsSlot? = nil, b: RpsSlot? = nil) { self.a = a; self.b = b }
    public subscript(_ s: FriendlySide) -> RpsSlot? {
        get { s == .a ? a : b }
        set { if s == .a { a = newValue } else { b = newValue } }
    }
}

public struct RpsRound: Codable, Equatable {
    public let a: RpsPick
    public let b: RpsPick
    public let winner: FriendlySide?
    public init(a: RpsPick, b: RpsPick, winner: FriendlySide?) { self.a = a; self.b = b; self.winner = winner }
    public subscript(_ s: FriendlySide) -> RpsPick { s == .a ? a : b }
}

public struct RpsState: Codable, Equatable {
    public var picks: RpsPicks
    public var rounds: [RpsRound]
    public var score: FriendlyScore
}

public struct TttGame: Codable, Equatable {
    public let winner: FriendlySide?
}

public struct TttState: Codable, Equatable {
    /// Nine cells; nil = empty ("" on the wire).
    public var board: [FriendlySide?]
    public var starter: FriendlySide
    public var turn: FriendlySide
    public var games: [TttGame]
    public var score: FriendlyScore

    enum CodingKeys: String, CodingKey { case board, starter, turn, games, score }

    public init(board: [FriendlySide?], starter: FriendlySide, turn: FriendlySide, games: [TttGame], score: FriendlyScore) {
        self.board = board; self.starter = starter; self.turn = turn; self.games = games; self.score = score
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        board = try c.decode([String].self, forKey: .board).map { FriendlySide(rawValue: $0) }
        starter = try c.decode(FriendlySide.self, forKey: .starter)
        turn = try c.decode(FriendlySide.self, forKey: .turn)
        games = try c.decode([TttGame].self, forKey: .games)
        score = try c.decode(FriendlyScore.self, forKey: .score)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(board.map { $0?.rawValue ?? "" }, forKey: .board)
        try c.encode(starter, forKey: .starter)
        try c.encode(turn, forKey: .turn)
        try c.encode(games, forKey: .games)
        try c.encode(score, forKey: .score)
    }
}

public struct CoinRound: Codable, Equatable {
    public let caller: FriendlySide
    public let call: CoinFace
    public let flip: CoinFace
    public let winner: FriendlySide
}

public struct CoinState: Codable, Equatable {
    public var caller: FriendlySide
    public var rounds: [CoinRound]
    public var score: FriendlyScore
    public var stake: String
}

public struct PassGuess: Codable, Equatable {
    public let by: FriendlySide
    public let word: String
    /// TileState raw values ("CORRECT" / "PRESENT" / "ABSENT").
    public let tiles: [String]
}

public struct PassState: Codable, Equatable {
    public var turn: FriendlySide
    public var guesses: [PassGuess]
    public var solvedBy: FriendlySide?
}

/// The server's `state` — one of the four shapes, tagged by `kind`.
public enum FriendlyState: Codable, Equatable {
    case rps(RpsState)
    case ttt(TttState)
    case coin(CoinState)
    case pass(PassState)

    private enum KindKey: String, CodingKey { case kind }

    public var kind: FriendlyKind {
        switch self {
        case .rps: return .rps
        case .ttt: return .ttt
        case .coin: return .coin
        case .pass: return .pass
        }
    }

    /// The match score (nil for Pass the Puzzle, which has none).
    public var score: FriendlyScore? {
        switch self {
        case .rps(let s): return s.score
        case .ttt(let s): return s.score
        case .coin(let s): return s.score
        case .pass: return nil
        }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: KindKey.self)
        let kind = try c.decode(FriendlyKind.self, forKey: .kind)
        switch kind {
        case .rps: self = .rps(try RpsState(from: decoder))
        case .ttt: self = .ttt(try TttState(from: decoder))
        case .coin: self = .coin(try CoinState(from: decoder))
        case .pass: self = .pass(try PassState(from: decoder))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: KindKey.self)
        try c.encode(kind, forKey: .kind)
        switch self {
        case .rps(let s): try s.encode(to: encoder)
        case .ttt(let s): try s.encode(to: encoder)
        case .coin(let s): try s.encode(to: encoder)
        case .pass(let s): try s.encode(to: encoder)
        }
    }
}

/// A move as the server takes it: `{kind:'rps', pick}` / `{kind:'ttt', cell}` /
/// `{kind:'coin', call}` / `{kind:'pass', word}`.
public enum FriendlyMove: Codable, Equatable {
    case rps(RpsPick)
    case ttt(Int)
    case coin(CoinFace)
    case pass(String)

    private enum Keys: String, CodingKey { case kind, pick, cell, call, word }

    public var kind: FriendlyKind {
        switch self {
        case .rps: return .rps
        case .ttt: return .ttt
        case .coin: return .coin
        case .pass: return .pass
        }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(FriendlyKind.self, forKey: .kind) {
        case .rps: self = .rps(try c.decode(RpsPick.self, forKey: .pick))
        case .ttt: self = .ttt(try c.decode(Int.self, forKey: .cell))
        case .coin: self = .coin(try c.decode(CoinFace.self, forKey: .call))
        case .pass: self = .pass(try c.decode(String.self, forKey: .word))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        try c.encode(kind, forKey: .kind)
        switch self {
        case .rps(let p): try c.encode(p, forKey: .pick)
        case .ttt(let i): try c.encode(i, forKey: .cell)
        case .coin(let f): try c.encode(f, forKey: .call)
        case .pass(let w): try c.encode(w, forKey: .word)
        }
    }
}

/// GET /api/friends/games… → one game as the caller sees it (spec §4 GameView).
public struct FriendlyGameView: Decodable, Identifiable, Equatable {
    public struct Opponent: Decodable, Equatable {
        public let id: String
        public let username: String
        public let avatarUrl: String?
        public let avatarEmoji: String?
    }
    public let id: String
    public let kind: FriendlyKind
    public let title: String
    public let me: FriendlySide
    public let opponent: Opponent
    public let state: FriendlyState
    /// active | done | resigned | expired
    public let status: String
    public let yourTurn: Bool
    /// win | loss | draw | nil while active
    public let result: String?
    public let line: String
    /// Pass the Puzzle's answer, once over.
    public let answer: String?
    public let createdAt: String
    public let updatedAt: String

    public var isActive: Bool { status == "active" }
}

public struct FriendsBannerInput: Codable, Equatable {
    public var friendCount: Int
    /// Usernames of friends on now.
    public var online: [String]
    /// Today's race: my rank (1-based) among me + friends, and the points.
    public var myRank: Int
    public var myPoints: Int
    public var leaderName: String
    public var leaderPoints: Int
    /// Points of the person right behind me (or 0).
    public var nextPoints: Int

    public init(friendCount: Int, online: [String], myRank: Int, myPoints: Int, leaderName: String, leaderPoints: Int, nextPoints: Int) {
        self.friendCount = friendCount; self.online = online; self.myRank = myRank; self.myPoints = myPoints
        self.leaderName = leaderName; self.leaderPoints = leaderPoints; self.nextPoints = nextPoints
    }
}

public enum FriendlyGames {
    public static let kinds: [FriendlyKind] = FriendlyKind.allCases
    /// Call It stakes — a fixed list (no free text).
    public static let coinStakes = ["Bragging rights", "Loser picks tonight's VS mode", "Winner goes first next time"]
    /// Pass the Puzzle shares one Classic board: six guesses between the two players.
    public static let passMaxGuesses = 6
    /// A friend is "on now" when their app heartbeat is under two minutes old.
    public static let onlineWindowMs = 2 * 60 * 1000

    /// A fresh game; side a is whoever started it.
    public static func newState(_ kind: FriendlyKind, stake: String? = nil) -> FriendlyState {
        switch kind {
        case .rps: return .rps(RpsState(picks: RpsPicks(), rounds: [], score: FriendlyScore()))
        case .ttt: return .ttt(TttState(board: Array(repeating: nil, count: 9), starter: .a, turn: .a, games: [], score: FriendlyScore()))
        case .coin:
            let s = stake.flatMap { coinStakes.contains($0) ? $0 : nil } ?? coinStakes[0]
            return .coin(CoinState(caller: .a, rounds: [], score: FriendlyScore(), stake: s))
        case .pass: return .pass(PassState(turn: .a, guesses: [], solvedBy: nil))
        }
    }

    public static func rpsBeats(_ x: RpsPick, _ y: RpsPick) -> Bool {
        (x == .rock && y == .scissors) || (x == .paper && y == .rock) || (x == .scissors && y == .paper)
    }

    private static let lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

    /// The winning line on a Tic-Tac-Tile board, if any.
    public static func tttLine(_ board: [FriendlySide?]) -> (side: FriendlySide, cells: [Int])? {
        for l in lines {
            if let m = board[l[0]], board[l[1]] == m, board[l[2]] == m { return (m, l) }
        }
        return nil
    }

    /// Whose move it is: a side, both (an open RPS round), or nil when the game is over.
    public static func whoseTurn(_ s: FriendlyState) -> FriendlyTurn? {
        if friendlyWinner(s) != nil { return nil }
        switch s {
        case .rps(let r):
            if r.picks.a != nil && r.picks.b == nil { return .b }
            if r.picks.b != nil && r.picks.a == nil { return .a }
            return .both
        case .ttt(let t): return FriendlyTurn(rawValue: t.turn.rawValue)
        case .coin(let c): return FriendlyTurn(rawValue: c.caller.rawValue)
        case .pass(let p): return FriendlyTurn(rawValue: p.turn.rawValue)
        }
    }

    /// The match winner, draw, or nil while it is still going.
    public static func friendlyWinner(_ s: FriendlyState) -> FriendlyOutcome? {
        if case .pass(let p) = s {
            if let w = p.solvedBy { return FriendlyOutcome(rawValue: w.rawValue) }
            return p.guesses.count >= passMaxGuesses ? .draw : nil
        }
        guard let score = s.score else { return nil }
        let target = s.kind.target
        if score.a >= target { return .a }
        if score.b >= target { return .b }
        // Tic-Tac-Tile stops after five games (draws included): the leader wins.
        if case .ttt(let t) = s, t.games.count >= 5 {
            return score.a == score.b ? .draw : score.a > score.b ? .a : .b
        }
        return nil
    }

    public enum MoveResult: Equatable {
        case ok(state: FriendlyState, done: Bool, winner: FriendlyOutcome?)
        case failure(String)
    }

    /// Apply one move by `by`. Pure: randomness and the answer are parameters.
    public static func applyMove(_ s: FriendlyState, by: FriendlySide, _ move: FriendlyMove,
                                 random: () -> Double = { Double.random(in: 0..<1) },
                                 solution: String? = nil,
                                 isValidWord: ((String) -> Bool)? = nil) -> MoveResult {
        if move.kind != s.kind { return .failure("Wrong game") }
        if friendlyWinner(s) != nil { return .failure("This game is over") }
        let turn = whoseTurn(s)
        if turn != .both && turn?.rawValue != by.rawValue { return .failure("Not your turn") }
        func done(_ n: FriendlyState) -> MoveResult {
            .ok(state: n, done: friendlyWinner(n) != nil, winner: friendlyWinner(n))
        }

        switch (s, move) {
        case (.rps(var r), .rps(let pick)):
            if r.picks[by] != nil { return .failure("Already picked") }
            var picks = r.picks
            picks[by] = RpsSlot(pick)
            guard let pa = picks.a?.pick, let pb = picks.b?.pick else {
                r.picks = picks
                return done(.rps(r))
            }
            let winner: FriendlySide? = pa == pb ? nil : rpsBeats(pa, pb) ? .a : .b
            if let w = winner { r.score[w] += 1 }
            r.picks = RpsPicks()
            r.rounds.append(RpsRound(a: pa, b: pb, winner: winner))
            return done(.rps(r))

        case (.ttt(var t), .ttt(let cell)):
            if cell < 0 || cell > 8 || t.board[cell] != nil { return .failure("Pick an empty tile") }
            var board = t.board
            board[cell] = by
            let line = tttLine(board)
            if line != nil || board.allSatisfy({ $0 != nil }) {
                let winner = line?.side
                if let w = winner { t.score[w] += 1 }
                let starter = t.starter.other
                t.board = Array(repeating: nil, count: 9)
                t.starter = starter
                t.turn = starter
                t.games.append(TttGame(winner: winner))
                return done(.ttt(t))
            }
            t.board = board
            t.turn = by.other
            return done(.ttt(t))

        case (.coin(var c), .coin(let call)):
            let r = random()
            let flip: CoinFace = r < 0.5 ? .heads : .tails
            let winner: FriendlySide = flip == call ? by : by.other
            c.score[winner] += 1
            c.caller = c.caller.other
            c.rounds.append(CoinRound(caller: by, call: call, flip: flip, winner: winner))
            return done(.coin(c))

        case (.pass(var p), .pass(let raw)):
            let word = raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            if word.count != 5 || !word.allSatisfy({ $0.isASCII && $0.isUppercase }) { return .failure("Five letters, please") }
            if let check = isValidWord, !check(word) { return .failure("Not in the word list") }
            if p.guesses.contains(where: { $0.word == word }) { return .failure("Already guessed") }
            guard let solution, solution.count == 5 else { return .failure("No puzzle") }
            let tiles = evaluateGuess(solution: solution, guess: word).tiles.map { $0.state.rawValue }
            let solved = word == solution.uppercased()
            p.turn = by.other
            p.guesses.append(PassGuess(by: by, word: word, tiles: tiles))
            p.solvedBy = solved ? by : nil
            return done(.pass(p))

        default:
            return .failure("Bad move")
        }
    }

    // MARK: Words every client shows (parity)

    private static func ago(_ m: Int) -> String {
        if m < 1 { return "just now" }
        if m < 60 { return "\(m) min ago" }
        if m < 60 * 24 { return "\(m / 60) h ago" }
        return "\(m / 1440) d ago"
    }

    /// The one-line status on a game card: "Your move · Doug moved 4 min ago", "You won 2–1".
    public static func friendlyCardLine(state s: FriendlyState, me: FriendlySide, them: String, minutesAgo: Int) -> String {
        let w = friendlyWinner(s)
        let mine = s.score?[me] ?? 0
        let theirs = s.score?[me.other] ?? 0
        if let w {
            if case .pass = s {
                return w == .draw ? "Nobody solved it" : w.rawValue == me.rawValue ? "You solved it" : "\(them) solved it"
            }
            if w == .draw { return "Draw \(mine)–\(theirs)" }
            return w.rawValue == me.rawValue ? "You won \(mine)–\(theirs)" : "\(them) won \(theirs)–\(mine)"
        }
        let t = whoseTurn(s)
        let myTurn = t == .both || t?.rawValue == me.rawValue
        switch s {
        case .rps(let r):
            let round = r.rounds.count + 1
            return myTurn ? "Round \(round) · your pick" : "Round \(round) · waiting on \(them)"
        case .pass(let p):
            let used = p.guesses.count
            return myTurn ? "Your guess · \(used) of \(passMaxGuesses) used" : "\(them)'s guess · \(used) of \(passMaxGuesses) used"
        case .coin:
            return myTurn ? "Your call · \(mine)–\(theirs)" : "\(them) calls next · \(mine)–\(theirs)"
        case .ttt:
            return myTurn ? "Your move · \(them) moved \(ago(minutesAgo))" : "Waiting on \(them) · \(mine)–\(theirs)"
        }
    }

    /// The big headline on the game screen: "ROUND 2", "YOUR MOVE", "YOU WIN!".
    public static func friendlyHeadline(_ s: FriendlyState, me: FriendlySide) -> String {
        if let w = friendlyWinner(s) {
            if w == .draw {
                if case .pass = s { return "NOBODY SOLVED IT" }
                return "IT'S A DRAW"
            }
            return w.rawValue == me.rawValue ? "YOU WIN!" : "THEY WIN"
        }
        let t = whoseTurn(s)
        let myTurn = t == .both || t?.rawValue == me.rawValue
        switch s {
        case .rps(let r): return "ROUND \(r.rounds.count + 1)"
        case .ttt: return myTurn ? "YOUR MOVE" : "THEIR MOVE"
        case .coin(let c): return "ROUND \(c.rounds.count + 1) OF 5"
        case .pass(let p):
            return myTurn ? "YOUR GUESS · \(p.guesses.count + 1) OF \(passMaxGuesses)" : "THEIR GUESS · \(p.guesses.count + 1) OF \(passMaxGuesses)"
        }
    }

    // MARK: Presence, friend streaks, the Friends banner

    public static func isOnline(lastSeenMs: Int?, nowMs: Int) -> Bool {
        guard let last = lastSeenMs else { return false }
        return nowMs - last < onlineWindowMs && nowMs - last > -onlineWindowMs
    }

    /// A friend row's presence line: "On now · in Muddle", "On now", "Here 12 min ago", or nil (older than a day).
    public static func presenceLine(lastSeenMs: Int?, activity: String?, nowMs: Int) -> String? {
        guard let last = lastSeenMs else { return nil }
        if isOnline(lastSeenMs: last, nowMs: nowMs) {
            if let a = activity, !a.isEmpty { return "On now · in \(a)" }
            return "On now"
        }
        let m = Int((Double(nowMs - last) / 60000).rounded(.down))
        if m < 60 { return "Here \(m) min ago" }
        if m < 60 * 24 { return "Here \(Int((Double(m) / 60).rounded(.down))) h ago" }
        return nil
    }

    /// Days in a row BOTH players finished at least one daily, ending today (or
    /// yesterday while today is still open for either of them).
    public static func friendStreak<A: Sequence, B: Sequence>(_ myDays: A, _ theirDays: B, today: String) -> Int
    where A.Element == String, B.Element == String {
        let mine = Set(myDays)
        let both = Set(theirDays.filter { mine.contains($0) })
        let yesterday = HomeBanner.shiftDay(today, -1)
        var cursor: String? = both.contains(today) ? today : both.contains(yesterday) ? yesterday : nil
        var n = 0
        while let c = cursor, both.contains(c) {
            n += 1
            cursor = HomeBanner.shiftDay(c, -1)
        }
        return n
    }

    private static func ord(_ n: Int) -> String {
        let v = n % 100
        let suffix: String
        if v >= 11 && v <= 13 { suffix = "TH" }
        else if n % 10 == 1 { suffix = "ST" }
        else if n % 10 == 2 { suffix = "ND" }
        else if n % 10 == 3 { suffix = "RD" }
        else { suffix = "TH" }
        return "\(n)\(suffix)"
    }

    /// toLocaleString('en-US') for an integer: comma thousands.
    public static func commas(_ n: Int) -> String {
        let digits = String(n.magnitude)
        var out = ""
        for (i, ch) in digits.enumerated() {
            if i > 0 && (digits.count - i) % 3 == 0 { out.append(",") }
            out.append(ch)
        }
        return n < 0 ? "-" + out : out
    }

    private static func upper(_ s: String) -> String {
        s.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }

    /// The Friends banner headline, always upper case.
    public static func friendsBannerHeadline(_ i: FriendsBannerInput) -> String {
        if i.friendCount == 0 { return "BRING YOUR FRIENDS" }
        if i.online.count == 1 { return "\(upper(i.online[0])) IS ON NOW" }
        if i.online.count > 1 { return "\(i.online.count) FRIENDS ON NOW" }
        if i.myRank == 1 && i.myPoints > 0 { return "YOU LEAD TODAY’S RACE!" }
        if i.leaderPoints > 0 { return "\(upper(i.leaderName)) LEADS TODAY’S RACE" }
        return "QUIET IN HERE · START A GAME"
    }

    /// The line under it. `clock` counts down to local midnight.
    public static func friendsBannerClockLine(_ i: FriendsBannerInput, clock: String) -> String {
        if i.friendCount == 0 { return "ADD A FRIEND TO RACE, PLAY AND TRADE STREAKS" }
        if i.leaderPoints <= 0 && i.myPoints <= 0 { return "TODAY’S RACE IS OPEN · ENDS IN \(clock)" }
        if i.myRank == 1 { return "YOU LEAD BY \(commas(max(0, i.myPoints - i.nextPoints))) · ENDS IN \(clock)" }
        return "TODAY’S RACE ENDS IN \(clock) · YOU’RE \(ord(i.myRank)), \(commas(i.leaderPoints - i.myPoints)) BEHIND"
    }
}
