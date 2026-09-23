import Foundation

// Kindred — groups of four (More Games §14). 1:1 port of
// packages/core/src/games/groups.ts; pinned by groups-fixtures.json
// (GroupsFixtureTests). Sixteen words hide four groups of four; find them all
// with at most four mistakes. Tiers 1–4 run from a plain category to wordplay.
// Submitting four words: a group → it locks; three from one group → "One away";
// otherwise a plain miss. A set already tried is free to try again. Four
// mistakes lose the puzzle. Hints: NAME A CATEGORY (1 hint) reveals the label
// of the easiest unsolved group; SHOW A PAIR (2 hints) rings two words that
// belong together. Event sigils (§11): "+t:W1,W2,W3,W4" solved tier t, "x1:…"
// one away, "x0:…" miss, "=…" a repeated set (free), "?ct" category hint,
// "?p:A,B" pair hint, "~n" shuffle n. Tile order comes from
// Mulberry32(simpleHash(seed + "-groups-v1")) so every platform deals the same board.

public let GROUPS_DAILY_EPOCH = "2026-09-23"
public let GROUPS_MAX_MISTAKES = 4
public let GROUPS_TOTAL_BOARDS = 4
public let GROUPS_PERFECT_GUESSES = 4

public struct GroupsGroup: Codable, Equatable {
    public let tier: Int
    public let label: String
    public let words: [String]
    public init(tier: Int, label: String, words: [String]) { self.tier = tier; self.label = label; self.words = words }
}

public struct GroupsPuzzle: Decodable, Equatable {
    public let id: String
    public let groups: [GroupsGroup]
    public let holiday: String?
    public init(id: String, groups: [GroupsGroup], holiday: String? = nil) { self.id = id; self.groups = groups; self.holiday = holiday }
}

public struct GroupsBank: Decodable {
    public let version: Int
    public let epoch: String
    public let daily: [GroupsPuzzle]
    public let extra: [GroupsPuzzle]
    public let holiday: [String: [GroupsPuzzle]]?
    public init(version: Int, epoch: String, daily: [GroupsPuzzle], extra: [GroupsPuzzle], holiday: [String: [GroupsPuzzle]]? = nil) {
        self.version = version; self.epoch = epoch; self.daily = daily; self.extra = extra; self.holiday = holiday
    }
    public static func load(from data: Data) -> GroupsBank? { try? JSONDecoder().decode(GroupsBank.self, from: data) }
    /// The app-bundled bank (Resources/groups-puzzles.json — sha-guarded to match the web copy).
    public static let bundled: GroupsBank? = {
        guard let url = Bundle.main.url(forResource: "groups-puzzles", withExtension: "json"), let data = try? Data(contentsOf: url) else { return nil }
        return load(from: data)
    }()
}

// MARK: - Bank lookups

/// The daily puzzle for `day`: the holiday's own entry when the calendar names one, else epoch-indexed.
public func groupsPuzzleForDay(_ bank: GroupsBank, day: String, holidays: HolidayTable? = nil) -> GroupsPuzzle? {
    if let pick = bankHolidayPick(day: day, table: holidays, holiday: bank.holiday) { return pick.entry }
    guard !bank.daily.isEmpty else { return nil }
    return bank.daily[Bank.indexForDay(day, n: bank.daily.count, epoch: bank.epoch)]
}
public func groupsPuzzleForSeed(_ bank: GroupsBank, seed: String) -> GroupsPuzzle? {
    let pool = bank.extra.isEmpty ? bank.daily : bank.extra
    guard !pool.isEmpty else { return nil }
    return pool[Bank.indexForSeed(seed, n: pool.count)]
}
public func groupsDailyNumber(_ day: String) -> Int {
    guard let idx = Bank.dayIndex(day, epoch: GROUPS_DAILY_EPOCH) else { return 1 }
    return max(1, idx + 1)
}

// MARK: - Dealing

/// Fisher–Yates from the end with j = rng() mod (i + 1) on the UInt32 output — the same shuffle on every platform.
public func groupsShuffle<T>(_ items: [T], _ rng: () -> UInt32) -> [T] {
    var a = items
    var i = a.count - 1
    while i > 0 {
        let j = Int(rng() % UInt32(i + 1))
        a.swapAt(i, j)
        i -= 1
    }
    return a
}
/// Groups in tier order (stable, like the JS sort).
private func byTier(_ groups: [GroupsGroup]) -> [GroupsGroup] {
    groups.enumerated().sorted { ($0.element.tier, $0.offset) < ($1.element.tier, $1.offset) }.map { $0.element }
}
/// The sixteen words in puzzle order (tier 1 first), then dealt by the seed.
public func groupsTileOrder(_ p: GroupsPuzzle, seed: String) -> [String] {
    let words = byTier(p.groups).flatMap { $0.words }
    var rng = Mulberry32(state: UInt32(truncatingIfNeeded: simpleHash("\(seed)-groups-v1")))
    return groupsShuffle(words) { rng.next() }
}

// MARK: - Reducer

public enum GroupsStatus: String, Codable { case playing, won, lost }
public enum GroupsResult: String, Codable { case correct, oneaway, wrong, `repeat`, short }

public struct GroupsState: Codable, Equatable {
    public let seed: String
    public let id: String
    public let groups: [GroupsGroup]
    /// Unsolved words in display order.
    public var tiles: [String]
    /// Groups in the order solved.
    public var solved: [GroupsGroup]
    public var selected: [String]
    public var mistakes: Int
    public var submissions: Int
    public var hintsUsed: Int
    /// Tiers whose label has been revealed by a hint.
    public var revealedTiers: [Int]
    /// Pairs shown by hints.
    public var pairs: [[String]]
    /// Sets already submitted and wrong ("A|B|C|D" sorted).
    public var wrongSets: [String]
    public var shuffles: Int
    public var lastResult: GroupsResult?
    public var events: [String]
    public var status: GroupsStatus
    public var ended: Bool
    public var startTime: Double
    public var endTime: Double?

    public init(puzzle p: GroupsPuzzle, seed: String, startTime: Double) {
        let groups = byTier(p.groups).map { GroupsGroup(tier: $0.tier, label: $0.label, words: $0.words.map { $0.uppercased() }) }
        self.seed = seed; id = p.id; self.groups = groups
        tiles = groupsTileOrder(GroupsPuzzle(id: p.id, groups: groups, holiday: p.holiday), seed: seed)
        solved = []; selected = []; mistakes = 0; submissions = 0; hintsUsed = 0
        revealedTiers = []; pairs = []; wrongSets = []; shuffles = 0; lastResult = nil; events = []; status = .playing; ended = false
        self.startTime = startTime; endTime = nil
    }
}

public func createGroupsState(_ p: GroupsPuzzle, seed: String, startTime: Double) -> GroupsState {
    GroupsState(puzzle: p, seed: seed, startTime: startTime)
}

public enum GroupsAction: Equatable {
    case toggle(word: String)
    case deselect
    case shuffle
    case submit
    case hintLabel
    case hintPair
    case finish
}

public struct GroupsPairTarget: Equatable {
    public let tier: Int
    public let pair: [String]
    public init(tier: Int, pair: [String]) { self.tier = tier; self.pair = pair }
}

private func setKey(_ words: [String]) -> String { words.sorted().joined(separator: "|") }
public func groupsUnsolved(_ s: GroupsState) -> [GroupsGroup] { s.groups.filter { g in !s.solved.contains { $0.tier == g.tier } } }
/// guess_count for the result row: submissions on a win, groups found + 4 on a loss (in play, the current count).
public func groupsGuessCount(_ s: GroupsState) -> Int {
    if s.status == .lost { return s.solved.count + GROUPS_MAX_MISTAKES }
    return max(s.submissions, s.solved.count)
}
public func groupsBoardsSolved(_ s: GroupsState) -> Int { s.solved.count }
/// The pair a Show-a-pair hint would ring: the two alphabetically first words of the easiest unsolved group not yet paired.
public func groupsPairTarget(_ s: GroupsState) -> GroupsPairTarget? {
    for g in groupsUnsolved(s) {
        let words = g.words.sorted()
        if s.pairs.contains(where: { p in p.count >= 2 && words.contains(p[0]) && words.contains(p[1]) }) { continue }
        return GroupsPairTarget(tier: g.tier, pair: [words[0], words[1]])
    }
    return nil
}
public func groupsLabelTarget(_ s: GroupsState) -> GroupsGroup? {
    groupsUnsolved(s).first { !s.revealedTiers.contains($0.tier) }
}

public func groupsReduce(_ s: GroupsState, _ a: GroupsAction, now: Double = 0) -> GroupsState {
    if case .finish = a { if s.status == .playing { return s }; var n = s; n.endTime = s.endTime ?? now; return n }
    if s.ended { return s }

    switch a {
    case .toggle(let raw):
        let w = raw.uppercased()
        if !s.tiles.contains(w) { return s }
        var n = s
        if s.selected.contains(w) { n.selected = s.selected.filter { $0 != w }; n.lastResult = nil; return n }
        if s.selected.count >= 4 { return s }
        n.selected = s.selected + [w]; n.lastResult = nil
        return n
    case .deselect:
        guard !s.selected.isEmpty else { return s }
        var n = s; n.selected = []; n.lastResult = nil
        return n
    case .shuffle:
        let count = s.shuffles + 1
        var rng = Mulberry32(state: UInt32(truncatingIfNeeded: simpleHash("\(s.seed)-groups-shuffle-\(count)")))
        var n = s
        n.tiles = groupsShuffle(s.tiles) { rng.next() }; n.shuffles = count; n.events.append("~\(count)")
        return n
    case .submit:
        var n = s
        if s.selected.count != 4 { n.lastResult = .short; return n }
        let key = setKey(s.selected)
        if s.wrongSets.contains(key) {
            n.lastResult = .repeat; n.events.append("=\(key.replacingOccurrences(of: "|", with: ","))")
            return n
        }
        let unsolved = groupsUnsolved(s)
        let hit = unsolved.first { g in s.selected.allSatisfy { g.words.contains($0) } }
        let submissions = s.submissions + 1
        if let hit = hit {
            let solved = s.solved + [hit]
            let won = solved.count == s.groups.count
            n.solved = solved; n.tiles = s.tiles.filter { !hit.words.contains($0) }; n.selected = []; n.submissions = submissions; n.lastResult = .correct
            n.events.append("+\(hit.tier):\(hit.words.joined(separator: ","))")
            if won { n.status = .won; n.ended = true; n.endTime = now }
            return n
        }
        let best = unsolved.map { g in s.selected.filter { g.words.contains($0) }.count }.max() ?? 0
        let oneAway = best == 3
        let mistakes = s.mistakes + 1
        let lost = mistakes >= GROUPS_MAX_MISTAKES
        n.mistakes = mistakes; n.submissions = submissions; n.wrongSets = s.wrongSets + [key]; n.lastResult = oneAway ? .oneaway : .wrong
        n.selected = lost ? [] : s.selected
        n.events.append("\(oneAway ? "x1" : "x0"):\(s.selected.sorted().joined(separator: ","))")
        if lost { n.status = .lost; n.ended = true; n.endTime = now }
        return n
    case .hintLabel:
        guard let g = groupsLabelTarget(s) else { return s }
        var n = s
        n.revealedTiers = s.revealedTiers + [g.tier]; n.hintsUsed = s.hintsUsed + 1; n.lastResult = nil; n.events.append("?c\(g.tier)")
        return n
    case .hintPair:
        guard let t = groupsPairTarget(s) else { return s }
        var n = s
        n.pairs = s.pairs + [t.pair]; n.hintsUsed = s.hintsUsed + 2; n.lastResult = nil; n.events.append("?p:\(t.pair.joined(separator: ","))")
        return n
    case .finish:
        return s
    }
}

// MARK: - Matches row ↔ state

/// solutions = ["tier|LABEL|W1,W2,W3,W4" × 4, tier order]; guesses = the event log.
public func groupsMatchRow(_ s: GroupsState) -> (solutions: [String], guesses: [String]) {
    (s.groups.map { "\($0.tier)|\($0.label)|\($0.words.joined(separator: ","))" }, s.events)
}

public struct GroupsReconstruction: Equatable {
    public let groups: [GroupsGroup]
    /// Tiers in the order solved.
    public let solvedTiers: [Int]
    public let mistakes: Int
    public let oneAways: Int
    public let submissions: Int
    public let hintsUsed: Int
    public let revealedTiers: [Int]
    public let pairs: [[String]]
    public let solved: Bool
}

/// JS `Number(str)` narrowed to the 1…4 tier range: nil unless it parses and lands in range.
private func tierNumber(_ str: String) -> Int? {
    guard let d = Double(str), d >= 1, d <= 4 else { return nil }
    return Int(d)
}

public func reconstructGroups(solutions: [String]?, guesses: [String]?) -> GroupsReconstruction? {
    guard let solutions = solutions, solutions.count == 4 else { return nil }
    var groups: [GroupsGroup] = []
    for sol in solutions {
        let parts = sol.split(separator: "|", omittingEmptySubsequences: false).map(String.init)
        if parts.count != 3 { return nil }
        let words = parts[2].split(separator: ",", omittingEmptySubsequences: false).map(String.init)
        guard let tier = tierNumber(parts[0]), words.count == 4 else { return nil }
        groups.append(GroupsGroup(tier: tier, label: parts[1], words: words))
    }
    var solvedTiers: [Int] = [], revealedTiers: [Int] = [], pairs: [[String]] = []
    var mistakes = 0, oneAways = 0, submissions = 0, hintsUsed = 0
    for ev in guesses ?? [] {
        if ev.hasPrefix("+") {
            // JS: ev.slice(1, ev.indexOf(':')) — without a colon that is slice(1, -1).
            let body: String
            if let ci = ev.firstIndex(of: ":") { body = String(ev[ev.index(after: ev.startIndex)..<ci]) } else { body = String(ev.dropFirst().dropLast()) }
            if let t = tierNumber(body), !solvedTiers.contains(t) { solvedTiers.append(t) }
            submissions += 1
        } else if ev.hasPrefix("x1") { mistakes += 1; oneAways += 1; submissions += 1 }
        else if ev.hasPrefix("x0") { mistakes += 1; submissions += 1 }
        else if ev.hasPrefix("?c") { if let t = tierNumber(String(ev.dropFirst(2))) { revealedTiers.append(t) }; hintsUsed += 1 }
        else if ev.hasPrefix("?p:") { pairs.append(String(ev.dropFirst(3)).split(separator: ",", omittingEmptySubsequences: false).map(String.init)); hintsUsed += 2 }
    }
    return GroupsReconstruction(groups: groups, solvedTiers: solvedTiers, mistakes: mistakes, oneAways: oneAways, submissions: submissions,
                                hintsUsed: hintsUsed, revealedTiers: revealedTiers, pairs: pairs, solved: solvedTiers.count == 4)
}
