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

    // MARK: the gate decision (2026-10-10: the black screen that never cleared)

    func testGateWaitsForAReturningPlayerButNeverPastTheCap() {
        func v(_ stored: AgeCheck.State? = nil, live: Bool = true, session: Bool = true, done: Bool = false, ms: Int = 0) -> AgeGate.View {
            AgeGate.view(stored: stored, live: live, hadSession: session, serverCheckDone: done, elapsedMs: ms)
        }
        XCTAssertEqual(v(), .placeholder)
        XCTAssertEqual(v(ms: AgeGate.maxWaitMs - 1), .placeholder)
        XCTAssertEqual(v(ms: AgeGate.maxWaitMs), .question)
        XCTAssertEqual(v(ms: 60_000), .question)
        XCTAssertEqual(v(done: true), .question)
        XCTAssertEqual(v(session: false), .question)
        XCTAssertEqual(v(.ok), .pass)
        XCTAssertEqual(v(live: false), .pass)
        XCTAssertEqual(v(.under), .under)
        XCTAssertLessThanOrEqual(AgeGate.maxWaitMs, 2000)
    }

    func testGateMatchesTheSharedFixture() throws {
        struct Case: Decodable { let stored: String?; let live: Bool; let hadSession: Bool; let serverCheckDone: Bool; let elapsedMs: Int; let view: String }
        struct Fixture: Decodable { let maxWaitMs: Int; let cases: [Case] }
        let url = try XCTUnwrap(Bundle.module.url(forResource: "age-gate-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        let f = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
        XCTAssertEqual(f.maxWaitMs, AgeGate.maxWaitMs)
        XCTAssertFalse(f.cases.isEmpty)
        for c in f.cases {
            let got = AgeGate.view(stored: c.stored.flatMap { AgeCheck.State(rawValue: $0) }, live: c.live, hadSession: c.hadSession,
                                   serverCheckDone: c.serverCheckDone, elapsedMs: c.elapsedMs)
            XCTAssertEqual(got.rawValue, c.view, "\(c)")
        }
    }
}

