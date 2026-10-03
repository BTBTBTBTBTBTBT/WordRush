import XCTest
@testable import WordociousCore

/// Founder 10-02: the close screen's countdown line and the win popup's
/// answer rows / tile fit.
final class FinishCloseScreenTests: XCTestCase {
    func testCountdown() {
        XCTAssertEqual(FinishCloseScreen.countdown(seconds: 3 * 3600 + 12 * 60), "3h 12m")
        XCTAssertEqual(FinishCloseScreen.countdown(seconds: 3 * 3600 + 11 * 60 + 1), "3h 12m")   // rounds up
        XCTAssertEqual(FinishCloseScreen.countdown(seconds: 47 * 60), "47m")
        XCTAssertEqual(FinishCloseScreen.countdown(seconds: 3600), "1h 0m")
        XCTAssertEqual(FinishCloseScreen.countdown(seconds: 5), "1m")
        XCTAssertEqual(FinishCloseScreen.countdown(seconds: 0), "1m")
        XCTAssertEqual(FinishCloseScreen.countdown(seconds: -10), "1m")
    }

    /// Founder 10-02 follow-up: the countdown is the SHARE RESULTS candy's second line.
    func testCountdownLine() {
        XCTAssertEqual(FinishCloseScreen.countdownLine(game: "OctoWord", seconds: 3 * 3600 + 12 * 60), "Next OctoWord in 3h 12m")
        XCTAssertEqual(FinishCloseScreen.countdownLine(game: "Gauntlet", seconds: 30), "Next Gauntlet in 1m")
    }

    func testAnswerRows() {
        XCTAssertEqual(FinishCloseScreen.answerRows("HUBBLE SPACE TELESCOPE"), ["HUBBLE", "SPACE", "TELESCOPE"])
        XCTAssertEqual(FinishCloseScreen.answerRows("CRANE"), ["CRANE"])
        XCTAssertEqual(FinishCloseScreen.answerRows("  NEW   YORK "), ["NEW", "YORK"])
        XCTAssertEqual(FinishCloseScreen.answerRows(""), [])
    }

    func testFitTile() {
        // Short words keep the default size.
        XCTAssertEqual(FinishCloseScreen.fitTile(letters: 5, width: 300, gap: 3, maxTile: 28), 28)
        // A 9-letter word in a 240-pt tray shrinks to fit exactly.
        let t = FinishCloseScreen.fitTile(letters: 9, width: 240, gap: 3, maxTile: 28)
        XCTAssertEqual(9 * t + 8 * 3, 240, accuracy: 1e-9)
        // Never below the floor.
        XCTAssertEqual(FinishCloseScreen.fitTile(letters: 40, width: 200, gap: 3, maxTile: 28), 12)
        // A fixed extra (the check badge) is reserved.
        let b = FinishCloseScreen.fitTile(letters: 5, width: 120, gap: 3, extra: 20, maxTile: 28)
        XCTAssertEqual(5 * b + 4 * 3 + 20, 120, accuracy: 1e-9)
    }
}
