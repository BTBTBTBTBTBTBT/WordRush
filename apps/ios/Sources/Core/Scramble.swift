import Foundation

// Muddle — the newspaper scramble (More Games §5; catalog id `scramble`). 1:1
// port of packages/core/src/games/scramble.ts; pinned by scramble-fixtures.json
// (ScrambleFixtureTests). Four scrambled 5/6-letter words; the CIRCLED letters
// of their answers, in word order, are exactly the letters of a pun that
// completes the caption under the cartoon. Unscramble the four, then spell the
// punchline.
//
// Play: letters are placed one at a time into the active word (tap a tile or
// type — either way a letter must still be in that word's tray). When a word
// is full it checks itself: right → it locks and its circled letters fly to the
// punchline row; wrong → the row shakes, the letters go back, and a MISTAKE is
// counted. Every check counts (guess_count = checks, perfect 5 = four words and
// the punchline); thirteen checks lose. The punchline row opens once all four
// words are solved and checks the same way. Hints never count as checks:
// REVEAL_LETTER (1 hint) places the next correct letter, SOLVE_WORD (2 hints)
// fills the word. boards_solved = words solved + punchline (0–5). Event sigils
// (§11): "i✓WORD" solved, "i✗TRY" wrong, "ih<mask>" letter hint, "iH" word
// solved by hint — i is 0–3 for the words, 4 for the punchline.
//
// Banks (Resources/scramble-puzzles.json, sha-guarded to match the web copy)
// carry { daily, extra, holiday: { key: [...] } }; `cartoon` is null until the
// founder's image batch runs (the app shows the placeholder panel meanwhile).

public let SCRAMBLE_DAILY_EPOCH = "2026-09-23"
public let SCRAMBLE_MAX_CHECKS = 13
public let SCRAMBLE_TOTAL_BOARDS = 5
public let SCRAMBLE_WORDS = 4
public let SCRAMBLE_FINAL = 4

public struct ScrambleWord: Codable, Equatable {
    public let answer: String
    public let scramble: String
    public let circled: [Int]
    public init(answer: String, scramble: String, circled: [Int]) { self.answer = answer; self.scramble = scramble; self.circled = circled }
}

public struct ScrambleFinal: Codable, Equatable {
    public let answer: String
    public let pattern: [Int]
    public init(answer: String, pattern: [Int]) { self.answer = answer; self.pattern = pattern }
}

public struct ScramblePuzzle: Decodable, Equatable {
    public let id: String
    public let words: [ScrambleWord]
    public let `final`: ScrambleFinal
    public let caption: String
    public let altText: String
    /// nil until the founder's image batch runs (JSON `null`).
    public let cartoon: String?
    public let holiday: String?
    public init(id: String, words: [ScrambleWord], final: ScrambleFinal, caption: String, altText: String, cartoon: String? = nil, holiday: String? = nil) {
        self.id = id; self.words = words; self.final = `final`; self.caption = caption; self.altText = altText; self.cartoon = cartoon; self.holiday = holiday
    }
}

public struct ScrambleBank: Decodable {
    public let version: Int
    public let epoch: String
    public let daily: [ScramblePuzzle]
    public let extra: [ScramblePuzzle]
    public let holiday: [String: [ScramblePuzzle]]?
    public init(version: Int, epoch: String, daily: [ScramblePuzzle], extra: [ScramblePuzzle], holiday: [String: [ScramblePuzzle]]? = nil) {
        self.version = version; self.epoch = epoch; self.daily = daily; self.extra = extra; self.holiday = holiday
    }
    public static func load(from data: Data) -> ScrambleBank? { try? JSONDecoder().decode(ScrambleBank.self, from: data) }
    /// The app-bundled bank (Resources/scramble-puzzles.json — sha-guarded to match the web copy).
    public static let bundled: ScrambleBank? = {
        guard let url = Bundle.main.url(forResource: "scramble-puzzles", withExtension: "json"), let data = try? Data(contentsOf: url) else { return nil }
        return load(from: data)
    }()
}

// MARK: - Bank lookups

/// The daily puzzle for `day`: the holiday's own entry when the calendar names one, else epoch-indexed.
public func scramblePuzzleForDay(_ bank: ScrambleBank, day: String, holidays: HolidayTable? = nil) -> ScramblePuzzle? {
    if let pick = bankHolidayPick(day: day, table: holidays, holiday: bank.holiday) { return pick.entry }
    guard !bank.daily.isEmpty else { return nil }
    return bank.daily[Bank.indexForDay(day, n: bank.daily.count, epoch: bank.epoch)]
}
public func scramblePuzzleForSeed(_ bank: ScrambleBank, seed: String) -> ScramblePuzzle? {
    let pool = bank.extra.isEmpty ? bank.daily : bank.extra
    guard !pool.isEmpty else { return nil }
    return pool[Bank.indexForSeed(seed, n: pool.count)]
}
public func scrambleDailyNumber(_ day: String) -> Int {
    guard let idx = Bank.dayIndex(day, epoch: SCRAMBLE_DAILY_EPOCH) else { return 1 }
    return max(1, idx + 1)
}

// MARK: - Rows

/// Anything with the four words and the punchline — the TS helpers take `{ words, final }` structurally, so both the puzzle and the state qualify.
public protocol ScrambleRows {
    var words: [ScrambleWord] { get }
    var `final`: ScrambleFinal { get }
}
extension ScramblePuzzle: ScrambleRows {}

/// JS `/[^A-Z]/g` → "": only ASCII capitals survive.
private func asciiCapitals(_ s: String) -> String { s.filter { $0.isASCII && $0 >= "A" && $0 <= "Z" } }

/// The punchline's letters, no spaces.
public func scrambleFinalLetters(_ p: ScrambleRows) -> String { asciiCapitals(p.final.answer) }
/// The punchline tray: the circled letters in word order (what the player spells from).
public func scrambleFinalTray(_ p: ScrambleRows) -> String {
    var out = ""
    for w in p.words {
        let letters = Array(w.answer)
        for i in w.circled where i >= 0 && i < letters.count { out.append(letters[i]) }
    }
    return out
}
/// Letters of `pool` not yet used by `entry` (multiset difference), in pool order.
public func scrambleRemaining(pool: String, entry: String) -> String {
    var left = Array(pool)
    for ch in entry { if let k = left.firstIndex(of: ch) { left.remove(at: k) } }
    return String(left)
}
/// The answer letters for a row (words: the answer; punchline: letters without spaces).
public func scrambleTarget(_ s: ScrambleRows, _ row: Int) -> String {
    row < SCRAMBLE_FINAL ? s.words[row].answer : scrambleFinalLetters(s)
}
/// The tray a row draws from (words: the scramble; punchline: the circled letters in word order).
public func scrambleTray(_ s: ScrambleRows, _ row: Int) -> String {
    row < SCRAMBLE_FINAL ? s.words[row].scramble : scrambleFinalTray(s)
}

// MARK: - Reducer

public enum ScrambleStatus: String, Codable { case playing, won, lost }
public enum ScrambleResult: String, Codable { case correct, wrong }

public struct ScrambleState: Codable, Equatable, ScrambleRows {
    public let seed: String
    public let id: String
    public let words: [ScrambleWord]
    public let `final`: ScrambleFinal
    public let caption: String
    /// Letters placed so far in each word (index 0–3) and the punchline (index 4).
    public var entries: [String]
    /// Words solved (0–3) and the punchline (4).
    public var solved: [Bool]
    /// Positions filled by REVEAL_LETTER per row, as a mask of "_" / letter.
    public var revealed: [String]
    public var checks: Int
    public var mistakes: Int
    public var hintsUsed: Int
    /// The row the last check judged and how (for the shake / fly animation).
    public var lastRow: Int?
    public var lastResult: ScrambleResult?
    public var events: [String]
    public var status: ScrambleStatus
    public var ended: Bool
    public var startTime: Double
    public var endTime: Double?

    public init(puzzle p: ScramblePuzzle, seed: String, startTime: Double) {
        let words = p.words.map { ScrambleWord(answer: $0.answer.uppercased(), scramble: $0.scramble.uppercased(), circled: $0.circled) }
        let final = ScrambleFinal(answer: p.final.answer.uppercased(), pattern: p.final.pattern)
        func blank(_ n: Int) -> String { String(repeating: "_", count: n) }
        self.seed = seed; id = p.id; self.words = words; self.final = final; caption = p.caption
        entries = ["", "", "", "", ""]; solved = [false, false, false, false, false]
        revealed = words.map { blank($0.answer.count) } + [blank(asciiCapitals(final.answer).count)]
        checks = 0; mistakes = 0; hintsUsed = 0; lastRow = nil; lastResult = nil; events = []
        status = .playing; ended = false; self.startTime = startTime; endTime = nil
    }
}

public func createScrambleState(_ p: ScramblePuzzle, seed: String, startTime: Double) -> ScrambleState {
    ScrambleState(puzzle: p, seed: seed, startTime: startTime)
}

public enum ScrambleAction: Equatable {
    case type(row: Int, letter: String)
    case back(row: Int)
    case clear(row: Int)
    case revealLetter(row: Int)
    case solveWord(row: Int)
    case finish
}

/// True when the punchline row may be played (all four words solved).
public func scrambleFinalOpen(_ s: ScrambleState) -> Bool { s.solved[0..<SCRAMBLE_FINAL].allSatisfy { $0 } }
/// The row the player should be working on: the first unsolved word, then the punchline.
public func scrambleActiveRow(_ s: ScrambleState) -> Int? {
    for i in 0..<SCRAMBLE_FINAL where !s.solved[i] { return i }
    return s.solved[SCRAMBLE_FINAL] ? nil : SCRAMBLE_FINAL
}
public func scrambleGuessCount(checks: Int, status: ScrambleStatus) -> Int { status == .lost ? SCRAMBLE_MAX_CHECKS : max(1, checks) }
public func scrambleGuessCount(_ s: ScrambleState) -> Int { scrambleGuessCount(checks: s.checks, status: s.status) }
public func scrambleBoardsSolved(solved: [Bool]) -> Int { solved.filter { $0 }.count }
public func scrambleBoardsSolved(_ s: ScrambleState) -> Int { scrambleBoardsSolved(solved: s.solved) }

private func rowOk(_ s: ScrambleState, _ row: Int) -> Bool {
    row >= 0 && row <= SCRAMBLE_FINAL && !s.solved[row] && (row < SCRAMBLE_FINAL || scrambleFinalOpen(s))
}
/// The mask's revealed letters — what a wrong check or CLEAR leaves in the row.
private func keptLetters(_ mask: String) -> String { mask.filter { $0 != "_" } }
/// JS `/^[A-Z]$/` after `toUpperCase()`: exactly one ASCII capital.
private func upperLetter(_ raw: String) -> Character? {
    let u = Array(raw.uppercased())
    guard u.count == 1, let ch = u.first, ch.isASCII, ch >= "A", ch <= "Z" else { return nil }
    return ch
}

private func judge(_ s: ScrambleState, _ row: Int, now: Double) -> ScrambleState {
    let entry = s.entries[row], target = scrambleTarget(s, row)
    if entry.count != target.count { return s }
    let checks = s.checks + 1
    var n = s
    if entry == target {
        n.solved[row] = true
        let won = n.solved[SCRAMBLE_FINAL]
        n.checks = checks; n.lastRow = row; n.lastResult = .correct; n.events.append("\(row)✓\(target)")
        n.status = won ? .won : s.status; n.ended = won; n.endTime = won ? now : s.endTime
        return n
    }
    let lost = checks >= SCRAMBLE_MAX_CHECKS
    // The wrong letters go back to the tray; revealed letters stay (and the whole try stays when the loss lands).
    n.entries[row] = lost ? entry : keptLetters(s.revealed[row])
    n.checks = checks; n.mistakes = s.mistakes + 1; n.lastRow = row; n.lastResult = .wrong; n.events.append("\(row)✗\(entry)")
    n.status = lost ? .lost : s.status; n.ended = lost; n.endTime = lost ? now : s.endTime
    return n
}

public func scrambleReduce(_ s: ScrambleState, _ a: ScrambleAction, now: Double = 0) -> ScrambleState {
    if case .finish = a { if s.status == .playing { return s }; var n = s; n.endTime = s.endTime ?? now; return n }
    if s.ended { return s }

    switch a {
    case .type(let row, let rawLetter):
        guard rowOk(s, row), let letter = upperLetter(rawLetter) else { return s }
        let entry = s.entries[row], target = scrambleTarget(s, row)
        if entry.count >= target.count { return s }
        // The next position may be pinned by a revealed letter; only that letter fits there.
        let mask = Array(s.revealed[row])
        let pinned = mask[entry.count]
        if pinned != "_" && pinned != letter { return s }
        if pinned == "_" && !scrambleRemaining(pool: scrambleTray(s, row), entry: entry).contains(letter) { return s }
        var n = s
        n.entries[row] = entry + String(letter); n.lastRow = nil; n.lastResult = nil
        return judge(n, row, now: now)
    case .back(let row):
        guard rowOk(s, row), !s.entries[row].isEmpty else { return s }
        let entry = Array(s.entries[row]), mask = Array(s.revealed[row])
        // Step back over pinned (revealed) letters to the last letter the player placed.
        var k = entry.count - 1
        while k >= 0 && mask[k] != "_" { k -= 1 }
        if k < 0 { return s }
        var n = s
        n.entries[row] = String(entry[0..<k]); n.lastRow = nil; n.lastResult = nil
        return n
    case .clear(let row):
        guard rowOk(s, row), !s.entries[row].isEmpty else { return s }
        var n = s
        n.entries[row] = keptLetters(s.revealed[row]); n.lastRow = nil; n.lastResult = nil
        return n
    case .revealLetter(let row):
        guard rowOk(s, row) else { return s }
        let target = Array(scrambleTarget(s, row))
        var mask = Array(s.revealed[row])
        guard let pos = mask.firstIndex(of: "_") else { return s }
        mask[pos] = target[pos]
        // Rebuild the entry as the revealed prefix: everything typed after a wrong spot is returned to the tray.
        var entry = ""
        for i in 0..<target.count { if mask[i] != "_" { entry.append(mask[i]) } else { break } }
        let newMask = String(mask)
        var n = s
        n.revealed[row] = newMask; n.entries[row] = entry; n.hintsUsed = s.hintsUsed + 1; n.lastRow = nil; n.lastResult = nil
        n.events.append("\(row)h\(newMask)")
        return judge(n, row, now: now)
    case .solveWord(let row):
        guard rowOk(s, row) else { return s }
        let target = scrambleTarget(s, row)
        var n = s
        n.solved[row] = true
        let won = n.solved[SCRAMBLE_FINAL]
        n.entries[row] = target; n.revealed[row] = target; n.hintsUsed = s.hintsUsed + 2
        n.lastRow = row; n.lastResult = .correct; n.events.append("\(row)H")
        n.status = won ? .won : s.status; n.ended = won; n.endTime = won ? now : s.endTime
        return n
    case .finish:
        return s
    }
}

// MARK: - Matches row ↔ state

/// solutions = [W1, W2, W3, W4, PUNCHLINE]; guesses = the event log.
public func scrambleMatchRow(_ s: ScrambleState) -> (solutions: [String], guesses: [String]) {
    (s.words.map { $0.answer } + [s.final.answer], s.events)
}

public struct ScrambleReconstruction: Equatable {
    public let words: [String]
    public let `final`: String
    public let solved: [Bool]
    public let checks: Int
    public let mistakes: Int
    public let hintsUsed: Int
    public let solvedByHint: [Int]
    public let boardsSolved: Int
    public let lost: Bool
    public let won: Bool
}

/// JS `/^[A-Z]{5,6}$/`.
private func isWordShaped(_ w: String) -> Bool {
    (5...6).contains(w.count) && w.allSatisfy { $0.isASCII && $0 >= "A" && $0 <= "Z" }
}
/// JS `/^[A-Z ]+$/`.
private func isFinalShaped(_ f: String) -> Bool {
    !f.isEmpty && f.allSatisfy { $0 == " " || ($0.isASCII && $0 >= "A" && $0 <= "Z") }
}
/// JS `Number(ev[0])` narrowed to a row 0–4, on the first UTF-16 unit: "0"–"4" are themselves, and a
/// whitespace-only string coerces to 0; anything else is NaN (→ the event is skipped).
private func jsRow(_ unit: UInt16) -> Int? {
    if unit >= 0x30 && unit <= 0x34 { return Int(unit - 0x30) }
    switch unit {
    case 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF: return 0
    default: return nil
    }
}

public func reconstructScramble(solutions: [String]?, guesses: [String]?) -> ScrambleReconstruction? {
    guard let solutions = solutions, solutions.count == 5 else { return nil }
    let words = Array(solutions[0..<4]), final = solutions[4]
    guard words.allSatisfy(isWordShaped), isFinalShaped(final) else { return nil }
    var solved = [false, false, false, false, false], solvedByHint: [Int] = []
    var checks = 0, mistakes = 0, hintsUsed = 0
    for ev in guesses ?? [] {
        let u = Array(ev.utf16)
        guard let first = u.first, let row = jsRow(first) else { continue }
        let sig: UInt16? = u.count > 1 ? u[1] : nil
        if sig == 0x2713 { solved[row] = true; checks += 1 }            // ✓
        else if sig == 0x2717 { checks += 1; mistakes += 1 }            // ✗
        else if sig == 0x68 { hintsUsed += 1 }                          // h
        else if sig == 0x48 { solved[row] = true; hintsUsed += 2; solvedByHint.append(row) } // H
    }
    let won = solved[4], lost = !won && checks >= SCRAMBLE_MAX_CHECKS
    return ScrambleReconstruction(words: words, final: final, solved: solved, checks: checks, mistakes: mistakes, hintsUsed: hintsUsed,
                                  solvedByHint: solvedByHint, boardsSolved: solved.filter { $0 }.count, lost: lost, won: won)
}
