import XCTest
@testable import WordociousCore

/// Same cases as apps/web/lib/invites-row.test.ts.
final class InvitesRowRulesTests: XCTestCase {
    private func date(_ s: String) -> Date { ISO8601DateFormatter().date(from: s)! }

    func testMergesNewestFirst() {
        let live = InviteRowItem(variant: .live, code: "AAAAAAAA", gameMode: "DUEL", sender: "Johnny", senderId: "u1", inviteId: "id1", createdAt: date("2026-10-09T10:00:00Z"))
        let race = InviteRowItem(variant: .race, code: "BBBBBBBB", gameMode: "DUEL", sender: "Doug", senderId: "u2", raceLine: "solved in 4 · 1:12", createdAt: date("2026-10-09T11:00:00Z"))
        let rows = InvitesRowRules.build([live, race], dismissed: [])
        XCTAssertEqual(rows.map(\.id), ["race:BBBBBBBB", "live:AAAAAAAA"])
    }

    func testDismissedCaseInsensitive() {
        let race = InviteRowItem(variant: .race, code: "BBBBBBBB", gameMode: "DUEL", sender: "Doug", senderId: "u2", createdAt: date("2026-10-09T11:00:00Z"))
        XCTAssertTrue(InvitesRowRules.build([race], dismissed: ["bbbbbbbb"]).isEmpty)
    }

    func testRaceLine() {
        XCTAssertEqual(InvitesRowRules.raceLine(solved: true, guesses: 4, timeMs: 72_000), "solved in 4 · 1:12")
        XCTAssertEqual(InvitesRowRules.raceLine(solved: false, guesses: 6, timeMs: 1000), "a run to beat")
    }
}
