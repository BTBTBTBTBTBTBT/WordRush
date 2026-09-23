import Foundation

/// Per-mode stats registry — 1:1 port of apps/web/lib/mode-stats.ts (More
/// Games §18, Stage 3b + the per-game profiles).
///
/// One pure, fixture-pinned mechanism instead of a hand-built panel per game:
/// every mode declares which stat lines its detail page shows (the 4×2 grid)
/// and which cards below the grid apply. The default profile reproduces the
/// word modes' eight cells byte-for-byte; each custom game has ONE profile row
/// whose cells are derived from the user_stats totals AND from a pure
/// aggregate over that mode's matches rows (`modeAggregates`).
///
/// Pinned by mode-stats-fixtures.json alongside the Kotlin and TS copies.
/// Regenerate: apps/server/node_modules/.bin/tsx apps/web/scripts/gen-mode-stats-fixtures.ts
public struct StatTotals {
    public var wins: Int
    public var losses: Int
    public var totalGames: Int
    /// Best (lowest) guess_count; 0 = none yet.
    public var bestScore: Int
    /// Fastest win in seconds; 0 = none yet.
    public var fastestTime: Int
    /// Current and best win streak for this mode + play type.
    public var streak: Int
    public var bestStreak: Int
    public init(wins: Int, losses: Int, totalGames: Int, bestScore: Int, fastestTime: Int, streak: Int, bestStreak: Int) {
        self.wins = wins; self.losses = losses; self.totalGames = totalGames
        self.bestScore = bestScore; self.fastestTime = fastestTime; self.streak = streak; self.bestStreak = bestStreak
    }
}

public struct StatLine: Equatable, Codable {
    public let label: String
    public let value: String
    public init(label: String, value: String) { self.label = label; self.value = value }
}

/// Which cards below the grid apply to a mode.
public struct StatPanels: Equatable, Codable {
    public let guessDistribution: Bool
    public let solveTime: Bool
    public let topWords: Bool
    public let openerYield: Bool
    public let positionAccuracy: Bool
    public let stageBreakdown: Bool
    public init(guessDistribution: Bool, solveTime: Bool, topWords: Bool, openerYield: Bool, positionAccuracy: Bool, stageBreakdown: Bool) {
        self.guessDistribution = guessDistribution; self.solveTime = solveTime; self.topWords = topWords
        self.openerYield = openerYield; self.positionAccuracy = positionAccuracy; self.stageBreakdown = stageBreakdown
    }
}

/// One matches row as the aggregate reads it. The app maps matches columns
/// onto these names (player1_score → guess_count, winner_id → completed,
/// player1_time → time_seconds); daily_results rows already carry them.
/// JSON keys are the fixture's snake_case names. A null boards_solved /
/// total_boards means "not stored on this row" — the aggregate rebuilds them
/// from the event log (matches has no boards columns; daily_results does).
public struct MatchRow: Codable, Equatable {
    public var guessCount: Int
    public var completed: Bool
    public var timeSeconds: Int
    public var hintsUsed: Int
    public var boardsSolved: Int?
    public var totalBoards: Int?
    public var player1Guesses: [String]
    public var solutions: [String]
    public var seed: String?

    public init(guessCount: Int, completed: Bool, timeSeconds: Int, hintsUsed: Int,
                boardsSolved: Int? = nil, totalBoards: Int? = nil,
                player1Guesses: [String], solutions: [String], seed: String? = nil) {
        self.guessCount = guessCount; self.completed = completed; self.timeSeconds = timeSeconds; self.hintsUsed = hintsUsed
        self.boardsSolved = boardsSolved; self.totalBoards = totalBoards
        self.player1Guesses = player1Guesses; self.solutions = solutions; self.seed = seed
    }

    enum CodingKeys: String, CodingKey {
        case guessCount = "guess_count"
        case completed
        case timeSeconds = "time_seconds"
        case hintsUsed = "hints_used"
        case boardsSolved = "boards_solved"
        case totalBoards = "total_boards"
        case player1Guesses = "player1_guesses"
        case solutions
        case seed
    }

    /// Lenient decode — the web reads `row.x || 0` / `Array.isArray(...)`, so a
    /// missing or null column never fails the whole aggregate.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        guessCount = try c.decodeIfPresent(Int.self, forKey: .guessCount) ?? 0
        completed = try c.decodeIfPresent(Bool.self, forKey: .completed) ?? false
        timeSeconds = try c.decodeIfPresent(Int.self, forKey: .timeSeconds) ?? 0
        hintsUsed = try c.decodeIfPresent(Int.self, forKey: .hintsUsed) ?? 0
        boardsSolved = try c.decodeIfPresent(Int.self, forKey: .boardsSolved)
        totalBoards = try c.decodeIfPresent(Int.self, forKey: .totalBoards)
        player1Guesses = try c.decodeIfPresent([String].self, forKey: .player1Guesses) ?? []
        solutions = try c.decodeIfPresent([String].self, forKey: .solutions) ?? []
        seed = try c.decodeIfPresent(String.self, forKey: .seed)
    }
}

/// Pure sums over a mode's matches rows — every field an integer or a string.
public struct ModeAggregates: Equatable, Codable {
    public var games: Int = 0
    public var wins: Int = 0
    /// Wins at the perfect guess_count with no hints — "Clean" / "Perfect".
    public var cleanWins: Int = 0
    /// Wins at the perfect guess_count, hints or not — Par Rate, Spyglass "Clean".
    public var perfectWins: Int = 0
    public var noHintWins: Int = 0
    /// Sum of guess_count over wins; a line divides by wins and subtracts guessBase.
    public var winGuessTotal: Int = 0
    /// Sum of time_seconds over wins with a positive time, and how many such wins.
    public var winTimeTotal: Int = 0
    public var timedWins: Int = 0
    /// Fastest win at the perfect guess_count (seconds; 0 = none).
    public var fastestPerfect: Int = 0
    /// Sums of boards_solved and total_boards over every game (stored or rebuilt).
    public var boardsSolved: Int = 0
    public var boardsTotal: Int = 0
    /// Kindred: games whose first solved group was the tier-4 (hardest) one.
    public var hardestFirst: Int = 0
    /// Hubbub: scored words using all seven letters, across every game.
    public var pangrams: Int = 0
    /// Hubbub: the longest word the player entered ("" = none).
    public var longestWord: String = ""

    public init() {}
    public static let empty = ModeAggregates()
}

public enum ModeStats {
    // MARK: Formatting primitives

    /// "-" for none, "45s", "2m", "2m 5s" — the grid's compact time (never "0s").
    public static func statTime(_ seconds: Int) -> String {
        if seconds <= 0 { return "-" }
        if seconds < 60 { return "\(seconds)s" }
        let m = seconds / 60, s = seconds % 60
        return s > 0 ? "\(m)m \(s)s" : "\(m)m"
    }

    public static func winRatePct(wins: Int, totalGames: Int) -> Int {
        totalGames > 0 ? Int((Double(wins) / Double(totalGames) * 100).rounded()) : 0
    }

    private static func pct(_ n: Int, _ d: Int) -> String {
        "\(d > 0 ? Int((Double(n) / Double(d) * 100).rounded()) : 0)%"
    }

    /// One-decimal average with integer maths: (total − sub·n) / n rounded to
    /// tenths, "-" when n is 0. 13 mistakes over 5 wins → "2.6"; 5 over 5 → "1.0".
    public static func avg1(_ total: Int, _ n: Int, _ sub: Int = 0) -> String {
        if n <= 0 { return "-" }
        let tenths = max(0, Int((Double((total - sub * n) * 10) / Double(n)).rounded()))
        return "\(tenths / 10).\(tenths % 10)"
    }

    // MARK: The perfect guess_count and board count per custom mode
    // guessBase is passed in from the catalog; the board counts are the engines'
    // constants (SCRAMBLE_TOTAL_BOARDS, HUB_TOTAL_BOARDS, GROUPS_TOTAL_BOARDS,
    // Spyglass's ten words), repeated here so this file stays dependency-free.
    private static let totalBoards: [String: Int] = ["SCRAMBLE": 5, "HUB": 20, "GROUPS": 4, "WORDSEARCH": 10]
    private static let wordsearchWords = 10

    /// Hubbub word score (hub.ts hubWordScore): 4 letters = 1, longer = length, pangram +7.
    private static func hubScore(_ word: String, _ letters: String) -> Int {
        (word.count == 4 ? 1 : word.count) + (isPangram(word, letters) ? 7 : 0)
    }
    private static func isPangram(_ word: String, _ letters: String) -> Bool {
        if letters.isEmpty { return false }
        for ch in letters where !word.contains(ch) { return false }
        return true
    }

    /// `^[A-Z]{4,}$`
    private static func isUpperWord(_ s: String) -> Bool {
        s.count >= 4 && s.allSatisfy { $0.isASCII && $0 >= "A" && $0 <= "Z" }
    }

    /// The event string after its one-character sigil.
    private static func rest(_ e: String) -> String { String(e.dropFirst()) }

    /// boards_solved for a row that did not store it, rebuilt from the event log
    /// exactly as the game's finaliser computed it. Anything unrecognised: the win
    /// flag over one board.
    public static func boardsFromEvents(_ dbKey: String, _ row: MatchRow) -> Int {
        let ev = row.player1Guesses
        switch dbKey {
        case "SCRAMBLE": // "i✓WORD" solved by the player, "iH" solved by hint — i is 0–3 words, 4 punchline
            let n = ev.filter { e in
                guard let i = e.first, let s = e.dropFirst().first else { return false }
                return ("0"..."4").contains(i) && (s == "✓" || s == "H")
            }.count
            return min(totalBoards["SCRAMBLE"]!, n)
        case "GROUPS": // "+t:W1,W2,W3,W4" solved tier t
            return min(totalBoards["GROUPS"]!, ev.filter { $0.hasPrefix("+") }.count)
        case "WORDSEARCH": // "+WORD" found (hinted words arrive as "?WORD" then "+WORD")
            return min(totalBoards["WORDSEARCH"]!, ev.filter { $0.hasPrefix("+") }.count)
        case "HUB": // floor(points × 20 / max); "+WORD" scored, "!WORD" revealed (also scored)
            let letters = row.solutions.count > 1 ? row.solutions[1] : ""
            let maxPts = row.solutions.count > 2 ? (Double(row.solutions[2]) ?? 0) : 0
            if maxPts <= 0 { return 0 }
            var points = 0
            for e in ev where e.hasPrefix("+") || e.hasPrefix("!") { points += hubScore(rest(e), letters) }
            let boards = totalBoards["HUB"]!
            return min(boards, Int((Double(points * boards) / maxPts).rounded(.down)))
        default:
            return row.completed ? 1 : 0
        }
    }

    /// The pure aggregate over a mode's matches rows. Order-independent (the one
    /// string field breaks ties alphabetically) so the newest-first web slice and a
    /// native cache in any order agree. Unknown modes still get the generic sums.
    public static func modeAggregates(_ dbKey: String, _ matches: [MatchRow], guessBase: Int = 1) -> ModeAggregates {
        var a = ModeAggregates()
        for row in matches {
            let won = row.completed
            let g = max(0, row.guessCount)
            let t = max(0, row.timeSeconds)
            let hints = max(0, row.hintsUsed)
            let ev = row.player1Guesses
            a.games += 1
            if won {
                a.wins += 1
                a.winGuessTotal += g
                if hints == 0 { a.noHintWins += 1 }
                if g == guessBase {
                    a.perfectWins += 1
                    if hints == 0 { a.cleanWins += 1 }
                    if t > 0 && (a.fastestPerfect == 0 || t < a.fastestPerfect) { a.fastestPerfect = t }
                }
                if t > 0 { a.winTimeTotal += t; a.timedWins += 1 }
            }
            let total: Int
            if let tb = row.totalBoards, tb > 0 { total = tb } else { total = totalBoards[dbKey] ?? 1 }
            let solved: Int
            if let bs = row.boardsSolved { solved = max(0, min(total, bs)) } else { solved = boardsFromEvents(dbKey, row) }
            a.boardsSolved += solved
            a.boardsTotal += total

            if dbKey == "GROUPS" {
                if let first = ev.first(where: { $0.hasPrefix("+") }), first.hasPrefix("+4:") { a.hardestFirst += 1 }
            }
            if dbKey == "HUB" {
                let letters = row.solutions.count > 1 ? row.solutions[1] : ""
                for e in ev {
                    guard let sigil = e.first else { continue }
                    let word = rest(e)
                    if (sigil != "+" && sigil != "=") || !isUpperWord(word) { continue }
                    if sigil == "+" && isPangram(word, letters) { a.pangrams += 1 }
                    if word.count > a.longestWord.count || (word.count == a.longestWord.count && word < a.longestWord) {
                        a.longestWord = word
                    }
                }
            }
        }
        return a
    }

    // MARK: Profiles

    private typealias Lines = (StatTotals, String, Int, ModeAggregates) -> [StatLine]

    /// The eight cells every word mode shows: Wins · Losses · Games · Win Rate · Best · Fastest · Streak · Best Streak.
    private static let defaultLines: Lines = { t, semantics, guessBase, _ in
        // "Best" is the best guess_count, read through the mode's semantics: "4 guesses"
        // stays a bare number for the word modes (today's display), but a Sudoku best
        // of guess_count 1 must read "0 mistakes", never "1".
        let best: String = t.bestScore > 0
            ? (semantics == "guesses" ? String(t.bestScore) : formatGuessStat(semantics: semantics, guessBase: guessBase, guessCount: t.bestScore))
            : "-"
        return [
            StatLine(label: "Wins", value: String(t.wins)),
            StatLine(label: "Losses", value: String(t.losses)),
            StatLine(label: "Games", value: String(t.totalGames)),
            StatLine(label: "Win Rate", value: "\(winRatePct(wins: t.wins, totalGames: t.totalGames))%"),
            StatLine(label: "Best", value: best),
            StatLine(label: "Fastest", value: statTime(t.fastestTime)),
            StatLine(label: "Streak", value: String(t.streak)),
            StatLine(label: "Best Streak", value: String(t.bestStreak)),
        ]
    }

    /// Sudoku, Starsweep: Wins · Losses · Win Rate · Clean · Avg Mistakes · Fastest · No-hint Wins · Streak.
    private static let mistakesLines: Lines = { t, _, base, a in [
        StatLine(label: "Wins", value: String(t.wins)),
        StatLine(label: "Losses", value: String(t.losses)),
        StatLine(label: "Win Rate", value: pct(t.wins, t.totalGames)),
        StatLine(label: "Clean", value: String(a.cleanWins)),
        StatLine(label: "Avg Mistakes", value: avg1(a.winGuessTotal, a.wins, base)),
        StatLine(label: "Fastest", value: statTime(t.fastestTime)),
        StatLine(label: "No-hint Wins", value: String(a.noHintWins)),
        StatLine(label: "Streak", value: String(t.streak)),
    ] }

    /// Letter Ladder: Wins · Losses · Par Rate · Avg Over Par · Fastest Par · No-hint Wins · Streak · Best Streak.
    private static let ladderLines: Lines = { t, _, base, a in [
        StatLine(label: "Wins", value: String(t.wins)),
        StatLine(label: "Losses", value: String(t.losses)),
        StatLine(label: "Par Rate", value: pct(a.perfectWins, a.wins)),
        StatLine(label: "Avg Over Par", value: avg1(a.winGuessTotal, a.wins, base)),
        StatLine(label: "Fastest Par", value: statTime(a.fastestPerfect)),
        StatLine(label: "No-hint Wins", value: String(a.noHintWins)),
        StatLine(label: "Streak", value: String(t.streak)),
        StatLine(label: "Best Streak", value: String(t.bestStreak)),
    ] }

    /// Muddle: Wins · Losses · Win Rate · Clean · Avg Checks · Fastest · Words Solved · Streak.
    private static let scrambleLines: Lines = { t, _, _, a in [
        StatLine(label: "Wins", value: String(t.wins)),
        StatLine(label: "Losses", value: String(t.losses)),
        StatLine(label: "Win Rate", value: pct(t.wins, t.totalGames)),
        StatLine(label: "Clean", value: String(a.cleanWins)),
        StatLine(label: "Avg Checks", value: avg1(a.winGuessTotal, a.wins)),
        StatLine(label: "Fastest", value: statTime(t.fastestTime)),
        StatLine(label: "Words Solved", value: String(a.boardsSolved)),
        StatLine(label: "Streak", value: String(t.streak)),
    ] }

    /// Spyglass: Cleared · Losses · Win Rate · Clean · Fastest · Avg Time · Sec / Word · Streak.
    private static let wordsearchLines: Lines = { t, _, _, a in
        let tenths = a.timedWins > 0 ? Int((Double(a.winTimeTotal * 10) / Double(a.timedWins * wordsearchWords)).rounded()) : 0
        let avgTime = a.timedWins > 0 ? Int((Double(a.winTimeTotal) / Double(a.timedWins)).rounded()) : 0
        return [
            StatLine(label: "Cleared", value: String(t.wins)),
            StatLine(label: "Losses", value: String(t.losses)),
            StatLine(label: "Win Rate", value: pct(t.wins, t.totalGames)),
            StatLine(label: "Clean", value: String(a.perfectWins)),
            StatLine(label: "Fastest", value: statTime(t.fastestTime)),
            StatLine(label: "Avg Time", value: statTime(avgTime)),
            StatLine(label: "Sec / Word", value: tenths > 0 ? "\(tenths / 10).\(tenths % 10)s" : "-"),
            StatLine(label: "Streak", value: String(t.streak)),
        ]
    }

    /// Hubbub: Days Played · Hubbub+ · Pandemonium · Best Rank · Avg % Max · Pangrams · Longest Word · Streak.
    private static let hubLines: Lines = { t, _, base, a in [
        StatLine(label: "Days Played", value: String(t.totalGames)),
        StatLine(label: "Hubbub+", value: String(t.wins)),
        StatLine(label: "Pandemonium", value: String(a.perfectWins)),
        StatLine(label: "Best Rank", value: t.bestScore > 0 ? formatGuessStat(semantics: "rank", guessBase: base, guessCount: t.bestScore) : "-"),
        StatLine(label: "Avg % Max", value: pct(a.boardsSolved, a.boardsTotal)),
        StatLine(label: "Pangrams", value: String(a.pangrams)),
        StatLine(label: "Longest Word", value: a.longestWord.isEmpty ? "-" : a.longestWord),
        StatLine(label: "Streak", value: String(t.streak)),
    ] }

    /// Crosswordocious, Codebreaker: Wins · Losses · Win Rate · Clean · No-hint Wins · Fastest · Avg Time · Streak.
    private static let checksLines: Lines = { t, _, _, a in
        let avgTime = a.timedWins > 0 ? Int((Double(a.winTimeTotal) / Double(a.timedWins)).rounded()) : 0
        return [
            StatLine(label: "Wins", value: String(t.wins)),
            StatLine(label: "Losses", value: String(t.losses)),
            StatLine(label: "Win Rate", value: pct(t.wins, t.totalGames)),
            StatLine(label: "Clean", value: String(a.cleanWins)),
            StatLine(label: "No-hint Wins", value: String(a.noHintWins)),
            StatLine(label: "Fastest", value: statTime(t.fastestTime)),
            StatLine(label: "Avg Time", value: statTime(avgTime)),
            StatLine(label: "Streak", value: String(t.streak)),
        ]
    }

    /// Kindred: Wins · Losses · Win Rate · Perfect · Avg Mistakes · Hardest 1st · Fastest · Streak.
    private static let groupsLines: Lines = { t, _, base, a in [
        StatLine(label: "Wins", value: String(t.wins)),
        StatLine(label: "Losses", value: String(t.losses)),
        StatLine(label: "Win Rate", value: pct(t.wins, t.totalGames)),
        StatLine(label: "Perfect", value: String(a.cleanWins)),
        StatLine(label: "Avg Mistakes", value: avg1(a.winGuessTotal, a.wins, base)),
        StatLine(label: "Hardest 1st", value: String(a.hardestFirst)),
        StatLine(label: "Fastest", value: statTime(t.fastestTime)),
        StatLine(label: "Streak", value: String(t.streak)),
    ] }

    private static let wordPanels = StatPanels(guessDistribution: true, solveTime: true, topWords: true, openerYield: true, positionAccuracy: true, stageBreakdown: false)
    /// Custom engines: solve-time trend only — no word rows, so no word-only cards.
    private static let customPanels = StatPanels(guessDistribution: false, solveTime: true, topWords: false, openerYield: false, positionAccuracy: false, stageBreakdown: false)
    /// Kindred (4–7 submissions) and Muddle (5–13 checks) have a histogram worth drawing.
    private static let customDistPanels = StatPanels(guessDistribution: true, solveTime: true, topWords: false, openerYield: false, positionAccuracy: false, stageBreakdown: false)

    private struct StatProfile {
        let lines: Lines
        let panels: StatPanels
    }

    /// Registry keyed by dbKey. Missing = the default word profile (word-only
    /// cards on for "guesses" semantics, off for any other).
    private static let profiles: [String: StatProfile] = [
        "GAUNTLET": StatProfile(lines: defaultLines, panels: StatPanels(guessDistribution: false, solveTime: true, topWords: true, openerYield: true, positionAccuracy: true, stageBreakdown: true)),
        // ProperNoundle guesses names, not words: the word grid + distribution apply,
        // but "Top words" / opener yield / position accuracy would be noise.
        "PROPERNOUNDLE": StatProfile(lines: defaultLines, panels: customDistPanels),
        "SUDOKU": StatProfile(lines: mistakesLines, panels: customPanels),
        "REGIONS": StatProfile(lines: mistakesLines, panels: customPanels),
        "LADDER": StatProfile(lines: ladderLines, panels: customPanels),
        "SCRAMBLE": StatProfile(lines: scrambleLines, panels: customDistPanels),
        "WORDSEARCH": StatProfile(lines: wordsearchLines, panels: customPanels),
        "HUB": StatProfile(lines: hubLines, panels: customPanels),
        "CROSSWORD": StatProfile(lines: checksLines, panels: customPanels),
        "CRYPTOGRAM": StatProfile(lines: checksLines, panels: customPanels),
        "GROUPS": StatProfile(lines: groupsLines, panels: customDistPanels),
    ]

    /// The 4×2 grid for a mode. `aggregates` is `modeAggregates(dbKey, matches)`;
    /// omitted (or no rows yet) every matches-derived cell reads "-", "0" or "0%".
    public static func statLines(dbKey: String, totals: StatTotals, semantics: String = "guesses", guessBase: Int = 1,
                                 aggregates: ModeAggregates? = nil) -> [StatLine] {
        (profiles[dbKey]?.lines ?? defaultLines)(totals, semantics, guessBase, aggregates ?? .empty)
    }

    public static func statPanels(dbKey: String, semantics: String = "guesses") -> StatPanels {
        if let p = profiles[dbKey] { return p.panels }
        // A mode whose guess_count is not "guesses" is a custom engine: no word-only cards.
        return semantics == "guesses" ? wordPanels : customPanels
    }

    // MARK: Guess-distribution card

    /// The histogram's bucket range for the custom games that draw one — Kindred
    /// 4–7 submissions, Muddle 5–13 checks. Nil = the word modes' own table.
    public static func guessDistributionRange(_ dbKey: String) -> (min: Int, max: Int)? {
        if dbKey == "GROUPS" { return (4, 7) }
        if dbKey == "SCRAMBLE" { return (5, 13) }
        return nil
    }

    /// The unit the histogram counts, singular and plural: guess / check / mistake / miss.
    public static func guessNoun(_ semantics: String) -> (one: String, many: String) {
        switch semantics {
        case "checks": return ("check", "checks")
        case "mistakes": return ("mistake", "mistakes")
        case "misses": return ("miss", "misses")
        default: return ("guess", "guesses")
        }
    }

    // MARK: Leaderboard / records labels through the semantics

    /// A leaderboard row's guess stat, title-cased the way the rows read today
    /// ("4 Guesses · 1:23"): "0 Mistakes", "5 Checks", "2 Misses", "Par",
    /// "+2 over par", "Hubbub".
    public static func guessRowLabel(semantics: String, guessBase: Int, guessCount: Int) -> String {
        let s = formatGuessStat(semantics: semantics, guessBase: guessBase, guessCount: guessCount)
        if semantics == "rank" { return s }
        if semantics == "overPar" { return s == "Par" ? s : "\(s) over par" }
        guard let sp = s.firstIndex(of: " ") else { return s }
        let after = s.index(after: sp)
        guard after < s.endIndex else { return s }
        return String(s[...sp]) + String(s[after]).uppercased() + String(s[s.index(after: after)...])
    }

    /// The "fewest_guesses" record's title for a mode: what a low guess_count means there.
    public static func fewestRecordLabel(_ semantics: String) -> String {
        switch semantics {
        case "mistakes": return "Fewest Mistakes"
        case "checks": return "Fewest Checks"
        case "overPar": return "Best vs Par"
        case "misses": return "Fewest Misses"
        case "rank": return "Best Rank"
        default: return "Fewest Guesses"
        }
    }
}
