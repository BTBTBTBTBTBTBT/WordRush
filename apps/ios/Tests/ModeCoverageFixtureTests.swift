import XCTest
@testable import WordociousCore

/// FINISH_SPEC BJ12 — every game reaches Stats and Friends Moments. For EVERY
/// catalog mode in mode-coverage-fixtures.json (rendered from packages/core
/// mode-coverage.ts): the Perfect-medal rule, the Moments headlines for its
/// medals and records, and the More Games Sweep copy must match the TS core.
/// Regenerate: apps/server/node_modules/.bin/tsx packages/core/scripts/gen-mode-coverage-fixtures.ts
final class ModeCoverageFixtureTests: XCTestCase {
    private struct PerfectCase: Decodable { let guessCount: Int; let boardsSolved: Int; let totalBoards: Int; let completed: Bool; let expected: Bool }
    private struct Moments: Decodable { let gold: String; let bronze: String; let perfect: String; let fewestValue: String; let fewest: String; let fastestValue: String; let fastest: String }
    private struct Mode: Decodable {
        let dbKey: String; let id: String; let title: String; let group: String
        let guessSemantics: String; let guessBase: Int; let dailyEligible: Bool; let enabled: Bool
        let perfect: [PerfectCase]; let moments: Moments
    }
    private struct MoreSweep: Decodable { let keys: [String]; let sweep: String; let flawless: String }
    private struct Fixture: Decodable { let modes: [Mode]; let moreSweep: MoreSweep }

    private func load() throws -> Fixture {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "mode-coverage-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }

    func testEveryModeMatchesTheSharedRules() throws {
        let f = try load()
        XCTAssertEqual(f.modes.count, 18, "every catalog game with a dbKey")
        for m in f.modes {
            for (i, c) in m.perfect.enumerated() {
                XCTAssertEqual(ModeCoverage.isPerfectDailyResult(gameMode: m.dbKey, group: m.group, guessBase: m.guessBase,
                                                                 guessCount: c.guessCount, boardsSolved: c.boardsSolved,
                                                                 totalBoards: c.totalBoards, completed: c.completed),
                               c.expected, "perfect \(m.dbKey)#\(i)")
            }
            let head = { (type: String, kind: String, me: Bool, value: String?) in
                ModeCoverage.modeMomentHeadline(type: type, me: me, username: "Doug", kind: kind, gameMode: m.dbKey,
                                                gameTitle: m.title, semantics: m.guessSemantics, valueText: value)
            }
            XCTAssertEqual(head("medal", "gold", false, nil), m.moments.gold, m.dbKey)
            XCTAssertEqual(head("medal", "bronze", false, nil), m.moments.bronze, m.dbKey)
            XCTAssertEqual(head("medal", "perfect", true, nil), m.moments.perfect, m.dbKey)
            let fewest = ModeCoverage.recordValueText("fewest_guesses", value: m.guessBase, semantics: m.guessSemantics, guessBase: m.guessBase)
            XCTAssertEqual(fewest, m.moments.fewestValue, m.dbKey)
            XCTAssertEqual(head("record", "fewest_guesses", false, fewest), m.moments.fewest, m.dbKey)
            let fastest = ModeCoverage.recordValueText("fastest_win", value: 75, semantics: m.guessSemantics, guessBase: m.guessBase)
            XCTAssertEqual(fastest, m.moments.fastestValue, m.dbKey)
            XCTAssertEqual(head("record", "fastest_win", false, fastest), m.moments.fastest, m.dbKey)
            // A perfect daily is reachable for every daily game — its Moment can always happen.
            if m.dailyEligible && m.enabled {
                XCTAssertTrue(m.perfect.contains { $0.expected }, "\(m.dbKey) can never earn Perfect")
            }
        }
        XCTAssertEqual(ModeCoverage.moreSweepMomentText(who: "Doug", flawless: false, total: f.moreSweep.keys.count), f.moreSweep.sweep)
        XCTAssertEqual(ModeCoverage.moreSweepMomentText(who: "You", flawless: true, total: f.moreSweep.keys.count), f.moreSweep.flawless)
    }

    /// The app-side wiring (app-target files, read as text): Moments + medals go through ModeCoverage, never a hand list.
    func testAppSurfacesUseTheSharedRules() throws {
        let src = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Wordocious/Sources")
        let medal = try String(contentsOf: src.appendingPathComponent("MedalService.swift"), encoding: .utf8)
        XCTAssertTrue(medal.contains("ModeCoverage.isPerfectDailyResult"), "MedalService must use the shared Perfect rule")
        let feed = try String(contentsOf: src.appendingPathComponent("ActivityFeedView.swift"), encoding: .utf8)
        XCTAssertFalse(feed.contains("all ten"), "the More Games Sweep count comes from the catalog")
        XCTAssertTrue(feed.contains("ModeCoverage.modeMomentHeadline"))
        let profile = try String(contentsOf: src.appendingPathComponent("ProfileTab.swift"), encoding: .utf8)
        XCTAssertTrue(profile.contains("onGameRecorded"), "Stats must reload after ANY recorded game (Unlimited, VS, bots)")
    }
}
