import XCTest
@testable import WordociousCore

/// Time of day (10-16): the slot per hour and the next boundary, pinned by time-of-day-fixtures.json.
final class TimeOfDayTests: XCTestCase {
    func testMatchesSharedFixture() throws {
        struct H: Decodable { let hour: Double; let time: String }
        struct P: Decodable { let y: Int; let m: Int; let d: Int; let h: Int; let mi: Int }
        struct N: Decodable { let from: P; let next: P }
        struct F: Decodable { let times: [String]; let hours: [H]; let edges: [H]; let next: [N] }
        let url = try XCTUnwrap(Bundle.module.url(forResource: "time-of-day-fixtures", withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: "time-of-day-fixtures", withExtension: "json"))
        let f = try JSONDecoder().decode(F.self, from: Data(contentsOf: url))
        XCTAssertEqual(f.times, TimeOfDay.allCases.map(\.rawValue))
        for h in f.hours + f.edges { XCTAssertEqual(TimeOfDay.at(hour: h.hour).rawValue, h.time, "hour \(h.hour)") }
        let cal = Calendar.current
        for n in f.next {
            let from = try XCTUnwrap(cal.date(from: DateComponents(year: n.from.y, month: n.from.m, day: n.from.d, hour: n.from.h, minute: n.from.mi)))
            let want = try XCTUnwrap(cal.date(from: DateComponents(year: n.next.y, month: n.next.m, day: n.next.d, hour: n.next.h, minute: n.next.mi)))
            XCTAssertEqual(TimeOfDay.nextChange(after: from), want, "\(n.from)")
        }
    }
}
