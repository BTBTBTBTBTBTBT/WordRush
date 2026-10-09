import XCTest
@testable import WordociousCore

/// Item 46: the moment shares are the same cards as the web builders (Fixtures/moment-share-fixtures.json).
final class MomentShareTests: XCTestCase {
    func testBuildersMatchTheSharedFixture() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "moment-share-fixtures", withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: "moment-share-fixtures", withExtension: "json"))
        let root = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        let cases = try XCTUnwrap(root["cases"] as? [[String: Any]])
        XCTAssertGreaterThanOrEqual(cases.count, 12)
        for c in cases {
            let a = try XCTUnwrap(c["args"] as? [String: Any])
            let want = try XCTUnwrap(c["expect"] as? [String: Any])
            let label = "\(c["kind"] ?? "?") \(a)"
            let got: MomentShare.Moment
            switch c["kind"] as? String {
            case "levelUp":
                got = MomentShare.levelUp(level: try XCTUnwrap(a["level"] as? Int), tier: try XCTUnwrap(a["tier"] as? String),
                                          accentHex: (a["accentHex"] as? String) ?? MomentShare.purple, xpToNext: a["xpToNext"] as? Int)
            case "pocket":
                got = MomentShare.pocketResult(gameTitle: try XCTUnwrap(a["gameTitle"] as? String), won: a["won"] as? Bool,
                                               mine: a["mine"] as? Int, theirs: a["theirs"] as? Int,
                                               opponent: try XCTUnwrap(a["opponent"] as? String))
            default:
                got = MomentShare.streak(try XCTUnwrap(a["streak"] as? Int), best: try XCTUnwrap(a["best"] as? Int),
                                         lastDays: try XCTUnwrap(a["lastDays"] as? [Bool]))
            }
            XCTAssertEqual(got.title, want["title"] as? String, label)
            XCTAssertEqual(got.accentHex, want["accentHex"] as? String, label)
            XCTAssertEqual(got.big, want["big"] as? String, label)
            XCTAssertEqual(got.bigLabel, want["bigLabel"] as? String, label)
            XCTAssertEqual(got.lines, want["lines"] as? [String], label)
            XCTAssertEqual(got.dots, (want["dots"] as? [Bool]) ?? [], label)
            XCTAssertEqual(got.won, want["won"] as? Bool, label)
            XCTAssertEqual(got.hero.rawValue, want["hero"] as? String, label)
        }
    }
}
