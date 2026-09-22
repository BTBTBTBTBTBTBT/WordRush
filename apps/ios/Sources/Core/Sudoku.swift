import Foundation

// Sudoku — deterministic generator, solver and reducer (More Games §4).
// 1:1 port of packages/core/src/games/sudoku.ts; pinned by sudoku-fixtures.json
// (SudokuFixtureTests). Everything is integer arithmetic over
// Mulberry32(simpleHash(seed + "-sudoku-v1")), so the same seed yields the same
// givens on every platform. Board strings: 81 chars, row-major, "0" = empty.

public enum SudokuDifficulty: String, Codable, CaseIterable {
    case easy, medium, hard
    public var clues: Int { switch self { case .easy: return 38; case .medium: return 32; case .hard: return 26 } }
}

public let SUDOKU_DAILY_DIFFICULTY: SudokuDifficulty = .medium
public let SUDOKU_MAX_MISTAKES = 3
private let MAX_REROLLS = 30
private let HISTORY_CAP = 200

public struct SudokuPuzzle: Codable, Equatable {
    public let seed: String
    public let difficulty: SudokuDifficulty
    public let givens: String
    public let solution: String
    public let clues: Int
    public let rerolls: Int
}

// MARK: - PRNG helpers (rng call ORDER is the parity contract)

private func randInt(_ rng: inout Mulberry32, _ n: Int) -> Int { Int(rng.next() % UInt32(n)) }
private func shuffle<T>(_ rng: inout Mulberry32, _ arr: [T]) -> [T] {
    var a = arr
    var i = a.count - 1
    while i > 0 { let j = randInt(&rng, i + 1); a.swapAt(i, j); i -= 1 }
    return a
}

// MARK: - Solved grid

private func solvedGrid(_ rng: inout Mulberry32) -> [Int] {
    func base(_ r: Int, _ c: Int) -> Int { ((r * 3 + r / 3 + c) % 9) + 1 }
    let digits = shuffle(&rng, [1, 2, 3, 4, 5, 6, 7, 8, 9])
    let bands = shuffle(&rng, [0, 1, 2])
    let rowsIn = [shuffle(&rng, [0, 1, 2]), shuffle(&rng, [0, 1, 2]), shuffle(&rng, [0, 1, 2])]
    let stacks = shuffle(&rng, [0, 1, 2])
    let colsIn = [shuffle(&rng, [0, 1, 2]), shuffle(&rng, [0, 1, 2]), shuffle(&rng, [0, 1, 2])]
    let transpose = randInt(&rng, 2) == 1
    var grid = [Int](repeating: 0, count: 81)
    for r in 0..<9 {
        let srcRow = bands[r / 3] * 3 + rowsIn[r / 3][r % 3]
        for c in 0..<9 {
            let srcCol = stacks[c / 3] * 3 + colsIn[c / 3][c % 3]
            let v = digits[base(srcRow, srcCol) - 1]
            if transpose { grid[c * 9 + r] = v } else { grid[r * 9 + c] = v }
        }
    }
    return grid
}

// MARK: - Solver

@inline(__always) private func boxOf(_ i: Int) -> Int { ((i / 9) / 3) * 3 + (i % 9) / 3 }
private let ALL = 0x1ff

/// Number of solutions, stopping at `limit`. `cells` is 0 for empty.
public func countSudokuSolutions(_ cells: [Int], limit: Int = 2) -> Int {
    var rows = [Int](repeating: 0, count: 9), cols = rows, boxes = rows
    var grid = cells
    for i in 0..<81 {
        let v = grid[i]
        if v == 0 { continue }
        let bit = 1 << (v - 1)
        let r = i / 9, c = i % 9, b = boxOf(i)
        if (rows[r] & bit) != 0 || (cols[c] & bit) != 0 || (boxes[b] & bit) != 0 { return 0 }
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit
    }
    var count = 0
    func search() {
        if count >= limit { return }
        var best = -1, bestMask = 0, bestN = 10
        for i in 0..<81 {
            if grid[i] != 0 { continue }
            let mask = ALL & ~(rows[i / 9] | cols[i % 9] | boxes[boxOf(i)])
            let n = mask.nonzeroBitCount
            if n == 0 { return }
            if n < bestN { best = i; bestMask = mask; bestN = n; if n == 1 { break } }
        }
        if best < 0 { count += 1; return }
        let r = best / 9, c = best % 9, b = boxOf(best)
        for d in 0..<9 {
            let bit = 1 << d
            if (bestMask & bit) == 0 { continue }
            grid[best] = d + 1; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit
            search()
            grid[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit
            if count >= limit { return }
        }
    }
    search()
    return count
}

/// True when naked + hidden singles alone solve the puzzle (the Easy gate; Hard must fail it).
public func sudokuSolvableBySingles(_ cells: [Int]) -> Bool {
    var grid = cells
    func candidates(_ i: Int) -> Int {
        if grid[i] != 0 { return 0 }
        var used = 0
        let r = i / 9, c = i % 9, b = boxOf(i)
        for k in 0..<9 {
            let rv = grid[r * 9 + k]; if rv != 0 { used |= 1 << (rv - 1) }
            let cv = grid[k * 9 + c]; if cv != 0 { used |= 1 << (cv - 1) }
            let bi = ((b / 3) * 3 + k / 3) * 9 + (b % 3) * 3 + (k % 3)
            let bv = grid[bi]; if bv != 0 { used |= 1 << (bv - 1) }
        }
        return ALL & ~used
    }
    func unitCell(_ kind: Int, _ u: Int, _ k: Int) -> Int {
        kind == 0 ? u * 9 + k : kind == 1 ? k * 9 + u : ((u / 3) * 3 + k / 3) * 9 + (u % 3) * 3 + (k % 3)
    }
    var progress = true
    while progress {
        progress = false
        for i in 0..<81 {
            if grid[i] != 0 { continue }
            let m = candidates(i)
            if m == 0 { return false }
            if (m & (m - 1)) == 0 { grid[i] = m.trailingZeroBitCount + 1; progress = true }
        }
        for kind in 0..<3 {
            for u in 0..<9 {
                for d in 0..<9 {
                    let bit = 1 << d
                    var whereAt = -1, n = 0, placed = false
                    for k in 0..<9 {
                        let i = unitCell(kind, u, k)
                        if grid[i] == d + 1 { placed = true; break }
                        if grid[i] == 0 && (candidates(i) & bit) != 0 { whereAt = i; n += 1 }
                    }
                    if !placed && n == 1 { grid[whereAt] = d + 1; progress = true }
                }
            }
        }
    }
    return grid.allSatisfy { $0 != 0 }
}

// MARK: - Generator

private func toStr(_ cells: [Int]) -> String { cells.map(String.init).joined() }
public func sudokuCells(_ s: String) -> [Int] { s.unicodeScalars.map { Int($0.value) - 48 } }

private func attempt(_ seed: String, _ difficulty: SudokuDifficulty, _ k: Int) -> (givens: [Int], solution: [Int]) {
    let attemptSeed = k == 0 ? seed : "\(seed)-r\(k)"
    var rng = Mulberry32(state: UInt32(truncatingIfNeeded: simpleHash("\(attemptSeed)-sudoku-v1")))
    let solution = solvedGrid(&rng)
    let target = difficulty.clues
    let order = shuffle(&rng, Array(0..<81))
    var givens = solution
    var clues = 81
    for i in order {
        if clues <= target { break }
        let save = givens[i]
        givens[i] = 0
        if countSudokuSolutions(givens, limit: 2) == 1 { clues -= 1 } else { givens[i] = save }
    }
    return (givens, solution)
}

private func passesGate(_ givens: [Int], _ difficulty: SudokuDifficulty) -> Bool {
    if difficulty == .medium { return true }
    let singles = sudokuSolvableBySingles(givens)
    return difficulty == .easy ? singles : !singles
}

/// The puzzle for a seed (daily → Medium; `unlimited-SUDOKU-<ts>-<difficulty>` → chosen).
public func generateSudoku(_ seed: String, difficulty: SudokuDifficulty = SUDOKU_DAILY_DIFFICULTY) -> SudokuPuzzle {
    var last = attempt(seed, difficulty, 0)
    var k = 0
    while !passesGate(last.givens, difficulty) && k < MAX_REROLLS {
        k += 1
        last = attempt(seed, difficulty, k)
    }
    return SudokuPuzzle(seed: seed, difficulty: difficulty, givens: toStr(last.givens), solution: toStr(last.solution),
                        clues: last.givens.filter { $0 != 0 }.count, rerolls: k)
}

/// Difficulty encoded in an Unlimited seed's trailing segment; the daily is Medium.
public func sudokuDifficultyForSeed(_ seed: String) -> SudokuDifficulty {
    guard let tail = seed.split(separator: "-").last, let d = SudokuDifficulty(rawValue: String(tail)) else { return SUDOKU_DAILY_DIFFICULTY }
    return d
}

/// The first daily Sudoku's local date — "#1". Purely cosmetic numbering.
public let SUDOKU_DAILY_EPOCH = "2026-09-23"
/// "#N" for the daily on `day` (YYYY-MM-DD local); 1 on the epoch day, never below 1.
public func sudokuDailyNumber(_ day: String) -> Int {
    guard let idx = Bank.dayIndex(day, epoch: SUDOKU_DAILY_EPOCH) else { return 1 }
    return max(1, idx + 1)
}

// MARK: - Reducer

public enum SudokuStatus: String, Codable { case playing, won, lost }

public struct SudokuSnapshot: Codable, Equatable {
    public var board: String
    public var notes: [Int]
    public var hintMask: String
    public var wrongMask: String
}

public struct SudokuState: Codable, Equatable {
    public let seed: String
    public let difficulty: SudokuDifficulty
    public let givens: String
    public let solution: String
    public var board: String
    public var notes: [Int]
    public var hintMask: String
    public var wrongMask: String
    public var mistakes: Int
    public var hintsUsed: Int
    public var notesMode: Bool
    public var autoClearNotes: Bool
    public var status: SudokuStatus
    public var history: [SudokuSnapshot]
    public var startTime: Double
    public var endTime: Double?

    public init(puzzle: SudokuPuzzle, startTime: Double) {
        seed = puzzle.seed; difficulty = puzzle.difficulty; givens = puzzle.givens; solution = puzzle.solution
        board = puzzle.givens; notes = [Int](repeating: 0, count: 81)
        hintMask = String(repeating: "0", count: 81); wrongMask = hintMask
        mistakes = 0; hintsUsed = 0; notesMode = false; autoClearNotes = true
        status = .playing; history = []; self.startTime = startTime; endTime = nil
    }

    var snapshot: SudokuSnapshot { SudokuSnapshot(board: board, notes: notes, hintMask: hintMask, wrongMask: wrongMask) }
}

public enum SudokuAction: Equatable {
    case place(cell: Int, digit: Int)
    case erase(cell: Int)
    case undo
    case hint(cell: Int?)
    case toggleNotes
    case noteToggle(cell: Int, digit: Int)
    case setAutoClear(Bool)
    case finish(now: Double)
}

private func setChar(_ s: String, _ i: Int, _ ch: Character) -> String {
    var a = Array(s); a[i] = ch; return String(a)
}
private func charAt(_ s: String, _ i: Int) -> Character { s[s.index(s.startIndex, offsetBy: i)] }
private func digitAt(_ s: String, _ i: Int) -> Int { Int(charAt(s, i).asciiValue!) - 48 }
private func peers(_ i: Int) -> [Int] {
    let r = i / 9, c = i % 9, b = boxOf(i)
    var out = Set<Int>()
    for k in 0..<9 {
        out.insert(r * 9 + k); out.insert(k * 9 + c)
        out.insert(((b / 3) * 3 + k / 3) * 9 + (b % 3) * 3 + (k % 3))
    }
    out.remove(i)
    return out.sorted()
}
private func pushHistory(_ s: SudokuState) -> [SudokuSnapshot] {
    var h = s.history; h.append(s.snapshot)
    if h.count > HISTORY_CAP { h.removeFirst(h.count - HISTORY_CAP) }
    return h
}
private func clearPeerNotes(_ notes: [Int], _ cell: Int, _ digit: Int) -> [Int] {
    let bit = 1 << (digit - 1)
    var out = notes
    for p in peers(cell) { out[p] &= ~bit }
    return out
}
private func settle(_ s: SudokuState, _ now: Double) -> SudokuState {
    guard s.status == .playing else { return s }
    var n = s
    if s.board == s.solution { n.status = .won; n.endTime = now; n.history = []; return n }
    if s.mistakes >= SUDOKU_MAX_MISTAKES { n.status = .lost; n.endTime = now; n.history = []; return n }
    return s
}

/// Pure reducer; `now` stamps endTime on a win/loss.
public func sudokuReduce(_ s: SudokuState, _ a: SudokuAction, now: Double = 0) -> SudokuState {
    switch a {
    case .setAutoClear(let v): var n = s; n.autoClearNotes = v; return n
    case .toggleNotes: var n = s; n.notesMode.toggle(); return n
    case .finish(let t): if s.status == .playing { return s }; var n = s; n.endTime = s.endTime ?? t; return n
    default: break
    }
    guard s.status == .playing else { return s }

    switch a {
    case .place(let cell, let digit):
        guard (0...80).contains(cell), (1...9).contains(digit) else { return s }
        guard charAt(s.givens, cell) == "0" else { return s }
        if s.notesMode { return sudokuReduce(s, .noteToggle(cell: cell, digit: digit), now: now) }
        if digitAt(s.board, cell) == digit { return s }
        let correct = digitAt(s.solution, cell) == digit
        var notes = s.notes; notes[cell] = 0
        if correct && s.autoClearNotes { notes = clearPeerNotes(notes, cell, digit) }
        var n = s
        n.history = pushHistory(s)
        n.board = setChar(s.board, cell, Character(String(digit)))
        n.notes = notes
        n.wrongMask = setChar(s.wrongMask, cell, correct ? "0" : "1")
        n.mistakes = s.mistakes + (correct ? 0 : 1)
        return settle(n, now)
    case .erase(let cell):
        guard (0...80).contains(cell), charAt(s.givens, cell) == "0" else { return s }
        if charAt(s.board, cell) == "0" && s.notes[cell] == 0 { return s }
        var n = s
        n.history = pushHistory(s)
        n.board = setChar(s.board, cell, "0"); n.notes[cell] = 0
        n.wrongMask = setChar(s.wrongMask, cell, "0")
        return n
    case .undo:
        guard let prev = s.history.last else { return s }
        var n = s
        n.board = prev.board; n.notes = prev.notes; n.hintMask = prev.hintMask; n.wrongMask = prev.wrongMask
        n.history = Array(s.history.dropLast())
        return n
    case .hint(let cell):
        func eligible(_ i: Int) -> Bool { charAt(s.givens, i) == "0" && charAt(s.board, i) != charAt(s.solution, i) }
        var target = -1
        if let cell, (0...80).contains(cell), eligible(cell) { target = cell }
        if target < 0 { for i in 0..<81 where eligible(i) { target = i; break } }
        if target < 0 { return s }
        let digit = digitAt(s.solution, target)
        var notes = s.notes; notes[target] = 0
        if s.autoClearNotes { notes = clearPeerNotes(notes, target, digit) }
        var n = s
        n.history = pushHistory(s)
        n.board = setChar(s.board, target, Character(String(digit))); n.notes = notes
        n.hintMask = setChar(s.hintMask, target, "1")
        n.wrongMask = setChar(s.wrongMask, target, "0")
        n.hintsUsed = s.hintsUsed + 1
        return settle(n, now)
    case .noteToggle(let cell, let digit):
        guard (0...80).contains(cell), (1...9).contains(digit) else { return s }
        guard charAt(s.givens, cell) == "0", charAt(s.board, cell) == "0" else { return s }
        var n = s
        n.history = pushHistory(s)
        n.notes[cell] ^= 1 << (digit - 1)
        return n
    default:
        return s
    }
}

/// Cells left to fill (for the progress line).
public func sudokuRemaining(_ s: SudokuState) -> Int {
    zip(s.board, s.solution).filter { $0 != $1 }.count
}

// MARK: - Matches row ↔ state

public struct SudokuReconstruction: Equatable {
    public let solution: String, givens: String, board: String, hintMask: String, solved: Bool
}

/// What we store: solutions = [solution81, givens81]; guesses = [board81, hintMask81].
public func sudokuMatchRow(_ s: SudokuState) -> (solutions: [String], guesses: [String]) {
    ([s.solution, s.givens], [s.board, s.hintMask])
}

/// The solved-puzzle view from a matches row, or nil if malformed.
public func reconstructSudoku(solutions: [String], guesses: [String]) -> SudokuReconstruction? {
    let solution = solutions.count > 0 ? solutions[0] : ""
    let givens = solutions.count > 1 ? solutions[1] : ""
    let board = guesses.count > 0 && guesses[0].count == 81 ? guesses[0] : givens
    let hintMask = guesses.count > 1 && guesses[1].count == 81 ? guesses[1] : String(repeating: "0", count: 81)
    guard solution.count == 81, solution.allSatisfy({ ("1"..."9").contains($0) }),
          givens.count == 81, givens.allSatisfy({ ("0"..."9").contains($0) }) else { return nil }
    return SudokuReconstruction(solution: solution, givens: givens, board: board, hintMask: hintMask, solved: board == solution)
}
