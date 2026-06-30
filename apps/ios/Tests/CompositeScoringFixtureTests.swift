import XCTest
@testable import WordociousCore

/// Cross-platform parity guard: asserts iOS's `DailyScoring.compositeScore`
/// produces byte-identical totals to the shared fixtures generated from the web
/// source of truth (apps/web/scripts/gen-composite-scoring-fixtures.mjs). The
/// Android suite (CompositeScoringFixtureTest) and the web check script validate
/// the same JSON.
final class CompositeScoringFixtureTests: XCTestCase {

    private struct FixtureInput: Decodable {
        let gameMode: String
        let completed: Bool
        let guessCount: Int
        let timeSeconds: Int
        let boardsSolved: Int
        let totalBoards: Int
        let hintsUsed: Int
        let stagesCompleted: Int?
        let bestCorrectLetters: Int?
    }
    private struct Fixture: Decodable {
        let name: String
        let input: FixtureInput
        let expectedTotal: Double
    }

    func testCompositeScoreMatchesSharedFixtures() throws {
        guard let url = Bundle.module.url(forResource: "composite-scoring-fixtures",
                                          withExtension: "json", subdirectory: "Fixtures") else {
            return XCTFail("Missing fixture: composite-scoring-fixtures.json")
        }
        let cases = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url))
        XCTAssertFalse(cases.isEmpty, "expected composite-scoring fixtures to load")
        for c in cases {
            let got = DailyScoring.compositeScore(
                gameMode: c.input.gameMode, completed: c.input.completed,
                guessCount: c.input.guessCount, timeSeconds: c.input.timeSeconds,
                boardsSolved: c.input.boardsSolved, totalBoards: c.input.totalBoards,
                hintsUsed: c.input.hintsUsed, stagesCompleted: c.input.stagesCompleted,
                bestCorrectLetters: c.input.bestCorrectLetters)
            XCTAssertEqual(got, c.expectedTotal, accuracy: 0.001, c.name)
        }
    }
}
