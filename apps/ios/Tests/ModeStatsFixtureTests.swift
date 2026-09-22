import XCTest
@testable import WordociousCore

/// Mode-stats parity guard (iOS side): ModeStats.lines / panels must match the
/// web registry (lib/mode-stats.ts) for every fixture case, so the profile grid
/// reads the same on every platform. Regenerate: apps/server/node_modules/.bin/tsx apps/web/scripts/gen-mode-stats-fixtures.ts
final class ModeStatsFixtureTests: XCTestCase {
    private struct Totals: Decodable { let wins: Int; let losses: Int; let totalGames: Int; let bestScore: Int; let fastestTime: Int; let streak: Int; let bestStreak: Int }
    private struct Line: Decodable { let label: String; let value: String }
    private struct Panels: Decodable { let guessDistribution: Bool; let solveTime: Bool; let topWords: Bool; let openerYield: Bool; let positionAccuracy: Bool; let stageBreakdown: Bool }
    private struct Case: Decodable { let dbKey: String; let semantics: String; let guessBase: Int; let totals: Totals; let lines: [Line]; let panels: Panels }

    func testModeStatsMatchSharedFixtures() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "mode-stats-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        let cases = try JSONDecoder().decode([Case].self, from: Data(contentsOf: url))
        XCTAssertFalse(cases.isEmpty)
        for c in cases {
            let t = StatTotals(wins: c.totals.wins, losses: c.totals.losses, totalGames: c.totals.totalGames, bestScore: c.totals.bestScore,
                               fastestTime: c.totals.fastestTime, streak: c.totals.streak, bestStreak: c.totals.bestStreak)
            let got = ModeStats.lines(dbKey: c.dbKey, totals: t, semantics: c.semantics, guessBase: c.guessBase)
            XCTAssertEqual(got.map { $0.label }, c.lines.map { $0.label }, "labels(\(c.dbKey))")
            XCTAssertEqual(got.map { $0.value }, c.lines.map { $0.value }, "values(\(c.dbKey))")
            let p = ModeStats.panels(dbKey: c.dbKey, semantics: c.semantics)
            XCTAssertEqual([p.guessDistribution, p.solveTime, p.topWords, p.openerYield, p.positionAccuracy, p.stageBreakdown],
                           [c.panels.guessDistribution, c.panels.solveTime, c.panels.topWords, c.panels.openerYield, c.panels.positionAccuracy, c.panels.stageBreakdown],
                           "panels(\(c.dbKey))")
        }
    }
}
