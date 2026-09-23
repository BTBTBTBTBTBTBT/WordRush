import XCTest
@testable import WordociousCore

/// Mode-stats parity guard (iOS side): ModeStats.modeAggregates / statLines /
/// statPanels must match the web registry (lib/mode-stats.ts) for every fixture
/// case, so the profile grid reads the same on every platform.
/// Regenerate: apps/server/node_modules/.bin/tsx apps/web/scripts/gen-mode-stats-fixtures.ts
final class ModeStatsFixtureTests: XCTestCase {
    private struct Totals: Decodable { let wins: Int; let losses: Int; let totalGames: Int; let bestScore: Int; let fastestTime: Int; let streak: Int; let bestStreak: Int }
    private struct Case: Decodable {
        let dbKey: String
        let semantics: String
        let guessBase: Int
        let totals: Totals
        let matches: [MatchRow]
        let aggregates: ModeAggregates?
        let lines: [StatLine]
        let panels: StatPanels
    }

    private func loadCases() throws -> [Case] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "mode-stats-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode([Case].self, from: Data(contentsOf: url))
    }

    private func totals(_ t: Totals) -> StatTotals {
        StatTotals(wins: t.wins, losses: t.losses, totalGames: t.totalGames, bestScore: t.bestScore,
                   fastestTime: t.fastestTime, streak: t.streak, bestStreak: t.bestStreak)
    }

    func testModeStatsMatchSharedFixtures() throws {
        let cases = try loadCases()
        XCTAssertEqual(cases.count, 28)
        for (i, c) in cases.enumerated() {
            let tag = "\(c.dbKey)#\(i)"
            let agg = ModeStats.modeAggregates(c.dbKey, c.matches, guessBase: c.guessBase)
            if let expected = c.aggregates {
                XCTAssertEqual(agg, expected, "aggregates(\(tag))")
            }
            let got = ModeStats.statLines(dbKey: c.dbKey, totals: totals(c.totals), semantics: c.semantics, guessBase: c.guessBase, aggregates: agg)
            XCTAssertEqual(got.map { $0.label }, c.lines.map { $0.label }, "labels(\(tag))")
            XCTAssertEqual(got.map { $0.value }, c.lines.map { $0.value }, "values(\(tag))")
            XCTAssertEqual(ModeStats.statPanels(dbKey: c.dbKey, semantics: c.semantics), c.panels, "panels(\(tag))")
        }
    }

    func testEveryCustomGameHasAnEmptyAndAMatchesCase() throws {
        let cases = try loadCases()
        for key in ["SUDOKU", "REGIONS", "LADDER", "SCRAMBLE", "WORDSEARCH", "HUB", "CROSSWORD", "CRYPTOGRAM", "GROUPS"] {
            let mine = cases.filter { $0.dbKey == key }
            XCTAssertTrue(mine.contains { $0.totals.totalGames == 0 && $0.matches.isEmpty }, "\(key) empty")
            XCTAssertTrue(mine.contains { $0.matches.count >= 3 }, "\(key) matches")
            for c in mine {
                XCTAssertEqual(c.lines.count, 8, "\(key) has eight cells")
                for l in c.lines {
                    XCTAssertLessThanOrEqual(l.label.count, 12, "\(key) label \"\(l.label)\" fits the grid")
                    XCTAssertFalse(l.value.contains("NaN") || l.value.contains("undefined") || l.value == "0s", "\(key) \(l.label)")
                }
            }
        }
    }

    func testDefaultProfileIsTheWordModesEightCells() {
        let lines = ModeStats.statLines(dbKey: "DUEL", totals: StatTotals(wins: 41, losses: 6, totalGames: 47, bestScore: 2, fastestTime: 125, streak: 3, bestStreak: 12))
        XCTAssertEqual(lines.map { $0.label }, ["Wins", "Losses", "Games", "Win Rate", "Best", "Fastest", "Streak", "Best Streak"])
        XCTAssertEqual(lines.map { $0.value }, ["41", "6", "47", "87%", "2", "2m 5s", "3", "12"])
        let zero = StatTotals(wins: 0, losses: 0, totalGames: 0, bestScore: 0, fastestTime: 0, streak: 0, bestStreak: 0)
        XCTAssertEqual(ModeStats.statLines(dbKey: "DUEL", totals: zero).map { $0.value }, ["0", "0", "0", "0%", "-", "-", "0", "0"])
        // A word mode ignores aggregates entirely.
        var agg = ModeAggregates.empty; agg.wins = 99
        XCTAssertEqual(ModeStats.statLines(dbKey: "QUORDLE", totals: StatTotals(wins: 1, losses: 0, totalGames: 1, bestScore: 5, fastestTime: 60, streak: 1, bestStreak: 1),
                                           semantics: "guesses", guessBase: 4, aggregates: agg)[0].value, "1")
        // Best Rank is a rank NAME, never a number; ProperNoundle keeps the word grid.
        let t = StatTotals(wins: 1, losses: 0, totalGames: 1, bestScore: 4, fastestTime: 300, streak: 1, bestStreak: 1)
        XCTAssertEqual(ModeStats.statLines(dbKey: "HUB", totals: t, semantics: "rank", guessBase: 1)[3].value, "Hubbub")
        XCTAssertEqual(ModeStats.statLines(dbKey: "PROPERNOUNDLE", totals: t)[4].label, "Best")
    }

    func testAvg1AndNoDataAreNeverNaNOrZeroSeconds() {
        XCTAssertEqual(ModeStats.avg1(0, 0), "-")
        XCTAssertEqual(ModeStats.avg1(7, 4, 1), "0.8")
        XCTAssertEqual(ModeStats.avg1(5, 5, 1), "0.0")
        XCTAssertEqual(ModeStats.avg1(3, 4, 1), "0.0") // never negative
        XCTAssertEqual(ModeStats.avg1(13, 5, 0), "2.6")
        let zero = StatTotals(wins: 0, losses: 0, totalGames: 0, bestScore: 0, fastestTime: 0, streak: 0, bestStreak: 0)
        for (k, s, b) in [("SUDOKU", "mistakes", 1), ("LADDER", "overPar", 1), ("SCRAMBLE", "checks", 5), ("WORDSEARCH", "misses", 10), ("HUB", "rank", 1), ("CROSSWORD", "checks", 1), ("GROUPS", "guesses", 4)] {
            for l in ModeStats.statLines(dbKey: k, totals: zero, semantics: s, guessBase: b) {
                XCTAssertTrue(["-", "0", "0%"].contains(l.value), "\(k) \(l.label) = \(l.value)")
            }
        }
    }

    func testBoardsRebuildFromTheEventLog() {
        func row(_ g: Int, _ ev: [String], completed: Bool = true, solutions: [String] = [], boards: Int? = nil, total: Int? = nil) -> MatchRow {
            MatchRow(guessCount: g, completed: completed, timeSeconds: 100, hintsUsed: 0, boardsSolved: boards, totalBoards: total,
                     player1Guesses: ev, solutions: solutions)
        }
        XCTAssertEqual(ModeStats.boardsFromEvents("SCRAMBLE", row(6, ["0✓BREAD", "1✗PAGER", "1✓PAGER", "2H", "3h__N___"])), 3)
        XCTAssertEqual(ModeStats.boardsFromEvents("GROUPS", row(5, ["x0:A,B,C,D", "+1:A,B,C,D", "+3:E,F,G,H"])), 2)
        XCTAssertEqual(ModeStats.boardsFromEvents("WORDSEARCH", row(11, ["+CAT", "x 0,0>1,1", "?DOG", "+DOG"])), 2)
        // Hubbub: TRAIN 5 + RETINAL 14 = 19 of 60 → floor(19 × 20 / 60) = 6.
        XCTAssertEqual(ModeStats.boardsFromEvents("HUB", row(4, ["+TRAIN", "=TALER", "+RETINAL"], solutions: ["id", "ATLNEIR", "60", "24", "2"])), 6)
        XCTAssertEqual(ModeStats.boardsFromEvents("SUDOKU", row(1, [])), 1)
        XCTAssertEqual(ModeStats.boardsFromEvents("SUDOKU", row(4, [], completed: false)), 0)
        // A stored boards_solved wins over the rebuild.
        let agg = ModeStats.modeAggregates("HUB", [row(3, ["+TRAIN"], solutions: ["id", "ATLNEIR", "60"], boards: 15, total: 20)], guessBase: 1)
        XCTAssertEqual([agg.boardsSolved, agg.boardsTotal], [15, 20])
    }

    func testAggregatesAreOrderIndependent() throws {
        let rows = try XCTUnwrap(loadCases().first { $0.dbKey == "HUB" && !$0.matches.isEmpty }).matches
        XCTAssertEqual(ModeStats.modeAggregates("HUB", rows.reversed(), guessBase: 1), ModeStats.modeAggregates("HUB", rows, guessBase: 1))
    }

    func testPanelsAndDistributionHelpers() {
        XCTAssertFalse(ModeStats.statPanels(dbKey: "GAUNTLET").guessDistribution)
        XCTAssertTrue(ModeStats.statPanels(dbKey: "GAUNTLET").stageBreakdown)
        XCTAssertTrue(ModeStats.statPanels(dbKey: "DUEL").topWords)
        XCTAssertEqual(ModeStats.statPanels(dbKey: "PROPERNOUNDLE"),
                       StatPanels(guessDistribution: true, solveTime: true, topWords: false, openerYield: false, positionAccuracy: false, stageBreakdown: false))
        XCTAssertTrue(ModeStats.statPanels(dbKey: "GROUPS", semantics: "guesses").guessDistribution)
        XCTAssertTrue(ModeStats.statPanels(dbKey: "SCRAMBLE", semantics: "checks").guessDistribution)
        for k in ["SUDOKU", "REGIONS", "LADDER", "WORDSEARCH", "HUB", "CROSSWORD", "CRYPTOGRAM"] {
            XCTAssertEqual(ModeStats.statPanels(dbKey: k, semantics: "mistakes"),
                           StatPanels(guessDistribution: false, solveTime: true, topWords: false, openerYield: false, positionAccuracy: false, stageBreakdown: false), k)
        }
        // An unregistered custom-semantics mode gets the custom panels; a word one the word panels.
        XCTAssertFalse(ModeStats.statPanels(dbKey: "SOMETHING_NEW", semantics: "checks").topWords)
        XCTAssertTrue(ModeStats.statPanels(dbKey: "SOMETHING_NEW", semantics: "guesses").topWords)
        XCTAssertEqual(ModeStats.guessDistributionRange("GROUPS").map { [$0.min, $0.max] }, [4, 7])
        XCTAssertEqual(ModeStats.guessDistributionRange("SCRAMBLE").map { [$0.min, $0.max] }, [5, 13])
        XCTAssertNil(ModeStats.guessDistributionRange("DUEL"))
        XCTAssertEqual(ModeStats.guessNoun("checks").one, "check")
        XCTAssertEqual(ModeStats.guessNoun("checks").many, "checks")
        XCTAssertEqual(ModeStats.guessNoun("mistakes").many, "mistakes")
        XCTAssertEqual(ModeStats.guessNoun("misses").one, "miss")
        XCTAssertEqual(ModeStats.guessNoun("guesses").many, "guesses")
    }

    func testLeaderboardRowsAndRecordsReadThroughTheSemantics() {
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "guesses", guessBase: 1, guessCount: 4), "4 Guesses")
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "guesses", guessBase: 1, guessCount: 1), "1 Guess")
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "mistakes", guessBase: 1, guessCount: 1), "0 Mistakes")
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "mistakes", guessBase: 1, guessCount: 2), "1 Mistake")
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "checks", guessBase: 5, guessCount: 5), "5 Checks")
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "checks", guessBase: 1, guessCount: 3), "2 Checks")
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "misses", guessBase: 10, guessCount: 12), "2 Misses")
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "overPar", guessBase: 1, guessCount: 1), "Par")
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "overPar", guessBase: 1, guessCount: 3), "+2 over par")
        XCTAssertEqual(ModeStats.guessRowLabel(semantics: "rank", guessBase: 1, guessCount: 4), "Hubbub")
        XCTAssertEqual(ModeStats.fewestRecordLabel("guesses"), "Fewest Guesses")
        XCTAssertEqual(ModeStats.fewestRecordLabel("mistakes"), "Fewest Mistakes")
        XCTAssertEqual(ModeStats.fewestRecordLabel("checks"), "Fewest Checks")
        XCTAssertEqual(ModeStats.fewestRecordLabel("overPar"), "Best vs Par")
        XCTAssertEqual(ModeStats.fewestRecordLabel("misses"), "Fewest Misses")
        XCTAssertEqual(ModeStats.fewestRecordLabel("rank"), "Best Rank")
    }

    func testMatchRowDecodesTheFixtureKeysAndToleratesNulls() throws {
        let json = """
        {"guess_count": 5, "completed": true, "time_seconds": 112, "hints_used": null, "boards_solved": null,
         "total_boards": null, "player1_guesses": ["0✓BREAD"], "solutions": null, "seed": "daily-2026-09-23-SCRAMBLE"}
        """.data(using: .utf8)!
        let row = try JSONDecoder().decode(MatchRow.self, from: json)
        XCTAssertEqual(row.guessCount, 5)
        XCTAssertTrue(row.completed)
        XCTAssertEqual(row.timeSeconds, 112)
        XCTAssertEqual(row.hintsUsed, 0)
        XCTAssertNil(row.boardsSolved)
        XCTAssertNil(row.totalBoards)
        XCTAssertEqual(row.player1Guesses, ["0✓BREAD"])
        XCTAssertEqual(row.solutions, [])
        XCTAssertEqual(row.seed, "daily-2026-09-23-SCRAMBLE")
    }
}
