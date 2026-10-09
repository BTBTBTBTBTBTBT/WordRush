import XCTest
@testable import WordociousCore

final class AgeCheckTests: XCTestCase {
    private func date(_ y: Int) -> Date {
        Calendar(identifier: .gregorian).date(from: DateComponents(year: y, month: 10, day: 9, hour: 12))!
    }
    private var cal: Calendar { Calendar(identifier: .gregorian) }

    func testWheelHasNoDefaultAndListsNewestFirst() {
        let y = AgeCheck.years(now: date(2026), calendar: cal)
        XCTAssertEqual(y.first, 2026)
        XCTAssertEqual(y.last, 1926)
        XCTAssertEqual(y.count, 101)
    }

    func testStrictYearReading() {
        let now = date(2026)
        XCTAssertEqual(AgeCheck.verdict(year: 2012, now: now, calendar: cal), .pass)
        XCTAssertEqual(AgeCheck.verdict(year: 2013, now: now, calendar: cal), .under) // turns 13 sometime in 2026
        XCTAssertEqual(AgeCheck.verdict(year: 2018, now: now, calendar: cal), .under)
        XCTAssertEqual(AgeCheck.verdict(year: 1990, now: now, calendar: cal), .pass)
        XCTAssertEqual(AgeCheck.verdict(year: 2027, now: now, calendar: cal), .invalid)
        XCTAssertEqual(AgeCheck.verdict(year: 1900, now: now, calendar: cal), .invalid)
    }

    func testStoredValueRoundTripAndForgedOk() throws {
        let now = date(2026)
        let ok = try JSONEncoder().encode(AgeCheck.Stored(state: .ok, year: 1990))
        XCTAssertEqual(AgeCheck.parse(ok, now: now, calendar: cal), AgeCheck.Stored(state: .ok, year: 1990))
        let forged = try JSONEncoder().encode(AgeCheck.Stored(state: .ok, year: 2018))
        XCTAssertEqual(AgeCheck.parse(forged, now: now, calendar: cal), AgeCheck.Stored(state: .under, year: 2018))
        XCTAssertNil(AgeCheck.parse(Data("garbage".utf8), now: now, calendar: cal))
        XCTAssertNil(AgeCheck.parse(nil, now: now, calendar: cal))
    }
}
