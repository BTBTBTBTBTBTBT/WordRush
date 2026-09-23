import Foundation

// Codebreaker — cryptogram (More Games §16). 1:1 port of
// packages/core/src/games/cryptogram.ts; pinned by cryptogram-fixtures.json
// (CryptogramFixtureTests). A saying is written in a stored 26-letter
// derangement; the three most frequent letters are given and locked. Letters
// are pencil: set / change / clear are free. CHECK clears wrong letters and
// locks right ones (guess_count = min(checks, 3) + 1); HINT reveals the most
// frequent unresolved code letter; REVEAL fills the answer as a loss. Event
// sigils: "=C:P" set, "-C" cleared, "#n" check, "?C" hint, "!" reveal.

public let CRYPTOGRAM_DAILY_EPOCH = "2026-09-23"
public let CRYPTOGRAM_MAX_CHECKS = 3
public let CRYPTOGRAM_REVEAL_AFTER_SECONDS = 300
public let CRYPTOGRAM_TOTAL_BOARDS = 1
public let CRYPTOGRAM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
private let alphabet: [String] = CRYPTOGRAM_ALPHABET.map { String($0) }

public struct CryptogramPuzzle: Decodable, Equatable {
    public let id: String
    /// The saying, as displayed (mixed case, punctuation).
    public let text: String
    /// 26 uppercase letters: key[i] is the CODE letter for plain letter ALPHABET[i]. A derangement.
    public let key: String
    /// Plain letters given (locked) from the start — the three most frequent.
    public let given: [String]
    public let holiday: String?
    public init(id: String, text: String, key: String, given: [String], holiday: String? = nil) {
        self.id = id; self.text = text; self.key = key; self.given = given; self.holiday = holiday
    }
}

public struct CryptogramBank: Decodable {
    public let version: Int
    public let epoch: String
    public let daily: [CryptogramPuzzle]
    public let extra: [CryptogramPuzzle]
    public let holiday: [String: [CryptogramPuzzle]]?
    public init(version: Int, epoch: String, daily: [CryptogramPuzzle], extra: [CryptogramPuzzle], holiday: [String: [CryptogramPuzzle]]? = nil) {
        self.version = version; self.epoch = epoch; self.daily = daily; self.extra = extra; self.holiday = holiday
    }
    public static func load(from data: Data) -> CryptogramBank? { try? JSONDecoder().decode(CryptogramBank.self, from: data) }
    /// The app-bundled bank (Resources/cryptogram-puzzles.json — sha-guarded to match the web copy).
    public static let bundled: CryptogramBank? = {
        guard let url = Bundle.main.url(forResource: "cryptogram-puzzles", withExtension: "json"), let data = try? Data(contentsOf: url) else { return nil }
        return load(from: data)
    }()
}

// MARK: - Cipher helpers

/// JS `String.prototype.includes`: substring search, true for the empty needle.
private func jsIncludes(_ hay: String, _ needle: String) -> Bool { needle.isEmpty || hay.contains(needle) }

/// The saying enciphered: letters mapped through the key, everything else kept.
public func cryptogramEncipher(_ text: String, key: String) -> String {
    let k = Array(key)
    var out = ""
    for ch in text.uppercased() {
        if let i = alphabet.firstIndex(of: String(ch)), i < k.count { out.append(k[i]) } else { out.append(ch) }
    }
    return out
}
/// The plain letter a CODE letter stands for ("" when unknown).
public func cryptogramPlainFor(_ code: String, key: String) -> String {
    guard code.count == 1, let c = code.first, let i = key.firstIndex(of: c) else { return "" }
    let n = key.distance(from: key.startIndex, to: i)
    return n < alphabet.count ? alphabet[n] : ""
}
/// The CODE letter for a plain letter ("" when unknown).
public func cryptogramCodeFor(_ plain: String, key: String) -> String {
    guard let i = alphabet.firstIndex(of: plain) else { return "" }
    let k = Array(key)
    return i < k.count ? String(k[i]) : ""
}
/// Distinct code letters that occur in the cipher text, alphabetical.
public func cryptogramCodeLetters(_ cipher: String) -> [String] {
    var set = Set<String>()
    for ch in cipher { let s = String(ch); if alphabet.contains(s) { set.insert(s) } }
    return set.sorted()
}
/// Occurrences of each code letter in the cipher text (the frequency strip).
public func cryptogramFrequencies(_ cipher: String) -> [String: Int] {
    var out: [String: Int] = [:]
    for ch in cipher { let s = String(ch); if alphabet.contains(s) { out[s, default: 0] += 1 } }
    return out
}

// MARK: - Bank lookups

/// The daily puzzle for `day`: the holiday's own entry when the calendar names one, else epoch-indexed.
public func cryptogramPuzzleForDay(_ bank: CryptogramBank, day: String, holidays: HolidayTable? = nil) -> CryptogramPuzzle? {
    if let pick = bankHolidayPick(day: day, table: holidays, holiday: bank.holiday) { return pick.entry }
    guard !bank.daily.isEmpty else { return nil }
    return bank.daily[Bank.indexForDay(day, n: bank.daily.count, epoch: bank.epoch)]
}
public func cryptogramPuzzleForSeed(_ bank: CryptogramBank, seed: String) -> CryptogramPuzzle? {
    let pool = bank.extra.isEmpty ? bank.daily : bank.extra
    guard !pool.isEmpty else { return nil }
    return pool[Bank.indexForSeed(seed, n: pool.count)]
}
public func cryptogramDailyNumber(_ day: String) -> Int {
    guard let idx = Bank.dayIndex(day, epoch: CRYPTOGRAM_DAILY_EPOCH) else { return 1 }
    return max(1, idx + 1)
}

// MARK: - Reducer

public enum CryptogramStatus: String, Codable { case playing, won, lost }

public struct CryptogramState: Codable, Equatable {
    public let seed: String
    public let id: String
    public let text: String
    public let key: String
    public let cipher: String
    public let given: [String]
    /// code letter → the plain letter the player has pencilled in.
    public var mapping: [String: String]
    /// Code letters that can no longer change: given, checked-correct, hinted, revealed. Alphabetical.
    public var locked: [String]
    /// Code letters filled by Hint, in hint order.
    public var hinted: [String]
    public var hintsUsed: Int
    public var checks: Int
    /// Code letters the last Check cleared (for the red flash); empty otherwise.
    public var lastWrong: [String]
    public var events: [String]
    public var status: CryptogramStatus
    public var ended: Bool
    public var startTime: Double
    public var endTime: Double?

    public init(puzzle p: CryptogramPuzzle, seed: String, startTime: Double) {
        let cipher = cryptogramEncipher(p.text, key: p.key)
        var mapping: [String: String] = [:]
        var locked: [String] = []
        for plain in p.given {
            let code = cryptogramCodeFor(plain, key: p.key)
            if !code.isEmpty && cipher.contains(code) { mapping[code] = plain; locked.append(code) }
        }
        locked.sort()
        self.seed = seed; id = p.id; text = p.text; key = p.key; self.cipher = cipher; given = p.given; self.mapping = mapping; self.locked = locked
        hinted = []; hintsUsed = 0; checks = 0; lastWrong = []; events = []; status = .playing; ended = false; self.startTime = startTime; endTime = nil
    }
}

public func createCryptogramState(_ p: CryptogramPuzzle, seed: String, startTime: Double) -> CryptogramState {
    CryptogramState(puzzle: p, seed: seed, startTime: startTime)
}

public enum CryptogramAction: Equatable {
    case set(code: String, plain: String?)
    case check
    case hint
    case reveal
    case finish
}

/// True when every code letter in the text is mapped to its true plain letter.
public func cryptogramIsSolved(cipher: String, key: String, mapping: [String: String]) -> Bool {
    for code in cryptogramCodeLetters(cipher) where mapping[code] != cryptogramPlainFor(code, key: key) { return false }
    return true
}
public func cryptogramIsSolved(_ s: CryptogramState) -> Bool { cryptogramIsSolved(cipher: s.cipher, key: s.key, mapping: s.mapping) }
/// Plain letters used for more than one code letter (shown red; block completion by definition).
public func cryptogramConflicts(_ mapping: [String: String]) -> [String] {
    var seen: [String: Int] = [:]
    for p in mapping.values { seen[p, default: 0] += 1 }
    return seen.filter { $0.value > 1 }.map { $0.key }.sorted()
}
/// Code letters in the text right now correct (mapped to the truth).
public func cryptogramCorrectCount(cipher: String, key: String, mapping: [String: String]) -> Int {
    var n = 0
    for code in cryptogramCodeLetters(cipher) where mapping[code] == cryptogramPlainFor(code, key: key) { n += 1 }
    return n
}
public func cryptogramCorrectCount(_ s: CryptogramState) -> Int { cryptogramCorrectCount(cipher: s.cipher, key: s.key, mapping: s.mapping) }
/// guess_count for the result row: no Check = 1, capped at MAX_CHECKS + 1.
public func cryptogramGuessCount(_ checks: Int) -> Int { min(checks, CRYPTOGRAM_MAX_CHECKS) + 1 }

/// The Hint target: the most frequent code letter not yet correct-and-locked; ties alphabetical.
public func cryptogramHintTarget(_ s: CryptogramState) -> String? {
    let freq = cryptogramFrequencies(s.cipher)
    var best: String? = nil
    for code in cryptogramCodeLetters(s.cipher) {
        if s.locked.contains(code) && s.mapping[code] == cryptogramPlainFor(code, key: s.key) { continue }
        guard let b = best else { best = code; continue }
        let fc = freq[code] ?? 0, fb = freq[b] ?? 0
        if fc > fb || (fc == fb && code < b) { best = code }
    }
    return best
}

private func settle(_ s: CryptogramState, _ now: Double) -> CryptogramState {
    if s.status == .playing && cryptogramIsSolved(s) { var n = s; n.status = .won; n.ended = true; n.endTime = now; return n }
    return s
}
private func addLocked(_ locked: [String], _ code: String) -> [String] { locked.contains(code) ? locked : (locked + [code]).sorted() }

public func cryptogramReduce(_ s: CryptogramState, _ a: CryptogramAction, now: Double = 0) -> CryptogramState {
    if case .finish = a { if s.status == .playing { return s }; var n = s; n.endTime = s.endTime ?? now; return n }
    if s.ended { return s }

    switch a {
    case .set(let rawCode, let rawPlain):
        let code = rawCode.uppercased()
        if !jsIncludes(CRYPTOGRAM_ALPHABET, code) || !jsIncludes(s.cipher, code) || s.locked.contains(code) { return s }
        var n = s
        if rawPlain == nil || rawPlain == "" {
            if n.mapping[code] == nil { return s }
            n.mapping.removeValue(forKey: code)
            n.lastWrong = []; n.events.append("-\(code)")
            return n
        }
        let plain = rawPlain!.uppercased()
        if !jsIncludes(CRYPTOGRAM_ALPHABET, plain) || plain.count != 1 { return s }
        if n.mapping[code] == plain { return s }
        n.mapping[code] = plain
        n.lastWrong = []; n.events.append("=\(code):\(plain)")
        return settle(n, now)
    case .check:
        var n = s
        var wrong: [String] = []
        for code in s.mapping.keys.sorted() {
            if s.mapping[code] == cryptogramPlainFor(code, key: s.key) { n.locked = addLocked(n.locked, code) }
            else { n.mapping.removeValue(forKey: code); wrong.append(code) }
        }
        n.checks += 1; n.lastWrong = wrong; n.events.append("#\(wrong.count)")
        return n
    case .hint:
        guard let code = cryptogramHintTarget(s), !code.isEmpty else { return s }
        var n = s
        n.mapping[code] = cryptogramPlainFor(code, key: s.key)
        n.locked = addLocked(s.locked, code); n.hinted.append(code); n.hintsUsed += 1
        n.lastWrong = []; n.events.append("?\(code)")
        return settle(n, now)
    case .reveal:
        var n = s
        let codes = cryptogramCodeLetters(s.cipher)
        var mapping: [String: String] = [:]
        for code in codes { mapping[code] = cryptogramPlainFor(code, key: s.key) }
        n.mapping = mapping; n.locked = codes; n.lastWrong = []; n.events.append("!")
        n.status = .lost; n.ended = true; n.endTime = now
        return n
    case .finish:
        return s
    }
}

// MARK: - Matches row ↔ state

/// solutions = [text, key26, id]; guesses = ["=" + mapping26, "h" + mask26, "c" + checks]
/// where position i of each 26-string is CODE letter ALPHABET[i]: mapping26 holds
/// the pencilled plain letter or "."; mask26 holds "g" given, "h" hinted, "r"
/// revealed, "l" locked by a Check, "." otherwise.
public func cryptogramMatchRow(_ s: CryptogramState) -> (solutions: [String], guesses: [String]) {
    var mapping26 = "", mask26 = ""
    let givenCodes = s.given.map { cryptogramCodeFor($0, key: s.key) }
    let revealed = s.status == .lost && s.events.contains("!")
    for code in alphabet {
        mapping26 += s.mapping[code] ?? "."
        if !s.cipher.contains(code) { mask26 += "." }
        else if givenCodes.contains(code) { mask26 += "g" }
        else if s.hinted.contains(code) { mask26 += "h" }
        else if revealed { mask26 += "r" }
        else if s.locked.contains(code) { mask26 += "l" }
        else { mask26 += "." }
    }
    return ([s.text, s.key, s.id], ["=\(mapping26)", "h\(mask26)", "c\(s.checks)"])
}

public struct CryptogramReconstruction: Equatable {
    public let id: String, text: String, key: String, cipher: String
    public let mapping: [String: String], given: [String], hinted: [String], revealed: Bool, checks: Int
    public let correct: Int, total: Int, solved: Bool
}

public func reconstructCryptogram(solutions: [String]?, guesses: [String]?) -> CryptogramReconstruction? {
    guard let solutions = solutions, solutions.count >= 2 else { return nil }
    let text = solutions[0], key = solutions[1]
    let id = solutions.count > 2 ? solutions[2] : ""
    guard !text.isEmpty, key.count == 26, key.allSatisfy({ ("A"..."Z").contains($0) }), Set(key).count == 26 else { return nil }
    let cipher = cryptogramEncipher(text, key: key)
    var mapping: [String: String] = [:], given: [String] = [], hinted: [String] = []
    var revealed = false, checks = 0
    for g in guesses ?? [] {
        let chars = Array(g)
        guard let sigil = chars.first else { continue }
        if sigil == "=" && chars.count == 27 {
            for i in 0..<26 where chars[i + 1] != "." { mapping[alphabet[i]] = String(chars[i + 1]) }
        } else if sigil == "h" && chars.count == 27 {
            for i in 0..<26 {
                let c = chars[i + 1], code = alphabet[i]
                if c == "g" { given.append(cryptogramPlainFor(code, key: key)) } else if c == "h" { hinted.append(code) } else if c == "r" { revealed = true }
            }
        } else if sigil == "c" {
            checks = max(0, Int(String(chars.dropFirst())) ?? 0)
        }
    }
    let total = cryptogramCodeLetters(cipher).count
    let correct = cryptogramCorrectCount(cipher: cipher, key: key, mapping: mapping)
    return CryptogramReconstruction(id: id, text: text, key: key, cipher: cipher, mapping: mapping, given: given, hinted: hinted, revealed: revealed,
                                    checks: checks, correct: correct, total: total, solved: !revealed && correct == total)
}
