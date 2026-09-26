import Foundation

// Hubbub — seven-letter hub game (More Games §12). 1:1 port of
// packages/core/src/games/hub.ts; pinned by hub-fixtures.json (HubFixtureTests).
// Words of 4+ letters using only the seven letters and containing the centre;
// 4 letters = 1 point, else length, pangram +7; EVERY accepted word scores (founder 2026-09-25), max = core list. Ranks by
// integer maths (points*100 >= pct*max); Hubbub (50%) = solved. Play continues
// after the win; End finalises a loss when below Hubbub. Event sigils + = ? ! #

public let HUB_DAILY_EPOCH = "2026-09-23"
public let HUB_LETTERS = 7
public let HUB_MIN_WORD = 4
public let HUB_TOTAL_BOARDS = 20
public let HUB_SOLVED_RANK = 6
public let HUB_RANKS: [(name: String, pct: Int)] = [
    ("Hush", 0), ("Murmur", 5), ("Chatter", 12), ("Banter", 20), ("Clamor", 30), ("Racket", 40),
    ("Hubbub", 50), ("Uproar", 70), ("Thunder", 85), ("Pandemonium", 100),
]

public struct HubPuzzle: Codable, Equatable {
    public let id: String
    public let letters: String
    public let words: [String]
    public let bonus: [String]
    public let pangrams: [String]
    public let max: Int
    public init(id: String, letters: String, words: [String], bonus: [String], pangrams: [String], max: Int) {
        self.id = id; self.letters = letters; self.words = words; self.bonus = bonus; self.pangrams = pangrams; self.max = max
    }
}

public struct HubBank: Codable {
    public let version: Int
    public let epoch: String
    public let daily: [HubPuzzle]
    public let extra: [HubPuzzle]
    public init(version: Int, epoch: String, daily: [HubPuzzle], extra: [HubPuzzle]) { self.version = version; self.epoch = epoch; self.daily = daily; self.extra = extra }
    public static func load(from data: Data) -> HubBank? { try? JSONDecoder().decode(HubBank.self, from: data) }
}

public func hubPuzzleForDay(_ bank: HubBank, day: String) -> HubPuzzle? {
    guard !bank.daily.isEmpty else { return nil }
    return bank.daily[Bank.indexForDay(day, n: bank.daily.count, epoch: bank.epoch)]
}
public func hubPuzzleForSeed(_ bank: HubBank, seed: String) -> HubPuzzle? {
    let pool = bank.extra.isEmpty ? bank.daily : bank.extra
    guard !pool.isEmpty else { return nil }
    return pool[Bank.indexForSeed(seed, n: pool.count)]
}
public func hubDailyNumber(_ day: String) -> Int {
    guard let idx = Bank.dayIndex(day, epoch: HUB_DAILY_EPOCH) else { return 1 }
    return max(1, idx + 1)
}

// MARK: - Scoring

public func hubIsPangram(_ word: String, letters: String) -> Bool { letters.allSatisfy { word.contains($0) } }
public func hubWordScore(_ word: String, letters: String) -> Int { (word.count == 4 ? 1 : word.count) + (hubIsPangram(word, letters: letters) ? 7 : 0) }
public func hubRankIndex(points: Int, max: Int) -> Int {
    guard max > 0 else { return 0 }
    var i = 0
    for k in 0..<HUB_RANKS.count where points * 100 >= HUB_RANKS[k].pct * max { i = k }
    return i
}
public func hubRankThreshold(_ rank: Int, max: Int) -> Int { Int((Double(HUB_RANKS[rank].pct * max) / 100).rounded(.up)) }
public func hubGuessCount(_ rankIndex: Int) -> Int { HUB_RANKS.count - rankIndex }
public func hubBoardsSolved(points: Int, max: Int) -> Int { max > 0 ? min(HUB_TOTAL_BOARDS, (points * HUB_TOTAL_BOARDS) / max) : 0 }
public func hubStartsWithToken(_ word: String) -> String { "\(word.prefix(2))\(word.count)" }

// MARK: - Reducer

public enum HubStatus: String, Codable { case playing, won, lost }
public enum HubReject: String, Codable { case ended, short, centre, letters, found, notword }

public struct HubState: Codable, Equatable {
    public let seed: String
    public let id: String
    public let letters: String
    public let words: [String]
    public let bonus: [String]
    public let pangrams: [String]
    public let max: Int
    public var found: [String]
    public var bonusFound: [String]
    public var revealed: [String]
    public var hinted: [String]
    public var points: Int
    public var hintsUsed: Int
    public var events: [String]
    public var status: HubStatus
    public var ended: Bool
    public var reject: HubReject?
    public var startTime: Double
    public var endTime: Double?

    public init(puzzle p: HubPuzzle, seed: String, startTime: Double) {
        self.seed = seed; id = p.id; letters = p.letters; words = p.words; bonus = p.bonus; pangrams = p.pangrams; max = p.max
        found = []; bonusFound = []; revealed = []; hinted = []; points = 0; hintsUsed = 0; events = []
        status = .playing; ended = false; reject = nil; self.startTime = startTime; endTime = nil
    }

    public var centre: Character { letters.first! }
    public var rank: Int { hubRankIndex(points: points, max: max) }
    public var rankName: String { HUB_RANKS[rank].name }
    public var guessCount: Int { hubGuessCount(rank) }
    public var boardsSolved: Int { hubBoardsSolved(points: points, max: max) }
    public func nextUnfound(skipHinted: Bool = false) -> String? { words.first { !found.contains($0) && (!skipHinted || !hinted.contains($0)) } }
}

public enum HubAction: Equatable {
    case submit(String)
    case hintStart
    case hintReveal
    case end
    case finish
}

private func settle(_ s: HubState, _ now: Double) -> HubState {
    if s.status == .playing && s.rank >= HUB_SOLVED_RANK { var n = s; n.status = .won; n.endTime = now; return n }
    return s
}

public func hubReduce(_ s: HubState, _ a: HubAction, now: Double = 0) -> HubState {
    if case .finish = a { if s.status == .playing { return s }; var n = s; n.endTime = s.endTime ?? now; return n }
    if s.ended { if case .submit = a { var n = s; n.reject = .ended; return n }; return s }
    switch a {
    case .submit(let raw):
        let word = raw.uppercased()
        var n = s
        if word.count < HUB_MIN_WORD { n.reject = .short; return n }
        if !word.contains(s.centre) { n.reject = .centre; return n }
        for ch in word where !s.letters.contains(ch) { n.reject = .letters; return n }
        if s.found.contains(word) || s.bonusFound.contains(word) { n.reject = .found; return n }
        if s.words.contains(word) {
            n.found.append(word); n.points += hubWordScore(word, letters: s.letters); n.events.append("+\(word)"); n.reject = nil
            return settle(n, now)
        }
        // Founder (2026-09-25): every accepted word scores; "=" keeps marking the rarer ones.
        if s.bonus.contains(word) {
            n.bonusFound.append(word); n.points += hubWordScore(word, letters: s.letters); n.events.append("=\(word)"); n.reject = nil
            return settle(n, now)
        }
        n.reject = .notword
        return n
    case .hintStart:
        var n = s; n.reject = nil
        guard let target = s.nextUnfound(skipHinted: true) else { return n }
        n.hinted.append(target); n.hintsUsed += 1; n.events.append("?\(hubStartsWithToken(target))")
        return n
    case .hintReveal:
        var n = s; n.reject = nil
        guard let target = s.nextUnfound() else { return n }
        n.found.append(target); n.revealed.append(target); n.points += hubWordScore(target, letters: s.letters); n.hintsUsed += 2; n.events.append("!\(target)")
        return settle(n, now)
    case .end:
        var n = s; n.ended = true; n.events.append("#"); n.reject = nil
        if n.status == .playing { n.status = .lost; n.endTime = now }
        return n
    case .finish:
        return s
    }
}

// MARK: - Matches row ↔ state

public func hubMatchRow(_ s: HubState) -> (solutions: [String], guesses: [String]) {
    ([s.id, s.letters, "\(s.max)", "\(s.words.count)", "\(s.pangrams.count)"], s.events)
}

public struct HubReconstruction: Equatable {
    public let id: String, letters: String, max: Int, wordCount: Int, pangramCount: Int
    public let found: [String], bonusFound: [String], revealed: [String], hints: [String]
    public let points: Int, hintsUsed: Int, rank: Int, rankName: String, ended: Bool, solved: Bool
}

public func reconstructHub(solutions: [String], guesses: [String]) -> HubReconstruction? {
    guard solutions.count >= 3 else { return nil }
    let letters = solutions[1]
    guard letters.count == 7, letters.allSatisfy({ ("A"..."Z").contains($0) }), let max = Int(solutions[2]), max > 0 else { return nil }
    var found: [String] = [], bonusFound: [String] = [], revealed: [String] = [], hints: [String] = []
    var points = 0, hintsUsed = 0, ended = false
    let isWord = { (w: String) in w.count >= 4 && w.allSatisfy { ("A"..."Z").contains($0) } }
    for ev in guesses {
        if ev == "#" { ended = true; continue }
        guard let sigil = ev.first else { continue }
        let rest = String(ev.dropFirst())
        if (sigil == "+" || sigil == "!") && isWord(rest) && !found.contains(rest) {
            found.append(rest); points += hubWordScore(rest, letters: letters)
            if sigil == "!" { revealed.append(rest); hintsUsed += 2 }
        } else if sigil == "=" && isWord(rest) && !bonusFound.contains(rest) { bonusFound.append(rest); points += hubWordScore(rest, letters: letters) }
        else if sigil == "?" { hints.append(rest); hintsUsed += 1 }
    }
    let rank = hubRankIndex(points: points, max: max)
    return HubReconstruction(id: solutions[0], letters: letters, max: max, wordCount: solutions.count > 3 ? Int(solutions[3]) ?? 0 : 0,
                             pangramCount: solutions.count > 4 ? Int(solutions[4]) ?? 0 : 0, found: found, bonusFound: bonusFound,
                             revealed: revealed, hints: hints, points: points, hintsUsed: hintsUsed, rank: rank,
                             rankName: HUB_RANKS[rank].name, ended: ended, solved: rank >= HUB_SOLVED_RANK)
}
