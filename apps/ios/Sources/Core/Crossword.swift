import Foundation

// Crosswordocious — themed fill-in sayings crossword (More Games §13). 1:1 port
// of packages/core/src/games/crossword.ts; pinned by crossword-fixtures.json
// (CrosswordFixtureTests). A sparse criss-cross grid (10–13 entries, at most
// 10 × 11 cells) where every clue is a familiar phrase with one blank and the
// answer is the missing word; the title is the theme. Tap a cell or a clue,
// type; a fully correct grid wins.
//
// Costs: CHECK marks wrong letters (clears them), locks right ones, and counts
// — guess_count = min(checks, 98) + 1 against the CROSSWORD budget of 6, so no
// Check is perfect. Reveal a letter (1 hint), reveal a word (2 hints).
// "Reveal puzzle" is the only loss. Event sigils (§11): "=r,c:L" set, "-r,c"
// cleared, "#n" check with n wrong, "?r,c" letter revealed, "!nD" word
// revealed (entry number + direction), "!!" puzzle revealed.
//
// Banks (Resources/crossword-puzzles.json, sha-guarded to match the web copy)
// carry { daily, extra, holiday: { key: [...] } } and the daily on a holiday
// comes from that holiday's own grids (§20, holiday-days.json).

public let CROSSWORD_DAILY_EPOCH = "2026-09-23"
public let CROSSWORD_MAX_CHECKS = 98
public let CROSSWORD_TOTAL_BOARDS = 1
public let CROSSWORD_BLOCK: Character = "."
public let CROSSWORD_EMPTY: Character = "_"

public enum CrosswordDir: String, Codable, Equatable {
    case across = "A"
    case down = "D"
}

public struct CrosswordEntry: Codable, Equatable {
    public let n: Int
    public let dir: CrosswordDir
    public let r: Int
    public let c: Int
    public let answer: String
    public let clue: String
    public init(n: Int, dir: CrosswordDir, r: Int, c: Int, answer: String, clue: String) {
        self.n = n; self.dir = dir; self.r = r; self.c = c; self.answer = answer; self.clue = clue
    }
}

public struct CrosswordPuzzle: Decodable, Equatable {
    public let id: String
    public let title: String
    public let theme: String
    public let w: Int
    public let h: Int
    public let entries: [CrosswordEntry]
    public let holiday: String?
    public init(id: String, title: String, theme: String, w: Int, h: Int, entries: [CrosswordEntry], holiday: String? = nil) {
        self.id = id; self.title = title; self.theme = theme; self.w = w; self.h = h; self.entries = entries; self.holiday = holiday
    }
}

public struct CrosswordBank: Decodable {
    public let version: Int
    public let epoch: String
    public let daily: [CrosswordPuzzle]
    public let extra: [CrosswordPuzzle]
    public let holiday: [String: [CrosswordPuzzle]]?
    public init(version: Int, epoch: String, daily: [CrosswordPuzzle], extra: [CrosswordPuzzle], holiday: [String: [CrosswordPuzzle]]? = nil) {
        self.version = version; self.epoch = epoch; self.daily = daily; self.extra = extra; self.holiday = holiday
    }
    public static func load(from data: Data) -> CrosswordBank? { try? JSONDecoder().decode(CrosswordBank.self, from: data) }
    /// The app-bundled bank (Resources/crossword-puzzles.json — sha-guarded to match the web copy).
    public static let bundled: CrosswordBank? = {
        guard let url = Bundle.main.url(forResource: "crossword-puzzles", withExtension: "json"), let data = try? Data(contentsOf: url) else { return nil }
        return load(from: data)
    }()
}

// MARK: - Bank lookups

/// The daily puzzle for `day`: the holiday's own entry when the calendar names one, else epoch-indexed.
public func crosswordPuzzleForDay(_ bank: CrosswordBank, day: String, holidays: HolidayTable? = nil) -> CrosswordPuzzle? {
    if let pick = bankHolidayPick(day: day, table: holidays, holiday: bank.holiday) { return pick.entry }
    guard !bank.daily.isEmpty else { return nil }
    return bank.daily[Bank.indexForDay(day, n: bank.daily.count, epoch: bank.epoch)]
}
public func crosswordPuzzleForSeed(_ bank: CrosswordBank, seed: String) -> CrosswordPuzzle? {
    let pool = bank.extra.isEmpty ? bank.daily : bank.extra
    guard !pool.isEmpty else { return nil }
    return pool[Bank.indexForSeed(seed, n: pool.count)]
}
public func crosswordDailyNumber(_ day: String) -> Int {
    guard let idx = Bank.dayIndex(day, epoch: CROSSWORD_DAILY_EPOCH) else { return 1 }
    return max(1, idx + 1)
}

// MARK: - Layout

/// Anything with a grid width and entries — the TS helpers take `{ w, entries }` structurally, so both the puzzle and the state qualify.
public protocol CrosswordLayout {
    var w: Int { get }
    var entries: [CrosswordEntry] { get }
}
extension CrosswordPuzzle: CrosswordLayout {}

/// Row-major index of a cell.
public func crosswordIndex(w: Int, r: Int, c: Int) -> Int { r * w + c }
/// The cells an entry occupies, in reading order.
public func crosswordEntryCells(w: Int, _ e: CrosswordEntry) -> [Int] {
    var out: [Int] = []
    for k in 0..<e.answer.count {
        out.append(crosswordIndex(w: w, r: e.r + (e.dir == .down ? k : 0), c: e.c + (e.dir == .across ? k : 0)))
    }
    return out
}
public func crosswordEntryCells(_ p: CrosswordLayout, _ e: CrosswordEntry) -> [Int] { crosswordEntryCells(w: p.w, e) }
/// The solution grid: w*h characters, "." for a block, the letter otherwise.
public func crosswordSolution(_ p: CrosswordPuzzle) -> String {
    var cells = [Character](repeating: CROSSWORD_BLOCK, count: p.w * p.h)
    for e in p.entries {
        let letters = Array(e.answer)
        for (k, i) in crosswordEntryCells(p, e).enumerated() where i >= 0 && i < cells.count { cells[i] = letters[k] }
    }
    return String(cells)
}
/// Entries that pass through a cell (an across and/or a down).
public func crosswordEntriesAt(_ p: CrosswordLayout, cell: Int) -> [CrosswordEntry] {
    p.entries.filter { crosswordEntryCells(p, $0).contains(cell) }
}

// MARK: - Reducer

public enum CrosswordStatus: String, Codable { case playing, won, lost }

public struct CrosswordState: Codable, Equatable, CrosswordLayout {
    public let seed: String
    public let id: String
    public let title: String
    public let w: Int
    public let h: Int
    public let entries: [CrosswordEntry]
    public let solution: String
    /// w*h chars: "." block, "_" empty, else the pencilled letter.
    public var fill: String
    /// w*h chars: "1" locked (checked right / revealed), "0" free, "." block.
    public var locked: String
    /// w*h chars: "l" letter revealed, "w" word revealed, "p" puzzle revealed, "." otherwise.
    public var revealed: String
    public var checks: Int
    public var hintsUsed: Int
    /// Cells the last Check cleared (for the red flash).
    public var lastWrong: [Int]
    public var events: [String]
    public var status: CrosswordStatus
    public var ended: Bool
    public var startTime: Double
    public var endTime: Double?

    public init(puzzle p: CrosswordPuzzle, seed: String, startTime: Double) {
        let solution = crosswordSolution(p)
        func blank(_ open: Character) -> String { String(solution.map { $0 == CROSSWORD_BLOCK ? CROSSWORD_BLOCK : open }) }
        self.seed = seed; id = p.id; title = p.title; w = p.w; h = p.h; entries = p.entries; self.solution = solution
        fill = blank(CROSSWORD_EMPTY); locked = blank("0"); revealed = blank("."); checks = 0; hintsUsed = 0; lastWrong = []; events = []
        status = .playing; ended = false; self.startTime = startTime; endTime = nil
    }
}

public func createCrosswordState(_ p: CrosswordPuzzle, seed: String, startTime: Double) -> CrosswordState {
    CrosswordState(puzzle: p, seed: seed, startTime: startTime)
}

public enum CrosswordAction: Equatable {
    case set(cell: Int, letter: String)
    case clear(cell: Int)
    case check
    case revealLetter(cell: Int)
    case revealWord(n: Int, dir: CrosswordDir)
    case revealPuzzle
    case finish
}

public func crosswordIsSolved(fill: String, solution: String) -> Bool { fill == solution }
public func crosswordIsSolved(_ s: CrosswordState) -> Bool { crosswordIsSolved(fill: s.fill, solution: s.solution) }
/// Letter cells whose fill matches the solution (JS indexes `fill[i]` for every solution index; a shorter fill simply never matches there).
public func crosswordCorrectCount(fill: String, solution: String) -> Int {
    let f = Array(fill), sol = Array(solution)
    var n = 0
    for i in 0..<sol.count where sol[i] != CROSSWORD_BLOCK && i < f.count && f[i] == sol[i] { n += 1 }
    return n
}
public func crosswordCorrectCount(_ s: CrosswordState) -> Int { crosswordCorrectCount(fill: s.fill, solution: s.solution) }
public func crosswordLetterCount(solution: String) -> Int { solution.filter { $0 != CROSSWORD_BLOCK }.count }
public func crosswordLetterCount(_ s: CrosswordState) -> Int { crosswordLetterCount(solution: s.solution) }
public func crosswordGuessCount(_ checks: Int) -> Int { min(checks, CROSSWORD_MAX_CHECKS) + 1 }
/// True when every cell of the entry is filled correctly.
public func crosswordEntrySolved(_ s: CrosswordState, _ e: CrosswordEntry) -> Bool {
    let f = Array(s.fill), sol = Array(s.solution)
    return crosswordEntryCells(s, e).allSatisfy { i in i >= 0 && i < sol.count && i < f.count && f[i] == sol[i] }
}

private func cellOk(_ sol: [Character], _ cell: Int) -> Bool { cell >= 0 && cell < sol.count && sol[cell] != CROSSWORD_BLOCK }
private func rc(_ s: CrosswordState, _ cell: Int) -> String { "\(cell / s.w),\(cell % s.w)" }
/// JS `/^[A-Z]$/` after `toUpperCase()`: exactly one ASCII capital.
private func upperLetter(_ raw: String) -> Character? {
    let u = Array(raw.uppercased())
    guard u.count == 1, let ch = u.first, ch.isASCII, ch >= "A", ch <= "Z" else { return nil }
    return ch
}

private func settle(_ s: CrosswordState, now: Double) -> CrosswordState {
    if s.status == .playing && crosswordIsSolved(s) { var n = s; n.status = .won; n.ended = true; n.endTime = now; return n }
    return s
}
private func revealCells(_ s: CrosswordState, _ cells: [Int], mark: Character) -> CrosswordState {
    let sol = Array(s.solution)
    var fill = Array(s.fill), locked = Array(s.locked), revealed = Array(s.revealed)
    for i in cells {
        fill[i] = sol[i]
        locked[i] = "1"
        if revealed[i] == "." { revealed[i] = mark }
    }
    var n = s
    n.fill = String(fill); n.locked = String(locked); n.revealed = String(revealed)
    return n
}

public func crosswordReduce(_ s: CrosswordState, _ a: CrosswordAction, now: Double = 0) -> CrosswordState {
    if case .finish = a { if s.status == .playing { return s }; var n = s; n.endTime = s.endTime ?? now; return n }
    if s.ended { return s }

    let sol = Array(s.solution)
    switch a {
    case .set(let cell, let rawLetter):
        var fill = Array(s.fill)
        let locked = Array(s.locked)
        guard let letter = upperLetter(rawLetter), cellOk(sol, cell), locked[cell] != "1" else { return s }
        if fill[cell] == letter { return s }
        fill[cell] = letter
        var n = s
        n.fill = String(fill); n.lastWrong = []; n.events.append("=\(rc(s, cell)):\(letter)")
        return settle(n, now: now)
    case .clear(let cell):
        var fill = Array(s.fill)
        let locked = Array(s.locked)
        guard cellOk(sol, cell), locked[cell] != "1", fill[cell] != CROSSWORD_EMPTY else { return s }
        fill[cell] = CROSSWORD_EMPTY
        var n = s
        n.fill = String(fill); n.lastWrong = []; n.events.append("-\(rc(s, cell))")
        return n
    case .check:
        var fill = Array(s.fill), locked = Array(s.locked)
        var wrong: [Int] = []
        for i in 0..<sol.count {
            if sol[i] == CROSSWORD_BLOCK || fill[i] == CROSSWORD_EMPTY || locked[i] == "1" { continue }
            if fill[i] == sol[i] { locked[i] = "1" } else { fill[i] = CROSSWORD_EMPTY; wrong.append(i) }
        }
        var n = s
        n.fill = String(fill); n.locked = String(locked); n.checks = s.checks + 1; n.lastWrong = wrong; n.events.append("#\(wrong.count)")
        return n
    case .revealLetter(let cell):
        let fill = Array(s.fill), locked = Array(s.locked)
        guard cellOk(sol, cell), !(locked[cell] == "1" && fill[cell] == sol[cell]) else { return s }
        var n = revealCells(s, [cell], mark: "l")
        n.hintsUsed = s.hintsUsed + 1; n.lastWrong = []; n.events.append("?\(rc(s, cell))")
        return settle(n, now: now)
    case .revealWord(let num, let dir):
        guard let e = s.entries.first(where: { $0.n == num && $0.dir == dir }), !crosswordEntrySolved(s, e) else { return s }
        var n = revealCells(s, crosswordEntryCells(s, e), mark: "w")
        n.hintsUsed = s.hintsUsed + 2; n.lastWrong = []; n.events.append("!\(e.n)\(e.dir.rawValue)")
        return settle(n, now: now)
    case .revealPuzzle:
        var cells: [Int] = []
        for i in 0..<sol.count where sol[i] != CROSSWORD_BLOCK { cells.append(i) }
        var n = revealCells(s, cells, mark: "p")
        n.lastWrong = []; n.events.append("!!"); n.status = .lost; n.ended = true; n.endTime = now
        return n
    case .finish:
        return s
    }
}

// MARK: - Matches row ↔ state

/// solutions = ["id|title|WxH", solutionGrid, ...answers in entry order]; guesses = ["=" + fill, "h" + revealed, "c" + checks].
public func crosswordMatchRow(_ s: CrosswordState) -> (solutions: [String], guesses: [String]) {
    (["\(s.id)|\(s.title)|\(s.w)x\(s.h)", s.solution] + s.entries.map { $0.answer }, ["=\(s.fill)", "h\(s.revealed)", "c\(s.checks)"])
}

public struct CrosswordReconstruction: Equatable {
    public let id: String
    public let title: String
    public let w: Int
    public let h: Int
    public let solution: String
    public let answers: [String]
    public let fill: String
    public let revealed: String
    public let checks: Int
    public let correct: Int
    public let total: Int
    public let hintsUsed: Int
    public let revealedPuzzle: Bool
    public let solved: Bool
}

/// JS `/^(\d+)x(\d+)$/`: ASCII digits only, one lowercase x. nil unless both parts fit an Int.
private func parseDims(_ str: String) -> (w: Int, h: Int)? {
    let parts = str.split(separator: "x", omittingEmptySubsequences: false)
    guard parts.count == 2 else { return nil }
    func digits(_ s: Substring) -> Int? {
        guard !s.isEmpty, s.allSatisfy({ $0.isASCII && $0.isNumber }) else { return nil }
        return Int(s)
    }
    guard let w = digits(parts[0]), let h = digits(parts[1]) else { return nil }
    return (w, h)
}
/// JS `Math.max(0, Number(str) || 0)` narrowed to Int: whitespace-trimmed, "" → 0, NaN → 0, fractions truncate, +∞ → Int.max.
private func jsCheckCount(_ str: String) -> Int {
    let t = str.trimmingCharacters(in: .whitespacesAndNewlines)
    if t.isEmpty { return 0 }
    guard let d = Double(t), !d.isNaN else { return 0 }
    if d.isInfinite { return d > 0 ? Int.max : 0 }
    if d <= 0 { return 0 }
    return d >= Double(Int.max) ? Int.max : Int(d)
}

public func reconstructCrossword(solutions: [String]?, guesses: [String]?) -> CrosswordReconstruction? {
    guard let solutions = solutions, solutions.count >= 3 else { return nil }
    let head = solutions[0].split(separator: "|", omittingEmptySubsequences: false).map(String.init)
    guard head.count == 3, let dims = parseDims(head[2]) else { return nil }
    let w = dims.w, h = dims.h, solution = solutions[1]
    let (area, overflow) = w.multipliedReportingOverflow(by: h)
    guard w > 0, h > 0, !overflow, solution.count == area else { return nil }
    var fill = "", revealed = "", checks = 0
    for g in guesses ?? [] {
        if g.hasPrefix("="), g.count == solution.count + 1 { fill = String(g.dropFirst()) }
        else if g.hasPrefix("h"), g.count == solution.count + 1 { revealed = String(g.dropFirst()) }
        else if g.hasPrefix("c") { checks = jsCheckCount(String(g.dropFirst())) }
    }
    if fill.isEmpty { fill = String(solution.map { $0 == CROSSWORD_BLOCK ? CROSSWORD_BLOCK : CROSSWORD_EMPTY }) }
    if revealed.isEmpty { revealed = String(repeating: ".", count: solution.count) }
    var hintsUsed = 0, anyWord = false
    for ch in revealed { if ch == "l" { hintsUsed += 1 } else if ch == "w" { anyWord = true } }
    let revealedPuzzle = revealed.contains("p")
    let total = crosswordLetterCount(solution: solution), correct = crosswordCorrectCount(fill: fill, solution: solution)
    return CrosswordReconstruction(id: head[0], title: head[1], w: w, h: h, solution: solution, answers: Array(solutions.dropFirst(2)),
                                   fill: fill, revealed: revealed, checks: checks, correct: correct, total: total,
                                   hintsUsed: hintsUsed + (anyWord ? 2 : 0), revealedPuzzle: revealedPuzzle, solved: !revealedPuzzle && correct == total)
}
