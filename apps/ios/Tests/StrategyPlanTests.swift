import XCTest
@testable import WordociousCore

final class StrategyPlanTests: XCTestCase {
    func testSlugMap() {
        XCTAssertEqual(StrategyPlan.gameId(for: "best-starting-words"), "practice")
        XCTAssertEqual(StrategyPlan.gameId(for: "muddle-playbook"), "scramble")
        XCTAssertEqual(StrategyPlan.gameId(for: "vs-battle-tactics"), "vs")
        XCTAssertNil(StrategyPlan.gameId(for: "modes-explained"))
        XCTAssertNil(StrategyPlan.gameId(for: "something-new"))
        XCTAssertEqual(StrategyPlan.gameId(for: "letter-ladder-playbook", titles: [:]), "ladder")
        XCTAssertEqual(StrategyPlan.gameId(for: "letter-ladder2-playbook", titles: ["ladder2": "Letter Ladder2"]), "ladder2")
    }

    func testTipOfTheDayIsDeterministic() {
        XCTAssertEqual(StrategyPlan.dayNumber(year: 1970, month: 1, day: 1), 0)
        XCTAssertEqual(StrategyPlan.dayNumber(year: 2026, month: 10, day: 2), 20728)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        // 2026-10-02 23:30 local in LA is already 10-03 in UTC; the local date wins.
        let late = cal.date(from: DateComponents(year: 2026, month: 10, day: 2, hour: 23, minute: 30))!
        XCTAssertEqual(StrategyPlan.tipIndex(count: 20, now: late, calendar: cal), 20728 % 20)
        XCTAssertEqual(StrategyPlan.tipIndex(count: 0), 0)
    }

    func testTakeaway() {
        let t = StrategyPlan.takeaway("Guesses are questions, not answers. Early guesses gather information.")
        XCTAssertEqual(t?.takeaway, "Guesses are questions, not answers.")
        XCTAssertEqual(t?.rest, "Early guesses gather information.")
        XCTAssertNil(StrategyPlan.takeaway("One sentence with no split point at all"))
        // A split before index 20 is skipped ("e.g. " style abbreviations up front).
        XCTAssertEqual(StrategyPlan.takeaway("Short. Then a much longer sentence follows here! And more.")?.takeaway,
                       "Short. Then a much longer sentence follows here!")
    }
}
