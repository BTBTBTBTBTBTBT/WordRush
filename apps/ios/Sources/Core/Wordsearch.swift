import Foundation

// Spyglass — themed word search (More Games §17). 1:1 port of
// packages/core/src/games/wordsearch.ts; pinned by wordsearch-fixtures.json
// (WordsearchFixtureTests). A selection is a straight line in any of the
// eight directions; it finds a word when its letters spell a list word
// forwards or backwards; a miss is a straight line of ≥ 4 cells spelling no
// list word. guess_count = min(10 + misses, 15). Event sigils: + x ? !

public let WORDSEARCH_DAILY_EPOCH = "2026-09-23"
public let WORDSEARCH_N = 10
public let WORDSEARCH_WORDS = 10
public let WORDSEARCH_MAX_MISSES = 5
public let WORDSEARCH_MIN_MISS_LENGTH = 4

public let WORDSEARCH_DIRS: [String: (Int, Int)] = [
    "E": (0, 1), "S": (1, 0), "SE": (1, 1), "NE": (-1, 1), "W": (0, -1), "N": (-1, 0), "NW": (-1, -1), "SW": (1, -1),
]

public struct WordsearchPlacement: Codable, Equatable {
    public let w: String
    public let r: Int
    public let c: Int
    public let d: String
    public init(w: String, r: Int, c: Int, d: String) { self.w = w; self.r = r; self.c = c; self.d = d }
}

public struct WordsearchPuzzle: Codable, Equatable {
    public let id: String
    public let theme: String
    public let family: String
    public let title: String
    public let grid: String
    public let words: [WordsearchPlacement]
    public init(id: String, theme: String, family: String, title: String, grid: String, words: [WordsearchPlacement]) {
        self.id = id; self.theme = theme; self.family = family; self.title = title; self.grid = grid; self.words = words
    }
}

public struct WordsearchBank: Codable {
    public let version: Int
    public let epoch: String
    public let daily: [WordsearchPuzzle]
    public let extra: [WordsearchPuzzle]
    public init(version: Int, epoch: String, daily: [WordsearchPuzzle], extra: [WordsearchPuzzle]) {
        self.version = version; self.epoch = epoch; self.daily = daily; self.extra = extra
    }
    public static func load(from data: Data) -> WordsearchBank? { try? JSONDecoder().decode(WordsearchBank.self, from: data) }
}

public func wordsearchPuzzleForDay(_ bank: WordsearchBank, day: String) -> WordsearchPuzzle? {
    guard !bank.daily.isEmpty else { return nil }
    return bank.daily[Bank.indexForDay(day, n: bank.daily.count, epoch: bank.epoch)]
}

public func wordsearchPuzzleForSeed(_ bank: WordsearchBank, seed: String) -> WordsearchPuzzle? {
    let pool = bank.extra.isEmpty ? bank.daily : bank.extra
    guard !pool.isEmpty else { return nil }
    return pool[Bank.indexForSeed(seed, n: pool.count)]
}

public func wordsearchDailyNumber(_ day: String) -> Int {
    guard let idx = Bank.dayIndex(day, epoch: WORDSEARCH_DAILY_EPOCH) else { return 1 }
    return max(1, idx + 1)
}

// MARK: - Geometry

public func wordsearchCells(_ n: Int, _ p: WordsearchPlacement) -> [Int] {
    let (dr, dc) = WORDSEARCH_DIRS[p.d] ?? (0, 1)
    return (0..<p.w.count).map { k in (p.r + dr * k) * n + (p.c + dc * k) }
}

public func wordsearchLine(_ n: Int, from: Int, to: Int) -> [Int]? {
    guard from >= 0, to >= 0, from < n * n, to < n * n else { return nil }
    let r0 = from / n, c0 = from % n, r1 = to / n, c1 = to % n
    let dr = (r1 - r0).signum(), dc = (c1 - c0).signum()
    let len = max(abs(r1 - r0), abs(c1 - c0)) + 1
    if dr != 0 && dc != 0 && abs(r1 - r0) != abs(c1 - c0) { return nil }
    return (0..<len).map { k in (r0 + dr * k) * n + (c0 + dc * k) }
}

// MARK: - Reducer

public enum WordsearchStatus: String, Codable { case playing, won, lost }

public struct WordsearchState: Codable, Equatable {
    public let seed: String
    public let id: String
    public let title: String
    public let n: Int
    public let grid: String
    public let words: [WordsearchPlacement]
    public var found: [String]
    public var misses: Int
    public var hintsUsed: Int
    public var hinted: [String]
    public var events: [String]
    public var status: WordsearchStatus
    public var startTime: Double
    public var endTime: Double?

    public init(puzzle: WordsearchPuzzle, seed: String, startTime: Double) {
        self.seed = seed; id = puzzle.id; title = puzzle.title; n = WORDSEARCH_N; grid = puzzle.grid; words = puzzle.words
        found = []; misses = 0; hintsUsed = 0; hinted = []; events = []; status = .playing; self.startTime = startTime; endTime = nil
    }

    /// guess_count for the result row: 10 clean, +1 per miss, capped at 15.
    public var guessCount: Int { min(WORDSEARCH_WORDS + WORDSEARCH_MAX_MISSES, WORDSEARCH_WORDS + max(0, misses)) }
    /// The Hint target: the first unfound, un-pulsed word (else the first unfound).
    public var nextUnfound: WordsearchPlacement? {
        words.first { !found.contains($0.w) && !hinted.contains($0.w) } ?? words.first { !found.contains($0.w) }
    }
}

public enum WordsearchAction: Equatable {
    case select(from: Int, to: Int)
    case hint
    case reveal
    case finish
}

public func wordsearchReduce(_ s: WordsearchState, _ a: WordsearchAction, now: Double = 0) -> WordsearchState {
    if case .finish = a { if s.status == .playing { return s }; var n = s; n.endTime = s.endTime ?? now; return n }
    guard s.status == .playing else { return s }
    switch a {
    case .select(let from, let to):
        guard let line = wordsearchLine(s.n, from: from, to: to) else { return s }
        let chars = Array(s.grid)
        let letters = String(line.map { chars[$0] })
        let reversed = String(letters.reversed())
        if let hit = s.words.first(where: { $0.w == letters || $0.w == reversed }) {
            if s.found.contains(hit.w) { return s }
            var n = s
            n.found.append(hit.w); n.events.append("+\(hit.w)")
            if n.found.count == s.words.count { n.status = .won; n.endTime = now }
            return n
        }
        if line.count < WORDSEARCH_MIN_MISS_LENGTH { return s }
        var n = s
        n.misses += 1
        n.events.append("x \(from / s.n),\(from % s.n)>\(to / s.n),\(to % s.n)")
        return n
    case .hint:
        guard let target = s.words.first(where: { !s.found.contains($0.w) && !s.hinted.contains($0.w) }) else { return s }
        var n = s
        n.hinted.append(target.w); n.hintsUsed += 1; n.events.append("?\(target.w)")
        return n
    case .reveal:
        var n = s
        n.status = .lost; n.endTime = now; n.events.append("!")
        return n
    case .finish:
        return s
    }
}

// MARK: - Matches row ↔ state

public func wordsearchMatchRow(_ s: WordsearchState) -> (solutions: [String], guesses: [String]) {
    (["g:\(s.grid)", "t:\(s.title)"] + s.words.map { "\($0.w)@\($0.r),\($0.c),\($0.d)" }, s.events)
}

public struct WordsearchReconstruction: Equatable {
    public let grid: String, title: String, words: [WordsearchPlacement]
    public let found: [String], misses: Int, hintsUsed: Int, revealed: Bool, solved: Bool
}

private let placementRe = try! NSRegularExpression(pattern: "^([A-Z]{2,})@(\\d+),(\\d+),(NE|NW|SE|SW|N|S|E|W)$")

public func reconstructWordsearch(solutions: [String], guesses: [String]) -> WordsearchReconstruction? {
    guard solutions.count >= 3, solutions[0].hasPrefix("g:"), solutions[1].hasPrefix("t:") else { return nil }
    let grid = String(solutions[0].dropFirst(2))
    guard grid.count == WORDSEARCH_N * WORDSEARCH_N, grid.allSatisfy({ ("A"..."Z").contains($0) }) else { return nil }
    var words: [WordsearchPlacement] = []
    for field in solutions.dropFirst(2) {
        let ns = field as NSString
        guard let m = placementRe.firstMatch(in: field, range: NSRange(location: 0, length: ns.length)) else { continue }
        words.append(WordsearchPlacement(w: ns.substring(with: m.range(at: 1)), r: Int(ns.substring(with: m.range(at: 2)))!,
                                         c: Int(ns.substring(with: m.range(at: 3)))!, d: ns.substring(with: m.range(at: 4))))
    }
    guard !words.isEmpty else { return nil }
    var found: [String] = [], misses = 0, hintsUsed = 0, revealed = false
    for ev in guesses {
        if ev == "!" { revealed = true; continue }
        guard let sigil = ev.first else { continue }
        let rest = String(ev.dropFirst())
        if sigil == "+", words.contains(where: { $0.w == rest }), !found.contains(rest) { found.append(rest) }
        else if sigil == "x" { misses += 1 }
        else if sigil == "?" { hintsUsed += 1 }
    }
    return WordsearchReconstruction(grid: grid, title: String(solutions[1].dropFirst(2)), words: words, found: found,
                                    misses: misses, hintsUsed: hintsUsed, revealed: revealed, solved: found.count == words.count)
}
