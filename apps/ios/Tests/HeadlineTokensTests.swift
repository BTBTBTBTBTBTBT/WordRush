import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AR: live headline token splitting — parity with the web
/// packages/core/src/headline-tokens.ts via the shared fixture.
final class HeadlineTokensTests: XCTestCase {
    private struct Fixture: Decodable {
        struct Case: Decodable {
            let text: String
            let names: [String]
            let tokens: [HeadlineToken]
        }
        let cases: [Case]
    }

    func testFixtureParity() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "headline-tokens-fixtures", withExtension: "json",
                                                  subdirectory: "Fixtures"))
        let fx = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
        XCTAssertFalse(fx.cases.isEmpty)
        for c in fx.cases {
            XCTAssertEqual(HeadlineTokens.split(c.text, names: c.names), c.tokens, c.text)
        }
    }

    func testTokensJoinBackToText() {
        for t in ["WARMING UP · 3 DOWN", "BEAT ANN MARIE · 2 UP", "3RDS 12AB #x", ""] {
            XCTAssertEqual(HeadlineTokens.split(t, names: ["Ann Marie"]).map(\.text).joined(), t)
        }
    }

    func testBasics() {
        XCTAssertEqual(HeadlineTokens.split("WARMING UP · 3 DOWN"), [
            HeadlineToken(.text, "WARMING UP "), HeadlineToken(.star, "·"), HeadlineToken(.text, " "),
            HeadlineToken(.number, "3"), HeadlineToken(.text, " DOWN"),
        ])
        XCTAssertEqual(HeadlineTokens.split("OLIVER LEADS", names: ["oliver"]).first, HeadlineToken(.name, "OLIVER"))
        // A number glued to letters stays text.
        XCTAssertEqual(HeadlineTokens.split("3RDS"), [HeadlineToken(.text, "3RDS")])
    }
}
