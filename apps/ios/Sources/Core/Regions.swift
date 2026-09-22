import Foundation

// Starsweep — region-placement logic puzzle (More Games §18b). 1:1 port of
// packages/core/src/games/regions.ts; pinned by regions-fixtures.json
// (RegionsFixtureTests). Everything is integer arithmetic over
// Mulberry32(simpleHash(seed + "-regions-v1[-r<k>]")), so the same seed yields
// the same board on every platform.
//
// Strings: `regions` is n*n chars (region index per cell), `solution` is n
// chars (the star's column per row), `board` is n*n chars: "." empty, "x"
// crossed out, "*" star.

public let REGIONS_MAX_MISTAKES = 3
public let REGIONS_DAILY_EPOCH = "2026-09-23"
private let MAX_REROLLS = 400
private let HISTORY_CAP = 200

public struct RegionsPuzzle: Codable, Equatable {
    public let seed: String
    public let n: Int
    public let regions: String
    public let solution: String
    public let sizes: [Int]
    public let rerolls: Int
}

// MARK: - PRNG helpers (rng call ORDER is the parity contract)

private func below(_ rng: inout Mulberry32, _ n: Int) -> Int { Int(rng.next() % UInt32(n)) }
private func shuffle<T>(_ rng: inout Mulberry32, _ arr: [T]) -> [T] {
    var a = arr
    var i = a.count - 1
    while i > 0 { let j = below(&rng, i + 1); a.swapAt(i, j); i -= 1 }
    return a
}

/// Orthogonal neighbours, in the fixed order up, down, left, right.
public func regionsN4(_ n: Int, _ i: Int) -> [Int] {
    let r = i / n, c = i % n
    var o: [Int] = []
    if r > 0 { o.append(i - n) }
    if r < n - 1 { o.append(i + n) }
    if c > 0 { o.append(i - 1) }
    if c < n - 1 { o.append(i + 1) }
    return o
}

// MARK: - Generator

private func layout(_ n: Int, _ rng: inout Mulberry32) -> [Int]? {
    var cols: [Int] = []
    func go(_ r: Int) -> Bool {
        if r == n { return true }
        for c in shuffle(&rng, Array(0..<n)) {
            if cols.contains(c) || (r > 0 && abs(cols[r - 1] - c) < 2) { continue }
            cols.append(c)
            if go(r + 1) { return true }
            cols.removeLast()
        }
        return false
    }
    return go(0) ? cols : nil
}

private func grow(_ n: Int, _ cols: [Int], _ rng: inout Mulberry32) -> [Int] {
    var reg = [Int](repeating: -1, count: n * n)
    for (r, c) in cols.enumerated() { reg[r * n + c] = r }
    let weight = cols.map { _ in 1 + below(&rng, 4) }
    var left = n * n - n
    while left > 0 {
        let k = below(&rng, n)
        if below(&rng, 4) >= weight[k] { continue }
        var edge: [Int] = []
        for (i, v) in reg.enumerated() where v == k { for j in regionsN4(n, i) where reg[j] < 0 { edge.append(j) } }
        if edge.isEmpty { continue }
        reg[edge[below(&rng, edge.count)]] = k
        left -= 1
    }
    return reg
}

/// Number of solutions (stopping at `limit`); `keep` collects them as column lists.
public func countRegionsSolutions(_ n: Int, _ reg: [Int], limit: Int = 2, keep: UnsafeMutablePointer<[[Int]]>? = nil) -> Int {
    var usedC = [Bool](repeating: false, count: n), usedR = usedC, cur: [Int] = []
    var count = 0
    func go(_ r: Int) {
        if r == n { count += 1; keep?.pointee.append(cur); return }
        var c = 0
        while c < n && count < limit {
            let g = reg[r * n + c]
            if !(usedC[c] || usedR[g] || (r > 0 && abs(cur[r - 1] - c) < 2)) {
                usedC[c] = true; usedR[g] = true; cur.append(c)
                go(r + 1)
                cur.removeLast(); usedC[c] = false; usedR[g] = false
            }
            c += 1
        }
    }
    go(0)
    return count
}

private func connected(_ n: Int, _ reg: [Int], _ k: Int, _ without: Int) -> Bool {
    var cells: [Int] = []
    for (i, v) in reg.enumerated() where v == k && i != without { cells.append(i) }
    if cells.isEmpty { return false }
    var seen: Set<Int> = [cells[0]], q = [cells[0]]
    while let cur = q.popLast() {
        for j in regionsN4(n, cur) where reg[j] == k && j != without && !seen.contains(j) { seen.insert(j); q.append(j) }
    }
    return seen.count == cells.count
}

/// The board for a seed and size; nil only if 400 attempts all fail.
public func generateRegions(_ seed: String, n: Int) -> RegionsPuzzle? {
    for k in 0..<MAX_REROLLS {
        var rng = Mulberry32(state: UInt32(truncatingIfNeeded: simpleHash("\(seed)-regions-v1\(k > 0 ? "-r\(k)" : "")")))
        guard let cols = layout(n, &rng) else { continue }
        var reg = grow(n, cols, &rng)
        var step = 0
        while step < 60 && countRegionsSolutions(n, reg) > 1 {
            var all: [[Int]] = []
            _ = countRegionsSolutions(n, reg, limit: 2, keep: &all)
            guard let rival = all.first(where: { s in s.enumerated().contains { $0.element != cols[$0.offset] } }) else { break }
            var moves: [(Int, Int)] = []
            for (r, c) in rival.enumerated() {
                let i = r * n + c
                if c == cols[r] { continue }
                for j in regionsN4(n, i) where reg[j] != reg[i] && connected(n, reg, reg[i], i) { moves.append((i, reg[j])) }
            }
            if moves.isEmpty { break }
            let (i, to) = moves[below(&rng, moves.count)]
            reg[i] = to
            step += 1
        }
        var sizes = [Int](repeating: 0, count: n)
        for v in reg { sizes[v] += 1 }
        if countRegionsSolutions(n, reg) != 1 || sizes.filter({ $0 <= 2 }).count > 1 || (sizes.max() ?? 0) > n * 2
            || (0..<n).contains(where: { !connected(n, reg, $0, -1) }) { continue }
        var order: [Int] = []
        for v in reg where !order.contains(v) { order.append(v) }
        return RegionsPuzzle(seed: seed, n: n,
                             regions: reg.map { String(order.firstIndex(of: $0)!) }.joined(),
                             solution: cols.map(String.init).joined(),
                             sizes: order.map { sizes[$0] }, rerolls: k)
    }
    return nil
}

/// Daily board size: 7×7 Monday–Wednesday, 8×8 Thursday–Sunday (local day string).
public func regionsSizeForDay(_ day: String) -> Int {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "UTC"); f.locale = Locale(identifier: "en_US_POSIX")
    guard let d = f.date(from: day) else { return 8 }
    var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
    let dow = cal.component(.weekday, from: d) - 1   // 0 = Sunday
    return (dow >= 1 && dow <= 3) ? 7 : 8
}

/// Size encoded in an Unlimited seed's trailing segment (`-7`/`-8`/`-9`); default 8.
public func regionsSizeForSeed(_ seed: String) -> Int {
    let tail = seed.split(separator: "-").last.map(String.init)
    return tail == "7" ? 7 : tail == "9" ? 9 : 8
}

/// "#N" for the daily on `day`; 1 on the epoch day, never below 1.
public func regionsDailyNumber(_ day: String) -> Int {
    guard let idx = Bank.dayIndex(day, epoch: REGIONS_DAILY_EPOCH) else { return 1 }
    return max(1, idx + 1)
}

// MARK: - Reducer

public enum RegionsStatus: String, Codable { case playing, won, lost }

public struct RegionsSnapshot: Codable, Equatable {
    public var board: String
    public var hintMask: String
    public var wrongMask: String
}

public struct RegionsState: Codable, Equatable {
    public let seed: String
    public let n: Int
    public let regions: String
    public let solution: String
    public var board: String
    public var hintMask: String
    public var wrongMask: String
    public var mistakes: Int
    public var hintsUsed: Int
    public var autoCross: Bool
    public var status: RegionsStatus
    public var history: [RegionsSnapshot]
    public var startTime: Double
    public var endTime: Double?

    public init(puzzle: RegionsPuzzle, startTime: Double) {
        seed = puzzle.seed; n = puzzle.n; regions = puzzle.regions; solution = puzzle.solution
        board = String(repeating: ".", count: n * n)
        hintMask = String(repeating: "0", count: n * n); wrongMask = hintMask
        mistakes = 0; hintsUsed = 0; autoCross = true; status = .playing; history = []
        self.startTime = startTime; endTime = nil
    }
    var snapshot: RegionsSnapshot { RegionsSnapshot(board: board, hintMask: hintMask, wrongMask: wrongMask) }
}

public enum RegionsAction: Equatable {
    case tap(cell: Int)
    case erase(cell: Int)
    case undo
    case hint(cell: Int?)
    case setAutoCross(Bool)
    case finish(now: Double)
}

private func setChar(_ s: String, _ i: Int, _ ch: Character) -> String { var a = Array(s); a[i] = ch; return String(a) }
private func charAt(_ s: String, _ i: Int) -> Character { s[s.index(s.startIndex, offsetBy: i)] }
private func starOfRow(_ s: RegionsState, _ r: Int) -> Int { r * s.n + (Int(charAt(s.solution, r).asciiValue!) - 48) }
private func isStarCell(_ s: RegionsState, _ i: Int) -> Bool { starOfRow(s, i / s.n) == i }

private func pushHistory(_ s: RegionsState) -> [RegionsSnapshot] {
    var h = s.history; h.append(s.snapshot)
    if h.count > HISTORY_CAP { h.removeFirst(h.count - HISTORY_CAP) }
    return h
}

/// Cells a correct star rules out: its row, column, region and the eight neighbours.
public func regionsRuledOut(_ n: Int, _ regions: String, _ cell: Int) -> [Int] {
    let r = cell / n, c = cell % n
    let regs = Array(regions), g = regs[cell]
    var out = Set<Int>()
    for k in 0..<n { out.insert(r * n + k); out.insert(k * n + c) }
    for i in 0..<(n * n) where regs[i] == g { out.insert(i) }
    for dr in -1...1 { for dc in -1...1 { let rr = r + dr, cc = c + dc; if rr >= 0 && rr < n && cc >= 0 && cc < n { out.insert(rr * n + cc) } } }
    out.remove(cell)
    return out.sorted()
}

private func crossOut(_ board: String, _ cellsToCross: [Int]) -> String {
    var a = Array(board)
    for i in cellsToCross where a[i] == "." { a[i] = "x" }
    return String(a)
}

private func isSolved(_ s: RegionsState) -> Bool {
    let b = Array(s.board)
    for r in 0..<s.n where b[starOfRow(s, r)] != "*" { return false }
    for i in 0..<(s.n * s.n) where b[i] == "*" && !isStarCell(s, i) { return false }
    return true
}

private func settle(_ s: RegionsState, _ now: Double) -> RegionsState {
    guard s.status == .playing else { return s }
    var n = s
    if isSolved(s) { n.status = .won; n.endTime = now; n.history = []; return n }
    if s.mistakes >= REGIONS_MAX_MISTAKES { n.status = .lost; n.endTime = now; n.history = []; return n }
    return s
}

private func placeStar(_ s: RegionsState, _ cell: Int, viaHint: Bool, _ now: Double) -> RegionsState {
    let correct = isStarCell(s, cell)
    var board = setChar(s.board, cell, "*")
    if correct && s.autoCross { board = crossOut(board, regionsRuledOut(s.n, s.regions, cell)) }
    var n = s
    n.history = pushHistory(s)
    n.board = board
    if viaHint { n.hintMask = setChar(s.hintMask, cell, "1") }
    n.wrongMask = setChar(s.wrongMask, cell, correct ? "0" : "1")
    n.mistakes = s.mistakes + (correct ? 0 : 1)
    n.hintsUsed = s.hintsUsed + (viaHint ? 1 : 0)
    return settle(n, now)
}

/// Pure reducer; `now` stamps endTime on a win/loss.
public func regionsReduce(_ s: RegionsState, _ a: RegionsAction, now: Double = 0) -> RegionsState {
    switch a {
    case .setAutoCross(let v): var n = s; n.autoCross = v; return n
    case .finish(let t): if s.status == .playing { return s }; var n = s; n.endTime = s.endTime ?? t; return n
    default: break
    }
    guard s.status == .playing else { return s }
    let total = s.n * s.n

    switch a {
    case .tap(let cell):
        guard cell >= 0, cell < total else { return s }
        let cur = charAt(s.board, cell)
        if cur == "*" && charAt(s.hintMask, cell) == "1" { return s }
        if cur == "." { var n = s; n.history = pushHistory(s); n.board = setChar(s.board, cell, "x"); return n }
        if cur == "x" { return placeStar(s, cell, viaHint: false, now) }
        var n = s; n.history = pushHistory(s); n.board = setChar(s.board, cell, "."); n.wrongMask = setChar(s.wrongMask, cell, "0"); return n
    case .erase(let cell):
        guard cell >= 0, cell < total, charAt(s.board, cell) != "." else { return s }
        if charAt(s.board, cell) == "*" && charAt(s.hintMask, cell) == "1" { return s }
        var n = s; n.history = pushHistory(s); n.board = setChar(s.board, cell, "."); n.wrongMask = setChar(s.wrongMask, cell, "0"); return n
    case .undo:
        guard let prev = s.history.last else { return s }
        var n = s; n.board = prev.board; n.hintMask = prev.hintMask; n.wrongMask = prev.wrongMask; n.history = Array(s.history.dropLast()); return n
    case .hint(let cell):
        var target = -1
        if let cell, cell >= 0, cell < total { let t = starOfRow(s, cell / s.n); if charAt(s.board, t) != "*" { target = t } }
        if target < 0 { for r in 0..<s.n { let t = starOfRow(s, r); if charAt(s.board, t) != "*" { target = t; break } } }
        if target < 0 { return s }
        return placeStar(s, target, viaHint: true, now)
    default:
        return s
    }
}

/// Correct stars still to place (for the progress line).
public func regionsRemaining(_ s: RegionsState) -> Int {
    let b = Array(s.board)
    return (0..<s.n).filter { b[starOfRow(s, $0)] != "*" }.count
}

// MARK: - Matches row ↔ state

public struct RegionsReconstruction: Equatable {
    public let n: Int, regions: String, solution: String, board: String, hintMask: String, solved: Bool
}

/// What we store: solutions = [regionsNN, solutionN]; guesses = [boardNN, hintMaskNN].
public func regionsMatchRow(_ s: RegionsState) -> (solutions: [String], guesses: [String]) {
    ([s.regions, s.solution], [s.board, s.hintMask])
}

/// The solved-board view from a matches row, or nil if malformed.
public func reconstructRegions(solutions: [String], guesses: [String]) -> RegionsReconstruction? {
    let regions = solutions.count > 0 ? solutions[0] : ""
    let solution = solutions.count > 1 ? solutions[1] : ""
    let n = solution.count
    let digits = { (t: String) in t.allSatisfy { ("0"..."9").contains($0) } }
    guard n >= 4, n <= 12, regions.count == n * n, !regions.isEmpty, digits(regions), digits(solution) else { return nil }
    let board = guesses.count > 0 && guesses[0].count == n * n ? guesses[0] : String(repeating: ".", count: n * n)
    let hintMask = guesses.count > 1 && guesses[1].count == n * n ? guesses[1] : String(repeating: "0", count: n * n)
    let b = Array(board), sol = Array(solution)
    var solved = true
    for r in 0..<n where b[r * n + (Int(sol[r].asciiValue!) - 48)] != "*" { solved = false }
    return RegionsReconstruction(n: n, regions: regions, solution: solution, board: board, hintMask: hintMask, solved: solved)
}
