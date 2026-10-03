import XCTest
@testable import WordociousCore

/// FINISH_SPEC §BI9: the feedback popup classifier (web/Android parity).
final class FeedbackToastTests: XCTestCase {
    func testScoreBursts() {
        XCTAssertEqual(FeedbackToast.kind("+1"), .score(points: 1, pangram: false, label: "Good!"))
        XCTAssertEqual(FeedbackToast.kind("+5"), .score(points: 5, pangram: false, label: "Nice!"))
        XCTAssertEqual(FeedbackToast.kind("+6"), .score(points: 6, pangram: false, label: "Nice!"))
        XCTAssertEqual(FeedbackToast.kind("+7"), .score(points: 7, pangram: false, label: "Great!"))
        XCTAssertEqual(FeedbackToast.kind("+9"), .score(points: 9, pangram: false, label: "Amazing!"))
        XCTAssertEqual(FeedbackToast.kind("Pangram! +14"), .score(points: 14, pangram: true, label: "PANGRAM!"))
        XCTAssertEqual(FeedbackToast.kind("pangram!+15"), .score(points: 15, pangram: true, label: "PANGRAM!"))
    }

    func testMessages() {
        XCTAssertEqual(FeedbackToast.kind("+"), .message(tone: .info))
        XCTAssertEqual(FeedbackToast.kind("+5 pts"), .message(tone: .info))
        XCTAssertEqual(FeedbackToast.kind("Not a word we know"), .message(tone: .error))
        XCTAssertEqual(FeedbackToast.kind("Already found"), .message(tone: .error))
        XCTAssertEqual(FeedbackToast.kind("Four letters or more"), .message(tone: .error))
        XCTAssertEqual(FeedbackToast.kind("Must use the center letter"), .message(tone: .error))
        XCTAssertEqual(FeedbackToast.kind("Only the seven letters"), .message(tone: .error))
        XCTAssertEqual(FeedbackToast.kind("Rank up: Genius"), .message(tone: .win))
        XCTAssertEqual(FeedbackToast.kind("Copied!"), .message(tone: .success))
        XCTAssertEqual(FeedbackToast.kind("The word was CRANE"), .message(tone: .loss))
        XCTAssertEqual(FeedbackToast.kind("Hint revealed"), .message(tone: .info))
    }
}
