import Foundation

// Letter Ladder — word ladder (More Games §15). 1:1 port of
// packages/core/src/games/ladder.ts; pinned by ladder-fixtures.json
// (LadderFixtureTests). Change one letter at a time from START to END; every
// rung must be a legal 5-letter guess. Rejected entries are free; every
// accepted word is a move; the budget is par + 5; Undo is free but spent
// moves stay spent; a Hint places the next rung on a shortest path (BFS over
// the allowed list, alphabetical tie-break) and counts as a move.
// guess_count = moves − par + 1. Event strings carry §11 sigils (+ - ?).

public let LADDER_DAILY_EPOCH = "2026-09-23"
public let LADDER_EXTRA_MOVES = 5
public let LADDER_WORD_LENGTH = 5

public struct LadderPuzzle: Codable, Equatable {
    public let id: String
    public let start: String
    public let end: String
    public let par: Int
    public let path: [String]
}

public struct LadderBank: Codable {
    public let version: Int
    public let epoch: String
    public let daily: [LadderPuzzle]
    public let extra: [LadderPuzzle]

    public static func load(from data: Data) -> LadderBank? { try? JSONDecoder().decode(LadderBank.self, from: data) }
}

/// The daily puzzle for `day` (yyyy-MM-dd), epoch-indexed; nil for an empty bank.
public func ladderPuzzleForDay(_ bank: LadderBank, day: String) -> LadderPuzzle? {
    guard !bank.daily.isEmpty else { return nil }
    return bank.daily[Bank.indexForDay(day, n: bank.daily.count, epoch: bank.epoch)]
}

/// The Unlimited puzzle for a seed, drawn from `extra` so it can never spoil a daily.
public func ladderPuzzleForSeed(_ bank: LadderBank, seed: String) -> LadderPuzzle? {
    let pool = bank.extra.isEmpty ? bank.daily : bank.extra
    guard !pool.isEmpty else { return nil }
    return pool[Bank.indexForSeed(seed, n: pool.count)]
}

/// "#N" for the daily on `day`; 1 on the epoch day, never below 1.
public func ladderDailyNumber(_ day: String) -> Int {
    guard let idx = Bank.dayIndex(day, epoch: LADDER_DAILY_EPOCH) else { return 1 }
    return max(1, idx + 1)
}

// MARK: - Word graph helpers

private let LETTERS: [Character] = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

/// True when a and b are the same length and differ in exactly one position.
public func ladderOneLetterApart(_ a: String, _ b: String) -> Bool {
    guard a.count == b.count else { return false }
    var diff = 0
    for (x, y) in zip(a, b) where x != y { diff += 1; if diff > 1 { return false } }
    return diff == 1
}

/// Every word in `allowed` one letter away from `w`, alphabetical.
public func ladderNeighbours(_ w: String, allowed: Set<String>) -> [String] {
    var out: [String] = []
    let chars = Array(w)
    for i in 0..<chars.count {
        for ch in LETTERS where ch != chars[i] {
            var c = chars; c[i] = ch
            let cand = String(c)
            if allowed.contains(cand) { out.append(cand) }
        }
    }
    return out.sorted()
}

/// The next rung on a shortest path from `current` to `end` over `allowed`,
/// never stepping onto a word in `avoid`. BFS from `end`; among current's
/// neighbours one step closer, the alphabetically first. Nil when no route.
public func ladderNextStep(_ current: String, end: String, allowed: Set<String>, avoid: Set<String> = []) -> String? {
    if current == end { return nil }
    if ladderOneLetterApart(current, end) { return end }
    var usable = Set<String>()
    for w in allowed where !avoid.contains(w) || w == end { usable.insert(w) }
    usable.insert(end)
    var dist: [String: Int] = [end: 0]
    var frontier = [end]
    while !frontier.isEmpty && dist[current] == nil {
        var next: [String] = []
        for u in frontier {
            let du = dist[u]!
            for v in ladderNeighbours(u, allowed: usable) where dist[v] == nil { dist[v] = du + 1; next.append(v) }
            if ladderOneLetterApart(u, current) && dist[current] == nil { dist[current] = du + 1 }
        }
        frontier = next
    }
    guard let dc = dist[current] else { return nil }
    return ladderNeighbours(current, allowed: usable).first { dist[$0] == dc - 1 }
}

// MARK: - Reducer

public enum LadderStatus: String, Codable { case playing, won, lost }
public enum LadderReject: String, Codable { case finished, length, notOneLetter = "not-one-letter", revisit, notWord = "not-word" }

public struct LadderState: Codable, Equatable {
    public let seed: String
    public let id: String
    public let start: String
    public let end: String
    public let par: Int
    public let path: [String]
    public var words: [String]
    public var hintMask: String
    public var moves: Int
    public var hintsUsed: Int
    public var events: [String]
    public var status: LadderStatus
    public var reject: LadderReject?
    public var startTime: Double
    public var endTime: Double?

    public init(puzzle: LadderPuzzle, seed: String, startTime: Double) {
        self.seed = seed; id = puzzle.id; start = puzzle.start; end = puzzle.end; par = puzzle.par; path = puzzle.path
        words = [puzzle.start]; hintMask = "0"; moves = 0; hintsUsed = 0; events = []
        status = .playing; reject = nil; self.startTime = startTime; endTime = nil
    }

    public var current: String { words[words.count - 1] }
    public var maxMoves: Int { par + LADDER_EXTRA_MOVES }
    /// guess_count for the result row: par reads as 1, one over par as 2. Never below 1.
    public var guessCount: Int { max(1, moves - par + 1) }
}

public enum LadderAction: Equatable {
    case submit(String)
    case undo
    case hint
    case finish
}

private func settle(_ s: LadderState, _ now: Double) -> LadderState {
    guard s.status == .playing else { return s }
    var n = s
    if s.current == s.end { n.status = .won; n.endTime = now; return n }
    if s.moves >= s.maxMoves { n.status = .lost; n.endTime = now; return n }
    return s
}

private func accept(_ s: LadderState, _ word: String, viaHint: Bool, _ now: Double) -> LadderState {
    var n = s
    n.words.append(word)
    n.hintMask += viaHint ? "1" : "0"
    n.moves += 1
    if viaHint { n.hintsUsed += 1 }
    n.events.append((viaHint ? "?" : "+") + word)
    n.reject = nil
    return settle(n, now)
}

private func nextOnCanonicalPath(_ s: LadderState) -> String? {
    guard let i = s.path.firstIndex(of: s.current), i + 1 < s.path.count else { return nil }
    let next = s.path[i + 1]
    return s.words.contains(next) ? nil : next
}

private let upperFive = try! NSRegularExpression(pattern: "^[A-Z]{5}$")
private func isFiveLetters(_ w: String) -> Bool {
    upperFive.firstMatch(in: w, range: NSRange(w.startIndex..., in: w)) != nil
}

/// Pure reducer; `allowed` is the uppercase 5-letter guess list; `now` stamps endTime.
public func ladderReduce(_ s: LadderState, _ a: LadderAction, allowed: Set<String>, now: Double = 0) -> LadderState {
    if case .finish = a { if s.status == .playing { return s }; var n = s; n.endTime = s.endTime ?? now; return n }
    guard s.status == .playing else {
        if case .submit = a { var n = s; n.reject = .finished; return n }
        return s
    }
    switch a {
    case .submit(let raw):
        let word = raw.uppercased()
        var n = s
        if word.count != LADDER_WORD_LENGTH || !isFiveLetters(word) { n.reject = .length; return n }
        if !ladderOneLetterApart(s.current, word) { n.reject = .notOneLetter; return n }
        if s.words.contains(word) { n.reject = .revisit; return n }
        if word != s.end && !allowed.contains(word) { n.reject = .notWord; return n }
        return accept(s, word, viaHint: false, now)
    case .undo:
        var n = s; n.reject = nil
        guard s.words.count > 1 else { return n }
        n.words.removeLast(); n.hintMask.removeLast(); n.events.append("-")
        return n
    case .hint:
        let next = ladderNextStep(s.current, end: s.end, allowed: allowed, avoid: Set(s.words)) ?? nextOnCanonicalPath(s)
        guard let next else { var n = s; n.reject = nil; return n }
        return accept(s, next, viaHint: true, now)
    case .finish:
        return s
    }
}

// MARK: - Matches row ↔ state

/// What we store: solutions = [START, END, "par:N", "path:A,B,C"]; guesses = the event log.
public func ladderMatchRow(_ s: LadderState) -> (solutions: [String], guesses: [String]) {
    ([s.start, s.end, "par:\(s.par)", "path:\(s.path.joined(separator: ","))"], s.events)
}

public struct LadderReconstruction: Equatable {
    public let start: String, end: String, par: Int, path: [String]
    public let words: [String], hintMask: String, moves: Int, hintsUsed: Int, solved: Bool
}

/// Replay a matches row into the finished ladder, or nil if malformed.
public func reconstructLadder(solutions: [String], guesses: [String]) -> LadderReconstruction? {
    guard solutions.count >= 3 else { return nil }
    let start = solutions[0], end = solutions[1]
    guard isFiveLetters(start), isFiveLetters(end) else { return nil }
    let parField = solutions[2]
    guard let par = Int(parField.hasPrefix("par:") ? String(parField.dropFirst(4)) : parField), par >= 1 else { return nil }
    let pathField = solutions.count > 3 ? solutions[3] : ""
    let path = pathField.hasPrefix("path:") && pathField.count > 5 ? String(pathField.dropFirst(5)).split(separator: ",").map(String.init) : [start, end]
    var words = [start], hintMask = "0", moves = 0, hintsUsed = 0
    for ev in guesses {
        if ev == "-" { if words.count > 1 { words.removeLast(); hintMask.removeLast() }; continue }
        guard let sigil = ev.first, sigil == "+" || sigil == "?" else { continue }
        let word = String(ev.dropFirst())
        guard isFiveLetters(word) else { continue }
        words.append(word); hintMask += sigil == "?" ? "1" : "0"; moves += 1
        if sigil == "?" { hintsUsed += 1 }
    }
    return LadderReconstruction(start: start, end: end, par: par, path: path, words: words, hintMask: hintMask,
                                moves: moves, hintsUsed: hintsUsed, solved: words.last == end)
}
