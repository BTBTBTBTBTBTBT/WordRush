import XCTest
@testable import WordociousCore

final class ThemeChoiceTests: XCTestCase {
    private func fixtures() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "theme-choice-fixtures", withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: "theme-choice-fixtures", withExtension: "json"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }
    private func opt(_ v: Any) -> String? { v is NSNull ? nil : (v as? String) }

    func testEffectiveMatchesTheSharedFixture() throws {
        for row in try XCTUnwrap(fixtures()["effective"] as? [[String: Any]]) {
            let i = try XCTUnwrap(row["in"] as? [Any]), o = try XCTUnwrap(row["out"] as? [Any])
            let c = ThemeChoiceRules.Choice(theme: i[0] as! String, seasonOptOut: opt(i[1]))
            let r = ThemeChoiceRules.effective(c, season: opt(i[2]), switchOn: i[3] as! Bool, date: i[4] as! String)
            XCTAssertEqual(r.base, o[0] as? String, "\(i)")
            XCTAssertEqual(r.seasonal, o[1] as? Bool, "\(i)")
        }
    }

    func testPickMatchesTheSharedFixture() throws {
        for row in try XCTUnwrap(fixtures()["pick"] as? [[String: Any]]) {
            let i = try XCTUnwrap(row["in"] as? [Any]), o = try XCTUnwrap(row["out"] as? [Any])
            let c = ThemeChoiceRules.Choice(theme: i[0] as! String, seasonOptOut: opt(i[1]))
            let r = ThemeChoiceRules.pick(c, picked: i[2] as! String, season: opt(i[3]), date: i[4] as! String)
            XCTAssertEqual(r.theme, o[0] as? String, "\(i)")
            XCTAssertEqual(r.seasonOptOut, opt(o[1]), "\(i)")
        }
    }

    func testRowAndEndLabel() throws {
        let f = try fixtures()
        for row in try XCTUnwrap(f["showRow"] as? [[String: Any]]) {
            let i = try XCTUnwrap(row["in"] as? [Any])
            XCTAssertEqual(ThemeChoiceRules.showSeasonalRow(season: opt(i[0]), switchOn: i[1] as! Bool), row["out"] as? Bool)
        }
        for row in try XCTUnwrap(f["endLabel"] as? [[String: Any]]) {
            XCTAssertEqual(ThemeChoiceRules.endLabel(season: row["in"] as! String), opt(row["out"]!))
        }
    }

    func testSeasonEndRestoresThePreviousTheme() {
        let c = ThemeChoiceRules.pick(.init(theme: "ocean"), picked: "seasonal", season: "halloween", date: "2026-10-12")
        XCTAssertEqual(ThemeChoiceRules.effective(c, season: "halloween", switchOn: true, date: "2026-10-12").seasonal, true)
        let after = ThemeChoiceRules.effective(c, season: nil, switchOn: true, date: "2026-11-01")
        XCTAssertEqual(after.base, "ocean")
        XCTAssertFalse(after.seasonal)
    }
}
